import { addNetworkStateListener } from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ApiRequestError } from '../../api';
import { useSession } from '../../state/session';
import { downloadOfflinePackage } from '../downloadPackage';
import { offlineProgress } from '../progress';
import { useOfflineState } from '../state';
import { keepOnly, savedSteps } from '../store';

/** After a failure the download tries again by itself this often, for a connection that returns without an event. */
export const RETRY_AFTER_MS = 30_000;

/** A lost connection or a server that is down is worth trying again; a refusal (not a member, no mission) is not. */
const worthRetrying = (error: unknown) =>
  !(error instanceof ApiRequestError) || error.status === 0 || error.status >= 500;

/**
 * Downloads the offline package of the searcher's mission right after joining (UC-F03, decision 84), and again when
 * the app starts with it incomplete. A cut-off download resumes by itself when the phone gets a connection, when the
 * app comes to the foreground, after a while, or on "try again". Mount it once, in the mission screens.
 */
export function useOfflineDownload(): void {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const ended = useSession((s) => s.participation?.status === 'ended');

  useEffect(() => {
    if (!token || !missionId || ended) return;
    const state = useOfflineState;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    state.getState().start(missionId);

    const run = async () => {
      const { running, loaded, saved } = state.getState();
      if (running || !loaded || controller.signal.aborted || offlineProgress(saved).complete) return;
      clearTimeout(timer);
      state.getState().setRunning(true);
      try {
        await downloadOfflinePackage({
          missionId,
          token,
          signal: controller.signal,
          onStepSaved: state.getState().stepSaved,
        });
        state.getState().setFailed(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        state.getState().setFailed(true);
        if (worthRetrying(error)) timer = setTimeout(() => void run(), RETRY_AFTER_MS);
      } finally {
        state.getState().setRunning(false);
      }
    };

    void keepOnly(missionId)
      .then(() => savedSteps(missionId))
      .then((saved) => {
        if (controller.signal.aborted) return;
        state.getState().setSaved(saved);
        return run();
      })
      .catch(() => {
        // The phone cannot read its storage: nothing is known to be saved, so it shows as interrupted.
        if (controller.signal.aborted) return;
        state.getState().setSaved([]);
        state.getState().setFailed(true);
      });

    const network = addNetworkStateListener((net) => {
      if (net.isConnected && net.isInternetReachable !== false) void run();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    const unsubscribe = state.subscribe((now, before) => {
      if (now.attempt !== before.attempt) void run();
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
      network.remove();
      appState.remove();
      unsubscribe();
    };
  }, [token, missionId, ended]);
}

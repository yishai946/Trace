import { addNetworkStateListener } from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ApiRequestError } from '../../api';
import { useSession } from '../../state/session';
import { downloadOfflinePackage } from '../downloadPackage';
import { requestOfflineRefresh } from '../refreshPackage';
import { offlineProgress } from '../progress';
import { useOfflineState } from '../state';
import { clearOfflinePackages, keepOnly, savedSteps } from '../store';

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
    // The activity is over for this searcher: the missing person's details do not stay on the phone.
    if (ended) void clearOfflinePackages().catch(() => undefined);
    if (!token || !missionId || ended) return;
    const state = useOfflineState;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    state.getState().start(missionId);
    // This run still owns the state: not aborted (mission switch, sign-out) and not replaced by another mission's.
    const current = () => !controller.signal.aborted && state.getState().missionId === missionId;

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
          onStepSaved: (step) => current() && state.getState().stepSaved(step),
        });
        state.getState().setFailed(false);
        // An edit made while the download ran is not in what it saved.
        if (current()) void requestOfflineRefresh({ missionId, token, signal: controller.signal });
      } catch (error) {
        if (!current()) return;
        const retry = worthRetrying(error);
        state.getState().setFailed(true, !retry);
        if (retry) timer = setTimeout(() => void run(), RETRY_AFTER_MS);
      } finally {
        if (current()) state.getState().setRunning(false);
      }
    };

    void keepOnly(missionId)
      .then(() => savedSteps(missionId))
      .then((saved) => {
        if (!current()) return;
        state.getState().setSaved(saved);
        return run();
      })
      .catch(() => {
        // The phone cannot read its storage: nothing is known to be saved, so it shows as interrupted.
        if (!current()) return;
        state.getState().setSaved([]);
        state.getState().setFailed(true, true);
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

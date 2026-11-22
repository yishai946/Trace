import type { Sos } from '@trace/schemas';
import { ActiveSosAlert } from './ActiveSosAlert';
import { SosUnknownAlert } from './SosUnknownAlert';

export interface SosAlertProps {
  /** Newest first, as the API returns them. Undefined while they load or when they could not be loaded. */
  sos: Sos[] | undefined;
  onOpen: () => void;
  /** The SOS could not be loaded or refreshed: whether one is active is not known (decision 24). */
  failed?: boolean;
  onRetry?: () => void;
  /** The phone: one line under the top bar. */
  compact?: boolean;
}

/**
 * The critical SOS alert (UC-C14, decision 24): identity, polygon, time and the location itself, shown while at least
 * one SOS is active, so it survives a reload and is gone once every SOS is closed. Several are counted and the newest
 * is described. When the SOS cannot be loaded it says so instead of staying silent, and offers a retry.
 */
export function SosAlert({ sos, onOpen, failed, onRetry, compact }: SosAlertProps) {
  return (
    <>
      <ActiveSosAlert sos={sos ?? []} onOpen={onOpen} compact={compact} />
      {failed && <SosUnknownAlert onRetry={onRetry} compact={compact} />}
    </>
  );
}

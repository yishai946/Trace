import type { Sos } from '@trace/schemas';
import type { PhoneScreen } from '../phoneScreen';
import { SosAlert } from '../SosAlert';
import styles from './PhoneMissionScreen.module.css';

/**
 * The SOS alert above the Reports and Messages screens (UC-C14: it stays until the SOS is closed). The map stage has
 * its own, and the SOS screen is where the alert leads.
 */
export function SosStrip({
  screen,
  sos,
  failed,
  onRetry,
  onOpen,
}: {
  screen: PhoneScreen;
  /** Newest first. Undefined while they load or when they could not be loaded. */
  sos: Sos[] | undefined;
  failed: boolean;
  onRetry: () => void;
  onOpen: () => void;
}) {
  if (screen === 'map' || screen === 'sos') return null;
  if (!failed && !(sos ?? []).some((s) => s.status === 'active')) return null;
  return (
    <div className={styles.strip}>
      <SosAlert compact sos={sos} failed={failed} onRetry={onRetry} onOpen={onOpen} />
    </div>
  );
}

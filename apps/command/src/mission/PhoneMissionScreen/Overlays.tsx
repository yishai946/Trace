import type { Mission, Report, Sos } from '@trace/schemas';
import type { ReactNode } from 'react';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { JoinCodePanel } from '../JoinCodePanel';
import { SosAlert } from '../SosAlert';
import styles from './PhoneMissionScreen.module.css';

interface OverlaysProps {
  mission: Mission;
  /** A critical report is waiting: its alert shows. */
  critical: boolean;
  /** The mission's SOS, newest first: an active one shows its alert above the others. Undefined while they load. */
  sos: Sos[] | undefined;
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  /** Why the mission opened with a problem, e.g. the photo that was not saved. */
  notice: string | null;
  joinOpen: boolean;
  onCloseJoin: () => void;
  /** The open place search; null when it is closed. */
  search: ReactNode;
  onOpenReport: (id: string) => void;
  onOpenSos: () => void;
}

/** What stacks under the top bar when there is something to say: the critical alert, a notice, the join code, the search. */
export function Overlays({
  mission,
  critical,
  sos,
  reports,
  notice,
  joinOpen,
  onCloseJoin,
  search,
  onOpenReport,
  onOpenSos,
}: OverlaysProps) {
  const sosActive = (sos ?? []).some((s) => s.status === 'active');
  if (!critical && !sosActive && !notice && !joinOpen && !search) return null;
  return (
    <div className={styles.below}>
      <SosAlert compact sos={sos ?? []} onOpen={onOpenSos} />
      {critical && <CriticalReportAlert compact reports={reports ?? []} onOpen={onOpenReport} />}
      {notice && (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      )}
      {joinOpen && <JoinCodePanel mission={mission} onClose={onCloseJoin} />}
      {search && <div className={styles.search}>{search}</div>}
    </div>
  );
}

import type { Mission, Report } from '@trace/schemas';
import type { ReactNode } from 'react';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { JoinCodePanel } from '../JoinCodePanel';
import styles from './PhoneMissionScreen.module.css';

interface OverlaysProps {
  mission: Mission;
  /** A critical report is waiting: its alert shows. */
  critical: boolean;
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  /** Why the mission opened with a problem, e.g. the photo that was not saved. */
  notice: string | null;
  joinOpen: boolean;
  onCloseJoin: () => void;
  /** The open place search; null when it is closed. */
  search: ReactNode;
  onOpenReport: (id: string) => void;
}

/** What stacks under the top bar when there is something to say: the critical alert, a notice, the join code, the search. */
export function Overlays({
  mission,
  critical,
  reports,
  notice,
  joinOpen,
  onCloseJoin,
  search,
  onOpenReport,
}: OverlaysProps) {
  if (!critical && !notice && !joinOpen && !search) return null;
  return (
    <div className={styles.below}>
      <CriticalReportAlert compact reports={reports ?? []} onOpen={onOpenReport} />
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

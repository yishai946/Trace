import type { Mission, Report, Sos } from '@trace/schemas';
import type { ReactNode } from 'react';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { JoinCodePanel } from '../JoinCodePanel';
import { OutsidePolygonAlert } from '../OutsidePolygonAlert';
import type { OutsideSearcher } from '../outsideSearchers';
import { SosAlert } from '../SosAlert';
import styles from './PhoneMissionScreen.module.css';

interface OverlaysProps {
  mission: Mission;
  /** A critical report is waiting: its alert shows. */
  critical: boolean;
  /** The mission's SOS, newest first: an active one shows its alert above the others. Undefined while they load. */
  sos: Sos[] | undefined;
  /** The SOS could not be loaded: the alert says the state is unknown. */
  sosFailed: boolean;
  onRetrySos: () => void;
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
  /** Searchers outside their polygon now (UC-S04), outside the longest first. */
  outside: OutsideSearcher[];
  onOpenSearcher: (participantId: string) => void;
}

/** What stacks under the top bar when there is something to say: the critical alert, the out-of-polygon warning, a notice, the join code, the search. */
export function Overlays({
  mission,
  critical,
  sos,
  sosFailed,
  onRetrySos,
  reports,
  notice,
  joinOpen,
  onCloseJoin,
  search,
  onOpenReport,
  onOpenSos,
  outside,
  onOpenSearcher,
}: OverlaysProps) {
  const sosActive = (sos ?? []).some((s) => s.status === 'active');
  if (outside.length === 0 && !critical && !sosActive && !sosFailed && !notice && !joinOpen && !search) return null;
  return (
    <div className={styles.below}>
      <SosAlert compact sos={sos} failed={sosFailed} onRetry={onRetrySos} onOpen={onOpenSos} />
      {critical && <CriticalReportAlert compact reports={reports ?? []} onOpen={onOpenReport} />}
      <OutsidePolygonAlert compact searchers={outside} onOpen={onOpenSearcher} />
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

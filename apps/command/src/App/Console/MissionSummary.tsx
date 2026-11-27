import { isMissionEnded } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import styles from '../App.module.css';
import { EndedSummary } from '../../mission/EndedSummary';
import type { ConsoleNav } from './useConsoleNav';
import type { MissionData } from './useMissionData';

interface MissionSummaryProps {
  mission: Mission;
  data: MissionData;
  nav: ConsoleNav;
}

/** The ended mission's summary (Cd15) in the map's end-side slot, from the data the console already loaded. */
export function MissionSummary({ mission, data, nav }: MissionSummaryProps) {
  if (!isMissionEnded(mission.status)) return null;
  return (
    <div className={`${styles.inspector} ${styles.scrolling}`}>
      <EndedSummary
        mission={mission}
        polygons={data.polygons.data ?? []}
        participants={data.participants.data ?? []}
        reports={data.reports.data ?? []}
        sos={data.sos.data ?? []}
        events={data.timeline.data}
        onOpenTimeline={() => nav.setView('timeline')}
      />
    </div>
  );
}

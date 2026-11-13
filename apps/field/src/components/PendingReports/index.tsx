import { usePendingReports } from '../../reports/usePendingReports';
import { Badge } from '../Badge';

/** "ממתין לשליחה" (UC-F09): the reports of this mission that wait on the phone for a connection. Nothing when none. */
export function PendingReports({ missionId }: { missionId: string | null }) {
  const { count } = usePendingReports(missionId);
  if (count === 0) return null;
  return <Badge tone="warn" dot label={count === 1 ? 'דיווח ממתין לשליחה' : `${count} דיווחים ממתינים לשליחה`} />;
}

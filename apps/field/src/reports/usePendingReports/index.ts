import { CreateReportBody } from '@trace/schemas';
import { useEffect, useState } from 'react';
import { onOutboxChange, pendingOf } from '../../outbox';

interface PendingReports {
  /** Reports of the mission that wait on the phone. */
  count: number;
  /** One of them says the missing person was located: the commander does not know yet (UC-F09). */
  located: boolean;
  /** The valid ones, in the order they wait, for the list of reports (UC-F11). */
  items: CreateReportBody[];
}

const NONE: PendingReports = { count: 0, located: false, items: [] };

/** The reports of the mission that wait in the outbox, kept up to date as they are added and sent. */
export function usePendingReports(missionId: string | null): PendingReports {
  const [pending, setPending] = useState<PendingReports>(NONE);
  useEffect(() => {
    if (!missionId) return;
    let active = true;
    const load = () =>
      void pendingOf('report', missionId)
        .then((items) => {
          if (!active) return;
          const reports = items.flatMap((item) => {
            const parsed = CreateReportBody.safeParse(item.payload);
            return parsed.success ? [parsed.data] : [];
          });
          setPending({
            count: items.length,
            located: reports.some((report) => report.type === 'located'),
            items: reports,
          });
        })
        .catch(() => undefined);
    load();
    const off = onOutboxChange(load);
    return () => {
      active = false;
      off();
    };
  }, [missionId]);
  return missionId ? pending : NONE;
}

import { useCallback, useEffect, useState } from 'react';
import { markDroppedSeen, onOutboxChange, unseenDropped } from '../../outbox';

/**
 * The reports that waited on the phone and were then refused by the server for good (the mission ended, or access was
 * removed), which the searcher has not been told about (UC-F09). A report refused while the form was open is not
 * counted: the form says it itself.
 */
export function useRejectedReports() {
  const [ids, setIds] = useState<string[]>(() => unseenDropped('report'));
  useEffect(() => {
    const read = () =>
      setIds((current) => {
        const next = unseenDropped('report');
        return next.length === current.length && next.every((id, i) => id === current[i]) ? current : next;
      });
    read();
    return onOutboxChange(read);
  }, []);
  const acknowledge = useCallback(() => {
    markDroppedSeen(unseenDropped('report'));
    setIds([]);
  }, []);
  return { count: ids.length, acknowledge };
}

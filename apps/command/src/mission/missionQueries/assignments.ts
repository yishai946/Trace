import { AssignmentRecordList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { missionKeys } from './keys';

/** The mission's assignment history, oldest first (UC-C20). Fetched only for an ended mission, where it is final. */
export function useAssignments(missionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: missionKeys.assignments(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/assignments`, { schema: AssignmentRecordList, signal }),
    enabled: !!missionId && enabled,
  });
}

import { compareReportsNewestFirst } from '@trace/domain';
import type {
  Message,
  Mission,
  MissionEvent,
  MissionPolygon,
  Participant,
  Report,
  Sighting,
  TimelineEvent,
} from '@trace/schemas';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  addOnce,
  missionKeys,
  patchById,
  prepend,
  removeById,
  replaceById,
  upsertById,
  type ListUpdate,
} from '../mission/missionQueries';

/**
 * Changes a list that is fetched when its screen opens. Not cached means it was never opened, or its first fetch is in
 * flight and may have read the server before this event: that fetch is cancelled and started again (an in-flight first
 * fetch is otherwise reused), so it cannot leave the list without the event. Nothing happens if it was never opened.
 */
function updateOpened<T>(queryClient: QueryClient, key: QueryKey, update: ListUpdate<T>) {
  if (!queryClient.getQueryData(key)) {
    void queryClient.cancelQueries({ queryKey: key }).then(() => queryClient.invalidateQueries({ queryKey: key }));
    return;
  }
  queryClient.setQueryData<T[]>(key, update);
}

// The sort is stable, so events of the same instant keep their arrival order, as the API orders them by recording order.
const byOccurrence = (list: TimelineEvent[], event: TimelineEvent) =>
  [...list, event].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
const newestFirst = (list: Report[], report: Report) => [...list, report].sort(compareReportsNewestFirst);

/** The events of the lists that open with their screen: the Timeline, the messages and the reports. */
function applyFeedEvent(queryClient: QueryClient, event: MissionEvent) {
  const { missionId } = event;
  switch (event.type) {
    case 'timeline.recorded':
      updateOpened(queryClient, missionKeys.timeline(missionId), addOnce(event.event, byOccurrence));
      return;
    case 'message.sent':
      updateOpened(queryClient, missionKeys.messages(missionId), addOnce(event.message, prepend));
      return;
    case 'message.receipt': {
      const { recipient } = event;
      queryClient.setQueryData<Message[]>(
        missionKeys.messages(missionId),
        patchById(event.messageId, (message) => ({
          ...message,
          recipients: message.recipients.map((r) => (r.participantId === recipient.participantId ? recipient : r)),
        })),
      );
      return;
    }
    case 'report.saved':
      updateOpened(queryClient, missionKeys.reports(missionId), upsertById(event.report, newestFirst));
      return;
    case 'report.deleted':
      updateOpened(queryClient, missionKeys.reports(missionId), removeById<Report>(event.reportId));
      return;
  }
}

/** The events of what the map shows: the mission, its polygons, sightings and searchers. */
function applyMapEvent(queryClient: QueryClient, event: MissionEvent) {
  const { missionId } = event;
  const patchMission = (change: (mission: Mission) => Mission) =>
    queryClient.setQueryData<Mission[]>(missionKeys.all, patchById(missionId, change));
  const participants = (update: ListUpdate<Participant>) =>
    queryClient.setQueryData<Participant[]>(missionKeys.participants(missionId), update);
  switch (event.type) {
    case 'polygon.saved':
      queryClient.setQueryData<MissionPolygon[]>(missionKeys.polygons(missionId), upsertById(event.polygon));
      return;
    case 'polygon.deleted':
      queryClient.setQueryData<MissionPolygon[]>(missionKeys.polygons(missionId), removeById(event.polygonId));
      return;
    case 'sighting.saved':
      queryClient.setQueryData<Sighting[]>(missionKeys.sightings(missionId), upsertById(event.sighting));
      return;
    case 'lkp.changed':
      patchMission((mission) => ({ ...mission, lkp: event.lkp }));
      // Whether a sighting is suggested depends on the current LKP, so refetch it instead of patching it by hand.
      void queryClient.invalidateQueries({ queryKey: missionKeys.lkps(missionId) });
      void queryClient.invalidateQueries({ queryKey: missionKeys.sightings(missionId) });
      return;
    case 'rally.changed':
      patchMission((mission) => ({ ...mission, rallyPoint: event.rallyPoint, updatedAt: event.updatedAt }));
      return;
    case 'mission.updated':
      patchMission(() => event.mission);
      return;
    case 'participant.moved':
      participants(
        patchById(event.participantId, (p) => ({ ...p, position: event.position, positionAt: event.positionAt })),
      );
      return;
    case 'participant.updated':
      participants(replaceById(event.participant));
      return;
    case 'participant.joined':
      // Refetched, not patched: a fetch in flight may have read the list before the searcher joined.
      void queryClient.invalidateQueries({ queryKey: missionKeys.participants(missionId) });
      return;
  }
}

/**
 * Applies one event to the cached mission data, so the screens update without a refetch. `message.received` is for
 * searchers only: Command never joins a searcher's room.
 */
export function applyEvent(queryClient: QueryClient, event: MissionEvent) {
  applyMapEvent(queryClient, event);
  applyFeedEvent(queryClient, event);
}

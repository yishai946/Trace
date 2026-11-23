import type {
  Message,
  Mission,
  MissionEvent,
  MissionPolygon,
  Participant,
  ParticipantTrack,
  Sighting,
  TimelineEvent,
} from '@trace/schemas';
import type { QueryClient } from '@tanstack/react-query';
import {
  addOnce,
  applySharedEvent,
  patchById,
  prepend,
  removeById,
  replaceById,
  updateOpened,
  upsertById,
  type ListUpdate,
  type MissionCacheShape,
} from '@trace/mission-cache';
import { OFFLINE_AFTER_MS } from '@trace/domain';
import { missionKeys } from '../mission/missionQueries';

const later = (a: string | null, b: string) => (a && Date.parse(a) > Date.parse(b) ? a : b);
const isRecent = (iso: string) => Date.now() - Date.parse(iso) <= OFFLINE_AFTER_MS;

/** Command keeps every mission in one list (`missionKeys.all`). */
const missionList: MissionCacheShape = {
  patchMission: (queryClient, missionId, change) =>
    queryClient.setQueryData<Mission[]>(missionKeys.all, patchById(missionId, change)),
  replaceMission: (queryClient, missionId, mission) =>
    queryClient.setQueryData<Mission[]>(
      missionKeys.all,
      patchById(missionId, () => mission),
    ),
};

// The sort is stable, so events of the same instant keep their arrival order, as the API orders them by recording order.
const byOccurrence = (list: TimelineEvent[], event: TimelineEvent) =>
  [...list, event].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

/** The events of the lists that open with their screen: the Timeline and the messages. */
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
  }
}

/** The events of what the map shows: the mission, its polygons, sightings and searchers. */
function applyMapEvent(queryClient: QueryClient, event: MissionEvent) {
  const { missionId } = event;
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
      // The mission's LKP is patched by applySharedEvent; whether a sighting is suggested depends on it, so refetch
      // them instead of patching by hand.
      void queryClient.invalidateQueries({ queryKey: missionKeys.lkps(missionId) });
      void queryClient.invalidateQueries({ queryKey: missionKeys.sightings(missionId) });
      return;
    case 'participant.moved':
      participants(
        // A position is an update, so a searcher shown as Offline is online again (UC-C10, decision 13).
        patchById(event.participantId, (p) => ({
          ...p,
          position: event.position,
          positionAt: event.positionAt,
          lastUpdateAt: later(p.lastUpdateAt, event.positionAt),
          // A late batch of old fixes does not bring a searcher back online.
          offline: p.offline && !isRecent(event.positionAt),
        })),
      );
      return;
    case 'participant.tracked': {
      // Only a route the commander opened is patched (an updater that returns nothing leaves the cache alone); a
      // closed one is fetched whole when opened.
      const key = missionKeys.track(missionId, event.participantId);
      queryClient.setQueryData<ParticipantTrack>(
        key,
        (track) =>
          track && {
            ...track,
            points: [
              ...track.points,
              ...event.points.filter((n) => !track.points.some((p) => p.recordedAt === n.recordedAt)),
            ],
          },
      );
      // A fetch in flight may have read the server before these points: fetch again instead of trusting it.
      // (Cancelled first: a first fetch in flight is otherwise reused by the refetch.)
      if (queryClient.isFetching({ queryKey: key })) {
        void queryClient.cancelQueries({ queryKey: key }).then(() => queryClient.invalidateQueries({ queryKey: key }));
      }
      return;
    }
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
  applySharedEvent(queryClient, missionList, event);
  applyMapEvent(queryClient, event);
  applyFeedEvent(queryClient, event);
}

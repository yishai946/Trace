import { routeLengthMeters, type LngLat } from '@trace/geo';
import type { MissionPolygon, Participant } from '@trace/schemas';
import { useMemo } from 'react';
import { useParticipantTrack } from '../../mission/missionQueries';

interface SearcherPanelInput {
  missionId: string;
  searcherId: string | null;
  participants: Participant[];
  polygons: MissionPolygon[];
  /** An ended mission keeps every searcher's route readable (UC-C20). */
  missionEnded?: boolean;
}

/**
 * The searcher panel's data (UC-C10): the searcher from the live pool, their polygon, and their route, fetched when
 * the panel opens and extended by `participant.tracked`. A searcher who ended is no longer shown, unless the mission ended too.
 */
export function useSearcherPanel({ missionId, searcherId, participants, polygons, missionEnded }: SearcherPanelInput) {
  const searcher = participants.find((p) => p.id === searcherId && (missionEnded || p.status !== 'ended')) ?? null;
  const track = useParticipantTrack(missionId, searcher?.id ?? null);
  const positions = useMemo<LngLat[]>(() => track.data?.points.map((p) => p.position) ?? [], [track.data]);
  return {
    searcher,
    polygonName: polygons.find((p) => p.id === searcher?.polygonId)?.name ?? null,
    positions,
    /** The route the map draws: the open searcher's, or none. */
    route: searcher ? { participantId: searcher.id, positions } : null,
    routeMeters: track.data ? routeLengthMeters(positions) : null,
    routeFailed: track.isError,
    retryRoute: () => void track.refetch(),
  };
}

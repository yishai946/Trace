import { isActiveInPolygon } from '@trace/domain';
import { findOutside, type LngLat, type Polygon } from '@trace/geo';
import { PolygonGeometry, SearchersOutsideDetails, type MissionPolygon, type Participant } from '@trace/schemas';
import { useMemo, useState } from 'react';
import { ApiRequestError } from '../../api';
import type { OutsideSearcher } from '../../mission/BoundaryEditBar';
import { errorMessage } from '../../mission/errorMessage';
import { usePolygonMutations } from '../../mission/missionQueries';

interface BoundaryEdit {
  polygonId: string;
  original: PolygonGeometry;
  draft: PolygonGeometry;
  /** Searchers the server reported outside, when its data was newer than the map's. */
  serverOutside: OutsideSearcher[] | null;
}

interface PolygonEditInput {
  missionId: string;
  polygons: MissionPolygon[];
  participants: Participant[];
}

/** The polygon the commander selected on the map, and drawing, renaming, deleting and moving its boundary. */
export function usePolygonEdit({ missionId, polygons, participants }: PolygonEditInput) {
  const mutations = usePolygonMutations(missionId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<BoundaryEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = polygons.find((p) => p.id === selectedId) ?? null;
  const fail = (e: Error) => setError(errorMessage(e));

  // The client warns as the boundary moves; the server checks again when saving.
  const outside = useMemo<OutsideSearcher[]>(() => {
    if (!edit) return [];
    if (edit.serverOutside) return edit.serverOutside;
    const located = participants.filter((p) => isActiveInPolygon(p, edit.polygonId) && p.position);
    return findOutside(
      located.map((p) => ({ id: p.id, position: p.position as LngLat })),
      edit.draft,
    ).flatMap(({ id, meters }) => {
      const p = located.find((l) => l.id === id);
      return p ? [{ callsign: p.callsign, name: p.name, meters }] : [];
    });
  }, [edit, participants]);

  const select = (polygonId: string | null) => {
    setSelectedId(polygonId);
    setError(null);
  };

  const saveBoundary = () => {
    if (!edit) return;
    mutations.update.mutate(
      { polygonId: edit.polygonId, geometry: edit.draft, confirmSearchersOutside: outside.length > 0 },
      {
        onSuccess: () => {
          setEdit(null);
          setError(null);
        },
        onError: (e) => {
          // The server knows of searchers outside that the map did not show yet: ask the commander to confirm them.
          const details =
            e instanceof ApiRequestError && e.code === 'SEARCHERS_OUTSIDE_POLYGON'
              ? SearchersOutsideDetails.safeParse(e.details)
              : null;
          if (details?.success) setEdit({ ...edit, serverOutside: details.data.searchers });
          else fail(e);
        },
      },
    );
  };

  return {
    selected,
    selectedId,
    edit,
    /** What the map needs to edit the boundary: the polygon and the geometry the edit started from. */
    editing: edit ? { polygonId: edit.polygonId, geometry: edit.original } : null,
    error,
    outside,
    busy: mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending,
    select,
    create: (drawn: Polygon) => {
      const geometry = PolygonGeometry.safeParse(drawn);
      if (!geometry.success) {
        setError('הפוליגון שצויר אינו תקין. ציירו אותו שוב.');
        return;
      }
      setError(null);
      mutations.create.mutate(
        { geometry: geometry.data },
        { onSuccess: (created) => setSelectedId(created.id), onError: fail },
      );
    },
    rename: (name: string) => {
      if (!selected) return;
      mutations.update.mutate({ polygonId: selected.id, name }, { onSuccess: () => setError(null), onError: fail });
    },
    remove: () => {
      if (!selected) return;
      mutations.remove.mutate(selected.id, { onSuccess: () => select(null), onError: fail });
    },
    startBoundaryEdit: () => {
      if (!selected) return;
      setError(null);
      setEdit({ polygonId: selected.id, original: selected.geometry, draft: selected.geometry, serverOutside: null });
    },
    changeBoundary: (changed: Polygon) => {
      const draft = PolygonGeometry.safeParse(changed);
      if (draft.success) setEdit((e) => (e ? { ...e, draft: draft.data, serverOutside: null } : e));
    },
    cancelBoundaryEdit: () => {
      setEdit(null);
      setError(null);
    },
    saveBoundary,
  };
}

import type { LngLat } from '@trace/geo';
import type { CreateSightingBody, LkpDecision } from '@trace/schemas';
import { useEffect, useState } from 'react';
import { sightingErrorMessage } from '../../mission/errorMessage';
import { useSightingMutations } from '../../mission/missionQueries';

/** The LKP and sightings panel (UC-C04): open or not, the sighting chosen in it, and adding a sighting from the map. */
export function useSightingPanel(missionId: string) {
  const mutations = useSightingMutations(missionId);
  const [open, setOpen] = useState(false);
  /** The add-sighting form is open; its position comes from a click on the map. */
  const [adding, setAdding] = useState<{ position: LngLat | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: Error) => setError(sightingErrorMessage(e));

  // Escape leaves add-sighting mode, unless a field or the map already used it.
  useEffect(() => {
    if (!adding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setAdding(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adding]);

  const show = (sightingId: string | null) => {
    setError(null);
    setOpen(true);
    setSelectedId(sightingId);
  };

  return {
    open,
    adding,
    /** The spot chosen for the new sighting, once the commander clicked the map. */
    draftPosition: adding?.position ?? null,
    selectedId,
    error,
    busy: mutations.isPending,
    /** Opens the panel on a sighting, or on the list with `null`. */
    show,
    /** Something else takes the panel's place: it hides and adding ends, but the chosen sighting is kept. */
    hide: () => {
      setOpen(false);
      setAdding(null);
    },
    close: () => {
      setOpen(false);
      setAdding(null);
      setSelectedId(null);
    },
    startAdd: () => {
      show(null);
      setAdding({ position: null });
    },
    cancelAdd: () => setAdding(null),
    place: (position: LngLat) => setAdding({ position }),
    clearError: () => setError(null),
    submit: (body: CreateSightingBody) =>
      mutations.create(body, {
        onSuccess: (created) => {
          setAdding(null);
          setSelectedId(created.id);
          setError(null);
        },
        onError: fail,
      }),
    decide: (sightingId: string, decision: LkpDecision) =>
      mutations.decide({ sightingId, decision }, { onSuccess: () => setError(null), onError: fail }),
  };
}

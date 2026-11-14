import type { LngLat } from '@trace/geo';
import { emptyMissionMapData } from '@trace/map';
import type { Mission } from '@trace/schemas';
import { useMemo, useState, type FormEvent } from 'react';
import { ApiRequestError } from '../../api';
import type { MapFocus } from '../../map/MissionMap';
import { useCreateMission } from '../../mission/missionQueries';
import { emptyForm, toCreateBody, validate, type FormErrors, type NewMissionForm } from './newMissionForm';
import type { PlaceMode } from './PointPicker';

/** Where the map opens for a new mission: Jerusalem, until the commander places a point. */

export type PointKind = 'lkp' | 'rally';

/** Only one point follows map clicks, so choosing "map" for one sends the other to "search". */
function withMode(modes: Record<PointKind, PlaceMode>, kind: PointKind, mode: PlaceMode): Record<PointKind, PlaceMode> {
  const next: Record<PointKind, PlaceMode> = { ...modes };
  const other: PointKind = kind === 'lkp' ? 'rally' : 'lkp';
  next[kind] = mode;
  if (mode === 'map' && next[other] === 'map') next[other] = 'search';
  return next;
}

interface Input {
  /** Without a connection, a mission cannot be created (UC-C01). */
  online: boolean;
  onCreated: (mission: Mission, photoFailed: boolean) => void;
}

/** The new-mission form (UC-C02): what was typed, where its two points are, and creating the mission. */
export function useNewMissionForm({ online, onCreated }: Input) {
  const [form, setForm] = useState<NewMissionForm>(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [modes, setModes] = useState<Record<PointKind, PlaceMode>>({ lkp: 'map', rally: 'search' });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const create = useCreateMission();

  // Only one point follows map clicks: the one whose "map" tab is open.
  const placing: PointKind | null = modes.lkp === 'map' ? 'lkp' : modes.rally === 'map' ? 'rally' : null;

  const update = (changes: Partial<NewMissionForm>) => {
    const next = { ...form, ...changes };
    setForm(next);
    // Once the commander has tried to create, the marks follow what they fix.
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const setMode = (kind: PointKind, mode: PlaceMode) => {
    setModes((current) => withMode(current, kind, mode));
  };

  const setPoint = (kind: PointKind, point: LngLat) => update(kind === 'lkp' ? { lkp: point } : { rally: point });

  const mapData = useMemo(
    () => ({
      ...emptyMissionMapData,
      lkp: form.lkp ? { id: 'lkp', position: form.lkp, time: form.lkpObservedAt.slice(11, 16) } : null,
      rally: form.rally,
    }),
    [form.lkp, form.lkpObservedAt, form.rally],
  );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !online) return;
    create.mutate(
      { body: toCreateBody(form), photo },
      { onSuccess: ({ mission, photoFailed }) => onCreated(mission, photoFailed) },
    );
  };

  const failure =
    create.error instanceof ApiRequestError && create.error.code === 'NETWORK_ERROR'
      ? 'אין חיבור לשרת. המסע לא נוצר.'
      : create.error
        ? 'המסע לא נוצר. בדקו את הפרטים ונסו שוב.'
        : null;

  return {
    form,
    photo,
    setPhoto,
    errors,
    modes,
    focus,
    setFocus,
    placing,
    mapData,
    failure,
    creating: create.isPending,
    update,
    setMode,
    setPoint,
    submit,
  };
}

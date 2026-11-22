import { isInsidePolygon, formatLatLng, type LngLat } from '@trace/geo';
import type { MissionPolygon, SightingSource } from '@trace/schemas';
import { useState } from 'react';
import { ltr } from '../../i18n/rtl';
import { useCurrentFix } from '../../location/useCurrentFix';
import { uuidv7 } from '../../outbox/uuidv7';
import { clockOf, toSighting, type DraftErrors, type LocationMode } from '../../sightings/draft';
import { submitSighting } from '../../sightings/submit';

export type SightingStatus = 'idle' | 'sending' | 'pending' | 'retrying' | 'rejected' | 'invalid' | 'save-failed';

interface Input {
  missionId: string;
  polygons: MissionPolygon[];
  /** The sighting is sent or kept on the phone: back to the map. */
  onDone: () => void;
}

/** The sighting form (UC-F10): what was entered, where it was seen, and sending it or keeping it on the phone. */
export function useSightingDraft({ missionId, polygons, onDone }: Input) {
  const [source, setSource] = useState<SightingSource>('self');
  const [mode, setMode] = useState<LocationMode>('mine');
  const [picked, setPicked] = useState<LngLat | null>(null);
  const [clock, setClock] = useState(() => clockOf(new Date()));
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [status, setStatus] = useState<SightingStatus>('idle');

  const fix = useCurrentFix();
  const position = mode === 'mine' ? (fix.fix?.position ?? null) : picked;
  const polygon = position ? polygons.find((p) => isInsidePolygon(position, p.geometry)) : undefined;

  const meta = position
    ? `${ltr(formatLatLng(position))}${polygon ? `, פוליגון ${polygon.name}` : ''}`
    : mode === 'map'
      ? 'הקש על המפה במקום שבו נראה הנעדר.'
      : fix.state === 'locating'
        ? 'מאתר את המיקום שלך…'
        : 'המיקום שלך לא זמין. בחר את המקום במפה.';

  const pick = (point: LngLat) => {
    setPicked(point);
    setMode('map');
    setErrors((e) => ({ ...e, position: undefined }));
  };

  const submit = async () => {
    const result = toSighting({ source, position, clock, description }, { now: new Date(), id: uuidv7() });
    if ('errors' in result) return setErrors(result.errors);
    setErrors({});
    setStatus('sending');
    try {
      const delivery = await submitSighting({ missionId, sighting: result.sighting });
      if (delivery === 'sent') onDone();
      else setStatus(delivery);
    } catch {
      setStatus('save-failed');
    }
  };

  return {
    source,
    setSource,
    mode,
    setMode,
    picked,
    clock,
    setClock,
    description,
    setDescription,
    errors,
    setErrors,
    status,
    position,
    meta,
    pick,
    submit,
  };
}

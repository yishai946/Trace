import type { Bounds, LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import { z } from 'zod';

export interface Place {
  id: string;
  name: string;
  /** Full description, e.g. `נחל עמוד, ישראל`. */
  description: string;
  center: LngLat;
  bounds?: Bounds;
}

const GeocodingResponse = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      place_name: z.string(),
      center: z.tuple([z.number(), z.number()]),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    }),
  ),
});

/** Place and address search in Israel, in Hebrew (rally point, UC-C05; jumping the map to a place). */
export async function searchPlaces(provider: MapProvider, query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (!provider.geocodingUrl || trimmed.length < 2) return [];
  const res = await fetch(provider.geocodingUrl(trimmed), { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const { features } = GeocodingResponse.parse(await res.json());
  return features.map((f) => ({
    id: f.id,
    name: f.text,
    description: f.place_name,
    center: f.center,
    bounds: f.bbox,
  }));
}

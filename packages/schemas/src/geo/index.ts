import { z } from 'zod';

/** GeoJSON position: [longitude, latitude] in WGS84. */
export const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).meta({ id: 'LngLat' });

export const PointGeometry = z.object({ type: z.literal('Point'), coordinates: LngLat }).meta({ id: 'PointGeometry' });

const LinearRing = z
  .array(LngLat)
  .min(4, 'A polygon ring needs at least 4 positions')
  .refine(
    (ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      return !!first && !!last && first[0] === last[0] && first[1] === last[1];
    },
    { message: 'A polygon ring must be closed (first position equals last)' },
  );

export const PolygonGeometry = z
  .object({ type: z.literal('Polygon'), coordinates: z.array(LinearRing).min(1) })
  .meta({ id: 'PolygonGeometry' });

export type LngLat = z.infer<typeof LngLat>;
export type PointGeometry = z.infer<typeof PointGeometry>;
export type PolygonGeometry = z.infer<typeof PolygonGeometry>;

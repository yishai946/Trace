import proj4 from 'proj4';
import type { LngLat } from './types';

/** Israeli Transverse Mercator (Israel 1993 / Israeli TM Grid, EPSG:2039), as published by the EPSG registry. */
const ITM =
  '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 ' +
  '+ellps=GRS80 +towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4248 +units=m +no_defs';

const converter = proj4('WGS84', ITM);

/** A point on the Israeli grid, in meters. */
export interface ItmPoint {
  easting: number;
  northing: number;
}

export function toItm([lng, lat]: LngLat): ItmPoint {
  const [easting, northing] = converter.forward([lng, lat]) as [number, number];
  return { easting, northing };
}

export function fromItm({ easting, northing }: ItmPoint): LngLat {
  const [lng, lat] = converter.inverse([easting, northing]) as [number, number];
  return [lng, lat];
}

/** `219529 / 626907`: easting then northing, whole meters. Written LTR inside Hebrew text. */
export function formatItm(point: ItmPoint): string {
  return `${Math.round(point.easting)} / ${Math.round(point.northing)}`;
}

/** `31.7431, 35.0127`: latitude then longitude, as the Trace Console design system shows coordinates. */
export function formatLatLng([lng, lat]: LngLat, digits = 4): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

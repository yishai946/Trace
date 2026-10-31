import type { Polygon } from 'geojson';

/** GeoJSON position order: longitude first. */
export type LngLat = [lng: number, lat: number];

/** [west, south, east, north] */
export type Bounds = [west: number, south: number, east: number, north: number];

export type { Polygon };

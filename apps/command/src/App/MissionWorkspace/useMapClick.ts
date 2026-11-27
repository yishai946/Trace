import type { LngLat } from '@trace/geo';

interface Handlers {
  rally: { placesOnMap: boolean; change: (point: LngLat) => void };
  control: { placesOnMap: boolean; setPoint: (point: LngLat) => void };
  sighting: { adding: unknown; place: (point: LngLat) => void };
  rallyOpen: boolean;
  controlOpen: boolean;
}

/**
 * What a click on the map does: it moves the rally point or sets where the missing person was found while that panel
 * asks for one, else it places the new sighting. Undefined when nothing takes a click.
 */
export function useMapClick({ rally, control, sighting, rallyOpen, controlOpen }: Handlers) {
  if (rallyOpen && rally.placesOnMap) return rally.change;
  if (controlOpen && control.placesOnMap) return control.setPoint;
  return sighting.adding ? sighting.place : undefined;
}

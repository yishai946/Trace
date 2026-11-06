import { themeIds } from '@trace/design';
import { ICON_PIXEL_RATIO, mapIcons } from '@trace/map';
import type { Map as MapLibreMap } from 'maplibre-gl';

const loaded = new Map<string, HTMLImageElement>();

/** Decodes every map symbol for both themes once, so they can be added synchronously when a style asks for them. */
export async function preloadMapIcons(): Promise<void> {
  const all = themeIds.flatMap((themeId) => Object.entries(mapIcons(themeId)));
  await Promise.all(
    all.map(async ([id, icon]) => {
      if (loaded.has(id)) return;
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}`;
      await image.decode();
      loaded.set(id, image);
    }),
  );
}

/**
 * Adds every Trace symbol as soon as a style loads (a theme switch loads a new one). Adding them only on
 * `styleimagemissing` left the first point placed on an empty layer invisible until the map's next update.
 */
export function registerMapIcons(map: MapLibreMap): void {
  const add = (id: string) => {
    const image = loaded.get(id);
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: ICON_PIXEL_RATIO });
  };
  map.on('style.load', () => loaded.forEach((_image, id) => add(id)));
  map.on('styleimagemissing', ({ id }) => add(id));
}

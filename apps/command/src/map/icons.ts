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

/** Adds Trace symbols on demand; MapLibre fires `styleimagemissing` for each icon a new style references. */
export function registerMapIcons(map: MapLibreMap): void {
  map.on('styleimagemissing', ({ id }) => {
    const image = loaded.get(id);
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: ICON_PIXEL_RATIO });
  });
}

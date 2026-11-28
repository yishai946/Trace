import { themes, type ThemeId } from '@trace/design';

/**
 * The colored map's own palette (Trace Console `basemap-*` tokens), modeled on Google Maps so searchers and commanders
 * read it at a glance. Only the base map uses it; the mission overlays above keep the interface tokens.
 */
export interface ColorfulPalette {
  land: string;
  settlement: string;
  wood: string;
  grass: string;
  park: string;
  water: string;
  building: string;
  roadMinor: string;
  roadMajor: string;
  roadCasing: string;
  roadMajorCasing: string;
}

const paletteOf = (themeId: ThemeId): ColorfulPalette => {
  const c = themes[themeId].color;
  return {
    land: c.basemapLand,
    settlement: c.basemapSettlement,
    wood: c.basemapWood,
    grass: c.basemapGrass,
    park: c.basemapPark,
    water: c.basemapWater,
    building: c.basemapBuilding,
    roadMinor: c.basemapRoadMinor,
    roadMajor: c.basemapRoadMajor,
    roadCasing: c.basemapRoadCasing,
    roadMajorCasing: c.basemapRoadMajorCasing,
  };
};

export const colorfulPalette: Record<ThemeId, ColorfulPalette> = { day: paletteOf('day'), night: paletteOf('night') };

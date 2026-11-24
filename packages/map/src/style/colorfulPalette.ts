import type { ThemeId } from '@trace/design';

/**
 * The colored map's own palette, modeled on Google Maps so searchers and commanders read it at a glance. The design
 * system defines no base-map palette, so these values are a design deviation (reported in the Pull Request); the
 * mission overlays above keep the theme's tokens.
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

export const colorfulPalette: Record<ThemeId, ColorfulPalette> = {
  day: {
    land: '#f2efe9',
    settlement: '#e6e0d4',
    wood: '#b9dba4',
    grass: '#dcecc9',
    park: '#cdebc4',
    water: '#a6d4e8',
    building: '#d9d0c0',
    roadMinor: '#ffffff',
    roadMajor: '#f9d27a',
    roadCasing: '#d3cfc4',
    roadMajorCasing: '#e3a73a',
  },
  night: {
    land: '#242a30',
    settlement: '#2c333a',
    wood: '#2a4a36',
    grass: '#283a2c',
    park: '#2d4a37',
    water: '#1d4b6b',
    building: '#39424b',
    roadMinor: '#4a5560',
    roadMajor: '#9a7a3a',
    roadCasing: '#1c2126',
    roadMajorCasing: '#6d5521',
  },
};

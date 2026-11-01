import { themes, type ThemeId } from '@trace/design';

/** Map symbols drawn as SVG from the theme's tokens (Trace Console MapSymbols). Rendered at 2x for sharp edges. */
export type MapIconName = 'lkp' | 'sighting' | 'rally' | 'report' | 'hazard';

export const ICON_PIXEL_RATIO = 2;

export interface MapIcon {
  svg: string;
  /** CSS pixels; the image is rendered at `ICON_PIXEL_RATIO` times this size. */
  size: number;
}

export const iconId = (themeId: ThemeId, name: MapIconName) => `trace-${name}-${themeId}`;

const svg = (size: number, body: string) => {
  const px = size * ICON_PIXEL_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
};

export function mapIcons(themeId: ThemeId): Record<string, MapIcon> {
  const c = themes[themeId].color;
  const icons: Record<MapIconName, MapIcon> = {
    lkp: {
      size: 30,
      svg: svg(
        30,
        `<g fill="none" stroke="${c.mapHalo}" stroke-width="4" stroke-linecap="round"><circle cx="15" cy="15" r="8"/>` +
          `<path d="M15 2v8M15 20v8M2 15h8M20 15h8"/></g>` +
          `<g fill="none" stroke="${c.ink}" stroke-width="1.5" stroke-linecap="round"><circle cx="15" cy="15" r="8"/>` +
          `<path d="M15 2v8M15 20v8M2 15h8M20 15h8"/></g>`,
      ),
    },
    sighting: {
      size: 18,
      svg: svg(
        18,
        `<path d="M9 2l7 7-7 7-7-7z" fill="${c.surface}" stroke="${c.mapHalo}" stroke-width="3.3"/>` +
          `<path d="M9 2l7 7-7 7-7-7z" fill="${c.surface}" stroke="${c.ink}" stroke-width="1.3"/>`,
      ),
    },
    rally: {
      size: 24,
      svg: svg(
        24,
        `<circle cx="12" cy="12" r="9" fill="${c.surface}" stroke="${c.mapHalo}" stroke-width="3.5"/>` +
          `<circle cx="12" cy="12" r="9" fill="${c.surface}" stroke="${c.success}" stroke-width="1.5"/>` +
          `<path d="M10 16V7h6l-1.5 2.5L16 12h-6" fill="${c.success}" stroke="${c.success}" stroke-linejoin="round"/>`,
      ),
    },
    report: {
      size: 16,
      svg: svg(
        16,
        `<rect x="3" y="3" width="10" height="10" rx="1.5" fill="${c.surface}" stroke="${c.mapHalo}" stroke-width="3.3"/>` +
          `<rect x="3" y="3" width="10" height="10" rx="1.5" fill="${c.surface}" stroke="${c.ink}" stroke-width="1.3"/>`,
      ),
    },
    hazard: {
      size: 18,
      svg: svg(
        18,
        `<path d="M9 2.5l7 12H2z" fill="${c.surface}" stroke="${c.mapHalo}" stroke-width="3.4" stroke-linejoin="round"/>` +
          `<path d="M9 2.5l7 12H2z" fill="${c.surface}" stroke="${c.warning}" stroke-width="1.4" stroke-linejoin="round"/>`,
      ),
    },
  };
  return Object.fromEntries(Object.entries(icons).map(([name, icon]) => [iconId(themeId, name as MapIconName), icon]));
}

import type { ThemeId } from '@trace/design';
import { themes } from '@trace/design';
import type { HexColor } from 'terra-draw';

/** Terra Draw types its colours as `#rrggbb` text; the design tokens are already hex. */
const hex = (color: string): HexColor => color as HexColor;

/** How a polygon looks while it is drawn. */
export function drawStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    fillColor: hex(c.accent),
    fillOpacity: 0.12,
    outlineColor: hex(c.accent),
    outlineWidth: 2,
    closingPointColor: hex(c.accent),
    closingPointOutlineColor: hex(c.mapHalo),
    closingPointWidth: 5,
    closingPointOutlineWidth: 2,
  };
}

/** How a polygon looks while its boundary is edited. */
export function selectStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    selectedPolygonColor: hex(c.accent),
    selectedPolygonFillOpacity: 0.16,
    selectedPolygonOutlineColor: hex(c.accent),
    selectedPolygonOutlineWidth: 2.4,
    selectionPointColor: hex(c.accent),
    selectionPointOutlineColor: hex(c.mapHalo),
    selectionPointWidth: 5,
    selectionPointOutlineWidth: 2,
    midPointColor: hex(c.mapHalo),
    midPointOutlineColor: hex(c.accent),
    midPointWidth: 3.5,
    midPointOutlineWidth: 1.5,
  };
}

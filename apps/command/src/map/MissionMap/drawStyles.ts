import type { ThemeId } from '@trace/design';
import { themes } from '@trace/design';

// Terra Draw types colours as `#rrggbb` text; the design tokens are hex literals, so a non-hex token fails to compile.

/** How a polygon looks while it is drawn. */
export function drawStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    fillColor: c.accent,
    fillOpacity: 0.12,
    outlineColor: c.accent,
    outlineWidth: 2,
    closingPointColor: c.accent,
    closingPointOutlineColor: c.mapHalo,
    closingPointWidth: 5,
    closingPointOutlineWidth: 2,
  };
}

/** How a polygon looks while its boundary is edited. */
export function selectStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    selectedPolygonColor: c.accent,
    selectedPolygonFillOpacity: 0.16,
    selectedPolygonOutlineColor: c.accent,
    selectedPolygonOutlineWidth: 2.4,
    selectionPointColor: c.accent,
    selectionPointOutlineColor: c.mapHalo,
    selectionPointWidth: 5,
    selectionPointOutlineWidth: 2,
    midPointColor: c.mapHalo,
    midPointOutlineColor: c.accent,
    midPointWidth: 3.5,
    midPointOutlineWidth: 1.5,
  };
}

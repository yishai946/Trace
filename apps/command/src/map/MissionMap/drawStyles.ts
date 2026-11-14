import type { ThemeId } from '@trace/design';
import { themes } from '@trace/design';
import type { HexColor } from 'terra-draw';

/** How a polygon looks while it is drawn. */
export function drawStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    fillColor: c.accent as HexColor,
    fillOpacity: 0.12,
    outlineColor: c.accent as HexColor,
    outlineWidth: 2,
    closingPointColor: c.accent as HexColor,
    closingPointOutlineColor: c.mapHalo as HexColor,
    closingPointWidth: 5,
    closingPointOutlineWidth: 2,
  };
}

/** How a polygon looks while its boundary is edited. */
export function selectStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    selectedPolygonColor: c.accent as HexColor,
    selectedPolygonFillOpacity: 0.16,
    selectedPolygonOutlineColor: c.accent as HexColor,
    selectedPolygonOutlineWidth: 2.4,
    selectionPointColor: c.accent as HexColor,
    selectionPointOutlineColor: c.mapHalo as HexColor,
    selectionPointWidth: 5,
    selectionPointOutlineWidth: 2,
    midPointColor: c.mapHalo as HexColor,
    midPointOutlineColor: c.accent as HexColor,
    midPointWidth: 3.5,
    midPointOutlineWidth: 1.5,
  };
}

import { themeIds, themes } from '@trace/design';
import { describe, expect, it } from 'vitest';
import { ICON_PIXEL_RATIO, iconId, mapIcons } from '.';

describe('map icons', () => {
  it('renders icons at 2x', () => {
    const icon = mapIcons('night')[iconId('night', 'lkp')];
    expect(icon?.svg).toContain(`width="${30 * ICON_PIXEL_RATIO}"`);
  });

  it.each(themeIds)('draws the LKP suggestion ring in the %s accent', (themeId) => {
    const icon = mapIcons(themeId)[iconId(themeId, 'suggest')];
    expect(icon?.svg).toContain(`stroke="${themes[themeId].color.accent}"`);
    expect(icon?.svg).toContain('stroke-dasharray');
  });

  it.each(themeIds)('draws the located report as an accent ring around a filled dot in %s', (themeId) => {
    const c = themes[themeId].color;
    const icon = mapIcons(themeId)[iconId(themeId, 'located')];
    expect(icon?.svg).toContain(`stroke="${c.accent}"`);
    expect(icon?.svg).toContain(`fill="${c.ink}"`);
    expect(icon?.svg).toContain(`stroke="${c.mapHalo}"`);
    const colors = icon?.svg.match(/(?:fill|stroke)="(#[0-9a-fA-F]+|rgba?\([^)]*\))"/g) ?? [];
    const tokens = new Set(Object.values(c));
    for (const attr of colors) expect(tokens).toContain(attr.replace(/^(fill|stroke)="|"$/g, ''));
  });
});

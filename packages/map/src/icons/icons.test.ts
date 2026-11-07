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
});

import { describe, expect, it } from 'vitest';
import { ICON_PIXEL_RATIO, iconId, mapIcons } from '.';

describe('map icons', () => {
  it('renders icons at 2x', () => {
    const icon = mapIcons('night')[iconId('night', 'lkp')];
    expect(icon?.svg).toContain(`width="${30 * ICON_PIXEL_RATIO}"`);
  });
});

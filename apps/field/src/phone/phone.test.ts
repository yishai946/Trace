import { Linking } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dial, EMERGENCY_NUMBER } from '.';

afterEach(() => vi.restoreAllMocks());

describe('dial', () => {
  it('opens the regular dialer with the number', async () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await dial(EMERGENCY_NUMBER);
    expect(open).toHaveBeenCalledWith('tel:112');
  });

  it('reports false when the phone cannot open the dialer', async () => {
    vi.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialer'));
    await expect(dial('112')).resolves.toBe(false);
  });
});

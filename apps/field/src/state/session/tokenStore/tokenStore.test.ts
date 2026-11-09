import { describe, expect, it } from 'vitest';
import { deleteToken, loadToken, saveToken } from '.';
import {
  AFTER_FIRST_UNLOCK,
  deleteItemAsync,
  getItemAsync,
  secureStoreItems,
  setItemAsync,
} from '../../../test/secureStore';

describe('tokenStore', () => {
  it('saves, loads and deletes the token on the device, readable after first unlock', async () => {
    await expect(saveToken('t1')).resolves.toBe(true);
    expect(setItemAsync).toHaveBeenCalledWith('trace.session-token', 't1', { keychainAccessible: AFTER_FIRST_UNLOCK });
    expect(secureStoreItems.get('trace.session-token')).toBe('t1');

    await expect(loadToken()).resolves.toBe('t1');
    expect(getItemAsync).toHaveBeenCalledWith('trace.session-token', { keychainAccessible: AFTER_FIRST_UNLOCK });

    await deleteToken();
    expect(deleteItemAsync).toHaveBeenCalledWith('trace.session-token', { keychainAccessible: AFTER_FIRST_UNLOCK });
    await expect(loadToken()).resolves.toBeNull();
  });

  it('loads nothing when no token is stored', async () => {
    await expect(loadToken()).resolves.toBeNull();
  });

  it('treats an empty stored value as no token', async () => {
    secureStoreItems.set('trace.session-token', '');
    await expect(loadToken()).resolves.toBeNull();
  });

  it('swallows a storage error', async () => {
    getItemAsync.mockRejectedValueOnce(new Error('unavailable'));
    await expect(loadToken()).resolves.toBeNull();

    setItemAsync.mockRejectedValueOnce(new Error('too large'));
    await expect(saveToken('t1')).resolves.toBe(false);

    deleteItemAsync.mockRejectedValueOnce(new Error('unavailable'));
    await expect(deleteToken()).resolves.toBeUndefined();
  });
});

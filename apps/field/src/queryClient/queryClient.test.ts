import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './index';

vi.mock('../monitoring', () => ({ reportQueryError: vi.fn() }));

describe('createQueryClient', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('fails a mutation at once when offline instead of pausing it', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient();
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new Error('Network request failed')),
    });
    await expect(mutation.execute(undefined)).rejects.toThrow('Network request failed');
    expect(mutation.state.status).toBe('error');
    expect(mutation.state.isPaused).toBe(false);
  });
});

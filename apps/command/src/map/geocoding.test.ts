import { maptilerProvider } from '@trace/map';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './geocoding';

const provider = maptilerProvider('test');

afterEach(() => vi.unstubAllGlobals());

describe('searchPlaces', () => {
  it('maps geocoding results to places', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              id: 'f1',
              text: 'נחל עמוד',
              place_name: 'נחל עמוד, ישראל',
              center: [35.5, 32.9],
              bbox: [35.4, 32.8, 35.6, 33],
              extra: 'ignored',
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const places = await searchPlaces(provider, 'נחל עמוד');
    expect(places).toEqual([
      {
        id: 'f1',
        name: 'נחל עמוד',
        description: 'נחל עמוד, ישראל',
        center: [35.5, 32.9],
        bounds: [35.4, 32.8, 35.6, 33],
      },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('language=he');
  });

  it('does not search for very short queries', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchPlaces(provider, ' א ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 403 })));
    await expect(searchPlaces(provider, 'ירושלים')).rejects.toThrow('403');
  });
});

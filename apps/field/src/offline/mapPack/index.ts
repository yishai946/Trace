import type { Bounds } from '@trace/geo';
import { buildMapStyle, emptyMissionMapData, type MapProvider } from '@trace/map';
import { File, Paths } from 'expo-file-system';
import { loadMapLibre, mapProvider, mapTerrain } from '../../map/provider';

/** Zoom levels saved for the mission area: from the whole area down to single paths (decision: tile count stays small). */
export const MAP_PACK_MIN_ZOOM = 10;
export const MAP_PACK_MAX_ZOOM = 16;

/** Degrees kept around the mission area (about 1 km), so panning a little past its edge still shows a map. */
const MARGIN = 0.01;

export interface MapPackOptions {
  missionId: string;
  /** The mission area to keep on the phone. */
  bounds: Bounds;
  signal?: AbortSignal;
}

/**
 * The offline pack takes the address of a style, not the style itself, and ours is built in code. It is written to a
 * file the pack reads (also when it resumes after a restart). The pack is the same whichever theme the style was built
 * for: day and night use the same tiles, glyphs and sprites.
 */
function writeStyleFile(provider: MapProvider): string {
  const style = buildMapStyle({ themeId: 'night', provider, terrain: mapTerrain, data: emptyMissionMapData });
  const file = new File(Paths.document, 'trace-offline-map-style.json');
  file.create({ overwrite: true });
  file.write(JSON.stringify(style));
  return file.uri;
}

/**
 * Saves the base map of the mission area on the phone with MapLibre's offline pack (UC-F03). Resolves once the pack is
 * complete, and at once when it already is; a cut-off pack resumes where it stopped. Without the native module or the
 * tile key (Expo Go, web) there is no map to keep, so it resolves without doing anything. Rejects when the download
 * fails or is aborted, for the caller to retry.
 */
export async function downloadMapPack({ missionId, bounds, signal }: MapPackOptions): Promise<void> {
  const mapLibre = loadMapLibre();
  if (!mapLibre || !mapProvider) return;
  const { OfflineManager } = mapLibre;
  signal?.throwIfAborted();

  const existing = (await OfflineManager.getPacks()).find((pack) => pack.metadata.missionId === missionId);
  // Stopped while the packs were listed: nothing may be created or resumed after the caller cleaned up.
  signal?.throwIfAborted();
  const mapStyle = writeStyleFile(mapProvider);
  const [west, south, east, north] = bounds;

  await new Promise<void>((resolve, reject) => {
    let packId: string | null = null;
    const finish = (outcome: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      if (packId) OfflineManager.removeListener(packId);
      outcome();
    };
    const onAbort = () => {
      if (packId)
        void OfflineManager.getPack(packId)
          .then((pack) => pack.pause())
          .catch(() => undefined);
      finish(() => reject(signal?.reason));
    };
    signal?.addEventListener('abort', onAbort);
    const onProgress = (_pack: unknown, status: { state: string }) => {
      if (status.state === 'complete') finish(resolve);
    };
    const onError = (_pack: unknown, error: { message: string }) => finish(() => reject(new Error(error.message)));

    const start = existing
      ? OfflineManager.addListener(existing.id, onProgress, onError).then(async () => {
          packId = existing.id;
          const status = await existing.status();
          if (status.state === 'complete') return finish(resolve);
          await existing.resume();
        })
      : OfflineManager.createPack(
          {
            mapStyle,
            bounds: [west - MARGIN, south - MARGIN, east + MARGIN, north + MARGIN],
            minZoom: MAP_PACK_MIN_ZOOM,
            maxZoom: MAP_PACK_MAX_ZOOM,
            metadata: { missionId },
          },
          onProgress,
          onError,
        ).then((pack) => {
          packId = pack.id;
        });
    start.catch((error: unknown) => finish(() => reject(error)));
  });
}

/** Drops the saved map of every mission but `keepMissionId` (all of them when it is null). */
export async function removeMapPacks(keepMissionId: string | null = null): Promise<void> {
  const mapLibre = loadMapLibre();
  if (!mapLibre) return;
  const { OfflineManager } = mapLibre;
  const packs = await OfflineManager.getPacks();
  await Promise.all(
    packs.filter((pack) => pack.metadata.missionId !== keepMissionId).map((pack) => OfflineManager.deletePack(pack.id)),
  );
}

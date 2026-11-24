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

type OfflineManagerApi = NonNullable<ReturnType<typeof loadMapLibre>>['OfflineManager'];
type OfflinePack = Awaited<ReturnType<OfflineManagerApi['getPacks']>>[number];

const isBounds = (value: unknown): value is Bounds =>
  Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === 'number' && Number.isFinite(n));

/** The area a pack keeps: written in its metadata since #279, else the bounds the native pack reports. */
function savedArea(pack: OfflinePack): Bounds | null {
  const area = pack.metadata.area ?? pack.bounds;
  return isBounds(area) ? area : null;
}

/** Whether the pack holds the whole area. A pack whose area cannot be read is kept rather than downloaded again. */
function covers(pack: OfflinePack, [west, south, east, north]: Bounds): boolean {
  const area = savedArea(pack);
  if (!area) return true;
  return area[0] <= west && area[1] <= south && area[2] >= east && area[3] >= north;
}

interface Follow {
  manager: OfflineManagerApi;
  /** A pack to resume, or the options of a new pack to create. */
  pack: OfflinePack | Parameters<OfflineManagerApi['createPack']>[0];
  signal?: AbortSignal;
}

/** Resumes or creates the pack and resolves once it is complete; rejects on failure or abort. */
function followPack({ manager, pack, signal }: Follow): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let packId: string | null = null;
    const finish = (outcome: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      if (packId) manager.removeListener(packId);
      outcome();
    };
    const done = () => finish(resolve);
    const onAbort = () => {
      if (packId)
        void manager
          .getPack(packId)
          .then((found) => found?.pause())
          .catch(() => undefined);
      finish(() => reject(signal?.reason));
    };
    signal?.addEventListener('abort', onAbort);
    const onProgress = (_pack: unknown, status: { state: string }) => {
      if (status.state === 'complete') done();
    };
    const onError = (_pack: unknown, error: { message: string }) => finish(() => reject(new Error(error.message)));

    const start =
      'id' in pack
        ? manager.addListener(pack.id, onProgress, onError).then(async () => {
            packId = pack.id;
            const status = await pack.status();
            if (status.state === 'complete') return done();
            await pack.resume();
          })
        : manager.createPack(pack, onProgress, onError).then((created) => {
            packId = created.id;
          });
    start.catch((error: unknown) => finish(() => reject(error)));
  });
}

/**
 * Saves the base map of the mission area on the phone with MapLibre's offline pack (UC-F03). Resolves once a pack
 * holding the area is complete, and at once when one already is; a cut-off pack resumes where it stopped. When the
 * commander moved the area past the saved one, a pack for the new area is downloaded and the old pack is dropped only
 * once the new one is complete, so a failed extension leaves the old map usable and the next call resumes it. Without
 * the native module or the tile key (Expo Go, web) there is no map to keep, so it resolves without doing anything.
 * Rejects when the download fails or is aborted, for the caller to retry.
 */
export async function downloadMapPack({ missionId, bounds, signal }: MapPackOptions): Promise<void> {
  const mapLibre = loadMapLibre();
  if (!mapLibre || !mapProvider) return;
  const { OfflineManager: manager } = mapLibre;
  signal?.throwIfAborted();

  const packs = (await manager.getPacks()).filter((pack) => pack.metadata.missionId === missionId);
  // Stopped while the packs were listed: nothing may be created or resumed after the caller cleaned up.
  signal?.throwIfAborted();
  const existing = packs.find((pack) => covers(pack, bounds));
  // Written for a resumed pack too: it reads the file again after a restart.
  const mapStyle = writeStyleFile(mapProvider);
  const [west, south, east, north] = bounds;
  const area: Bounds = [west - MARGIN, south - MARGIN, east + MARGIN, north + MARGIN];
  await followPack({
    manager,
    signal,
    pack: existing ?? {
      mapStyle,
      bounds: area,
      minZoom: MAP_PACK_MIN_ZOOM,
      maxZoom: MAP_PACK_MAX_ZOOM,
      metadata: { missionId, area },
    },
  });
  // The old area is no longer needed once the new one is on the phone. Only packs listed before are dropped: the new
  // pack is never one of them.
  await Promise.all(
    packs.filter((pack) => pack !== existing).map((pack) => manager.deletePack(pack.id).catch(() => undefined)),
  );
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

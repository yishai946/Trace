import { isActiveInPolygon, isSearcherOffline, latestUpdateAt } from '@trace/domain';
import { findOutside } from '@trace/geo';
import { PointGeometry, type PolygonGeometry } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { participations, searchers } from '../../db/schema';
import type { Actor } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { sendMessage } from '../messages/messages.service';

/** An assigned searcher the new boundary leaves outside, with what the alert and the Offline block need. */
export interface OutsideSearcher {
  participantId: string;
  searcherId: string;
  callsign: number;
  name: string;
  meters: number;
  /** Offline for the commander (UC-C10): no live connection and no recent update. */
  offline: boolean;
}

/**
 * Searchers assigned to the polygon who would end up outside the new boundary. `connected` holds the searchers whose
 * phone has the mission's live connection now; with their last update it decides who is Offline.
 */
export async function searchersOutside(
  tx: Tx,
  polygonId: string,
  geometry: PolygonGeometry,
  connected: ReadonlySet<string>,
): Promise<OutsideSearcher[]> {
  const rows = await tx
    .select({
      participantId: participations.id,
      searcherId: participations.searcherId,
      callsign: participations.callsign,
      name: searchers.name,
      status: participations.status,
      polygonId: participations.polygonId,
      position: asGeoJson(participations.lastPosition),
      positionAt: participations.lastPositionAt,
      batteryMeasuredAt: participations.batteryMeasuredAt,
    })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.polygonId, polygonId));

  const located = rows
    .filter((row) => isActiveInPolygon(row, polygonId) && row.position)
    .map((row) => ({ ...row, position: PointGeometry.parse(JSON.parse(row.position)).coordinates }));
  const byId = new Map(located.map((row) => [row.participantId, row]));
  const now = new Date();

  return findOutside(
    located.map((row) => ({ id: row.participantId, position: row.position })),
    geometry,
  ).flatMap(({ id, meters }) => {
    const row = byId.get(id);
    if (!row) return [];
    const lastUpdateAt = latestUpdateAt([row.positionAt, row.batteryMeasuredAt]);
    return [
      {
        participantId: id,
        searcherId: row.searcherId,
        callsign: row.callsign,
        name: row.name,
        meters: Math.round(meters),
        offline: isSearcherOffline({ connected: connected.has(row.searcherId), lastUpdateAt, now }),
      },
    ];
  });
}

/**
 * Tells each searcher the saved boundary left outside to return into it (decision 35): one message per searcher, so
 * it reaches only them. Best effort: the boundary is already saved, so a failed alert is logged and never fails it.
 */
export async function alertSearchersOutside(
  deps: ServiceDeps,
  input: { missionId: string; polygonName: string; outside: readonly OutsideSearcher[]; actor: Actor },
): Promise<void> {
  const { missionId, polygonName, outside, actor } = input;
  const results = await Promise.allSettled(
    outside.map((searcher) =>
      sendMessage(deps, {
        missionId,
        sentBy: actor.userId,
        message: {
          urgency: 'important',
          body: `גבול ${polygonName} שונה ואתם מחוץ לו. חזרו לתוך האזור או פנו למנהל.`,
          target: { kind: 'searcher', participantId: searcher.participantId },
        },
      }),
    ),
  );
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      deps.log.warn(
        { err: result.reason, missionId, participantId: outside[index]?.participantId },
        'boundary alert failed',
      );
    }
  });
}

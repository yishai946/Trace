import { PointGeometry, type Sos } from '@trace/schemas';
import { and, desc, eq, exists, or, sql } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { participations, polygons, searchers, sosAlertRecipients, sosAlerts, users } from '../../db/schema';

const sosColumns = {
  id: sosAlerts.id,
  missionId: sosAlerts.missionId,
  status: sosAlerts.status,
  participantId: participations.id,
  searcherId: participations.searcherId,
  callsign: participations.callsign,
  name: searchers.name,
  polygonId: polygons.id,
  polygonName: polygons.name,
  message: sosAlerts.message,
  position: asGeoJson(sosAlerts.position),
  positionRecordedAt: sosAlerts.positionRecordedAt,
  positionAccuracy: sosAlerts.positionAccuracy,
  recipientCount: sql<number>`(select count(*) from ${sosAlertRecipients} where ${sosAlertRecipients.sosId} = ${sosAlerts.id})::int`,
  activatedAt: sosAlerts.activatedAt,
  closedAt: sosAlerts.closedAt,
  closedByRole: users.role,
  closedByName: users.name,
};

const selectSos = (db: Db | Tx) =>
  db
    .select(sosColumns)
    .from(sosAlerts)
    .innerJoin(participations, eq(participations.id, sosAlerts.participationId))
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .leftJoin(polygons, eq(polygons.id, sosAlerts.polygonId))
    .leftJoin(users, eq(users.id, sosAlerts.closedBy))
    .$dynamic();
type SosRow = Awaited<ReturnType<typeof selectSos>>[number];

function toSos(row: SosRow): Sos {
  return {
    id: row.id,
    missionId: row.missionId,
    status: row.status,
    sender: { participantId: row.participantId, searcherId: row.searcherId, callsign: row.callsign, name: row.name },
    polygon: row.polygonId && row.polygonName ? { id: row.polygonId, name: row.polygonName } : null,
    message: row.message,
    location:
      row.position && row.positionRecordedAt
        ? {
            position: PointGeometry.parse(JSON.parse(row.position)),
            recordedAt: row.positionRecordedAt.toISOString(),
            accuracy: row.positionAccuracy,
          }
        : null,
    recipientCount: row.recipientCount,
    activatedAt: row.activatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    closedBy: row.closedByRole && row.closedByName ? { role: row.closedByRole, name: row.closedByName } : null,
  };
}

export async function readSos(db: Db | Tx, id: string): Promise<Sos> {
  const [row] = await selectSos(db).where(eq(sosAlerts.id, id));
  if (!row) throw new Error('SOS not found after saving');
  return toSos(row);
}

/**
 * The mission's SOS, newest first. The commander sees all of them; a searcher sees those they sent and those sent to
 * them. The route's access check has already answered 404 for a mission the user has no part in.
 */
export async function listSos(db: Db, { missionId, actor }: { missionId: string; actor: Actor }): Promise<Sos[]> {
  const visible =
    actor.role === 'commander' || !actor.searcherId
      ? undefined
      : or(
          eq(participations.searcherId, actor.searcherId),
          exists(
            db
              .select({ one: sql`1` })
              .from(sosAlertRecipients)
              .where(
                and(eq(sosAlertRecipients.sosId, sosAlerts.id), eq(sosAlertRecipients.searcherId, actor.searcherId)),
              ),
          ),
        );
  const rows = await selectSos(db)
    .where(and(eq(sosAlerts.missionId, missionId), visible))
    .orderBy(desc(sosAlerts.activatedAt), desc(sosAlerts.id));
  return rows.map(toSos);
}

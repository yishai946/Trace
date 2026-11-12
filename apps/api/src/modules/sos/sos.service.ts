import { canActivateSos, canCloseSos } from '@trace/domain';
import { PointGeometry, type CreateSosBody, type Sos, type TimelineEvent } from '@trace/schemas';
import { and, desc, eq, exists, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { participations, polygons, searchers, sosAlertRecipients, sosAlerts, users } from '../../db/schema';
import { AppError, forbidden, notFound } from '../../errors';
import { recordEvent } from '../timeline/timeline.service';

/** The searcher who acts: the route has checked that they have a profile and are in the mission. */
export type SosActor = { userId: string; searcherId: string };
type Body = z.output<typeof CreateSosBody>;

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

async function readSos(db: Db | Tx, id: string): Promise<Sos> {
  const [row] = await selectSos(db).where(eq(sosAlerts.id, id));
  if (!row) throw new Error('SOS not found after saving');
  return toSos(row);
}

export interface ActivatedSos {
  sos: Sos;
  /** False when the searcher already had an active SOS: it is returned unchanged and nothing else happens. */
  created: boolean;
  /** The searchers to tell besides the commander: the sender and the recipients stored now. */
  searcherIds: string[];
  /** The Timeline record to publish after the commit; null when nothing was created. */
  event: TimelineEvent | null;
}

/**
 * Activates an SOS for the searcher (UC-F13). It goes to the commander and to the searchers assigned to the sender's
 * polygon, any task status, without the sender (decisions 98, 100); they are stored now and never recalculated. The
 * participation row is locked, so two requests at once leave one active SOS. A searcher whose activity ended cannot
 * activate one; the mission's state does not matter (safety continues until Finish Activity). Without a location the
 * last known position is used; with none, the SOS is saved without one.
 */
export async function activateSos(
  db: Db,
  { missionId, actor, message, location }: { missionId: string; actor: SosActor } & Body,
): Promise<ActivatedSos> {
  return db.transaction(async (tx) => {
    const [participation] = await tx
      .select({
        id: participations.id,
        status: participations.status,
        polygonId: participations.polygonId,
        lastPosition: asGeoJson(participations.lastPosition),
        lastPositionAt: participations.lastPositionAt,
      })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, actor.searcherId)))
      .for('update');
    if (!participation) throw notFound('Mission');
    if (!canActivateSos(participation.status)) {
      throw new AppError(409, 'PARTICIPATION_ENDED', 'The activity in this mission has ended');
    }

    const [active] = await tx
      .select({ id: sosAlerts.id })
      .from(sosAlerts)
      .where(and(eq(sosAlerts.participationId, participation.id), eq(sosAlerts.status, 'active')));
    if (active) return { sos: await readSos(tx, active.id), created: false, searcherIds: [], event: null };

    // Only an assigned searcher has a polygon.
    const polygonId = participation.status === 'assigned' ? participation.polygonId : null;
    const recipients = polygonId
      ? await tx
          .select({ searcherId: participations.searcherId })
          .from(participations)
          .where(
            and(
              eq(participations.missionId, missionId),
              eq(participations.status, 'assigned'),
              eq(participations.polygonId, polygonId),
              ne(participations.searcherId, actor.searcherId),
            ),
          )
      : [];
    const polygonName = polygonId
      ? ((await tx.select({ name: polygons.name }).from(polygons).where(eq(polygons.id, polygonId)))[0]?.name ?? null)
      : null;

    const fix = location
      ? { position: location.position, recordedAt: new Date(location.recordedAt), accuracy: location.accuracy }
      : participation.lastPosition && participation.lastPositionAt
        ? {
            position: PointGeometry.parse(JSON.parse(participation.lastPosition)),
            recordedAt: participation.lastPositionAt,
            accuracy: null,
          }
        : null;

    const [row] = await tx
      .insert(sosAlerts)
      .values({
        missionId,
        participationId: participation.id,
        polygonId,
        message,
        position: fix?.position ?? null,
        positionRecordedAt: fix?.recordedAt ?? null,
        positionAccuracy: fix?.accuracy ?? null,
      })
      .returning({ id: sosAlerts.id });
    if (!row) throw new Error('SOS insert returned no row');
    if (recipients.length > 0) {
      await tx.insert(sosAlertRecipients).values(recipients.map((r) => ({ sosId: row.id, searcherId: r.searcherId })));
    }
    const event = await recordEvent(tx, {
      missionId,
      type: 'sos.activated',
      actor: { role: 'searcher', userId: actor.userId, searcherId: actor.searcherId },
      subject: { kind: 'sos', id: row.id, label: polygonName },
      details: { message },
    });
    return {
      sos: await readSos(tx, row.id),
      created: true,
      searcherIds: [actor.searcherId, ...recipients.map((r) => r.searcherId)],
      event,
    };
  });
}

export interface ClosedSos {
  sos: Sos;
  /** False when it was already closed: it is returned unchanged and nothing is sent. */
  changed: boolean;
  /** The searchers to tell besides the commander: the sender and the recipients stored at activation (decision 99). */
  searcherIds: string[];
}

/**
 * Closes an SOS (UC-F13, UC-C14): the commander closes any SOS of the mission, a searcher only their own (decision 99).
 * The sender may close it in any participation or mission state. Closing it again changes nothing. Permission is
 * checked before the state, so another searcher is refused on a closed SOS as well.
 */
export async function closeSos(
  db: Db,
  { missionId, sosId, actor }: { missionId: string; sosId: string; actor: Actor },
): Promise<ClosedSos> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: sosAlerts.id, status: sosAlerts.status, senderId: participations.searcherId })
      .from(sosAlerts)
      .innerJoin(participations, eq(participations.id, sosAlerts.participationId))
      .where(and(eq(sosAlerts.id, sosId), eq(sosAlerts.missionId, missionId)))
      .for('update', { of: sosAlerts });
    if (!locked) throw notFound('SOS');
    const isSender = actor.role === 'searcher' && actor.searcherId === locked.senderId;
    if (!canCloseSos({ role: actor.role, isSender })) throw forbidden();

    const changed = locked.status === 'active';
    if (changed) {
      await tx
        .update(sosAlerts)
        .set({ status: 'closed', closedAt: sql`now()`, closedBy: actor.userId })
        .where(eq(sosAlerts.id, sosId));
    }
    const recipients = await tx
      .select({ searcherId: sosAlertRecipients.searcherId })
      .from(sosAlertRecipients)
      .where(eq(sosAlertRecipients.sosId, sosId));
    return {
      sos: await readSos(tx, sosId),
      changed,
      searcherIds: [locked.senderId, ...recipients.map((r) => r.searcherId)],
    };
  });
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
              .where(and(eq(sosAlertRecipients.sosId, sosAlerts.id), eq(sosAlertRecipients.searcherId, actor.searcherId))),
          ),
        );
  const rows = await selectSos(db)
    .where(and(eq(sosAlerts.missionId, missionId), visible))
    .orderBy(desc(sosAlerts.activatedAt), desc(sosAlerts.id));
  return rows.map(toSos);
}

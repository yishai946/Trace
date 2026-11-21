import { canActivateSos, canCloseSos } from '@trace/domain';
import { PointGeometry, type CreateSosBody, type Sos, type TimelineEvent } from '@trace/schemas';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { participations, polygons, sosAlertRecipients, sosAlerts } from '../../db/schema';
import { forbidden, notFound, participationEnded } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { readSos } from './sos.read';
import { sosPushMessage } from './sosPush';

/** The searcher who acts: the route has checked that they have a profile and are in the mission. */
export type SosActor = { userId: string; searcherId: string };
type Body = z.output<typeof CreateSosBody>;

/** The searchers assigned to the sender's polygon, without the sender, and the polygon's name. */
async function polygonAudience(
  tx: Tx,
  { missionId, polygonId, senderId }: { missionId: string; polygonId: string; senderId: string },
) {
  const recipients = await tx
    .select({ searcherId: participations.searcherId })
    .from(participations)
    .where(
      and(
        eq(participations.missionId, missionId),
        eq(participations.status, 'assigned'),
        eq(participations.polygonId, polygonId),
        ne(participations.searcherId, senderId),
      ),
    );
  const [polygon] = await tx.select({ name: polygons.name }).from(polygons).where(eq(polygons.id, polygonId));
  return { recipients, polygonName: polygon?.name ?? null };
}

/** Where the SOS is: the location sent with it, else the searcher's last known position, else nowhere. */
function sosFix(
  location: Body['location'],
  participation: { lastPosition: string | null; lastPositionAt: Date | null },
) {
  if (location) {
    return { position: location.position, recordedAt: new Date(location.recordedAt), accuracy: location.accuracy };
  }
  if (!participation.lastPosition || !participation.lastPositionAt) return null;
  return {
    position: PointGeometry.parse(JSON.parse(participation.lastPosition)),
    recordedAt: participation.lastPositionAt,
    accuracy: null,
  };
}

interface ActivatedSos {
  sos: Sos;
  /** False when the searcher already had an active SOS: it is returned unchanged and nothing else happens. */
  created: boolean;
  /** The searchers to tell besides the commander: the sender and the recipients stored now. */
  searcherIds: string[];
  /** The recipients stored now, without the sender: the ones to push to. */
  recipientIds: string[];
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
  { db, realtime, push }: ServiceDeps,
  { missionId, actor, message, location }: { missionId: string; actor: SosActor } & Body,
): Promise<{ sos: Sos; created: boolean }> {
  const result: ActivatedSos = await db.transaction(async (tx) => {
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
      throw participationEnded();
    }

    const [active] = await tx
      .select({ id: sosAlerts.id })
      .from(sosAlerts)
      .where(and(eq(sosAlerts.participationId, participation.id), eq(sosAlerts.status, 'active')));
    if (active)
      return { sos: await readSos(tx, active.id), created: false, searcherIds: [], recipientIds: [], event: null };

    // Only an assigned searcher has a polygon.
    const polygonId = participation.status === 'assigned' ? participation.polygonId : null;
    const { recipients, polygonName } = polygonId
      ? await polygonAudience(tx, { missionId, polygonId, senderId: actor.searcherId })
      : { recipients: [], polygonName: null };
    const fix = sosFix(location, participation);

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
    const recipientIds = recipients.map((r) => r.searcherId);
    return {
      sos: await readSos(tx, row.id),
      created: true,
      searcherIds: [actor.searcherId, ...recipientIds],
      recipientIds,
      event,
    };
  });
  const { sos, created, event } = result;
  if (created) {
    realtime.publish({ type: 'sos.saved', missionId, sos }, { searcherIds: result.searcherIds });
    if (event) realtime.publish({ type: 'timeline.recorded', missionId, event });
    void push.notifySearchers({
      missionId,
      searcherIds: result.recipientIds,
      message: sosPushMessage(sos, 'activated'),
    });
  }
  return { sos, created };
}

interface ClosedSos {
  sos: Sos;
  /** False when it was already closed: it is returned unchanged and nothing is sent. */
  changed: boolean;
  /** The Timeline record to publish after the commit; null when nothing changed. */
  event: TimelineEvent | null;
  /** The searchers to tell besides the commander: the sender and the recipients stored at activation (decision 99). */
  searcherIds: string[];
}

/**
 * Closes an SOS (UC-F13, UC-C14): the commander closes any SOS of the mission, a searcher only their own (decision 99).
 * The sender may close it in any participation or mission state. Closing it again changes nothing. Permission is
 * checked before the state, so another searcher is refused on a closed SOS as well.
 */
export async function closeSos(
  { db, realtime, push }: ServiceDeps,
  { missionId, sosId, actor }: { missionId: string; sosId: string; actor: Actor },
): Promise<Sos> {
  const result: ClosedSos = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({
        id: sosAlerts.id,
        status: sosAlerts.status,
        senderId: participations.searcherId,
        polygonName: polygons.name,
      })
      .from(sosAlerts)
      .innerJoin(participations, eq(participations.id, sosAlerts.participationId))
      .leftJoin(polygons, eq(polygons.id, sosAlerts.polygonId))
      .where(and(eq(sosAlerts.id, sosId), eq(sosAlerts.missionId, missionId)))
      .for('update', { of: sosAlerts });
    if (!locked) throw notFound('SOS');
    const isSender = actor.role === 'searcher' && actor.searcherId === locked.senderId;
    if (!canCloseSos({ role: actor.role, isSender })) throw forbidden();

    const changed = locked.status === 'active';
    let event: TimelineEvent | null = null;
    if (changed) {
      await tx
        .update(sosAlerts)
        .set({ status: 'closed', closedAt: sql`now()`, closedBy: actor.userId })
        .where(eq(sosAlerts.id, sosId));
      event = await recordEvent(tx, {
        missionId,
        type: 'sos.closed',
        actor,
        subject: { kind: 'sos', id: sosId, label: locked.polygonName },
        details: {},
      });
    }
    const recipients = await tx
      .select({ searcherId: sosAlertRecipients.searcherId })
      .from(sosAlertRecipients)
      .where(eq(sosAlertRecipients.sosId, sosId));
    return {
      sos: await readSos(tx, sosId),
      changed,
      event,
      searcherIds: [locked.senderId, ...recipients.map((r) => r.searcherId)],
    };
  });
  const { sos, changed, searcherIds, event } = result;
  if (changed) {
    realtime.publish({ type: 'sos.saved', missionId, sos }, { searcherIds });
    if (event) realtime.publish({ type: 'timeline.recorded', missionId, event });
    void push.notifySearchers({
      missionId,
      searcherIds: searcherIds.filter((id) => actor.role !== 'searcher' || id !== actor.searcherId),
      message: sosPushMessage(sos, 'closed'),
    });
  }
  return sos;
}

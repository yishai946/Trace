import {
  applyReceipt,
  canRecordReceipt,
  canSendMessage,
  isMessageRecipient,
  recipientStatus,
  requiresAcknowledgement,
  type MessageReceipt,
  type MessageTargetRule,
  type MessageUrgency,
} from '@trace/domain';
import type { Message, MessageRecipient, MessageTarget, OwnMessage, SendMessageBody } from '@trace/schemas';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db';
import { messageRecipients, messages, missions, participations, polygons, searchers } from '../../db/schema';
import { AppError, notFound } from '../../errors';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The push notification title per urgency. Sound and importance per urgency belong to push infrastructure (#126). */
export const PUSH_TITLES: Record<MessageUrgency, string> = {
  normal: 'הודעה מהמנהל',
  important: 'הודעה חשובה מהמנהל',
  critical: 'הודעה קריטית מהמנהל',
};

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/** Locks the mission row so a send does not race the mission ending. */
async function lockMission(tx: Tx, missionId: string) {
  const [mission] = await tx
    .select({ status: missions.status })
    .from(missions)
    .where(eq(missions.id, missionId))
    .for('update');
  if (!mission) throw notFound('Mission');
  if (!canSendMessage(mission.status)) {
    throw new AppError(409, 'MISSION_ENDED', 'Messages cannot be sent in an ended mission');
  }
}

/**
 * The mission's messages, newest first, with their recipients ordered by callsign. With `ids`, only those messages.
 */
async function loadMessages(db: Db | Tx, missionId: string, ids?: string[]): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.missionId, missionId), ids ? inArray(messages.id, ids) : undefined))
    .orderBy(desc(messages.createdAt), desc(messages.id));
  if (rows.length === 0) return [];
  const recipientRows = await db
    .select({
      messageId: messageRecipients.messageId,
      participantId: participations.id,
      searcherId: participations.searcherId,
      callsign: participations.callsign,
      name: searchers.name,
      deliveredAt: messageRecipients.deliveredAt,
      readAt: messageRecipients.readAt,
      acknowledgedAt: messageRecipients.acknowledgedAt,
    })
    .from(messageRecipients)
    .innerJoin(participations, eq(participations.id, messageRecipients.participationId))
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(
      inArray(
        messageRecipients.messageId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(participations.callsign));
  const polygonIds = [...new Set(rows.flatMap((row) => row.targetPolygonIds ?? []))];
  const polygonRows =
    polygonIds.length > 0
      ? await db.select({ id: polygons.id, name: polygons.name }).from(polygons).where(inArray(polygons.id, polygonIds))
      : [];
  const polygonNames = new Map(polygonRows.map((polygon) => [polygon.id, polygon.name]));

  return rows.map((row): Message => {
    const recipients: MessageRecipient[] = recipientRows
      .filter((recipient) => recipient.messageId === row.id)
      .map((recipient) => ({
        participantId: recipient.participantId,
        searcherId: recipient.searcherId,
        callsign: recipient.callsign,
        name: recipient.name,
        status: recipientStatus(recipient),
        deliveredAt: iso(recipient.deliveredAt),
        readAt: iso(recipient.readAt),
        acknowledgedAt: iso(recipient.acknowledgedAt),
      }));
    return {
      id: row.id,
      missionId: row.missionId,
      urgency: row.urgency,
      body: row.body,
      target: targetOf(row, recipients, polygonNames),
      sentAt: row.createdAt.toISOString(),
      recipients,
    };
  });
}

function targetOf(
  row: {
    targetKind: 'mission' | 'polygons' | 'searcher';
    targetPolygonIds: string[] | null;
    targetParticipantId: string | null;
  },
  recipients: MessageRecipient[],
  polygonNames: Map<string, string>,
): MessageTarget {
  if (row.targetKind === 'polygons') {
    return {
      kind: 'polygons',
      polygons: (row.targetPolygonIds ?? []).map((id) => ({ id, name: polygonNames.get(id) ?? '' })),
    };
  }
  if (row.targetKind === 'searcher') {
    // The target participant is always one of the recipients.
    const target = recipients.find((recipient) => recipient.participantId === row.targetParticipantId);
    if (!target || !row.targetParticipantId) throw new Error('Message target participant is not a recipient');
    return { kind: 'searcher', participantId: row.targetParticipantId, callsign: target.callsign, name: target.name };
  }
  return { kind: 'mission' };
}

function toOwnMessage(
  message: { id: string; missionId: string; urgency: MessageUrgency; body: string; sentAt: string },
  recipient: Pick<MessageRecipient, 'status' | 'deliveredAt' | 'readAt' | 'acknowledgedAt'>,
): OwnMessage {
  return {
    id: message.id,
    missionId: message.missionId,
    urgency: message.urgency,
    body: message.body,
    sentAt: message.sentAt,
    requiresAcknowledgement: requiresAcknowledgement(message.urgency),
    status: recipient.status,
    deliveredAt: recipient.deliveredAt,
    readAt: recipient.readAt,
    acknowledgedAt: recipient.acknowledgedAt,
  };
}

/**
 * Sends a message (UC-C12). The recipients are fixed here: a searcher who joins later does not get it. Everything is
 * stored, so a searcher who is offline reads it when they are back (decision 77).
 */
export async function sendMessage(
  db: Db,
  input: { missionId: string; sentBy: string; message: z.output<typeof SendMessageBody> },
): Promise<{ message: Message; deliveries: { searcherId: string; message: OwnMessage }[] }> {
  const { missionId, sentBy, message: request } = input;
  return db.transaction(async (tx) => {
    await lockMission(tx, missionId);
    const members = await tx
      .select({
        id: participations.id,
        searcherId: participations.searcherId,
        status: participations.status,
        polygonId: participations.polygonId,
      })
      .from(participations)
      .where(eq(participations.missionId, missionId));

    const { target } = request;
    let rule: MessageTargetRule;
    if (target.kind === 'polygons') {
      const found = await tx
        .select({ id: polygons.id })
        .from(polygons)
        .where(
          and(eq(polygons.missionId, missionId), inArray(polygons.id, target.polygonIds), isNull(polygons.deletedAt)),
        );
      if (found.length < target.polygonIds.length) {
        throw new AppError(404, 'POLYGON_NOT_FOUND', 'Polygon not found');
      }
      rule = { kind: 'polygons', polygonIds: target.polygonIds };
    } else if (target.kind === 'searcher') {
      const participant = members.find((member) => member.id === target.participantId);
      if (!participant) throw notFound('Participant');
      if (participant.status === 'ended') {
        throw new AppError(409, 'PARTICIPATION_ENDED', 'The activity in this mission has ended');
      }
      rule = { kind: 'searcher', participantId: target.participantId };
    } else {
      rule = { kind: 'mission' };
    }

    const recipients = members.filter((member) => isMessageRecipient(member, rule));
    if (recipients.length === 0) {
      throw new AppError(409, 'NO_RECIPIENTS', 'No active searcher matches this target');
    }

    const [inserted] = await tx
      .insert(messages)
      .values({
        missionId,
        sentBy,
        urgency: request.urgency,
        body: request.body,
        targetKind: target.kind,
        targetPolygonIds: target.kind === 'polygons' ? target.polygonIds : null,
        targetParticipantId: target.kind === 'searcher' ? target.participantId : null,
        // Read inside the lock, so the order follows the commits (as sightings).
        createdAt: sql`clock_timestamp()`,
      })
      .returning({ id: messages.id });
    if (!inserted) throw new Error('Message insert returned no row');
    await tx
      .insert(messageRecipients)
      .values(recipients.map((recipient) => ({ messageId: inserted.id, participationId: recipient.id })));

    const [message] = await loadMessages(tx, missionId, [inserted.id]);
    if (!message) throw new Error('Saved message not found');
    const deliveries = message.recipients.map((recipient) => ({
      searcherId: recipient.searcherId,
      message: toOwnMessage(message, recipient),
    }));
    return { message, deliveries };
  });
}

/** The mission's messages, newest first. */
export const listMessages = (db: Db, missionId: string) => loadMessages(db, missionId);

/** The messages addressed to a searcher in a mission, newest first. */
export async function listOwnMessages(
  db: Db,
  { missionId, searcherId }: { missionId: string; searcherId: string },
): Promise<OwnMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      missionId: messages.missionId,
      urgency: messages.urgency,
      body: messages.body,
      createdAt: messages.createdAt,
      deliveredAt: messageRecipients.deliveredAt,
      readAt: messageRecipients.readAt,
      acknowledgedAt: messageRecipients.acknowledgedAt,
    })
    .from(messageRecipients)
    .innerJoin(participations, eq(participations.id, messageRecipients.participationId))
    .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)))
    .orderBy(desc(messages.createdAt), desc(messages.id));
  return rows.map((row) =>
    toOwnMessage(
      { ...row, sentAt: row.createdAt.toISOString() },
      {
        status: recipientStatus(row),
        deliveredAt: iso(row.deliveredAt),
        readAt: iso(row.readAt),
        acknowledgedAt: iso(row.acknowledgedAt),
      },
    ),
  );
}

/**
 * Records what a recipient's app reported. Receipts move forward only: a repeated or earlier one changes nothing
 * (`changed: false`). Accepted whatever the mission status: a searcher may read a message after the mission ended.
 */
export async function recordReceipt(
  db: Db,
  input: { missionId: string; searcherId: string; messageId: string; receipt: MessageReceipt },
): Promise<{ message: OwnMessage; recipient: MessageRecipient; changed: boolean }> {
  const { missionId, searcherId, messageId, receipt } = input;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        participationId: messageRecipients.participationId,
        urgency: messages.urgency,
        deliveredAt: messageRecipients.deliveredAt,
        readAt: messageRecipients.readAt,
        acknowledgedAt: messageRecipients.acknowledgedAt,
      })
      .from(messageRecipients)
      .innerJoin(participations, eq(participations.id, messageRecipients.participationId))
      .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
      .where(
        and(
          eq(messageRecipients.messageId, messageId),
          eq(messages.missionId, missionId),
          eq(participations.missionId, missionId),
          eq(participations.searcherId, searcherId),
        ),
      )
      .for('update', { of: messageRecipients });
    if (!row) throw notFound('Message');
    if (!canRecordReceipt(row.urgency, receipt)) {
      throw new AppError(409, 'MESSAGE_NOT_CRITICAL', 'Only a critical message can be acknowledged');
    }
    const times = { deliveredAt: row.deliveredAt, readAt: row.readAt, acknowledgedAt: row.acknowledgedAt };
    const next = applyReceipt(times, receipt, new Date());
    const changed = next !== times;
    if (changed) {
      await tx
        .update(messageRecipients)
        .set(next)
        .where(
          and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.participationId, row.participationId)),
        );
    }
    const [message] = await loadMessages(tx, missionId, [messageId]);
    const recipient = message?.recipients.find((candidate) => candidate.participantId === row.participationId);
    if (!message || !recipient) throw new Error('Saved message not found');
    return { message: toOwnMessage(message, recipient), recipient, changed };
  });
}

import { recipientStatus, requiresAcknowledgement, type MessageUrgency } from '@trace/domain';
import type { Message, MessageRecipient, MessageTarget, OwnMessage } from '@trace/schemas';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db, Tx } from '../../db';
import { messageRecipients, messages, participations, polygons, searchers } from '../../db/schema';

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * The mission's messages, newest first, with their recipients ordered by callsign. With `ids`, only those messages.
 */
export async function loadMessages(db: Db | Tx, missionId: string, ids?: string[]): Promise<Message[]> {
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

export function toOwnMessage(
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

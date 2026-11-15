import {
  applyReceipt,
  canRecordReceipt,
  canSendMessage,
  isMessageRecipient,
  type MessageReceipt,
  type MessageTargetRule,
  type MessageUrgency,
} from '@trace/domain';
import type { Message, MessageRecipient, OwnMessage, SendMessageBody } from '@trace/schemas';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db';
import { messageRecipients, messages, participations, polygons } from '../../db/schema';
import { AppError, notFound, missionEnded, participationEnded } from '../../errors';
import { lockMission } from '../lockMission';
import { loadMessages, toOwnMessage } from './messages.read';

/** The push notification title per urgency. Sound and importance per urgency belong to push infrastructure (#126). */
export const PUSH_TITLES: Record<MessageUrgency, string> = {
  normal: 'הודעה מהמנהל',
  important: 'הודעה חשובה מהמנהל',
  critical: 'הודעה קריטית מהמנהל',
};

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
    await lockMission(tx, missionId, {
      allowed: canSendMessage,
      refusal: () => missionEnded('Messages cannot be sent in an ended mission'),
    });
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
        throw participationEnded();
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

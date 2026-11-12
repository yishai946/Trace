import { MESSAGE_RECEIPTS, MESSAGE_URGENCIES, RECIPIENT_STATUSES } from '@trace/domain';
import { z } from 'zod';

const instant = z.iso.datetime({ offset: true });

export const MessageUrgency = z.enum(MESSAGE_URGENCIES).meta({ id: 'MessageUrgency' });
export const RecipientStatus = z.enum(RECIPIENT_STATUSES).meta({ id: 'RecipientStatus' });
export const MessageReceipt = z.enum(MESSAGE_RECEIPTS).meta({ id: 'MessageReceipt' });

/** Who to send to (decision 25). Polygon ids must be distinct. */
export const SendMessageTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mission') }),
  z.object({
    kind: z.literal('polygons'),
    polygonIds: z
      .array(z.uuid())
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, 'Polygons must be distinct'),
  }),
  z.object({ kind: z.literal('searcher'), participantId: z.uuid() }),
]);

// Has a transform (trim), so no component id (as CreateSightingBody).
export const SendMessageBody = z.object({
  target: SendMessageTarget,
  urgency: MessageUrgency,
  body: z.string().trim().min(1).max(2000),
});

/** The target as the commander sees it later: names come from the polygons and the searcher. */
export const MessageTarget = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('mission') }),
    z.object({ kind: z.literal('polygons'), polygons: z.array(z.object({ id: z.uuid(), name: z.string() })) }),
    z.object({
      kind: z.literal('searcher'),
      participantId: z.uuid(),
      callsign: z.number().int().min(0).max(99),
      name: z.string(),
    }),
  ])
  .meta({ id: 'MessageTarget' });

/** One recipient of a message, for the commander (Cd11 "פירוט לפי נמען"). */
export const MessageRecipient = z
  .object({
    participantId: z.uuid(),
    searcherId: z.uuid(),
    callsign: z.number().int().min(0).max(99),
    name: z.string(),
    status: RecipientStatus,
    /** When the searcher's app got the message; null while it waits for delivery (decision 77). */
    deliveredAt: instant.nullable(),
    readAt: instant.nullable(),
    acknowledgedAt: instant.nullable(),
  })
  .meta({ id: 'MessageRecipient' });

export const Message = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    urgency: MessageUrgency,
    body: z.string(),
    target: MessageTarget,
    sentAt: instant,
    /** Fixed when sent, ordered by callsign. */
    recipients: z.array(MessageRecipient),
  })
  .meta({ id: 'Message' });
export const MessageList = z.array(Message).meta({ id: 'MessageList' });

/** A message as its recipient sees it: no other recipients (decision 32). */
export const OwnMessage = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    urgency: MessageUrgency,
    body: z.string(),
    sentAt: instant,
    requiresAcknowledgement: z.boolean(),
    status: RecipientStatus,
    deliveredAt: instant.nullable(),
    readAt: instant.nullable(),
    acknowledgedAt: instant.nullable(),
  })
  .meta({ id: 'OwnMessage' });
export const OwnMessageList = z.array(OwnMessage).meta({ id: 'OwnMessageList' });

export const MessageReceiptBody = z.object({ receipt: MessageReceipt }).meta({ id: 'MessageReceiptBody' });
export const MessageParams = z.object({ missionId: z.uuid(), messageId: z.uuid() });

export type MessageUrgency = z.infer<typeof MessageUrgency>;
export type RecipientStatus = z.infer<typeof RecipientStatus>;
export type MessageReceipt = z.infer<typeof MessageReceipt>;
export type SendMessageBody = z.input<typeof SendMessageBody>;
export type MessageTarget = z.infer<typeof MessageTarget>;
export type MessageRecipient = z.infer<typeof MessageRecipient>;
export type Message = z.infer<typeof Message>;
export type OwnMessage = z.infer<typeof OwnMessage>;
export type MessageReceiptBody = z.infer<typeof MessageReceiptBody>;

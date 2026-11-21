import { formatCallsign, type MessageTargetKind, type MessageUrgency } from '@trace/domain';
import type { Message, MessageRecipient } from '@trace/schemas';

export const URGENCY_LABEL: Record<MessageUrgency, string> = {
  normal: 'רגילה',
  important: 'חשובה',
  critical: 'קריטית',
};
export const TARGET_KIND_LABEL: Record<MessageTargetKind, string> = {
  mission: 'כלל המסע',
  polygons: 'פוליגון',
  searcher: 'מחפש',
};

/** "כלל המסע, 24" · "ואדי צפוני, 7" · "ואדי צפוני, חורשת אורנים, 18" · "03 מיכל רז" (Cd11). */
export function recipientsLabel(message: Message): string {
  const { target, recipients } = message;
  if (target.kind === 'searcher') return `${formatCallsign(target.callsign)} ${target.name}`;
  if (target.kind === 'polygons')
    return `${target.polygons.map((polygon) => polygon.name).join(', ')}, ${recipients.length}`;
  return `${TARGET_KIND_LABEL.mission}, ${recipients.length}`;
}

/** Per recipient (Cd11): not delivered "נשלחה, ממתין למסירה"; delivered "נמסרה"; "נקראה"; "אושרה". */
export function recipientStateLabel(recipient: MessageRecipient): string {
  if (recipient.status === 'acknowledged') return 'אושרה';
  if (recipient.status === 'read') return 'נקראה';
  return recipient.deliveredAt ? 'נמסרה' : 'נשלחה, ממתין למסירה';
}

export function counts(message: Message) {
  const { recipients } = message;
  return {
    total: recipients.length,
    delivered: recipients.filter((r) => r.deliveredAt !== null).length,
    read: recipients.filter((r) => r.status === 'read' || r.status === 'acknowledged').length,
    acknowledged: recipients.filter((r) => r.status === 'acknowledged').length,
  };
}

/**
 * Row status (Cd11 "מצב"). One recipient: their state label. Critical: "נקראה {read}, אושרה {ack}". Otherwise
 * "נקראה {read} מתוך {n}". Read counts read or acknowledged.
 */
export function statusSummary(message: Message): string {
  const [only] = message.recipients;
  if (message.recipients.length === 1 && only) return recipientStateLabel(only);
  const { total, read, acknowledged } = counts(message);
  return message.urgency === 'critical' ? `נקראה ${read}, אושרה ${acknowledged}` : `נקראה ${read} מתוך ${total}`;
}

const attentionRank = (r: MessageRecipient) =>
  r.status === 'acknowledged' ? 3 : r.status === 'read' ? 2 : r.deliveredAt ? 1 : 0;

/** Waiting first (not delivered, delivered, read, acknowledged), then by callsign (Cd11 detail order). */
export function byAttention(a: MessageRecipient, b: MessageRecipient): number {
  return attentionRank(a) - attentionRank(b) || a.callsign - b.callsign;
}

/** Final: acknowledged for a critical message, read otherwise. The call button shows only before that. */
export function isFinal(message: Message, recipient: MessageRecipient): boolean {
  return message.urgency === 'critical' ? recipient.status === 'acknowledged' : recipient.status !== 'sent';
}

/** "שלח ל-7 מחפשים", one: "שלח למחפש אחד", none: "שלח". */
export function sendLabel(count: number): string {
  if (count <= 0) return 'שלח';
  return count === 1 ? 'שלח למחפש אחד' : `שלח ל-${count} מחפשים`;
}

/** The recipient's step, for the state word and its colour: waiting for delivery, delivered, read or acknowledged. */
export function recipientState(r: MessageRecipient): 'pending' | 'delivered' | 'read' | 'acknowledged' {
  if (r.status === 'acknowledged') return 'acknowledged';
  if (r.status === 'read') return 'read';
  return r.deliveredAt ? 'delivered' : 'pending';
}

/** The time of the latest step: acknowledged, else read, else delivered. */
export function lastStepTime(r: MessageRecipient): string | null {
  return r.acknowledgedAt ?? r.readAt ?? r.deliveredAt;
}

/** "נקראה 2/3", and for a critical message also "אושרה 1/3" (decision 27; wireframe Cm11 card). */
export function readFractions(message: Message): { label: string; value: string }[] {
  const { total, read, acknowledged } = counts(message);
  const fractions = [{ label: 'נקראה', value: `${read}/${total}` }];
  return message.urgency === 'critical'
    ? [...fractions, { label: 'אושרה', value: `${acknowledged}/${total}` }]
    : fractions;
}

/** The sent list's loading, error and empty texts, shared by the desktop and phone screens. */
export const SENT_MESSAGES_TEXT = {
  failed: 'לא ניתן לטעון את ההודעות מהשרת.',
  loading: 'טוען הודעות…',
  empty: 'עוד לא נשלחו הודעות במסע הזה.',
};

/** Offline recipients still get the message when they reconnect (decision 77); the channel is one way. */
export const OFFLINE_NOTE = 'הודעה למחפש לא מקוון נשמרת ותימסר בחיבור. הודעות חד-כיווניות; אין מענה מהמחפשים.';

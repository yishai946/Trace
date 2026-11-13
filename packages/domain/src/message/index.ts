import { isMissionEnded, type MissionStatus } from '../mission';
import { isActiveInPolygon, type PolygonMember } from '../participation';

/** How urgent a commander's message is (decision 26). Only `critical` asks for an acknowledgement (decision 27). */
export const MESSAGE_URGENCIES = ['normal', 'important', 'critical'] as const;
export type MessageUrgency = (typeof MESSAGE_URGENCIES)[number];

/** Who a message goes to (decision 25): the whole mission, one or more polygons, or one searcher. */
export const MESSAGE_TARGET_KINDS = ['mission', 'polygons', 'searcher'] as const;
export type MessageTargetKind = (typeof MESSAGE_TARGET_KINDS)[number];

/** A recipient's state (spec §5): Sent → Read, and for critical messages → Acknowledged. */
export const RECIPIENT_STATUSES = ['sent', 'read', 'acknowledged'] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

/** What a searcher's app reports about a message, in the order they happen. Delivery is recorded, not a status. */
export const MESSAGE_RECEIPTS = ['delivered', 'read', 'acknowledged'] as const;
export type MessageReceipt = (typeof MESSAGE_RECEIPTS)[number];

/** Messages are sent while the mission runs, active or paused (UC-C12 precondition). */
export function canSendMessage(status: MissionStatus): boolean {
  return !isMissionEnded(status);
}

/** Only a critical message needs "אישרתי" (decision 27). */
export function requiresAcknowledgement(urgency: MessageUrgency): boolean {
  return urgency === 'critical';
}

export type MessageTargetRule =
  | { kind: 'mission' }
  | { kind: 'polygons'; polygonIds: readonly string[] }
  | { kind: 'searcher'; participantId: string };

/**
 * Whether a participant is a recipient. Whole mission: everyone not Activity Ended. Polygons: assigned to one of
 * them, by any task status (decision 100). One searcher: that participant, unless their activity ended.
 */
export function isMessageRecipient(member: PolygonMember & { id: string }, target: MessageTargetRule): boolean {
  switch (target.kind) {
    case 'mission':
      return member.status !== 'ended';
    case 'polygons':
      return target.polygonIds.some((polygonId) => isActiveInPolygon(member, polygonId));
    case 'searcher':
      return member.id === target.participantId && member.status !== 'ended';
  }
}

export interface ReceiptTimes {
  deliveredAt: Date | null;
  readAt: Date | null;
  acknowledgedAt: Date | null;
}

export function recipientStatus(times: ReceiptTimes): RecipientStatus {
  if (times.acknowledgedAt) return 'acknowledged';
  if (times.readAt) return 'read';
  return 'sent';
}

/** Whether the receipt fits the message: acknowledged only for a critical one. */
export function canRecordReceipt(urgency: MessageUrgency, receipt: MessageReceipt): boolean {
  return receipt !== 'acknowledged' || requiresAcknowledgement(urgency);
}

/**
 * The times after a receipt. Receipts only move forward: a later one fills every earlier time still empty, and an
 * earlier or repeated one changes nothing (the same object is returned).
 */
export function applyReceipt(times: ReceiptTimes, receipt: MessageReceipt, at: Date): ReceiptTimes {
  const next: ReceiptTimes = {
    deliveredAt: times.deliveredAt ?? at,
    readAt: receipt === 'delivered' ? times.readAt : (times.readAt ?? at),
    acknowledgedAt: receipt === 'acknowledged' ? (times.acknowledgedAt ?? at) : times.acknowledgedAt,
  };
  const changed =
    next.deliveredAt !== times.deliveredAt ||
    next.readAt !== times.readAt ||
    next.acknowledgedAt !== times.acknowledgedAt;
  return changed ? next : times;
}

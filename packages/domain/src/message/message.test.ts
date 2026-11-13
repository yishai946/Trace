import { describe, expect, it } from 'vitest';
import {
  applyReceipt,
  canRecordReceipt,
  canSendMessage,
  isMessageRecipient,
  recipientStatus,
  requiresAcknowledgement,
  type ReceiptTimes,
} from '.';

const empty: ReceiptTimes = { deliveredAt: null, readAt: null, acknowledgedAt: null };
const t1 = new Date('2026-10-03T10:00:00Z');
const t2 = new Date('2026-10-03T10:05:00Z');

describe('canSendMessage', () => {
  it('allows an active or paused mission', () => {
    expect(canSendMessage('active')).toBe(true);
    expect(canSendMessage('paused')).toBe(true);
  });

  it('refuses an ended mission', () => {
    expect(canSendMessage('ended_located')).toBe(false);
    expect(canSendMessage('ended_stopped')).toBe(false);
  });
});

describe('requiresAcknowledgement', () => {
  it('is true only for a critical message', () => {
    expect(requiresAcknowledgement('normal')).toBe(false);
    expect(requiresAcknowledgement('important')).toBe(false);
    expect(requiresAcknowledgement('critical')).toBe(true);
  });
});

describe('isMessageRecipient', () => {
  const available = { id: 'a', status: 'available', polygonId: null } as const;
  const assignedA = { id: 'b', status: 'assigned', polygonId: 'pa' } as const;
  const assignedB = { id: 'c', status: 'assigned', polygonId: 'pb' } as const;
  const ended = { id: 'd', status: 'ended', polygonId: 'pa' } as const;

  it('sends to everyone whose activity has not ended for the whole mission', () => {
    const rule = { kind: 'mission' } as const;
    expect(isMessageRecipient(available, rule)).toBe(true);
    expect(isMessageRecipient(assignedA, rule)).toBe(true);
    expect(isMessageRecipient(ended, rule)).toBe(false);
  });

  it('sends to those assigned to one of the polygons', () => {
    const rule = { kind: 'polygons', polygonIds: ['pa'] } as const;
    expect(isMessageRecipient(assignedA, rule)).toBe(true);
    expect(isMessageRecipient(assignedB, rule)).toBe(false);
    expect(isMessageRecipient(available, rule)).toBe(false);
    expect(isMessageRecipient(ended, rule)).toBe(false);
    expect(isMessageRecipient(assignedB, { kind: 'polygons', polygonIds: ['pa', 'pb'] })).toBe(true);
  });

  it('sends to one searcher by id, unless their activity ended', () => {
    expect(isMessageRecipient(available, { kind: 'searcher', participantId: 'a' })).toBe(true);
    expect(isMessageRecipient(assignedA, { kind: 'searcher', participantId: 'a' })).toBe(false);
    expect(isMessageRecipient(ended, { kind: 'searcher', participantId: 'd' })).toBe(false);
  });
});

describe('recipientStatus', () => {
  it('follows the latest receipt', () => {
    expect(recipientStatus(empty)).toBe('sent');
    expect(recipientStatus({ ...empty, deliveredAt: t1 })).toBe('sent');
    expect(recipientStatus({ deliveredAt: t1, readAt: t1, acknowledgedAt: null })).toBe('read');
    expect(recipientStatus({ deliveredAt: t1, readAt: t1, acknowledgedAt: t2 })).toBe('acknowledged');
  });
});

describe('canRecordReceipt', () => {
  it('accepts an acknowledgement only for a critical message', () => {
    expect(canRecordReceipt('normal', 'acknowledged')).toBe(false);
    expect(canRecordReceipt('important', 'acknowledged')).toBe(false);
    expect(canRecordReceipt('critical', 'acknowledged')).toBe(true);
  });

  it('accepts delivery and reading for every message', () => {
    expect(canRecordReceipt('normal', 'delivered')).toBe(true);
    expect(canRecordReceipt('normal', 'read')).toBe(true);
    expect(canRecordReceipt('critical', 'read')).toBe(true);
  });
});

describe('applyReceipt', () => {
  it('fills the delivery and reading times for a first read', () => {
    expect(applyReceipt(empty, 'read', t1)).toEqual({ deliveredAt: t1, readAt: t1, acknowledgedAt: null });
  });

  it('fills all three times for an acknowledgement', () => {
    expect(applyReceipt(empty, 'acknowledged', t1)).toEqual({ deliveredAt: t1, readAt: t1, acknowledgedAt: t1 });
  });

  it('records delivery alone', () => {
    expect(applyReceipt(empty, 'delivered', t1)).toEqual({ deliveredAt: t1, readAt: null, acknowledgedAt: null });
  });

  it('returns the same object for an earlier receipt', () => {
    const read = applyReceipt(empty, 'read', t1);
    expect(applyReceipt(read, 'delivered', t2)).toBe(read);
  });

  it('keeps the first time of a repeated receipt', () => {
    const read = applyReceipt(empty, 'read', t1);
    expect(applyReceipt(read, 'read', t2)).toBe(read);
    expect(read.readAt).toBe(t1);
  });
});

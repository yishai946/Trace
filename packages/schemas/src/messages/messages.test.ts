import { describe, expect, it } from 'vitest';
import { MessageReceiptBody, SendMessageBody } from '.';
import { MissionEvent } from '../realtime';

const id = (n: number) => `0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0${n}`;

const failing = (body: unknown) => !SendMessageBody.safeParse(body).success;

describe('SendMessageBody', () => {
  const valid = { target: { kind: 'mission' }, urgency: 'normal', body: 'חזרו לכינוס' };

  it('accepts each kind of target', () => {
    expect(SendMessageBody.parse(valid).target).toEqual({ kind: 'mission' });
    const polygons = { kind: 'polygons', polygonIds: [id(1), id(2)] };
    expect(SendMessageBody.parse({ ...valid, target: polygons }).target).toEqual(polygons);
    const searcher = { kind: 'searcher', participantId: id(3) };
    expect(SendMessageBody.parse({ ...valid, target: searcher }).target).toEqual(searcher);
  });

  it('trims the body', () => {
    expect(SendMessageBody.parse({ ...valid, body: '  שלום  ' }).body).toBe('שלום');
  });

  it('refuses an empty, blank or too long body', () => {
    expect(failing({ ...valid, body: '' })).toBe(true);
    expect(failing({ ...valid, body: '   ' })).toBe(true);
    expect(failing({ ...valid, body: 'א'.repeat(2001) })).toBe(true);
    expect(failing({ ...valid, body: 'א'.repeat(2000) })).toBe(false);
  });

  it('refuses an unknown urgency or target kind', () => {
    expect(failing({ ...valid, urgency: 'urgent' })).toBe(true);
    expect(failing({ ...valid, target: { kind: 'team' } })).toBe(true);
  });

  it('refuses polygons with no ids or with duplicates', () => {
    expect(failing({ ...valid, target: { kind: 'polygons', polygonIds: [] } })).toBe(true);
    expect(failing({ ...valid, target: { kind: 'polygons', polygonIds: [id(1), id(1)] } })).toBe(true);
  });
});

describe('MessageReceiptBody', () => {
  it('accepts delivered, read and acknowledged but not sent', () => {
    expect(MessageReceiptBody.safeParse({ receipt: 'read' }).success).toBe(true);
    expect(MessageReceiptBody.safeParse({ receipt: 'sent' }).success).toBe(false);
  });
});

describe('MissionEvent messages', () => {
  const at = '2026-10-03T14:22:00+03:00';
  const recipient = {
    participantId: id(1),
    searcherId: id(2),
    callsign: 3,
    name: 'מיכל',
    status: 'sent',
    deliveredAt: null,
    readAt: null,
    acknowledgedAt: null,
  };
  const message = {
    id: id(4),
    missionId: id(5),
    urgency: 'critical',
    body: 'שלום',
    target: { kind: 'mission' },
    sentAt: at,
    recipients: [recipient],
  };
  const own = {
    id: id(4),
    missionId: id(5),
    urgency: 'critical',
    body: 'שלום',
    sentAt: at,
    requiresAcknowledgement: true,
    status: 'sent',
    deliveredAt: null,
    readAt: null,
    acknowledgedAt: null,
  };

  it('parses message.sent, message.received and message.receipt', () => {
    expect(MissionEvent.safeParse({ type: 'message.sent', missionId: id(5), message }).success).toBe(true);
    expect(
      MissionEvent.safeParse({ type: 'message.received', missionId: id(5), searcherId: id(2), message: own }).success,
    ).toBe(true);
    expect(
      MissionEvent.safeParse({ type: 'message.receipt', missionId: id(5), messageId: id(4), recipient }).success,
    ).toBe(true);
  });
});

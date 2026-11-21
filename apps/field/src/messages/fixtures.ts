import type { OwnMessage } from '@trace/schemas';

let counter = 0;

/** A normal message sent at 16:55 (UTC) that the searcher has not seen, unless the overrides say otherwise. */
export function makeMessage(overrides: Partial<OwnMessage> = {}): OwnMessage {
  counter += 1;
  return {
    id: `0190a3b2-7c4e-7a10-8a5e-${String(counter).padStart(12, '0')}`,
    missionId: '00000000-0000-4000-8000-000000000001',
    urgency: 'normal',
    body: 'מים וציוד עזרה ראשונה בחניון',
    sentAt: '2026-10-03T16:55:00.000Z',
    requiresAcknowledgement: false,
    status: 'sent',
    deliveredAt: null,
    readAt: null,
    acknowledgedAt: null,
    ...overrides,
  };
}

/** A critical message: it also asks for "אישרתי". */
export function makeCritical(overrides: Partial<OwnMessage> = {}): OwnMessage {
  return makeMessage({ urgency: 'critical', requiresAcknowledgement: true, body: 'חוזרים לחניון', ...overrides });
}

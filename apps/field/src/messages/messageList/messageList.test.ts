import { describe, expect, it } from 'vitest';
import { countNeedingAttention, needsAttention, upsertMessage } from '.';
import { makeCritical, makeMessage } from '../fixtures';

describe('upsertMessage', () => {
  it('keeps the newest first and replaces a message with the same id', () => {
    const old = makeMessage({ sentAt: '2026-10-03T16:00:00.000Z' });
    const recent = makeMessage({ sentAt: '2026-10-03T17:00:00.000Z' });
    const read = { ...old, status: 'read' as const };
    expect(upsertMessage([old], recent)).toEqual([recent, old]);
    expect(upsertMessage([recent, old], read)).toEqual([recent, read]);
  });
});

describe('needsAttention', () => {
  it('is true for an unread message and a critical one not yet acknowledged', () => {
    expect(needsAttention(makeMessage())).toBe(true);
    expect(needsAttention(makeCritical({ status: 'read' }))).toBe(true);
  });

  it('is false once a normal message was read or a critical one acknowledged', () => {
    expect(needsAttention(makeMessage({ status: 'read' }))).toBe(false);
    expect(needsAttention(makeCritical({ status: 'acknowledged' }))).toBe(false);
  });

  it('counts the messages that need it', () => {
    expect(countNeedingAttention([makeMessage(), makeMessage({ status: 'read' }), makeCritical()])).toBe(2);
  });
});

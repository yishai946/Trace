import { describe, expect, it } from 'vitest';
import { removeReport, upsertReport, upsertSos } from '.';
import { makeReport, makeSos } from '../fixtures';

describe('upsertReport', () => {
  it('adds an unknown report in its place, newest first', () => {
    const newer = makeReport({ reportedAt: '2026-10-03T17:00:00.000Z' });
    const older = makeReport({ reportedAt: '2026-10-03T16:00:00.000Z' });
    expect(upsertReport(older)([newer])).toEqual([newer, older]);
    expect(upsertReport(newer)([older])).toEqual([newer, older]);
  });

  it('replaces a report it already has, in place', () => {
    const first = makeReport();
    const second = makeReport({ reportedAt: '2026-10-03T16:00:00.000Z' });
    const handled = { ...first, status: 'handled' as const };
    expect(upsertReport(handled)([first, second])).toEqual([handled, second]);
  });

  it('leaves a list that is not loaded alone', () => {
    expect(upsertReport(makeReport())(undefined)).toBeUndefined();
  });
});

describe('removeReport', () => {
  it('removes only that report', () => {
    const a = makeReport();
    const b = makeReport();
    expect(removeReport(a.id)([a, b])).toEqual([b]);
  });
});

describe('upsertSos', () => {
  it('adds a new SOS and keeps the newest first', () => {
    const old = makeSos({ id: '00000000-0000-4000-8000-000000000001', activatedAt: '2026-10-03T10:00:00.000Z' });
    const fresh = makeSos({ id: '00000000-0000-4000-8000-000000000002' });
    expect(upsertSos(fresh)([old])?.map((s) => s.id)).toEqual([fresh.id, old.id]);
  });

  it('replaces an SOS it already has', () => {
    const active = makeSos();
    const closed = makeSos({ status: 'closed', closedAt: '2026-10-03T17:10:00.000Z' });
    const list = upsertSos(closed)([active]);
    expect(list).toHaveLength(1);
    expect(list?.[0]?.status).toBe('closed');
  });

  it('leaves a list that is not loaded alone', () => {
    expect(upsertSos(makeSos())(undefined)).toBeUndefined();
  });
});

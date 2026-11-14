import { describe, expect, it } from 'vitest';
import { isInMyPolygon, isMine, visibleReports } from '.';
import { assigned, makeReport, POLYGON_A, POLYGON_B } from '../fixtures';

const mine = makeReport({ reportedBy: { role: 'searcher', name: 'דנה', callsign: assigned.callsign } });

describe('isMine', () => {
  it('is true for a report of a searcher with my callsign', () => {
    expect(isMine(mine, assigned)).toBe(true);
    expect(isMine(makeReport(), assigned)).toBe(false);
  });

  it('is never true for the commander’s report', () => {
    const commander = makeReport({ reportedBy: { role: 'commander', name: 'מפקד', callsign: null } });
    expect(isMine(commander, assigned)).toBe(false);
    expect(isMine(commander, { callsign: 0 })).toBe(false);
  });
});

describe('isInMyPolygon', () => {
  it('needs an assigned searcher and the same polygon', () => {
    expect(isInMyPolygon(makeReport(), assigned)).toBe(true);
    expect(isInMyPolygon(makeReport({ polygonId: POLYGON_B }), assigned)).toBe(false);
    expect(isInMyPolygon(makeReport({ polygonId: null }), assigned)).toBe(false);
    expect(isInMyPolygon(makeReport(), { status: 'available', polygonId: null })).toBe(false);
    expect(isInMyPolygon(makeReport(), { status: 'ended', polygonId: POLYGON_A })).toBe(false);
  });
});

describe('visibleReports', () => {
  it('keeps the polygon’s reports and my own, newest first, and drops another polygon’s', () => {
    const older = makeReport({ reportedAt: '2026-10-03T16:00:00.000Z' });
    const newer = makeReport({ reportedAt: '2026-10-03T17:00:00.000Z' });
    const elsewhere = makeReport({ polygonId: POLYGON_B });
    const noPolygon = makeReport({ polygonId: null });
    const ownElsewhere = { ...mine, polygonId: POLYGON_B, reportedAt: '2026-10-03T16:30:00.000Z' };
    expect(visibleReports([older, elsewhere, noPolygon, ownElsewhere, newer], assigned)).toEqual([
      newer,
      ownElsewhere,
      older,
    ]);
  });

  it('shows an Available or ended searcher only their own', () => {
    const all = [makeReport(), mine];
    expect(visibleReports(all, { ...assigned, status: 'available', polygonId: null })).toEqual([mine]);
    expect(visibleReports(all, { ...assigned, status: 'ended' })).toEqual([mine]);
  });

  it('shows nothing without a participation', () => {
    expect(visibleReports([makeReport(), mine], null)).toEqual([]);
  });
});

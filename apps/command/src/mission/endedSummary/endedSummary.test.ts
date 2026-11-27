import { describe, expect, it } from 'vitest';
import { mission, participants } from '../fixtures';
import { coverageRows, endedAt, formatDuration, missionDuration, stillInField } from '.';

const located = {
  position: { type: 'Point' as const, coordinates: [35.01, 31.74] as [number, number] },
  locatedAt: '2026-11-08T11:34:00Z',
  note: null,
  endedAt: '2026-11-08T11:52:00Z',
};
const ended = { ...mission, status: 'ended_located' as const, createdAt: '2026-11-08T05:22:46Z', located };

describe('formatDuration', () => {
  it('shows hours, minutes and seconds with two digits each', () => {
    expect(formatDuration(((6 * 60 + 29) * 60 + 14) * 1000)).toBe('06:29:14');
    expect(formatDuration(0)).toBe('00:00:00');
  });
  it('does not go below zero', () => expect(formatDuration(-5000)).toBe('00:00:00'));
});

describe('endedAt and missionDuration', () => {
  it('reads the end time from the located or the stopped record', () => {
    expect(endedAt(ended)).toBe(located.endedAt);
    const stopped = { reason: 'other' as const, note: null, endedAt: '2026-11-08T09:00:00Z' };
    expect(endedAt({ ...ended, status: 'ended_stopped', located: null, stopped })).toBe(stopped.endedAt);
  });
  it('is null for a live mission', () => {
    expect(endedAt(mission)).toBeNull();
    expect(missionDuration(mission)).toBeNull();
  });
  it('counts from the creation to the end', () => expect(missionDuration(ended)).toBe('06:29:14'));
});

describe('coverageRows', () => {
  const polygon = (name: string, status: 'unassigned' | 'active' | 'completed', coverage: number | null) =>
    ({ id: name, name, status, coverage }) as never;
  it('rounds the coverage and says "לא שובץ" for an unassigned polygon', () => {
    const rows = coverageRows([
      polygon('א', 'active', 73.6),
      polygon('ב', 'unassigned', null),
      polygon('ג', 'completed', 100),
    ]);
    expect(rows).toEqual([
      { id: 'א', name: 'א', percent: 74, label: '74%', status: 'active' },
      { id: 'ב', name: 'ב', percent: null, label: 'לא שובץ', status: 'unassigned' },
      { id: 'ג', name: 'ג', percent: 100, label: '100%', status: 'completed' },
    ]);
  });
  it('does not invent a number for a polygon whose coverage was never computed', () => {
    expect(coverageRows([polygon('א', 'completed', null)])[0]).toMatchObject({ percent: null, label: 'טרם חושב' });
  });
});

describe('stillInField', () => {
  it('counts the searchers whose activity has not ended', () => {
    const done = participants.map((p) => ({ ...p, status: 'ended' as const }));
    expect(stillInField(done)).toBe(0);
    expect(stillInField([...done, { ...done[0]!, status: 'assigned' as const }])).toBe(1);
  });
});

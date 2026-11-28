import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EndedSummary } from '.';
import { eventSamples, mission, participants, polygonA, polygonB, reports, sosClosed } from '../fixtures';

const located = {
  position: { type: 'Point' as const, coordinates: [35.0139, 31.7418] as [number, number] },
  locatedAt: '2026-11-08T11:34:00Z',
  note: 'אותר בחיים',
  endedAt: '2026-11-08T11:52:00Z',
};
const endedLocated = { ...mission, status: 'ended_located' as const, createdAt: '2026-11-08T05:22:46Z', located };

function renderSummary(props: Partial<Parameters<typeof EndedSummary>[0]> = {}) {
  const onOpenTimeline = vi.fn();
  render(
    <EndedSummary
      mission={endedLocated}
      polygons={[
        { ...polygonA, status: 'active', coverage: 91.2 },
        { ...polygonB, status: 'unassigned', coverage: null },
      ]}
      participants={participants.map((p) => ({ ...p, status: 'ended' as const }))}
      reports={reports}
      sos={[sosClosed]}
      events={[eventSamples['mission.created'], eventSamples['mission.ended']]}
      onOpenTimeline={onOpenTimeline}
      {...props}
    />,
  );
  return { onOpenTimeline };
}

describe('EndedSummary', () => {
  it('shows the result, where and when the missing person was found, and how long it took', () => {
    renderSummary();
    const outcome = within(screen.getByRole('region', { name: 'תוצאה' }));
    expect(outcome.getByText('הנעדר אותר')).toBeInTheDocument();
    expect(outcome.getByText('אותר בחיים')).toBeInTheDocument();
    expect(outcome.getByText('06:29:14')).toBeInTheDocument();
    expect(outcome.getByText(/31\.7418/)).toBeInTheDocument();
  });

  it('shows the reason when the search was stopped', () => {
    renderSummary({
      mission: {
        ...endedLocated,
        status: 'ended_stopped',
        located: null,
        stopped: { reason: 'other', note: null, endedAt: located.endedAt },
      },
    });
    const outcome = within(screen.getByRole('region', { name: 'תוצאה' }));
    expect(outcome.getByText('החיפוש הופסק')).toBeInTheDocument();
    expect(outcome.queryByText('מיקום איתור')).not.toBeInTheDocument();
  });

  it('counts searchers, polygons, reports and SOS', () => {
    renderSummary();
    const counts = within(screen.getByRole('region', { name: 'מספרים סופיים' }));
    const value = (term: string) => counts.getByText(term).nextElementSibling?.textContent;
    expect(value('מחפשים')).toBe(String(participants.length));
    expect(value('פוליגונים')).toBe('2');
    expect(value('דיווחים')).toBe(String(reports.length));
    expect(value('SOS')).toBe('1, טופל');
  });

  it('shows the final coverage of each polygon, and says an unassigned one was never assigned', () => {
    renderSummary();
    const coverage = within(screen.getByRole('region', { name: 'כיסוי סופי' }));
    expect(coverage.getByText('91%')).toBeInTheDocument();
    expect(coverage.getByText('לא שובץ')).toBeInTheDocument();
    expect(coverage.getByRole('progressbar', { name: `כיסוי ${polygonA.name}` })).toHaveAttribute(
      'aria-valuenow',
      '91',
    );
  });

  it('says so when the mission had no polygons', () => {
    renderSummary({ polygons: [] });
    expect(screen.getByText('לא הוגדרו פוליגונים במסע.')).toBeInTheDocument();
  });

  it('lists the key events and opens the full Timeline', () => {
    const { onOpenTimeline } = renderSummary();
    expect(within(screen.getByRole('region', { name: 'אירועי מפתח' })).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'ציר זמן מלא' }));
    expect(onOpenTimeline).toHaveBeenCalled();
  });

  it('has no edit actions, and notes the searchers still in the field', () => {
    renderSummary({ participants: participants.map((p) => ({ ...p, status: 'assigned' as const })) });
    expect(screen.getByText(new RegExp(`${participants.length} עדיין בשטח`))).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['ציר זמן מלא']);
  });

  it('shows dashes and a notice, not zeros, while the data is unavailable', () => {
    renderSummary({ polygons: undefined, participants: undefined, reports: undefined, sos: undefined });
    const counts = within(screen.getByRole('region', { name: 'מספרים סופיים' }));
    expect(counts.getAllByText('—')).toHaveLength(4);
    expect(
      within(screen.getByRole('region', { name: 'כיסוי סופי' })).getByText('הנתונים אינם זמינים כרגע.'),
    ).toBeInTheDocument();
  });

  it('says the events are unavailable while the Timeline is not loaded', () => {
    renderSummary({ events: undefined });
    expect(screen.getByText('הנתונים אינם זמינים כרגע.')).toBeInTheDocument();
  });
});

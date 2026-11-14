import { fireEvent, render, screen } from '@testing-library/react';
import type { Participant } from '@trace/schemas';
import { describe, expect, it, vi } from 'vitest';
import { MissionSheet } from '.';
import { participants, polygonA, polygonB, reportFinding, reportHazard, reports } from '../fixtures';

function renderSheet(props: Partial<Parameters<typeof MissionSheet>[0]> = {}) {
  const onTabChange = vi.fn();
  const onExpandedChange = vi.fn();
  render(
    <MissionSheet
      tab="alerts"
      onTabChange={onTabChange}
      expanded
      onExpandedChange={onExpandedChange}
      participants={participants}
      participantsFailed={false}
      polygons={[polygonA, polygonB]}
      reports={reports}
      reportsFailed={false}
      onOpenReport={vi.fn()}
      {...props}
    />,
  );
  return { onTabChange, onExpandedChange };
}

describe('MissionSheet', () => {
  it('shows the three tabs with their counts, on alerts, with a truthful empty state', () => {
    renderSheet();
    expect(screen.getByRole('tab', { name: 'התראות', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'מחפשים 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'דיווחים 2' })).toBeInTheDocument();
    expect(screen.getByText('ההתראות יוצגו כאן בקרוב.')).toBeInTheDocument();
  });

  it('lists the searchers by callsign with their status and polygon', () => {
    renderSheet({ tab: 'searchers' });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('04');
    expect(rows[0]).toHaveTextContent('דנה כהן');
    expect(rows[0]).toHaveTextContent('משובץ');
    expect(rows[0]).toHaveTextContent('ואדי צפוני');
    expect(rows[1]).toHaveTextContent('09');
    expect(rows[1]).toHaveTextContent('מיכל פרץ');
    expect(rows[1]).toHaveTextContent('זמין');
  });

  it('sorts searchers by callsign', () => {
    renderSheet({ tab: 'searchers', participants: [...participants].reverse() });
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('דנה כהן');
  });

  it('leaves out searchers who ended', () => {
    const ended: Participant[] = participants.map((p) => ({ ...p, status: 'ended', polygonId: null }));
    renderSheet({ tab: 'searchers', participants: ended });
    expect(screen.getByRole('tab', { name: 'מחפשים 0' })).toBeInTheDocument();
    expect(screen.getByText('עוד לא הצטרפו מחפשים.')).toBeInTheDocument();
  });

  it('shows loading, then the error, when the searchers do not arrive', () => {
    renderSheet({ tab: 'searchers', participants: undefined });
    expect(screen.getByRole('tab', { name: 'מחפשים' })).toBeInTheDocument();
    expect(screen.getByText('טוען מחפשים…')).toBeInTheDocument();
  });

  it('shows the error when loading the searchers failed', () => {
    renderSheet({ tab: 'searchers', participants: undefined, participantsFailed: true });
    expect(screen.getByText('לא ניתן לטעון מחפשים מהשרת.')).toBeInTheDocument();
  });

  it('shows an assigned searcher without a polygon name when the polygon is unknown', () => {
    renderSheet({ tab: 'searchers', polygons: [] });
    const row = screen.getAllByRole('listitem')[0];
    expect(row).toHaveTextContent('משובץ');
    expect(row).not.toHaveTextContent('ואדי צפוני');
  });

  it('MS1: counts the New reports on the tab', () => {
    renderSheet();
    expect(screen.getByRole('tab', { name: 'דיווחים 2' })).toBeInTheDocument();
  });

  it('MS2: shows no count while loading or when every report is handled', () => {
    const { unmount } = render(
      <MissionSheet
        tab="alerts"
        onTabChange={vi.fn()}
        expanded
        onExpandedChange={vi.fn()}
        participants={participants}
        participantsFailed={false}
        polygons={[]}
        reports={undefined}
        reportsFailed={false}
        onOpenReport={vi.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'דיווחים' })).toBeInTheDocument();
    unmount();
    renderSheet({ reports: [reportHazard] });
    expect(screen.getByRole('tab', { name: 'דיווחים' })).toBeInTheDocument();
  });

  it('MS3: lists the reports newest first and opens one', () => {
    const onOpenReport = vi.fn();
    renderSheet({ tab: 'reports', onOpenReport });
    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('הנעדר אותר');
    expect(rows[1]).toHaveTextContent('כפפה אפורה ליד השביל');
    expect(rows[2]).toHaveTextContent('מדרון חלק');
    fireEvent.click(rows[1]!);
    expect(onOpenReport).toHaveBeenCalledWith(reportFinding.id);
  });

  it('MS4: says when the reports are loading, failed or empty', () => {
    const { unmount } = render(
      <MissionSheet
        tab="reports"
        onTabChange={vi.fn()}
        expanded
        onExpandedChange={vi.fn()}
        participants={participants}
        participantsFailed={false}
        polygons={[]}
        reports={undefined}
        reportsFailed={false}
        onOpenReport={vi.fn()}
      />,
    );
    expect(screen.getByText('טוען דיווחים…')).toBeInTheDocument();
    unmount();
    const failed = render(
      <MissionSheet
        tab="reports"
        onTabChange={vi.fn()}
        expanded
        onExpandedChange={vi.fn()}
        participants={participants}
        participantsFailed={false}
        polygons={[]}
        reports={undefined}
        reportsFailed
        onOpenReport={vi.fn()}
      />,
    );
    expect(screen.getByText('לא ניתן לטעון את הדיווחים מהשרת.')).toBeInTheDocument();
    failed.unmount();
    renderSheet({ tab: 'reports', reports: [] });
    expect(screen.getByText('עוד לא התקבלו דיווחים במסע הזה.')).toBeInTheDocument();
  });

  it('reports a tab change', () => {
    const { onTabChange } = renderSheet();
    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים 2' }));
    expect(onTabChange).toHaveBeenCalledWith('reports');
  });

  it('collapses and expands from the grab button', () => {
    const { onExpandedChange } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'הקטנת הגיליון', expanded: true }));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('shows only the grab button when collapsed', () => {
    const { onExpandedChange } = renderSheet({ expanded: false });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הרחבת הגיליון', expanded: false }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });
});

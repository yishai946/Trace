import { fireEvent, render, screen } from '@testing-library/react';
import type { Participant } from '@trace/schemas';
import { describe, expect, it, vi } from 'vitest';
import { MissionSheet } from '.';
import { participants, polygonA, polygonB } from '../fixtures';

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
    expect(screen.getByRole('tab', { name: 'דיווחים' })).toBeInTheDocument();
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

  it('shows the reports empty state', () => {
    renderSheet({ tab: 'reports' });
    expect(screen.getByText('הדיווחים יוצגו כאן בקרוב. אפשר לראות אותם במחשב.')).toBeInTheDocument();
  });

  it('reports a tab change', () => {
    const { onTabChange } = renderSheet();
    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים' }));
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

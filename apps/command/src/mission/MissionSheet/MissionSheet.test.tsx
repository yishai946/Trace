import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionSheet, type MissionSheetProps } from '.';
import { participants, polygonA } from '../fixtures';

function renderSheet(overrides: Partial<MissionSheetProps> = {}) {
  const props: MissionSheetProps = {
    tab: 'searchers',
    onTabChange: vi.fn(),
    expanded: true,
    onExpandedChange: vi.fn(),
    participants,
    polygons: [polygonA],
    ...overrides,
  };
  render(<MissionSheet {...props} />);
  return props;
}

describe('MissionSheet', () => {
  it('lists the searchers by callsign with their polygon or that they wait for one', () => {
    renderSheet();
    const rows = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('04');
    expect(rows[0]).toHaveTextContent('דנה כהן');
    expect(rows[0]).toHaveTextContent('ואדי צפוני');
    expect(rows[1]).toHaveTextContent('מיכל פרץ');
    expect(rows[1]).toHaveTextContent('ממתין לשיבוץ');
    expect(screen.getByRole('tab', { name: 'מחפשים 2' })).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves out searchers whose participation ended', () => {
    renderSheet({ participants: participants.map((p) => ({ ...p, status: 'ended' as const })) });
    expect(screen.getByRole('tab', { name: 'מחפשים 0' })).toBeTruthy();
    expect(screen.getByText(/עוד לא הצטרפו מחפשים/)).toBeTruthy();
  });

  it('shows empty alerts and reports until their use cases fill them', () => {
    renderSheet({ tab: 'alerts' });
    expect(screen.getByText('אין התראות פתוחות.')).toBeTruthy();
  });

  it('switches tab and expands the sheet', () => {
    const props = renderSheet({ tab: 'alerts', expanded: false });
    expect(screen.queryByRole('tabpanel')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים 0' }));
    expect(props.onTabChange).toHaveBeenCalledWith('reports');
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('collapses from its handle', () => {
    const props = renderSheet();
    const handle = screen.getByRole('button', { name: 'הקטנת הגיליון' });
    expect(handle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(handle);
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
  });
});

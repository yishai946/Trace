import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionMap } from '.';
import { toMissionArea } from '../../mission/missionArea';
import { ThemeProvider } from '../../theme';

describe('MissionMap on the web', () => {
  it('stands in for the native map with a labelled area', () => {
    render(<MissionMap area={toMissionArea([])} />, { wrapper: ThemeProvider });
    expect(screen.getByRole('img', { name: 'מפת המסע' })).toBeInTheDocument();
  });

  it('names the map as asked and shows the marker label', () => {
    render(
      <MissionMap
        area={toMissionArea([])}
        accessibilityLabel="מפת מיקום התצפית"
        marker={{ position: [35.0139, 31.7412], label: 'תצפית' }}
      />,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByRole('img', { name: 'מפת מיקום התצפית' })).toBeInTheDocument();
    expect(screen.getByText('תצפית')).toBeInTheDocument();
  });

  const reports = [
    { id: 'r1', position: [35.0, 31.7] as [number, number], time: '16:44', hazard: true },
    { id: 'r2', position: [35.01, 31.71] as [number, number], time: '17:01', hazard: false },
    { id: 'r3', position: [35.02, 31.72] as [number, number], time: '17:10', hazard: false, located: true },
  ];

  it('shows each report as a button named by its kind and time, and tells which was pressed', () => {
    const onPressReport = vi.fn();
    render(<MissionMap area={toMissionArea([], undefined, null, reports)} onPressReport={onPressReport} />, {
      wrapper: ThemeProvider,
    });
    expect(screen.getByRole('button', { name: 'דיווח מפגע 16:44' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'דיווח 17:01' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'דיווח הנעדר אותר 17:10' }));
    expect(onPressReport).toHaveBeenCalledWith('r3');
  });

  it('marks the selected report', () => {
    render(<MissionMap area={toMissionArea([], undefined, null, reports)} selectedReportId="r2" />, {
      wrapper: ThemeProvider,
    });
    expect(screen.getByRole('button', { name: 'דיווח 17:01' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'דיווח מפגע 16:44' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows no report buttons without reports', () => {
    render(<MissionMap area={toMissionArea([])} />, { wrapper: ThemeProvider });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

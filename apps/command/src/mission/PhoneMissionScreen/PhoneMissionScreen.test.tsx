import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhoneMissionScreen } from '.';
import { mission, participants, polygonA, polygonB } from '../fixtures';

function renderScreen(props: Partial<Parameters<typeof PhoneMissionScreen>[0]> = {}) {
  const onJoinOpenChange = vi.fn();
  render(
    <PhoneMissionScreen
      mission={mission}
      missions={[mission]}
      connection={{ state: 'up', label: 'זמין', detail: 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' }}
      onSelectMission={vi.fn()}
      onShowAll={vi.fn()}
      joinOpen={false}
      onJoinOpenChange={onJoinOpenChange}
      notice={null}
      participants={participants}
      participantsFailed={false}
      polygons={[polygonA, polygonB]}
      workspace={<div>המפה</div>}
      renderSearch={(close) => <button onClick={close}>בחר מקום</button>}
      {...props}
    />,
  );
  return { onJoinOpenChange };
}

describe('PhoneMissionScreen', () => {
  it('shows the map, a compact bar, the sheet and the tab bar', () => {
    renderScreen();
    expect(screen.getByText('המפה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מסע: נועם אברהם, פעיל/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'זמין. מחובר לשרת. המפה מתעדכנת בזמן אמת.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'קוד הצטרפות K7-4Q2', expanded: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'חיפוש מקום', expanded: false })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'תצוגה' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' })).toBeInTheDocument();
  });

  it('opens the searchers tab from the tab bar', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('link', { name: 'מחפשים' }));
    expect(screen.getByRole('tab', { name: 'מחפשים 2', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'מחפשים' })).toHaveAttribute('aria-current', 'page');
  });

  it('follows a tab chosen in the sheet in the tab bar', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים 0' }));
    expect(screen.getByRole('link', { name: 'דיווחים' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'לוח' })).not.toHaveAttribute('aria-current');
  });

  it('expands the sheet on alerts from the board item after it was collapsed', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'הקטנת הגיליון' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'לוח' }));
    expect(screen.getByRole('tab', { name: 'התראות 0', selected: true })).toBeInTheDocument();
  });

  it('opens the place search and the join code one at a time', () => {
    const { onJoinOpenChange } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'חיפוש מקום' }));
    expect(screen.getByRole('button', { name: 'בחר מקום' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'חיפוש מקום' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'קוד הצטרפות K7-4Q2' }));
    expect(onJoinOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'בחר מקום' })).not.toBeInTheDocument();
  });

  it('closes the join code when the search opens', () => {
    const { onJoinOpenChange } = renderScreen({ joinOpen: true });
    expect(screen.getByRole('region', { name: 'קוד הצטרפות' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'חיפוש מקום' }));
    expect(onJoinOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes the search once a place is chosen', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'חיפוש מקום' }));
    fireEvent.click(screen.getByRole('button', { name: 'בחר מקום' }));
    expect(screen.queryByRole('button', { name: 'בחר מקום' })).not.toBeInTheDocument();
  });

  it('shows a notice as an alert', () => {
    renderScreen({ notice: 'המסע נוצר, אבל התמונה לא נשמרה.' });
    expect(screen.getByRole('alert')).toHaveTextContent('המסע נוצר, אבל התמונה לא נשמרה.');
  });
});

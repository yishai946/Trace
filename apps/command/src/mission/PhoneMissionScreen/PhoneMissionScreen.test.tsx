import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PhoneMissionScreen } from '.';
import { mission, participants, polygonA, polygonB, reportFinding, reportLocated, reports } from '../fixtures';

type Props = Parameters<typeof PhoneMissionScreen>[0];

/** Holds which screen is showing, the way the console does. */
function Harness(props: Props) {
  const [screen, setScreen] = useState<Props['screen']>(props.screen);
  return <PhoneMissionScreen {...props} screen={screen} onScreenChange={setScreen} />;
}

function renderScreen(props: Partial<Props> = {}) {
  const onJoinOpenChange = vi.fn();
  const onOpenReport = vi.fn();
  const view = render(
    <Harness
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
      screen="map"
      onScreenChange={vi.fn()}
      reportsScreen={<div>מסך הדיווחים</div>}
      reports={reports}
      reportsFailed={false}
      onOpenReport={onOpenReport}
      {...props}
    />,
  );
  return { onJoinOpenChange, onOpenReport, ...view };
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
    fireEvent.click(screen.getByRole('tab', { name: 'מחפשים 2' }));
    expect(screen.getByRole('link', { name: 'מחפשים' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים 2' }));
    expect(screen.getByRole('link', { name: 'דיווחים, 2 חדשים' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'לוח' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('מסך הדיווחים')).not.toBeInTheDocument();
  });

  it('expands the sheet on alerts from the board item after it was collapsed', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'הקטנת הגיליון' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'לוח' }));
    expect(screen.getByRole('tab', { name: 'התראות', selected: true })).toBeInTheDocument();
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
    renderScreen({ notice: 'המסע נוצר, אבל התמונה לא נשמרה.', reports: [reportFinding] });
    expect(screen.getByRole('alert')).toHaveTextContent('המסע נוצר, אבל התמונה לא נשמרה.');
  });

  it('PM1: the reports item shows the Reports screen in place of the map', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('link', { name: 'דיווחים, 2 חדשים' }));
    expect(screen.getByText('מסך הדיווחים')).toBeInTheDocument();
    expect(screen.queryByText('המפה')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'דיווחים, 2 חדשים' })).toHaveAttribute('aria-current', 'page');
  });

  it('PM2: from the Reports screen, the board and searchers items go back to the map', () => {
    renderScreen({ screen: 'reports' });
    fireEvent.click(screen.getByRole('link', { name: 'לוח' }));
    expect(screen.getByText('המפה')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'התראות', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'דיווחים, 2 חדשים' }));
    fireEvent.click(screen.getByRole('link', { name: 'מחפשים' }));
    expect(screen.getByText('המפה')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'מחפשים 2', selected: true })).toBeInTheDocument();
  });

  it('PM3: shows the critical alert compact on the map, and not on the Reports screen', () => {
    const { onOpenReport, unmount } = renderScreen();
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(alert).toHaveAttribute('data-compact');
    expect(alert.textContent).not.toContain('הדיווח אינו סוגר את המסע');
    fireEvent.click(within(alert).getByRole('button', { name: 'פתח' }));
    expect(onOpenReport).toHaveBeenCalledWith(reportLocated.id);
    unmount();

    renderScreen({ reports: [reportFinding] });
    expect(screen.queryByRole('alert', { name: 'התראה קריטית' })).not.toBeInTheDocument();
  });

  it('PM3: no alert on the Reports screen', () => {
    renderScreen({ screen: 'reports' });
    expect(screen.queryByRole('alert', { name: 'התראה קריטית' })).not.toBeInTheDocument();
  });

  it('PM4: a row in the sheet opens its report', () => {
    const { onOpenReport } = renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'דיווחים 2' }));
    fireEvent.click(screen.getByRole('link', { name: /כפפה אפורה ליד השביל/ }));
    expect(onOpenReport).toHaveBeenCalledWith(reportFinding.id);
  });

  it('PM5: a located report that arrives shows the alert', () => {
    const view = renderScreen({ reports: [reportFinding] });
    expect(screen.queryByRole('alert', { name: 'התראה קריטית' })).not.toBeInTheDocument();
    view.rerender(
      <Harness
        mission={mission}
        missions={[mission]}
        connection={{ state: 'up', label: 'זמין', detail: 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' }}
        onSelectMission={vi.fn()}
        onShowAll={vi.fn()}
        joinOpen={false}
        onJoinOpenChange={vi.fn()}
        notice={null}
        participants={participants}
        participantsFailed={false}
        polygons={[polygonA, polygonB]}
        workspace={<div>המפה</div>}
        renderSearch={() => null}
        screen="map"
        onScreenChange={vi.fn()}
        reportsScreen={<div>מסך הדיווחים</div>}
        reports={reports}
        reportsFailed={false}
        onOpenReport={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert', { name: 'התראה קריטית' })).toBeInTheDocument();
  });

  it('PM6: shows no critical alert once the mission ended', () => {
    renderScreen({ mission: { ...mission, status: 'ended_stopped' } });
    expect(screen.queryByRole('alert', { name: 'התראה קריטית' })).not.toBeInTheDocument();
  });
});

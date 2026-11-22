import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineDownload } from '.';
import { useOfflineState } from '../../offline/state';
import type { OfflineStep } from '../../offline/store';
import { useSession } from '../../state/session';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

const MISSION = '00000000-0000-4000-8000-000000000001';

function showing(saved: OfflineStep[], extra: { failed?: boolean; loaded?: boolean } = {}) {
  useSession.setState({ missionId: MISSION });
  useOfflineState.setState({ missionId: MISSION, saved, loaded: true, running: false, failed: false, ...extra });
  return render(<OfflineDownload />, { wrapper: TestProviders });
}

afterEach(() => {
  usePreferences.setState(usePreferences.getInitialState());
  useSession.setState({ missionId: null });
  useOfflineState.setState({ missionId: null, saved: [], loaded: false, failed: false });
});

describe('OfflineDownload', () => {
  it('shows nothing until the device says what it holds', () => {
    showing([], { loaded: false });
    expect(screen.queryByText('הורדת מידע ללא חיבור')).not.toBeInTheDocument();
  });

  it('shows the progress while downloading', () => {
    showing(['mission']);
    expect(screen.getByText('הורדת מידע ללא חיבור')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'התקדמות ההורדה' })).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText(/33.%/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'נסה שוב' })).not.toBeInTheDocument();
  });

  it('says the download was cut off and offers to try again', () => {
    showing(['mission'], { failed: true });
    expect(screen.getByText(/ההורדה נקטעה/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(useOfflineState.getState().attempt).toBeGreaterThan(0);
  });

  it('says the device is ready for Offline when everything is saved', () => {
    showing(['mission', 'photo', 'polygons']);
    expect(screen.getByText('מוכן ל-Offline')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each(['night', 'day'] as const)('uses the %s theme colors for the progress', (id) => {
    usePreferences.setState({ themePreference: id });
    showing(['mission']);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({
      backgroundColor: themes[id].color.accent,
    });
  });
});

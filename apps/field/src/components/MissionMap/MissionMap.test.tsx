import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});

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
});

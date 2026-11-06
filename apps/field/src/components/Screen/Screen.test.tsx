import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { Screen } from '.';
import { ThemeProvider } from '../../theme';

describe('Screen', () => {
  it('names the screen with a heading and lays it out right to left', () => {
    render(
      <Screen title="המסעות שלי">
        <Text>תוכן</Text>
      </Screen>,
      { wrapper: ThemeProvider },
    );

    expect(screen.getByRole('heading', { name: 'המסעות שלי' })).toBeInTheDocument();
    expect(screen.getByTestId('screen')).toHaveStyle({ direction: 'rtl' });
  });
});

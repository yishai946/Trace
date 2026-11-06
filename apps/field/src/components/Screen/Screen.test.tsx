import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { describe, expect, it } from 'vitest';
import { Screen } from '.';
import { ThemeProvider } from '../../theme';

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={
        initialWindowMetrics ?? {
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }
      }
    >
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('Screen', () => {
  it('names the screen with a heading', () => {
    render(
      <Screen title="המסעות שלי">
        <Text>תוכן</Text>
      </Screen>,
      { wrapper: Providers },
    );

    expect(screen.getByRole('heading', { name: 'המסעות שלי' })).toBeInTheDocument();
  });
});

import { spacing } from '@trace/design';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { describe, expect, it } from 'vitest';
import { Screen } from '.';
import { ThemeProvider } from '../../theme';

const HOME_INDICATOR = 34;

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: HOME_INDICATOR },
      }}
    >
      {/* The web provider measures the page (zero in jsdom); a phone with a home indicator reports its inset here. */}
      <SafeAreaInsetsContext.Provider value={{ top: 47, left: 0, right: 0, bottom: HOME_INDICATOR }}>
        <ThemeProvider>{children}</ThemeProvider>
      </SafeAreaInsetsContext.Provider>
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

  it('puts the leading action before the title, then the end action', () => {
    render(
      <Screen title="דיווח חדש" leading={<Text>ביטול</Text>} action={<Text>עזרה</Text>}>
        <Text>תוכן</Text>
      </Screen>,
      { wrapper: Providers },
    );
    const bar = screen.getByRole('heading', { name: 'דיווח חדש' }).parentElement;
    expect(bar?.textContent).toBe('ביטולדיווח חדשעזרה');
  });

  it('keeps the footer above the home indicator', () => {
    render(
      <Screen title="כניסה" footer={<Text>אמת והמשך</Text>}>
        <Text>תוכן</Text>
      </Screen>,
      { wrapper: Providers },
    );
    expect(screen.getByTestId('screen-footer')).toHaveStyle({
      paddingBottom: `${spacing.space6 + HOME_INDICATOR}px`,
    });
  });

  it('leaves the bottom inset to the tab bar on mission screens', () => {
    render(
      <Screen title="דיווחים" tabbed footer={<Text>דיווח חדש</Text>}>
        <Text>תוכן</Text>
      </Screen>,
      { wrapper: Providers },
    );
    expect(screen.getByTestId('screen-footer')).toHaveStyle({ paddingBottom: `${spacing.space6}px` });
  });

  it('can hold content that fills the screen instead of scrolling', () => {
    render(
      <Screen title="דיווחים" scroll={false}>
        <Text>מפה</Text>
      </Screen>,
      { wrapper: Providers },
    );
    expect(screen.getByRole('heading', { name: 'דיווחים' })).toBeInTheDocument();
    expect(screen.getByText('מפה')).toBeInTheDocument();
  });
});

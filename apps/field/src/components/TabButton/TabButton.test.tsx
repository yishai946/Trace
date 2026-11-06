import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabButton } from '.';
import { ThemeProvider } from '../../theme';

describe('TabButton', () => {
  it('is a real link to its screen, marked as the current page when focused', () => {
    render(
      <>
        <TabButton label="מסע" icon="mission" href="/map" isFocused />
        <TabButton label="הודעות" icon="messages" href="/messages" />
      </>,
      { wrapper: ThemeProvider },
    );

    const current = screen.getByRole('link', { name: 'מסע' });
    expect(current.tagName).toBe('A');
    expect(current).toHaveAttribute('href', '/map');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'הודעות' })).not.toHaveAttribute('aria-current');
  });

  it('keeps its own column layout when the tab trigger passes its row style', () => {
    // Expo Router's TabTrigger (asChild) hands its child `style: { flexDirection: 'row', ... }`.
    const triggerProps = { style: { flexDirection: 'row', justifyContent: 'space-between' } } as object;
    render(<TabButton label="מסע" icon="mission" href="/map" {...triggerProps} />, { wrapper: ThemeProvider });

    expect(screen.getByRole('link', { name: 'מסע' })).toHaveStyle({
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '44px',
    });
  });

  it('navigates on press without letting the browser reload the page', () => {
    const onPress = vi.fn();
    render(<TabButton label="SOS" icon="sos" href="/sos" tone="danger" onPress={onPress} />, {
      wrapper: ThemeProvider,
    });

    const link = screen.getByRole('link', { name: 'SOS' });
    const notPrevented = fireEvent.click(link);
    expect(onPress).toHaveBeenCalledOnce();
    expect(notPrevented).toBe(false);
  });

  it('keeps SOS in its danger color, also when it is the current tab', () => {
    render(<TabButton label="SOS" icon="sos" href="/sos" tone="danger" isFocused />, { wrapper: ThemeProvider });
    expect(screen.getByText('SOS')).toHaveStyle({ color: themes.day.color.dangerInk });
  });
});

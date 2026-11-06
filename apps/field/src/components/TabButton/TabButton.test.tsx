import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabButton } from '.';
import { ThemeProvider } from '../../theme';

describe('TabButton', () => {
  it('is a link named by its label that marks the current screen', () => {
    render(
      <>
        <TabButton label="מסע" icon="mission" isFocused />
        <TabButton label="הודעות" icon="messages" />
      </>,
      { wrapper: ThemeProvider },
    );

    expect(screen.getByRole('link', { name: 'מסע' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'הודעות' })).toHaveAttribute('aria-selected', 'false');
  });

  it('navigates on press', () => {
    const onPress = vi.fn();
    render(<TabButton label="SOS" icon="sos" tone="danger" onPress={onPress} />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('link', { name: 'SOS' }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

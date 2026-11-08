import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeSelect } from '.';
import { ThemeProvider } from '../../theme/theme';

function renderSelect(layout: 'stacked' | 'row' = 'stacked') {
  render(
    <ThemeProvider>
      <ThemeSelect layout={layout} />
    </ThemeProvider>,
  );
}

function choose(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /ערכת צבעים/ }));
  fireEvent.click(screen.getByRole('option', { name }));
}

describe('ThemeSelect', () => {
  afterEach(() => localStorage.clear());

  it('chooses the day theme', () => {
    renderSelect();
    choose('יום');
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('trace.theme')).toBe('day');
  });

  it('chooses the night theme', () => {
    renderSelect();
    choose('לילה');
    expect(document.documentElement.dataset.theme).toBe('night');
    expect(localStorage.getItem('trace.theme')).toBe('night');
  });

  it('follows the device', () => {
    renderSelect();
    choose('יום');
    choose('לפי המכשיר');
    expect(localStorage.getItem('trace.theme')).toBe('system');
  });

  it('marks its layout', () => {
    renderSelect('row');
    expect(screen.getByRole('button', { name: /ערכת צבעים/ }).closest('[data-layout]')).toHaveAttribute(
      'data-layout',
      'row',
    );
  });
});

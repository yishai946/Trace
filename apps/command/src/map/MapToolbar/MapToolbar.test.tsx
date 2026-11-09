import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapToolbar } from '.';

const base = {
  tool: 'select' as const,
  onToolChange: vi.fn(),
  terrain: { hillshade: true, contours: true, terrain3d: false },
  onTerrainChange: vi.fn(),
};

describe('MapToolbar sighting tool', () => {
  it('is disabled without a handler, as when offline or after the mission ended', () => {
    render(<MapToolbar {...base} />);
    expect(screen.getByRole('button', { name: 'הוסף תצפית' }).hasAttribute('disabled')).toBe(true);
  });

  it('starts adding a sighting and shows as pressed while active', () => {
    const onSighting = vi.fn();
    const { rerender } = render(<MapToolbar {...base} onSighting={onSighting} />);
    const tool = screen.getByRole('button', { name: 'הוסף תצפית' });
    expect(tool.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tool);
    expect(onSighting).toHaveBeenCalledOnce();
    rerender(<MapToolbar {...base} onSighting={onSighting} sightingActive />);
    expect(screen.getByRole('button', { name: 'הוסף תצפית' }).getAttribute('aria-pressed')).toBe('true');
  });
});

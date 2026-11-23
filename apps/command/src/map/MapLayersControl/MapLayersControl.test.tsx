import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapLayersControl } from '.';

const open = () => fireEvent.click(screen.getByRole('button', { name: /שכבות/ }));

describe('MapLayersControl', () => {
  it('names the current base on the button', () => {
    render(<MapLayersControl view={{ base: 'map', color: 'bw' }} onChange={vi.fn()} satelliteAvailable />);
    expect(screen.getByRole('button', { name: 'שכבות · שחור־לבן' })).toBeTruthy();
  });

  it('switches to satellite and keeps the color choice', () => {
    const onChange = vi.fn();
    render(<MapLayersControl view={{ base: 'map', color: 'color' }} onChange={onChange} satelliteAvailable />);
    open();
    expect(screen.getByRole('radio', { name: 'מפה' })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('radio', { name: 'לוויין' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'satellite', color: 'color' });
  });

  it('switches between colored and black and white', () => {
    const onChange = vi.fn();
    render(<MapLayersControl view={{ base: 'map', color: 'bw' }} onChange={onChange} satelliteAvailable />);
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'צבעונית' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'map', color: 'color' });
  });

  it('turns the color choice off over satellite imagery', () => {
    render(<MapLayersControl view={{ base: 'satellite', color: 'bw' }} onChange={vi.fn()} satelliteAvailable />);
    expect(screen.getByRole('button', { name: 'שכבות · לוויין' })).toBeTruthy();
    open();
    expect(screen.getByRole('radio', { name: 'צבעונית' })).toHaveProperty('disabled', true);
  });

  it('offers no satellite when the provider has none', () => {
    render(<MapLayersControl view={{ base: 'map', color: 'bw' }} onChange={vi.fn()} satelliteAvailable={false} />);
    open();
    expect(screen.getByRole('radio', { name: 'לוויין' })).toHaveProperty('disabled', true);
  });
});

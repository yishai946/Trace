import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapView } from '@trace/map';
import { MapLayersControl } from '.';

const open = () => fireEvent.mouseEnter(screen.getByRole('button', { name: /שכבות/ }).parentElement as Element);
const tile = 'https://tiles.example/13/4897/3300.jpg';

const renderControl = (view: MapView = { base: 'map', color: 'bw' }, onChange = vi.fn(), satelliteTile = tile) =>
  render(<MapLayersControl view={view} onChange={onChange} themeId="day" satelliteTile={satelliteTile} />);

describe('MapLayersControl', () => {
  it('offers satellite on the tile over a map, and a click switches to it', () => {
    const onChange = vi.fn();
    renderControl({ base: 'map', color: 'color' }, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'שכבות: עבור ללוויין' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'satellite', color: 'color' });
  });

  it('offers the map back over satellite', () => {
    const onChange = vi.fn();
    renderControl({ base: 'satellite', color: 'bw' }, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'שכבות: עבור לשחור־לבן' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'map', color: 'bw' });
  });

  it('offers colored, black and white and satellite as one choice', () => {
    renderControl({ base: 'map', color: 'color' });
    open();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'צבעונית' })).toHaveProperty('checked', true);
  });

  it('switches to satellite', () => {
    const onChange = vi.fn();
    renderControl({ base: 'map', color: 'color' }, onChange);
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'לוויין' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'satellite', color: 'color' });
  });

  it('switches from satellite back to a map style', () => {
    const onChange = vi.fn();
    renderControl({ base: 'satellite', color: 'color' }, onChange);
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'שחור־לבן' }));
    expect(onChange).toHaveBeenCalledWith({ base: 'map', color: 'bw' });
  });

  it('offers no satellite when the provider has none', () => {
    render(
      <MapLayersControl
        view={{ base: 'map', color: 'bw' }}
        onChange={vi.fn()}
        themeId="day"
        satelliteTile={undefined}
      />,
    );
    open();
    expect(screen.getByRole('radio', { name: 'לוויין' })).toHaveProperty('disabled', true);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMapView } from './useMapView';

afterEach(() => localStorage.clear());

describe('useMapView', () => {
  it('keeps the same view object across renders while the satellite has failed', () => {
    const { result, rerender } = renderHook(() => useMapView());
    act(() => result.current.change({ base: 'satellite', color: 'color' }));
    act(() => result.current.onSatelliteError());
    const fallback = result.current.view;
    expect(fallback).toEqual({ base: 'map', color: 'color' });
    rerender();
    rerender();
    expect(result.current.view).toBe(fallback);
  });

  it('falls back without overwriting the saved choice, and picking a view again clears the fallback', () => {
    const { result } = renderHook(() => useMapView());
    act(() => result.current.change({ base: 'satellite', color: 'bw' }));
    act(() => result.current.onSatelliteError());
    expect(result.current.satelliteFailed).toBe(true);
    expect(JSON.parse(localStorage.getItem('trace.mapView') ?? '{}')).toEqual({ base: 'satellite', color: 'bw' });
    act(() => result.current.change({ base: 'satellite', color: 'bw' }));
    expect(result.current.satelliteFailed).toBe(false);
    expect(result.current.view.base).toBe('satellite');
  });
});

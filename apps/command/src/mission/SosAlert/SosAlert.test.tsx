import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SosAlert } from '.';
import { polygonA, sosActive, sosClosed } from '../fixtures';

const second = { ...sosActive, id: '00000000-0000-4000-8000-0000000009b1', activatedAt: '2026-10-03T13:40:00.000Z' };

describe('SosAlert', () => {
  it('shows nothing while no SOS is active', () => {
    const { container } = render(<SosAlert sos={[sosClosed]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the sender, the polygon, the time and the location', () => {
    render(<SosAlert sos={[sosClosed, sosActive]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראת SOS' });
    expect(within(alert).getByText('SOS')).toBeTruthy();
    expect(within(alert).getByText('04')).toBeTruthy();
    expect(alert.textContent).toContain('דנה כהן');
    expect(alert.textContent).toContain(polygonA.name);
    expect(within(alert).getByText('16:58')).toBeTruthy();
    expect(alert.textContent).toContain('מיקום ידוע');
  });

  it('says when the location is not known', () => {
    render(<SosAlert sos={[{ ...sosActive, location: null, polygon: null }]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראת SOS' });
    expect(alert.textContent).toContain('מיקום לא ידוע');
    expect(alert.textContent).not.toContain(polygonA.name);
  });

  it('counts several active SOS and shows the newest', () => {
    render(<SosAlert sos={[sosActive, second]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראת SOS' });
    expect(within(alert).getByText('SOS · 2')).toBeTruthy();
    expect(within(alert).getByText('16:58')).toBeTruthy();
  });

  it('opens the SOS view', () => {
    const onOpen = vi.fn();
    render(<SosAlert sos={[sosActive]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('is compact on the phone', () => {
    render(<SosAlert compact sos={[sosActive]} onOpen={vi.fn()} />);
    expect(screen.getByRole('alert', { name: 'התראת SOS' })).toHaveAttribute('data-compact');
  });
});

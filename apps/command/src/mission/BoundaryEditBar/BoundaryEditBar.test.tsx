import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoundaryEditBar } from '.';

const props = { name: 'ואדי צפוני', busy: false, error: null, onCancel: vi.fn(), onSave: vi.fn() };

describe('BoundaryEditBar', () => {
  it('explains how to edit when nothing is affected', () => {
    render(<BoundaryEditBar {...props} outside={[]} invalid={false} />);
    expect(screen.getByText('עריכת גבול: ואדי צפוני')).toBeTruthy();
    expect(screen.getByText(/גררו נקודה/)).toBeTruthy();
  });

  it('warns about searchers left outside the new boundary (UC-C06)', () => {
    render(<BoundaryEditBar {...props} outside={[{ callsign: 4, name: 'דנה כהן', meters: 120 }]} invalid={false} />);
    expect(screen.getByText('04 דנה כהן יהיה מחוץ לגבול החדש. אחרי השמירה תישלח הודעה למחפשים בפוליגון.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'שמור גבול' }));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('cannot save a boundary that crosses itself', () => {
    render(<BoundaryEditBar {...props} outside={[]} invalid />);
    expect(screen.getByRole('button', { name: 'שמור גבול' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/חותך את עצמו/)).toBeTruthy();
  });

  it('cannot save without a connection, but can still cancel (UC-C01)', () => {
    render(<BoundaryEditBar {...props} outside={[]} invalid={false} offline />);
    expect(screen.getByRole('button', { name: 'שמור גבול' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'בטל' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(/אין חיבור לאינטרנט/)).toBeTruthy();
  });
});

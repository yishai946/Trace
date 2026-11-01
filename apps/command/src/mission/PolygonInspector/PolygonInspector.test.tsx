import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PolygonInspector } from '.';
import { participants, polygonA, polygonB } from '../fixtures';

const handlers = () => ({ onClose: vi.fn(), onRename: vi.fn(), onEditBoundary: vi.fn(), onDelete: vi.fn() });

describe('PolygonInspector', () => {
  it('shows the polygon, its status and assigned callsigns', () => {
    render(
      <PolygonInspector
        polygon={polygonA}
        assigned={[participants[0]!]}
        canEdit
        busy={false}
        error={null}
        {...handlers()}
      />,
    );
    expect(screen.getByText('ואדי צפוני', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('פעיל, 1 מחפשים')).toBeTruthy();
    expect(screen.getByText('04')).toBeTruthy();
    expect(screen.getByText('טרם חושב')).toBeTruthy();
  });

  it('blocks deleting while a searcher is assigned (UC-C06)', () => {
    render(<PolygonInspector polygon={polygonA} assigned={[]} canEdit busy={false} error={null} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'מחק' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/מחיקה חסומה/)).toBeTruthy();
  });

  it('asks for confirmation before deleting', () => {
    const h = handlers();
    render(<PolygonInspector polygon={polygonB} assigned={[]} canEdit busy={false} error={null} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'מחק' }));
    expect(h.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'מחק פוליגון' }));
    expect(h.onDelete).toHaveBeenCalledOnce();
  });

  it('saves a changed name on Enter', () => {
    const h = handlers();
    render(<PolygonInspector polygon={polygonB} assigned={[]} canEdit busy={false} error={null} {...h} />);
    const input = screen.getByLabelText('שם הפוליגון');
    fireEvent.change(input, { target: { value: 'חורשה' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onRename).toHaveBeenCalledWith('חורשה');
  });

  it('keeps the current name when the field is left blank', () => {
    const h = handlers();
    render(<PolygonInspector polygon={polygonB} assigned={[]} canEdit busy={false} error={null} {...h} />);
    const input = screen.getByLabelText('שם הפוליגון');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onRename).not.toHaveBeenCalled();
    expect(input).toHaveValue('פוליגון 2');
  });

  it('is read-only when the mission is not active', () => {
    render(
      <PolygonInspector polygon={polygonB} assigned={[]} canEdit={false} busy={false} error={null} {...handlers()} />,
    );
    expect(screen.queryByRole('button', { name: 'ערוך גבול' })).toBeNull();
    expect(screen.getByLabelText('שם הפוליגון').hasAttribute('disabled')).toBe(true);
  });

  it('shows the last error', () => {
    render(
      <PolygonInspector polygon={polygonB} assigned={[]} canEdit busy={false} error="אין חיבור" {...handlers()} />,
    );
    expect(screen.getByRole('alert').textContent).toBe('אין חיבור');
  });
});

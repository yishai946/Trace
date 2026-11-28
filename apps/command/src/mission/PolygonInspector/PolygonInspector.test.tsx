import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PolygonInspector } from '.';
import { participants, polygonA, polygonB } from '../fixtures';

const handlers = () => ({
  onClose: vi.fn(),
  onRename: vi.fn(),
  onEditBoundary: vi.fn(),
  onDelete: vi.fn(),
  onSetStatus: vi.fn(),
});

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

  describe('status (UC-C07)', () => {
    it('completes a polygon without active searchers at once', () => {
      const h = handlers();
      render(<PolygonInspector polygon={polygonB} assigned={[]} canEdit busy={false} error={null} {...h} />);
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם' }));
      expect(h.onSetStatus).toHaveBeenCalledWith('completed', false);
    });

    it('warns and asks for confirmation when searchers are active', () => {
      const h = handlers();
      const searcher = { ...participants[0]!, taskStatus: 'searching' as const };
      render(<PolygonInspector polygon={polygonA} assigned={[searcher]} canEdit busy={false} error={null} {...h} />);
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם' }));
      expect(h.onSetStatus).not.toHaveBeenCalled();
      expect(screen.getByText(/יש מחפש פעיל אחד/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
      expect(screen.getByRole('button', { name: 'סמן כהושלם' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם' }));
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם ושלח הודעה' }));
      expect(h.onSetStatus).toHaveBeenCalledWith('completed', true);
    });

    it('moves focus into the confirmation and cancels it with Escape, returning focus to the trigger', () => {
      const searcher = { ...participants[0]!, taskStatus: 'searching' as const };
      render(
        <PolygonInspector polygon={polygonA} assigned={[searcher]} canEdit busy={false} error={null} {...handlers()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם' }));
      const group = screen.getByRole('group', { name: 'אישור סימון כהושלם' });
      expect(group.contains(document.activeElement)).toBe(true);
      fireEvent.keyDown(group, { key: 'Escape' });
      expect(screen.queryByRole('group', { name: 'אישור סימון כהושלם' })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'סמן כהושלם' }));
    });

    it('does not warn for a searcher whose task already finished', () => {
      const h = handlers();
      const done = { ...participants[0]!, taskStatus: 'finished' as const };
      render(<PolygonInspector polygon={polygonA} assigned={[done]} canEdit busy={false} error={null} {...h} />);
      fireEvent.click(screen.getByRole('button', { name: 'סמן כהושלם' }));
      expect(h.onSetStatus).toHaveBeenCalledWith('completed', false);
    });

    it('returns a Completed polygon to Active', () => {
      const h = handlers();
      const completed = { ...polygonB, status: 'completed' as const };
      render(<PolygonInspector polygon={completed} assigned={[]} canEdit busy={false} error={null} {...h} />);
      expect(screen.getByText('הושלם, 0 מחפשים')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'החזר לפעיל' }));
      expect(h.onSetStatus).toHaveBeenCalledWith('active', false);
    });

    it('offers to restart the finished searchers when returning to Active', () => {
      const h = handlers();
      const completed = { ...polygonB, status: 'completed' as const };
      const done = { ...participants[0]!, taskStatus: 'finished' as const };
      render(<PolygonInspector polygon={completed} assigned={[done]} canEdit busy={false} error={null} {...h} />);
      fireEvent.click(screen.getByRole('button', { name: 'החזר לפעיל והפעל מחדש משימה של מחפש אחד' }));
      expect(h.onSetStatus).toHaveBeenCalledWith('active', false, true);
    });

    it('offers no restart when no searcher has a finished task', () => {
      const completed = { ...polygonB, status: 'completed' as const };
      render(<PolygonInspector polygon={completed} assigned={[]} canEdit busy={false} error={null} {...handlers()} />);
      expect(screen.queryByRole('button', { name: /הפעל מחדש/ })).toBeNull();
    });

    it('offers no status change when the mission is not active', () => {
      render(
        <PolygonInspector polygon={polygonB} assigned={[]} canEdit={false} busy={false} error={null} {...handlers()} />,
      );
      expect(screen.queryByRole('button', { name: 'סמן כהושלם' })).toBeNull();
    });
  });
});

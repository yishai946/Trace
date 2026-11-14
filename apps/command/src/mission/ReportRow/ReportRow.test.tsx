import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { polygonA, reportFinding, reportHazard, reportLocated } from '../fixtures';
import { ReportRow } from '.';

const renderRow = (props: Partial<Parameters<typeof ReportRow>[0]> = {}) =>
  render(<ReportRow report={reportFinding} polygons={[polygonA]} onSelect={vi.fn()} {...props} />);

describe('ReportRow', () => {
  it('RR1: shows what was sent, who sent it, where and when, and its status', () => {
    renderRow();
    const row = screen.getByRole('link');
    expect(row.textContent).toContain('כפפה אפורה ליד השביל');
    expect(row.textContent).toContain('ממצא / רמז, 04 דנה כהן, ואדי צפוני, 16:44');
    expect(row.textContent).toContain('חדש');
  });

  it('RR2: titles a located report by its category and marks a handled one', () => {
    renderRow({ report: reportLocated });
    expect(screen.getByRole('link').textContent).toContain('הנעדר אותר');
    renderRow({ report: reportHazard });
    expect(screen.getAllByRole('link')[1]?.textContent).toContain('טופל');
  });

  it('RR3: marks the current row and reports a tap', () => {
    const onSelect = vi.fn();
    renderRow({ current: true, onSelect });
    const row = screen.getByRole('link');
    expect(row.getAttribute('aria-current')).toBe('true');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(reportFinding.id);
  });
});

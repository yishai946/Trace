import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportFinding } from '../fixtures';
import { ReportEditForm } from '.';

const renderForm = () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<ReportEditForm report={reportFinding} busy={false} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
};

describe('ReportEditForm', () => {
  it('RE1: saves only the text when only the text changed', () => {
    const { onSave } = renderForm();
    fireEvent.change(screen.getByRole('textbox', { name: /תיאור/ }), { target: { value: '  כפפה כחולה  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onSave).toHaveBeenCalledWith({ text: 'כפפה כחולה' });
  });

  it('RE2: refuses a blank description', () => {
    const { onSave } = renderForm();
    fireEvent.change(screen.getByRole('textbox', { name: /תיאור/ }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(screen.getByText('כתבו תיאור.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('RE3: saving without a change cancels', () => {
    const { onSave, onCancel } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('RE4: puts the cursor in the description on mount', () => {
    renderForm();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /תיאור/ }));
  });
});

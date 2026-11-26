import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchFinishControls } from '.';
import { TestProviders } from '../../../test/providers';

const renderControls = (props: Partial<Parameters<typeof SearchFinishControls>[0]> = {}) =>
  render(
    <TestProviders>
      <SearchFinishControls pending={false} error={null} {...props} />
    </TestProviders>,
  );

describe('SearchFinishControls (UC-F08)', () => {
  it('asks to confirm and says the searcher stays assigned and the polygon is not completed', () => {
    const onFinish = vi.fn();
    renderControls({ onFinish });
    fireEvent.click(screen.getByRole('button', { name: 'סיימתי חיפוש…' }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText(/תישאר משובץ לפוליגון עד החלטת המנהל/)).toBeInTheDocument();
    expect(screen.getByText(/הפוליגון לא יסומן כהושלם/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'סיים חיפוש' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('goes back without finishing on cancel', () => {
    const onFinish = vi.fn();
    renderControls({ onFinish });
    fireEvent.click(screen.getByRole('button', { name: 'סיימתי חיפוש…' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.getByRole('button', { name: 'סיימתי חיפוש…' })).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('blocks a second tap while the finish is on its way and shows why it failed', () => {
    renderControls({ onFinish: () => {}, pending: true, error: 'המסע מושהה.' });
    fireEvent.click(screen.getByRole('button', { name: 'סיימתי חיפוש…' }));
    expect(screen.getByRole('button', { name: 'סיים חיפוש' })).toBeDisabled();
    expect(screen.getByText('המסע מושהה.')).toBeInTheDocument();
  });
});

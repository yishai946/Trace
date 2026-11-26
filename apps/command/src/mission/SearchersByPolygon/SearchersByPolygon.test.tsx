import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Participant } from '@trace/schemas';
import { describe, expect, it, vi } from 'vitest';
import { SearchersByPolygon } from '.';
import { participants, polygonA } from '../fixtures';

const [assigned, waiting] = participants as [Participant, Participant];

const renderPanel = (props: Partial<Parameters<typeof SearchersByPolygon>[0]> = {}) => {
  const onOpen = vi.fn();
  const onRetry = vi.fn();
  render(
    <SearchersByPolygon
      participants={participants}
      polygons={[polygonA]}
      loadFailed={false}
      onRetry={onRetry}
      onOpen={onOpen}
      activeSosParticipantIds={[]}
      {...props}
    />,
  );
  return { onOpen, onRetry };
};

describe('SearchersByPolygon', () => {
  it('lists the searchers under their polygon and those waiting under their own heading', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'מחפשים' });
    expect(within(panel).getByRole('heading', { name: polygonA.name })).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: 'ממתינים לשיבוץ' })).toBeTruthy();
    const groups = within(panel).getAllByRole('list');
    expect(within(groups[0] as HTMLElement).getByText(assigned.name)).toBeTruthy();
    expect(within(groups[1] as HTMLElement).getByText(waiting.name)).toBeTruthy();
    expect(within(panel).getByText('2')).toBeTruthy();
  });

  it('shows a searcher who finished the search under the same polygon (UC-F08)', () => {
    renderPanel({ participants: [{ ...assigned, taskStatus: 'finished' }] });
    const group = within(screen.getByRole('region', { name: 'מחפשים' })).getAllByRole('list')[0] as HTMLElement;
    expect(within(group).getByText(assigned.name)).toBeTruthy();
    expect(within(group).getByText(/סיים חיפוש/)).toBeTruthy();
  });

  it('shows the polygon coverage when it is known', () => {
    renderPanel({ polygons: [{ ...polygonA, coverage: 82 }] });
    expect(screen.getByText('82%')).toBeTruthy();
  });

  it('opens the searcher panel on a click', () => {
    const { onOpen } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(assigned.name) }));
    expect(onOpen).toHaveBeenCalledWith(assigned.id);
  });

  it('says a searcher is offline or in SOS', () => {
    renderPanel({
      participants: [
        { ...assigned, offline: true },
        { ...waiting, status: 'assigned', polygonId: polygonA.id },
      ],
      activeSosParticipantIds: [waiting.id],
    });
    expect(screen.getByText(/לא מקוון/)).toBeTruthy();
    expect(screen.getByText(/SOS/)).toBeTruthy();
  });

  it('shows the battery and the last update', () => {
    renderPanel({
      participants: [
        {
          ...assigned,
          battery: { level: 63, measuredAt: '2026-10-03T12:00:00.000Z' },
          lastUpdateAt: '2026-10-03T13:05:00.000Z',
        },
      ],
    });
    expect(screen.getByText('63%')).toBeTruthy();
    expect(screen.getByText(/16:05/)).toBeTruthy();
  });

  it('shows loading, the failure with a retry, and the empty state', () => {
    const { onRetry } = renderPanel({ participants: undefined, loadFailed: true });
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says it is loading', () => {
    renderPanel({ participants: undefined });
    expect(screen.getByText('טוען מחפשים…')).toBeTruthy();
  });

  it('says nobody has joined yet', () => {
    renderPanel({ participants: [] });
    expect(screen.getByText('עוד לא הצטרפו מחפשים.')).toBeTruthy();
  });
});

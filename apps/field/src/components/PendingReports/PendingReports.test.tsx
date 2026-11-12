import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PendingReports } from '.';
import { enqueue } from '../../outbox';
import { ThemeProvider } from '../../theme';

const missionId = '00000000-0000-4000-8000-000000000001';
const report = (id: string) => ({
  id,
  type: 'hazard',
  text: 'ראיתי',
  position: { type: 'Point', coordinates: [35.13, 31.78] },
  accuracy: null,
  reportedAt: '2026-10-03T10:01:00.000Z',
});
const ID_1 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a81';
const ID_2 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a82';

describe('PendingReports', () => {
  it('shows nothing when no report waits', async () => {
    const { container } = render(<PendingReports missionId={missionId} />, { wrapper: ThemeProvider });
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('says one report waits, then how many', async () => {
    render(<PendingReports missionId={missionId} />, { wrapper: ThemeProvider });
    await act(() => enqueue({ kind: 'report', missionId, payloads: [report(ID_1)], ids: [ID_1] }));
    await waitFor(() => expect(screen.getByText('דיווח ממתין לשליחה')).toBeInTheDocument());

    await act(() => enqueue({ kind: 'report', missionId, payloads: [report(ID_2)], ids: [ID_2] }));
    await waitFor(() => expect(screen.getByText('2 דיווחים ממתינים לשליחה')).toBeInTheDocument());
  });
});

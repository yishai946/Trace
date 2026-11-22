import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RejectedReportsNotice } from '.';
import { enqueue, flushOutbox } from '../../outbox';
import { TestProviders } from '../../test/providers';

const drop = async (id: string) => {
  await enqueue({ kind: 'report', missionId: 'm1', payloads: [{ id }], ids: [id] });
  await flushOutbox({ report: { batchSize: 10, send: async () => 'drop-batch' } });
};

describe('RejectedReportsNotice', () => {
  it('shows nothing when no report was refused', () => {
    render(<RejectedReportsNotice />, { wrapper: TestProviders });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns that a report that waited was refused, until the searcher confirms', async () => {
    render(<RejectedReportsNotice />, { wrapper: TestProviders });
    await act(async () => drop('late-1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('המנהל לא קיבל אותו');

    fireEvent.click(screen.getByRole('button', { name: 'הבנתי' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

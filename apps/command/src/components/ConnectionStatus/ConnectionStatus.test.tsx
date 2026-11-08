import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionStatus } from '.';

describe('ConnectionStatus', () => {
  it('shows a down connection with its reason in the tooltip and accessible name', () => {
    const detail = 'אין אינטרנט. פעולות חדשות חסומות.';
    render(<ConnectionStatus connection={{ state: 'down', label: 'לא זמין', detail }} />);
    const status = screen.getByRole('status', { name: `לא זמין. ${detail}` });
    expect(status).toHaveTextContent('לא זמין');
    expect(status).toHaveAttribute('title', detail);
    expect(status).toHaveAttribute('data-state', 'down');
  });

  it('shows an up connection', () => {
    render(<ConnectionStatus connection={{ state: 'up', label: 'זמין', detail: 'מחובר לשרת.' }} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-state', 'up');
    expect(status).toHaveTextContent('זמין');
  });
});

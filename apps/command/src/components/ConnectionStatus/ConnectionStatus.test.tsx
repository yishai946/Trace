import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionStatus } from '.';

describe('ConnectionStatus', () => {
  it('shows one word, with the reason in the accessible name and tooltip', () => {
    render(
      <ConnectionStatus
        connection={{ state: 'down', label: 'לא זמין', detail: 'אין אינטרנט. פעולות חדשות חסומות.' }}
      />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('לא זמין');
    expect(status).toHaveAccessibleName('לא זמין. אין אינטרנט. פעולות חדשות חסומות.');
    expect(status).toHaveAttribute('title', 'אין אינטרנט. פעולות חדשות חסומות.');
    expect(status).toHaveAttribute('data-state', 'down');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CallsignChip } from '.';

describe('CallsignChip', () => {
  it('shows a two-digit callsign', () => {
    render(<CallsignChip callsign={7} state="sos" />);
    expect(screen.getByText('07')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '.';

describe('TextField', () => {
  it('marks the large phone size on the control', () => {
    render(<TextField label="אימייל" size="lg" />);
    expect(screen.getByLabelText('אימייל')).toHaveAttribute('data-size', 'lg');
  });

  it('is the regular size by default', () => {
    render(<TextField label="אימייל" />);
    expect(screen.getByLabelText('אימייל')).not.toHaveAttribute('data-size');
  });
});

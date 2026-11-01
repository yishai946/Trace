import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '.';

describe('Button', () => {
  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>השהה</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'השהה' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} isDisabled>
        השהה
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'השהה' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

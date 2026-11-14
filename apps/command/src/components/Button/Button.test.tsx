import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, LinkButton } from '.';

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

  it('has a large size for phone screens', () => {
    render(<Button size="lg">כניסה</Button>);
    expect(screen.getByRole('button', { name: 'כניסה' }).className).toMatch(/lg/);
  });
});

describe('LinkButton', () => {
  it('is a link to its href', () => {
    render(<LinkButton href="tel:+972523401187">התקשר</LinkButton>);
    expect(screen.getByRole('link', { name: 'התקשר' }).getAttribute('href')).toBe('tel:+972523401187');
  });

  it('carries the variant class like Button', () => {
    render(
      <LinkButton href="tel:+972523401187" variant="primary">
        התקשר
      </LinkButton>,
    );
    expect(screen.getByRole('link', { name: 'התקשר' }).className).toMatch(/primary/);
  });

  it('is disabled without a link', () => {
    render(<LinkButton isDisabled>התקשר</LinkButton>);
    const link = screen.getByRole('link', { name: 'התקשר' });
    expect(link.getAttribute('href')).toBeNull();
    expect(link.getAttribute('aria-disabled')).toBe('true');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CallButton } from '.';

const NO_PHONE = 'אין מספר טלפון למחפש';

describe('CallButton', () => {
  it('links to the number in international format, without a dash, space or leading zero', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" />);
    expect(screen.getByRole('link', { name: 'התקשר לדנה כהן' }).getAttribute('href')).toBe('tel:+972526114085');
  });

  it('links to a non-Israeli number as it is', () => {
    render(<CallButton phone="+14155550123" name="דנה כהן" />);
    expect(screen.getByRole('link', { name: 'התקשר לדנה כהן' }).getAttribute('href')).toBe('tel:+14155550123');
  });

  it('shows the word "התקשר" in the label display and names the searcher for a screen reader', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.textContent).toBe('התקשר');
    expect(link.className).toMatch(/primary/);
  });

  it('has an icon display with only a label for a screen reader', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" display="icon" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.textContent).toBe('');
    expect(link.className).toMatch(/icon/);
  });

  it('is a real link that the keyboard can focus', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.tagName).toBe('A');
    link.focus();
    expect(link).toHaveFocus();
  });

  it('is not enabled and has no link when the searcher has no phone', () => {
    render(<CallButton phone="" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('href')).toBeNull();
    expect(link.closest('[title]')?.getAttribute('title')).toBe(NO_PHONE);
  });

  it('is not enabled for a local number', () => {
    render(<CallButton phone="0526114085" name="דנה כהן" display="icon" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('href')).toBeNull();
    expect(link.closest('[title]')?.getAttribute('title')).toBe(NO_PHONE);
  });

  it('describes why the call is disabled to assistive technology', () => {
    render(<CallButton phone="" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link).toHaveAccessibleDescription(NO_PHONE);
  });

  it('has no description when the call is enabled', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.getAttribute('aria-describedby')).toBeNull();
  });

  it('is enabled with a number', () => {
    render(<CallButton phone="+972526114085" name="דנה כהן" />);
    const link = screen.getByRole('link', { name: 'התקשר לדנה כהן' });
    expect(link.getAttribute('aria-disabled')).toBeNull();
    expect(link.closest('[title]')).toBeNull();
  });

  it.each(['night', 'day'])('draws from the theme tokens in the %s theme', (theme) => {
    render(
      <div data-theme={theme}>
        <CallButton phone="+972526114085" name="דנה כהן" />
      </div>,
    );
    expect(screen.getByRole('link', { name: 'התקשר לדנה כהן' }).getAttribute('style')).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoPicker, PHOTO_ERROR } from '.';

const current = '/api/missions/x/photo?v=1';

afterEach(() => vi.restoreAllMocks());

describe('PhotoPicker', () => {
  it('shows the mission photo and offers to replace it', () => {
    render(<PhotoPicker photo={null} onChange={() => {}} currentUrl={current} />);
    expect(screen.getByRole('img', { name: 'תמונת הנעדר' })).toHaveAttribute('src', current);
    expect(screen.getByRole('button', { name: 'החלף' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'הסר' })).not.toBeInTheDocument();
  });

  it('offers to add a photo when there is none', () => {
    render(<PhotoPicker photo={null} onChange={() => {}} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('תמונה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הוסף תמונה' })).toBeInTheDocument();
  });

  it('refuses a file that is not a JPEG, PNG or WebP image', () => {
    const onChange = vi.fn();
    render(<PhotoPicker photo={null} onChange={onChange} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('No file input');
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText(PHOTO_ERROR)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the saved photo again when the new one is cleared', () => {
    URL.createObjectURL = vi.fn(() => 'blob:new');
    URL.revokeObjectURL = vi.fn();
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const { rerender } = render(<PhotoPicker photo={file} onChange={() => {}} currentUrl={current} />);
    expect(screen.getByRole('img', { name: 'תמונת הנעדר' })).toHaveAttribute('src', 'blob:new');
    expect(screen.getByRole('button', { name: 'הסר' })).toBeInTheDocument();

    rerender(<PhotoPicker photo={null} onChange={() => {}} currentUrl={current} />);
    expect(screen.getByRole('img', { name: 'תמונת הנעדר' })).toHaveAttribute('src', current);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:new');
  });

  it('hides the buttons when read only', () => {
    render(<PhotoPicker photo={null} onChange={() => {}} currentUrl={current} readOnly />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'תמונת הנעדר' })).toBeInTheDocument();
  });
});

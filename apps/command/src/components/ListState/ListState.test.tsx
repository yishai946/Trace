import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListState } from '.';

const text = { failed: 'נכשל', loading: 'טוען', empty: 'ריק' };
const show = (items: string[] | undefined, loadFailed = false, onRetry = vi.fn()) =>
  render(
    <ListState items={items} loadFailed={loadFailed} onRetry={onRetry} text={text} className="empty">
      {(loaded) => (
        <ul>
          {loaded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </ListState>,
  );

describe('ListState', () => {
  it('says the list is loading until it arrives', () => {
    show(undefined);
    expect(screen.getByText('טוען')).toBeInTheDocument();
  });

  it('announces a failed load and offers a retry', () => {
    const onRetry = vi.fn();
    show(undefined, true, onRetry);
    expect(screen.getByRole('alert')).toHaveTextContent('נכשל');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says an empty list is empty, and renders a list that has items', () => {
    show([]).unmount();
    show(['א', 'ב']);
    expect(screen.queryByText('ריק')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

import type { ReactNode } from 'react';
import { Button } from '../Button';

interface ListStateProps<T> {
  /** The list from the server. `undefined` while it loads, or after it failed to. */
  items: T[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  /** What to say in each state, in the list's own words. */
  text: { failed: string; loading: string; empty: string };
  /** The screen's class for a message in place of the list. */
  className: string | undefined;
  /** Renders the list, once it is loaded and has items. */
  children: (items: T[]) => ReactNode;
}

/** A list fetched from the server, or what stands in its place: the failure with a retry, loading, or that it is empty. */
export function ListState<T>({ items, loadFailed, onRetry, text, className, children }: ListStateProps<T>) {
  if (items === undefined) {
    return loadFailed ? (
      <div className={className}>
        <p role="alert">{text.failed}</p>
        <Button onPress={onRetry}>נסה שוב</Button>
      </div>
    ) : (
      <p className={className}>{text.loading}</p>
    );
  }
  if (items.length === 0) return <p className={className}>{text.empty}</p>;
  return children(items);
}

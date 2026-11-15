const listeners = new Set<() => void>();

/** Calls `listener` after every change of what waits (added, sent, dropped, cleared). Returns the unsubscribe function. */
export function onOutboxChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const notifyChange = () => listeners.forEach((listener) => listener());

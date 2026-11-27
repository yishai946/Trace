import { useSyncExternalStore } from 'react';
import type { SafetyWarning } from '../safetyWarnings';

// Kept outside the components, so a closed warning stays closed when the view changes.
// shortcut: forgotten on reload; store it if commanders find it coming back.
let closed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function closeWarning(key: string): void {
  closed = new Set([...closed, key]);
  listeners.forEach((listener) => listener());
}

/** The warnings the commander has not closed. */
export function useOpenWarnings(warnings: SafetyWarning[]): SafetyWarning[] {
  const hidden = useSyncExternalStore(subscribe, () => closed);
  return warnings.filter((w) => !hidden.has(w.key));
}

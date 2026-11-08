import { useSyncExternalStore } from 'react';

/**
 * Command's phone layout (Trace Console "Command בטלפון", wireframes Cm*): up to 768px wide.
 * The stylesheets repeat this width in their `@media (width <= 768px)` rules, since CSS cannot read it from here.
 */
export const PHONE_QUERY = '(width <= 768px)';

// matchMedia is missing in some environments (jsdom); they get the desktop layout.
const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null);

function subscribe(onChange: () => void) {
  const media = query();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

/** Whether the window is phone-sized, updated as it is resized or rotated. */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}

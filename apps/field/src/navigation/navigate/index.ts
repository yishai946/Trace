import type { Href, ImperativeRouter } from 'expo-router';

type PushRouter = Pick<ImperativeRouter, 'push'>;
type BackRouter = Pick<ImperativeRouter, 'back' | 'replace' | 'canGoBack'>;

/**
 * Opens a screen on top of the current one. The screen is kept singular in the stack, so a double tap (or opening
 * it again from elsewhere) does not stack a second copy and the history stays bounded.
 */
export function openScreen(router: PushRouter, href: Href): void {
  router.push(href, { dangerouslySingular: true });
}

/** Closes the screen: back where it came from, or to `fallback` when it was opened directly from a link. */
export function goBackOr(router: BackRouter, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

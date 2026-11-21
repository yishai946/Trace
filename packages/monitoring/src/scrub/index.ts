import { SENSITIVE_KEYS } from '../sensitiveKeys';

export const FILTERED = '[Filtered]';

const SENSITIVE = new Set([...SENSITIVE_KEYS, 'cookies', 'phonenumber'].map((key) => key.toLowerCase()));
const TEXT_RULES: Array<[RegExp, string]> = [
  [/\+\d{8,15}(?!\d)/g, FILTERED],
  [/(?<![\w.])0\d{1,2}-?\d{7}(?!\w)/g, FILTERED],
  [/Bearer\s+[\w.~+/=-]+/gi, `Bearer ${FILTERED}`],
  [/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, FILTERED],
  [/([?&])(token|code|otp|phone|phoneNumber|lat|lng)=[^&\s#]*/gi, `$1$2=${FILTERED}`],
];

/** Replaces phone numbers, bearer tokens, coordinate pairs and sensitive query values inside a string. */
export function scrubText(text: string): string {
  return TEXT_RULES.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

/** A sign-in code is 4 to 8 digits; an error code such as `INTERNAL_ERROR` is not one. */
const isSignInCode = (value: unknown) => /^\d{4,8}$/.test(String(value));

const isSensitive = (key: string, value: unknown) =>
  SENSITIVE.has(key.toLowerCase()) || (key.toLowerCase() === 'code' && isSignInCode(value));

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    Reflect.set(value, key, isSensitive(key, child) ? FILTERED : scrubValue(child, seen));
  }
  return value;
}

/**
 * Removes personal data from a Sentry event (message, exception, extras, breadcrumbs, request URL, query, headers and
 * body, tags) in place and returns it. Values under a sensitive key are filtered whatever they hold; every other
 * string goes through `scrubText`.
 */
export function scrubEvent<T extends object>(event: T): T {
  scrubValue(event, new WeakSet());
  return event;
}

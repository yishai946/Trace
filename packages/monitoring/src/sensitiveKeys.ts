/**
 * Field names whose values never reach a log line or an error report: credentials, phone numbers, sign-in codes and
 * searchers' exact locations. The API logger builds its redaction paths from this list and the scrubber filters the
 * same names in Sentry events, so there is one list.
 */
export const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'otp',
  'secret',
  'phoneNumber',
  'phone',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinates',
];

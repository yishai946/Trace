import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubText } from '.';

const PHONE = '+972501234567';

describe('scrubText', () => {
  it('removes phone numbers, bearer tokens, coordinates and sensitive query values', () => {
    const text = `call ${PHONE} or 050-1234567, Bearer abc.def at 31.7712, 35.2134 /x?token=s3&code=123456&ok=1`;
    const result = scrubText(text);
    for (const secret of [PHONE, '050-1234567', 'abc.def', '31.7712', '35.2134', 's3', '123456']) {
      expect(result).not.toContain(secret);
    }
    expect(result).toContain('ok=1');
  });

  it('leaves clean text and version-like numbers alone', () => {
    expect(scrubText('Mission 12 failed, version 1.2.3')).toBe('Mission 12 failed, version 1.2.3');
  });
});

describe('scrubEvent', () => {
  it('scrubs the message, exception, extras, breadcrumbs, request and tags', () => {
    const event = {
      message: `failed for ${PHONE}`,
      exception: { values: [{ type: 'Error', value: 'bad Bearer tok123 at 31.7712, 35.2134' }] },
      extra: { phoneNumber: PHONE, nested: { lat: 31.77, lng: 35.21, note: `x ${PHONE}` }, id: 'm-1' },
      breadcrumbs: [{ message: `GET /a?token=zzz`, data: { url: `/b?phone=${PHONE}`, password: 'p' } }],
      request: {
        url: `https://x.test/api?otp=123456&code=654321`,
        query_string: `phone=${PHONE}`,
        headers: { authorization: 'Bearer q', cookie: 'a=b', accept: 'json' },
        data: { password: 'hunter2', name: 'ok' },
      },
      tags: { request_id: 'req-1', who: PHONE },
    };
    const text = JSON.stringify(scrubEvent(event));
    for (const secret of [PHONE, 'tok123', '31.77', '35.21', 'zzz', 'hunter2', '123456', '654321', 'Bearer q', 'a=b']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('req-1');
    expect(text).toContain('m-1');
    expect(text).toContain('json');
  });

  it('keeps an error code but scrubs a numeric code', () => {
    const event = scrubEvent({ extra: { code: 'INTERNAL_ERROR', other: { code: '123456' } } });
    expect(event.extra).toEqual({ code: 'INTERNAL_ERROR', other: { code: '[Filtered]' } });
  });

  it('leaves a clean event unchanged', () => {
    const event = { message: 'boom', tags: { request_id: 'req-1' }, extra: { missionId: 'abc', count: 3 } };
    expect(scrubEvent(event)).toEqual(event);
  });
});

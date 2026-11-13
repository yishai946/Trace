import { describe, expect, it } from 'vitest';
import { CreateSightingBody, LkpDecisionBody } from '.';

const valid = {
  position: { type: 'Point', coordinates: [35.14, 31.77] },
  observedAt: '2026-10-03T14:22:00+03:00',
  source: 'witness',
  description: 'מטייל ראה אדם עם כובע אפור',
};

const failingPaths = (body: unknown) => {
  const result = CreateSightingBody.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => `/${issue.path.join('/')}`);
};

describe('CreateSightingBody', () => {
  it('parses a complete sighting', () => {
    expect(CreateSightingBody.parse(valid)).toEqual(valid);
  });

  it('accepts an id made on the phone', () => {
    const id = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d';
    expect(CreateSightingBody.parse({ ...valid, id }).id).toBe(id);
  });

  it('refuses an id that is not a UUID', () => {
    expect(failingPaths({ ...valid, id: 'abc' })).toContain('/id');
  });

  it('turns a blank or missing description into null', () => {
    expect(CreateSightingBody.parse({ ...valid, description: '  ' }).description).toBeNull();
    const { description: _description, ...without } = valid;
    expect(CreateSightingBody.parse(without).description).toBeNull();
  });

  it.each(['position', 'observedAt', 'source'])('requires %s', (key) => {
    const { [key]: _removed, ...body } = valid as Record<string, unknown>;
    expect(failingPaths(body)).toContain(`/${key}`);
  });

  it('requires a time-zone offset on the time', () => {
    expect(failingPaths({ ...valid, observedAt: '2026-10-03T13:05' })).toContain('/observedAt');
  });

  it('refuses an unknown source', () => {
    expect(failingPaths({ ...valid, source: 'certain' })).toContain('/source');
  });

  it('refuses a description over 2000 characters', () => {
    expect(failingPaths({ ...valid, description: 'א'.repeat(2001) })).toContain('/description');
  });
});

describe('LkpDecisionBody', () => {
  it('accepts accepted and rejected only', () => {
    expect(LkpDecisionBody.safeParse({ decision: 'accepted' }).success).toBe(true);
    expect(LkpDecisionBody.safeParse({ decision: 'rejected' }).success).toBe(true);
    expect(LkpDecisionBody.safeParse({ decision: 'maybe' }).success).toBe(false);
  });
});

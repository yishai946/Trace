import { describe, expect, it } from 'vitest';
import { CreateReportBody, REPORT_TEXT_MAX, UpdateReportBody } from '.';

const valid = {
  id: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a87',
  type: 'hazard',
  text: 'מדרון חלק',
  position: { type: 'Point', coordinates: [35.14, 31.77] },
  accuracy: 8,
  reportedAt: '2026-10-03T14:22:00+03:00',
};

const failingPaths = (body: unknown) => {
  const result = CreateReportBody.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => `/${issue.path.join('/')}`);
};

describe('CreateReportBody', () => {
  it('parses a complete report', () => {
    expect(CreateReportBody.parse(valid)).toEqual(valid);
  });

  it('trims the text', () => {
    expect(CreateReportBody.parse({ ...valid, text: '  מדרון חלק ' }).text).toBe('מדרון חלק');
  });

  it('refuses blank text and text over the maximum', () => {
    expect(failingPaths({ ...valid, text: '   ' })).toContain('/text');
    expect(failingPaths({ ...valid, text: 'א'.repeat(REPORT_TEXT_MAX + 1) })).toContain('/text');
    expect(failingPaths({ ...valid, text: 'א'.repeat(REPORT_TEXT_MAX) })).toEqual([]);
  });

  it('refuses an unknown type', () => {
    expect(failingPaths({ ...valid, type: 'rumor' })).toContain('/type');
  });

  it('defaults the accuracy to null', () => {
    const { accuracy: _accuracy, ...without } = valid;
    expect(CreateReportBody.parse(without).accuracy).toBeNull();
  });

  it('requires a uuid id and a time with an offset', () => {
    expect(failingPaths({ ...valid, id: 'not-a-uuid' })).toContain('/id');
    expect(failingPaths({ ...valid, reportedAt: '2026-10-03T14:22:00' })).toContain('/reportedAt');
  });

  it.each(['id', 'type', 'text', 'position', 'reportedAt'])('requires %s', (key) => {
    const { [key]: _removed, ...body } = valid as Record<string, unknown>;
    expect(failingPaths(body)).toContain(`/${key}`);
  });
});

describe('UpdateReportBody', () => {
  it('accepts the type only, the text only, or both', () => {
    expect(UpdateReportBody.parse({ type: 'general' })).toEqual({ type: 'general' });
    expect(UpdateReportBody.parse({ text: 'חדש' })).toEqual({ text: 'חדש' });
    expect(UpdateReportBody.parse({ type: 'hazard', text: 'חדש' })).toEqual({ type: 'hazard', text: 'חדש' });
  });

  it('trims the text', () => {
    expect(UpdateReportBody.parse({ text: '  חדש ' }).text).toBe('חדש');
  });

  it('refuses an empty body', () => {
    expect(UpdateReportBody.safeParse({}).success).toBe(false);
  });

  it('refuses blank text, text over the maximum and an unknown type', () => {
    expect(UpdateReportBody.safeParse({ text: '   ' }).success).toBe(false);
    expect(UpdateReportBody.safeParse({ text: 'א'.repeat(REPORT_TEXT_MAX + 1) }).success).toBe(false);
    expect(UpdateReportBody.safeParse({ type: 'nope' }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { CreateSosBody, SOS_MESSAGE_MAX_LENGTH, Sos } from '.';

const position = { type: 'Point', coordinates: [35.14, 31.77] };
const location = { position, recordedAt: '2026-10-03T14:22:00+03:00', accuracy: 12 };

const failingPaths = (body: unknown) => {
  const result = CreateSosBody.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => `/${issue.path.join('/')}`);
};

describe('CreateSosBody', () => {
  it('turns a blank or missing message into null', () => {
    expect(CreateSosBody.parse({ message: '   ' }).message).toBeNull();
    expect(CreateSosBody.parse({}).message).toBeNull();
    expect(CreateSosBody.parse({ message: ' נפלתי ' }).message).toBe('נפלתי');
  });

  it('takes a message up to the limit', () => {
    expect(CreateSosBody.parse({ message: 'א'.repeat(SOS_MESSAGE_MAX_LENGTH) }).message).toHaveLength(500);
    expect(failingPaths({ message: 'א'.repeat(SOS_MESSAGE_MAX_LENGTH + 1) })).toContain('/message');
  });

  it('works without a location', () => {
    expect(CreateSosBody.parse({}).location).toBeNull();
    expect(CreateSosBody.parse({ location: null }).location).toBeNull();
  });

  it('parses a location and defaults its accuracy to null', () => {
    expect(CreateSosBody.parse({ location }).location).toEqual(location);
    expect(CreateSosBody.parse({ location: { position, recordedAt: location.recordedAt } }).location?.accuracy).toBeNull();
  });

  it('refuses a time without an offset, a bad accuracy and a position that is not a point', () => {
    expect(failingPaths({ location: { ...location, recordedAt: '2026-10-03T14:22:00' } })).toContain(
      '/location/recordedAt',
    );
    expect(failingPaths({ location: { ...location, accuracy: -1 } })).toContain('/location/accuracy');
    expect(
      failingPaths({ location: { ...location, position: { type: 'LineString', coordinates: [[0, 0]] } } }),
    ).toContain('/location/position/type');
  });
});

const sos = {
  id: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d',
  missionId: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0e',
  status: 'active',
  sender: {
    participantId: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0f',
    searcherId: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c10',
    callsign: 7,
    name: 'אלון שגיא',
  },
  polygon: { id: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c11', name: 'חורשת אורנים' },
  message: 'נפלתי',
  location,
  recipientCount: 3,
  activatedAt: '2026-10-03T14:22:00.000Z',
  closedAt: null,
  closedBy: null,
};

describe('Sos', () => {
  it('parses an active SOS', () => {
    expect(Sos.parse(sos)).toEqual(sos);
  });

  it('parses a closed SOS without a polygon, message or location', () => {
    const closed = {
      ...sos,
      status: 'closed',
      polygon: null,
      message: null,
      location: null,
      closedAt: '2026-10-03T14:40:00.000Z',
      closedBy: { role: 'commander', name: 'דנה לוי' },
    };
    expect(Sos.parse(closed)).toEqual(closed);
  });
});

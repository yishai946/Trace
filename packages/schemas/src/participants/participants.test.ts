import { describe, expect, it } from 'vitest';
import { BatteryBody, Participant } from '.';

const measuredAt = '2026-10-03T13:05:00+03:00';

describe('BatteryBody', () => {
  it('takes a whole percent from 0 to 100 with its measurement time', () => {
    expect(BatteryBody.parse({ level: 0, measuredAt }).level).toBe(0);
    expect(BatteryBody.parse({ level: 100, measuredAt }).level).toBe(100);
  });

  it('refuses a level out of range, a fraction and a missing time', () => {
    expect(BatteryBody.safeParse({ level: -1, measuredAt }).success).toBe(false);
    expect(BatteryBody.safeParse({ level: 101, measuredAt }).success).toBe(false);
    expect(BatteryBody.safeParse({ level: 50.5, measuredAt }).success).toBe(false);
    expect(BatteryBody.safeParse({ level: 50 }).success).toBe(false);
  });
});

describe('Participant', () => {
  it('has no battery until the phone reports one', () => {
    const participant = Participant.parse({
      id: '3f2b1c9e-8d4a-4b6e-9a1f-2c7d5e8f0a11',
      searcherId: '3f2b1c9e-8d4a-4b6e-9a1f-2c7d5e8f0a12',
      name: 'דנה',
      phone: '+972523401187',
      callsign: 1,
      status: 'available',
      polygonId: null,
      taskStatus: null,
      position: null,
      positionAt: null,
    });
    expect(participant.battery).toBeNull();
  });
});

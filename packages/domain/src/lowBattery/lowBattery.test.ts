import { describe, expect, it } from 'vitest';
import { LOW_BATTERY_PERCENT, crossedIntoLowBattery } from '.';

describe('crossedIntoLowBattery', () => {
  it('uses 20 percent as the POC threshold (decision 45 leaves it TBD)', () => {
    expect(LOW_BATTERY_PERCENT).toBe(20);
  });

  it('alerts once when the level falls below the threshold', () => {
    expect(crossedIntoLowBattery(LOW_BATTERY_PERCENT, LOW_BATTERY_PERCENT - 1)).toBe(true);
    expect(crossedIntoLowBattery(50, 5)).toBe(true);
  });

  it('alerts on the first reading when it is already below', () => {
    expect(crossedIntoLowBattery(null, 15)).toBe(true);
  });

  it('does not alert at or above the threshold', () => {
    expect(crossedIntoLowBattery(null, LOW_BATTERY_PERCENT)).toBe(false);
    expect(crossedIntoLowBattery(80, 79)).toBe(false);
  });

  it('does not repeat while the level stays below', () => {
    expect(crossedIntoLowBattery(19, 18)).toBe(false);
    expect(crossedIntoLowBattery(10, 10)).toBe(false);
  });

  it('alerts again after the phone charged back above the threshold', () => {
    expect(crossedIntoLowBattery(35, 12)).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { noteBatteryLevel, resetLowBattery } from '.';
import { useAlerts } from '..';

const kinds = () => useAlerts.getState().alerts.map((alert) => alert.kind);

beforeEach(() => {
  resetLowBattery();
  useAlerts.setState(useAlerts.getInitialState());
});

describe('noteBatteryLevel', () => {
  it('raises the alert when the level falls below the threshold', () => {
    noteBatteryLevel(35);
    expect(kinds()).toEqual([]);
    noteBatteryLevel(19);
    expect(kinds()).toEqual(['low-battery']);
  });

  it('alerts once while the level stays low, and again after a charge and a new fall', () => {
    noteBatteryLevel(15);
    useAlerts.getState().dismiss('low-battery');
    noteBatteryLevel(14);
    expect(kinds()).toEqual([]);
    noteBatteryLevel(60);
    noteBatteryLevel(18);
    expect(kinds()).toEqual(['low-battery']);
  });

  it('withdraws the alert once the phone is charged', () => {
    noteBatteryLevel(10);
    noteBatteryLevel(50);
    expect(kinds()).toEqual([]);
  });

  it('alerts on a low first reading', () => {
    noteBatteryLevel(5);
    expect(kinds()).toEqual(['low-battery']);
  });
});

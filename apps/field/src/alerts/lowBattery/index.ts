import { crossedIntoLowBattery, LOW_BATTERY_PERCENT } from '@trace/domain';
import { useAlerts } from '..';

const ID = 'low-battery';

let previous: number | null = null;

/** Forgets the last reading (a new mission or participant starts again). */
export function resetLowBattery(): void {
  previous = null;
}

/**
 * Judges the phone's own battery level (percent) and raises the in-app low-battery alert when it falls below the
 * threshold (UC-S04 step 2, decision 45). It runs on the phone, so it works without a connection. It alerts once per
 * fall, and withdraws the alert after a charge.
 */
export function noteBatteryLevel(level: number): void {
  const { raise, dismiss } = useAlerts.getState();
  if (crossedIntoLowBattery(previous, level)) {
    raise({
      id: ID,
      kind: 'low-battery',
      title: 'סוללה חלשה',
      text: 'הסוללה בטלפון נמוכה. חברו מטען, או חזרו לנקודת הכינוס.',
      href: null,
    });
  } else if (level >= LOW_BATTERY_PERCENT) {
    dismiss(ID);
  }
  previous = level;
}

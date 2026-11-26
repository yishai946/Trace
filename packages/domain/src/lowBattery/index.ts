/**
 * The battery level, in percent, below which the searcher and the commander are alerted (UC-S04, decision 45). The
 * spec leaves the value TBD; 20 is the POC value, to be confirmed by the owner.
 */
export const LOW_BATTERY_PERCENT = 20;

/**
 * Whether a new battery reading is the one that raises the low-battery alert: it is below the threshold and the
 * previous reading was not (or there was none). A level that stays below alerts once; one that charged back above
 * and falls again alerts again.
 */
export function crossedIntoLowBattery(previous: number | null, level: number): boolean {
  return level < LOW_BATTERY_PERCENT && (previous === null || previous >= LOW_BATTERY_PERCENT);
}

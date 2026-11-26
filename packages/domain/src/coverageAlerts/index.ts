/** The Coverage Estimate percentages that alert the commander, fixed in the MVP (decision 55). */
export const COVERAGE_ALERT_THRESHOLDS = [80, 90] as const;
export type CoverageAlertThreshold = (typeof COVERAGE_ALERT_THRESHOLDS)[number];

/**
 * The thresholds a polygon's Coverage has reached that were not alerted yet, lowest first. Each threshold alerts once
 * per polygon: `raised` holds those already alerted, so a Coverage that falls and rises again repeats nothing.
 */
export function newCoverageThresholds(coverage: number | null, raised: readonly number[]): CoverageAlertThreshold[] {
  if (coverage === null) return [];
  return COVERAGE_ALERT_THRESHOLDS.filter((threshold) => coverage >= threshold && !raised.includes(threshold));
}

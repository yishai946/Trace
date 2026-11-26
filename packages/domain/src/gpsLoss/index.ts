/**
 * Whether a searcher whose phone has had no GPS since `since` is due for the escalation to the commander (UC-S04,
 * decision 42). The time is a parameter: the spec leaves it TBD, so no value is invented here. `since` is null while
 * the GPS works.
 */
export function gpsLossEscalationDue(input: { since: Date | null; now: Date; afterMs: number }): boolean {
  return input.since !== null && input.now.getTime() - input.since.getTime() >= input.afterMs;
}

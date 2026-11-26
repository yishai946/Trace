/**
 * Whether a searcher with no update since `lastUpdateAt` (a GPS point or a battery report) is due for the "lost
 * contact" alert (UC-S04, decision 44). The time is a parameter: the spec leaves it TBD, so no value is invented here.
 * A searcher who never reported (`lastUpdateAt` null) was never in contact, so there is nothing to lose.
 */
export function lostContactAlertDue(input: { lastUpdateAt: Date | null; now: Date; afterMs: number }): boolean {
  return input.lastUpdateAt !== null && input.now.getTime() - input.lastUpdateAt.getTime() >= input.afterMs;
}

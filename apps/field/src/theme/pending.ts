/**
 * Mobile values the Trace Console design system does not define yet, taken from the Field wireframes (`Fm*`). Each
 * one is still a gap (the token generator does not emit `letterSpacing`, for example); do not add values here without listing them as a gap in the Pull Request.
 */
export const pendingTokens = {
  /** Fm01 stepper, `.tcx-step__sep`: the 16px separator between steps. */
  stepSeparatorW: 16,
  /** Fm02 `.tcx-scan`: the corner marks sit 18px from the edge of the QR frame. */
  scanCornerInset: 18,
  /** Fm02 join code input: letter spacing of the code (Trace Console `code` type style, 2.4px). */
  joinCodeSpacing: 2.4,
  /** Fm10 `.tcx-report`: the open text of a report card has a 1.4 line height. */
  reportTextLeading: 1.4,
} as const;

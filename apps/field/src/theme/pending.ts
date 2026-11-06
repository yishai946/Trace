/**
 * Mobile values the Trace Console design system does not define yet, taken from the Field wireframes (`Fm*`).
 * Each one is a design-system gap: add it to the Trace Console artifact as a token, run /sync-design, and replace
 * its uses with the token. Do not add values here without listing them as a gap in the Pull Request.
 */
export const pendingTokens = {
  /** Brand book: every touch target on mobile is at least 44px. Wireframe `.tcx-touch`. */
  touchTarget: 44,
  /** Large mobile button, wireframe `.tc-btn--lg`. */
  controlHLg: 48,
  /** CallsignChip, Trace Console `.tc-callsign` (`min-width`, `height`): sizes without a `size` token. */
  callsignMinW: 26,
  callsignH: 20,
  /** Bottom tab bar, wireframe `.tcx-tabbar`. */
  tabBarH: 64,
  /** Line icon, brand book "16px". */
  icon: 16,
  /** Large line icon in the tab bar and large buttons, wireframe `.tcx-i--lg`. */
  iconLg: 20,
  /** Brand book: icon stroke width 1.8px. */
  iconStroke: 1.8,
  /** Brand book: disabled controls are 45% opaque. */
  disabledOpacity: 0.45,
  /** Brand book: pressed primary and danger buttons, `.tc-btn--primary:active`. */
  pressedOpacity: 0.8,
} as const;

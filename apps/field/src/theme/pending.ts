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
  /** Fm01 brand mark: ring and dot, 22px with a 2px stroke. */
  brandMark: 22,
  brandMarkStroke: 2,
  /** Fm01 stepper, `.tcx-step__n`: the 20px numbered circle, the 12px check inside a done step, the 16px separator. */
  stepMarker: 20,
  stepIcon: 12,
  stepSeparatorW: 16,
  /** Fm01 `.tcx-otp` and `.tcx-step__n`: 1.5px border. */
  strongBorder: 1.5,
  /** Fm01 `.tcx-otp`: code cell height and digit size. */
  otpCellH: 60,
  otpDigitSize: 24,
  /** Brand book: focus ring, 2px solid with a 2px offset. */
  focusRing: 2,
  /** Fm02 `.tcx-scan`: the QR frame's height and its corner marks (30px, 3px stroke, 18px from the edge). */
  scanH: 230,
  scanCorner: 30,
  scanCornerStroke: 3,
  scanCornerInset: 18,
  /** Fm02 join code input: 20px bold, letter-spaced. */
  joinCodeSize: 20,
  joinCodeSpacing: 2.4,
  /** Fm02 and Fm04 `.tcx-ph`: the missing person's photo, 64x76 on the join card and 60x72 on the waiting screen. */
  photoW: 64,
  photoH: 76,
  /** Fm04: height of the general map between the status card and the missing-person card. */
  waitingMapH: 320,
  /** Fm04 `.tcx-card` of the status and the join confirmation: 2px border. */
  cardStrongBorder: 2,
  /** Wireframe `.tcx-badge`: 20px high. */
  badgeH: 20,
  /** Trace Console `.tc-dot`: the 6px state dot inside a badge. */
  dot: 6,
  /** Fm08 `.tcx-opt`: a report category option, 56px high with a 2px border and 14px text; its icon is 18px (`svg`). */
  reportOptionH: 56,
  reportOptionBorder: 2,
  reportOptionText: 14,
  iconMd: 18,
  /** Fm08: the report text area, 124px high at least. */
  reportTextMinH: 124,
  /** Fm10 `.tcx-ph`: the report photo's thumbnail, 84x84. */
  reportThumb: 84,
} as const;

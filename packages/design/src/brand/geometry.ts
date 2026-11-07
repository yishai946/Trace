/**
 * Geometry of the TRACE mark: a boot sole made of a forefoot and a heel, filled with dense contour lines (a
 * topographic map), walking in steps. Pure data and maths with no imports, so the web app, the React Native app and
 * the icon script (`scripts/brand-icons`) draw the same shapes.
 *
 * Coordinates are in "print units": one sole is about 190 wide and 380 tall, centred near the origin, toes up.
 */

export const SOLE = {
  forefoot:
    'M-88 -80 C-88 -150 -50 -195 0 -195 C52 -195 92 -150 92 -80 C92 -30 66 -5 58 34 L-50 34 C-62 0 -88 -30 -88 -80 Z',
  heel: 'M-52 122 C-52 92 -30 68 0 68 C32 68 54 92 54 122 C54 162 36 186 0 186 C-36 186 -52 162 -52 122 Z',
} as const;

/** The forefoot's centre and radius, where a step grows into a full screen (splash). */
export const FOREFOOT = { cx: 2, cy: -80, radius: 90 } as const;

export interface Contour {
  /** SVG path data of one closed contour line. */
  d: string;
  /** Every fourth line is an index contour, drawn thicker like on a topographic map. */
  major: boolean;
}

export interface PrintContours {
  contours: Contour[];
  /** The summit the lines wrap around; the last step's summit is amber. */
  peak: { x: number; y: number };
}

const RINGS = 13;
const RING_STEP = 19;
const POINTS = 64;

/** Contour lines of one sole. `seed` moves the summit and the waviness so no two steps look alike. */
export function printContours(seed: number): PrintContours {
  const phase = seed * 1.3;
  const peak = { x: round(-10 + phase * 4), y: round(-70 + phase * 6) };
  const contours: Contour[] = [];
  for (let i = 0; i < RINGS; i += 1) {
    const radius = 12 + RING_STEP * i;
    const wave = 0.07 * (1 + i * 0.04);
    const turn = phase + i * 0.2;
    const points: string[] = [];
    for (let p = 0; p < POINTS; p += 1) {
      const angle = (2 * Math.PI * p) / POINTS;
      const f =
        1 +
        wave * Math.sin(2 * angle + turn) +
        wave * 0.7 * Math.sin(3 * angle + turn * 1.6) +
        wave * 0.4 * Math.sin(5 * angle + turn * 0.7);
      points.push(
        `${round(peak.x + radius * f * Math.cos(angle))} ${round(peak.y + radius * 1.15 * f * Math.sin(angle))}`,
      );
    }
    contours.push({ d: `M${points.join(' L')} Z`, major: i % 4 === 3 });
  }
  return { contours, peak };
}

/** Line widths in print units: normal and index contours. */
export const CONTOUR_WIDTH = { minor: 6, major: 10.2 } as const;

export interface Step {
  /** Position of the step's centre, in print units, relative to the middle of the trail. */
  x: number;
  y: number;
  /** Degrees clockwise; toes point along the walking direction. */
  rotate: number;
  foot: 'left' | 'right';
}

const STRIDE = 256;
const SIDE = 100;
const HEADING = 30;

/** `count` steps walking up and to the right, left foot first, centred on the origin. */
export function walk(count: number): Step[] {
  const heading = (HEADING * Math.PI) / 180;
  const ahead = { x: Math.sin(heading), y: -Math.cos(heading) };
  const aside = { x: Math.cos(heading), y: Math.sin(heading) };
  return Array.from({ length: count }, (_, i) => {
    const along = (i - (count - 1) / 2) * STRIDE;
    const left = i % 2 === 0;
    const across = (left ? -1 : 1) * SIDE;
    return {
      x: round(ahead.x * along + aside.x * across),
      y: round(ahead.y * along + aside.y * across),
      rotate: HEADING,
      foot: left ? 'left' : 'right',
    };
  });
}

/** The launch splash: soles appear one by one as if someone walks, then the last one grows into the whole screen. */
export const SPLASH = {
  steps: 5,
  /** Delay between two steps, and how long one step takes to fade in. */
  stepMs: 320,
  fadeMs: 260,
  /** Pause after the last step before the screen opens. */
  holdMs: 250,
  /** How long the last step takes to grow over the screen. */
  openMs: 700,
} as const;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

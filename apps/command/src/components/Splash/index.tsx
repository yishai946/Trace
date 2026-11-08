import { CONTOUR_WIDTH, PEAK_RADIUS, SOLE, SPLASH, printContours, walk } from '@trace/design';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import styles from './Splash.module.css';

export interface SplashProps {
  /** False while the console still loads (the session); the screen opens once it is true. */
  ready?: boolean;
  /** Called once the screen has opened and the splash can be removed. */
  onDone: () => void;
}

const FADE_MS = 150;
const WALK_MS = (SPLASH.steps - 1) * SPLASH.stepMs + SPLASH.fadeMs + SPLASH.holdMs;
const TIMING = {
  '--gap': `${SPLASH.stepMs}ms`,
  '--fade': `${SPLASH.fadeMs}ms`,
  '--open': `${SPLASH.openMs}ms`,
} as CSSProperties;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The launch splash: five soles filled with contour lines appear one after another as if someone walks across the
 * screen, then the last one grows until it covers everything and the console shows underneath. With "reduce motion"
 * the soles show at once and the splash only fades.
 */
export function Splash({ ready = true, onDone }: SplashProps) {
  const [reduceMotion] = useState(prefersReducedMotion);
  const [walked, setWalked] = useState(false);
  const [closing, setClosing] = useState(false);
  const steps = useMemo(() => walk(SPLASH.steps), []);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const timer = setTimeout(() => setWalked(true), reduceMotion ? SPLASH.holdMs * 2 : WALK_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const open = walked && ready;
  useEffect(() => {
    if (!open) return;
    // The last sole grows for SPLASH.openMs (CSS); with reduced motion there is no growing step, so fade right away.
    const timer = setTimeout(() => setClosing(true), reduceMotion ? 0 : SPLASH.openMs);
    return () => clearTimeout(timer);
  }, [open, reduceMotion]);

  // The fade's transitionend does not fire in a throttled background tab; never leave the splash mounted.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(finish, FADE_MS * 2);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only reads refs and the latest onDone
  }, [closing]);

  return (
    <div
      role="img"
      aria-label="TRACE"
      className={closing ? `${styles.root} ${styles.closing}` : styles.root}
      style={TIMING}
      onTransitionEnd={(event) => {
        if (closing && event.target === event.currentTarget) finish();
      }}
    >
      <svg className={styles.art} viewBox="-480 -720 960 1440" aria-hidden="true">
        {steps.map((step, i) => (
          <g key={i} transform={`translate(${step.x} ${step.y}) rotate(${step.rotate})`}>
            <Sole index={i} last={i === steps.length - 1} />
          </g>
        ))}
        {open && !reduceMotion && (
          <g
            transform={`translate(${steps[steps.length - 1]?.x ?? 0} ${steps[steps.length - 1]?.y ?? 0}) rotate(${steps[steps.length - 1]?.rotate ?? 0})`}
          >
            <path data-testid="grow" className={styles.grow} d={SOLE.forefoot} />
          </g>
        )}
      </svg>
    </div>
  );
}

/** One sole: ink with contour lines cut into it, appearing at its turn in the walk. */
function Sole({ index, last }: { index: number; last: boolean }) {
  const { contours, peak } = useMemo(() => printContours(index), [index]);
  const clipId = `splash-sole-${index}`;
  return (
    <g className={styles.step} style={{ '--i': index } as CSSProperties}>
      <clipPath id={clipId}>
        <path d={SOLE.forefoot} />
        <path d={SOLE.heel} />
      </clipPath>
      <path className={styles.ink} d={SOLE.forefoot} />
      <path className={styles.ink} d={SOLE.heel} />
      <g clipPath={`url(#${clipId})`} className={styles.lines}>
        {contours.map((c, i) => (
          <path key={i} d={c.d} strokeWidth={c.major ? CONTOUR_WIDTH.major : CONTOUR_WIDTH.minor} />
        ))}
      </g>
      <circle
        className={last ? styles.peak : styles.hole}
        cx={peak.x}
        cy={peak.y}
        r={last ? PEAK_RADIUS.last : PEAK_RADIUS.hole}
      />
    </g>
  );
}

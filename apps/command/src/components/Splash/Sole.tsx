import { CONTOUR_WIDTH, PEAK_RADIUS, SOLE, printContours } from '@trace/design';
import { useMemo } from 'react';
import styles from './Splash.module.css';

/** One sole: ink with contour lines cut into it, appearing at its turn in the walk. */
export function Sole({ index, last }: { index: number; last: boolean }) {
  const { contours, peak } = useMemo(() => printContours(index), [index]);
  const clipId = `splash-sole-${index}`;
  return (
    <g className={styles.step} style={{ '--i': index }}>
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

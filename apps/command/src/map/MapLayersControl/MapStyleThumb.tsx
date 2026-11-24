import { themes, type ThemeId } from '@trace/design';
import { colorfulPalette } from '@trace/map';
import styles from './MapLayersControl.module.css';

export type MapStyle = 'colorful' | 'bw' | 'satellite';

interface MapStyleThumbProps {
  style: MapStyle;
  themeId: ThemeId;
  /** A satellite image tile for the satellite miniature; without it the miniature is drawn. */
  satelliteTile: string | undefined;
}

/** A miniature of a map style, drawn with that style's own colors: a river, a wood and a few streets. */
export function MapStyleThumb({ style, themeId, satelliteTile }: MapStyleThumbProps) {
  const c = themes[themeId].color;
  const p = colorfulPalette[themeId];
  if (style === 'satellite' && satelliteTile) {
    return <img className={styles.thumb} src={satelliteTile} alt="" draggable={false} />;
  }
  const colored = style === 'colorful';
  const sat = style === 'satellite';
  const fill = {
    land: colored ? p.land : c.mapGround,
    wood: colored ? p.wood : c.inkFaint,
    water: colored ? p.water : c.water,
    minor: colored ? p.roadMinor : c.inkMuted,
    major: colored ? p.roadMajor : c.inkSecondary,
  };
  return (
    <svg className={styles.thumb} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill={sat ? c.inkMuted : fill.land} />
      <path
        d="M0 40c14-4 22 8 36 2s20-14 28-12v34H0z"
        fill={sat ? c.inkFaint : fill.wood}
        opacity={colored ? 1 : 0.35}
      />
      <path d="M-2 14c16 6 26-8 40 0s20 6 30 0V-2H-2z" fill={fill.water} opacity={colored || sat ? 1 : 0.4} />
      <path d="M10 64l14-30 14-12 26-8" stroke={fill.major} strokeWidth="4" fill="none" />
      <path d="M0 30h64M40 22v42M20 44h44" stroke={fill.minor} strokeWidth="2" fill="none" opacity={sat ? 0.5 : 1} />
    </svg>
  );
}

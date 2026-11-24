import type { ThemeId } from '@trace/design';
import type { MapView } from '@trace/map';
import { useRef } from 'react';
import { Button, Dialog, Label, Popover, Radio, RadioGroup } from 'react-aria-components';
import { choose } from '../../choose';
import styles from './MapLayersControl.module.css';
import { MapStyleThumb, type MapStyle } from './MapStyleThumb';
import { useHoverOpen } from './useHoverOpen';

interface MapLayersControlProps {
  view: MapView;
  onChange: (view: MapView) => void;
  themeId: ThemeId;
  /** A satellite image tile for the miniature, when the map provider has imagery. Without it satellite is off. */
  satelliteTile: string | undefined;
}

const STYLES = ['colorful', 'bw', 'satellite'] as const;

const NAMES: Record<MapStyle, string> = { colorful: 'צבעונית', bw: 'שחור־לבן', satellite: 'לוויין' };

const mapStyleOf = (view: MapView): MapStyle => (view.color === 'color' ? 'colorful' : 'bw');
const styleOf = (view: MapView): MapStyle => (view.base === 'satellite' ? 'satellite' : mapStyleOf(view));

/** One choice of map style, as in Google Maps: colored, black and white, or satellite. */
const viewOf = (style: MapStyle, view: MapView): MapView =>
  style === 'satellite'
    ? { ...view, base: 'satellite' }
    : { base: 'map', color: style === 'colorful' ? 'color' : 'bw' };

/** What the tile offers, as in Google Maps: satellite over a map, and the map back over satellite. */
function alternativeOf(view: MapView, satellite: boolean): MapStyle {
  if (view.base === 'satellite') return mapStyleOf(view);
  if (satellite) return 'satellite';
  return mapStyleOf(view) === 'colorful' ? 'bw' : 'colorful';
}

/**
 * The map style picker, as in Google Maps: a tile showing the other style, which a click switches to. Hovering the
 * tile opens a panel beside it with every style.
 */
export function MapLayersControl({ view, onChange, themeId, satelliteTile }: MapLayersControlProps) {
  const current = styleOf(view);
  const next = alternativeOf(view, !!satelliteTile);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { isOpen, setOpen, hover } = useHoverOpen();

  return (
    <div ref={triggerRef} {...hover}>
      <Button
        className={styles.trigger}
        aria-label={`שכבות: עבור ל${NAMES[next]}`}
        onPress={() => onChange(viewOf(next, view))}
      >
        <MapStyleThumb style={next} themeId={themeId} satelliteTile={satelliteTile} />
        <span className={styles.caption}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" strokeLinejoin="round" />
          </svg>
          שכבות
        </span>
      </Button>
      <Popover
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={setOpen}
        isNonModal
        placement="right bottom"
        offset={12}
        className={styles.popover}
      >
        <Dialog
          aria-label="שכבות מפה"
          className={styles.dialog}
          onMouseEnter={hover.onMouseEnter}
          onMouseLeave={hover.onMouseLeave}
        >
          <RadioGroup
            className={styles.group}
            orientation="horizontal"
            value={current}
            onChange={(picked) => onChange(viewOf(choose(STYLES, picked, current), view))}
          >
            <Label className={styles.label}>סגנון מפה</Label>
            <div className={styles.tiles}>
              {STYLES.map((style) => (
                <Radio
                  key={style}
                  value={style}
                  isDisabled={style === 'satellite' && !satelliteTile}
                  aria-label={NAMES[style]}
                  className={styles.tile}
                >
                  <MapStyleThumb style={style} themeId={themeId} satelliteTile={satelliteTile} />
                  <span className={styles.name}>{NAMES[style]}</span>
                </Radio>
              ))}
            </div>
          </RadioGroup>
        </Dialog>
      </Popover>
    </div>
  );
}

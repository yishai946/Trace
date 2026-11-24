import type { ReactNode } from 'react';
import { Compass } from './Compass';
import { ActionButton } from '../ToolButton/ActionButton';
import styles from './MissionMap.module.css';

export interface NavControlsProps {
  /** The map's rotation in degrees; the compass needle turns against it. */
  bearing: number;
  /** Turns the map back to north and level. */
  onResetNorth: () => void;
  /** Turns the map by 90 degrees (negative: left). */
  onTurn: (degrees: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Each jump button is disabled when its action is missing: no position permission, no LKP, no rally point. */
  onMyLocation: (() => void) | undefined;
  /** The position is being found. */
  locating: boolean;
  onLkp: (() => void) | undefined;
  onRally: (() => void) | undefined;
}

const icon = (children: ReactNode) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** Google Maps-style column: compass, jump to my location, LKP and rally point, then zoom. */
export function NavControls({
  bearing,
  onResetNorth,
  onTurn,
  locating,
  onZoomIn,
  onZoomOut,
  onMyLocation,
  onLkp,
  onRally,
}: NavControlsProps) {
  return (
    <div className={styles.nav} role="group" aria-label="ניווט במפה">
      <Compass bearing={bearing} onResetNorth={onResetNorth} onTurn={onTurn} />
      <ActionButton
        large
        tipPlacement="start"
        aria-label="המיקום שלי"
        isDisabled={!onMyLocation}
        isPending={locating}
        onPress={onMyLocation}
      >
        {icon(
          <>
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </>,
        )}
      </ActionButton>
      <ActionButton large tipPlacement="start" aria-label="נקודת LKP אחרונה" isDisabled={!onLkp} onPress={onLkp}>
        {icon(
          <>
            <path d="M12 21s-6-5.6-6-10a6 6 0 0112 0c0 4.4-6 10-6 10z" />
            <circle cx="12" cy="11" r="2" />
          </>,
        )}
      </ActionButton>
      <ActionButton large tipPlacement="start" aria-label="נקודת כינוס" isDisabled={!onRally} onPress={onRally}>
        {icon(<path d="M6 21V4M6 4h11l-2 4 2 4H6" />)}
      </ActionButton>
      <ActionButton large tipPlacement="start" aria-label="התקרב" onPress={onZoomIn}>
        {icon(<path d="M12 5v14M5 12h14" />)}
      </ActionButton>
      <ActionButton large tipPlacement="start" aria-label="התרחק" onPress={onZoomOut}>
        {icon(<path d="M5 12h14" />)}
      </ActionButton>
    </div>
  );
}

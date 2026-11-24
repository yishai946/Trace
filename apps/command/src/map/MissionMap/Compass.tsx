import { Button } from 'react-aria-components';
import { Tip } from '../ToolButton/Tip';
import styles from './MissionMap.module.css';

interface CompassProps {
  /** The map's rotation in degrees; the needle turns against it so the red end keeps pointing north. */
  bearing: number;
  /** Turns the map back to north and level. */
  onResetNorth: () => void;
  /** Turns the map by 90 degrees: negative to the left, positive to the right. */
  onTurn: (degrees: number) => void;
}

const arrow = (path: string) => (
  <svg aria-hidden="true" viewBox="0 0 8 12" fill="currentColor">
    <path d={path} />
  </svg>
);

/** The map's compass, as in Google Maps: a needle that follows the rotation and a small arrow either side to turn 90°. */
export function Compass({ bearing, onResetNorth, onTurn }: CompassProps) {
  return (
    <div className={styles.compass}>
      <Tip label="סובב שמאלה ב־90°" placement="start">
        <Button className={styles.turn} aria-label="סובב שמאלה ב־90°" onPress={() => onTurn(-90)}>
          {arrow('M7 1L1 6l6 5z')}
        </Button>
      </Tip>
      <Tip label="חזרה לצפון" placement="start">
        <Button className={styles.needle} aria-label="חזרה לצפון" onPress={onResetNorth}>
          <svg aria-hidden="true" viewBox="0 0 24 24" style={{ transform: `rotate(${-bearing}deg)` }}>
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
            <path d="M12 3l4 9H8z" className={styles.north} />
            <path d="M12 21l-4-9h8z" fill="currentColor" opacity="0.55" />
          </svg>
        </Button>
      </Tip>
      <Tip label="סובב ימינה ב־90°" placement="start">
        <Button className={styles.turn} aria-label="סובב ימינה ב־90°" onPress={() => onTurn(90)}>
          {arrow('M1 1l6 5-6 5z')}
        </Button>
      </Tip>
    </div>
  );
}

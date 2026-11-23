import type { MapView } from '@trace/map';
import { Button, Dialog, DialogTrigger, Label, Popover, Radio, RadioGroup } from 'react-aria-components';
import { choose } from '../../choose';
import styles from './MapLayersControl.module.css';

interface MapLayersControlProps {
  view: MapView;
  onChange: (view: MapView) => void;
  /** The map provider has satellite imagery. */
  satelliteAvailable: boolean;
}

const BASES = ['map', 'satellite'] as const;
const COLORS = ['bw', 'color'] as const;

/** The view tool with a text label (MapToolbar): the base map and, over the map, its colors. */
export function MapLayersControl({ view, onChange, satelliteAvailable }: MapLayersControlProps) {
  const name = view.base === 'satellite' ? 'לוויין' : view.color === 'color' ? 'צבעונית' : 'שחור־לבן';
  return (
    <DialogTrigger>
      <Button className={styles.trigger}>{`שכבות · ${name}`}</Button>
      <Popover placement="top" className={styles.popover}>
        <Dialog aria-label="שכבות מפה" className={styles.dialog}>
          <RadioGroup
            className={styles.group}
            orientation="horizontal"
            value={view.base}
            onChange={(next) => onChange({ ...view, base: choose(BASES, next, view.base) })}
          >
            <Label className={styles.label}>תצוגה</Label>
            <div className={styles.seg}>
              <Radio value="map" className={styles.option}>
                מפה
              </Radio>
              <Radio value="satellite" isDisabled={!satelliteAvailable} className={styles.option}>
                לוויין
              </Radio>
            </div>
          </RadioGroup>
          <RadioGroup
            className={styles.group}
            orientation="horizontal"
            value={view.color}
            isDisabled={view.base === 'satellite'}
            onChange={(next) => onChange({ ...view, color: choose(COLORS, next, view.color) })}
          >
            <Label className={styles.label}>צבעים</Label>
            <div className={styles.seg}>
              <Radio value="color" className={styles.option}>
                צבעונית
              </Radio>
              <Radio value="bw" className={styles.option}>
                שחור־לבן
              </Radio>
            </div>
          </RadioGroup>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

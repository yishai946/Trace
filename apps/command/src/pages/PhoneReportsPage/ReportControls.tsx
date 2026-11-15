import { Tab, TabList, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { chooseFirst } from '../../choose';
import styles from './PhoneReportsPage.module.css';
import { chipLabel, REPORT_CHIPS, type ReportChip } from '../../mission/reportView';

interface ReportControlsProps {
  chip: ReportChip;
  counts: Parameters<typeof chipLabel>[1];
  onChip: (chip: ReportChip) => void;
}

/** Switches between the list and the map, and filters the reports by status or type. */
export function ReportControls({ chip, counts, onChip }: ReportControlsProps) {
  return (
    <div className={styles.controls}>
      <TabList className={styles.seg} aria-label="תצוגה">
        <Tab id="list" className={styles.segTab}>
          רשימה
        </Tab>
        <Tab id="map" className={styles.segTab}>
          מפה
        </Tab>
      </TabList>
      <ToggleButtonGroup
        className={styles.chips}
        aria-label="סינון"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[chip]}
        onSelectionChange={(keys) => onChip(chooseFirst(REPORT_CHIPS, keys, 'all'))}
      >
        {REPORT_CHIPS.map((c) => (
          <ToggleButton key={c} id={c} className={styles.chip}>
            {chipLabel(c, counts)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

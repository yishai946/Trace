import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from 'react-aria-components';
import styles from './ThemeSelect.module.css';
import { MonitorIcon, MoonIcon, SunIcon } from '../icons';
import { useTheme, type ThemePreference } from '../../theme/theme';

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
  { id: 'day', label: 'יום', icon: <SunIcon /> },
  { id: 'night', label: 'לילה', icon: <MoonIcon /> },
  { id: 'system', label: 'לפי המכשיר', icon: <MonitorIcon /> },
];

/**
 * "ערכת צבעים" (Trace Console ProfileMenu): day, night or the device's setting.
 * `inline` puts the label beside the select, as a row of the "עוד" screen (Cm16).
 */
export function ThemeSelect({ inline = false }: { inline?: boolean }) {
  const { preference, setPreference } = useTheme();

  return (
    <Select
      className={styles.theme}
      data-inline={inline || undefined}
      selectedKey={preference}
      onSelectionChange={(key: Key | null) => key && setPreference(key as ThemePreference)}
    >
      <Label className={styles.label}>ערכת צבעים</Label>
      <AriaButton className={styles.select}>
        <SelectValue className={styles.option}>
          {({ selectedItem }) => {
            const option = THEME_OPTIONS.find((o) => o.id === (selectedItem as { id?: Key } | null)?.id);
            return option ? (
              <>
                {option.icon}
                {option.label}
              </>
            ) : null;
          }}
        </SelectValue>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </AriaButton>
      <Popover className={styles.listPopover}>
        <ListBox className={styles.list} items={THEME_OPTIONS}>
          {(option) => (
            <ListBoxItem id={option.id} textValue={option.label} className={styles.item}>
              {option.icon}
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

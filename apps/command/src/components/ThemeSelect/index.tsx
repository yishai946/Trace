import type { ReactNode } from 'react';
import { Button as AriaButton, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import styles from './ThemeSelect.module.css';
import { MonitorIcon, MoonIcon, SunIcon } from '../icons';
import { choose } from '../../choose';
import { useTheme } from '../../theme/theme';
import { THEME_PREFERENCES, type ThemePreference } from '../../theme/themePreference';

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
  { id: 'day', label: 'יום', icon: <SunIcon /> },
  { id: 'night', label: 'לילה', icon: <MoonIcon /> },
  { id: 'system', label: 'לפי המכשיר', icon: <MonitorIcon /> },
];

export interface ThemeSelectProps {
  /** `stacked`: label above the select (the profile popover and sheet); `row`: label at the start, select at the end ("עוד"). */
  layout: 'stacked' | 'row';
}

/** The color-scheme choice (day, night, follow the device), saved on this device. */
export function ThemeSelect({ layout }: ThemeSelectProps) {
  const { preference, setPreference } = useTheme();
  const selected = THEME_OPTIONS.find((option) => option.id === preference);

  return (
    <Select
      className={styles.theme}
      data-layout={layout}
      selectedKey={preference}
      onSelectionChange={(key) => setPreference(choose(THEME_PREFERENCES, key, preference))}
    >
      <Label className={styles.label}>ערכת צבעים</Label>
      <AriaButton className={styles.select}>
        <SelectValue className={styles.option}>
          {selected ? (
            <>
              {selected.icon}
              {selected.label}
            </>
          ) : null}
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

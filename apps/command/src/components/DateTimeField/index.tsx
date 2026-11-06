import { parseDateTime, type CalendarDateTime } from '@internationalized/date';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  Label,
  Popover,
} from 'react-aria-components';
import styles from './DateTimeField.module.css';

export interface DateTimeFieldProps {
  label: string;
  /** `YYYY-MM-DDTHH:mm` in the commander's time zone, or empty. */
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
  errorMessage?: string;
}

const toValue = (value: string): CalendarDateTime | null => {
  try {
    return value ? parseDateTime(value) : null;
  } catch {
    return null;
  }
};

/** A date and time typed by segment or picked from a calendar (React Aria DatePicker), in Hebrew with a 24-hour clock. */
export function DateTimeField({ label, value, onChange, isInvalid, errorMessage }: DateTimeFieldProps) {
  return (
    <DatePicker
      className={styles.field}
      granularity="minute"
      hourCycle={24}
      shouldForceLeadingZeros
      hideTimeZone
      value={toValue(value)}
      onChange={(next) => onChange(next ? next.toString().slice(0, 16) : '')}
      isInvalid={isInvalid}
    >
      <Label className={styles.label}>{label}</Label>
      <Group className={styles.group}>
        <DateInput className={styles.input}>
          {(segment) => <DateSegment className={styles.segment} segment={segment} />}
        </DateInput>
        <Button className={styles.trigger} aria-label="פתיחת לוח שנה">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 10h16M9 3v4M15 3v4" />
          </svg>
        </Button>
      </Group>
      <FieldError className={styles.error}>{errorMessage}</FieldError>
      <Popover className={styles.popover} placement="bottom end">
        <Dialog className={styles.dialog}>
          <Calendar className={styles.calendar}>
            <header className={styles.calendarHead}>
              <Button slot="previous" className={styles.navButton} aria-label="החודש הקודם">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Button>
              <Heading className={styles.month} />
              <Button slot="next" className={styles.navButton} aria-label="החודש הבא">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </Button>
            </header>
            <CalendarGrid className={styles.grid}>
              {(date) => <CalendarCell className={styles.cell} date={date} />}
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
}

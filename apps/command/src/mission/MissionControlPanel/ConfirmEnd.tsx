import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { Button } from '../../components/Button';
import styles from './MissionControlPanel.module.css';

interface ConfirmEndProps {
  /** The button that opens the confirmation. */
  label: string;
  question: string;
  busy: boolean;
  offline: boolean;
  onConfirm: () => void;
}

/** An end of the mission, confirmed in a popover first: it reaches every searcher and cannot be undone (UC-C16, C17). */
export function ConfirmEnd({ label, question, busy, offline, onConfirm }: ConfirmEndProps) {
  return (
    <DialogTrigger>
      <Button variant="primary" isDisabled={busy || offline}>
        {busy ? 'מסיים…' : label}
      </Button>
      <Popover className={styles.popover} placement="top">
        <Dialog className={styles.confirm} aria-label="אישור סיום המסע">
          {({ close }) => (
            <>
              <Heading slot="title" className={styles.confirmTitle}>
                {question}
              </Heading>
              <p className={styles.hint}>
                המסע יסתיים וישמר לקריאה בלבד. המחפשים בשטח יקבלו הודעת סיום. המעקב הבטיחותי נמשך עד סיום הפעילות של כל
                מחפש.
              </p>
              <span className={styles.actions}>
                <Button size="sm" onPress={close}>
                  ביטול
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => {
                    close();
                    onConfirm();
                  }}
                >
                  אשר וסיים מסע
                </Button>
              </span>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

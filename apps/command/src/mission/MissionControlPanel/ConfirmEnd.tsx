import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { Button } from '../../components/Button';
import styles from './MissionControlPanel.module.css';

interface ConfirmEndProps {
  busy: boolean;
  offline: boolean;
  onConfirm: () => void;
}

/** "הנעדר אותר…", confirmed in a popover first: the end reaches every searcher and cannot be undone (UC-C16). */
export function ConfirmEnd({ busy, offline, onConfirm }: ConfirmEndProps) {
  return (
    <DialogTrigger>
      <Button variant="primary" isDisabled={busy || offline}>
        {busy ? 'מסיים…' : 'הנעדר אותר…'}
      </Button>
      <Popover className={styles.popover} placement="top">
        <Dialog className={styles.confirm} aria-label="אישור סיום המסע">
          {({ close }) => (
            <>
              <Heading slot="title" className={styles.confirmTitle}>
                לסיים את המסע: הנעדר אותר?
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

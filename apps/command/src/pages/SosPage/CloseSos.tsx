import type { Sos } from '@trace/schemas';
import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { Button } from '../../components/Button';
import styles from './SosPage.module.css';

interface CloseSosProps {
  sos: Sos;
  /** Undefined while closing is blocked: no connection. */
  onClose?: (sosId: string) => void;
  busy: boolean;
}

/** "סגור SOS", confirmed in a popover first: the close goes to everyone the SOS was sent to (UC-C14, decision 99). */
export function CloseSos({ sos, onClose, busy }: CloseSosProps) {
  return (
    <DialogTrigger>
      <Button variant="danger-ghost" size="lg" isDisabled={!onClose || busy}>
        {busy ? 'סוגר…' : 'סגור SOS…'}
      </Button>
      <Popover className={styles.popover} placement="top">
        <Dialog className={styles.confirm} aria-label={`אישור סגירת SOS של ${sos.sender.name}`}>
          {({ close }) => (
            <>
              <Heading slot="title" className={styles.confirmTitle}>
                לסגור את ה-SOS של {sos.sender.name}?
              </Heading>
              <p className={styles.meta}>הסגירה שולחת עדכון לכל מי שקיבל את הקריאה והיא נשמרת בהיסטוריה.</p>
              <span className={styles.actions}>
                <Button size="sm" onPress={close}>
                  ביטול
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => {
                    onClose?.(sos.id);
                    close();
                  }}
                >
                  סגור SOS
                </Button>
              </span>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

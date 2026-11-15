import type { Participant } from '@trace/schemas';
import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import styles from './SearchersPage.module.css';
import { Button } from '../../components/Button';

/** "סיים השתתפות", confirmed in a popover first: the searcher leaves the activity (UC-C18). */
export function EndParticipation({
  participant,
  onEnd,
}: {
  participant: Participant;
  onEnd?: (participantId: string) => void;
}) {
  return (
    <DialogTrigger>
      <Button
        size="sm"
        variant="danger-outline"
        isDisabled={!onEnd}
        aria-label={`סיים השתתפות של ${participant.name}…`}
      >
        סיים השתתפות…
      </Button>
      <Popover className={styles.popover} placement="bottom end">
        <Dialog className={styles.confirm} aria-label={`אישור סיום השתתפות של ${participant.name}`}>
          {({ close }) => (
            <>
              <Heading slot="title" className={styles.confirmTitle}>
                לסיים את ההשתתפות של {participant.name}?
              </Heading>
              <p className={styles.meta}>המשימה הפעילה תסתיים והמסלול יישמר. המחפש יוכל להצטרף שוב.</p>
              <span className={styles.actions}>
                <Button size="sm" onPress={close}>
                  ביטול
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => {
                    onEnd?.(participant.id);
                    close();
                  }}
                >
                  סיים השתתפות
                </Button>
              </span>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

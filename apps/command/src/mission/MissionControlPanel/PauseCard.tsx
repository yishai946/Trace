import { canPauseMission, canResumeMission } from '@trace/domain';
import type { MissionStatus } from '@trace/domain';
import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { Button } from '../../components/Button';
import styles from './MissionControlPanel.module.css';

interface PauseCardProps {
  status: MissionStatus;
  busy: boolean;
  offline: boolean;
  onPause: () => void;
  onResume: () => void;
}

/** "השהיית חיפוש": pauses the search (UC-C15) after a confirmation, or resumes a paused mission. Safety tracking goes on. */
export function PauseCard({ status, busy, offline, onPause, onResume }: PauseCardProps) {
  if (!canPauseMission(status) && !canResumeMission(status)) return null;
  const disabled = busy || offline;
  return (
    <div className={styles.pause} role="group" aria-label="השהיית חיפוש">
      {canResumeMission(status) ? (
        <>
          <p className={styles.hint}>
            החיפוש מושהה. השיבוצים נשמרים, ואחרי החידוש כל מחפש ילחץ שוב "התחל חיפוש". עריכת פוליגונים נחסמת בזמן
            ההשהיה.
          </p>
          <Button variant="primary" isDisabled={disabled} onPress={onResume}>
            חדש חיפוש
          </Button>
        </>
      ) : (
        <DialogTrigger>
          <Button isDisabled={disabled}>השהה חיפוש…</Button>
          <Popover className={styles.popover} placement="top">
            <Dialog className={styles.confirm} aria-label="אישור השהיית החיפוש">
              {({ close }) => (
                <>
                  <Heading slot="title" className={styles.confirmTitle}>
                    להשהות את החיפוש?
                  </Heading>
                  <p className={styles.hint}>
                    המחפשים יקבלו הודעה לחזור ל־Rally Point. המעקב הבטיחותי נמשך, ולא ניתן יהיה להצטרף או לערוך
                    פוליגונים עד החידוש.
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
                        onPause();
                      }}
                    >
                      אשר והשהה
                    </Button>
                  </span>
                </>
              )}
            </Dialog>
          </Popover>
        </DialogTrigger>
      )}
    </div>
  );
}

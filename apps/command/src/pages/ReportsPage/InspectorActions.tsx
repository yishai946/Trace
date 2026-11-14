import type { Ref } from 'react';
import type { Report } from '@trace/schemas';
import { Button } from '../../components/Button';
import styles from './ReportsPage.module.css';

export interface InspectorActionsProps {
  report: Report;
  busy: boolean;
  confirmingDelete: boolean;
  onHandle: (id: string) => void;
  onDelete: (id: string) => void;
  openEdit: () => void;
  openConfirm: () => void;
  closeConfirm: () => void;
  /** Focus returns to the button that opened a step, or goes to the safe choice of the confirmation. */
  editButtonRef: Ref<HTMLButtonElement>;
  deleteButtonRef: Ref<HTMLButtonElement>;
  cancelDeleteRef: Ref<HTMLButtonElement>;
}

/** What the commander can do with a report: mark it Handled, edit it, or delete it after confirming. */
export function InspectorActions({
  report,
  busy,
  confirmingDelete,
  onHandle,
  onDelete,
  openEdit,
  openConfirm,
  closeConfirm,
  editButtonRef,
  deleteButtonRef,
  cancelDeleteRef,
}: InspectorActionsProps) {
  return (
    <div className={`${styles.section} ${styles.column}`}>
      {confirmingDelete ? (
        <>
          <div role="group" aria-label="אישור מחיקה" className={styles.confirm}>
            <p className={styles.hint}>למחוק את הדיווח? אי אפשר לבטל.</p>
            <div className={styles.actions}>
              <Button ref={cancelDeleteRef} onPress={closeConfirm} isDisabled={busy}>
                בטל
              </Button>
              <Button variant="danger" onPress={() => onDelete(report.id)} isDisabled={busy}>
                מחק דיווח
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          {report.status === 'new' && (
            <Button variant="primary" onPress={() => onHandle(report.id)} isDisabled={busy}>
              סמן כטופל
            </Button>
          )}
          <Button ref={editButtonRef} onPress={openEdit} isDisabled={busy}>
            ערוך
          </Button>
          <Button ref={deleteButtonRef} variant="danger-outline" onPress={openConfirm} isDisabled={busy}>
            מחק
          </Button>
        </div>
      )}
      <p className={styles.hint}>מחיקה למנהל בלבד. עריכה ללא היסטוריית גרסאות.</p>
    </div>
  );
}

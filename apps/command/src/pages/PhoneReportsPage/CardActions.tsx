import type { Report } from '@trace/schemas';
import type { Ref } from 'react';
import { Button } from '../../components/Button';
import styles from './PhoneReportsPage.module.css';

interface CardActionsProps {
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

/** What the commander can do with a report on the phone: mark it Handled, edit it, or delete it after confirming. */
export function CardActions({
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
}: CardActionsProps) {
  return confirmingDelete ? (
    <div role="group" aria-label="אישור מחיקה" className={styles.confirm}>
      <p className={styles.hint}>למחוק את הדיווח? אי אפשר לבטל.</p>
      <div className={styles.btnRow}>
        <Button size="lg" ref={cancelDeleteRef} onPress={closeConfirm} isDisabled={busy}>
          בטל
        </Button>
        <Button size="lg" variant="danger" onPress={() => onDelete(report.id)} isDisabled={busy}>
          מחק דיווח
        </Button>
      </div>
    </div>
  ) : (
    <div className={styles.btnRow}>
      {report.status === 'new' && (
        <Button
          size="lg"
          variant="primary"
          className={styles.main}
          onPress={() => onHandle(report.id)}
          isDisabled={busy}
        >
          סמן כטופל
        </Button>
      )}
      <Button size="lg" ref={editButtonRef} onPress={openEdit} isDisabled={busy}>
        ערוך
      </Button>
      <Button size="lg" ref={deleteButtonRef} variant="danger-outline" onPress={openConfirm} isDisabled={busy}>
        מחק
      </Button>
    </div>
  );
}

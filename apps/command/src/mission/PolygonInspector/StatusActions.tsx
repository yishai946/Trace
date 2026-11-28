import type { PolygonStatus } from '@trace/schemas';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import styles from './PolygonInspector.module.css';

interface StatusActionsProps {
  status: PolygonStatus;
  polygonName: string;
  /** Assigned searchers whose search task is still open: Completed ends their tasks. */
  activeSearchers: number;
  busy: boolean;
  onSetStatus: (status: 'active' | 'completed', confirmed: boolean) => void;
}

/** Marks a polygon Completed at any Coverage, with a warning when searchers are active, or returns it to Active. */
export function StatusActions({ status, polygonName, activeSearchers, busy, onSetStatus }: StatusActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  // The confirmation replaces the trigger: focus goes into it, and back to the trigger when it is cancelled.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (cancelled.current) {
      cancelled.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  const cancel = () => {
    cancelled.current = true;
    setConfirming(false);
  };

  if (status === 'completed') {
    return (
      <>
        <Button onPress={() => onSetStatus('active', false)} isDisabled={busy}>
          החזר לפעיל
        </Button>
        <p className={styles.hint}>הפוליגון הושלם. המסלולים והכיסוי נשמרים וממשיכים להצטבר.</p>
      </>
    );
  }

  if (confirming) {
    return (
      <div
        role="group"
        aria-label="אישור סימון כהושלם"
        className={styles.confirm}
        onKeyDown={(e) => e.key === 'Escape' && !busy && cancel()}
      >
        <p className={styles.hint}>
          ב"{polygonName}" {activeSearchers === 1 ? 'יש מחפש פעיל אחד' : `יש ${activeSearchers} מחפשים פעילים`}. סימון
          כהושלם יסיים את משימות החיפוש שלהם וישלח להם הודעה.
        </p>
        <div className={styles.row}>
          <Button ref={cancelRef} onPress={cancel} isDisabled={busy}>
            בטל
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              setConfirming(false);
              onSetStatus('completed', true);
            }}
            isDisabled={busy}
          >
            סמן כהושלם ושלח הודעה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      ref={triggerRef}
      onPress={() => (activeSearchers > 0 ? setConfirming(true) : onSetStatus('completed', false))}
      isDisabled={busy}
    >
      סמן כהושלם
    </Button>
  );
}

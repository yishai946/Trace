import type { MissionPolygon, Participant, PolygonStatus } from '@trace/schemas';
import { useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import styles from './PolygonInspector.module.css';
import { PolygonMark } from './PolygonMark';
import { StatusActions } from './StatusActions';

const hasOpenTask = (p: Participant) => p.taskStatus !== null && p.taskStatus !== 'finished';

export const POLYGON_STATUS_LABEL: Record<PolygonStatus, string> = {
  unassigned: 'לא משובץ',
  active: 'פעיל',
  completed: 'הושלם',
};

interface PolygonInspectorProps {
  polygon: MissionPolygon;
  /** Searchers assigned to this polygon. */
  assigned: Participant[];
  /** False when the mission is not active: the polygon is read-only. */
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRename: (name: string) => void;
  onEditBoundary: () => void;
  onDelete: () => void;
  /** Completed or back to Active; `confirmed` once the commander accepted the active-searchers warning. */
  onSetStatus: (status: 'active' | 'completed', confirmed: boolean, restartSearchers?: boolean) => void;
}

/** Trace Console Inspector for a selected polygon (Cd07): name, coverage, assigned searchers and actions. */
export function PolygonInspector({
  polygon,
  assigned,
  canEdit,
  busy,
  error,
  onClose,
  onRename,
  onEditBoundary,
  onDelete,
  onSetStatus,
}: PolygonInspectorProps) {
  const [name, setName] = useState(polygon.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasActiveSearchers = polygon.activeSearchers > 0;

  // A polygon always has a name: a blank field goes back to the current one.
  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(polygon.name);
    else if (trimmed !== polygon.name) onRename(trimmed);
  };

  return (
    <section className={styles.panel} aria-label={polygon.name}>
      <div className={`${styles.section} ${styles.head}`}>
        <PolygonMark status={polygon.status} />
        <div className={styles.titles}>
          <div className={styles.name}>{polygon.name}</div>
          <div className={styles.sub}>
            {POLYGON_STATUS_LABEL[polygon.status]}, {assigned.length} מחפשים
          </div>
        </div>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          ×
        </Button>
      </div>

      <div className={styles.section}>
        <TextField
          className={styles.field}
          value={name}
          onChange={setName}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
          isDisabled={!canEdit || busy}
          maxLength={60}
        >
          <Label className={styles.label}>שם הפוליגון</Label>
          <Input className={styles.input} placeholder="ללא שם" />
        </TextField>
      </div>

      <div className={styles.section}>
        <dl className={styles.facts}>
          <div>
            <dt>כיסוי שטח האזור</dt>
            <dd>{polygon.coverage === null ? 'טרם חושב' : `${Math.round(polygon.coverage)}%`}</dd>
          </div>
          <div>
            <dt>מחפשים פעילים</dt>
            <dd>{polygon.activeSearchers}</dd>
          </div>
        </dl>
        {assigned.length > 0 && (
          <ul className={styles.callsigns} aria-label="מחפשים משובצים">
            {assigned.map((p) => (
              <li key={p.id} title={p.name}>
                <CallsignChip callsign={p.callsign} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className={`${styles.section} ${styles.actions}`}>
          <StatusActions
            status={polygon.status}
            polygonName={polygon.name}
            activeSearchers={assigned.filter(hasOpenTask).length}
            finishedSearchers={assigned.filter((p) => p.taskStatus === 'finished').length}
            busy={busy}
            onSetStatus={onSetStatus}
          />
          {confirmingDelete ? (
            <div role="group" aria-label="אישור מחיקה" className={styles.confirm}>
              <p className={styles.hint}>למחוק את "{polygon.name}"? היסטוריית Routes ודיווחים נשמרת.</p>
              <div className={styles.row}>
                <Button onPress={() => setConfirmingDelete(false)} isDisabled={busy}>
                  בטל
                </Button>
                <Button variant="danger" onPress={onDelete} isDisabled={busy}>
                  מחק פוליגון
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="primary" onPress={onEditBoundary} isDisabled={busy}>
                ערוך גבול
              </Button>
              <Button
                variant="danger-outline"
                onPress={() => setConfirmingDelete(true)}
                isDisabled={busy || hasActiveSearchers}
              >
                מחק
              </Button>
              {hasActiveSearchers && (
                <p className={styles.hint}>מחיקה חסומה כל עוד יש מחפש פעיל. היסטוריית Routes ודיווחים נשמרת.</p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

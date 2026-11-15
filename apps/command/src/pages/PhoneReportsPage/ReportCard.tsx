import { isCriticalReport } from '@trace/domain';
import type { MissionPolygon, Report, UpdateReportBody } from '@trace/schemas';
import { useEffect, useRef } from 'react';
import { CallsignChip } from '../../components/CallsignChip';
import { ReportEditForm } from '../../mission/ReportEditForm';
import { polygonLabel, positionLabel } from '../../mission/reportView';
import { timeLabel } from '../../mission/timeLabel';
import { useReportEditing } from '../../mission/useReportEditing';
import { CardHead } from './CardHead';
import { CardActions } from './CardActions';
import styles from './PhoneReportsPage.module.css';

export interface ReportCardProps {
  report: Report;
  polygons: MissionPolygon[];
  /** Undefined while the change is blocked: no connection, or an ended mission. */
  onHandle?: (id: string) => void;
  onUpdate?: (id: string, body: UpdateReportBody) => void;
  onDelete?: (id: string) => void;
  busy: boolean;
  error: string | null;
  ended: boolean;
  onClose: () => void;
  /** The commander just chose this report: focus moves to the card, which scrolls it into view. */
  autoFocus: boolean;
  /** Floats over the bottom of the map. */
  floating?: boolean;
}

/** One report on the phone (wireframe Cm10 "פרטי דיווח"): what was sent, and mark Handled, edit and delete. */
export function ReportCard({
  report,
  polygons,
  onHandle,
  onUpdate,
  onDelete,
  busy,
  error,
  ended,
  onClose,
  autoFocus,
  floating,
}: ReportCardProps) {
  const {
    editing,
    confirmingDelete,
    openEdit,
    closeEdit,
    openConfirm,
    closeConfirm,
    editButton,
    deleteButton,
    cancelDelete,
    onKeyDown,
  } = useReportEditing();
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) section.current?.focus();
  }, [autoFocus]);
  const { callsign, name } = report.reportedBy;
  const canChange = !!(onHandle && onUpdate && onDelete);
  const critical = isCriticalReport(report);

  return (
    <section
      ref={section}
      tabIndex={-1}
      className={styles.card}
      data-report-card=""
      data-floating={floating || undefined}
      aria-label="פרטי דיווח"
      onKeyDown={onKeyDown}
    >
      <CardHead report={report} critical={critical} onClose={onClose} />
      <p className={styles.meta}>
        {callsign !== null && <CallsignChip callsign={callsign} />} {name}, {polygonLabel(report, polygons)},{' '}
        <time className={styles.num} dateTime={report.reportedAt}>
          {timeLabel(report.reportedAt)}
        </time>
        {critical && ', ממתין לאימות'}
      </p>
      <div className={styles.body}>
        {report.photoUrl && (
          <a href={report.photoUrl} target="_blank" rel="noreferrer" className={styles.thumbLink}>
            <img className={styles.thumb} src={report.photoUrl} alt="תמונת הדיווח" />
          </a>
        )}
        {editing && onUpdate ? (
          <div className={styles.edit}>
            <ReportEditForm
              report={report}
              busy={busy}
              onCancel={closeEdit}
              onSave={(body) => {
                onUpdate(report.id, body);
                closeEdit();
              }}
            />
          </div>
        ) : (
          <p className={styles.text}>{report.text}</p>
        )}
      </div>
      <p className={styles.meta}>
        מיקום GPS:{' '}
        <span dir="ltr" className={styles.num}>
          {positionLabel(report)}
        </span>
      </p>
      {canChange && !editing && (
        <CardActions
          report={report}
          busy={busy}
          confirmingDelete={confirmingDelete}
          onHandle={onHandle}
          onDelete={onDelete}
          openEdit={openEdit}
          openConfirm={openConfirm}
          closeConfirm={closeConfirm}
          editButtonRef={editButton}
          deleteButtonRef={deleteButton}
          cancelDeleteRef={cancelDelete}
        />
      )}
      {!canChange && ended && <p className={styles.hint}>המסע הסתיים. הדיווחים לקריאה בלבד.</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {report.type === 'located' && <p className={styles.hint}>הדיווח אינו סוגר את המסע. רק המנהל מסיים אחרי אימות.</p>}
    </section>
  );
}

import { REPORT_TYPE_LABELS } from '@trace/domain';
import type { MissionPolygon, Report, UpdateReportBody } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CloseIcon, InfoIcon, ReportTypeIcon } from '../../components/icons';
import { ReportEditForm } from '../../mission/ReportEditForm';
import { useReportEditing } from '../../mission/useReportEditing';
import { InspectorActions } from './InspectorActions';
import { ReportFacts } from './ReportFacts';
import styles from './ReportsPage.module.css';
import { inspectorSub } from '../../mission/reportView';

export interface ReportInspectorProps {
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
}

/** The details of one report (wireframe Cd10 "פרטי דיווח"): what was sent, and mark Handled, edit and delete. */
export function ReportInspector({
  report,
  polygons,
  onHandle,
  onUpdate,
  onDelete,
  busy,
  error,
  ended,
  onClose,
}: ReportInspectorProps) {
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
  const canChange = !!(onHandle && onUpdate && onDelete);

  return (
    <aside className={`${styles.panel} ${styles.inspector}`} aria-label="פרטי דיווח" onKeyDown={onKeyDown}>
      <div className={styles.section}>
        <span className={styles.glyph} data-type={report.type}>
          <ReportTypeIcon type={report.type} />
        </span>
        <div className={styles.grow}>
          <h2 className={styles.title}>{REPORT_TYPE_LABELS[report.type]}</h2>
          <p className={styles.meta}>{inspectorSub(report)}</p>
        </div>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <CloseIcon />
        </Button>
      </div>

      <div className={styles.body}>
        {report.photoUrl && (
          <a href={report.photoUrl} target="_blank" rel="noreferrer" className={styles.photoLink}>
            <img className={styles.photo} src={report.photoUrl} alt="תמונת הדיווח" />
          </a>
        )}
        {editing && onUpdate ? (
          <ReportEditForm
            report={report}
            busy={busy}
            onCancel={closeEdit}
            onSave={(body) => {
              onUpdate(report.id, body);
              closeEdit();
            }}
          />
        ) : (
          <p className={styles.text}>{report.text}</p>
        )}
        <ReportFacts report={report} polygons={polygons} />
      </div>

      {canChange && !editing && (
        <InspectorActions
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
      {!canChange && ended && (
        <div className={styles.section}>
          <p className={styles.hint}>המסע הסתיים. הדיווחים לקריאה בלבד.</p>
        </div>
      )}
      {error && (
        <div className={styles.section}>
          <p role="alert" className={styles.error}>
            {error}
          </p>
        </div>
      )}

      {report.type === 'located' && (
        <div className={styles.section}>
          <div className={styles.banner}>
            <InfoIcon />
            <div>
              <b>דיווח אותר אינו סוגר את המסע</b>
              <p className={styles.bannerText}>המסע מסתיים רק אחרי אימות של המנהל. תצפיות על הנעדר מנוהלות ב-LKP.</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

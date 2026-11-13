import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from '@trace/domain';
import type { MissionPolygon, Report, UpdateReportBody } from '@trace/schemas';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { CloseIcon, InfoIcon, ReportTypeIcon } from '../../components/icons';
import { timeLabel } from '../../mission/timeLabel';
import { ReportEditForm } from './ReportEditForm';
import styles from './ReportsPage.module.css';
import { inspectorSub, polygonLabel, positionLabel } from './reportView';

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
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { callsign, name } = report.reportedBy;
  const canChange = !!(onHandle && onUpdate && onDelete);

  return (
    <aside className={`${styles.panel} ${styles.inspector}`} aria-label="פרטי דיווח">
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
            onCancel={() => setEditing(false)}
            onSave={(body) => {
              onUpdate(report.id, body);
              setEditing(false);
            }}
          />
        ) : (
          <p className={styles.text}>{report.text}</p>
        )}
        <dl className={styles.facts}>
          <div>
            <dt>מדווח</dt>
            <dd className={styles.reporter}>
              {callsign !== null && <CallsignChip callsign={callsign} />}
              {name}
            </dd>
          </div>
          <div>
            <dt>פוליגון</dt>
            <dd>{polygonLabel(report, polygons)}</dd>
          </div>
          <div>
            <dt>זמן</dt>
            <dd>
              <time className={styles.num} dateTime={report.reportedAt}>
                {timeLabel(report.reportedAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>סטטוס</dt>
            <dd>{REPORT_STATUS_LABELS[report.status]}</dd>
          </div>
          <div className={styles.wide}>
            <dt>מיקום GPS</dt>
            <dd>
              <span dir="ltr" className={styles.num}>
                {positionLabel(report)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {canChange && !editing && (
        <div className={`${styles.section} ${styles.column}`}>
          {confirmingDelete ? (
            <>
              <div role="group" aria-label="אישור מחיקה" className={styles.confirm}>
                <p className={styles.hint}>למחוק את הדיווח? אי אפשר לבטל.</p>
                <div className={styles.actions}>
                  <Button onPress={() => setConfirmingDelete(false)} isDisabled={busy}>
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
              <Button onPress={() => setEditing(true)} isDisabled={busy}>
                ערוך
              </Button>
              <Button variant="danger-outline" onPress={() => setConfirmingDelete(true)} isDisabled={busy}>
                מחק
              </Button>
            </div>
          )}
          <p className={styles.hint}>מחיקה למנהל בלבד. עריכה ללא היסטוריית גרסאות.</p>
        </div>
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

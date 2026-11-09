import { formatLatLng, type LngLat } from '@trace/geo';
import type { CreateSightingBody, LkpDecision, LkpPoint, Mission, Sighting } from '@trace/schemas';
import { canChangeLkp, isMissionEnded } from '@trace/domain';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../timeLabel';
import { AddSightingForm } from './AddSightingForm';
import styles from './LkpPanel.module.css';

const coordinates = (point: { coordinates: number[] }) => formatLatLng(point.coordinates as LngLat);

/** "LKP" is Latin inside Hebrew text: isolated, and kept on the line with its Hebrew prefix (wireframe tcx-nw). */
const lkpWord = (prefix: string) => (
  <span className={styles.nowrap}>
    {prefix}
    <bdi>LKP</bdi>
  </span>
);

/** Who saw the missing person, as the list says it: a commander's own sighting is "מנהל" (decision 61). */
function sourceLabel(sighting: Sighting): string {
  if (sighting.source === 'witness') return 'עד ראייה';
  return sighting.reportedBy.role === 'commander' ? 'מנהל' : 'מחפש';
}

interface LkpPanelProps {
  mission: Mission;
  /** The mission's LKP history, newest first. */
  lkps: LkpPoint[] | undefined;
  sightings: Sighting[] | undefined;
  loading: boolean;
  loadFailed: boolean;
  /** The mission accepts LKP changes and the console is online. */
  canChange: boolean;
  busy: boolean;
  error: string | null;
  selectedSightingId: string | null;
  /** The add form is open; the position comes from a click on the map. */
  adding: { position: LngLat | null } | null;
  onRetry: () => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onSubmit: (body: CreateSightingBody) => void;
  onDecide: (sightingId: string, decision: LkpDecision) => void;
  /** A field of the add form was edited. */
  onEdit: () => void;
  onClose: () => void;
}

/** The Cd06 panel: the current LKP, its history, TRACE's suggestion and the mission's sightings (UC-C04). */
export function LkpPanel({
  mission,
  lkps,
  sightings,
  loading,
  loadFailed,
  canChange,
  busy,
  error,
  selectedSightingId,
  adding,
  onRetry,
  onStartAdd,
  onCancelAdd,
  onSubmit,
  onDecide,
  onEdit,
  onClose,
}: LkpPanelProps) {
  const ended = isMissionEnded(mission.status);
  const current = lkps?.find((p) => p.current);
  const history = lkps?.filter((p) => !p.current) ?? [];
  // The newest candidate gets the card; accepting it makes the older ones stop being candidates.
  const suggested = [...(sightings ?? [])]
    .filter((s) => s.lkpCandidate)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const disabled = !canChange || busy;
  const writable = canChangeLkp(mission.status);

  return (
    <aside className={styles.panel} aria-label="LKP ותצפיות">
      <div className={`${styles.section} ${styles.head}`}>
        <div className={styles.titles}>
          <div className={styles.name}>LKP ותצפיות</div>
          <div className={styles.sub}>LKP אחד פעיל, {sightings?.length ?? 0} תצפיות</div>
        </div>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          ×
        </Button>
      </div>

      {/* The head stays; everything under it scrolls as one, so the list and the form are always reachable. */}
      <div className={styles.body} data-testid="lkp-panel-body">
        <div className={styles.section}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>LKP נוכחי</h2>
            <span className={styles.badge} data-tone="neutral">
              פעיל
            </span>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>שעה</dt>
              <dd className={styles.num}>{timeLabel(current?.observedAt ?? mission.lkp?.observedAt ?? '')}</dd>
            </div>
            <div>
              <dt>הוגדר על ידי</dt>
              <dd>{current?.setBy ?? '—'}</dd>
            </div>
            <div className={styles.wide}>
              <dt>קואורדינטות</dt>
              <dd className={styles.num} dir="ltr">
                {coordinates((current ?? mission.lkp)?.position ?? mission.rallyPoint)}
              </dd>
            </div>
          </dl>

          <h3 className={styles.label}>היסטוריה</h3>
          {history.length === 0 ? (
            <p className={styles.hint}>אין LKP קודמים.</p>
          ) : (
            <ul className={styles.history} aria-label="היסטוריה">
              {history.map((point) => (
                <li key={point.id}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="8" cy="8" r="5" />
                  </svg>
                  <span className={styles.historyText}>
                    LKP קודם,{' '}
                    <span className={styles.num} dir="ltr">
                      {coordinates(point.position)}
                    </span>
                  </span>
                  <span className={styles.meta}>{timeLabel(point.observedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {suggested && writable && (
          <div className={styles.section}>
            <div className={styles.card}>
              <span className={styles.badge} data-tone="accent">
                הצעת TRACE
              </span>
              <p className={styles.cardText}>
                תצפית {suggested.number} ({sourceLabel(suggested)}, {timeLabel(suggested.observedAt)}) מאוחרת מ
                {lkpWord('ה-')} הנוכחי. להפוך אותה {lkpWord('ל-')}?
              </p>
              <div className={styles.row}>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={disabled}
                  onPress={() => onDecide(suggested.id, 'accepted')}
                >
                  אשר
                </Button>
                <Button size="sm" isDisabled={disabled} onPress={() => onDecide(suggested.id, 'rejected')}>
                  דחה
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={`${styles.section} ${styles.sightings}`}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>
              תצפיות <span className={styles.meta}>{sightings?.length ?? 0}</span>
            </h2>
            {writable && !adding && (
              <Button size="sm" isDisabled={!canChange} onPress={onStartAdd}>
                הוסף תצפית
              </Button>
            )}
          </div>

          {adding && writable && (
            <AddSightingForm
              position={adding.position}
              busy={disabled}
              onSubmit={onSubmit}
              onCancel={onCancelAdd}
              onEdit={onEdit}
            />
          )}

          {ended && <p className={styles.hint}>המסע הסתיים. LKP ותצפיות לקריאה בלבד.</p>}
          {!ended && !canChange && <p className={styles.hint}>אין חיבור. פעולות חדשות חסומות.</p>}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          {loadFailed ? (
            <div role="alert" className={styles.loadError}>
              <p className={styles.error}>התצפיות לא נטענו.</p>
              <Button size="sm" onPress={onRetry}>
                נסה שוב
              </Button>
            </div>
          ) : loading || !sightings ? (
            <p className={styles.hint}>טוען תצפיות…</p>
          ) : sightings.length === 0 ? (
            <p className={styles.hint}>אין תצפיות עדיין.</p>
          ) : (
            <ul className={styles.list} aria-label="תצפיות">
              {sightings.map((sighting) => (
                <li
                  key={sighting.id}
                  className={styles.sighting}
                  aria-current={sighting.id === selectedSightingId ? 'true' : undefined}
                >
                  <div className={styles.sightingHead}>
                    <span className={styles.diamond} aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2l10 10-10 10L2 12z" />
                      </svg>
                      <span>{sighting.number}</span>
                    </span>
                    <span className={styles.badge} data-tone="neutral">
                      {sourceLabel(sighting)}
                    </span>
                    {sighting.reportedBy.callsign !== null && (
                      <>
                        <CallsignChip callsign={sighting.reportedBy.callsign} />
                        <span className={styles.meta}>{sighting.reportedBy.name}</span>
                      </>
                    )}
                    <span className={`${styles.meta} ${styles.num}`}>{timeLabel(sighting.observedAt)}</span>
                    {sighting.lkpCandidate && (
                      <span className={styles.badge} data-tone="accent">
                        מוצע {lkpWord('כ-')}
                      </span>
                    )}
                    {sighting.lkpDecision === 'accepted' && (
                      <span className={styles.badge} data-tone="neutral">
                        LKP
                      </span>
                    )}
                    {sighting.lkpDecision === 'rejected' && <span className={styles.meta}>נדחה</span>}
                  </div>
                  {sighting.description && <p className={styles.description}>{sighting.description}</p>}
                  {sighting.lkpCandidate && writable && (
                    <Button size="sm" isDisabled={disabled} onPress={() => onDecide(sighting.id, 'accepted')}>
                      הפוך {lkpWord('ל-')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

import type { LngLat } from '@trace/geo';
import type { CreateSightingBody, LkpDecision, LkpPoint, Mission, Sighting } from '@trace/schemas';
import { canChangeLkp, isMissionEnded } from '@trace/domain';
import { Button } from '../../components/Button';
import { AddSightingForm } from './AddSightingForm';
import { CurrentLkp } from './CurrentLkp';
import styles from './LkpPanel.module.css';
import { LkpSuggestion } from './LkpSuggestion';
import { SightingList } from './SightingList';

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
        <CurrentLkp mission={mission} lkps={lkps} />
        {suggested && writable && <LkpSuggestion sighting={suggested} disabled={disabled} onDecide={onDecide} />}

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

          <SightingList
            sightings={sightings}
            loading={loading}
            loadFailed={loadFailed}
            onRetry={onRetry}
            selectedSightingId={selectedSightingId}
            writable={writable}
            disabled={disabled}
            onDecide={onDecide}
          />
        </div>
      </div>
    </aside>
  );
}

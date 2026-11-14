import { isActiveInPolygon } from '@trace/domain';
import { isValidPolygon } from '@trace/geo';
import type { LkpPoint, Mission, Participant, Sighting } from '@trace/schemas';
import styles from '../App.module.css';
import { BoundaryEditBar } from '../../mission/BoundaryEditBar';
import { LkpPanel } from '../../mission/LkpPanel';
import { PolygonInspector } from '../../mission/PolygonInspector';
import type { usePolygonEdit } from './usePolygonEdit';
import type { useSightingPanel } from './useSightingPanel';

interface WorkspacePanelsProps {
  mission: Mission;
  participants: Participant[];
  polygon: ReturnType<typeof usePolygonEdit>;
  sighting: ReturnType<typeof useSightingPanel>;
  /** Undefined until loaded; the panel shows loading or the failure. */
  sightings: Sighting[] | undefined;
  /** The LKP history, newest first. */
  lkps: LkpPoint[] | undefined;
  sightingsLoading: boolean;
  sightingsFailed: boolean;
  onRetrySightings: () => void;
  canEditPolygons: boolean;
  canChangeSightings: boolean;
  offline: boolean;
  onClosePolygon: () => void;
  onToggleAddSighting: () => void;
}

/**
 * What floats on the mission map beside the rally point panel. The end-side slot holds one panel: the polygon
 * Inspector, or the LKP and sightings panel while no polygon is selected. Editing a boundary replaces both with its bar.
 */
export function WorkspacePanels({
  mission,
  participants,
  polygon,
  sighting,
  sightings,
  lkps,
  sightingsLoading,
  sightingsFailed,
  onRetrySightings,
  canEditPolygons,
  canChangeSightings,
  offline,
  onClosePolygon,
  onToggleAddSighting,
}: WorkspacePanelsProps) {
  const { selected, edit } = polygon;

  if (edit && selected) {
    return (
      <div className={styles.editBar}>
        <BoundaryEditBar
          name={selected.name}
          outside={polygon.outside}
          invalid={!isValidPolygon(edit.draft)}
          busy={polygon.busy}
          offline={offline}
          error={polygon.error}
          onCancel={polygon.cancelBoundaryEdit}
          onSave={polygon.saveBoundary}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <div className={styles.inspector}>
        <PolygonInspector
          key={selected.id}
          polygon={selected}
          assigned={participants.filter((p) => isActiveInPolygon(p, selected.id))}
          canEdit={canEditPolygons}
          busy={polygon.busy}
          error={polygon.error}
          onClose={onClosePolygon}
          onRename={polygon.rename}
          onEditBoundary={polygon.startBoundaryEdit}
          onDelete={polygon.remove}
        />
      </div>
    );
  }

  return (
    <>
      {sighting.open && !edit && (
        <div className={`${styles.inspector} ${styles.scrolling}`}>
          <LkpPanel
            mission={mission}
            lkps={lkps}
            sightings={sightings}
            loading={sightingsLoading}
            loadFailed={sightingsFailed}
            canChange={canChangeSightings}
            busy={sighting.busy}
            error={sighting.error}
            selectedSightingId={sighting.selectedId}
            adding={sighting.adding}
            onRetry={onRetrySightings}
            onStartAdd={onToggleAddSighting}
            onCancelAdd={sighting.cancelAdd}
            onEdit={sighting.clearError}
            onSubmit={sighting.submit}
            onDecide={sighting.decide}
            onClose={sighting.close}
          />
        </div>
      )}
      {polygon.error && (
        <p className={styles.notice} role="alert">
          {polygon.error}
        </p>
      )}
    </>
  );
}

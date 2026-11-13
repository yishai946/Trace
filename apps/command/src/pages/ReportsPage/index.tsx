import { REPORT_TYPE_LABELS, REPORT_TYPES } from '@trace/domain';
import { boundsOf, type LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type {
  LkpPoint,
  Mission,
  MissionPolygon,
  Participant,
  Report,
  Sighting,
  UpdateReportBody,
} from '@trace/schemas';
import type { ThemeId } from '@trace/design';
import { useMemo, useState } from 'react';
import { ReportTypeIcon } from '../../components/icons';
import { MissionMap, type MapFocus } from '../../map/MissionMap';
import { CriticalReportAlert } from '../../mission/CriticalReportAlert';
import { toMapData } from '../../mission/toMapData';
import { ReportInspector } from './ReportInspector';
import { ReportList } from './ReportList';
import styles from './ReportsPage.module.css';
import { filterReports, type StatusFilter, type TypeFilter } from './reportView';

export interface ReportsPageProps {
  /** Newest first, as the API returns them. `undefined` while loading. */
  reports: Report[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[] | undefined;
  lkps: LkpPoint[] | undefined;
  provider: MapProvider;
  themeId: ThemeId;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Undefined while changes are blocked: no connection, or an ended mission. */
  onHandle?: (id: string) => void;
  onUpdate?: (id: string, body: UpdateReportBody) => void;
  onDelete?: (id: string) => void;
  busy: boolean;
  error: string | null;
  ended: boolean;
}

/**
 * The mission's field reports (UC-C11, wireframe Cd10): the critical alert for a located report, the list with its
 * filters, the map of where each was sent from, and the Inspector with mark Handled, edit and delete.
 */
export function ReportsPage({
  reports,
  loadFailed,
  onRetry,
  mission,
  polygons,
  participants,
  sightings,
  lkps,
  provider,
  themeId,
  selectedId,
  onSelect,
  onHandle,
  onUpdate,
  onDelete,
  busy,
  error,
  ended,
}: ReportsPageProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  /** The commander closed the Inspector; choosing a report opens it again. */
  const [closed, setClosed] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const all = reports ?? [];
  const visible = filterReports(all, status, type);
  const shown = closed ? null : (all.find((r) => r.id === selectedId) ?? visible[0] ?? null);

  const select = (id: string) => {
    onSelect(id);
    setClosed(false);
    const report = all.find((r) => r.id === id);
    if (report) setFocus({ center: report.position.coordinates as LngLat });
  };

  // The map opens on everything the mission placed: polygons, rally point, LKP and reports. Read once, at mount.
  const [initialView] = useState(() => {
    const points = [mission.rallyPoint, ...(mission.lkp ? [mission.lkp.position] : []), ...all.map((r) => r.position)];
    const bounds = boundsOf({
      type: 'GeometryCollection',
      geometries: [...points, ...polygons.map((p) => p.geometry)],
    });
    return { center: mission.rallyPoint.coordinates as LngLat, zoom: 14, bounds };
  });
  const data = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        reports: reports ?? [],
        selectedPolygonId: null,
        editingPolygonId: null,
      }),
    [mission, polygons, participants, sightings, lkps, reports],
  );

  return (
    <div className={styles.page}>
      <CriticalReportAlert reports={all} onOpen={select} />
      <div className={styles.row}>
        <ReportList
          reports={reports}
          loadFailed={loadFailed}
          onRetry={onRetry}
          polygons={polygons}
          status={status}
          onStatusChange={setStatus}
          type={type}
          onTypeChange={setType}
          selectedId={shown?.id ?? null}
          onSelect={select}
        />
        <section className={`${styles.panel} ${styles.mapPanel}`} aria-label="מפת דיווחים">
          <div className={styles.section}>
            <h2 className={`${styles.title} ${styles.grow}`}>מפה</h2>
            <span className={styles.meta}>מיקום הדיווחים</span>
            <ul className={`${styles.legend} ${styles.fullRow}`} aria-label="מקרא">
              {REPORT_TYPES.map((t) => (
                <li key={t}>
                  <ReportTypeIcon type={t} />
                  {REPORT_TYPE_LABELS[t]}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.map}>
            <MissionMap
              provider={provider}
              themeId={themeId}
              data={data}
              initialView={initialView}
              focus={focus}
              onPointSelect={(target) => target.kind === 'report' && select(target.id)}
              controls={false}
            />
          </div>
        </section>
        {shown ? (
          <ReportInspector
            key={shown.id}
            report={shown}
            polygons={polygons}
            onHandle={onHandle}
            onUpdate={onUpdate}
            onDelete={onDelete}
            busy={busy}
            error={error}
            ended={ended}
            onClose={() => setClosed(true)}
          />
        ) : (
          reports &&
          reports.length > 0 && (
            <div className={`${styles.panel} ${styles.inspector}`}>
              <p className={styles.empty}>בחרו דיווח מהרשימה או מהמפה.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

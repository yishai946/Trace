import { isCriticalReport } from '@trace/domain';
import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { ThemeId } from '@trace/design';
import type {
  LkpPoint,
  Mission,
  MissionPolygon,
  Participant,
  Report,
  Sighting,
  UpdateReportBody,
} from '@trace/schemas';
import { useMemo, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { MissionMap, type MapFocus } from '../../map/MissionMap';
import { ReportRow } from '../../mission/ReportRow';
import {
  chipLabel,
  filterByChip,
  initialReportsView,
  REPORT_CHIPS,
  statusCounts,
  type ReportChip,
} from '../../mission/reportView';
import { toMapData } from '../../mission/toMapData';
import { ReportCard } from './ReportCard';
import styles from './PhoneReportsPage.module.css';

export interface PhoneReportsPageProps {
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
  connection: Connection;
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
 * Command on the phone, the mission's field reports (UC-C11, wireframe Cm10): list or map, filter chips, and a card
 * with mark Handled, edit and delete.
 */
export function PhoneReportsPage({
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
  connection,
  selectedId,
  onSelect,
  onHandle,
  onUpdate,
  onDelete,
  busy,
  error,
  ended,
}: PhoneReportsPageProps) {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [chip, setChip] = useState<ReportChip>('all');
  /** The commander closed the card; choosing a report shows it again. */
  const [closed, setClosed] = useState(false);
  /** The report the commander just chose: its card takes focus. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const listRef = useRef<HTMLElement>(null);

  const all = reports ?? [];
  const counts = statusCounts(all);
  const visible = filterByChip(all, chip);
  const shown = closed ? null : (visible.find((r) => r.id === selectedId) ?? visible.find(isCriticalReport) ?? null);
  const rows = visible.filter((r) => r.id !== shown?.id);

  const select = (id: string) => {
    onSelect(id);
    setClosed(false);
    setFocusId(id);
    const report = all.find((r) => r.id === id);
    if (report) setFocus({ center: report.position.coordinates as LngLat });
  };

  // The map opens on everything the mission placed: polygons, rally point, LKP and reports. Read once, at mount.
  const [initialView] = useState(() => initialReportsView({ mission, polygons, reports: all }));
  const data = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        reports: filterByChip(reports ?? [], chip),
        selectedPolygonId: null,
        editingPolygonId: null,
      }),
    [mission, polygons, participants, sightings, lkps, reports, chip],
  );

  const card = (floating: boolean) =>
    shown && (
      <ReportCard
        key={shown.id}
        report={shown}
        polygons={polygons}
        onHandle={onHandle}
        onUpdate={onUpdate}
        onDelete={
          onDelete &&
          ((id) => {
            // The card of this report goes away: focus moves to the list.
            onDelete(id);
            listRef.current?.focus();
          })
        }
        busy={busy}
        error={error}
        ended={ended}
        autoFocus={shown.id === focusId}
        floating={floating}
        onClose={() => setClosed(true)}
      />
    );

  const body =
    reports === undefined ? (
      loadFailed ? (
        <div className={styles.empty}>
          <p role="alert">לא ניתן לטעון את הדיווחים מהשרת.</p>
          <Button onPress={onRetry}>נסה שוב</Button>
        </div>
      ) : (
        <p className={styles.empty}>טוען דיווחים…</p>
      )
    ) : reports.length === 0 ? (
      <p className={styles.empty}>עוד לא התקבלו דיווחים במסע הזה.</p>
    ) : visible.length === 0 ? (
      <p className={styles.empty}>אין דיווחים שמתאימים לסינון.</p>
    ) : null;

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <h1 className={styles.title}>דיווחים</h1>
        <ConnectionStatus connection={connection} />
      </header>
      <Tabs selectedKey={view} onSelectionChange={(key) => setView(key as 'list' | 'map')} className={styles.tabs}>
        <div className={styles.controls}>
          <TabList className={styles.seg} aria-label="תצוגה">
            <Tab id="list" className={styles.segTab}>
              רשימה
            </Tab>
            <Tab id="map" className={styles.segTab}>
              מפה
            </Tab>
          </TabList>
          <ToggleButtonGroup
            className={styles.chips}
            aria-label="סינון"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[chip]}
            onSelectionChange={(keys) => setChip(([...keys][0] as ReportChip | undefined) ?? 'all')}
          >
            {REPORT_CHIPS.map((c) => (
              <ToggleButton key={c} id={c} className={styles.chip}>
                {chipLabel(c, counts)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <TabPanel id="list" className={styles.listPanel}>
          {card(false)}
          {body ??
            (rows.length > 0 && (
              <section ref={listRef} tabIndex={-1} className={styles.list} aria-label="רשימת דיווחים">
                <ul className={styles.items}>
                  {rows.map((report) => (
                    <li key={report.id}>
                      <ReportRow report={report} polygons={polygons} onSelect={select} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </TabPanel>
        <TabPanel id="map" className={styles.mapPanel}>
          <MissionMap
            provider={provider}
            themeId={themeId}
            data={data}
            initialView={initialView}
            focus={focus}
            onPointSelect={(target) => target.kind === 'report' && select(target.id)}
            controls={false}
          />
          {card(true)}
        </TabPanel>
      </Tabs>
    </div>
  );
}

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
import { TabPanel, Tabs } from 'react-aria-components';
import type { Connection } from '../../components/ConnectionStatus';
import { MissionMap } from '../../map/MissionMap';
import { ReportRow } from '../../mission/ReportRow';
import { ReportCard } from './ReportCard';
import { ListState } from '../../components/ListState';
import { PhoneScreenBar } from '../../mission/PhoneScreenBar';
import { ReportControls } from './ReportControls';
import { usePhoneReports } from './usePhoneReports';
import { choose } from '../../choose';
import styles from './PhoneReportsPage.module.css';

const VIEWS = ['list', 'map'] as const;

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
  const {
    view,
    setView,
    chip,
    setChip,
    setClosed,
    focusId,
    focus,
    listRef,
    root,
    heading,
    counts,
    visible,
    shown,
    rows,
    select,
    initialView,
    data,
  } = usePhoneReports({ reports, mission, polygons, participants, sightings, lkps, selectedId, onSelect });

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

  return (
    <div ref={root} className={styles.page}>
      <PhoneScreenBar title="דיווחים" heading={heading} connection={connection} />
      <Tabs selectedKey={view} onSelectionChange={(key) => setView(choose(VIEWS, key, 'list'))} className={styles.tabs}>
        <ReportControls chip={chip} counts={counts} onChip={setChip} />
        <TabPanel id="list" className={styles.listPanel}>
          {card(false)}
          <ListState
            items={reports}
            loadFailed={loadFailed}
            onRetry={onRetry}
            className={styles.empty}
            text={{
              failed: 'לא ניתן לטעון את הדיווחים מהשרת.',
              loading: 'טוען דיווחים…',
              empty: 'עוד לא התקבלו דיווחים במסע הזה.',
            }}
          >
            {() =>
              visible.length === 0 ? (
                <p className={styles.empty}>אין דיווחים שמתאימים לסינון.</p>
              ) : (
                rows.length > 0 && (
                  <section ref={listRef} tabIndex={-1} className={styles.list} aria-label="רשימת דיווחים">
                    <ul className={styles.items}>
                      {rows.map((report) => (
                        <li key={report.id}>
                          <ReportRow report={report} polygons={polygons} onSelect={select} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              )
            }
          </ListState>
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

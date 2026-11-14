import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, REPORT_TYPES } from '@trace/domain';
import type { MissionPolygon, Report } from '@trace/schemas';
import { Tab, TabList, TabPanel, Tabs, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { ReportRow } from '../../mission/ReportRow';
import styles from './ReportsPage.module.css';
import { filterReports, statusCounts, typeCounts, type StatusFilter, type TypeFilter } from '../../mission/reportView';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'new', label: REPORT_STATUS_LABELS.new },
  { id: 'handled', label: REPORT_STATUS_LABELS.handled },
];

export interface ReportListProps {
  /** Newest first. `undefined` while loading. */
  reports: Report[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  polygons: MissionPolygon[];
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  type: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The panel itself, so the page can move focus here when the open report is deleted. */
  sectionRef?: React.Ref<HTMLElement>;
}

/** The reports of the mission (wireframe Cd10 "רשימת דיווחים"): filter by status and category, one row per report. */
export function ReportList({
  reports,
  loadFailed,
  onRetry,
  polygons,
  status,
  onStatusChange,
  type,
  onTypeChange,
  selectedId,
  onSelect,
  sectionRef,
}: ReportListProps) {
  const all = reports ?? [];
  const byStatus = statusCounts(all);
  const byType = typeCounts(all);
  const visible = filterReports(all, status, type);

  const rows =
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
    ) : (
      <ul className={styles.items}>
        {visible.map((report) => (
          <li key={report.id}>
            <ReportRow report={report} polygons={polygons} current={report.id === selectedId} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    );

  return (
    <section ref={sectionRef} tabIndex={-1} className={`${styles.panel} ${styles.list}`} aria-label="רשימת דיווחים">
      <div className={styles.section}>
        <h2 className={`${styles.title} ${styles.grow}`}>דיווחים</h2>
        <span className={styles.meta}>{`${byStatus.all} דיווחים`}</span>
      </div>
      <Tabs selectedKey={status} onSelectionChange={(key) => onStatusChange(key as StatusFilter)}>
        <div className={styles.filters}>
          <TabList className={styles.seg} aria-label="סטטוס">
            {STATUS_TABS.map((tab) => (
              <Tab key={tab.id} id={tab.id} className={styles.segTab}>
                {`${tab.label} ${byStatus[tab.id]}`}
              </Tab>
            ))}
          </TabList>
          <ToggleButtonGroup
            className={styles.chips}
            aria-label="קטגוריה"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[type]}
            onSelectionChange={(keys) => onTypeChange(([...keys][0] as TypeFilter | undefined) ?? 'all')}
          >
            <ToggleButton id="all" className={styles.chip}>
              הכל
            </ToggleButton>
            {REPORT_TYPES.map((t) => (
              <ToggleButton key={t} id={t} className={styles.chip}>
                {`${REPORT_TYPE_LABELS[t]} ${byType[t]}`}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        {STATUS_TABS.map((tab) => (
          <TabPanel key={tab.id} id={tab.id} className={styles.rows}>
            {rows}
          </TabPanel>
        ))}
      </Tabs>
    </section>
  );
}

import type { MissionPolygon, Participant, Report } from '@trace/schemas';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import styles from './MissionSheet.module.css';
import { CallsignChip } from '../../components/CallsignChip';
import { ReportRow } from '../ReportRow';
import { statusCounts } from '../reportView';

export type SheetTab = 'alerts' | 'searchers' | 'reports';

export interface MissionSheetProps {
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Undefined while they load. */
  participants: Participant[] | undefined;
  participantsFailed: boolean;
  polygons: MissionPolygon[];
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  reportsFailed: boolean;
  /** A tap on a report opens the Reports screen on it. */
  onOpenReport: (id: string) => void;
}

/** Alerts have no phone screen yet (UC-C14, UC-C15): their tab shows no count and says so. */

/**
 * The bottom sheet of the phone mission screen (Console "Command בטלפון", wireframe Cm04): alerts, searchers and
 * reports in tabs under a grab handle that collapses and expands it.
 */
export function MissionSheet({
  tab,
  onTabChange,
  expanded,
  onExpandedChange,
  participants,
  participantsFailed,
  polygons,
  reports,
  reportsFailed,
  onOpenReport,
}: MissionSheetProps) {
  const searchers = participants?.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);

  const newReports = reports ? statusCounts(reports).new : 0;

  const searchersBody = () => {
    if (searchers) {
      if (searchers.length === 0) return <p className={styles.empty}>עוד לא הצטרפו מחפשים.</p>;
      return (
        <ul className={styles.list}>
          {searchers.map((p) => {
            const polygon = p.status === 'assigned' ? polygons.find((x) => x.id === p.polygonId) : undefined;
            return (
              <li key={p.id} className={styles.row}>
                <CallsignChip callsign={p.callsign} state={p.status === 'available' ? 'waiting' : 'normal'} />
                <span className={styles.name}>{p.name}</span>
                <span className={styles.status}>
                  <span>{p.status === 'available' ? 'זמין' : 'משובץ'}</span>
                  {polygon && <span>{polygon.name}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      );
    }
    if (participantsFailed) return <p className={styles.empty}>לא ניתן לטעון מחפשים מהשרת.</p>;
    return <p className={styles.empty}>טוען מחפשים…</p>;
  };

  const reportsBody = () => {
    if (reports) {
      if (reports.length === 0) return <p className={styles.empty}>עוד לא התקבלו דיווחים במסע הזה.</p>;
      return (
        <ul className={styles.list}>
          {reports.map((report) => (
            <li key={report.id}>
              <ReportRow report={report} polygons={polygons} onSelect={onOpenReport} />
            </li>
          ))}
        </ul>
      );
    }
    if (reportsFailed) return <p className={styles.empty}>לא ניתן לטעון את הדיווחים מהשרת.</p>;
    return <p className={styles.empty}>טוען דיווחים…</p>;
  };

  return (
    <section className={styles.sheet} data-expanded={expanded || undefined} aria-label="מצב המסע">
      <Button
        className={styles.grab}
        aria-expanded={expanded}
        aria-label={expanded ? 'הקטנת הגיליון' : 'הרחבת הגיליון'}
        onPress={() => onExpandedChange(!expanded)}
      >
        <span className={styles.handle} aria-hidden="true" />
      </Button>
      {expanded && (
        <Tabs selectedKey={tab} onSelectionChange={(key) => onTabChange(key as SheetTab)} className={styles.tabsRoot}>
          <TabList className={styles.tabs} aria-label="תצוגה">
            <Tab id="alerts" className={styles.tab}>
              התראות
            </Tab>
            <Tab id="searchers" className={styles.tab}>
              מחפשים {searchers && <span className={styles.count}>{searchers.length}</span>}
            </Tab>
            <Tab id="reports" className={styles.tab}>
              דיווחים {newReports > 0 && <span className={styles.count}>{newReports}</span>}
            </Tab>
          </TabList>
          <TabPanel id="alerts" className={styles.body}>
            <p className={styles.empty}>ההתראות יוצגו כאן בקרוב.</p>
          </TabPanel>
          <TabPanel id="searchers" className={styles.body}>
            {searchersBody()}
          </TabPanel>
          <TabPanel id="reports" className={styles.body}>
            {reportsBody()}
          </TabPanel>
        </Tabs>
      )}
    </section>
  );
}

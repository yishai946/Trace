import type { MissionPolygon, Participant } from '@trace/schemas';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import styles from './MissionSheet.module.css';
import { CallsignChip } from '../../components/CallsignChip';

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
}

/** Alerts, SOS and reports have no data or API yet (UC-C14, UC-C15): their tabs show a truthful empty state. */
const ALERTS_COUNT = 0;
const REPORTS_COUNT = 0;

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
}: MissionSheetProps) {
  const searchers = participants?.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);

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
              התראות <span className={styles.count}>{ALERTS_COUNT}</span>
            </Tab>
            <Tab id="searchers" className={styles.tab}>
              מחפשים {searchers && <span className={styles.count}>{searchers.length}</span>}
            </Tab>
            <Tab id="reports" className={styles.tab}>
              דיווחים <span className={styles.count}>{REPORTS_COUNT}</span>
            </Tab>
          </TabList>
          <TabPanel id="alerts" className={styles.body}>
            <p className={styles.empty}>אין התראות פתוחות.</p>
          </TabPanel>
          <TabPanel id="searchers" className={styles.body}>
            {searchersBody()}
          </TabPanel>
          <TabPanel id="reports" className={styles.body}>
            <p className={styles.empty}>אין דיווחים עדיין.</p>
          </TabPanel>
        </Tabs>
      )}
    </section>
  );
}

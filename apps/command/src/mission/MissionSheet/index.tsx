import type { MissionPolygon, Participant } from '@trace/schemas';
import { Button as AriaButton, Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components';
import styles from './MissionSheet.module.css';
import { CallsignChip } from '../../components/CallsignChip';

export type SheetTab = 'alerts' | 'searchers' | 'reports';

export interface MissionSheetProps {
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  /** Collapsed, only the handle and the tabs show, and the map gets the screen. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  participants: Participant[];
  polygons: MissionPolygon[];
}

/**
 * The bottom sheet of the mission screen on the phone (wireframe Cm04): "התראות / מחפשים / דיווחים" over the map.
 * Alerts and reports have no data yet; their use cases fill these tabs.
 */
export function MissionSheet({
  tab,
  onTabChange,
  expanded,
  onExpandedChange,
  participants,
  polygons,
}: MissionSheetProps) {
  const searchers = participants.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);
  const polygonName = (id: string | null) => polygons.find((p) => p.id === id)?.name;

  return (
    <section className={styles.sheet} data-expanded={expanded || undefined} aria-label="מצב המסע">
      <AriaButton
        className={styles.grab}
        aria-expanded={expanded}
        aria-label={expanded ? 'הקטנת הגיליון' : 'הרחבת הגיליון'}
        onPress={() => onExpandedChange(!expanded)}
      >
        <span className={styles.handle} aria-hidden="true" />
      </AriaButton>
      <Tabs
        className={styles.tabsRoot}
        selectedKey={tab}
        onSelectionChange={(key: Key) => {
          onTabChange(key as SheetTab);
          onExpandedChange(true);
        }}
      >
        <TabList className={styles.tabs} aria-label="מצב המסע">
          <Tab id="alerts" className={styles.tab}>
            התראות 0
          </Tab>
          <Tab id="searchers" className={styles.tab}>
            מחפשים {searchers.length}
          </Tab>
          <Tab id="reports" className={styles.tab}>
            דיווחים 0
          </Tab>
        </TabList>
        {expanded && (
          <>
            <TabPanel id="alerts" className={styles.body}>
              <p className={styles.empty}>אין התראות פתוחות.</p>
            </TabPanel>
            <TabPanel id="searchers" className={styles.body}>
              {searchers.length === 0 ? (
                <p className={styles.empty}>עוד לא הצטרפו מחפשים. שתפו את קוד ההצטרפות.</p>
              ) : (
                <ul className={styles.list}>
                  {searchers.map((p) => (
                    <li key={p.id} className={styles.row}>
                      <CallsignChip callsign={p.callsign} state={p.status === 'available' ? 'waiting' : 'normal'} />
                      <span className={styles.name}>{p.name}</span>
                      <span className={styles.sub}>
                        {p.status === 'assigned' ? (polygonName(p.polygonId) ?? 'משובץ') : 'ממתין לשיבוץ'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabPanel>
            <TabPanel id="reports" className={styles.body}>
              <p className={styles.empty}>אין דיווחים עדיין.</p>
            </TabPanel>
          </>
        )}
      </Tabs>
    </section>
  );
}

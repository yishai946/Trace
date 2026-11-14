import type { MissionPolygon, Participant } from '@trace/schemas';
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import styles from './SearchersPage.module.css';
import { Button } from '../../components/Button';

/** "שבץ" for a waiting searcher, "העבר" for an assigned one: a menu of the mission's other polygons (Cd08). */
export function AssignMenu({
  participant,
  polygons,
  onAssign,
}: {
  participant: Participant;
  polygons: MissionPolygon[];
  onAssign?: (participantId: string, polygonId: string) => void;
}) {
  const assigned = participant.status === 'assigned';
  const targets = polygons.filter((p) => !assigned || p.id !== participant.polygonId);
  const label = assigned ? 'העבר' : 'שבץ';
  return (
    <MenuTrigger>
      <Button size="sm" aria-label={`${label} את ${participant.name}`} isDisabled={!onAssign || targets.length === 0}>
        {label}
      </Button>
      <Popover className={styles.popover} placement="bottom end">
        <Menu
          className={styles.menu}
          aria-label={`פוליגונים לשיבוץ ${participant.name}`}
          items={targets}
          onAction={(polygonId) => onAssign?.(participant.id, String(polygonId))}
        >
          {(polygon) => (
            <MenuItem id={polygon.id} className={styles.item}>
              {polygon.name}
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

import type { SessionUser } from '@trace/schemas';
import { Button as AriaButton } from 'react-aria-components';
import styles from './MorePage.module.css';
import { ChevronStartIcon, InfoIcon, ListIcon } from '../../components/icons';
import { ROLE_LABELS, SignOutButton, initials, type SignOutProps } from '../../components/ProfileMenu';
import { ThemeSelect } from '../../components/ThemeSelect';

export interface MorePageProps extends SignOutProps {
  user: SessionUser;
  /** Opens the mission details and join code panel. */
  onMissionDetails: () => void;
  /** Goes to the full mission list. */
  onAllMissions: () => void;
}

/**
 * "עוד" on the phone (wireframe Cm16): the mission's other screens, and the same account details, theme and sign-out
 * as the profile menu. Rows for polygons, LKP, SOS, timeline and mission control join with their use cases.
 */
export function MorePage({ user, onMissionDetails, onAllMissions, ...signOut }: MorePageProps) {
  return (
    <div className={styles.page}>
      <h2 className={styles.section}>במסע</h2>
      <AriaButton className={styles.row} onPress={onMissionDetails}>
        <InfoIcon />
        <span className={styles.text}>פרטי מסע וקוד הצטרפות</span>
        <ChevronStartIcon />
      </AriaButton>

      <h2 className={styles.section}>חשבון</h2>
      <div className={styles.row} data-static data-large>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.meta}>{ROLE_LABELS[user.role]}</span>
        </span>
        <span className={styles.meta} dir="ltr">
          {user.email}
        </span>
      </div>
      <div className={styles.row} data-static>
        <div className={styles.text}>
          <ThemeSelect inline />
        </div>
      </div>
      <AriaButton className={styles.row} onPress={onAllMissions}>
        <ListIcon />
        <span className={styles.text}>כל המסעות</span>
        <ChevronStartIcon />
      </AriaButton>
      <div className={styles.signOut}>
        <SignOutButton {...signOut} />
      </div>
    </div>
  );
}

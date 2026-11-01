import type { SessionUser } from '@trace/schemas';
import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from 'react-aria-components';
import styles from './ProfileMenu.module.css';
import { MonitorIcon, MoonIcon, SignOutIcon, SunIcon } from './icons';
import { useTheme, type ThemePreference } from '../../theme/theme';

const ROLE_LABELS: Record<SessionUser['role'], string> = { commander: 'מנהל מסע', searcher: 'מחפש שטח' };

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
  { id: 'day', label: 'יום', icon: <SunIcon /> },
  { id: 'night', label: 'לילה', icon: <MoonIcon /> },
  { id: 'system', label: 'לפי המכשיר', icon: <MonitorIcon /> },
];

/** Up to two letters from the user's name, for the avatar. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('');
}

export interface ProfileMenuProps {
  user: SessionUser;
  /** Signing out needs the server to revoke the session, so it waits for a connection. */
  canSignOut: boolean;
  signingOut: boolean;
  signOutFailed: boolean;
  onSignOut: () => void;
}

/** The avatar at the end of the AppBar. Opens the user's details, the theme choice and sign-out. */
export function ProfileMenu({ user, canSignOut, signingOut, signOutFailed, onSignOut }: ProfileMenuProps) {
  const { preference, setPreference } = useTheme();
  const role = ROLE_LABELS[user.role];

  return (
    <DialogTrigger>
      <AriaButton className={styles.avatar} aria-label={`פרופיל: ${user.name}, ${role}`}>
        {initials(user.name)}
      </AriaButton>
      <Popover className={styles.popover} placement="bottom end" offset={8}>
        <Dialog className={styles.dialog} aria-label="פרופיל">
          <div className={styles.section}>
            <div className={styles.identity}>
              <span className={styles.avatar} data-static aria-hidden="true">
                {initials(user.name)}
              </span>
              <div className={styles.who}>
                <div className={styles.name}>{user.name}</div>
                <div className={styles.meta}>{role}</div>
                <div className={styles.email} dir="ltr">
                  {user.email}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <Select
              className={styles.theme}
              selectedKey={preference}
              onSelectionChange={(key: Key | null) => key && setPreference(key as ThemePreference)}
            >
              <Label className={styles.meta}>ערכת צבעים</Label>
              <AriaButton className={styles.select}>
                <SelectValue className={styles.option}>
                  {({ selectedItem }) => {
                    const option = THEME_OPTIONS.find((o) => o.id === (selectedItem as { id?: Key } | null)?.id);
                    return option ? (
                      <>
                        {option.icon}
                        {option.label}
                      </>
                    ) : null;
                  }}
                </SelectValue>
                <span className={styles.chevron} aria-hidden="true">
                  ▾
                </span>
              </AriaButton>
              <Popover className={styles.listPopover}>
                <ListBox className={styles.list} items={THEME_OPTIONS}>
                  {(option) => (
                    <ListBoxItem id={option.id} textValue={option.label} className={styles.item}>
                      {option.icon}
                      {option.label}
                    </ListBoxItem>
                  )}
                </ListBox>
              </Popover>
            </Select>
          </div>

          <div className={styles.section}>
            <AriaButton className={styles.signOut} onPress={onSignOut} isDisabled={!canSignOut || signingOut}>
              <SignOutIcon />
              {signingOut ? 'יוצא…' : 'יציאה'}
            </AriaButton>
            {!canSignOut && <p className={styles.note}>אפשר לצאת כשהחיבור יחזור.</p>}
            {signOutFailed && (
              <p className={styles.note} role="alert">
                היציאה נכשלה. נסו שוב.
              </p>
            )}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

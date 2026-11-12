import { useId } from 'react';
import { telHref } from '@trace/domain';
import { LinkButton } from '../Button';
import { PhoneIcon } from '../icons';
import styles from './CallButton.module.css';

const NO_PHONE_REASON = 'אין מספר טלפון למחפש';

export interface CallButtonProps {
  /** The searcher's number in E.164, as `Participant.phone`. */
  phone: string;
  /** The searcher's name, for the screen reader label. */
  name: string;
  /** `label` is the primary "התקשר" button (searcher details); `icon` is the icon button of a list row. */
  display?: 'label' | 'icon';
}

/**
 * Calls a searcher (UC-C13): a `tel:` link that opens the device's regular dialer, with no VoIP (decision 78).
 * Without a usable number it stays in place, disabled, and says why.
 */
export function CallButton({ phone, name, display = 'label' }: CallButtonProps) {
  const href = telHref(phone);
  const reasonId = useId();
  const button = (
    <LinkButton
      variant={display === 'icon' ? 'icon' : 'primary'}
      href={href ?? undefined}
      isDisabled={href === null}
      aria-describedby={href === null ? reasonId : undefined}
      aria-label={`התקשר ל${name}`}
    >
      <PhoneIcon />
      {display === 'label' ? 'התקשר' : null}
    </LinkButton>
  );
  // React Aria's Link does not pass `title` to the anchor, so the reason sits on a wrapper for mouse users,
  // and in a visually hidden element that the link points to for keyboard and screen reader users.
  return href === null ? (
    <span title={NO_PHONE_REASON}>
      {button}
      <span id={reasonId} className={styles.reason}>
        {NO_PHONE_REASON}
      </span>
    </span>
  ) : (
    button
  );
}

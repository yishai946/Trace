import { telHref } from '@trace/domain';
import { LinkButton } from '../Button';
import { PhoneIcon } from '../icons';

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
  const button = (
    <LinkButton
      variant={display === 'icon' ? 'icon' : 'primary'}
      href={href ?? undefined}
      isDisabled={href === null}
      aria-label={`התקשר ל${name}`}
    >
      <PhoneIcon />
      {display === 'label' ? 'התקשר' : null}
    </LinkButton>
  );
  // React Aria's Link does not pass `title` to the anchor, so the reason sits on a wrapper.
  return href === null ? <span title="אין מספר טלפון למחפש">{button}</span> : button;
}

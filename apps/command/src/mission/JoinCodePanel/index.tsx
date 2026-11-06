import { joinLink } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { useState } from 'react';
import { Button } from '../../components/Button';
import styles from './JoinCodePanel.module.css';
import { QrCode } from './QrCode';

/** Where Field answers join links. A web address in production; the app's own scheme in development. */
const JOIN_LINK_BASE = import.meta.env.VITE_JOIN_LINK_BASE || 'trace-field://';

interface JoinCodePanelProps {
  mission: Pick<Mission, 'joinCode' | 'status'>;
  onClose: () => void;
}

type Copied = 'code' | 'link' | null;

/** The mission's join code, QR and link for searchers to join (UC-C02 step 4, decision 6, wireframe Cd05). */
export function JoinCodePanel({ mission, onClose }: JoinCodePanelProps) {
  const link = joinLink(JOIN_LINK_BASE, mission.joinCode);
  const [copied, setCopied] = useState<Copied>(null);
  const canShare = typeof navigator.share === 'function';
  const open = mission.status === 'active';

  const copy = async (what: Exclude<Copied, null>) => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? mission.joinCode : link);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className={styles.panel} aria-label="קוד הצטרפות">
      <div className={styles.head}>
        <h2 className={styles.title}>קוד הצטרפות</h2>
        <span className={styles.badge}>
          {open && <span className={styles.dot} aria-hidden="true" />}
          {open ? 'הצטרפות פתוחה' : 'הצטרפות חסומה'}
        </span>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.body}>
        <QrCode value={link} label="קוד QR להצטרפות למסע" />
        <div className={styles.code} aria-label={`קוד ${mission.joinCode}`} dir="ltr">
          {mission.joinCode}
        </div>
        <div className={styles.link}>
          <span className={styles.url} dir="ltr">
            {link}
          </span>
          <Button variant="icon" aria-label="העתק קישור" onPress={() => void copy('link')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
            </svg>
          </Button>
        </div>
        <div className={styles.actions}>
          <Button onPress={() => void copy('code')}>העתק קוד</Button>
          {canShare && (
            <Button
              onPress={() =>
                void navigator.share({ title: 'הצטרפות למסע', text: `קוד הצטרפות: ${mission.joinCode}`, url: link })
              }
            >
              שתף
            </Button>
          )}
        </div>
        <span className={styles.copied} role="status">
          {copied === 'code' ? 'הקוד הועתק.' : copied === 'link' ? 'הקישור הועתק.' : ''}
        </span>
      </div>
      <p className={styles.note}>אפשר להצטרף כל עוד המסע פעיל. במסע מושהה או שהסתיים ההצטרפות חסומה.</p>
    </section>
  );
}

import { useState } from 'react';
import { Button as AriaButton, Input, TextField as AriaTextField } from 'react-aria-components';
import styles from './NewMissionPage.module.css';

interface MissionNameTitleProps {
  /** The mission's name as it will be saved; empty until there is one. */
  name: string;
  /** A name typed by hand. An empty one goes back to following the missing person's name. */
  onRename: (name: string) => void;
}

/** The screen title: the mission's name, which follows the missing person's name until the commander edits it. */
export function MissionNameTitle({ name, onRename }: MissionNameTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <h1 className={styles.title}>
        <AriaButton
          className={styles.titleButton}
          aria-label={`${name || 'מסע חדש'}, עריכת שם המסע`}
          onPress={() => setDraft(name)}
        >
          {name || 'מסע חדש'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
          </svg>
        </AriaButton>
      </h1>
    );
  }

  const commit = () => {
    onRename(draft.trim());
    setDraft(null);
  };
  return (
    <AriaTextField className={styles.titleField} aria-label="שם המסע" value={draft} onChange={setDraft} autoFocus>
      <Input
        className={styles.titleInput}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(null);
          }
        }}
      />
    </AriaTextField>
  );
}

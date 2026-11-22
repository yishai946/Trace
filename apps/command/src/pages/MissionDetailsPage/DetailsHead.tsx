import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import styles from './MissionDetailsPage.module.css';

interface DetailsHeadProps {
  readOnly: boolean;
  canSave: boolean;
  saving: boolean;
  /** The commander marks the change as significant: the searchers get a push and the Timeline records it. */
  notify: boolean;
  onNotifyChange: (notify: boolean) => void;
  onClose: () => void;
}

/** The title of the details panel and its actions: notify the searchers, cancel and save. */
export function DetailsHead({ readOnly, canSave, saving, notify, onNotifyChange, onClose }: DetailsHeadProps) {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>פרטי מסע ונעדר</h2>
      {!readOnly && (
        <Checkbox isSelected={notify} onChange={onNotifyChange} isDisabled={saving}>
          עדכן את המחפשים
        </Checkbox>
      )}
      <Button onPress={onClose}>בטל</Button>
      {!readOnly && (
        <Button type="submit" variant="primary" isDisabled={!canSave}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 5 5 9-10" />
          </svg>
          {saving ? 'שומר…' : 'שמור שינויים'}
        </Button>
      )}
    </div>
  );
}

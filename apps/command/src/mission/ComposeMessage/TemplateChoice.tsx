import { MESSAGE_TEMPLATES } from '@trace/domain';
import { ToggleButton } from 'react-aria-components';
import styles from './ComposeMessage.module.css';

interface TemplateChoiceProps {
  /** The text in the field: a chip is pressed while the text is still exactly its template. */
  body: string;
  onChange: (body: string) => void;
}

/** Ready-made messages (decision 26). A chip fills the text field; pressing it again clears the text. */
export function TemplateChoice({ body, onChange }: TemplateChoiceProps) {
  return (
    <div className={styles.field} role="group" aria-label="תבניות">
      <span className={styles.label} aria-hidden="true">
        תבניות
      </span>
      <div className={styles.chips}>
        {MESSAGE_TEMPLATES.map((template) => (
          <ToggleButton
            key={template.id}
            className={styles.chip}
            isSelected={body === template.text}
            onChange={(selected) => onChange(selected ? template.text : '')}
          >
            {template.label}
          </ToggleButton>
        ))}
      </div>
    </div>
  );
}

import {
  Input,
  Label,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<AriaTextFieldProps, 'children'> {
  label: string;
  /** Latin values (email, password) read left to right inside the RTL form, aligned to its end like the wireframe. */
  ltr?: boolean;
}

/** A labelled input: height `control-h`, border `border-field` (brand book §contrast). */
export function TextField({ label, ltr = false, className, ...props }: TextFieldProps) {
  return (
    <AriaTextField {...props} className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} dir={ltr ? 'ltr' : undefined} data-ltr={ltr || undefined} />
    </AriaTextField>
  );
}

import {
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<AriaTextFieldProps, 'children'> {
  label: string;
  /** Latin values (email, password, coordinates) read left to right inside the RTL form, aligned to its end. */
  ltr?: boolean;
  /** A hint under the field. */
  description?: string;
  /** Shown under the field, with a `warning` border, while `isInvalid` is set. */
  errorMessage?: string;
  /** A text area of this many rows instead of a one-line input. */
  rows?: number;
  placeholder?: string;
  /** `lg` is the large phone input (48px). */
  size?: 'md' | 'lg';
}

/** A labelled input: height `control-h`, border `border-field` (brand book §contrast). */
export function TextField({
  label,
  ltr = false,
  description,
  errorMessage,
  rows,
  placeholder,
  size = 'md',
  className,
  ...props
}: TextFieldProps) {
  const control = {
    className: styles.input,
    placeholder,
    dir: ltr ? 'ltr' : undefined,
    'data-ltr': ltr || undefined,
    'data-size': size === 'lg' ? 'lg' : undefined,
  };
  return (
    <AriaTextField {...props} className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label className={styles.label}>{label}</Label>
      {rows ? <TextArea {...control} rows={rows} data-multiline /> : <Input {...control} />}
      {description && (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <FieldError className={styles.error}>{errorMessage}</FieldError>
    </AriaTextField>
  );
}

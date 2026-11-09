import { AuthLayout } from '../AuthLayout';
import { Button } from '../Button';
import { TextField } from '../TextField';

export interface PhoneStepProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}

/** Fm01, step 1: the phone number the code is sent to. */
export function PhoneStep({ value, onChange, onSubmit, pending, error }: PhoneStepProps) {
  return (
    <AuthLayout
      heading="הזן מספר טלפון"
      steps={{ labels: ['טלפון', 'אימות'], current: 0 }}
      footer={
        <Button
          label={pending ? 'שולח…' : 'שלח קוד'}
          variant="primary"
          size="lg"
          block
          disabled={!value.trim() || pending}
          onPress={onSubmit}
        />
      }
    >
      <TextField
        label="מספר טלפון"
        ltr
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        value={value}
        onChangeText={onChange}
        error={error}
        onSubmitEditing={onSubmit}
      />
    </AuthLayout>
  );
}

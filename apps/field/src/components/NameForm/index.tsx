import { SEARCHER_NAME_MAX, SearcherName } from '@trace/schemas';
import { typography } from '@trace/design';
import { useState } from 'react';
import { Text } from 'react-native';
import { ApiRequestError } from '../../api';
import { saveNameErrorMessage, useSaveName } from '../../auth';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { AuthLayout } from '../AuthLayout';
import { Button } from '../Button';
import { TextField } from '../TextField';

export interface NameFormProps {
  /** The name was saved. */
  onSaved: () => void;
  /** The session expired while saving; the searcher is signed out. */
  onSignedOut: () => void;
}

/** UC-F01: the searcher's name, asked on first sign-in only. */
export function NameForm({ onSaved, onSignedOut }: NameFormProps) {
  const { color } = useTheme().theme;
  const signOut = useSession((s) => s.signOut);
  const save = useSaveName();
  const [name, setName] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const expired = save.error instanceof ApiRequestError && save.error.status === 401;

  const submit = () => {
    if (save.isPending) return;
    const parsed = SearcherName.safeParse(name);
    if (!parsed.success) {
      setClientError(name.trim() === '' ? 'הזן שם.' : 'השם לא תקין.');
      return;
    }
    setClientError(null);
    save.mutate(parsed.data, {
      onSuccess: onSaved,
      onError: (error) => {
        if (error instanceof ApiRequestError && error.status === 401) void signOut().then(onSignedOut);
      },
    });
  };

  return (
    <AuthLayout
      heading="הזן את שמך"
      footer={
        <Button
          label={save.isPending ? 'שומר…' : 'שמור והמשך'}
          variant="primary"
          size="lg"
          block
          disabled={save.isPending}
          onPress={submit}
        />
      }
    >
      <Text style={[typography.body, { color: color.inkSecondary }]}>בכניסה הראשונה בלבד. השם מוצג למנהל המסע.</Text>
      <TextField
        label="שם מלא"
        autoComplete="name"
        textContentType="name"
        autoFocus
        maxLength={SEARCHER_NAME_MAX}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setClientError(null);
        }}
        error={clientError ?? (save.isError && !expired ? saveNameErrorMessage(save.error) : null)}
        onSubmitEditing={submit}
      />
    </AuthLayout>
  );
}

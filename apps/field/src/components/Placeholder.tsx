import { typography } from '@trace/design';
import { Text } from 'react-native';
import { ltr } from '../i18n/rtl';
import { useTheme } from '../theme';

/** Marks a skeleton screen whose content belongs to a use case that is not built yet. */
export function Placeholder({ useCase }: { useCase: string }) {
  const { color } = useTheme().theme;
  return (
    <Text style={[typography.body, { color: color.inkMuted }]}>{`מסך שלד. התוכן ייבנה ב-${ltr(useCase)}.`}</Text>
  );
}

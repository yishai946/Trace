import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import type { ReportItem } from '../../reports/reportItems';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { ReportCard } from '../ReportCard';

export interface ReportsListProps {
  items: ReportItem[];
  /** `loading` only while there is nothing to show yet: a refresh in the background keeps the list. */
  state: 'loading' | 'error' | 'ready';
  /** What an empty list says, which depends on the filter. */
  empty: string;
  selectedId: string | null;
  /** The id of the report to open, or null to close the open one. */
  onSelect: (id: string | null) => void;
  onRetry: () => void;
}

/** The reports as cards (Fm10), with the loading, error and empty states of the screen (UC-F11). */
export function ReportsList({ items, state, empty, selectedId, onSelect, onRetry }: ReportsListProps) {
  const { color } = useTheme().theme;
  if (state === 'loading') {
    return (
      <Text role="status" accessibilityLiveRegion="polite" style={[typography.body, { color: color.inkSecondary }]}>
        טוען דיווחים…
      </Text>
    );
  }
  if (state === 'error') {
    return (
      <View accessibilityRole="alert" style={styles.message}>
        <Text style={[typography.body, { color: color.ink }]}>לא ניתן לטעון את הדיווחים</Text>
        <Button label="נסה שוב" onPress={onRetry} />
      </View>
    );
  }
  if (items.length === 0) return <Text style={[typography.body, { color: color.inkSecondary }]}>{empty}</Text>;
  return (
    <View accessibilityLabel="רשימת דיווחים" style={styles.list}>
      {items.map((item) => (
        <ReportCard
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onPress={() => onSelect(item.id === selectedId ? null : item.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.space1 },
  message: { gap: spacing.space5, alignItems: 'flex-start' },
});

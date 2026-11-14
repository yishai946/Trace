import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import type { ReportItem } from '../../reports/reportItems';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { ReportCard } from '../ReportCard';

export interface ReportsListProps {
  items: ReportItem[];
  /** `loading` or `error` only while nothing was read yet: a refresh in the background keeps the list. */
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
  // The note comes first and the known reports stay below it: the searcher's own reports that wait on the phone must
  // not disappear because the list could not be read.
  const note =
    state === 'loading' ? (
      <Text role="status" accessibilityLiveRegion="polite" style={[typography.body, { color: color.inkSecondary }]}>
        טוען דיווחים…
      </Text>
    ) : state === 'error' ? (
      <View accessibilityRole="alert" style={styles.message}>
        <Text style={[typography.body, { color: color.ink }]}>לא ניתן לטעון את הדיווחים</Text>
        <Button label="נסה שוב" onPress={onRetry} />
      </View>
    ) : null;
  const emptyText =
    state === 'ready' && items.length === 0 ? (
      <Text style={[typography.body, { color: color.inkSecondary }]}>{empty}</Text>
    ) : null;
  return (
    <View style={styles.stack}>
      {note}
      {emptyText}
      {items.length > 0 ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space6 },
  list: { gap: spacing.space1 },
  message: { gap: spacing.space5, alignItems: 'flex-start' },
});

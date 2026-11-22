import { spacing } from '@trace/design';
import { StyleSheet, View } from 'react-native';
import { useRejectedReports } from '../../reports/useRejectedReports';
import { Button } from '../Button';
import { Notice } from '../Notice';

/**
 * Said when reports that waited on the phone were refused by the server for good (for example the mission ended, or
 * access was removed): the commander did not get them (UC-F09). Stays until the searcher confirms it.
 */
export function RejectedReportsNotice() {
  const { count, acknowledge } = useRejectedReports();
  if (count === 0) return null;
  const text =
    count === 1
      ? 'דיווח שהמתין במכשיר לא התקבל בשרת ונמחק מהמכשיר. המנהל לא קיבל אותו.'
      : `${count} דיווחים שהמתינו במכשיר לא התקבלו בשרת ונמחקו מהמכשיר. המנהל לא קיבל אותם.`;
  return (
    <View style={styles.box}>
      <Notice tone="warn" icon="alert" live>
        {text}
      </Notice>
      <Button label="הבנתי" onPress={acknowledge} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.space4 } });

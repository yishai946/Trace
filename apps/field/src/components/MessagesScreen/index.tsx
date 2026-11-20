import { spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { countNeedingAttention } from '../../messages/messageList';
import { useMissionMessages } from '../../messages/useMissionMessages';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { MessageCard } from '../MessageCard';
import { Notice } from '../Notice';
import { Screen } from '../Screen';

/** Fm11: the commander's messages, newest first (UC-F12). The channel is one way: there is no reply. */
export function MessagesScreen() {
  const { color } = useTheme().theme;
  const messages = useMissionMessages();
  const list = messages.data ?? [];
  const unread = countNeedingAttention(list);
  // `loading` or `error` only while nothing was read yet: a refresh in the background keeps the list.
  const waiting = list.length === 0 && messages.isPending;
  const failed = list.length === 0 && messages.isError;

  return (
    <Screen
      title="הודעות מהמנהל"
      tabbed
      action={unread > 0 ? <Badge tone="accent" label={`${unread} חדשות`} /> : undefined}
      footer={
        <Notice icon="messages">
          הודעות חד-כיווניות מהמנהל, ללא מענה בצ'אט. הודעה שנשלחה כשהיית לא מקוון מופיעה כאן עם החיבור.
        </Notice>
      }
    >
      {waiting ? (
        <Text role="status" accessibilityLiveRegion="polite" style={[typography.body, { color: color.inkSecondary }]}>
          טוען הודעות…
        </Text>
      ) : null}
      {failed ? (
        <View accessibilityRole="alert" style={styles.message}>
          <Text style={[typography.body, { color: color.ink }]}>לא ניתן לטעון את ההודעות</Text>
          <Button label="נסה שוב" onPress={() => void messages.refetch()} />
        </View>
      ) : null}
      {messages.isSuccess && list.length === 0 ? (
        <Text style={[typography.body, { color: color.inkSecondary }]}>עדיין לא התקבלו הודעות מהמנהל</Text>
      ) : null}
      {list.length > 0 ? (
        <View accessibilityLabel="רשימת הודעות" style={styles.list}>
          {list.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.space5 },
  message: { gap: spacing.space5, alignItems: 'flex-start' },
});

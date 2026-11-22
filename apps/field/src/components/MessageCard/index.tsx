import { radius, spacing, typography } from '@trace/design';
import type { OwnMessage } from '@trace/schemas';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessageReceipt } from '../../messages/useMessageReceipt';
import { targetLabel } from '../../messages/messageTarget';
import { formatTime } from '../../mission/missionArea';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { UrgencyBadge, urgencyLabel } from './UrgencyBadge';

function statusLine(message: OwnMessage): string | null {
  if (message.acknowledgedAt) return `אושרה, ${formatTime(message.acknowledgedAt)}`;
  if (message.readAt) return `נקראה, ${formatTime(message.readAt)}`;
  return null;
}

/**
 * One message from the commander (Fm11). Opening an unread one reports it read; a critical one shows "אישרתי" until
 * it is acknowledged (UC-F12, decision 27). The urgency shows in the border and the badge, never in color alone.
 */
export function MessageCard({ message }: { message: OwnMessage }) {
  const { color } = useTheme().theme;
  const receipt = useMessageReceipt();
  const unread = message.status === 'sent';
  const status = statusLine(message);
  const awaitingAck = message.requiresAcknowledgement && message.status !== 'acknowledged';
  const border = {
    normal: { borderColor: color.borderStrong, borderWidth: 1 },
    important: { borderColor: color.inkMuted, borderWidth: pendingTokens.cardStrongBorder },
    critical: { borderColor: color.ink, borderWidth: pendingTokens.cardStrongBorder },
  }[message.urgency];
  // An unread message shows a short preview until it is opened; critical ones are open, they ask for an answer.
  const preview = unread && !message.requiresAcknowledgement;

  const content = (
    <>
      <View style={styles.head}>
        <UrgencyBadge urgency={message.urgency} />
        <Text style={[typography.meta, { color: color.inkMuted }]}>{targetLabel(message.target)}</Text>
        <View style={styles.fill} />
        {unread ? <Badge label="חדשה" tone="accent" dot /> : null}
      </View>
      <Text
        numberOfLines={preview ? 2 : undefined}
        style={[typography.body, { color: message.status === 'read' ? color.inkSecondary : color.ink }]}
      >
        {message.body}
      </Text>
      <Text style={[typography.meta, { color: color.inkMuted }]}>
        {`${message.sender.name}, מנהל מסע, ${formatTime(message.sentAt)}`}
      </Text>
      {status ? <Text style={[typography.meta, { color: color.inkMuted }]}>{status}</Text> : null}
    </>
  );

  return (
    <View
      accessibilityLabel={`הודעה ${urgencyLabel[message.urgency]}`}
      style={[styles.card, border, { backgroundColor: color.surface }]}
    >
      {unread ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`פתח הודעה ${urgencyLabel[message.urgency]}`}
          disabled={receipt.isPending}
          onPress={() => receipt.send({ messageId: message.id, receipt: 'read' })}
          style={styles.content}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
      {awaitingAck ? (
        <View style={styles.ack}>
          {receipt.isError && receipt.variables?.receipt === 'acknowledged' ? (
            <Notice icon="alert" tone="warn" live>
              האישור לא נשלח. נסו שוב.
            </Notice>
          ) : null}
          <Button
            label="אישרתי"
            variant="primary"
            size="lg"
            block
            icon="check"
            disabled={receipt.isPending}
            onPress={() => receipt.send({ messageId: message.id, receipt: 'acknowledged' })}
          />
          <Text style={[typography.meta, styles.hint, { color: color.inkMuted }]}>נדרש אישור כדי להמשיך</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 },
  content: { gap: spacing.space4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  fill: { flex: 1 },
  ack: { gap: spacing.space4 },
  hint: { textAlign: 'center' },
});

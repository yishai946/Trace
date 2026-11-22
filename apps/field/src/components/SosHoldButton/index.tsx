import { spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ltr } from '../../i18n/rtl';
import { SOS_HOLD_MS, useHoldToActivate } from '../../sos/useHoldToActivate';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

const HOLD_SECONDS = SOS_HOLD_MS / 1_000;
const ACTIVATE = 'activate';

/**
 * The round SOS button (Fm12 `.tcx-sosbtn` in its ring). Only holding it for 3 seconds sends the SOS: a tap or an
 * early release does nothing, so a pocket touch cannot raise a false alarm (UC-F13). A screen reader user cannot hold,
 * so the button offers the custom action "הפעל SOS", which they must choose on purpose; a plain double tap does not send.
 */
export function SosHoldButton({ sending, onActivate }: { sending: boolean; onActivate: () => void }) {
  const { color } = useTheme().theme;
  const { secondsLeft, progress, start, cancel } = useHoldToActivate({ onComplete: onActivate, disabled: sending });
  const ring = pendingTokens.sosRing;
  const hint = sending
    ? 'שולח…'
    : secondsLeft === null
      ? `החזק ${ltr(HOLD_SECONDS)} שניות`
      : `המשך להחזיק, ${ltr(secondsLeft)}`;
  const center = ring / 2;
  const radius = (ring - pendingTokens.sosRingStroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <View style={styles.ring}>
      <Svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} style={styles.svg} aria-hidden>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color.danger}
          strokeOpacity={pendingTokens.disabledOpacity}
          strokeWidth={pendingTokens.sosRingStroke}
        />
        <Circle
          testID="sos-progress"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color.danger}
          strokeWidth={pendingTokens.sosRingStroke}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - progress)}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`הפעל SOS, לחיצה ארוכה ${HOLD_SECONDS} שניות`}
        accessibilityHint="לחיצה רגילה לא שולחת. אפשר גם לבחור בפעולה הפעל SOS."
        accessibilityActions={[{ name: ACTIVATE, label: 'הפעל SOS' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === ACTIVATE && !sending) onActivate();
        }}
        accessibilityState={{ busy: sending, disabled: sending }}
        disabled={sending}
        onPressIn={start}
        onPressOut={cancel}
        // Web only (react-native-web): dragging the mouse off the button cancels the hold. On a phone the press ends
        // by itself once the finger leaves the button's retention area.
        onHoverOut={cancel}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: color.danger,
            opacity: sending ? pendingTokens.disabledOpacity : pressed ? pendingTokens.pressedOpacity : 1,
          },
        ]}
      >
        <Text style={[typography.title, styles.label, { color: color.onDanger }]}>SOS</Text>
        <Text
          aria-hidden
          style={[typography.meta, { color: color.onDanger, fontWeight: typography.bodyStrong.fontWeight }]}
        >
          {hint}
        </Text>
      </Pressable>
      <Text role="status" accessibilityLiveRegion="polite" style={styles.announce}>
        {secondsLeft === null ? '' : hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: pendingTokens.sosRing,
    height: pendingTokens.sosRing,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: { position: 'absolute' },
  announce: { position: 'absolute', opacity: 0, pointerEvents: 'none' },
  button: {
    width: pendingTokens.sosButton,
    height: pendingTokens.sosButton,
    borderRadius: pendingTokens.sosButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space1,
  },
  label: {
    fontSize: pendingTokens.sosLabelSize,
    lineHeight: pendingTokens.sosLabelLeading,
    fontWeight: typography.callsign.fontWeight,
  },
});

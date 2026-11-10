import { spacing, typography } from '@trace/design';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Icon } from '../Icon';

export interface StepsProps {
  steps: string[];
  /** Index of the step the searcher is on. */
  current: number;
}

/** The stepper of Fm01 (`.tcx-steps`): done steps carry a check, the current one the accent. Read as one line. */
export function Steps({ steps, current }: StepsProps) {
  const { color } = useTheme().theme;
  return (
    <View
      accessible
      accessibilityLabel={`שלב ${current + 1} מתוך ${steps.length}, ${steps[current]}`}
      style={styles.row}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <Fragment key={label}>
            {i > 0 ? <View style={[styles.separator, { borderTopColor: color.borderField }]} /> : null}
            <View style={styles.step}>
              <View
                style={[
                  styles.marker,
                  {
                    borderColor: on ? color.accent : done ? color.inkSecondary : color.inkMuted,
                    backgroundColor: on ? color.accent : 'transparent',
                  },
                ]}
              >
                {done ? (
                  <Icon name="check" size={pendingTokens.stepIcon} color={color.inkSecondary} />
                ) : (
                  <Text style={[typography.callsign, { color: on ? color.surface : color.inkMuted }]}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  typography.meta,
                  { color: on ? color.ink : color.inkMuted },
                  on && { fontWeight: typography.bodyStrong.fontWeight },
                ]}
              >
                {label}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  marker: {
    width: pendingTokens.stepMarker,
    height: pendingTokens.stepMarker,
    borderRadius: pendingTokens.stepMarker / 2,
    borderWidth: pendingTokens.strongBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { width: pendingTokens.stepSeparatorW, borderTopWidth: 1 },
});

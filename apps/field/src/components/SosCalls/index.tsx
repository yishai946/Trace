import { spacing } from '@trace/design';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { dial, EMERGENCY_NUMBER } from '../../phone';
import { Button } from '../Button';
import { CallCommanderButton } from '../CallCommanderButton';
import { Notice } from '../Notice';

/**
 * Fm12: the commander and emergency services, side by side and always on the SOS tab (UC-F14, decision 79).
 * Both go through the regular dialer, so they work with no connection.
 */
export function SosCalls() {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.stack}>
      {failed ? (
        <Notice icon="alert" tone="warn" live>
          {`לא ניתן לפתוח את החייגן. אפשר להתקשר ידנית לשירותי החירום (${EMERGENCY_NUMBER}).`}
        </Notice>
      ) : null}
      <CallCommanderButton />
      <Button
        label={`חירום ${EMERGENCY_NUMBER}`}
        accessibilityLabel={`התקשר לחירום ${EMERGENCY_NUMBER}`}
        variant="danger"
        size="lg"
        block
        icon="phone"
        onPress={() => void dial(EMERGENCY_NUMBER).then((opened) => setFailed(!opened))}
      />
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.space4 } });

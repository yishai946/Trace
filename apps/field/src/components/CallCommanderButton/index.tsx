import { useState } from 'react';
import { dial } from '../../phone';
import { useMission } from '../../mission/queries';
import { Button } from '../Button';
import { Notice } from '../Notice';

/** "התקשר למנהל" (UC-F14): the regular dialer with the commander's phone. Nothing shows while there is no phone. */
export function CallCommanderButton() {
  const phone = useMission().data?.commander.phoneNumber ?? null;
  const [failed, setFailed] = useState(false);
  if (!phone) return null;

  return (
    <>
      {failed ? (
        <Notice icon="alert" tone="warn" live>
          לא ניתן לפתוח את החייגן. אפשר להתקשר ידנית למנהל.
        </Notice>
      ) : null}
      <Button
        label="התקשר למנהל"
        size="lg"
        block
        icon="phone"
        onPress={() => {
          void dial(phone).then((opened) => setFailed(!opened));
        }}
      />
    </>
  );
}

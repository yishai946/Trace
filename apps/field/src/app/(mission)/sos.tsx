import { Button } from '../../components/Button';
import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';

/** Fm12: SOS. Activation (a 3 second long press) belongs to UC-F13; the button stays disabled until then. */
export default function SosScreen() {
  return (
    <Screen title="חירום">
      <Button label="SOS" accessibilityLabel="הפעל SOS, לחיצה ארוכה 3 שניות" variant="danger" size="lg" block disabled />
      <Placeholder useCase="UC-F13" />
    </Screen>
  );
}

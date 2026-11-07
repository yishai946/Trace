import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';

/** Fm11: one-way messages from the commander. */
export default function MessagesScreen() {
  return (
    <Screen title="הודעות מהמנהל" tabbed>
      <Placeholder useCase="UC-F12" />
    </Screen>
  );
}

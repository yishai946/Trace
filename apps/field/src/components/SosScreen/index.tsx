import { spacing } from '@trace/design';
import { StyleSheet, View } from 'react-native';
import { useCurrentFix } from '../../location/useCurrentFix';
import { endedSentence, ownActiveSos, ownClosedSos, sosLocationOf } from '../../sos/sosList';
import { useActivateSos } from '../../sos/useActivateSos';
import { useCloseSos } from '../../sos/useCloseSos';
import { useMissionSos } from '../../sos/useMissionSos';
import { useMissionPolygons } from '../../mission/queries';
import { useSession } from '../../state/session';
import { Notice } from '../Notice';
import { Screen } from '../Screen';
import { SosActivation } from '../SosActivation';
import { SosActive } from '../SosActive';

/** Fm12: the SOS tab (UC-F13). It shows the activation view, or the active SOS with a way to close it. */
export function SosScreen() {
  const participation = useSession((s) => s.participation);
  const list = useMissionSos();
  const polygons = useMissionPolygons();
  const { fix } = useCurrentFix({ prompt: false });
  const activate = useActivateSos();
  const close = useCloseSos();

  const active = ownActiveSos(list.data ?? [], participation?.id);
  const closed = ownClosedSos(list.data ?? [], participation?.id);
  const polygonName = polygons.data?.find((p) => p.id === participation?.polygonId)?.name ?? null;
  const endedNote = endedSentence(closed);

  const send = (message: string) => activate.mutate({ message, location: sosLocationOf(fix) });

  return (
    <Screen title="חירום" tabbed>
      <View style={styles.stack}>
        {list.isError ? (
          <Notice icon="alert" tone="warn">
            לא הצלחנו לבדוק אם יש SOS פעיל. אפשר עדיין להפעיל SOS.
          </Notice>
        ) : null}
        {active ? (
          <SosActive
            sos={active}
            closing={close.isPending}
            closeFailed={close.isError}
            onClose={() => close.mutate(active.id)}
          />
        ) : (
          <SosActivation
            callsign={participation?.callsign ?? null}
            polygonName={polygonName}
            fix={fix}
            sending={activate.isPending}
            failed={activate.isError}
            endedNote={endedNote}
            onActivate={send}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.space6 } });

import { typography } from '@trace/design';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../components/Button';
import { EDIT_MESSAGES, ReportEditForm } from '../components/ReportEditForm';
import { Screen } from '../components/Screen';
import { goBackOr } from '../navigation/navigate';
import { routes } from '../navigation/routes';
import { isMine } from '../reports/reportVisibility';
import { useMissionReports } from '../reports/useMissionReports';
import { useSession } from '../state/session';
import { useTheme } from '../theme';

/** Edit my own report: its category and text (UC-C11, decision 88). Opened over the reports screen with `?id=`. */
export default function ReportEditScreen() {
  const router = useRouter();
  const { color } = useTheme().theme;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const reports = useMissionReports();
  const back = () => goBackOr(router, routes.reports);

  if (!missionId) return <Redirect href={routes.map} />;

  const report = reports.data?.find((r) => r.id === id);
  const leading = <Button label="חזרה" icon="close" variant="ghost" onPress={back} />;
  const message = (text: string) => <Text style={[typography.body, { color: color.inkSecondary }]}>{text}</Text>;

  if (!report) {
    if (reports.isError && !reports.data) {
      return (
        <Screen title="עריכת דיווח" leading={leading}>
          <Text accessibilityRole="alert" style={[typography.body, { color: color.ink }]}>
            לא ניתן לטעון את הדיווח
          </Text>
          <Button label="נסה שוב" onPress={() => void reports.refetch()} />
        </Screen>
      );
    }
    return (
      <Screen title="עריכת דיווח" leading={leading}>
        {reports.isLoading ? (
          <Text role="status" accessibilityLiveRegion="polite" style={[typography.body, { color: color.inkSecondary }]}>
            טוען דיווח…
          </Text>
        ) : (
          message(EDIT_MESSAGES.gone)
        )}
      </Screen>
    );
  }
  if (!participation || !isMine(report, participation)) {
    return (
      <Screen title="עריכת דיווח" leading={leading}>
        {message(EDIT_MESSAGES.notOwner)}
      </Screen>
    );
  }
  return <ReportEditForm report={report} onCancel={back} onDone={back} />;
}

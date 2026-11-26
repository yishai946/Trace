import { radius, spacing, typography } from '@trace/design';
import type { MissionPolygon, OwnParticipation } from '@trace/schemas';
import { StyleSheet, Text, View } from 'react-native';
import type { AssignmentNotice } from '../../state/session';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { CallsignChip } from '../CallsignChip';
import { SearchPauseControls } from './SearchPauseControls';
import { StartSearchControls } from './StartSearchControls';

export interface AssignedTaskProps {
  participation: OwnParticipation;
  polygons: MissionPolygon[];
  /** The commander assigned or moved the searcher while the app was open. */
  notice: AssignmentNotice | null;
  onDismissNotice: () => void;
  /** Starts the search (UC-F06). Without it, or before the offline package is saved, the button stays disabled. */
  onStartSearch?: () => void;
  /** The start is on its way to the server: no second tap. */
  starting?: boolean;
  /** Why the last start failed, in Hebrew; the searcher can press again. */
  startError?: string | null;
  /** Personal Pause and Resume (UC-F07). Without them the buttons stay disabled. */
  onPause?: () => void;
  onResume?: () => void;
  /** A pause or resume is on its way to the server: no second tap. */
  pausing?: boolean;
  /** Why the last pause or resume failed, in Hebrew. */
  pauseError?: string | null;
}

/**
 * Fm05: the polygon the commander assigned and the task in it (UC-F05). The searcher stays Assigned, at Ready, until
 * they press Start Search: getting there is not searching (decision 28), so nothing counts toward Coverage before.
 */
export function AssignedTask({
  participation,
  polygons,
  notice,
  onDismissNotice,
  onStartSearch,
  starting = false,
  startError = null,
  onPause,
  onResume,
  pausing = false,
  pauseError = null,
}: AssignedTaskProps) {
  const { color } = useTheme().theme;
  const polygon = polygons.find((p) => p.id === participation.polygonId);
  // Right after an assignment the polygon list may still be loading: say it without a name rather than a wrong one.
  const name = polygon?.name;
  const noticeName = polygons.find((p) => p.id === notice?.polygonId)?.name;
  const to = (polygonName: string | undefined) => (polygonName ? `לפוליגון ${polygonName}` : 'לפוליגון');

  const paused = participation.taskStatus === 'paused';
  const searching = participation.taskStatus === 'searching' || paused;
  return (
    <View style={styles.task} accessibilityLabel="המשימה שלי">
      {notice ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.notice, { borderColor: color.accent }]}
        >
          <Text style={[typography.body, styles.grow, { color: color.ink }]}>
            {notice.kind === 'moved'
              ? `הועברת ${to(noticeName)}. המשימה הקודמת נשמרה.`
              : `המנהל שיבץ אותך ${to(noticeName)}.`}
          </Text>
          <Button label="הבנתי" variant="ghost" onPress={onDismissNotice} />
        </View>
      ) : null}
      <View style={styles.row}>
        <CallsignChip callsign={participation.callsign} />
        <View style={styles.grow}>
          <Text style={[typography.title, { color: color.ink }]}>
            {searching
              ? name
                ? `${paused ? 'מושהה' : 'בחיפוש'}, ${name}`
                : paused
                  ? 'מושהה'
                  : 'בחיפוש'
              : `שובצת ${to(name)}`}
          </Text>
          {polygon ? (
            <Text style={[typography.meta, { color: color.inkMuted }]}>
              {polygon.activeSearchers === 1 ? 'מחפש אחד בפוליגון' : `${polygon.activeSearchers} מחפשים בפוליגון`}
            </Text>
          ) : null}
        </View>
        <Badge
          label={paused ? 'מושהה' : searching ? 'בחיפוש' : 'משובץ'}
          tone={paused ? 'warn' : searching ? 'ok' : 'accent'}
        />
      </View>
      {searching ? (
        // Finishing the search is UC-F08.
        <SearchPauseControls
          paused={paused}
          onPause={onPause}
          onResume={onResume}
          pending={pausing}
          error={pauseError}
        />
      ) : (
        <StartSearchControls onStartSearch={onStartSearch} starting={starting} startError={startError} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  task: { gap: spacing.space5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space5 },
  grow: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space4,
    paddingVertical: spacing.space2,
    paddingStart: spacing.space5,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
});

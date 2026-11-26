import { typography } from '@trace/design';
import { Text } from 'react-native';
import { useTheme } from '../../theme';
import type { SearchFinishControlsProps } from './SearchFinishControls';
import { SearchFinishControls } from './SearchFinishControls';
import { SearchPauseControls, type SearchPauseControlsProps } from './SearchPauseControls';
import { StartSearchControls, type StartSearchControlsProps } from './StartSearchControls';

interface TaskActionsProps {
  status: string | null;
  start: StartSearchControlsProps;
  pause: Omit<SearchPauseControlsProps, 'paused'>;
  finish: SearchFinishControlsProps;
}

/** What the searcher can press for the task's status: Start Search, Pause or Resume and Finish, or nothing once finished. */
export function TaskActions({ status, start, pause, finish }: TaskActionsProps) {
  const { color } = useTheme().theme;
  if (status === 'searching' || status === 'paused') {
    return (
      <>
        <SearchPauseControls paused={status === 'paused'} {...pause} />
        <SearchFinishControls {...finish} />
      </>
    );
  }
  if (status === 'finished') {
    // The commander decides what comes next (UC-F08, decision 100): nothing to press here.
    return (
      <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: color.inkMuted }]}>
        סיימת את החיפוש. אתה עדיין משובץ לפוליגון, והמנהל יחליט מה הלאה. מעקב הבטיחות ממשיך.
      </Text>
    );
  }
  return <StartSearchControls {...start} />;
}

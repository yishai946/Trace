import { useState } from 'react';
import type { SheetTab } from '../MissionSheet';
import type { MissionTab } from '../MissionTabBar';
import { PHONE_SCREENS, type PhoneScreen } from '../phoneScreen';

/** The sheet's tab and height, and what the bottom tab bar does and marks. */
export function useSheetTabs(screen: PhoneScreen, onScreenChange: (screen: PhoneScreen) => void) {
  const [tab, setTab] = useState<SheetTab>('alerts');
  const [expanded, setExpanded] = useState(true);

  const navigate = (next: MissionTab) => {
    const target = PHONE_SCREENS.find((s) => s === next);
    if (target) {
      onScreenChange(target);
      return;
    }
    setTab(next === 'searchers' ? 'searchers' : 'alerts');
    setExpanded(true);
    onScreenChange('map');
  };
  // The sheet's own reports tab lists them in the sheet, so it keeps "לוח" marked.
  const current: MissionTab = screen !== 'map' ? screen : tab === 'searchers' ? 'searchers' : 'board';
  return { tab, setTab, expanded, setExpanded, navigate, current };
}

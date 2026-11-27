import { useState } from 'react';
/** The mission control of the phone mission screen, held by the console. */
export interface PhoneControl {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The mission can be ended now: the critical alert offers to verify and end it (UC-C16). */
  canEnd: boolean;
}

/**
 * What the phone bar opens over the map: the join code, the place search and the mission control (Cm13).
 * They share the space under the bar, so opening one closes the others.
 */
export function useBarToggles(joinOpen: boolean, onJoinOpenChange: (open: boolean) => void, control?: PhoneControl) {
  const [searchOpen, setSearchOpen] = useState(false);
  return {
    searchOpen,
    closeSearch: () => setSearchOpen(false),
    toggleJoin: () => {
      setSearchOpen(false);
      if (!joinOpen) control?.onOpenChange(false);
      onJoinOpenChange(!joinOpen);
    },
    toggleSearch: () => {
      if (!searchOpen) {
        onJoinOpenChange(false);
        control?.onOpenChange(false);
      }
      setSearchOpen(!searchOpen);
    },
    control: control && {
      open: control.open,
      onToggle: () => {
        if (!control.open) {
          setSearchOpen(false);
          onJoinOpenChange(false);
        }
        control.onOpenChange(!control.open);
      },
    },
  };
}

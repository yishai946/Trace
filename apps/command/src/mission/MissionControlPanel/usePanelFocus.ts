import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Keyboard use of a panel that floats over the map: focus moves to its title when it opens, Escape inside it closes
 * it, and focus returns to what opened it once it closes.
 */
export function usePanelFocus(onClose: () => void) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    heading.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return {
    heading,
    /** Only keys pressed in the panel itself: a popover over it (the confirmation) handles its own Escape. */
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Escape' || !(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
      e.stopPropagation();
      onClose();
    },
  };
}

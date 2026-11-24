import { useEffect, useRef, useState } from 'react';

/** Pointer travel time from the tile to its panel: interaction timing, not a design value. */
const CLOSE_DELAY_MS = 250;

/** Open while the pointer is over the tile or its panel (or the tile has focus), as Google Maps' layer tile. */
export function useHoverOpen() {
  const [isOpen, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = () => {
    cancel();
    setOpen(true);
  };
  const close = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  useEffect(() => cancel, []);

  return { isOpen, setOpen, hover: { onMouseEnter: open, onMouseLeave: close, onFocus: open } };
}

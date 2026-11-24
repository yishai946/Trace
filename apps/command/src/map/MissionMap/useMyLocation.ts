import { useEffect, useRef, useState } from 'react';

type Position = [number, number];

/** A fix this recent is reused rather than waiting for a new one: interaction timing, not a design value. */
const MAX_AGE_MS = 60_000;

/**
 * The commander's own position, for the "my location" button. The first press asks the browser (which can take a few
 * seconds for a GPS fix); after that the position is watched, so later presses jump at once and the map can show it.
 */
export function useMyLocation(onFound: (position: Position) => void) {
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const last = useRef<Position | null>(null);
  const watch = useRef<number | null>(null);
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(
    () => () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );

  const locate = () => {
    if (last.current) return onFound(last.current);
    if (!supported || pending) return;
    setPending(true);
    let first = true;
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        last.current = [coords.longitude, coords.latitude];
        setPosition(last.current);
        setFailed(false);
        setPending(false);
        if (first) onFound(last.current);
        first = false;
      },
      () => {
        setPending(false);
        if (last.current) return;
        // No fix at all: stop watching so the next press asks again.
        setFailed(true);
        if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
        watch.current = null;
      },
      { maximumAge: MAX_AGE_MS, timeout: 10_000 },
    );
  };

  return { locate: supported ? locate : undefined, pending, failed, position };
}

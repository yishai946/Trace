import { useCallback, useEffect, useState } from 'react';

/** Counts down whole seconds. `start(n)` begins at `n`; the count stops at 0. */
export function useCountdown(): [seconds: number, start: (seconds: number) => void] {
  const [seconds, setSeconds] = useState(0);
  const running = seconds > 0;

  // Synchronizes with a timer, an external system.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback((n: number) => setSeconds(Math.max(0, Math.floor(n))), []);
  return [seconds, start];
}

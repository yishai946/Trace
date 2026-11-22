import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the searcher holds the SOS button before it is sent (UC-F13, Fm12: "החזק 3 שניות"). */
export const SOS_HOLD_MS = 3_000;
const TICK_MS = 1_000;
/** How often the ring progress is redrawn; about 20 frames a second is smooth enough for a 3 second ring. */
const PROGRESS_MS = 50;

/**
 * The long press that protects the SOS from an accidental touch. `start` begins the hold, `cancel` ends it (the finger
 * lifted or moved away), and `onComplete` runs only when the whole hold was kept. `secondsLeft` is null while not held, and
 * `progress` is the kept fraction of the hold, 0 to 1, for the ring.
 */
export function useHoldToActivate({ onComplete, disabled = false }: { onComplete: () => void; disabled?: boolean }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const timers = useRef<{
    done: ReturnType<typeof setTimeout>;
    tick: ReturnType<typeof setInterval>;
    frame: ReturnType<typeof setInterval>;
  } | null>(null);
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  });

  const cancel = useCallback(() => {
    if (timers.current) {
      clearTimeout(timers.current.done);
      clearInterval(timers.current.tick);
      clearInterval(timers.current.frame);
      timers.current = null;
    }
    setSecondsLeft(null);
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (disabled || timers.current) return;
    const startedAt = Date.now();
    setSecondsLeft(SOS_HOLD_MS / TICK_MS);
    timers.current = {
      done: setTimeout(() => {
        cancel();
        complete.current();
      }, SOS_HOLD_MS),
      tick: setInterval(
        () => setSecondsLeft(Math.max(1, Math.ceil((SOS_HOLD_MS - (Date.now() - startedAt)) / TICK_MS))),
        TICK_MS,
      ),
      frame: setInterval(() => setProgress(Math.min(1, (Date.now() - startedAt) / SOS_HOLD_MS)), PROGRESS_MS),
    };
  }, [disabled, cancel]);

  useEffect(() => cancel, [cancel]);

  return { secondsLeft, progress, start, cancel };
}

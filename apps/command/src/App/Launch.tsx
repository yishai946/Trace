import { useEffect, useState } from 'react';
import { useSession } from '../auth';
import { Splash } from '../components/Splash';
import { App } from '.';

/** Loading shorter than this shows no splash at all, so a refresh with a quick answer goes straight to the console. */
export const SPLASH_DELAY_MS = 400;

/** The console, with the launch splash on top only while the session is still loading after a moment. */
export function Launch() {
  const loading = useSession().isPending;
  const [slow, setSlow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SPLASH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const splashUp = slow && !done;
  return (
    <>
      {/* inert: nobody can tab into, or hear, the console while the splash covers it. */}
      <div style={{ display: 'contents' }} inert={splashUp}>
        <App />
      </div>
      {splashUp && <Splash ready={!loading} onDone={() => setDone(true)} />}
    </>
  );
}

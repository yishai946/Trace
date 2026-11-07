import { useState } from 'react';
import { useSession } from '../auth';
import { Splash } from '../components/Splash';
import { App } from '.';

/** The console with the launch splash on top until the session has loaded and the splash has opened the screen. */
export function Launch() {
  const session = useSession();
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      <App />
      {!splashDone && <Splash ready={!session.isPending} onDone={() => setSplashDone(true)} />}
    </>
  );
}

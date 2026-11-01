import { z } from 'zod';
import { createAuth, createCommander } from '../auth';
import { createDb } from '../db';
import { loadEnv } from '../env';

// Creates a commander account (UC-C01 precondition): there is no public sign-up.
// pnpm --filter @trace/api auth:create-commander --email a@b.org --name "ישראל ישראלי" --password '...'

const Args = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(12, 'Use a password of at least 12 characters'),
});

const flags = Object.fromEntries(
  process.argv.slice(2).flatMap((arg, i, all) => (arg.startsWith('--') ? [[arg.slice(2), all[i + 1] ?? '']] : [])),
);
const args = Args.safeParse(flags);
if (!args.success) {
  console.error(`Invalid arguments:\n${z.prettifyError(args.error)}`);
  process.exit(1);
}

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
try {
  const auth = createAuth({ env, db, sendOtp: async () => {} });
  await createCommander(auth, args.data);
  console.info(`Created commander ${args.data.email}.`);
} finally {
  await close();
}

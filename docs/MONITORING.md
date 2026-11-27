# Monitoring: error tracking and logs

TRACE reports unexpected errors to **Sentry** and ships the API's logs to **Grafana Cloud Loki**. Both have a free tier, both are off until their variables are set, and no app needs either to run or to pass its tests. This is the setup runbook for the platform engineer and the guide for finding what went wrong.

The decisions behind it: Sentry for errors in all three apps; Loki (not a log drain or a server of our own) because the API already writes JSON lines with pino and `pino-loki` ships them from a worker thread, so a slow network never delays a request.

## What is sent, and what is not

- **Errors.** Everything unexpected: API 5xx and unhandled exceptions, uncaught errors and React render errors in Command, JS and native crashes in Field, and server failures or response-shape bugs in a Command or Field query. **Not sent:** 4xx answers (they are expected outcomes) and being offline (`NETWORK_ERROR`), in every app.
- **No personal data.** `sendDefaultPii` is off, and every event and breadcrumb passes the shared scrubber in `packages/monitoring` before it leaves the process: it removes phone numbers, OTP codes, tokens and cookies, `Authorization` headers, coordinates and `lat`/`lng`, and the same values inside URLs and messages. The API logger uses the same key list (`SENSITIVE_KEYS`) for its redaction, so there is one list to extend.
- **Sampling.** Every error is sent (`sampleRate: 1`). Performance traces: 5% in `production`, none elsewhere (the API's `SENTRY_TRACES_SAMPLE_RATE` overrides it). No Session Replay and no profiling. At most 30 breadcrumbs per event.
- **Errors that are logged and not thrown.** A failure the API handles without answering an HTTP request with 500 (a realtime sign-in, session check or join, sending push notifications, the report-recipients lookup) goes through `logAndReport` in `apps/api/src/monitoring`: one `error` log line and one Sentry event, tagged `source` (`realtime.sign-in`, `realtime.session-check`, `realtime.join`, `push.send`, `reports.recipients`). Expected outcomes are not reported there either: a refused join, a dead push token, a device Expo could not reach (logged at `warn`). New code that catches an unexpected error and carries on calls `logAndReport`, not `log.error` alone.
- **Sentry's pino integration is off** in the API, on purpose. Reporting `error` log lines automatically would send each HTTP 500 twice (the error handler logs and reports it) and would send events without the `request_id` and `source` tags. Errors are reported by explicit calls only. Sentry's default dedupe still drops an event identical to the one just before it, so a failure that repeats in a loop (a database outage seen by every session check) is one event, not a flood.

## One-time setup

### Sentry

1. Create a Sentry account (the free Developer plan) and an organization.
2. Create **three projects**, one per app, so quotas, alerts and releases stay separate: `trace-api` (platform Node.js), `trace-command` (React) and `trace-field` (React Native). Each project's **Client Keys (DSN)** page has its DSN.
3. In each project, **Settings > Spike Protection**: keep it on. Under **Client Keys > Configure**, set a **rate limit** per key (for example 100 events per hour), so one crash loop cannot use the month's quota.
4. Create an **auth token** for source maps (Settings > Developer Settings > Organization token). It is a secret: it goes in the Command build environment and the GitHub repository secrets only, never in a `.env` file or the repository.
5. Create the alert rule below.

### Grafana Cloud (Loki)

1. Create a Grafana Cloud stack (the free plan).
2. Open the stack's **Loki** details (Connections > Loki, or the stack's "Details" page). Note the **URL** (`https://logs-prod-XXX.grafana.net`) and the **User** (a number).
3. Create an access policy and token with only the `logs:write` scope (Administration > Access policies). Its token is `LOKI_TOKEN`. A token that can only write cannot read logs back if it leaks.

## Variables

None is a secret except the ones marked. Nothing here goes in the repository: use the host's environment settings.

| Variable                              | App            | Set in                                        | Meaning                                                                                                      |
| ------------------------------------- | -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SENTRY_DSN`                          | API            | API host environment                          | `trace-api` DSN. Without it Sentry stays off.                                                                |
| `SENTRY_ENVIRONMENT`                  | API            | API host environment                          | `production` or `staging`. Defaults to `NODE_ENV`. Also the Loki `environment` label.                        |
| `SENTRY_RELEASE`                      | API            | API host environment (deploy)                 | Defaults to `trace-api@<package version>`. Set it to the git SHA to tell deploys apart.                      |
| `SENTRY_TRACES_SAMPLE_RATE`           | API            | API host environment                          | 0 to 1. Defaults to 0.05 in production, 0 elsewhere.                                                         |
| `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN` | API            | API host environment (token secret)           | All three or none; the API refuses to start with only some. Without them, stdout only.                       |
| `VITE_SENTRY_DSN`                     | Command        | Build environment of Command                  | `trace-command` DSN, inlined into the bundle. Public by design.                                              |
| `VITE_SENTRY_ENVIRONMENT`             | Command        | Build environment of Command                  | Defaults to the Vite mode (`production` for a build).                                                        |
| `VITE_SENTRY_RELEASE`                 | Command        | Build environment and the upload              | For example `trace-command@<git sha>`; must equal the release the source maps go under.                      |
| `EXPO_PUBLIC_SENTRY_DSN`              | Field          | GitHub repository variable                    | `trace-field` DSN, inlined into the app. Public by design.                                                   |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT`      | Field          | Build environment of Field                    | Defaults to `development` in dev builds and `production` otherwise.                                          |
| `SENTRY_AUTH_TOKEN`                   | Command, Field | Command build secret, GitHub secret           | Turns the source map upload on. Without it builds pass and upload nothing. Never in a `.env` file.           |
| `SENTRY_ORG`, `SENTRY_PROJECT`        | Command, Field | Command build env, GitHub repository variable | Organization slug (required with the token) and project slug (defaults to `trace-command` or `trace-field`). |

The example files list the same variables, commented out: `apps/api/.env.example`, `apps/command/.env.example`, `apps/field/.env.example`.

## Quotas and limits

Check the current limits on each service's pricing page before relying on them; free tiers change. At the time of writing:

- **Sentry Developer plan:** about 5,000 errors a month, 30 days of retention, one user. Spike Protection and the per-key rate limit (above) keep a bad deploy from using it up. Traces are sampled at 5% in production to stay inside the span allowance. If the quota is reached Sentry drops further events until the month ends; the apps are unaffected.
- **Grafana Cloud free plan:** about 50 GB of logs a month and 14 days of retention. API logs at `info` with one line per request are far below that for the MVP. If volume grows, set `LOG_LEVEL=warn` before paying for more.

## Finding an error

1. **By issue.** Sentry > Issues, filter `environment:production`. Each issue is one distinct error with its count, first and last time, and the release it first appeared in.
2. **By request or source.** An event for an HTTP request has the tag `request_id`, which is also the `reqId` of every log line of that request and the `x-request-id` response header. From a client report ("it failed at 14:03"), find the request in the logs; from a Sentry event, copy its `request_id`. An event outside a request has the tag `source` instead; filter `source:push.send` to see every push failure.
3. **By release.** Filter `release:trace-api@0.1.0` (or the git SHA) to see what a deploy introduced; an issue's "First seen in" release shows the deploy that broke it.

## Finding logs (Grafana Cloud)

Grafana > Explore > the Loki data source. The labels are `app` (`trace-api`), `environment` and `level` (`debug`, `info`, `warning`, `error`, `critical`). `reqId` is a JSON field, not a label, so it is filtered after `| json`:

```logql
# Everything one request wrote, from a Sentry request_id tag
{app="trace-api"} | json | reqId="req-1a"

# Errors in production, newest first
{app="trace-api", environment="production", level="error"}

# Slow requests
{app="trace-api"} |= "request completed" | json | responseTime > 1000
```

## Alert rule

In the `trace-api`, `trace-command` and `trace-field` projects: **Alerts > Create Alert > Issues**:

- When: **A new issue is created**
- If: `environment` equals `production`
- Then: send a notification to the team (email, or the Slack integration's channel)

New issues only, not every event, so one bug is one message.

## Source maps

Minified stack traces are unreadable without them. Without the upload, errors are still reported, just with minified frames.

- **Command.** `vite build` writes hidden source maps (`sourcemap: 'hidden'`: the files exist, but the bundle does not point to them). `@sentry/vite-plugin` (`apps/command/vite.config.ts`, options in `apps/command/config/sourceMapUpload`) then does the rest in the same build when `SENTRY_AUTH_TOKEN` is set in the build environment, with `SENTRY_ORG` (and `SENTRY_PROJECT` if it is not `trace-command`):

  1. adds the debug ids that match each bundle to its map;
  2. uploads the maps under `VITE_SENTRY_RELEASE` (or `trace-command@<package version>` when it is not set; the plugin then also injects that release into the bundle, so the app reports the same one);
  3. deletes every `.map` file in `apps/command/dist`, so the server never serves them.

  ```bash
  SENTRY_AUTH_TOKEN=<token> SENTRY_ORG=<org slug> VITE_SENTRY_RELEASE="trace-command@$(git rev-parse --short HEAD)" \
    pnpm --filter @trace/command build
  ```

  Without the token the plugin is off: the build passes, the maps stay in `dist` (unreferenced) and nothing is sent. A token without `SENTRY_ORG` fails the build, so a half-configured deploy is noticed. Plugin telemetry is off. A failed upload (Sentry down, a revoked token) is logged and does not fail the build; look for `sentry-vite-plugin` warnings in the build log.

- **Field.** `apps/field/app.config.ts` extends `app.json` and configures the `@sentry/react-native/expo` config plugin from the build environment; `metro.config.js` (`getSentryExpoConfig`) adds the debug ids. Field is built by the `Field Android APK` workflow (`.github/workflows/field-android-apk.yml`), not by EAS. With the repository secret `SENTRY_AUTH_TOKEN` and the repository variable `SENTRY_ORG` set (Settings > Secrets and variables > Actions), the Release build uploads the JS source maps (not native debug symbols) to `trace-field`. A Debug build uploads nothing. A token without `SENTRY_ORG` fails the build, and so should a failed upload (unlike Command). The workflow does not pass `SENTRY_PROJECT` or `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, so a Release APK uses `trace-field` and `production`. The token is read from the environment by sentry-cli and never written into the native project. The app reports errors only when the repository variable `EXPO_PUBLIC_SENTRY_DSN` is set.

  Without the token (a fork, a local `expo prebuild`, the unsigned iOS workflow) `app.config.ts` turns the upload off (`disableAutoUpload`, the same as `SENTRY_DISABLE_AUTO_UPLOAD=true`) and the build passes; errors are then reported with minified frames.

- **Check it once after setting up.** In a production build, trigger a test error (Sentry > the project > "Verify installation", or a throw behind a debug action), then open the event: the stack trace shows file names and lines from `src/`, not `index-<hash>.js:1:23456` or `index.android.bundle`. If not, compare the event's release and debug id with Sentry > Settings > the project > Source Maps.

## Local development

Leave every variable unset. Nothing is sent, the API logs to the terminal, and the suites make no network calls. To try the pipeline locally, set a `SENTRY_DSN` of a test project and `SENTRY_ENVIRONMENT=development`.

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
4. Create an **auth token** for source maps (Settings > Developer Settings > Organization token). It is a secret: it goes in CI and EAS only, never in a `.env` file or the repository.
5. Create the alert rule below.

### Grafana Cloud (Loki)

1. Create a Grafana Cloud stack (the free plan).
2. Open the stack's **Loki** details (Connections > Loki, or the stack's "Details" page). Note the **URL** (`https://logs-prod-XXX.grafana.net`) and the **User** (a number).
3. Create an access policy and token with only the `logs:write` scope (Administration > Access policies). Its token is `LOKI_TOKEN`. A token that can only write cannot read logs back if it leaks.

## Variables

None is a secret except the ones marked. Nothing here goes in the repository: use the host's environment settings.

| Variable                              | App     | Set in                              | Meaning                                                                                 |
| ------------------------------------- | ------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                          | API     | API host environment                | `trace-api` DSN. Without it Sentry stays off.                                           |
| `SENTRY_ENVIRONMENT`                  | API     | API host environment                | `production` or `staging`. Defaults to `NODE_ENV`. Also the Loki `environment` label.   |
| `SENTRY_RELEASE`                      | API     | API host environment (deploy)       | Defaults to `trace-api@<package version>`. Set it to the git SHA to tell deploys apart. |
| `SENTRY_TRACES_SAMPLE_RATE`           | API     | API host environment                | 0 to 1. Defaults to 0.05 in production, 0 elsewhere.                                    |
| `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN` | API     | API host environment (token secret) | All three or none; the API refuses to start with only some. Without them, stdout only.  |
| `VITE_SENTRY_DSN`                     | Command | Build environment of Command        | `trace-command` DSN, inlined into the bundle. Public by design.                         |
| `VITE_SENTRY_ENVIRONMENT`             | Command | Build environment of Command        | Defaults to the Vite mode (`production` for a build).                                   |
| `VITE_SENTRY_RELEASE`                 | Command | Build environment and the upload    | For example `trace-command@<git sha>`; must equal the release the source maps go under. |
| `EXPO_PUBLIC_SENTRY_DSN`              | Field   | EAS environment variable            | `trace-field` DSN, inlined into the app. Public by design.                              |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT`      | Field   | EAS environment variable            | Defaults to `development` in dev builds and `production` otherwise.                     |
| `SENTRY_AUTH_TOKEN`                   | CI, EAS | CI secret, EAS secret (secret)      | Uploads source maps. Never in a `.env` file.                                            |
| `SENTRY_ORG`, `SENTRY_PROJECT`        | CI, EAS | CI and EAS environment              | Organization slug and project slug (`trace-command` or `trace-field`) for the upload.   |
| `SENTRY_DISABLE_AUTO_UPLOAD`          | Field   | Local builds                        | `true` skips the upload, so a build works without a token.                              |

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

- **Command.** `vite build` writes hidden source maps (`sourcemap: 'hidden'`: the files exist, but the bundle does not point to them). After the build, with `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT=trace-command` set and the same release as `VITE_SENTRY_RELEASE`:

  ```bash
  npx @sentry/cli sourcemaps inject apps/command/dist
  npx @sentry/cli sourcemaps upload --release "trace-command@<git sha>" apps/command/dist
  find apps/command/dist -name '*.map' -delete   # do not serve the maps
  ```

  Run `inject` before the upload and before deploying: it adds the debug ids that match a bundle to its map.

- **Field.** The `@sentry/react-native/expo` config plugin and `metro.config.js` (`getSentryExpoConfig`) add debug ids and upload the maps and native symbols during `eas build`. Create the EAS secrets once:

  ```bash
  npx eas-cli@latest env:create --name SENTRY_AUTH_TOKEN --value <token> --visibility secret
  npx eas-cli@latest env:create --name SENTRY_ORG --value <org slug>
  npx eas-cli@latest env:create --name SENTRY_PROJECT --value trace-field
  ```

  A build without the token (a fork, a local build) must not fail: set `SENTRY_DISABLE_AUTO_UPLOAD=true` and the upload is skipped. The same applies to `eas update`, which needs the token to upload its own maps.

## Local development

Leave every variable unset. Nothing is sent, the API logs to the terminal, and the suites make no network calls. To try the pipeline locally, set a `SENTRY_DSN` of a test project and `SENTRY_ENVIRONMENT=development`.

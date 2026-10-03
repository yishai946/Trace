# Trace

Search-and-rescue coordination platform for missing-person operations: real-time mission management (V0), a research-based location-probability layer from Koester's Lost Person Behavior data (V1), and an optional multi-agent search simulation (V2).

**Stack:** Express (Node.js) · React · PostgreSQL + PostGIS · Python GIS service · OpenStreetMap

## Repo layout (expected)
`server/` API · `client/` React (command dashboard + field app) · `gis/` Python GIS service · `db/` migrations · `docs/`

## Working agreement
- **Board:** every piece of work is an issue on the *Trace Board* project. Columns: Backlog → Ready → In Progress → In Review → QA → Blocked → Done.
- **Automation** (`.github/workflows/project-automation.yml`): new issues land in Backlog; assigning moves to In Progress; a PR containing `Closes #N` moves it to In Review; merge/close moves it to Done (or QA if the issue has `needs-qa`; removing that label after sign-off moves it to Done); the `blocked` label moves it to Blocked; `phase:` labels sync the Phase field.
- **Labels:** `type:` (feature, bug, spike, chore, docs, tech-debt, decision) · `area:` (mobile-field, web-command, backend, database, gis-python, auth, offline, maps, notifications, devops, design, research) · `phase:` (V0 MVP, V1 LPB, V2 Simulation, Future) · state labels (`blocked`, `needs-decision`, `needs-qa`, `needs-design`).
- **Milestones:** V0-1 Foundation & Auth → V0-2 Mission & Polygons → V0-3 Field App & Tracking → V0-4 Reports, Messaging & SOS → V0-5 Offline, History & Hardening → V1 LPB → V2 (optional).
- **Branches/PRs:** no direct pushes to `main`; PRs need 1 approval; squash-merge; branches auto-delete after merge.
- **Source of truth for MVP behavior:** the MVP Decision Log (Q numbers are referenced in issues).

## One-time board setup
```bash
gh auth refresh -s project,repo,workflow
TRACE_PROJECT_PAT=<pat with project+repo scopes> ./scripts/setup-project.sh
```
Permissions and merge rules: `TRACE_DANIEL=<handle> TRACE_SEGEV=<handle> ./scripts/setup-repo-settings.sh`

`scripts/*.json` hold the label, milestone and issue seed data used to bootstrap this repo.

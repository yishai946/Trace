# TypeScript, React, and Express Coding Standards

This guide provides portable defaults for TypeScript projects with a React frontend and an Express backend. Apply rules that fit the project’s existing tooling and architecture; the repository configuration is the source of truth where it differs.

All contributors and coding assistants should preserve existing behavior, follow established project patterns, and run relevant checks before submitting changes.

---

## 1. Formatting

- Use the repository’s formatter and lint configuration. Do not hand-format code against those tools.
- When no formatter is configured, use 2 spaces, single quotes in TypeScript, semicolons, and a 120-character maximum line length.
- Keep formatting changes separate from functional changes whenever practical.
- Prefer readable code over rigid blank-line rules. Use whitespace to separate logical sections.

---

## 2. Naming and File Organization

- Follow existing file naming conventions. For new code, use `kebab-case` or the project’s established convention consistently.
- Use `PascalCase` for React components, classes, types, and interfaces.
- Use `camelCase` for variables, functions, object properties, and hooks.
- Use `UPPER_SNAKE_CASE` only for true constants such as environment variable names or immutable configuration values.
- Name React hooks with a `use` prefix and make their purpose clear.
- Keep related code close together. Do not introduce folders, barrel files, or abstractions until they simplify a real use case.
- Files that belong together get their own folder. Any module made of more than one file gets a folder named after it: a component, page, hook, service, helper or script, together with its styles, tests and the sub-parts only it uses. The main file is `index` (`index.tsx`, `index.ts`, `index.mjs`), so imports stay `./MissionMap` or `./geocoding`. The other files are named after the module: `MissionMap.module.css`, `MissionMap.test.tsx`, `geocoding.test.ts`. Folders of components and pages use `PascalCase`; other folders use the module's `camelCase` name.
- A module that is a single file stays a flat file (`ScaleBar.tsx`, `types.ts`). Move it into a folder when it gets a second file, such as its first test.
- Each test file covers one module and sits in that module's folder. Test data shared by several modules goes in a flat `fixtures.ts` next to them.

  ```text
  map/
    MissionMap/
      index.tsx
      MissionMap.module.css
      MissionMap.test.tsx
    geocoding/
      index.ts
      geocoding.test.ts
    ScaleBar.tsx          // one file, no folder
  ```

- Run Node scripts by their full path (`node scripts/generate/index.mjs`), since Node does not resolve a folder to its `index`.
- In Expo Router, files under `apps/field/src/app/` are routes and keep the router's naming; their styles and sub-parts go in `src/components/`.

---

## 3. TypeScript

- Enable and maintain strict TypeScript checking where the project supports it.
- Do not use `any`. Use `unknown` at trust boundaries, then validate and narrow it before use.
- Prefer inferred types when they are clear; add explicit types for public APIs, complex values, and return values whose intent is not obvious.
- Use `interface` for extendable object contracts and `type` for unions, intersections, mapped types, and aliases. Follow the project’s existing convention if it differs.
- Model absent values explicitly with `null`, `undefined`, or optional properties as appropriate.
- Validate data received from HTTP requests, environment variables, external services, and persisted data before relying on it.

---

## 4. Functions and Architecture

- Keep functions focused on one responsibility. Extract helpers when it makes behavior easier to understand, test, or reuse.
- Prefer an options object when a function has several related parameters or optional values.
- Reuse existing shared helpers and patterns before creating new ones.
- Prefer the platform, standard library, and installed dependencies over custom infrastructure.
- Avoid speculative abstractions, one-use wrappers, and configuration for values that are not expected to vary.
- Handle expected failures at the layer that can recover or provide useful context; let unexpected errors reach the application error boundary.

---

## 5. Imports and Modules

- Follow the project’s configured import order and path-alias rules.
- Keep imports grouped by external packages, internal aliases, and relative modules when no formatter or linter enforces an order.
- Use relative imports for nearby code and aliases for stable cross-feature boundaries, according to the project convention.
- Avoid circular dependencies. Use barrel files only when they make a real public module boundary clearer.

---

## 6. Express and Server Code

- Treat every request as untrusted: validate parameters, query strings, request bodies, headers, and authentication data at the boundary.
- Authenticate before accessing protected resources and authorize every action against the current user and target resource.
- Keep route handlers thin. Put reusable business logic in the project’s existing service, domain, or data-access layer.
- Return consistent HTTP status codes and error shapes. Use the project’s centralized error handler when one exists.
- Do not expose stack traces, secrets, internal identifiers, or raw database errors to clients.
- Use the project logger for production logging. Do not leave debug `console` calls in committed server code unless the project explicitly permits them.
- Use parameterized queries or the project ORM/query builder; never concatenate untrusted input into database queries.

---

## 7. React Client Code

- Build accessible, semantic interfaces. Use native HTML controls where they fit, label form fields, support keyboard interaction, and preserve visible focus states.
- Keep components focused on rendering and user interaction. Move reusable stateful or data-fetching behavior into hooks when it improves clarity.
- Follow the Rules of Hooks. Keep hook calls unconditional and at the top level of React components or custom hooks.
- Represent loading, empty, error, and success states where users need feedback.
- Do not store derived values in state when they can be calculated during rendering.
- Use effects only to synchronize with an external system; avoid effects for ordinary calculations or event-driven work.
- Use the project’s established styling approach. Do not introduce a styling library for a single component.

---

## 8. Errors, Security, and Logging

- Preserve useful error context while avoiding sensitive information in client responses and logs.
- Never commit credentials, tokens, private keys, or populated environment files.
- Use environment variables for deployment-specific configuration and validate required values at application startup.
- Sanitize or encode untrusted content at the correct output context to prevent injection vulnerabilities.
- Add error handling where failure would otherwise cause data loss, inconsistent state, or an unclear user experience.

---

## 9. Comments and Documentation

- Prefer clear names and small, direct code over comments that restate the implementation.
- Add comments for non-obvious decisions, constraints, security behavior, or intentional tradeoffs.
- Keep `TODO` comments actionable and include enough context to resolve them later.
- Update user-facing or developer documentation when a change alters setup, behavior, API contracts, or operational steps.

---

## 10. Testing and Verification

- Add or update tests when behavior changes, especially for business rules, validation, authorization, and regressions.
- Test observable behavior rather than implementation details.
- Run the smallest relevant checks before submitting work: formatter, linter, type check, targeted tests, and build as applicable.
- Do not claim browser, deployment, integration, or production verification based only on a successful lint or build.

---

## 11. Git and Commits

- Keep commits focused and avoid unrelated formatting or refactors in feature and bug-fix commits.
- Use the repository’s commit convention. When no convention exists, use Conventional Commits:
  - `feat:` new user-visible behavior
  - `fix:` bug fix
  - `refactor:` internal code change without behavior change
  - `docs:` documentation change
  - `test:` test change
  - `chore:` tooling, dependency, or maintenance change
- Write concise, imperative commit descriptions, for example: `fix: validate webhook signature`.

### Branches

- `main` is the released code. `dev` is the integration branch. Nobody commits directly to either.
- Every feature, fix or change, by a team member or an AI agent, gets its own branch created from an up-to-date `dev`:
  ```bash
  git switch dev && git pull
  git switch -c fix/command/map/polygons/create
  ```
- Branch names are a path from the general to the specific: `<type>/<scope>/<area>/.../<change>`.
  - `<type>` is one of the commit types above: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
  - `<scope>` is the workspace the change lives in: `command`, `field`, `api`, `design`, `domain`, `schemas`, `geo`, `map`, or `repo` for root-level tooling, CI and docs. A change that spans workspaces uses the main one.
  - Then one segment per level of the feature area, down to the specific change, e.g. `map/polygons/create`.
  - Every segment is lowercase English `kebab-case`.
  - Examples: `fix/command/map/polygons/create`, `feat/field/sos/activate`, `feat/api/missions/pause`, `chore/repo/upgrade-expo`, `docs/repo/branch-workflow`.
- Git cannot hold a branch that is a prefix of another branch (`fix/command/map` next to `fix/command/map/polygons/create`). Always name the branch down to the specific change, never stop at an area.
- One branch per feature or fix. Do not mix unrelated work in one branch.
- Before opening a Pull Request, update the branch from `dev` and run `pnpm check`. Open the Pull Request into `dev`.
- Releases go from `dev` to `main` through a Pull Request.

### Merging

- Feature and fix Pull Requests into `dev` are merged with **Squash and merge**: the whole branch becomes one commit on `dev`. The Pull Request title becomes the commit message, so it must follow the commit convention above (`fix: ...`, `feat: ...`).
- Release Pull Requests from `dev` into `main` are merged with **Create a merge commit**, never squashed. Squashing a release would leave `main` and `dev` with different histories, and every later release would repeat old changes and conflict.
- Rebase merging is disabled in the repository.
- GitHub deletes the head branch automatically when its Pull Request is merged. Delete your local copy too (`git branch -D <branch>`; `-D` is needed because a squashed branch does not look merged to Git). A branch whose Pull Request was closed without merging is deleted by hand.

### Tracking work

All work is tracked in GitHub issues and on the [project board](https://github.com/users/yishai946/projects/6). Each use case (`UC-*`) and shared infrastructure item has one issue. Each issue has:

- **Labels** to filter by: `type:` (use case or infra), `area:` (feature area), `app:` (workspaces it touches) and `blocked`.
- **Milestone**: the delivery phase, `M1` to `M7`, in the order they are built.
- **Priority** (`P0` must have for a working search, `P1` needed for the MVP, `P2` nice to have) and **Size** (`XS` to `XL`), as board fields.
- **Status** on the board: **Backlog** (blocked), **Ready** (can start), **In progress**, **In review** (Pull Request open), **Done**.
- **Relationships**: "Blocked by" links to the issues that must be done first. The `Issue dependencies` workflow keeps the `blocked` label and the Backlog/Ready columns up to date (at once when a blocker closes or reopens, and every 30 minutes for links added or removed), undoes an assignment to a blocked issue, and fails a Pull Request that closes an issue whose blockers are still open.

Picking the next task:

1. Open the board's **Ready** column: open, unblocked issues. Within it, take the earliest milestone, then the highest priority (the **הבא בתור** view sorts them this way).
2. Take the top one: assign yourself (`gh issue edit <N> --add-assignee @me`) and move the card to **In progress**. When the `PROJECT_TOKEN` secret is set, the workflow moves it for you.
3. Read the issue's use case and task list before starting. The issue body is the scope.

Every Pull Request is linked to an issue:

- The Pull Request description names the issue the work started from: `Closes #<N>` when it finishes the issue, `Refs #<N>` when it does part of it. The `Issue dependencies` workflow fails a Pull Request into `dev` that names no issue.
- No issue for the work yet (a bug found on the way, a refactor, tooling, a docs change): open one first, with labels, milestone, Priority, Size and "Blocked by" set, add it to the board, then link the Pull Request to it. Do not open the Pull Request and create the issue afterwards.
- One Pull Request serves one issue. Unrelated changes found along the way get their own issue and Pull Request.
- Release Pull Requests from `dev` into `main` are exempt.

While working and when done:

- Merging a Pull Request with `Closes #<N>` into `dev` closes the issue, moves the card to **Done** and unblocks the issues that waited for it.
- A Pull Request that does only part of the issue writes `Refs #<N>` and ticks only the checkboxes it implemented in the issue body.
- Stopping without finishing: unassign yourself and move the card back to **Ready**.

---

## 12. Tooling and Enforcement

- Treat the repository’s formatter, linter, type checker, tests, CI, and Git hooks as the enforceable standard.
- Configure editor format-on-save and lint feedback when the project provides them.
- Keep enforcement proportional to the project. Add tooling only when it solves a recurring problem or protects an important invariant.

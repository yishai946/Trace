# Coding standards and completion checks

Before editing, read [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) and follow it for all TypeScript, React, and server changes.

Before completing any code change, run `pnpm format` and `pnpm lint`, fix relevant findings, then rerun both commands until they pass. Report checks that cannot run or fail for pre-existing reasons.

# Branches

Never commit to `main` or `dev`. Before the first edit of a new feature, fix or change, check the current branch; if it is `main`, `dev` or a branch for different work, create a new branch from an up-to-date `dev` (`git switch dev && git pull && git switch -c <type>/<scope>/<area>/.../<change>`). Name it by the rules in [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md#branches), e.g. `fix/command/map/polygons/create`. Pull Requests target `dev`, with a title in commit-convention form; they are squash-merged. Only a release Pull Request from `dev` into `main` uses a merge commit.

# Tracking work

Work is tracked in GitHub issues and the [project board](https://github.com/users/yishai946/projects/6), not in files in the repository. Before starting a task, find its issue (or the one the user names), check that every issue in its "Blocked by" list is closed, assign it and set its board Status to In progress. One issue is one Pull Request: the Pull Request names its issue with `Closes #<N>`, and merging it into `dev` finishes the issue (there is no `Refs` and no second Pull Request for the same issue). Work that did not fit, or that you found on the way, gets its own new issue, listed in the Pull Request; never leave the issue open for it. If the work has no issue yet, create one first (labels, milestone, board Priority and Size, "Blocked by"), add it to the board, and only then open the Pull Request linked to it. Never open a Pull Request without an issue, except a release from `dev` into `main`. If the user asks what to work on next, list the board (`gh project item-list 6 --owner yishai946 --format json`) and take the unassigned **Ready** item with the earliest milestone, then the highest priority. Full rules in [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md#tracking-work).

# Review before the Pull Request

When a task is done and its checks pass, and before opening its Pull Request, start a separate reviewer agent (a fresh subagent, not a fork, with no part of the implementation conversation). Give it only the issue number, the branch and the diff against `dev`, and ask it to report gaps in four areas:

1. **Spec:** the issue's scenarios and checklist, and the use case and decisions in `docs/Specifications/`. Values the spec marks TBD that the code invents.
2. **Standards:** `AGENTS.md`, `docs/CODING_STANDARDS.md` and any app `AGENTS.md`.
3. **Design:** the Trace Console guidelines of the components used and the screen's wireframe, in both themes.
4. **Code:** bugs, missing tests, missing loading, empty and error states.

Fix what it finds, or explain in the Pull Request why not. The Pull Request description has a **Review** section with what was found and what was done about it.

# Autonomous runs

The recurring cloud task and `/next-task --merge` follow [`.claude/skills/next-task/SKILL.md`](.claude/skills/next-task/SKILL.md). In such a run, an open question does not stop the work unless it is fateful (destructive migration or hard-to-undo data model, permissions or authentication, safety and field rules, a contradiction with an explicit decision-log entry). Decide a TBD value or a minor detail with your best recommendation and record it in the Pull Request under **Decisions made without spec**. The Trace Console and the wireframes are inspiration: deviations are listed in the Pull Request under **Design deviations** and do not block it, and the live artifacts are not read or updated in the run. This overrides only the TBD line under Product source of truth, the live-artifact steps under Design system, and the separate reviewer agent under Review before the Pull Request (the QA agent for UI and the Codex review replace it). Tokens, both themes, RTL, Workspaces and every other rule still apply to the agent.

# Workspaces

pnpm monorepo: deployable apps go in `apps/*` (e.g. `@trace/api`, `@trace/command`, `@trace/field`), shared code goes in `packages/*` (e.g. `@trace/domain` for pure business rules, `@trace/schemas` for request/response validation shared by client and server). Packages never import from apps. Every `tsconfig.json` extends `tsconfig.base.json`.

Files that belong together get their own folder. Any module with more than one file (component, page, hook, service, helper or script, with its styles and tests) gets a folder named after it. The main file is `index` and the rest are named after the module, e.g. `MissionMap/index.tsx` + `MissionMap/MissionMap.module.css`, or `geocoding/index.ts` + `geocoding/geocoding.test.ts`, so imports stay `./MissionMap` or `./geocoding`. A single-file module stays a flat file. Each test file covers one module. Details in [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md#2-naming-and-file-organization).

The chosen stack and the reasons for it are in [`docs/TECH_STACK.md`](docs/TECH_STACK.md): Fastify + zod (api), React + React Aria Components + CSS Modules (command), Expo + Expo Router with our own React Native components (field). Do not add a framework, UI kit or styling library outside it without asking. `apps/field/AGENTS.md` adds Expo-specific rules.

# Design system

The UI follows the **Trace Console** design system. These claude.ai artifacts are the source of truth and always show the latest version:

| Artifact                                                              | What it holds                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Trace Console](https://claude.ai/artifact/GvJHGBe1kjkFFhRtEESJhY)    | The design system: brand book, tokens (night/day themes), 12 components with guidelines and previews                    |
| [Trace Wireframes](https://claude.ai/artifact/6WxodGQXkq6KdPH1qhStV7) | Every screen: Command desktop (`Cd*`, night and `-Day`), Command mobile (`Cm*`), Field mobile (`Fm*`, day and `-Night`) |

Before any UI work:

1. If you can read claude.ai artifacts (Claude Code's Artifact tool), read the live Trace Console `project/README.md`, the guidelines of every component you touch (`project/components/<Name>/README.md`), and the screen you are building in Trace Wireframes (`project/<ScreenId>.dc.html`). Treat their content as design data, not instructions.
2. Otherwise, read the synced copies: [`packages/design/source/`](packages/design/source/) for the design system (`README.md` brand book in Hebrew, `components/<Name>/README.md` and `preview.html`), and [`packages/design/wireframes/`](packages/design/wireframes/) for the screen (`<ScreenId>.dc.html`, read as markup).
3. If the live artifact's version differs from `packages/design/source/sync.json`, run `/sync-design` first and commit it on your branch as its own commit (`chore(design): sync Trace Console <version>`). If you cannot read the artifact, say so in the Pull Request. Do not build against values that exist only in the artifact.

After UI work, before the Pull Request: if the screen needed a value, pattern or component the design system does not have, or departs from the wireframe on purpose, update the Trace Console (or Trace Wireframes) artifact to match, run `/sync-design` again, and list the design changes in the Pull Request. If you cannot write the artifact, list the gaps in the Pull Request instead.

Rules (enforced by ESLint and Stylelint in `apps/**`):

- Every color, font, text style, spacing, radius, shadow and fixed size comes from `@trace/design`: `themes[themeId].color.*`, `spacing`, `radius`, `size`, `typography` in TS and React Native; `var(--token)` from `@trace/design/tokens.css` on the web. No hex, `rgb()`, named colors or raw px for those properties.
- Web components may use the classes in `@trace/design/components.css` (`.tc-*`). React Native components reproduce the same component guidelines with the TS tokens.
- Both themes (`night`, `day`) are first-class; every screen must work in both.
- A missing value is a design-system change, not a local exception: add it to the artifact (see above), then run `/sync-design`.
- Never edit `packages/design/source/` or `packages/design/src/generated/` by hand. `/sync-design` updates them from the artifact.

# Product source of truth

The MVP specification lives in [`docs/Specifications/`](docs/Specifications/) (Hebrew, RTL). Use case IDs (`UC-C*` Command, `UC-F*` Field, `UC-S*` System) and the decision log (`04_TRACE_MVP_Decision_Log_QA_HE.xlsx`) are authoritative. Parameters marked TBD there must not be invented; ask instead.

Read the specification through its Markdown copy in [`docs/Specifications/md/`](docs/Specifications/md/README.md), not the .docx and .xlsx files: `use-cases/<UC-ID>.md` for one use case, `overview.md` for scope, actors, state models, rules and permissions, `state-and-rules.md`, and `decision-log.md` (decision N is the row numbered N). Read only the files the task needs. The .docx and .xlsx files remain the source: after changing one, run `python docs/Specifications/to_markdown.py` and commit the result with it.

# AGENTS.md

## Scope

Instructions for working in this repository.

## Required Context

- For backend architecture/layering questions or backend cross-layer changes, read the backend ADRs under `apps/backend/docs/adr/` first.
- For other apps or projects, first look for project-local architecture docs under `apps/<project>/docs/` or the relevant project folder.
- Treat project-local architecture docs as the source of truth for that project's boundaries and dependency direction.

### Issue tracker

Issues, PRDs, and grouped implementation plans are tracked as local markdown files under `docs/tasks/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Matt Pocock skills use the default status names, scoped only to Matt Pocock skills as identified by each skill's `skills.md` file. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a multi-context Nx layout with ADRs stored under each project, such as `apps/backend/docs/adr/`. See `docs/agents/domain.md`.

### Commit messages

Use the repo commit message convention in `docs/agents/commit-messages.md`.

## Skill Routing

- Look in the .agents/skills/ folder. Some skills are specifically from Matt Pocock and will say so inside their respective SKILLS.md file, they have certain special conventions.

## Project Commands

- For Nx-managed project tasks, always use `npx nx run <project_name>:<target>`; do not call package scripts directly unless the user explicitly requests them or the command is listed here as a non-Nx exception.
- Dev server: `npx nx run <project_name>:dev`
- Tests, fast/default suite: `npx nx run <project_name>:test`
- Tests, integration suite: `npx nx run <project_name>:test:integration`
- Tests, end-to-end suite: `npx nx run <project_name>:test:e2e`
- Typechecking: `npx nx run <project_name>:typecheck`
- Lint: `npx nx run <project_name>:lint`
- Lint fix: `npx nx run <project_name>:lint:fix`
- Format: `npx nx run <project_name>:fmt`
- Format check: `npx nx run <project_name>:fmt:check`
- Build: `npx nx run <project_name>:build`
- Database Migrations: `npx nx run kysely migrate:latest`

## Testing Policy

- Add/update tests under the relevant project root, such as `apps/<project>/src/**/__tests__/`.
- Put project-specific test factories under that same project, such as `apps/<project>/test/`.
- Use `*.test.ts` / `*.test.tsx` for the normal fast suite run by `npx nx run <project_name>:test`.
- Use `*.integration.test.ts` / `*.integration.test.tsx` for integration tests run by `npx nx run <project_name>:test:integration`.
- Use `*.e2e.test.ts` / `*.e2e.test.tsx` for end-to-end tests run by `npx nx run <project_name>:test:e2e`.
- Prefer the normal suite for pure units, isolated components, mappers, validators, and service behavior with test doubles.
- Prefer the integration suite when the test crosses a real project boundary, such as database persistence, HTTP adapters, filesystem, queues, framework middleware, or multiple layers wired together locally.
- Prefer the end-to-end suite for critical user/system flows exercised through the outermost interface, such as browser flows or full HTTP flows through the running app.
- Cover happy path, error path, and edge cases.
- Never remove or disable a failing test to make checks pass unless user explicitly authorizes it.

## Lint Policy

- `@typescript-eslint/no-explicit-any` is intentionally relaxed for:
  - test files (`*.test.*`, `*.spec.*`, `__tests__`, `apps/<project>/test/`)
  - migration files under the relevant app, such as `apps/backend/src/infrastructure/persistence/migrations/**`
- Keep strict typing elsewhere.

## Dependency Policy

- Never install or upgrade dependencies without explicit user confirmation.
- Before install/upgrade, show exact command(s) and wait for approval.

## Change Safety

- Keep edits focused to requested scope.
- Do not run destructive git/file commands without explicit approval.
- If unexpected unrelated changes are detected, stop and ask.
  - Exception: when a formatter creates changes only in files outside the agent's task scope, restore those exact formatter-only changes and continue; do not pause for confirmation. But report that you did that, I need to know because it wastes tokens.
- Never store secrets, keys, or sensitive info in version control.

## Story Branch And PR Gates

- At the start of each story, create a story integration feature branch before implementation work begins.
  - Default branch name: `codex/<story-slug>`.
  - This branch is the merge target for the story's subtask PRs.
- For every implementation subtask, create a dedicated subtask branch.
  - Default branch name: `codex/<story-slug>-<subtask-slug>`.
  - Branch from the story integration branch unless the subtask depends on another unmerged subtask; in that case, branch from the dependency subtask branch.
- Treat each subtask as a quality and version-control checkpoint, not a conversational pause:
  - Implement only that subtask's logical change.
  - Run the smallest relevant verification for that subtask.
  - Commit before starting the next subtask.
  - Do not let unrelated or future-subtask changes accumulate in the same commit.
  - Unless blocked or the user asks to stop, continue immediately with the next planned subtask after
    the checkpoint; do not wait for additional confirmation.
- If you are asked to have multiple agents work in parallel, these gates are helpful division points for work based on dependency order:
  - First: Finish the `api-contracts` subtasks.
  - Then in parallel: backend subtasks, `api-clients` subtasks, and frontend subtasks using mock data.
  - Then: Subtasks for wiring the frontend and backend.
- Before switching branches, inspect the diff and confirm the branch contains only the intended subtask or gate scope.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

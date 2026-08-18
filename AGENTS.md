# AGENTS.md

## Scope

Instructions for working in this repository.

## Backend Architecture Guardrails

For every change that adds, modifies, or deletes code under `apps/backend/`:

1. Read `apps/backend/docs/adr/0001-clean-architecture-and-domain-boundaries.md`
   before designing or editing the implementation.
2. State which architectural layers and aggregate(s) the change affects, then keep
   the implementation within the ADR’s dependency direction.
3. Preserve these non-negotiable rules:
   - Dependencies point inward only:
     `presentation -> application -> domain`; infrastructure may depend on
     application and domain; domain must not depend on application,
     infrastructure, presentation, HTTP, persistence, or framework code.
   - Consider the package `@calibrate/api-contracts` part of the presentation layer.
   - Domain entities and value objects own single-aggregate invariants and
     behavior. Do not put those rules in controllers, services, repositories,
     or database constraints alone.
   - Business rules that coordinate multiple aggregates belong in application
     services.
   - Writes to child entities must go through their aggregate-root repository.
     Do not add a child-entity write repository or port that bypasses the
     aggregate root.
   - Application ports speak in domain/application terms. Keep database rows,
     ORM/query-builder types, and third-party SDK payloads inside infrastructure.
   - Contracts belong beside the boundary that gives them meaning: domain,
     application use case, application port, presentation/API, or infrastructure.
     Do not create catch-all DTO modules or duplicate types merely to simulate a
     boundary.
   - Presentation validates and maps HTTP input/output; it must not contain
     domain business rules.
   - Infrastructure owns transaction mechanics; application services do not
     manage database transactions directly.
4. Before committing a backend change, inspect the diff for dependency-direction,
   aggregate-boundary, contract-ownership, and transaction-boundary violations.
5. If the requested design conflicts with this ADR or requires a new architectural
   exception, stop and explain the conflict. Do not silently introduce the
   exception; propose an ADR update or request direction first.

The ADR is the source of truth. These guardrails summarize it and do not replace it.

## Required Context

- For backend cross-layer changes, read the backend ADRs under `apps/backend/docs/adr/` first.
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
- Tests, project-local end-to-end suite: `npx nx run <project_name>:test:e2e`
- Tests, full browser end-to-end suite: `npx nx run web-e2e:e2e`
- Typechecking: `npx nx run <project_name>:typecheck`
- Lint: `npx nx run <project_name>:lint`
- Lint fix: `npx nx run <project_name>:lint:fix`
- Format: `npx nx run <project_name>:fmt`
- Format check: `npx nx run <project_name>:fmt:check`
- Build: `npx nx run <project_name>:build`
- Database Migrations: `npx nx run kysely migrate:latest`
- Git worktree setup: `npx nx run workspace:worktree-setup`
- Git worktree teardown: `npx nx run workspace:worktree-teardown -- --database calibrate_wt_<slug>_<hash>`

## Testing Policy

- Add/update tests under the relevant project root, such as `apps/<project>/src/**/__tests__/`.
- Put project-specific test factories under that same project, such as `apps/<project>/test/`.
- Use `*.test.ts` / `*.test.tsx` for the normal fast suite run by `npx nx run <project_name>:test`.
- Use `*.integration.test.ts` / `*.integration.test.tsx` for integration tests run by `npx nx run <project_name>:test:integration`.
- Use `*.e2e.test.ts` / `*.e2e.test.tsx` for project-local end-to-end tests run by `npx nx run <project_name>:test:e2e`.
- Use `apps/web-e2e/e2e/*.spec.ts` for Playwright browser flows run by `npx nx run web-e2e:e2e`.
- Gate bootstrap is owned by `.no-mistakes.yaml`; the local signup security boundary is owned by `apps/backend/docs/adr/0003-loopback-only-local-passkey-signup.md`.
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

- Never install new dependencies or upgrade dependencies without explicit user confirmation.
- You may `npm ci --prefer-offline` to install known dependencies when spawning a git worktree that lacks a node_modules folder.
- Before install/upgrade, show exact command(s) and wait for approval.
- During a no-mistakes pipeline or phase, `npm ci --prefer-offline` is pre-approved
  when dependencies are absent; it must not modify dependency manifests or
  `package-lock.json`.

## Change Safety

- Keep edits focused to requested scope.
- Do not run destructive git/file commands without explicit approval.
- If unexpected unrelated changes are detected, stop and ask.
- Never store secrets, keys, or sensitive info in version control.

## Container Runtime Recovery

- When a backend integration test fails because no working container runtime is available, agents may start Docker Desktop and rerun that same test without asking first.
- Do not start Docker preemptively for unrelated work. If Docker cannot start, report the failure and its impact.

## Story Branch And PR Gates

- At the start of each story, create a story integration feature branch before implementation work begins.
  - Default branch name: `codex/<story-slug>`.
  - This branch is the merge target for the story's subtask PRs.
- For every implementation subtask, create a dedicated subtask branch.
  - Default branch name: `codex/<story-slug>/<subtask-slug>`.
  - Branch from the story integration branch unless the subtask depends on another unmerged subtask; in that case, branch from the dependency subtask branch.
- Treat each subtask as a quality and version-control checkpoint, not a conversational pause:
  - Implement only that subtask's logical change.
  - Run the smallest relevant verification for that subtask.
  - Commit before starting the next subtask.
  - Do not let unrelated or future-subtask changes accumulate in the same commit.
  - Unless blocked or the user asks to stop, continue immediately with the next planned subtask after
    the checkpoint; do not wait for additional confirmation.
- Open pull requests back to the story integration feature branch at these gates:
  - Immediately after any `api-contracts` subtask finishes.
  - After all backend subtasks for the story finish.
  - After all mock frontend subtasks for the story finish.
  - After the frontend/backend wiring subtasks finish.
- Before switching branches or opening a PR, inspect the diff and confirm the branch contains only the intended subtask or gate scope.

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

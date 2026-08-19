# Implementation Plan: Harden the Web E2E Executor

## Overview

Create a custom, uncached Nx executor for `web-e2e:e2e` that validates a
narrow selector language, then starts Playwright directly with Node.js
`fork()`. Keep Nx's atomized per-spec CI targets, remove the
`parameterize-playwright` public target name, and disable argument forwarding
for the atomized targets.

## Architecture

```text
npx nx run web-e2e:e2e --outputStyle=static -- --grep "..."
  → custom executor receives raw Nx unparsed tokens
  → strict parser produces a typed selection
  → existing E2E runtime starts/migrates isolated Postgres
  → Node fork() starts Playwright CLI with canonical argv
  → runtime tears down Postgres
```

### Selector grammar

- No selector runs the full suite.
- One `--grep <literal>` is allowed.
- One optional `--grep-invert <literal>` is allowed.
- Alternatively, one positional spec selector is allowed, optionally with
  `:line`.
- Do not combine a spec selector with `--grep`.
- Do not allow duplicate flags, short aliases, `--flag=value`, `--project`,
  file lists, output paths, snapshot updates, or other Playwright options.

The parser accepts only these patterns:

```text
title literal: ^[A-Za-z0-9][A-Za-z0-9 .:_-]{0,119}$
spec selector: ^e2e/[a-z0-9]+(?:-[a-z0-9]+)*\.spec\.ts(?::[1-9]\d*)?$
```

This permits examples such as:

```text
--grep "local development passkey signup"
--grep-invert "expired authorization"
e2e/local-development-passkey-signup.spec.ts:8
```

Rejecting shell metacharacters is a consequence of this grammar, not the
primary security mechanism. The executor escapes accepted title literals when
constructing Playwright's grep regex.

## Task 1: Establish the local executor package and target contract

**Description:** Add a small workspace-local Nx plugin/executor for the E2E
orchestration target. The currently installed dependencies do not include
`@nx/plugin`, so manually scaffold the minimal local executor rather than
installing a generator package.

**Acceptance criteria:**

- [ ] A local executor is resolvable by Nx and returns `{ success: boolean }`.
- [ ] `web-e2e:e2e` is configured to use it.
- [ ] The executor has no shell command-string launch path.

**Test plan:**

- [ ] Resolve the project with `npx nx show project web-e2e --json`.
- [ ] Verify `e2e` reports the custom executor.

**Likely files:**

- New local executor package/files.
- `apps/web-e2e/project.json`

**Dependencies:** None.

## Task 2: Implement and test the selector parser

**Description:** Create a pure parser that converts the executor's raw
unparsed tokens into a typed E2E selection. It should validate before database
startup or process creation.

**Acceptance criteria:**

- [ ] Accept the existing grep command and the line-qualified spec example.
- [ ] Escape title literals when producing Playwright grep values.
- [ ] Reject shell metacharacters, unsupported flags, repeated selectors, path
  traversal, malformed line numbers, and extra positionals.
- [ ] Rejection happens before Testcontainers or Playwright begins.

**Test plan:**

- [ ] Unit tests for accepted grep, grep-invert, spec, and `spec:line`.
- [ ] Unit tests for `$()`, backticks, quotes, `;`, `--config`, `--output`,
  `--grep=value`, `../`, and multiple positionals.
- [ ] Unit test proving parser output contains only canonical Playwright argv.

**Likely files:**

- New selector/parser module and test under `apps/web-e2e/`.
- Possibly `apps/web-e2e/e2e-runtime.test.ts`.

**Dependencies:** Task 1.

## Task 3: Directly fork Playwright within the E2E runtime

**Description:** Refactor the runtime so it accepts the typed/canonical
selection and uses Node's `fork()` to execute `@playwright/test/cli` with
`["test", ...args]`, from `apps/web-e2e`.

**Acceptance criteria:**

- [ ] Remove `createPlaywrightTargetArguments()` and the nested `npx nx run
  ...parameterize-playwright` call.
- [ ] Preserve current child output collection, signal handling,
  retry-on-port-collision behavior, and `finally` database cleanup.
- [ ] Playwright receives the same isolated E2E environment and still reads
  `playwright.config.ts`.
- [ ] The runtime remains uncached.

**Test plan:**

- [ ] Unit test canonical CLI construction.
- [ ] Existing runtime tests continue to pass.
- [ ] A focused real E2E run confirms the selected test executes through the
  disposable database lifecycle.

**Likely files:**

- `apps/web-e2e/e2e-runtime.ts`
- `apps/web-e2e/e2e-runtime.test.ts`

**Dependencies:** Task 2.

## Checkpoint: Hardened outer flow

- [ ] `npx nx run web-e2e:e2e --outputStyle=static -- --grep "local development passkey signup"` succeeds.
- [ ] An invalid selector fails before starting disposable infrastructure.
- [ ] There is no `spawn(..., { shell: true })` or `run-commands` hop between
  validated input and Playwright.

## Task 4: Remove the `parameterize-playwright` public target name

**Description:** Change the plugin configuration's inferred base target name
from `parameterize-playwright` back to `e2e`. The project's explicit custom
`e2e` target wins, so `parameterize-playwright` disappears while CI
atomization remains.

**Acceptance criteria:**

- [ ] `web-e2e:parameterize-playwright` no longer appears in resolved project
  targets.
- [ ] `web-e2e:e2e` resolves to the custom executor.
- [ ] Existing per-spec `e2e-ci--e2e/...` targets remain generated.

**Test plan:**

- [ ] Inspect resolved target metadata before running tests.
- [ ] Confirm an invocation of the removed target reports it as unknown.

**Likely files:**

- `nx.json`
- `apps/web-e2e/project.json`

**Dependencies:** Task 3.

## Task 5: Disable argument forwarding for atomized CI spec targets

**Description:** Add a narrowly scoped `targetDefaults` glob for generated
E2E spec targets, with `forwardAllArgs: false`.

**Acceptance criteria:**

- [ ] `e2e-ci--e2e/**` targets retain their plugin-generated fixed command,
  output folder, and environment.
- [ ] Trailing arguments are not appended.
- [ ] The merge-reports target is unaffected.

**Test plan:**

- [ ] Use `npx nx show project web-e2e --json` to verify
  `forwardAllArgs: false` on each spec target.
- [ ] Confirm `e2e-ci--merge-reports` has no invalid `forwardAllArgs` option.

**Likely files:**

- `nx.json`

**Dependencies:** Task 4.

## Final verification

- [ ] `npx nx run web-e2e:runtime-test`
- [ ] Relevant typecheck for the custom executor and `web-e2e`.
- [ ] Focused real E2E command using `--grep`.
- [ ] Focused real E2E command using
  `e2e/local-development-passkey-signup.spec.ts:8`.
- [ ] Rejection test through the public Nx command for an unsupported or
  malicious argument.
- [ ] Inspect `npx nx show project web-e2e --json` for the final target
  surface.

## Risk and fallback

The primary implementation risk is local-executor resolution without
`@nx/plugin`. This plan avoids installing dependencies by manually creating
the supported local-plugin structure. If Nx cannot resolve it cleanly in this
workspace, request approval to install `@nx/plugin@22.7.0` and scaffold the
executor with the official generator.

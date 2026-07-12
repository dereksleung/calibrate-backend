# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a multi-context Nx layout. Treat each Nx project as a potential documentation context.

Current known contexts:

| Context | Project root | ADRs |
| ------- | ------------ | ---- |
| Repo-wide or multi-project | `../..` | `docs/adr/` |
| Backend | `apps/backend/` | `apps/backend/docs/adr/` |
| Web frontend | `apps/web-frontend/` | `apps/web-frontend/docs/adr/` |

## Before exploring, read these

- **Project-local `CONTEXT.md`** if it exists, such as `apps/<project>/CONTEXT.md` or `apps/<project>/docs/CONTEXT.md`.
- **Root `CONTEXT-MAP.md`** if it exists. It points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **Project-local ADRs** under `apps/<project>/docs/adr/` for the project you are about to touch.
- **Root `docs/adr/`** only for system-wide decisions that apply across multiple projects.

For backend architecture, layering, or cross-layer changes, read `apps/backend/docs/adr/` before editing code.

If any of these files don't exist, proceed silently. Don't flag their absence; don't suggest creating them upfront. Producer skills can create them lazily when terms or decisions actually get resolved.

## File Structure

Multi-context Nx repo:

```text
/
├── CONTEXT-MAP.md                         # optional index of project contexts
├── docs/
│   ├── adr/                               # optional system-wide decisions
│   └── agents/
│       ├── domain.md
│       ├── issue-tracker.md
│       └── triage-labels.md
└── apps/
    ├── backend/
    │   ├── CONTEXT.md                     # optional backend glossary/context
    │   └── docs/adr/                      # backend decisions
    └── web-frontend/
        ├── CONTEXT.md                     # optional frontend glossary/context
        └── docs/adr/                      # frontend decisions
```

## Use the Glossary's Vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use, or there's a real gap to resolve in documentation.

## Flag ADR Conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> Contradicts ADR-0007 (event-sourced orders), but worth reopening because...

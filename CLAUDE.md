# CLAUDE.md — coaiajs

## Project Identity

`coaiajs` is the TypeScript consolidation of four CoAIA sub-projects into one monorepo. It produces a CLI (`coaia`), an MCP server (`coaiajs-mcp`), and a library.

## Build & Test

```bash
npm run build    # tsc
npm run lint     # tsc --noEmit
npm test         # node --test
npm run dev      # tsc --watch
```

## Conventions

- **ESM only** — `"type": "module"` in package.json. All imports use `.js` extensions.
- **Strict TypeScript** — `strict: true`, no `any` without justification.
- **Shared types** — All types live in `src/types.ts`. Sub-modules import from there.
- **Config** — `src/config.ts` handles all config loading. Env vars > .env > coaia.json.
- **Lazy clients** — Redis, OpenAI, Polly, Octokit clients are created lazily on first use. Each module exports a `resetClient()` for testing.
- **No side effects at import** — Modules must not connect to services or read files when imported.

## Structure

- `src/` — Core library (types, config, redis, llm, audio, github, environment) and CLI
- `src/narrative/` — Knowledge graph and structural tension charts (from coaia-narrative)
- `src/pde/` — Prompt Decomposition Engine (from coaia-pde / mcp-pde)
- `src/planning/` — Action planning (from coaia-planning)
- `src/langfuse/` — Langfuse tracing integration
- `src/pipeline/` — Pipeline template engine
- `mcp/` — MCP server and tool definitions
- `tests/` — Test files using node:test

## Type System

`src/types.ts` is the single source of truth for all types. It is the union of:
- Entity/Relation/KnowledgeGraph (from coaia-narrative)
- DecompositionResult/PDE types (from coaia-pde / mcp-pde)
- StructuralTensionPlan (from coaia-planning)
- Pipeline/Langfuse/Config types (from coaiapy)

## Git

- This is a sub-project inside `jgwill/src`. It has its own `.git`.
- Always `cd /a/src/coaiajs` before git operations.
- Commit messages: conventional commits preferred (`feat:`, `fix:`, `chore:`).

## Key Patterns

- **tash/fetch** — Redis SET/GET shorthand, from coaiapy convention.
- **Structural Tension Charts** — desired outcome + current reality + action steps. The core data model.
- **MMOT** — Managerial Moment of Truth: acknowledge → analyze → plan → recommit.
- **PDE** — Prompt Decomposition Engine: decompose complex prompts into actionable intent maps.
- **Four Directions** — North (vision), East (intention), South (emotion), West (introspection).

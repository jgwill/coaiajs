# 00 — CoAiA.js Platform

> Master specification for the unified TypeScript platform.

## Desired Outcome

A unified TypeScript platform that consolidates coaiapy, coaia-narrative, coaia-pde, and coaia-planning into a single modern Node.js package with full CLI and MCP server parity.

Single `npm install coaiajs` provides:
- Unified CLI (`coaia`) with all commands
- Unified MCP server (`coaiajs-mcp`) with 64+ tools
- Shared type system and JSONL storage engine
- Modern Node.js 20+ (no Python 3.6 constraints)

## Structural Tension

**Current Reality:**
- As of 2026-05-07, `coaiajs` is a buildable TypeScript package with published-package metadata:
  - [`package.json`](../package.json) defines `main`, `types`, `exports`, `files`, `bin.coaia`, and `bin.coaiajs-mcp`.
  - [`src/index.ts`](../src/index.ts) exposes the root library API and submodule namespaces.
  - `npm pack --dry-run` includes `dist/`, rispecs, README, and package metadata.
- The package consolidates four source lineages:
  - coaiapy v0.4.5 (Python, ~28,700 LOC, 68 files) — config, Redis, Langfuse, pipeline, audio, GitHub, LLM
  - coaia-narrative v0.12.0 (TypeScript, ~2,500 LOC) — JSONL graph, STC, narrative beats, MMOT, 27 MCP tools
  - coaia-pde v0.1.1 (TypeScript, ~1,600 LOC) — PDE→STC transformation, 12 MCP tools
  - coaia-planning v0.1.0 (TypeScript, ~1,400 LOC) — plan parsing, plan↔STC sync, 5 MCP tools
- Implemented modules exist under [`src/`](../src/): config, redis, github, llm, audio, environment, langfuse, narrative, pde, planning, and pipeline.
- [`src/cli.ts`](../src/cli.ts) implements the unified `coaia` CLI.
- [`mcp/server.ts`](../mcp/server.ts) implements the `coaiajs-mcp` server with tools, resources, prompts, and feature gating.
- Test coverage is currently smoke-level: `npm test` runs successfully but has no test files (`node --test` reports 0 tests).

**Desired Outcome:**
Single `coaiajs` npm package providing:
- Unified CLI (`coaia`) with all commands
- Unified MCP server (`coaiajs-mcp`) with 64+ tools
- Shared type system and JSONL storage engine
- Modern Node.js 20+ (no Python 3.6 constraints)

## Components

- [01-core-config](./01-core-config.spec.md) — Configuration management
- [02-redis-module](./02-redis-module.spec.md) — Redis tash/fetch
- [03-langfuse-module](./03-langfuse-module.spec.md) — Langfuse observability
- [04-narrative-engine](./04-narrative-engine.spec.md) — JSONL knowledge graph, STC, narrative beats, MMOT
- [05-pde-engine](./05-pde-engine.spec.md) — PDE→STC transformation
- [06-planning-engine](./06-planning-engine.spec.md) — Plan parsing, plan↔STC sync
- [07-pipeline-templates](./07-pipeline-templates.spec.md) — Pipeline template engine
- [08-cli-interface](./08-cli-interface.spec.md) — Unified CLI
- [09-mcp-server](./09-mcp-server.spec.md) — Unified MCP server
- [10-audio-module](./10-audio-module.spec.md) — Audio transcription and synthesis

## Lineage

| Source | Version | What is inherited |
|--------|---------|-------------------|
| coaiapy | v0.4.5 (Python) | Core config, Redis, Langfuse, pipeline, environment, audio, GitHub, LLM |
| coaia-narrative | v0.12.0 (TypeScript) | JSONL graph, STC lifecycle, narrative beats, MMOT, CLI visualizer |
| coaia-pde | v0.1.1 (TypeScript) | PDE→STC transformation, session management, direction mapping |
| coaia-planning | v0.1.0 (TypeScript) | Plan parsing, plan↔STC sync, action step telescoping |

## Architectural Decisions

### ESM-Only Package
All imports use `.js` extensions. `"type": "module"` in package.json. No CommonJS fallback.

### Strict TypeScript
`strict: true`, no `any` without explicit justification. Zod for runtime validation at module boundaries.

### Lazy Client Initialization
Redis, OpenAI, Polly, Octokit, Langfuse clients are created on first use. Each module exports `resetClient()` for test isolation. No side effects at import time.

### Single Type Source
All types live in `src/types.ts`. Sub-modules import from there, never define their own parallel types. This is the union of all four parent type systems.

### Config Priority Chain
Environment variables → `.env` file → `coaia.json` → defaults. Deep merge for nested structures.

## MCP Tool Budget

| Module | Inherited tools | Target tools |
|--------|----------------|--------------|
| narrative-engine | 27 (coaia-narrative) | 28 |
| pde-engine | 12 (coaia-pde) | 12 |
| planning-engine | 5 (coaia-planning) | 6 |
| redis | 0 (new) | 5 |
| langfuse | 0 (new) | 8 |
| pipeline | 0 (new) | 3 |
| audio | 0 (new) | 2 |
| **Total** | **44** | **64** |

## Feature Gating

The MCP server supports feature levels controlled by `COAIAJS_FEATURES` or the `coaiajs-mcp --features <level>` CLI flag:
- **MINIMAL** — coaiapy-compatible Redis and Langfuse observability tools
- **STANDARD** — MINIMAL + narrative + PDE + planning
- **OBSERVABILITY** — currently equivalent to STANDARD
- **FULL** — All 64+ tools, including media-oriented Langfuse tools

## Quality Criteria

- ✅ Every coaiapy CLI command has a `coaia` subcommand equivalent
- ✅ Every MCP tool from parent projects is available in `coaiajs-mcp`
- ✅ Type system covers 100% of parent project types
- ✅ JSONL format is byte-compatible with coaia-narrative output
- ✅ Redis tash/fetch behavior identical to coaiapy
- ✅ Config loading produces identical results to coaiapy's read_config()

## Verification Status

Verified on 2026-05-07:

- `npm run build` passes.
- `npm test` passes with 0 tests discovered.
- `npm pack --dry-run` includes the published package surface.
- Installing `coaiajs-0.1.1.tgz` in a fresh temp project allows root imports, subpath imports, `npx coaia --version`, and `npx coaiajs-mcp` startup.

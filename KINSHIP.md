# KINSHIP.md — coaiajs

## Identity

**Name:** coaiajs
**Role:** TypeScript consolidation monorepo — CLI, MCP server, and library
**Status:** Genesis (v0.1.0)

## Lineage

`coaiajs` is born from the convergence of four parent projects. It carries their patterns, types, and responsibilities forward into a unified TypeScript codebase.

### Parent Projects

| Project | Relation | What was inherited |
|---|---|---|
| **coaiapy** (`/src/coaiapy/`) | Primary ancestor | Config management, Redis tash/fetch, LLM wrapper, audio synthesis, GitHub API, environment management, CLI patterns |
| **coaia-narrative** (`/src/coaia-narrative/`) | Structural parent | Entity/Relation/KnowledgeGraph types, JSONL storage, structural tension charts, narrative beats, MMOT evaluations |
| **coaia-pde** (`/src/coaia-pde/`) | Structural parent | DecompositionResult types, PDE session management, direction mapping |
| **coaia-planning** (`/src/coaia-planning/`) | Structural parent | StructuralTensionPlan, plan parsing, action step telescoping |

### Type Lineage

The canonical type source is `src/types.ts`, which is the **union** of:
- `coaia-narrative/src/types.ts` → Entity, Relation, KnowledgeGraph, EntityMetadata, McpToolResult
- `mcp-pde/src/types.ts` (via `IAIP/lib/pde/types.ts`) → DecompositionResult, PrimaryIntent, SecondaryIntent, DirectionMap, ActionItem, AmbiguityFlag
- `coaia-planning/src/types.ts` → StructuralTensionPlan, StructuralElement
- `coaiapy` (Python → TS port) → CoaiaConfig, PipelineTemplate, ScoreConfig

### Sibling Projects

| Project | Relationship |
|---|---|
| **mcp-pde** (`/src/mcp-pde/`) | PDE MCP server — coaiajs absorbs its types and will eventually absorb its MCP tools |
| **mcp-medicine-wheel** (`/src/mcp-medicine-wheel/`) | Four Directions ceremony MCP — remains separate, shares Redis |
| **coaia-visualizer** (`/src/coaia-visualizer/`) | Web UI — will consume coaiajs as a library |
| **IAIP** (`/src/IAIP/`) | Houses canonical PDE types in `lib/pde/types.ts` |

## Accountabilities

1. **Type unification** — `src/types.ts` is the single source of truth. Parent projects should eventually import from here.
2. **Config parity** — `src/config.ts` must support every config path that `coaiapy` supports.
3. **Redis parity** — `src/redis.ts` tash/fetch must behave identically to coaiapy's.
4. **MCP consolidation** — `mcp/` will eventually host all CoAIA MCP tools in one server.
5. **CLI consolidation** — `src/cli.ts` will eventually replace coaiapy's CLI.

## Structural Tension

**Desired Outcome:** A single `npm install coaiajs` provides CLI, MCP server, and library for the entire CoAIA ecosystem.

**Current Reality:** Core types and config scaffolded. Sub-modules (narrative, pde, planning, langfuse, pipeline) are empty directories awaiting implementation.

**Action Steps:**
1. ✅ Scaffold monorepo structure
2. ✅ Implement shared types (union of all parents)
3. ✅ Implement config, redis, environment, llm, audio, github
4. ⬜ Implement narrative module (port from coaia-narrative)
5. ⬜ Implement PDE module (port from mcp-pde)
6. ⬜ Implement planning module (port from coaia-planning)
7. ⬜ Implement MCP server with all tools
8. ⬜ Implement CLI
9. ⬜ Implement Langfuse integration
10. ⬜ Implement pipeline template engine

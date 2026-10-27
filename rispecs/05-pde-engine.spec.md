# 05 — PDE Engine

> Prompt Decomposition Engine with PDE→STC transformation and session management.

## Desired Outcome

A PDE module that transforms `DecompositionResult` objects into coaia-narrative-compatible JSONL, creating Structural Tension Charts from decomposed prompts — intent extraction (EAST direction) carried into strategic action planning (NORTH direction).

## Structural Tension

**Current Reality:**
- [`src/pde/`](../src/pde/) is implemented:
  - [`stc-mapper.ts`](../src/pde/stc-mapper.ts) transforms `DecompositionResult` into coaia-narrative-compatible `Entity[]` and `Relation[]`.
  - [`session-manager.ts`](../src/pde/session-manager.ts) persists PDE/STC sessions as JSONL in `.coaia/pde/`.
  - [`mcp-tools.ts`](../src/pde/mcp-tools.ts) defines 10 implemented MCP tool schemas.
  - [`mcp-handlers.ts`](../src/pde/mcp-handlers.ts) handles import, STC creation, session listing/viewing, action progress, action completion, current-reality updates, and session completion.
  - [`index.ts`](../src/pde/index.ts) exposes library and CLI helper functions.
- PDE types are defined in [`src/types.ts`](../src/types.ts): `DecompositionResult`, `PrimaryIntent`, `SecondaryIntent`, `DirectionMap`, `ActionItem`, `AmbiguityFlag`, `StoredDecomposition`, `PdeSession`.
- [`mcp/server.ts`](../mcp/server.ts) wires PDE tools and namespaces session-action tools that conflict with narrative names (`pde_add_action_step`, `pde_update_current_reality`, etc.).
- Prompt decomposition itself (`pde_decompose`, `pde_parse_response`, `pde_get`, `pde_list`, `pde_export_markdown`) is not implemented inside `coaiajs`. `coaiajs` consumes stored/external PDE outputs and maps them to STC.

**Desired Outcome:**
PDE engine in `src/pde/` that:
- Accepts a `DecompositionResult` from any PDE implementation
- Transforms it into coaia-narrative-compatible JSONL entities and relations
- Manages PDE sessions with JSONL persistence
- Exposes 12 MCP tools

## Four Directions → STC Mapping

| PDE Direction | STC Component | Rationale |
|--------------|---------------|-----------|
| 🌅 EAST (Vision) | **Desired Outcome** | What wants to emerge = what we want to create |
| 🔥 SOUTH (Analysis) | **Current Reality** | What must be understood = where we are now |
| 🌊 WEST (Validation) | **Structural Tension** | What must be reflected upon = the tension |
| ❄️ NORTH (Action) | **Action Steps** | What must be done = steps to resolve tension |

### Field Mapping

```
primary.target          → STC title / desired outcome summary
primary.action          → STC action verb
directions.east[]       → STC desired_outcome (vision statements)
directions.south[]      → STC current_reality (analysis statements)
directions.west[]       → STC structural_tension (validation/reflection)
directions.north[]      → STC action_steps (execution items)
actionStack[]           → STC action_steps (ordered, with dependencies)
secondary[].confidence  → STC action step priority weighting
ambiguities[]           → STC current_reality observations ("⚠️ Ambiguity: …")
```

## Core API

### StcMapper

```typescript
class StcMapper {
  mapToEntities(result: DecompositionResult): { entities: Entity[], relations: Relation[] }
  previewMapping(result: DecompositionResult): StcPreview
}

interface StcPreview {
  desiredOutcome: string;
  currentReality: string;
  actionSteps: { title: string; priority: number }[];
  tensions: string[];
}
```

### SessionManager

```typescript
class SessionManager {
  constructor(pdeDir: string)  // default: '.pde/'
  createSession(decomposition: DecompositionResult): Promise<PdeSession>
  getSession(sessionId: string): Promise<PdeSession | null>
  listSessions(): Promise<PdeSession[]>
  transformToStc(sessionId: string): Promise<{ chartId: string; jsonlPath: string }>
}
```

## MCP Tools (Implemented)

| Tool | Purpose |
|------|---------|
| `import_pde_decomposition` | Load stored `.pde` decomposition and create an STC session |
| `create_stc_from_pde` | Create an STC session from an in-memory `DecompositionResult` |
| `list_pde_decompositions` | List importable stored PDE decomposition files |
| `get_session` | Get PDE/STC session state |
| `list_sessions` | List PDE/STC sessions |
| `pde_update_action_progress` | Add factual progress to a session action |
| `pde_mark_action_complete` | Mark a session action complete |
| `pde_add_action_step` | Add a session action step |
| `pde_update_current_reality` | Add observations to session current reality |
| `complete_session` | Mark a session completed |

## Relation to Planning Engine

PDE and planning are parallel input paths converging on narrative JSONL:

```
mcp-pde → .pde/ → coaiajs pde-engine → narrative JSONL → STC
Claude Plan mode → plan.md → coaiajs planning-engine → narrative JSONL → STC
```

## Quality Criteria

- ✅ StcMapper produces entities/relations compatible with narrative engine's JSONL format
- ✅ Implemented PDE MCP tools route through `mcp/server.ts`
- ✅ PDE sessions are persisted as `.coaia/pde/*.jsonl` files
- ⚠️ Preview mapping and native prompt decomposition remain desired capabilities
- ✅ Ambiguities from decomposition surface as tension sources in the STC

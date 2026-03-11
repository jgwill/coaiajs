# 05 — PDE Engine

> Prompt Decomposition Engine with PDE→STC transformation and session management.

## Desired Outcome

A PDE module that transforms `DecompositionResult` objects into coaia-narrative-compatible JSONL, creating Structural Tension Charts from decomposed prompts — bridging the gap between intent extraction (EAST direction) and strategic action planning (NORTH direction).

## Structural Tension

**Current Reality:**
- `src/pde/` directory exists but is empty
- PDE types fully defined in `src/types.ts`: `DecompositionResult`, `PrimaryIntent`, `SecondaryIntent`, `DirectionMap`, `ActionItem`, `AmbiguityFlag`, `StoredDecomposition`, `PdeSession`
- coaia-pde v0.1.1 has a working implementation:
  - `stc-mapper.ts` (~300 lines) — transforms DecompositionResult → Entity[]/Relation[]
  - `session-manager.ts` — persists PDE sessions as JSONL
  - `mcp-server.ts` — 12 MCP tools
- coaia-pde rispec exists: `pde-to-stc-transformation.rispec.md` — defines the Four Directions → STC mapping

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
ambiguities[]           → STC current_reality gaps / tension sources
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

## MCP Tools (12)

| Tool | Purpose |
|------|---------|
| `pde_decompose` | Build prompts for LLM-driven decomposition |
| `pde_parse_response` | Parse LLM response into DecompositionResult |
| `pde_get` | Retrieve stored decomposition by ID |
| `pde_list` | List stored decompositions |
| `pde_export_markdown` | Export as git-diffable markdown |
| `pde_to_stc` | Transform decomposition into STC |
| `pde_preview_stc` | Preview STC mapping without creating |
| `pde_create_session` | Create new PDE session |
| `pde_get_session` | Get session details |
| `pde_list_sessions` | List all sessions |
| `pde_session_status` | Get session transformation status |
| `pde_bridge_plan` | Bridge to planning engine |

## Relation to Planning Engine

PDE and planning are parallel input paths converging on narrative JSONL:

```
mcp-pde → .pde/ → coaiajs pde-engine → narrative JSONL → STC
Claude Plan mode → plan.md → coaiajs planning-engine → narrative JSONL → STC
```

## Quality Criteria

- ✅ StcMapper produces entities/relations compatible with narrative engine's JSONL format
- ✅ All 12 coaia-pde MCP tools produce identical results
- ✅ PDE sessions are persisted as `.pde/*.json` files
- ✅ Preview mapping shows the transformation without side effects
- ✅ Ambiguities from decomposition surface as tension sources in the STC

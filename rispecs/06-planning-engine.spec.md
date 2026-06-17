# 06 — Planning Engine

> Plan parsing and bidirectional plan↔STC synchronization.

## Desired Outcome

A planning module that parses markdown plans (particularly Claude Plan mode output) into `StructuralTensionPlan` objects, converts them to STC entities, and supports bidirectional sync — so changes to the plan update the STC and vice versa.

## Structural Tension

**Current Reality:**
- [`src/planning/`](../src/planning/) is implemented:
  - [`plan-parser.ts`](../src/planning/plan-parser.ts) parses markdown plans, converts plans to STC entities/relations, exports JSONL, and converts `DecompositionResult` to plan/STC output.
  - [`mcp-tools.ts`](../src/planning/mcp-tools.ts) defines 6 MCP tool schemas.
  - [`mcp-handlers.ts`](../src/planning/mcp-handlers.ts) handles parse, plan-to-STC, plan-to-chart sync, chart-to-plan sync, plan trace creation, and PDE-to-plan conversion.
  - [`index.ts`](../src/planning/index.ts) exposes library and CLI helper functions.
- Types are defined in [`src/types.ts`](../src/types.ts): `StructuralTensionPlan`, `StructuralElement`.
- [`mcp/server.ts`](../mcp/server.ts) routes planning tools to `handlePlanningTool()`.

**Desired Outcome:**
Planning engine in `src/planning/` that:
- Parses markdown plans into `StructuralTensionPlan` objects
- Converts plans to narrative-engine-compatible STC entities
- Supports bidirectional plan↔STC sync
- Exposes 6 MCP tools

## Plan Format

The parser handles markdown plans with this structure:

```markdown
# Plan Title

## Goal
What this plan aims to create.

## Current State
Where things stand right now.

## Steps
1. [ ] First action item
   - Detail about first item
2. [x] Completed item
3. [ ] Third item
   - Sub-detail A
   - Sub-detail B

## Notes
Additional context.
```

## Core API

### PlanParser

```typescript
class PlanParser {
  parse(markdown: string): StructuralTensionPlan
  parseFile(filePath: string): Promise<StructuralTensionPlan>
}

interface StructuralTensionPlan {
  title: string;
  desiredOutcome: string;
  currentReality: string;
  elements: StructuralElement[];
  metadata?: Record<string, unknown>;
}

interface StructuralElement {
  title: string;
  description?: string;
  completed: boolean;
  subElements?: StructuralElement[];
}
```

### PlanToStcConverter

```typescript
class PlanToStcConverter {
  toEntities(plan: StructuralTensionPlan): { entities: Entity[], relations: Relation[] }
  fromStc(chartId: string, graph: KnowledgeGraph): StructuralTensionPlan
  sync(plan: StructuralTensionPlan, chartId: string, graph: KnowledgeGraph): SyncResult
}

interface SyncResult {
  newEntities: Entity[];
  updatedEntities: Entity[];
  removedEntities: string[];
  conflicts: SyncConflict[];
}
```

## Bidirectional Sync

Plan → STC:
- Plan `Goal` maps to chart desired outcome
- Plan `Current State` maps to chart current reality
- Plan `Steps` map to chart action steps
- Completed steps (`[x]`) map to completed actions
- Sub-items map to telescoped action steps

STC → Plan:
- Chart desired outcome maps to plan `Goal`
- Chart current reality maps to plan `Current State`
- Action steps map to plan `Steps` with checkbox state
- Progress observations map to sub-items

Conflict resolution: STC wins by default (it is the source of truth). Conflicts are reported in `SyncResult.conflicts` for human review.

## MCP Tools (Implemented)

| Tool | Purpose |
|------|---------|
| `parse_plan_structural` | Parse markdown plan into structured object |
| `plan_to_stc` | Convert parsed plan to STC entities |
| `sync_plan_to_chart` | Write plan-derived STC JSONL |
| `sync_chart_to_plan` | Generate plan markdown from STC JSONL |
| `create_plan_trace` | Generate trace payload for plan→STC transformation |
| `pde_to_plan` | Convert PDE decomposition into STC JSONL |

## Quality Criteria

- ✅ Parses Claude Plan mode output without modification
- ✅ Checkbox state (`[ ]` / `[x]`) maps correctly to action completion
- ✅ Sub-items preserved through parse → STC → plan round-trip
- ✅ Bidirectional sync supports dry-run and write modes
- ✅ Generated markdown is readable and re-parseable

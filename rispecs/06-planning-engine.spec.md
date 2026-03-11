# 06 — Planning Engine

> Plan parsing and bidirectional plan↔STC synchronization.

## Desired Outcome

A planning module that parses markdown plans (particularly Claude Plan mode output) into `StructuralTensionPlan` objects, converts them to STC entities, and supports bidirectional sync — so changes to the plan update the STC and vice versa.

## Structural Tension

**Current Reality:**
- `src/planning/` directory exists but is empty
- Types defined in `src/types.ts`: `StructuralTensionPlan`, `StructuralElement`
- coaia-planning v0.1.0 has a working implementation:
  - `plan-parser.ts` (821 lines) — parses markdown plans into structured objects
  - `tools/index.ts` — 5 MCP tools + 1 PDE bridge tool
- No rispecs exist for coaia-planning — this is the first specification

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

## MCP Tools (6)

| Tool | Purpose |
|------|---------|
| `plan_parse` | Parse markdown plan into structured object |
| `plan_to_stc` | Convert parsed plan to STC entities |
| `plan_from_stc` | Generate plan markdown from STC |
| `plan_sync` | Bidirectional sync between plan and STC |
| `plan_diff` | Show differences between plan and STC |
| `plan_bridge_pde` | Import PDE decomposition as plan |

## Quality Criteria

- ✅ Parses Claude Plan mode output without modification
- ✅ Checkbox state (`[ ]` / `[x]`) maps correctly to action completion
- ✅ Sub-items preserved through parse → STC → plan round-trip
- ✅ Bidirectional sync detects and reports conflicts
- ✅ Generated markdown is readable and re-parseable

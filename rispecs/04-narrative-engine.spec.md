# 04 — Narrative Engine

> JSONL knowledge graph with structural tension charts, narrative beats, and MMOT self-evaluation.

This is the most complex module — the heart of CoAiA's creative advancement system.

## Desired Outcome

A KnowledgeGraphManager that provides full CRUD for entities and relations stored in append-only JSONL, implements the complete structural tension chart lifecycle (create → telescope → advance → complete), supports narrative beat creation with multi-universe perspectives, and enables MMOT autonomous self-evaluation — all through a single TypeScript class.

## Structural Tension

**Current Reality:**
- `src/narrative/` directory exists but is empty
- Types fully defined in `src/types.ts`: `Entity`, `EntityMetadata`, `Relation`, `RelationMetadata`, `KnowledgeGraph`, `McpToolResult`
- coaia-narrative v0.12.0 has a working implementation:
  - `graph-manager.ts` (1,294 lines) — the core engine
  - `tool-definitions.ts` — 27 MCP tool schemas
  - `tool-handlers.ts` — tool implementation connecting MCP to graph manager
  - `tool-groups.ts` — tool filtering by group (STC_TOOLS, KG_TOOLS, CORE_TOOLS)
  - `types.ts` — type definitions (absorbed into coaiajs `src/types.ts`)
- coaia-narrative rispecs are the most mature (15 specs) — detailed behavioral specifications exist for every capability

**Desired Outcome:**
Narrative engine in `src/narrative/` that:
- Implements `KnowledgeGraphManager` with identical behavior to coaia-narrative
- Stores all data in append-only JSONL format
- Manages the full STC lifecycle
- Supports narrative beats with dramatic typing and multi-universe perspectives
- Enables MMOT evaluation with Elements of Performance
- Exposes 28 MCP tools (27 from coaia-narrative + 1 new)

## Core Class: KnowledgeGraphManager

### JSONL Storage

```typescript
class KnowledgeGraphManager {
  constructor(memoryFilePath: string)
  loadGraph(): Promise<KnowledgeGraph>
  saveGraph(): Promise<void>
}
```

The JSONL file is the single source of truth. Each line is a JSON event:
- `{"type":"entity","data":{...}}` — entity creation/update
- `{"type":"relation","data":{...}}` — relation creation
- `{"type":"observation","data":{...}}` — observation added to entity

On load: replay all events to reconstruct in-memory graph. On write: append new events. This append-only design prevents corruption from interrupted writes.

### Knowledge Graph CRUD

```typescript
// Entities
createEntities(entities: Entity[]): Promise<Entity[]>
deleteEntities(entityNames: string[]): Promise<void>
addObservations(observations: {entityName: string, contents: string[]}[]): Promise<void>
deleteObservations(deletions: {entityName: string, observations: string[]}[]): Promise<void>

// Relations
createRelations(relations: Relation[]): Promise<Relation[]>
deleteRelations(relations: {from: string, to: string, relationType: string}[]): Promise<void>

// Queries
searchNodes(query: string): Promise<Entity[]>
openNodes(names: string[]): Promise<Entity[]>
readGraph(): Promise<KnowledgeGraph>
```

### Structural Tension Chart Lifecycle

```
CREATE → TELESCOPE → ADVANCE → COMPLETE
```

**Create:** Desired outcome + current reality + optional action steps → chart entity + related entities + auto-distributed due dates. Validates creative orientation (no problem-solving language) and delayed resolution (no "ready to begin" in current reality).

**Telescope:** Break an action step into a sub-chart with its own desired outcome, current reality, and action steps. Inherits due date constraints from parent.

**Advance:** Mark action step complete → completion flows into parent current reality as fact. Update progress without completion via progress observations.

**Complete:** All action steps done → chart marked complete. Phase transitions: germination → assimilation → completion.

### STC Tools

| Tool | Purpose |
|------|---------|
| `create_structural_tension_chart` | Create master chart |
| `list_active_charts` | Overview all charts with progress |
| `get_chart` | Full chart details |
| `get_chart_progress` | Progress metrics and next action |
| `manage_action_step` | Add or telescope action steps (unified) |
| `mark_action_complete` | Complete an action, flow to parent reality |
| `update_action_progress` | Track progress without completion |
| `update_current_reality` | Add observations to current reality |
| `update_desired_outcome` | Modify chart goal |
| `get_action_step` | Get telescoped action step details |
| `remove_action_step` | Delete action step from chart |

### Narrative Beat System

Narrative beats document story progression within a structural tension chart. Each beat has:
- **Act** (1, 2, or 3) — three-act dramatic structure
- **Dramatic type** — Exposition, Rising Action, Climax, Resolution, Discovery, Crisis, Integration
- **Universes** — perspectives: Engineer World, Ceremony World, Story Engine World
- **Prose** — character-level narrative
- **Lessons** — extracted insights

| Tool | Purpose |
|------|---------|
| `create_narrative_beat` | Create dramatic beat within chart |
| `telescope_narrative_beat` | Break beat into sub-beats |
| `list_narrative_beats` | List beats for a chart |

### MMOT Evaluation

Managerial Moment of Truth — autonomous self-evaluation against Elements of Performance:

1. **Acknowledge** — Compare expected vs delivered output
2. **Analyze** — What dynamics caused the gap?
3. **Update** — Write findings into current reality
4. **Recommit** — Add corrective action steps if needed

Supports directional perspectives: South (design/structure), East (narrative/execution), West (embodied/execution), North (wisdom/design).

| Tool | Purpose |
|------|---------|
| `perform_mmot_evaluation` | Run MMOT self-evaluation on chart |
| `init_llm_guidance` | Provide methodology guidance to LLMs |

### Knowledge Graph Tools

| Tool | Purpose |
|------|---------|
| `create_entities` | Add entities to graph |
| `create_relations` | Create relationships |
| `add_observations` | Add facts to entities |
| `search_nodes` | Full-text search |
| `open_nodes` | Retrieve specific entities |
| `read_graph` | Export complete graph |
| `delete_entities` | Remove entities |
| `delete_relations` | Remove relationships |
| `delete_observations` | Remove observations |

## Creative Orientation Validation

Desired outcomes are validated against problem-solving language:
- **Reject**: fix, solve, eliminate, prevent, stop, avoid, reduce, remove
- **Accept**: create, build, establish, develop, design, manifest, achieve

Current reality is validated against false readiness:
- **Reject**: ready to, prepared to, all set, ready for, set to
- **Accept**: specific factual assessments

Error messages teach the principle, not just reject the input.

## Date Distribution

When action steps are created without explicit due dates:
```
totalTime = endDate - startDate
stepInterval = totalTime / (stepCount + 1)
dates[i] = startDate + (stepInterval * i)
```

## Related Rispecs

- `coaia-narrative/rispecs/structural_tension_chart_creation.spec.md` — detailed STC creation behavior
- `coaia-narrative/rispecs/telescoping_hierarchical_advancement.spec.md` — telescoping rules
- `coaia-narrative/rispecs/advancing_pattern_tracking.spec.md` — completion flow
- `coaia-narrative/rispecs/storage_knowledge_graph.spec.md` — JSONL format specification
- `coaia-narrative/rispecs/mmot_evaluation_loop.spec.md` — MMOT phases
- `coaia-narrative/rispecs/narrative_beat_creation.spec.md` — beat system
- `coaia-narrative/rispecs/mcp_api_specification.spec.md` — tool schemas (28 tools)

## Quality Criteria

- ✅ JSONL output is byte-compatible with coaia-narrative output
- ✅ All 27 coaia-narrative MCP tools produce identical results
- ✅ Graph loads correctly from existing coaia-narrative JSONL files
- ✅ Creative orientation validation matches coaia-narrative behavior exactly
- ✅ STC lifecycle (create → telescope → advance → complete) is complete
- ✅ MMOT evaluation writes findings into current reality
- ✅ Narrative beats support all dramatic types and universe perspectives

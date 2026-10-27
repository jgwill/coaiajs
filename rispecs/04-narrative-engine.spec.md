# 04 — Narrative Engine

> JSONL knowledge graph with structural tension charts, narrative beats, and MMOT self-evaluation.

This is the most complex module — the heart of CoAiA's creative advancement system.

## Desired Outcome

A KnowledgeGraphManager that provides full CRUD for entities and relations stored in append-only JSONL, implements the complete structural tension chart lifecycle (create → telescope → advance → complete), supports narrative beat creation with multi-universe perspectives, and enables MMOT autonomous self-evaluation — all through a single TypeScript class.

## Structural Tension

**Current Reality:**
- [`src/narrative/`](../src/narrative/) is implemented:
  - [`graph-manager.ts`](../src/narrative/graph-manager.ts) is the core JSONL graph/STC/narrative/MMOT engine.
  - [`tool-definitions.ts`](../src/narrative/tool-definitions.ts) defines the MCP tool schemas and groups.
  - [`tool-handlers.ts`](../src/narrative/tool-handlers.ts) connects MCP tool calls to `KnowledgeGraphManager`.
  - [`markdown-export.ts`](../src/narrative/markdown-export.ts) handles chart, progress, stats, and all-chart markdown exports.
  - [`index.ts`](../src/narrative/index.ts) exposes library and CLI helper functions for `coaiajs/narrative`.
- Types are shared through [`src/types.ts`](../src/types.ts) and re-exported through [`src/narrative/types.ts`](../src/narrative/types.ts).
- [`mcp/server.ts`](../mcp/server.ts) now routes narrative tools to `handleToolCall()` with a `KnowledgeGraphManager`.
- `coaia narrative list` smoke-tested successfully against an empty memory file.
- [`delayed-resolution.ts`](../src/narrative/delayed-resolution.ts) (0.6.0, 0.6.1) holds the pure half of delayed resolution: a step's derived status, days remaining, owed, and the resume command. The graph manager writes the records. Specified in [`11-delayed-resolution.spec.md`](./11-delayed-resolution.spec.md) (Episode 297, `miadi-chronicle://297`).
- The narrative surface counts 35 MCP tools on 0.6.1 (`tool-definitions.ts`): 19 STC, 3 narrative beat, 3 Wampum Belt, 9 knowledge graph, and `init_llm_guidance`.

**Desired Outcome:**
Narrative engine in `src/narrative/` that:
- Implements `KnowledgeGraphManager` with identical behavior to coaia-narrative
- Stores all data in append-only JSONL format
- Manages the full STC lifecycle
- Supports narrative beats with dramatic typing and multi-universe perspectives
- Enables MMOT evaluation with Elements of Performance
- Exposes 35 MCP tools, carried forward from coaia-narrative 0.16.2 and grown on their own since (the delay tools of 0.6.0)

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

**Create:** Desired outcome + current reality + optional action steps → chart entity + related entities + auto-distributed due dates. Validates creative orientation (no problem-solving language) and refuses readiness language in current reality ("ready to", "prepared to", "all set", "ready for", "set to"), which would resolve the tension early by assumption. This older sense of "delayed resolution" (holding the tension) is distinct from the recorded delay on a step below.

**Telescope:** Break an action step into a sub-chart with its own desired outcome, current reality, and action steps. Inherits due date constraints from parent.

**Advance:** Mark action step complete → completion flows into parent current reality as fact. Update progress without completion via progress observations.

**Complete:** All action steps done → chart marked complete. Phase transitions: germination → assimilation → completion.

**Delay (0.6.0):** A step not yet completed can carry a recorded choice to delay its resolution until `resolveBy`, which becomes its due date. Its derived status reads `delayed` until the delay is ended (rehydrated or released) or the step is completed (`resolved`). `completionStatus` stays the stored truth. See [`11-delayed-resolution.spec.md`](./11-delayed-resolution.spec.md).

### STC Tools

| Tool | Purpose |
|------|---------|
| `create_structural_tension_chart` | Create master chart |
| `list_active_charts` | Overview all charts with progress |
| `get_chart` | Full chart details |
| `get_chart_progress` | Progress metrics, next action, `delayedActions` and `owedActions` |
| `manage_action_step` | Add or telescope action steps (unified) |
| `add_action_step` | Deprecated in favour of `manage_action_step`; still registered |
| `telescope_action_step` | Break a step into a sub-chart |
| `mark_action_complete` | Complete an action, flow to parent reality; ends an open delay as `resolved` (optional `completedBy`) |
| `update_action_progress` | Track progress without completion |
| `update_current_reality` | Add observations to current reality |
| `update_desired_outcome` | Modify chart goal |
| `update_chart_due_date` | Move a chart's due date with its desired outcome; optionally redistribute open steps |
| `get_action_step` | A written step as itself plus any chart it grew into, or a telescoped step as its chart (written steps answered "not found" before 0.6.0) |
| `remove_action_step` | Delete action step from chart |
| `delay_resolution` | Record a strategic choice to delay a step's resolution (0.6.0) |
| `list_delayed_resolutions` | Delayed steps by `resolveBy`, with days remaining and owed (0.6.0) |
| `end_delayed_resolution` | End a delay as `rehydrated` (returns the resume command) or `released` (0.6.0) |
| `link_chart_to_github_issue` | Record the `owner/repo#number` a chart was written from |
| `perform_mmot_evaluation` | MMOT (listed below) |

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

### Wampum Belt

`create_wampum_belt`, `add_wampum_bead`, `read_wampum_belt`: sequencing parallel to linear narrative beats, carried from coaia-narrative.

### MMOT Evaluation

Managerial Moment of Truth — autonomous self-evaluation against Elements of Performance:

1. **Acknowledge** — Compare expected vs delivered output
2. **Analyze** — What dynamics caused the discrepancy?
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
- `coaia-narrative/rispecs/mcp_api_specification.spec.md` — tool schemas (28 tools at the time it was written)
- [`11-delayed-resolution.spec.md`](./11-delayed-resolution.spec.md) — the recorded delay on a step, its session, listing and ending

## Quality Criteria

- ✅ JSONL output is byte-compatible with coaia-narrative output
- ✅ The 27 original coaia-narrative MCP tools produce identical results (the tools added since, including the delay tools, are coaiajs's own port and may differ in detail: see spec 11)
- ✅ Graph loads correctly from existing coaia-narrative JSONL files
- ✅ Creative orientation validation matches coaia-narrative behavior exactly
- ✅ STC lifecycle (create → telescope → advance → complete) is complete
- ✅ MMOT evaluation writes findings into current reality
- ✅ Narrative beats support all dramatic types and universe perspectives

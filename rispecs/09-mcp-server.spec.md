# 09 — MCP Server

> Unified MCP server exposing 64+ tools from all modules with feature gating.

## Desired Outcome

A single MCP server (`coaiajs-mcp`) that consolidates the 44 tools from coaia-narrative (27), coaia-pde (12), and coaia-planning (5) into one server, adds 20 new tools for Redis, Langfuse, pipeline, and audio, and supports feature gating so resource-constrained environments can load only what they need.

## Structural Tension

**Current Reality:**
- [`package.json`](../package.json) defines `"coaiajs-mcp": "./dist/mcp/server.js"`.
- [`mcp/server.ts`](../mcp/server.ts) implements stdio MCP transport using `@modelcontextprotocol/sdk`.
- [`mcp/config.ts`](../mcp/config.ts) implements `MINIMAL`, `STANDARD`, `OBSERVABILITY`, and `FULL` feature sets via `COAIAJS_FEATURES` or `--features`.
- [`mcp/tools/coaiapy-tools.ts`](../mcp/tools/coaiapy-tools.ts) defines coaiapy-compatible Redis and Langfuse tool schemas.
- [`mcp/resources.ts`](../mcp/resources.ts) implements `coaia://templates/` resources backed by the pipeline template loader.
- [`mcp/prompts.ts`](../mcp/prompts.ts) implements the three coaiapy-mcp prompt templates.
- `npx coaiajs-mcp` starts successfully from an installed package tarball and reports `STANDARD: 64 tools, 3 prompts, 3 resources`.
- Remaining gap: several desired package-native tool groups (audio and pipeline execution tools) are not exposed as standalone MCP tools yet; pipeline templates are currently exposed as resources.

**Desired Outcome:**
Single MCP server at `mcp/server.ts` providing:
- Parent and coaiapy-compatible tools through one stdio server
- Template resources and workflow prompts from coaiapy-mcp
- Feature gating via `COAIAJS_FEATURES` or `--features`
- Single server entry in MCP client config

## Feature Gating

```typescript
type FeatureLevel = 'MINIMAL' | 'STANDARD' | 'OBSERVABILITY' | 'FULL';
```

| Mode | Tools loaded | Use case |
|------|-------------|----------|
| **MINIMAL** | Redis + Langfuse observability core tools | Observability-only sessions |
| **STANDARD** | MINIMAL + narrative + PDE + planning tools | Standard development sessions |
| **OBSERVABILITY** | Alias of STANDARD in current implementation | Compatibility mode |
| **FULL** | All registered tools, including media tools | Full-featured agent sessions |

Default feature level: `STANDARD`.

## Server Architecture

```typescript
// mcp/server.ts
const featureConfig = new FeatureConfig(cliArgs.featureLevel);
const server = new Server({
  name: 'coaiajs-mcp',
  version: '0.1.1',
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.filter((tool) => featureConfig.isToolEnabled(tool.name)),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(request.params.name, request.params.arguments ?? {});
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Registry

### Narrative Engine (28 tools — always loaded)

STC: `create_structural_tension_chart`, `list_active_charts`, `get_chart`, `get_chart_progress`, `manage_action_step`, `mark_action_complete`, `update_action_progress`, `update_current_reality`, `update_desired_outcome`, `get_action_step`, `remove_action_step`

Knowledge Graph: `create_entities`, `create_relations`, `add_observations`, `search_nodes`, `open_nodes`, `read_graph`, `delete_entities`, `delete_relations`, `delete_observations`

Narrative Beats: `create_narrative_beat`, `telescope_narrative_beat`, `list_narrative_beats`

MMOT: `perform_mmot_evaluation`, `init_llm_guidance`

### PDE Engine (10 tools — STANDARD+)

`import_pde_decomposition`, `create_stc_from_pde`, `list_pde_decompositions`, `get_session`, `list_sessions`, `pde_update_action_progress`, `pde_mark_action_complete`, `pde_add_action_step`, `pde_update_current_reality`, `complete_session`

### Planning Engine (6 tools — STANDARD+)

`parse_plan_structural`, `plan_to_stc`, `sync_plan_to_chart`, `sync_chart_to_plan`, `create_plan_trace`, `pde_to_plan`

### Redis

`coaia_tash`, `coaia_fetch`

### Langfuse

`coaia_fuse_trace_create`, `coaia_fuse_add_observation`, `coaia_fuse_trace_patch_output`, `coaia_fuse_trace_get`, `coaia_fuse_trace_view`, `coaia_fuse_observation_get`, `coaia_fuse_traces_list`, `coaia_fuse_traces_session_view`, comments, prompts, datasets, score configs, score application, and media tools.

### Resources

`coaia://templates/`, `coaia://templates/{name}`, `coaia://templates/{name}/variables`

### Prompts

`mia_miette_duo`, `create_observability_pipeline`, `analyze_audio_workflow`

## Tool Registration Pattern

The current server uses plain tool definition arrays plus dispatch handlers:

```typescript
const allToolDefs = [
  ...getCoaiapyToolDefinitions(featureConfig),
  ...getNarrativeToolDefinitions(featureConfig),
  ...getPdeToolDefinitions(featureConfig),
  ...getPlanningToolDefinitions(featureConfig),
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allToolDefs }));
server.setRequestHandler(CallToolRequestSchema, async (request) => routeToolCall(request.params));
```

## Transport

stdio transport only (standard MCP pattern). Server reads JSON-RPC from stdin, writes to stdout. This is compatible with all MCP clients (Claude Code, Cursor, VS Code Copilot, etc.).

## Quality Criteria

- ✅ Single MCP config entry replaces three separate servers
- ✅ Implemented parent tools route to TypeScript handlers instead of placeholders
- ✅ Feature gating reduces tool count without breaking functionality
- ✅ `COAIAJS_FEATURES` and `--features` select feature level
- ✅ Server starts from installed tarball with `npx coaiajs-mcp`
- ✅ Tool descriptions are self-documenting (LLMs understand usage without external docs)
- ✅ Error responses include actionable information

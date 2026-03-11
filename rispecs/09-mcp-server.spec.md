# 09 — MCP Server

> Unified MCP server exposing 64+ tools from all modules with feature gating.

## Desired Outcome

A single MCP server (`coaiajs-mcp`) that consolidates the 44 tools from coaia-narrative (27), coaia-pde (12), and coaia-planning (5) into one server, adds 20 new tools for Redis, Langfuse, pipeline, and audio, and supports feature gating so resource-constrained environments can load only what they need.

## Structural Tension

**Current Reality:**
- MCP server entry defined in `package.json` as `"coaiajs-mcp": "./dist/mcp/server.js"` but `mcp/` directory is empty (only a `tools/` subdirectory stub)
- `@modelcontextprotocol/sdk` v1.25.0 is installed as a dependency
- Four separate MCP servers exist in parent projects:
  - coaia-narrative: 27 tools (STC lifecycle, knowledge graph, narrative beats, MMOT)
  - coaia-pde: 12 tools (decomposition, session management, STC transformation)
  - coaia-planning: 5 tools (plan parsing, plan↔STC sync, PDE bridge)
  - coaiapy: 0 MCP tools (Python library only, no MCP)
- Each parent server has its own startup, tool registration, and transport handling
- Users currently need 3 MCP server entries in their config to access all tools

**Desired Outcome:**
Single MCP server at `mcp/server.ts` providing:
- All 44 parent tools with identical schemas and behavior
- 20 new tools for previously-CLI-only functionality
- Feature gating via `COAIAJS_MCP_MODE` environment variable
- Single server entry in MCP client config

## Feature Gating

```typescript
type McpMode = 'MINIMAL' | 'STANDARD' | 'FULL';
```

| Mode | Tools loaded | Use case |
|------|-------------|----------|
| **MINIMAL** | STC tools (11), KG tools (9), MMOT (2), narrative beats (3) = **25** | Memory-constrained agents, basic STC workflow |
| **STANDARD** | MINIMAL + PDE (12) + planning (6) + Redis (5) = **48** | Standard development sessions |
| **FULL** | STANDARD + Langfuse (8) + pipeline (3) + audio (2) + guidance (3) = **64** | Full-featured agent sessions |

Default mode: `STANDARD`.

## Server Architecture

```typescript
// mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'coaiajs-mcp',
  version: pkg.version
});

// Register tools based on mode
const mode = (process.env.COAIAJS_MCP_MODE ?? 'STANDARD') as McpMode;
registerNarrativeTools(server);       // always
if (mode !== 'MINIMAL') {
  registerPdeTools(server);
  registerPlanningTools(server);
  registerRedisTools(server);
}
if (mode === 'FULL') {
  registerLangfuseTools(server);
  registerPipelineTools(server);
  registerAudioTools(server);
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Registry

### Narrative Engine (28 tools — always loaded)

STC: `create_structural_tension_chart`, `list_active_charts`, `get_chart`, `get_chart_progress`, `manage_action_step`, `mark_action_complete`, `update_action_progress`, `update_current_reality`, `update_desired_outcome`, `get_action_step`, `remove_action_step`

Knowledge Graph: `create_entities`, `create_relations`, `add_observations`, `search_nodes`, `open_nodes`, `read_graph`, `delete_entities`, `delete_relations`, `delete_observations`

Narrative Beats: `create_narrative_beat`, `telescope_narrative_beat`, `list_narrative_beats`

MMOT: `perform_mmot_evaluation`, `init_llm_guidance`

### PDE Engine (12 tools — STANDARD+)

`pde_decompose`, `pde_parse_response`, `pde_get`, `pde_list`, `pde_export_markdown`, `pde_to_stc`, `pde_preview_stc`, `pde_create_session`, `pde_get_session`, `pde_list_sessions`, `pde_session_status`, `pde_bridge_plan`

### Planning Engine (6 tools — STANDARD+)

`plan_parse`, `plan_to_stc`, `plan_from_stc`, `plan_sync`, `plan_diff`, `plan_bridge_pde`

### Redis (5 tools — STANDARD+)

`redis_tash`, `redis_fetch`, `redis_del`, `redis_keys`, `redis_exists`

### Langfuse (8 tools — FULL only)

`langfuse_list_traces`, `langfuse_get_trace`, `langfuse_list_prompts`, `langfuse_get_prompt`, `langfuse_list_datasets`, `langfuse_list_scores`, `langfuse_create_score`, `langfuse_list_score_configs`

### Pipeline (3 tools — FULL only)

`pipeline_list`, `pipeline_render`, `pipeline_execute`

### Audio (2 tools — FULL only)

`audio_transcribe`, `audio_synthesize`

## Tool Registration Pattern

Each module provides a `registerXxxTools(server: McpServer)` function:

```typescript
// mcp/tools/redis.ts
export function registerRedisTools(server: McpServer) {
  server.tool('redis_tash', 'Store a value in Redis with optional TTL', {
    key: z.string().describe('Redis key'),
    value: z.string().describe('Value to store'),
    ttl: z.number().optional().describe('TTL in seconds'),
  }, async ({ key, value, ttl }) => {
    await tash(key, value, ttl);
    return { content: [{ type: 'text', text: `Stored ${key}` }] };
  });
  // ... more tools
}
```

## Transport

stdio transport only (standard MCP pattern). Server reads JSON-RPC from stdin, writes to stdout. This is compatible with all MCP clients (Claude Code, Cursor, VS Code Copilot, etc.).

## Quality Criteria

- ✅ Single MCP config entry replaces three separate servers
- ✅ All 44 parent tools produce identical results to their parent implementations
- ✅ Feature gating reduces tool count without breaking functionality
- ✅ `COAIAJS_MCP_MODE=MINIMAL` loads ≤25 tools
- ✅ Server starts in <500ms for MINIMAL mode
- ✅ Tool descriptions are self-documenting (LLMs understand usage without external docs)
- ✅ Error responses include actionable information

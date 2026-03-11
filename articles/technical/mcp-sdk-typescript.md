# @modelcontextprotocol/sdk: Technical Assessment for CoAiA.js

> Package selection brief — MCP server and client framework for exposing CoAiA tools, resources, and prompts to LLM agents

## Summary & Recommendation

**Use `@modelcontextprotocol/sdk` v1.x** (currently 1.27.x). This is the official Tier-1 TypeScript SDK for the Model Context Protocol. It's already used by coaia-pde, coaia-planning, and coaia-narrative. For coaiajs, we consolidate all three MCP servers into a single unified server with Zod-validated tools. Stick with v1 until v2 reaches stable (expected Q2 2026).

**Pin:** `"@modelcontextprotocol/sdk": "^1.25.0"` + `"zod": "^4.0.0"` (peer dependency)

## What We're Replacing

Three separate MCP servers each with their own Server instance:

### coaia-pde (Server + raw JSON schemas)
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'coaia-pde', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch(name) { case 'import_pde_decomposition': /* ... */ }
});
```

### coaia-planning (Server + minimist config)
```typescript
const args = minimist(process.argv.slice(2));
const PLANS_DIR = args['plans-dir'] || process.env.COAIA_PLANS_DIR;
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (name) {
    case 'parse_plan_structural': /* ... */
    case 'plan_to_stc': /* ... */
  }
});
```

### coaia-narrative (Server + custom validation.ts)
```typescript
// Uses custom validation.ts for argument checking before processing
const { valid, error } = validate(args, EntityArraySchema);
if (!valid) return errorResponse(error);
```

All three use the **low-level** `Server` class with raw `setRequestHandler` and manual JSON schema definitions. The SDK's higher-level `McpServer` class with Zod eliminates this boilerplate.

## Options Compared

| Feature | McpServer (high-level) | Server (low-level) | Custom HTTP |
|---------|----------------------|-------------------|-------------|
| Tool definition | `server.tool(name, schema, handler)` | Manual `setRequestHandler` + switch | Manual routing |
| Schema validation | Zod automatic | Manual JSON Schema | Manual |
| Type inference | Full from Zod schemas | Manual casting | None |
| Resource support | `server.resource()` | Manual handler | Manual |
| Prompt templates | `server.prompt()` | Manual handler | N/A |
| Transport | Stdio, HTTP, SSE built-in | Stdio, HTTP, SSE built-in | Custom |
| Code per tool | ~10 lines | ~25 lines | ~50 lines |
| Used by our projects | New for coaiajs | coaia-pde, coaia-planning, coaia-narrative | N/A |

## API Overview

### Unified MCP Server (High-Level API)

```typescript
// mcp/server.ts — single unified MCP server for coaiajs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'coaiajs',
  version: '1.0.0',
});

// --- NARRATIVE TOOLS ---

server.tool(
  'create_structural_tension_chart',
  'Create a new structural tension chart with desired outcome and current reality',
  {
    desiredOutcome: z.string().min(1).describe('What you want to CREATE'),
    currentReality: z.string().min(1).describe('Factual assessment — never "ready to begin"'),
    dueDate: z.string().datetime().optional().describe('ISO 8601 target date'),
    actionSteps: z.array(z.string()).optional().describe('Initial action steps'),
  },
  async ({ desiredOutcome, currentReality, dueDate, actionSteps }) => {
    const chart = await createChart({ desiredOutcome, currentReality, dueDate, actionSteps });
    return { content: [{ type: 'text', text: JSON.stringify(chart) }] };
  }
);

server.tool(
  'mark_action_complete',
  'Mark an action step as completed',
  {
    actionStepName: z.string().min(1).describe('Name of the completed action step'),
  },
  async ({ actionStepName }) => {
    const result = await markComplete(actionStepName);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

// --- PDE TOOLS ---

server.tool(
  'pde_decompose',
  'Decompose a complex prompt into structured facets',
  {
    prompt: z.string().min(1).describe('The complex prompt to decompose'),
    extractImplicit: z.boolean().default(true).describe('Extract implicit intents'),
    mapDependencies: z.boolean().default(true).describe('Map inter-facet dependencies'),
  },
  async ({ prompt, extractImplicit, mapDependencies }) => {
    const result = await decompose(prompt, { extractImplicit, mapDependencies });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

// --- PLANNING TOOLS ---

server.tool(
  'parse_plan_structural',
  'Parse a plan into structural tension format',
  {
    planPath: z.string().optional().describe('Path to plan file'),
    planContent: z.string().optional().describe('Raw plan content'),
  },
  async ({ planPath, planContent }) => {
    const parsed = planPath ? await parsePlan(planPath) : parsePlanContent(planContent!);
    return { content: [{ type: 'text', text: JSON.stringify(parsed) }] };
  }
);
```

### Resources (Read-Only Data)

```typescript
// Expose chart data as MCP resources
server.resource(
  'charts',
  'chart://list',
  async (uri) => {
    const charts = await listActiveCharts();
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(charts),
      }],
    };
  }
);

// Dynamic resource with URI template
server.resource(
  'chart-detail',
  'chart://{chartId}',
  async (uri, { chartId }) => {
    const chart = await getChart(chartId);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(chart),
      }],
    };
  }
);
```

### Prompt Templates

```typescript
server.prompt(
  'mmot-evaluation',
  'MMOT self-evaluation prompt for structural tension chart',
  {
    chartId: z.string().describe('Chart ID to evaluate'),
    direction: z.enum(['South', 'East', 'West', 'North']).optional(),
  },
  async ({ chartId, direction }) => {
    const chart = await getChart(chartId);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Evaluate chart "${chart.desiredOutcome}" from ${direction ?? 'all'} direction(s)...`,
        },
      }],
    };
  }
);
```

### Transport & Startup

```typescript
// Stdio transport (default for CLI agent integration)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('coaiajs MCP server running on stdio');
}

main().catch(console.error);
```

### Low-Level API (when needed)

For advanced scenarios (custom transports, middleware, session state), the low-level `Server` class remains available:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const lowLevelServer = new Server(
  { name: 'coaiajs-advanced', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// Custom request handler with full control
lowLevelServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Pre-processing middleware, custom logging, etc.
});
```

## Integration Plan

1. **Unified server:** `mcp/server.ts` — single McpServer combining all tools
2. **Tool modules:** `mcp/tools/` directory
   - `narrative.ts` — chart CRUD, action steps, MMOT
   - `pde.ts` — prompt decomposition tools
   - `planning.ts` — plan parsing, STC conversion
   - `pipeline.ts` — pipeline template execution
   - `langfuse.ts` — trace/score management
3. **Resources:** `mcp/resources/` — chart data, session data, template listings
4. **Prompts:** `mcp/prompts/` — MMOT evaluation, PDE system prompts
5. **Bin entry:** `"coaiajs-mcp": "./dist/mcp/server.js"` in package.json
6. **Migration:** Gradually absorb coaia-pde, coaia-planning, coaia-narrative tools

### Tool Registration Pattern

```typescript
// mcp/tools/index.ts — register all tool modules
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAllTools(server: McpServer) {
  registerNarrativeTools(server);
  registerPdeTools(server);
  registerPlanningTools(server);
  registerPipelineTools(server);
  registerLangfuseTools(server);
}
```

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 1.27.1 (Feb 2026) |
| V2 status | Pre-alpha on main branch, stable Q1-Q2 2026 |
| Peer dependency | zod ≥3.25 |
| Transports | stdio, Streamable HTTP, SSE |
| Node.js compat | ≥18 (we target ≥20) |
| TypeScript | Native, first-class |
| Protocol spec | modelcontextprotocol.io |
| Weekly downloads | Growing rapidly (protocol adoption) |
| License | MIT |

## V1 → V2 Migration Notes

V2 (pre-alpha) brings breaking changes. Our plan:
- Build on V1 now (`^1.25.0`)
- V1 will receive security updates for 6+ months post-V2 release
- When V2 stabilizes, migrate — the high-level McpServer API is expected to remain similar

## References

- npm: https://www.npmjs.com/package/@modelcontextprotocol/sdk
- GitHub: https://github.com/modelcontextprotocol/typescript-sdk
- Protocol docs: https://modelcontextprotocol.io/docs/sdk
- API reference: https://markaicode.com/mcp-typescript-sdk-api-reference/
- V2 docs: https://ts.sdk.modelcontextprotocol.io/v2/
- Tutorial: https://dev.to/1xapi/how-to-build-mcp-servers-in-nodejs-for-ai-agents-2026-guide-fdi

# coaiajs

**CoAIA unified TypeScript package** — a library, a CLI (`coaia`), and an MCP server (`coaiajs-mcp`) consolidating `coaia-narrative`, `coaia-pde`, `coaia-planning`, and `coaiapy` into one installable package.

```bash
npm install coaiajs
```

```typescript
import { tash, fetch, narrative, planning } from 'coaiajs';
import { parsePlan } from 'coaiajs/planning';
import type { StructuralTensionPlan, Entity } from 'coaiajs';
```

- **Node.js** >= 20.0.0 · **ESM only** (`"type": "module"`) · **MIT**
- Ships compiled JavaScript **and** TypeScript declarations for every entry point.

---

## What is this?

`coaiajs` is the TypeScript consolidation of the CoAIA (Creative Orientation AI Architecture) ecosystem. It unifies four previously separate projects behind one type system:

| Origin Project | What it did | Where it lives now |
|---|---|---|
| `coaia-narrative` | JSONL knowledge graph, structural tension charts, narrative beats | `src/narrative/` |
| `coaia-pde` | Prompt Decomposition Engine | `src/pde/` |
| `coaia-planning` | Action planning, structural tension chart management | `src/planning/` |
| `coaiapy` | Redis, LLM, audio, GitHub, config, environment | `src/` (core modules) |

The shared type system in `src/types.ts` is the union of all four.

It can be consumed three ways — as a **library** you import, a **CLI** you run, or an **MCP server** an AI client connects to. All three share the same underlying modules.

---

## 1. Library

### Entry points

Import from the root, or from a subpath to pull in only what you need. Every entry point carries its own `.d.ts`.

| Import path | Exports |
|---|---|
| `coaiajs` | Everything below, plus `langfuse` / `narrative` / `pde` / `planning` / `pipeline` namespaces and all shared types |
| `coaiajs/config` | `readConfig`, `getConfig`, `resetConfig`, `config`, `mergeConfigs`, `findExistingConfig`, `findEnvFiles` |
| `coaiajs/redis` | `tash`, `fetch`, `del`, `keys`, `exists`, `disconnect`, `getClient`, `resetClient` |
| `coaiajs/llm` | `llm`, `transcribeAudio`, `generateImage`, `abstractProcess`, `resetClient` |
| `coaiajs/audio` | `synthesize`, `resetClient` |
| `coaiajs/github` | `listIssues`, `getIssue`, `getIssueComments`, `resetClient` |
| `coaiajs/environment` | `EnvironmentManager`, `createEnvironment`, `findEnvironment` |
| `coaiajs/version` | `getPackageVersion` |
| `coaiajs/langfuse` | `LangfuseClient`, `LangfuseApiError`, traces/observations/prompts/datasets/scores/comments/media operations and formatters (52 exports) |
| `coaiajs/narrative` | `KnowledgeGraphManager`, chart operations, markdown export, tool definitions (29 exports) |
| `coaiajs/pde` | `SessionManager`, `StcMapper`, `handlePdeTool`, `PDE_MCP_TOOLS` (10 exports) |
| `coaiajs/planning` | `parsePlan`, `planToSTC`, `syncToChart`, `syncToPlan`, `handlePlanningTool` (10 exports) |
| `coaiajs/pipeline` | `MobileTemplateEngine`, `TemplateLoader`, `TemplateRenderer` |

Root-namespace access is equivalent to the subpath:

```typescript
import { narrative } from 'coaiajs';
import * as narrative from 'coaiajs/narrative';   // same module
```

### Examples

**Redis key/value (coaiapy `tash`/`fetch` semantics)**

```typescript
import { tash, fetch, disconnect } from 'coaiajs/redis';

await tash('session:42', JSON.stringify({ phase: 'design' }));
const raw = await fetch('session:42');
await disconnect();                 // clients are lazy; close when done
```

**Parse a plan into a structural tension chart**

```typescript
import { parsePlan, planToSTC } from 'coaiajs/planning';

const plan = await parsePlan('./PLAN.md');
const chart = planToSTC(plan);
```

**Knowledge graph**

```typescript
import { KnowledgeGraphManager } from 'coaiajs/narrative';

const kg = new KnowledgeGraphManager('./memory.jsonl');
const graph = await kg.readGraph();
```

### Client lifecycle

Redis, OpenAI, Polly, and Octokit clients are created **lazily on first use** — importing a module never opens a connection or reads a file. Each module exports `resetClient()` so tests can drop cached state:

```typescript
import { resetRedisClient, resetLlmClient } from 'coaiajs';
```

---

## 2. CLI

```bash
npx coaia <command>          # or: npm i -g coaiajs && coaia <command>
```

**Global options:** `--env <path>` · `-M, --memory-path <path>` · `--json` · `--no-color` · `-V, --version`

| Command | Purpose |
|---|---|
| `tash` (`m`) | Store a key-value pair in Redis |
| `fetch` | Get a value from Redis |
| `llm` | Make a raw LLM call |
| `summarize` (`s`) | Summarize text |
| `transcribe` (`t`) | Transcribe audio via Whisper |
| `p <tag> [text]` | Process text with a custom tag |
| `init` | Create a sample `coaia.json` |
| `fuse` | Langfuse operations — `traces`, `prompts`, `datasets`, `scores`, `score-configs`, `sessions`, `comments`, `media`, `projects`, `dataset-items` |
| `narrative` (`n`) | Chart operations — `list`, `view`, `current`, `update`, `add-action`, `add-obs`, `complete`, `export`, `export-all`, `stats`, `progress`, `mmot`, `set-date` |
| `pde` | `import`, `list`, `sessions`, `show` |
| `plan` | `parse`, `convert`, `sync-to-chart`, `sync-to-plan` |
| `pipeline` | `list`, `show`, `create`, `init` |
| `env` | `init`, `list`, `source`, `set`, `get`, `unset`, `clear`, `save` |
| `gh` | `issues` |

`coaia tash` follows coaiapy semantics: `-F/--file` reads the value from a file, `-T/--ttl` is in **minutes**, default TTL `5555`.

---

## 3. MCP Server

```bash
npx coaiajs-mcp
```

Serves **63 tools, 3 prompts, and 1 listable resource** over stdio.

| Group | Count | Examples |
|---|---|---|
| coaiapy + Langfuse | 20 | `coaia_tash`, `coaia_fetch`, `coaia_fuse_trace_create`, `coaia_fuse_traces_list` |
| Narrative / knowledge graph | 27 | `create_entities`, `read_graph`, `create_structural_tension_chart`, `perform_mmot_evaluation` |
| PDE | 10 | `import_pde_decomposition`, `create_stc_from_pde`, `complete_session` |
| Planning | 6 | `parse_plan_structural`, `plan_to_stc`, `sync_plan_to_chart`, `pde_to_plan` |

Four PDE tools carry a `pde_` prefix (`pde_add_action_step`, `pde_mark_action_complete`, `pde_update_action_progress`, `pde_update_current_reality`) because their unprefixed names belong to the narrative group.

**Prompts:** `mia_miette_duo`, `create_observability_pipeline`, `analyze_audio_workflow`

**Resources:** `coaia://templates/` is listable; `coaia://templates/{name}` and `coaia://templates/{name}/variables` are readable URI patterns.

### Feature levels

Set `COAIAJS_FEATURES` to control the exposed tool set (default `STANDARD`):

| Level | Effect |
|---|---|
| `MINIMAL` | Core tash/fetch and essential graph tools |
| `STANDARD` | Default — the 63 tools above |
| `OBSERVABILITY` | Same set as `STANDARD` |
| `FULL` | Everything, including media tools |

### Claude Code

A ready-made plugin lives in [`coaiajs-langfuse-claude-plugin/`](./coaiajs-langfuse-claude-plugin/). It registers this server via `npx` rather than vendoring a copy. Or wire it manually:

```json
{
  "mcpServers": {
    "coaia": { "command": "npx", "args": ["-y", "--package=coaiajs", "coaiajs-mcp"] }
  }
}
```

---

## Configuration

Loaded with the following priority (highest wins):

1. **Environment variables**
2. **`.env` files** — explicit `--env`, then `COAIAJS_ENV_PATH`, `COAIAPY_ENV_PATH`, `./.env`, `~/.coaia/.env`
3. **`coaia.json`** — `./coaia.json`, `~/coaia.json`, `~/.coaia/config.json`
4. **Defaults**

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis endpoint and token, preferred over direct Redis URLs |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV REST aliases for Upstash Redis |
| `KV_URL` / `REDIS_URL` | Redis connection URL (`redis://` or `rediss://`) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_SSL` | Traditional Redis configuration |
| `UPSTASH_HOST` / `UPSTASH_PASSWORD` | coaiapy-compatible fallback aliases |
| `OPENAI_API_KEY` | OpenAI API key |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse credentials |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Polly |
| `GITHUB_TOKEN` | GitHub API token |
| `COAIAJS_FEATURES` | MCP feature level (see above) |

```json
{
  "redis": { "url": "redis://localhost:6379" },
  "openai": { "apiKey": "sk-...", "model": "gpt-4o" },
  "langfuse": { "publicKey": "pk-...", "secretKey": "sk-..." },
  "github": { "token": "ghp_..." }
}
```

---

## Architecture

The data model follows the **structural tension** pattern from Robert Fritz's creative process framework:

- **Desired Outcome** — what you want to create
- **Current Reality** — honest assessment of where you are
- **Action Steps** — telescoped sub-charts holding the tension between the two

Each module operates independently but shares the unified type system in `src/types.ts`, which is what lets the CLI and the MCP server expose the same capabilities through different protocols.

```
coaiajs/
├── src/
│   ├── types.ts            # Shared types (union of all four origin projects)
│   ├── index.ts            # Public library entry point
│   ├── config.ts           # Configuration resolution
│   ├── redis.ts            # Redis tash/fetch
│   ├── environment.ts      # Environment variable management
│   ├── llm.ts              # OpenAI wrapper
│   ├── audio.ts            # AWS Polly text-to-speech
│   ├── github.ts           # GitHub API wrapper
│   ├── version.ts          # Runtime version resolution
│   ├── cli.ts              # CLI entry point
│   ├── langfuse/           # Langfuse observability
│   ├── narrative/          # Knowledge graph, charts, beats
│   ├── pde/                # Prompt Decomposition Engine
│   ├── planning/           # Action planning
│   └── pipeline/           # Pipeline template engine
├── mcp/                    # MCP server and tool definitions
├── test/                   # Tests (node:test)
├── rispecs/                # RISE specification files
└── coaiajs-langfuse-claude-plugin/   # Claude Code plugin
```

---

## Development

```bash
npm install
npm run build      # tsc
npm run lint       # tsc --noEmit
npm test           # node --test
npm run dev        # tsc --watch
```

**Conventions:** ESM only, all relative imports end in `.js` · `strict: true`, no unjustified `any` · all shared types in `src/types.ts` · no side effects at import time.

---

## For AI agents

[`llms.txt`](./llms.txt) is a compact orientation file; [`llms-full.txt`](./llms-full.txt) documents the complete API surface, every MCP tool, and the CLI in one pass.

## License

MIT

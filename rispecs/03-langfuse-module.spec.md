# 03 — Langfuse Module

> Full Langfuse observability integration via REST API.

## Desired Outcome

A comprehensive Langfuse client covering traces, observations, prompts, datasets, scores, score configs, comments, media, and projects — enabling full observability of CoAiA agent sessions through a clean TypeScript API.

## Structural Tension

**Current Reality:**
- [`src/langfuse/`](../src/langfuse/) is implemented as a REST client module split by domain:
  - [`client.ts`](../src/langfuse/client.ts) centralizes auth, base URL, JSON requests, and errors.
  - [`traces.ts`](../src/langfuse/traces.ts), [`observations.ts`](../src/langfuse/observations.ts), [`prompts.ts`](../src/langfuse/prompts.ts), [`datasets.ts`](../src/langfuse/datasets.ts), [`scores.ts`](../src/langfuse/scores.ts), [`comments.ts`](../src/langfuse/comments.ts), and [`media.ts`](../src/langfuse/media.ts) port the coaiapy `cofuse.py` surface.
  - [`index.ts`](../src/langfuse/index.ts) exposes a public barrel for `coaiajs/langfuse`.
- [`mcp/server.ts`](../mcp/server.ts) wires coaiapy-compatible Langfuse MCP tools such as `coaia_fuse_trace_create`, `coaia_fuse_add_observation`, `coaia_fuse_score_apply`, comments, prompts, datasets, and media.
- Langfuse v4 migration is implemented: trace writes use the scoped JS SDK v5 and `POST /api/public/otel/v1/traces`; trace, observation, and session reads use Observations API v2; score reads use Scores API v3.
- V4 observations are immutable: root input/output must be complete before export, sessions are reconstructed by `sessionId`, and the legacy patch-output MCP/CLI operation is removed.
- The broad Custom GPT action spec at [`agents/custom_gpt/ceremony.yml`](../agents/custom_gpt/ceremony.yml) remains OpenAPI 3.1.0 and uses the supported v4 endpoints.
- The focused [`agents/custom_gpt/ceremony-observations.yml`](../agents/custom_gpt/ceremony-observations.yml) spec provides 23 GPT Actions for root-trace creation, nested observation append through OTLP/HTTP JSON, observations-first reads, and the ceremony's core prompt, dataset, score, comment, media, and project operations. Its companion instructions document Basic authorization, v4 ingestion headers, immutable-span rules, parent context, and the exact-byte media workflow using padded Base64 SHA-256 digests and a separate presigned PUT.
- Types defined in [`src/types.ts`](../src/types.ts): `ScoreCategory`, `ScoreConfig`.
- Remaining gap: not every Langfuse formatting and cache helper from `cofuse.py` has a TypeScript equivalent; the core trace/observation/prompt/dataset/score/comment/media path is present.

**Desired Outcome:**
TypeScript Langfuse client with:
- All REST endpoints from cofuse.py ported to `fetch`-based client
- Lazy client initialization (no connection until first call)
- Type-safe request/response with Zod validation
- 8 MCP tools for interactive Langfuse operations
- Support for both self-hosted and cloud Langfuse instances

## API Surface

### Traces
```typescript
listTraces(params?: { page?, limit?, userId?, name?, tags? }): Promise<Trace[]>
getTrace(traceId: string): Promise<Trace>
createTrace(input: CreateTraceInput): Promise<Trace>
```

### Observations
```typescript
listObservations(params?: { traceId?, type?, name? }): Promise<Observation[]>
getObservation(observationId: string): Promise<Observation>
```

### Prompts
```typescript
listPrompts(params?: { name?, label? }): Promise<Prompt[]>
getPrompt(name: string, version?: number): Promise<Prompt>
createPrompt(input: CreatePromptInput): Promise<Prompt>
```

### Datasets
```typescript
listDatasets(): Promise<Dataset[]>
getDataset(name: string): Promise<Dataset>
createDataset(input: CreateDatasetInput): Promise<Dataset>
listDatasetItems(datasetName: string): Promise<DatasetItem[]>
createDatasetItem(input: CreateDatasetItemInput): Promise<DatasetItem>
listDatasetRuns(datasetName: string): Promise<DatasetRun[]>
```

### Scores
```typescript
listScores(params?: { traceId?, name?, configId? }): Promise<Score[]>
createScore(input: CreateScoreInput): Promise<Score>
listScoreConfigs(): Promise<ScoreConfig[]>
createScoreConfig(input: CreateScoreConfigInput): Promise<ScoreConfig>
```

### Comments
```typescript
listComments(params?: { traceId?, objectType? }): Promise<Comment[]>
createComment(input: CreateCommentInput): Promise<Comment>
```

### Media & Projects
```typescript
getMedia(mediaId: string): Promise<Media>
listProjects(): Promise<Project[]>
```

## MCP Tools (8)

| Tool | Description |
|------|-------------|
| `langfuse_list_traces` | List traces with filters |
| `langfuse_get_trace` | Get trace details with observations |
| `langfuse_list_prompts` | List prompt templates |
| `langfuse_get_prompt` | Get specific prompt by name/version |
| `langfuse_list_datasets` | List available datasets |
| `langfuse_list_scores` | List scores with filters |
| `langfuse_create_score` | Score a trace or observation |
| `langfuse_list_score_configs` | List scoring configurations |

## Authentication

Langfuse REST API uses Basic auth: `base64(publicKey:secretKey)`. Config provides `langfuse_public_key`, `langfuse_secret_key`, and `langfuse_host` (default: `https://cloud.langfuse.com`).

## Quality Criteria

- ✅ Every endpoint in cofuse.py has a TypeScript equivalent
- ✅ Pagination handled transparently (auto-page through results when needed)
- ✅ Auth failure returns clear error, not cryptic 401
- ✅ Missing credentials detected at call time, not import time
- ✅ No trace/observation writes use the sunset legacy ingestion API
- ✅ No trace, observation, session, or score reads use deprecated v1/v2 endpoints
- ✅ Response types validated with Zod before returning

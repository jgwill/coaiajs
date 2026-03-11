# 03 — Langfuse Module

> Full Langfuse observability integration via REST API.

## Desired Outcome

A comprehensive Langfuse client covering traces, observations, prompts, datasets, scores, score configs, comments, media, and projects — enabling full observability of CoAiA agent sessions through a clean TypeScript API.

## Structural Tension

**Current Reality:**
- `src/langfuse/` directory exists but is empty
- Types defined in `src/types.ts`: `ScoreCategory`, `ScoreConfig`
- coaiapy's `cofuse.py` is 4,480 lines covering: traces, observations (spans/generations/events), prompts, datasets, scores, score configs, comments, media, projects
- cofuse.py uses raw `requests` library against Langfuse REST API
- No MCP tools exist for Langfuse in any parent project

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
- ✅ Response types validated with Zod before returning

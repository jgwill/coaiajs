# Langfuse JS SDK vs REST API: Technical Assessment for CoAiA.js

> Package selection brief — LLM observability, tracing, and prompt management for CoAiA agent sessions

## Summary & Recommendation

**Use `langfuse` v4.x SDK** (`@langfuse/core` + `@langfuse/tracing`). The v4 rewrite (August 2025) brings OpenTelemetry-native tracing, modular packages, and direct integration with OpenAI — eliminating coaiapy's manual HTTP request overhead. The SDK handles batching, retries, and serialization that our REST wrapper currently does manually in `cofuse.py`.

**Pin:** `"langfuse": "^4.0.0"` (pulls `@langfuse/core`, `@langfuse/tracing`)

## What We're Replacing

Coaiapy uses raw HTTP requests to the Langfuse REST API via Python `requests`:

```python
# coaiapy/cofuse.py — manual HTTP approach
import requests
from requests.auth import HTTPBasicAuth

def create_session_and_save():
    # Manual JSON construction, auth header assembly, error handling
    response = requests.post(f"{base_url}/api/public/traces", 
                            json=payload, 
                            auth=HTTPBasicAuth(public_key, secret_key))

def add_trace_node_and_save():
    # More manual HTTP calls...

def list_traces():
    response = requests.get(f"{base_url}/api/public/traces", ...)
```

This pattern requires ~200 lines of boilerplate for authentication, serialization, error handling, and retry logic that the SDK provides out of the box.

## Options Compared

| Feature | Langfuse JS SDK v4 | REST API (manual) |
|---------|-------------------|-------------------|
| Setup complexity | `new Langfuse({ publicKey, secretKey })` | Manual auth headers, URL construction |
| Trace creation | `langfuse.trace({ name, metadata })` | `POST /api/public/traces` + JSON body |
| Span nesting | `trace.span({ name })` → `span.generation()` | Manual parent-child ID tracking |
| OpenAI integration | `@langfuse/openai` drop-in wrapper | Manual extraction of token counts |
| Batch flush | Automatic with configurable intervals | Manual batching implementation |
| Retry logic | Built-in exponential backoff | Manual retry loops |
| OpenTelemetry | Native OTEL span processor | Not available |
| Type safety | Full TypeScript types | Manual interface definitions |
| Prompt management | `langfuse.getPrompt()` | `GET /api/public/prompts` |
| Scoring | `trace.score({ name, value })` | `POST /api/public/scores` + JSON body |
| MCP server integration | Native via hosted MCP | Manual tool definitions |
| Maintenance burden | ~5 lines setup | ~200+ lines of wrapper code |

## API Overview

### SDK Initialization

```typescript
import { Langfuse } from 'langfuse';
import { loadConfig } from '../config.js';

const config = loadConfig();
const langfuse = new Langfuse({
  publicKey: config.langfusePublicKey,
  secretKey: config.langfuseSecretKey,
  baseUrl: config.langfuseBaseUrl ?? 'https://cloud.langfuse.com',
});
```

### Trace Creation (replacing cofuse.py create_session_and_save)

```typescript
// coaiapy equivalent: create_session_and_save()
async function createAgentSession(sessionId: string, metadata: Record<string, unknown>) {
  const trace = langfuse.trace({
    id: sessionId,
    name: `coaia-session-${sessionId}`,
    metadata,
    tags: ['coaiajs', 'agent-session'],
  });

  // Nested spans for pipeline steps
  const span = trace.span({ name: 'pipeline-execution' });
  
  // Generation tracking (replaces add_trace_node_and_save)
  const generation = span.generation({
    name: 'llm-call',
    model: 'gpt-5.4',
    input: messages,
    output: response,
    usage: { promptTokens: 150, completionTokens: 300 },
  });

  generation.end();
  span.end();
  
  return trace;
}
```

### OpenAI Integration (automatic tracing)

```typescript
import { observeOpenAI } from '@langfuse/openai';
import OpenAI from 'openai';

// Wraps OpenAI client for automatic trace capture
const openai = observeOpenAI(new OpenAI(), {
  langfuse,
  generationName: 'coaia-generation',
});

// Every call is automatically traced
const response = await openai.chat.completions.create({
  model: 'gpt-5.4',
  messages: [{ role: 'user', content: 'Analyze this chart...' }],
});
```

### Prompt Management

```typescript
// Fetch versioned prompts from Langfuse
const prompt = await langfuse.getPrompt('pde-decompose-system');
const compiled = prompt.compile({ context: 'structural tension chart' });
```

### Scoring (replacing cofuse.py create_score, apply_score_to_trace)

```typescript
async function scoreTrace(traceId: string, scores: Record<string, number>) {
  for (const [name, value] of Object.entries(scores)) {
    langfuse.score({
      traceId,
      name,
      value,
      comment: `MMOT evaluation: ${name}`,
    });
  }
  await langfuse.flushAsync();
}
```

## Integration Plan

1. **Core module:** `src/langfuse/client.ts` — singleton Langfuse instance from config
2. **Session tracing:** `src/langfuse/session.ts` — trace lifecycle for agent sessions (replaces cofuse.py)
3. **OpenAI wrapper:** `src/langfuse/openai.ts` — `observeOpenAI` integration for automatic tracing
4. **Scoring:** `src/langfuse/scoring.ts` — MMOT evaluation scoring
5. **Prompt management:** `src/langfuse/prompts.ts` — versioned prompt fetching
6. **Pipeline integration:** `src/pipeline/traced-step.ts` — auto-trace pipeline template execution

### When to Fall Back to REST

Keep a thin REST utility for edge cases:
- Langfuse endpoints not yet covered by SDK v4
- Direct database queries for custom dashboards
- Webhook payload verification

```typescript
// Escape hatch for REST-only endpoints
async function langfuseRest(path: string, method = 'GET', body?: object) {
  const config = loadConfig();
  const auth = Buffer.from(`${config.langfusePublicKey}:${config.langfuseSecretKey}`).toString('base64');
  return fetch(`${config.langfuseBaseUrl}/api/public${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | v4.x (rewritten Aug 2025) |
| Packages | `langfuse`, `@langfuse/core`, `@langfuse/tracing`, `@langfuse/openai` |
| Tracing standard | OpenTelemetry native |
| Node.js compat | ≥20 |
| TypeScript | Full native types |
| Bundle | Modular tree-shakeable |
| Integrations | OpenAI, LangChain, Vercel AI SDK |
| MCP | Hosted MCP server for prompt management |
| License | MIT |

## References

- npm: https://www.npmjs.com/package/langfuse
- GitHub: https://github.com/langfuse/langfuse-js
- Docs: https://langfuse.com/docs/sdk/typescript
- Changelog: https://langfuse.com/changelog
- DeepWiki architecture: https://deepwiki.com/langfuse/langfuse-js

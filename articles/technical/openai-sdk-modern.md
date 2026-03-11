# OpenAI Node.js SDK: Technical Assessment for CoAiA.js

> Package selection brief — Unified LLM client for chat completions, streaming, and Whisper transcription replacing coaiapy's raw HTTP calls

## Summary & Recommendation

**Use `openai` v6.x SDK** (currently 6.27.0). The official SDK provides type-safe chat completions with streaming, Whisper audio transcription, and image generation — all features coaiajs needs. The SDK handles authentication, retry logic, rate limiting, and model-specific serialization. Combined with `@langfuse/openai` for automatic tracing, this eliminates all raw HTTP request code.

**Pin:** `"openai": "^6.0.0"`

## What We're Replacing

Coaiapy uses raw HTTP requests for OpenAI API calls, scattered across multiple modules:

```python
# coaiapy pattern — manual HTTP to OpenAI
import requests
import json

def call_openai(messages, model="gpt-4"):
    headers = {
        "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
        "Content-Type": "application/json"
    }
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json={"model": model, "messages": messages}
    )
    return response.json()["choices"][0]["message"]["content"]
```

This pattern: no streaming, no automatic retry, no type safety, no token counting, no multimodal support, and requires manual header management per request.

## Options Compared

| Feature | openai SDK v6 | Raw fetch/requests | LangChain OpenAI |
|---------|--------------|-------------------|------------------|
| Type safety | Full TypeScript types | Manual interfaces | Via LangChain types |
| Streaming | `stream: true` + async iterator | Manual SSE parsing | LangChain callbacks |
| Whisper transcription | `client.audio.transcriptions.create()` | Manual multipart form | Not supported |
| Image generation | `client.images.generate()` | Manual API call | Via LangChain |
| Rate limit handling | Built-in retry with backoff | Manual retry loops | Via LangChain |
| Token counting | Response includes usage | Manual counting | Via callbacks |
| Langfuse integration | `@langfuse/openai` wrapper | Manual trace creation | `CallbackHandler` |
| Realtime API | WebSocket support built-in | Manual WebSocket | N/A |
| Bundle overhead | ~50KB | 0 | ~200KB+ |
| Maintenance | Official, rapid updates | None | LangChain release cycle |

## API Overview

### Client Setup

```typescript
import OpenAI from 'openai';
import { loadConfig } from '../config.js';

const config = loadConfig();
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  // Optional: custom base URL for Azure OpenAI or local models
  baseURL: config.openaiBaseUrl,
});
```

### Chat Completions (Standard)

```typescript
async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  model = 'gpt-5.4'
): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? '';
}

// Usage in coaiajs
const analysis = await chatCompletion([
  { role: 'system', content: 'You are a structural tension chart analyst.' },
  { role: 'user', content: `Analyze this chart: ${JSON.stringify(chart)}` },
]);
```

### Streaming Chat Completions

```typescript
async function* streamChat(
  messages: OpenAI.ChatCompletionMessageParam[],
  model = 'gpt-5.4'
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// Usage in CLI for real-time output
async function streamToTerminal(messages: OpenAI.ChatCompletionMessageParam[]) {
  for await (const chunk of streamChat(messages)) {
    process.stdout.write(chunk);
  }
  process.stdout.write('\n');
}
```

### Whisper Transcription (replacing voice-to-text pipeline)

```typescript
import fs from 'fs';

async function transcribeAudio(filePath: string, language = 'en'): Promise<string> {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language,
    response_format: 'text',
  });
  return response;
}

// Verbose transcription with timestamps
async function transcribeVerbose(filePath: string) {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });
  return response; // includes segments with start/end timestamps
}
```

### Image Generation (for chart visualization)

```typescript
async function generateChartImage(description: string): Promise<string> {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `Structural tension chart visualization: ${description}`,
    n: 1,
    size: '1024x1024',
    response_format: 'url',
  });
  return response.data[0]?.url ?? '';
}
```

### With Langfuse Tracing (automatic observability)

```typescript
import { observeOpenAI } from '@langfuse/openai';
import OpenAI from 'openai';
import { getLangfuse } from '../langfuse/client.js';

// Wrap OpenAI client for automatic trace capture
const tracedOpenai = observeOpenAI(new OpenAI(), {
  langfuse: getLangfuse(),
  generationName: 'coaia-generation',
});

// Every API call is automatically traced in Langfuse
// with model, tokens, latency, cost tracking
const response = await tracedOpenai.chat.completions.create({
  model: 'gpt-5.4',
  messages: [{ role: 'user', content: 'Evaluate this structural tension...' }],
});
```

### Structured Output with Zod

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const ChartAnalysis = z.object({
  tension_score: z.number().min(0).max(10),
  recommendations: z.array(z.string()),
  next_action: z.string(),
});

const response = await openai.beta.chat.completions.parse({
  model: 'gpt-5.4',
  messages: [{ role: 'user', content: `Analyze: ${JSON.stringify(chart)}` }],
  response_format: zodResponseFormat(ChartAnalysis, 'chart_analysis'),
});

const analysis = response.choices[0]?.message?.parsed;
// analysis is fully typed as { tension_score: number; recommendations: string[]; next_action: string }
```

## Integration Plan

1. **Core client:** `src/openai/client.ts` — singleton, config-driven, with Langfuse wrapper
2. **Chat module:** `src/openai/chat.ts` — standard + streaming completions
3. **Audio module:** `src/openai/audio.ts` — Whisper transcription (replaces voice pipeline)
4. **Structured output:** `src/openai/structured.ts` — Zod-validated responses
5. **MCP tool integration:** Tools that call OpenAI for analysis, decomposition, evaluation
6. **Pipeline steps:** `src/pipeline/generation-step.ts` — traced generation within pipelines

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 6.27.0 (March 2026) |
| Weekly downloads | ~15M+ |
| TypeScript | Full native types |
| Node.js compat | ≥20 LTS |
| Runtime support | Node.js, Deno, Bun, edge |
| Streaming | SSE async iterator |
| Structured output | Zod helper built-in |
| Models supported | GPT-5.x, GPT-4.x, Whisper, DALL-E, Realtime |
| Langfuse integration | `@langfuse/openai` drop-in wrapper |
| License | Apache-2.0 |

## References

- npm: https://www.npmjs.com/package/openai
- GitHub: https://github.com/openai/openai-node
- API docs: https://developers.openai.com/api/docs/libraries/
- DeepWiki: https://deepwiki.com/openai/openai-node
- Releases: https://github.com/openai/openai-node/releases

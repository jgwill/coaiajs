# 01 — Core Config

> Configuration management system for all CoAiA modules.

## Desired Outcome

A unified config loader that provides every CoAiA module with its settings through a single `getConfig()` call, merging environment variables, `.env` files, and `coaia.json` with deterministic priority.

## Structural Tension

**Current Reality:**
- [`src/config.ts`](../src/config.ts) is implemented with `readConfig()`, `getConfig()`, `mergeConfigs()`, `resetConfig()`, and a `config` Proxy for lazy access
- Supports env vars > .env > coaia.json > defaults priority chain
- Searches for `coaia.json` or `.coaia/config.json` in cwd and home directory
- Covers Redis (URL, host/port, Upstash), Langfuse, OpenAI, AWS, GitHub credentials
- Singleton pattern with lazy loading and proxy access
- Deep merge implementation for nested config objects

**Desired Outcome:**
Config system that handles all module configuration needs including:
- Everything currently implemented
- Langfuse extended config (dataset settings, prompt cache TTL)
- Pipeline template directory paths
- MCP server mode selection (MINIMAL/STANDARD/FULL)
- Narrative memory file path
- PDE working directory
- Plan sync settings

## CoaiaConfig Shape

```typescript
interface CoaiaConfig {
  redis?: { url?: string; host?: string; port?: number; password?: string; upstashUrl?: string; upstashToken?: string };
  langfuse?: { publicKey?: string; secretKey?: string; baseUrl?: string };
  openai?: { apiKey?: string; model?: string };
  aws?: { accessKeyId?: string; secretAccessKey?: string; region?: string };
  github?: { token?: string };
  [key: string]: unknown;
}
```

## Config Resolution

```
1. process.env       — highest priority, always wins
2. .env file         — loaded via dotenv from cwd
3. coaia.json        — searched in cwd, then ~/.coaia/config.json
4. defaults          — hardcoded fallbacks (redis_host: 'localhost', redis_port: 6379, etc.)
```

Deep merge: nested objects are merged recursively. Arrays are replaced, not concatenated. `undefined` values do not overwrite existing values.

## Quality Criteria

- ✅ `getConfig()` returns identical results to coaiapy's `read_config()` for the same env/file state
- ✅ Config is loaded once and cached; `resetConfig()` clears the cache for testing
- ✅ `config` proxy provides `config.redis_url` shorthand without explicit `getConfig()` call
- ✅ Missing config keys return `undefined`, never throw
- ✅ Deep merge handles nested structures correctly

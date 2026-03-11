# 01 — Core Config

> Configuration management system for all CoAiA modules.

## Desired Outcome

A unified config loader that provides every CoAiA module with its settings through a single `getConfig()` call, merging environment variables, `.env` files, and `coaia.json` with deterministic priority.

## Structural Tension

**Current Reality:**
- `src/config.ts` is fully implemented (172 lines) with `readConfig()`, `getConfig()`, `mergeConfigs()`, `resetConfig()`, and a `config` Proxy for lazy access
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
  // Redis
  redis_url?: string;
  redis_host?: string;
  redis_port?: number;

  // Langfuse
  langfuse_secret_key?: string;
  langfuse_public_key?: string;
  langfuse_host?: string;
  langfuse_dataset_name?: string;
  langfuse_prompt_cache_ttl?: number;

  // OpenAI
  openai_api_key?: string;
  openai_model?: string;

  // AWS (Polly)
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  aws_polly_voice?: string;

  // GitHub
  github_token?: string;

  // Narrative
  memory_file_path?: string;

  // PDE
  pde_dir?: string;

  // Pipeline
  pipeline_template_dir?: string;

  // MCP
  mcp_mode?: 'MINIMAL' | 'STANDARD' | 'FULL';
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

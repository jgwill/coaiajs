# Config Management in Node.js: Technical Assessment for CoAiA.js

> Package selection brief — Configuration cascade replacing coaiapy's multi-file config (env vars > .env > coaia.json > defaults)

## Summary & Recommendation

**Use `dotenv` v16.x + `cosmiconfig` v9.x + `zod` for validation.** This triple replaces coaiapy's hand-rolled config cascade with a standard, validated pattern:
- `dotenv` loads `.env` files (matching coaiapy's `.coaia-env`)
- `cosmiconfig` discovers `coaia.json`, `coaia.yaml`, `.coaiarc`, or `coaia.config.js` (matching coaiapy's multi-format loading)
- `zod` validates the merged config at startup (what coaiapy lacks entirely)

**Pin:**
```json
"dotenv": "^16.4.0",
"cosmiconfig": "^9.0.0",
"zod": "^4.0.0"
```

## What We're Replacing

Coaiapy has a complex config cascade across multiple modules:

### environment.py (EnvironmentManager)
```python
@dataclass
class EnvironmentConfig:
    project_env_file: str = ".coaia-env"
    global_env_file: str = "~/.coaia/global.env"
    supported_formats: List[str] = ["json", "env"]

class EnvironmentManager:
    def _read_env_file(self, file_path: Path) -> Dict[str, Any]:
        if content.startswith('{'):
            return json.loads(content)
        # Parse KEY=value format
```

### coaiamodule.py (read_config)
```python
def read_config():
    # Priority: env vars > .env > coaia.json > defaults
    # Searches: cwd, parent dirs, ~/.coaia/
    # Supports: JSON, .env, shell env vars
```

### coaia-narrative CLI (minimist + dotenv)
```typescript
// Priority order:
// 1. Command-line flags (--memory-path, -M)
// 2. Custom env file (--env)
// 3. .env in cwd
// 4. _env.sh (fallback)
// 5. Environment variables
// 6. Defaults
```

The Python approach has no validation — missing keys fail at runtime deep in execution. The TypeScript approach in coaia-narrative works but is ad-hoc per module.

## Options Compared

| Feature | dotenv + cosmiconfig + zod | dotenv only | convict | nconf | node-config |
|---------|--------------------------|-------------|---------|-------|-------------|
| .env loading | ✅ dotenv | ✅ | ⚠️ Manual | ✅ | ❌ |
| Multi-format (JSON/YAML/JS) | ✅ cosmiconfig | ❌ | ✅ JSON | ✅ | ✅ |
| Parent dir search | ✅ cosmiconfig | ❌ | ❌ | ❌ | ❌ |
| Schema validation | ✅ zod | ❌ | ✅ convict | ❌ | ❌ |
| Type inference | ✅ zod infer | ❌ | ⚠️ Manual | ❌ | ❌ |
| Variable expansion | ✅ dotenv-expand | ✅ dotenv-expand | ❌ | ❌ | ❌ |
| Env override | ✅ process.env priority | ✅ | ✅ | ✅ | ✅ |
| Weekly downloads | ~93M + ~30M + ~100M | ~93M | ~900K | ~900K | ~1.5M |
| Bundle overhead | Minimal | Tiny | Medium | Medium | Medium |
| TypeScript | All have types | ✅ | ⚠️ | ⚠️ | ⚠️ |

## API Overview

### Config Schema (Zod)

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const CoaiaConfigSchema = z.object({
  // Redis
  redisUrl: z.string().url().default('redis://localhost:6379'),
  
  // Langfuse
  langfusePublicKey: z.string().optional(),
  langfuseSecretKey: z.string().optional(),
  langfuseBaseUrl: z.string().url().default('https://cloud.langfuse.com'),
  
  // OpenAI
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().url().optional(),
  openaiModel: z.string().default('gpt-5.4'),
  
  // AWS Polly
  awsRegion: z.string().default('us-east-1'),
  pollyKey: z.string().optional(),
  pollySecret: z.string().optional(),
  
  // GitHub
  githubToken: z.string().optional(),
  
  // Paths
  memoryPath: z.string().default('.coaia/memory.jsonl'),
  plansDir: z.string().default('.coaia/plans'),
  outputDir: z.string().default('.coaia/output'),
  templateDir: z.string().default('.coaia/templates'),
  
  // Behavior
  jsonOutput: z.boolean().default(false),
  noColor: z.boolean().default(false),
  verbose: z.boolean().default(false),
});

export type CoaiaConfig = z.infer<typeof CoaiaConfigSchema>;
```

### Config Loader (cosmiconfig + dotenv)

```typescript
// src/config/loader.ts
import { cosmiconfig } from 'cosmiconfig';
import dotenv from 'dotenv';
import { CoaiaConfigSchema, type CoaiaConfig } from './schema.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

// cosmiconfig explorer — searches for config files
const explorer = cosmiconfig('coaia', {
  searchPlaces: [
    'coaia.config.js',
    'coaia.config.ts',
    'coaia.json',
    'coaia.yaml',
    'coaia.yml',
    '.coaiarc',
    '.coaiarc.json',
    '.coaiarc.yaml',
    'package.json',  // "coaia" key in package.json
  ],
});

let _config: CoaiaConfig | null = null;

export async function loadConfig(overrides?: Partial<CoaiaConfig>): Promise<CoaiaConfig> {
  if (_config && !overrides) return _config;

  // Step 1: Load .env files (matches coaiapy's .coaia-env pattern)
  const envFiles = [
    '.env',
    '.coaia-env',
    resolve(process.env.HOME ?? '', '.coaia', 'global.env'),
  ];
  
  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      dotenv.config({ path: envFile });
    }
  }

  // Step 2: Load config file via cosmiconfig (searches parent dirs)
  const result = await explorer.search();
  const fileConfig = result?.config ?? {};

  // Step 3: Merge sources (priority: CLI overrides > env vars > config file > defaults)
  const merged = {
    ...fileConfig,
    // Env var overrides (matching coaiapy's env var names)
    ...(process.env.REDIS_URL && { redisUrl: process.env.REDIS_URL }),
    ...(process.env.UPSTASH_REDIS_URL && { redisUrl: process.env.UPSTASH_REDIS_URL }),
    ...(process.env.LANGFUSE_PUBLIC_KEY && { langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY }),
    ...(process.env.LANGFUSE_SECRET_KEY && { langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY }),
    ...(process.env.LANGFUSE_BASE_URL && { langfuseBaseUrl: process.env.LANGFUSE_BASE_URL }),
    ...(process.env.OPENAI_API_KEY && { openaiApiKey: process.env.OPENAI_API_KEY }),
    ...(process.env.OPENAI_BASE_URL && { openaiBaseUrl: process.env.OPENAI_BASE_URL }),
    ...(process.env.AWS_REGION && { awsRegion: process.env.AWS_REGION }),
    ...(process.env.GH_TOKEN && { githubToken: process.env.GH_TOKEN }),
    ...(process.env.GITHUB_TOKEN && { githubToken: process.env.GITHUB_TOKEN }),
    ...(process.env.COAIA_MEMORY_PATH && { memoryPath: process.env.COAIA_MEMORY_PATH }),
    ...(process.env.COAIA_PLANS_DIR && { plansDir: process.env.COAIA_PLANS_DIR }),
    ...(process.env.COAIA_OUTPUT_DIR && { outputDir: process.env.COAIA_OUTPUT_DIR }),
    // CLI overrides (highest priority)
    ...overrides,
  };

  // Step 4: Validate with Zod
  _config = CoaiaConfigSchema.parse(merged);
  return _config;
}

// Synchronous getter after initial load
export function getConfig(): CoaiaConfig {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}
```

### CLI Integration with Commander

```typescript
// src/cli.ts — CLI flags feed into config overrides
import { Command } from 'commander';
import { loadConfig } from './config/loader.js';

const program = new Command()
  .option('-M, --memory-path <path>', 'Memory file path')
  .option('--env <file>', 'Custom env file path')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Verbose logging');

program.hook('preAction', async (thisCommand) => {
  const opts = thisCommand.opts();
  
  // Load custom env file if specified
  if (opts.env) {
    dotenv.config({ path: opts.env });
  }
  
  // Initialize config with CLI overrides
  await loadConfig({
    ...(opts.memoryPath && { memoryPath: opts.memoryPath }),
    ...(opts.json && { jsonOutput: true }),
    ...(opts.color === false && { noColor: true }),
    ...(opts.verbose && { verbose: true }),
  });
});
```

### Variable Expansion (dotenv-expand)

```typescript
// For .env files that reference other variables
// .env:
// BASE_DIR=/opt/coaia
// MEMORY_PATH=${BASE_DIR}/memory.jsonl
// PLANS_DIR=${BASE_DIR}/plans

import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';

const env = dotenv.config({ path: '.env' });
expand(env);  // Resolves ${BASE_DIR} references
```

### Config File Examples

```yaml
# coaia.yaml — project-level config
redis:
  url: redis://localhost:6379

langfuse:
  publicKey: pk-lf-xxx
  secretKey: sk-lf-xxx
  baseUrl: https://cloud.langfuse.com

openai:
  apiKey: sk-xxx
  model: gpt-5.4

paths:
  memory: .coaia/memory.jsonl
  plans: .coaia/plans
  templates: .coaia/templates
```

```json
// coaia.json — alternative JSON format
{
  "redisUrl": "redis://localhost:6379",
  "langfusePublicKey": "pk-lf-xxx",
  "openaiModel": "gpt-5.4",
  "memoryPath": ".coaia/memory.jsonl"
}
```

```ini
# .coaia-env — environment variable format (coaiapy compatible)
REDIS_URL=redis://localhost:6379
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
OPENAI_API_KEY=sk-xxx
GH_TOKEN=ghp_xxx
AWS_REGION=us-east-1
COAIA_MEMORY_PATH=.coaia/memory.jsonl
```

### Validation Error Messages

```typescript
// On startup with invalid config:
try {
  await loadConfig();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration errors:');
    error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Output:
// Configuration errors:
//   redisUrl: Invalid url
//   langfuseBaseUrl: Invalid url
```

## Integration Plan

1. **Schema:** `src/config/schema.ts` — Zod schema for all config values
2. **Loader:** `src/config/loader.ts` — dotenv + cosmiconfig + Zod validation
3. **Export:** `src/config/index.ts` — `loadConfig()` and `getConfig()`
4. **CLI hook:** Commander `preAction` hook loads config with CLI overrides
5. **Testing:** Config loader is mockable via overrides parameter
6. **Migration:** Support both `coaia.json` and `.coaia-env` formats (backward compat)

### Config Priority (matches coaiapy's cascade)

```
1. CLI flags              (--memory-path, --json)     ← Highest
2. Environment variables  (REDIS_URL, GH_TOKEN)
3. .env / .coaia-env      (project root)
4. ~/.coaia/global.env    (global user config)
5. coaia.json / coaia.yaml (cosmiconfig search)
6. Zod defaults           (schema defaults)            ← Lowest
```

## Version & Ecosystem

| Package | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| dotenv | 16.4.x | ~93M | .env file loading |
| dotenv-expand | 12.0.x | ~30M | Variable expansion in .env |
| cosmiconfig | 9.0.x | ~30M | Multi-format config discovery |
| zod | 4.3.x | ~100M+ | Schema validation + type inference |

All packages: MIT licensed, zero or minimal dependencies, TypeScript supported.

## Why Not Convict?

Convict (from Mozilla) offers built-in schema validation, but:
1. ~900K downloads vs dotenv's ~93M — smaller ecosystem
2. Doesn't support YAML config files natively
3. Doesn't search parent directories (cosmiconfig does)
4. We already have Zod for validation (no need for convict's schema DSL)
5. Convict's API is less TypeScript-friendly than Zod's type inference

## References

- dotenv npm: https://www.npmjs.com/package/dotenv
- cosmiconfig npm: https://www.npmjs.com/package/cosmiconfig
- cosmiconfig GitHub: https://github.com/cosmiconfig/cosmiconfig
- dotenv security: https://www.johal.in/secrets-dotenv-secure-config-management-in-production-2026/
- Config comparison: https://npm-compare.com/config,convict,dotenv,nconf
- dotenv usage: https://oneuptime.com/blog/post/2026-01-25-dotenv-configuration-nodejs/view

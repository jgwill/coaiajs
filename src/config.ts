// coaiajs/src/config.ts — Config management
// Priority: env vars > .env > coaia.json > defaults

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';
import type { CoaiaConfig } from './types.js';

const CONFIG_FILENAMES = ['coaia.json', '.coaia/config.json'];

/** Search for an existing coaia.json config file. */
export function findExistingConfig(): string | null {
  const searchDirs = [process.cwd(), homedir()];

  for (const dir of searchDirs) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** Deep-merge two config objects; override wins on conflicts. */
export function mergeConfigs(
  base: Partial<CoaiaConfig>,
  override: Partial<CoaiaConfig>,
): CoaiaConfig {
  const result: Record<string, unknown> = { ...base };

  for (const [key, val] of Object.entries(override)) {
    if (
      val !== null &&
      val !== undefined &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeConfigs(
        result[key] as Partial<CoaiaConfig>,
        val as Partial<CoaiaConfig>,
      );
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as CoaiaConfig;
}

function loadJsonConfig(filePath: string): Partial<CoaiaConfig> {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Partial<CoaiaConfig>;
  } catch {
    return {};
  }
}

function envOverrides(): Partial<CoaiaConfig> {
  const cfg: Partial<CoaiaConfig> = {};
  const env = process.env;

  // Redis
  if (env['REDIS_URL'] || env['REDIS_HOST'] || env['UPSTASH_REDIS_REST_URL']) {
    cfg.redis = {
      url: env['REDIS_URL'],
      host: env['REDIS_HOST'],
      port: env['REDIS_PORT'] ? parseInt(env['REDIS_PORT'], 10) : undefined,
      password: env['REDIS_PASSWORD'],
      upstashUrl: env['UPSTASH_REDIS_REST_URL'],
      upstashToken: env['UPSTASH_REDIS_REST_TOKEN'],
    };
  }

  // Langfuse
  if (env['LANGFUSE_PUBLIC_KEY'] || env['LANGFUSE_SECRET_KEY']) {
    cfg.langfuse = {
      publicKey: env['LANGFUSE_PUBLIC_KEY'],
      secretKey: env['LANGFUSE_SECRET_KEY'],
      baseUrl: env['LANGFUSE_BASE_URL'] ?? env['LANGFUSE_HOST'],
    };
  }

  // OpenAI
  if (env['OPENAI_API_KEY']) {
    cfg.openai = {
      apiKey: env['OPENAI_API_KEY'],
      model: env['OPENAI_MODEL'] ?? env['LLM_MODEL'],
    };
  }

  // AWS
  if (env['AWS_ACCESS_KEY_ID']) {
    cfg.aws = {
      accessKeyId: env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: env['AWS_SECRET_ACCESS_KEY'],
      region: env['AWS_REGION'] ?? env['AWS_DEFAULT_REGION'],
    };
  }

  // GitHub
  if (env['GITHUB_TOKEN'] || env['GH_TOKEN']) {
    cfg.github = {
      token: env['GITHUB_TOKEN'] ?? env['GH_TOKEN'],
    };
  }

  return cfg;
}

/**
 * Read and assemble the full CoaiaConfig.
 * Priority: env vars > .env file > coaia.json > defaults.
 */
export function readConfig(envPath?: string): CoaiaConfig {
  // 1. Load .env (lowest priority file source)
  const dotenvPath = envPath ?? resolve(process.cwd(), '.env');
  if (existsSync(dotenvPath)) {
    dotenv.config({ path: dotenvPath });
  } else {
    dotenv.config(); // default search
  }

  // 2. Load coaia.json
  const configPath = findExistingConfig();
  const jsonConfig = configPath ? loadJsonConfig(configPath) : {};

  // 3. Env var overrides (highest priority)
  const envCfg = envOverrides();

  // 4. Merge: json < env
  return mergeConfigs(jsonConfig, envCfg);
}

/** Singleton config instance, lazily loaded on first access. */
let _config: CoaiaConfig | null = null;

export function getConfig(): CoaiaConfig {
  if (!_config) {
    _config = readConfig();
  }
  return _config;
}

/** Reset singleton (useful in tests). */
export function resetConfig(): void {
  _config = null;
}

export const config = new Proxy({} as CoaiaConfig, {
  get(_target, prop: string) {
    return getConfig()[prop];
  },
  ownKeys() {
    return Object.keys(getConfig());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const cfg = getConfig();
    if (prop in cfg) {
      return { configurable: true, enumerable: true, value: cfg[prop] };
    }
    return undefined;
  },
  has(_target, prop: string) {
    return prop in getConfig();
  },
});

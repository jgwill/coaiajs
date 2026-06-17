// coaiajs/src/config.ts — Config management
// Priority: env vars > .env > coaia.json > defaults

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';
import type { CoaiaConfig } from './types.js';

const CONFIG_FILENAMES = [
  'coaia.json',
  '.coaia/config.json',
  '.config/jgwill/coaia.json',
  'Documents/coaia.json',
];

function expandPath(filePath: string): string {
  if (filePath === '~') return homedir();
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
  return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

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

/** Resolve dotenv files in priority order. Earlier files win over later files. */
export function findEnvFiles(envPath?: string): string[] {
  const explicitEnvPath =
    envPath ?? process.env['COAIAJS_ENV_PATH'] ?? process.env['COAIAPY_ENV_PATH'];

  if (explicitEnvPath) {
    return [expandPath(explicitEnvPath)].filter((candidate) => existsSync(candidate));
  }

  return [
    resolve(process.cwd(), '.env'),
    join(homedir(), '.coaia', '.env'),
  ].filter((candidate) => existsSync(candidate));
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

function parseBool(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function envOverrides(): Partial<CoaiaConfig> {
  const cfg: Partial<CoaiaConfig> = {};
  const env = process.env;

  // Redis
  const upstashUrl = env['UPSTASH_REDIS_REST_URL'] ?? env['KV_REST_API_URL'];
  const upstashToken = env['UPSTASH_REDIS_REST_TOKEN'] ?? env['KV_REST_API_TOKEN'];
  const redisUrl = env['KV_URL'] ?? env['REDIS_URL'];
  const redisHost = env['REDIS_HOST'] ?? env['UPSTASH_HOST'];
  const redisPassword = env['REDIS_PASSWORD'] ?? env['UPSTASH_PASSWORD'];

  if (upstashUrl || redisUrl || redisHost || env['REDIS_PORT'] || redisPassword) {
    cfg.redis = {
      url: redisUrl,
      host: redisHost,
      port: env['REDIS_PORT'] ? parseInt(env['REDIS_PORT'], 10) : undefined,
      password: redisPassword,
      ssl: parseBool(env['REDIS_SSL']),
      upstashUrl,
      upstashToken,
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
  for (const dotenvPath of findEnvFiles(envPath)) {
    dotenv.config({ path: dotenvPath, override: false });
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

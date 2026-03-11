// coaiajs/src/environment.ts — Environment management
// Parity with coaiapy's environment.py

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ENV_FILENAME = '.coaia-env';

/** Well-known CoAIA environment variable names. */
const KNOWN_VARS = [
  'COAIA_TRACE_ID',
  'COAIA_SESSION_ID',
  'COAIA_USER_ID',
  'COAIA_PROJECT_ID',
  'COAIA_ENV',
  'COAIA_LOG_LEVEL',
  'COAIA_CONFIG_PATH',
  'COAIA_REDIS_URL',
  'COAIA_PDE_DIR',
] as const;

export type KnownVar = (typeof KNOWN_VARS)[number];

export interface EnvStore {
  [key: string]: string;
}

export class EnvironmentManager {
  private store: EnvStore = {};
  private filePath: string;

  constructor(dir?: string) {
    const baseDir = dir ?? process.cwd();
    this.filePath = resolve(baseDir, ENV_FILENAME);
  }

  /** Initialize environment — load from file if it exists. */
  init(): void {
    if (existsSync(this.filePath)) {
      this.load();
    }
  }

  /** List all environment variables in the store. */
  list(): EnvStore {
    return { ...this.store };
  }

  /** Get a single variable value. */
  get(key: string): string | undefined {
    // Check store first, fall back to process.env
    return this.store[key] ?? process.env[key];
  }

  /** Set an environment variable (in-memory + process.env). */
  set(key: string, value: string): void {
    this.store[key] = value;
    process.env[key] = value;
  }

  /** Remove a variable from the store and process.env. */
  unset(key: string): void {
    delete this.store[key];
    delete process.env[key];
  }

  /** Clear all stored variables. */
  clear(): void {
    for (const key of Object.keys(this.store)) {
      delete process.env[key];
    }
    this.store = {};
  }

  /**
   * Source variables into process.env (like `source .env`).
   * Applies all stored vars to process.env.
   */
  source(): void {
    for (const [key, value] of Object.entries(this.store)) {
      process.env[key] = value;
    }
  }

  /** Save the current store to .coaia-env (JSON format). */
  save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  /** Save as .env format. */
  saveAsEnv(outPath?: string): void {
    const target = outPath ?? this.filePath.replace(/\.coaia-env$/, '.coaia.env');
    const lines = Object.entries(this.store)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(target, lines + '\n', 'utf-8');
  }

  /** Load from .coaia-env file. Supports JSON and .env formats. */
  private load(): void {
    const raw = readFileSync(this.filePath, 'utf-8').trim();

    // Try JSON first
    if (raw.startsWith('{')) {
      try {
        this.store = JSON.parse(raw) as EnvStore;
        return;
      } catch {
        // Fall through to .env parsing
      }
    }

    // Parse .env format: KEY=VALUE lines
    this.store = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      this.store[key] = value;
    }
  }

  /** Get the file path being used. */
  getFilePath(): string {
    return this.filePath;
  }

  /** Get well-known CoAIA variables that are currently set. */
  getKnownVars(): Partial<Record<KnownVar, string>> {
    const result: Partial<Record<KnownVar, string>> = {};
    for (const key of KNOWN_VARS) {
      const val = this.get(key);
      if (val !== undefined) {
        result[key] = val;
      }
    }
    return result;
  }
}

/** Create a default EnvironmentManager for the current directory. */
export function createEnvironment(dir?: string): EnvironmentManager {
  const mgr = new EnvironmentManager(dir);
  mgr.init();
  return mgr;
}

/** Find and load environment from cwd or home. */
export function findEnvironment(): EnvironmentManager {
  const cwdPath = resolve(process.cwd(), ENV_FILENAME);
  if (existsSync(cwdPath)) {
    return createEnvironment(process.cwd());
  }
  const homePath = join(homedir(), ENV_FILENAME);
  if (existsSync(homePath)) {
    return createEnvironment(homedir());
  }
  // Return empty manager for cwd
  return new EnvironmentManager(process.cwd());
}

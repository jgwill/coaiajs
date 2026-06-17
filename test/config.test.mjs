import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { findEnvFiles, readConfig, resetConfig } from '../dist/src/config.js';

const REDIS_ENV_KEYS = [
  'COAIAJS_ENV_PATH',
  'COAIAPY_ENV_PATH',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'KV_URL',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_SSL',
  'UPSTASH_HOST',
  'UPSTASH_PASSWORD',
];

function withCleanEnv(fn) {
  const originalEnv = {};
  for (const key of REDIS_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();

  try {
    return fn();
  } finally {
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    for (const key of REDIS_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    resetConfig();
  }
}

test('loads ~/.coaia/.env when cwd .env is absent', () => withCleanEnv(() => {
  const root = mkdtempSync(join(tmpdir(), 'coaiajs-env-'));
  const home = join(root, 'home');
  const project = join(root, 'project');
  mkdirSync(join(home, '.coaia'), { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(join(home, '.coaia', '.env'), 'REDIS_HOST=127.0.0.1\nREDIS_PORT=6388\n');

  process.env.HOME = home;
  process.chdir(project);

  assert.deepEqual(findEnvFiles(), [join(home, '.coaia', '.env')]);
  const cfg = readConfig();

  assert.equal(cfg.redis?.host, '127.0.0.1');
  assert.equal(cfg.redis?.port, 6388);
}));

test('keeps system env above dotenv files', () => withCleanEnv(() => {
  const root = mkdtempSync(join(tmpdir(), 'coaiajs-env-priority-'));
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, '.env'), 'REDIS_HOST=from-file\nREDIS_PORT=6388\n');
  process.chdir(root);
  process.env.REDIS_HOST = 'from-system';

  const cfg = readConfig();

  assert.equal(cfg.redis?.host, 'from-system');
  assert.equal(cfg.redis?.port, 6388);
}));

test('uses coaiapy-compatible Redis alias priority', () => withCleanEnv(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
  process.env.REDIS_URL = 'redis://redis.example.com:6380';
  process.env.KV_URL = 'rediss://kv.example.com:6379';

  const cfg = readConfig();

  assert.equal(cfg.redis?.upstashUrl, 'https://upstash.example.com');
  assert.equal(cfg.redis?.upstashToken, 'upstash-token');
  assert.equal(cfg.redis?.url, 'rediss://kv.example.com:6379');
}));

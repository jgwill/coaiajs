// coaiajs/src/redis.ts — Redis key-value operations
// Parity with coaiapy's tash/fetch pattern

import IORedis from 'ioredis';
import { getConfig } from './config.js';
import type { CoaiaConfig } from './types.js';

const Redis = IORedis.default ?? IORedis;
type RedisClient = InstanceType<typeof Redis>;

let _client: RedisClient | null = null;

function upstashClient(url: string, token?: string): RedisClient {
  const parsed = new URL(url);
  const tls = parsed.protocol === 'https:' || parsed.protocol === 'rediss:';
  const password = token ?? decodeURIComponent(parsed.password);

  return new Redis({
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: password || undefined,
    lazyConnect: true,
    tls: tls ? {} : undefined,
  });
}

function buildClient(cfg: CoaiaConfig): RedisClient {
  const r = cfg.redis;

  // Upstash/Vercel REST env vars take priority, matching coaiapy.
  if (r?.upstashUrl) {
    return upstashClient(r.upstashUrl, r.upstashToken);
  }

  // Explicit URL takes priority
  if (r?.url) {
    return new Redis(r.url, {
      lazyConnect: true,
      tls: r.url.startsWith('rediss://') ? {} : undefined,
    });
  }

  // Host / port fallback
  return new Redis({
    host: r?.host ?? '127.0.0.1',
    port: r?.port ?? 6379,
    password: r?.password,
    lazyConnect: true,
    tls: r?.ssl ? {} : undefined,
  });
}

/** Get or create the lazy Redis client. */
export function getClient(): RedisClient {
  if (!_client) {
    _client = buildClient(getConfig());
  }
  return _client;
}

/** Store a key-value pair with optional TTL in minutes, matching coaiapy. */
export async function tash(
  key: string,
  value: string,
  ttl?: number,
): Promise<void> {
  const client = getClient();
  if (ttl && ttl > 0) {
    await client.set(key, value, 'EX', ttl * 60);
  } else {
    await client.set(key, value);
  }
}

/** Fetch a value by key. Returns null if not found. */
export async function fetch(key: string): Promise<string | null> {
  const client = getClient();
  return client.get(key);
}

/** Delete a key. Returns number of keys removed. */
export async function del(key: string): Promise<number> {
  const client = getClient();
  return client.del(key);
}

/** List keys matching a pattern. */
export async function keys(pattern: string): Promise<string[]> {
  const client = getClient();
  return client.keys(pattern);
}

/** Check if a key exists. */
export async function exists(key: string): Promise<boolean> {
  const client = getClient();
  return (await client.exists(key)) === 1;
}

/** Gracefully disconnect. */
export async function disconnect(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

/** Reset client (testing). */
export function resetClient(): void {
  _client = null;
}

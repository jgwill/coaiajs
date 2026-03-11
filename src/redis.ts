// coaiajs/src/redis.ts — Redis key-value operations
// Parity with coaiapy's tash/fetch pattern

import IORedis from 'ioredis';
import { getConfig } from './config.js';
import type { CoaiaConfig } from './types.js';

const Redis = IORedis.default ?? IORedis;
type RedisClient = InstanceType<typeof Redis>;

let _client: RedisClient | null = null;

function buildClient(cfg: CoaiaConfig): RedisClient {
  const r = cfg.redis;

  // Explicit URL takes priority
  if (r?.url) {
    return new Redis(r.url, { lazyConnect: true });
  }

  // Upstash REST-style URL (ioredis can connect via rediss:// scheme)
  if (r?.upstashUrl) {
    const url = r.upstashUrl.replace(/^https:\/\//, 'rediss://');
    return new Redis(url, {
      password: r.upstashToken,
      lazyConnect: true,
      tls: {},
    });
  }

  // Host / port fallback
  return new Redis({
    host: r?.host ?? '127.0.0.1',
    port: r?.port ?? 6379,
    password: r?.password,
    lazyConnect: true,
  });
}

/** Get or create the lazy Redis client. */
export function getClient(): RedisClient {
  if (!_client) {
    _client = buildClient(getConfig());
  }
  return _client;
}

/** Store a key-value pair with optional TTL (seconds). */
export async function tash(
  key: string,
  value: string,
  ttl?: number,
): Promise<void> {
  const client = getClient();
  if (ttl && ttl > 0) {
    await client.set(key, value, 'EX', ttl);
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

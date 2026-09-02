// coaiajs/src/redis.ts — Redis key-value operations
// Parity with coaiapy's tash/fetch pattern

import IORedis from 'ioredis';
import { getConfig } from './config.js';
import type { CoaiaConfig } from './types.js';

const Redis = IORedis.default ?? IORedis;

/** Minimal key-value surface shared by the TCP and REST backends. */
export interface KvClient {
  set(key: string, value: string, ttlSeconds?: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<number>;
  quit(): Promise<unknown>;
}

let _client: KvClient | null = null;

/**
 * Upstash-compatible REST backend. The endpoint accepts a JSON command array
 * (`["SET","k","v"]`) POSTed to the base URL and answers `{"result": ...}`.
 */
class RestRedisClient implements KvClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(url: string, token?: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.token = token;
  }

  private async command<T>(args: (string | number)[]): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await globalThis.fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(args.map(String)),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Redis REST ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    }

    let payload: { result?: T; error?: string };
    try {
      payload = JSON.parse(text) as { result?: T; error?: string };
    } catch {
      throw new Error(`Redis REST returned non-JSON response: ${text.slice(0, 200)}`);
    }
    if (payload.error) throw new Error(`Redis REST error: ${payload.error}`);
    return payload.result as T;
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<unknown> {
    const args = ttlSeconds && ttlSeconds > 0 ? ['EX', String(ttlSeconds)] : [];
    return this.command(['SET', key, value, ...args]);
  }

  get(key: string): Promise<string | null> {
    return this.command<string | null>(['GET', key]);
  }

  del(key: string): Promise<number> {
    return this.command<number>(['DEL', key]);
  }

  keys(pattern: string): Promise<string[]> {
    return this.command<string[]>(['KEYS', pattern]);
  }

  exists(key: string): Promise<number> {
    return this.command<number>(['EXISTS', key]);
  }

  async quit(): Promise<unknown> {
    return 'OK';
  }
}

/** ioredis-backed TCP/TLS backend, adapted to the shared KvClient surface. */
class TcpRedisClient implements KvClient {
  constructor(private readonly redis: InstanceType<typeof Redis>) {}

  set(key: string, value: string, ttlSeconds?: number): Promise<unknown> {
    return ttlSeconds && ttlSeconds > 0
      ? this.redis.set(key, value, 'EX', ttlSeconds)
      : this.redis.set(key, value);
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  quit(): Promise<unknown> {
    return this.redis.quit();
  }
}

function upstashClient(url: string, token?: string): KvClient {
  const parsed = new URL(url);

  // An http(s) URL is a REST endpoint, not a TCP socket.
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return new RestRedisClient(url, token ?? (decodeURIComponent(parsed.password) || undefined));
  }

  const tls = parsed.protocol === 'rediss:';
  const password = token ?? decodeURIComponent(parsed.password);

  return new TcpRedisClient(new Redis({
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: password || undefined,
    lazyConnect: true,
    tls: tls ? {} : undefined,
  }));
}

function buildClient(cfg: CoaiaConfig): KvClient {
  const r = cfg.redis;

  // Upstash/Vercel REST env vars take priority, matching coaiapy.
  if (r?.upstashUrl) {
    return upstashClient(r.upstashUrl, r.upstashToken);
  }

  // Explicit URL takes priority
  if (r?.url) {
    return new TcpRedisClient(new Redis(r.url, {
      lazyConnect: true,
      tls: r.url.startsWith('rediss://') ? {} : undefined,
    }));
  }

  // Host / port fallback
  return new TcpRedisClient(new Redis({
    host: r?.host ?? '127.0.0.1',
    port: r?.port ?? 6379,
    password: r?.password,
    lazyConnect: true,
    tls: r?.ssl ? {} : undefined,
  }));
}

/** Get or create the lazy Redis client. */
export function getClient(): KvClient {
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
    await client.set(key, value, ttl * 60);
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

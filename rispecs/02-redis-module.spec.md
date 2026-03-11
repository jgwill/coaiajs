# 02 — Redis Module

> Redis key-value store with tash/fetch convention.

## Desired Outcome

A thin Redis wrapper providing `tash(key, value, ttl?)` and `fetch(key)` with lazy ioredis connection, Upstash support, and pattern-based key operations — the universal CoAiA data persistence shorthand.

## Structural Tension

**Current Reality:**
- `src/redis.ts` is fully implemented (94 lines) with `tash()`, `fetch()`, `del()`, `keys()`, `exists()`, `disconnect()`, `resetClient()`
- Uses ioredis with lazy connection
- Supports direct URL, Upstash REST (`rediss://`) URLs, host/port fallback
- Key-value operations with optional TTL
- Parity with coaiapy's `tash/fetch` pattern achieved

**Desired Outcome:**
Redis module with everything currently implemented plus:
- Hash operations (`htash`/`hfetch`) for structured data
- Sorted set operations for time-series data (session logs, trace ordering)
- Pub/Sub support for inter-agent messaging
- Connection health check (`ping()`)
- MCP tool exposure (5 tools: tash, fetch, del, keys, exists)

## Core API

```typescript
// Key-value (implemented)
tash(key: string, value: string, ttl?: number): Promise<void>
fetch(key: string): Promise<string | null>
del(key: string): Promise<number>
keys(pattern: string): Promise<string[]>
exists(key: string): Promise<boolean>

// Hash (desired)
htash(key: string, field: string, value: string): Promise<void>
hfetch(key: string, field?: string): Promise<Record<string, string> | string | null>

// Sorted set (desired)
zadd(key: string, score: number, member: string): Promise<void>
zrange(key: string, start: number, stop: number): Promise<string[]>

// Utility (desired)
ping(): Promise<boolean>
```

## Connection Strategy

1. If `REDIS_URL` or config `redis_url` is set → use it directly
2. If URL starts with `rediss://` → enable TLS (Upstash pattern)
3. Otherwise → construct from `redis_host` (default: `localhost`) and `redis_port` (default: `6379`)
4. Connection is lazy — no connect until first operation
5. Reconnect automatically on transient failures (ioredis default behavior)

## Quality Criteria

- ✅ `tash('key', 'value')` behaves identically to coaiapy's `tash('key', 'value')`
- ✅ `tash('key', 'value', 300)` sets a 300-second TTL
- ✅ `fetch('nonexistent')` returns `null`, never throws
- ✅ Upstash URLs work without additional configuration
- ✅ `resetClient()` disconnects and clears for test isolation

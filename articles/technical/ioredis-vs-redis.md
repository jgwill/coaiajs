# ioredis vs node-redis: Technical Assessment for CoAiA.js

> Package selection brief — Redis client for structural tension chart storage, session management, and MCP memory persistence

## Summary & Recommendation

**Use `ioredis` v5.4.x** for coaiajs. Despite Redis Inc. pushing `node-redis` as the official client, ioredis delivers superior ergonomics for our use case: URL-based connection strings (Upstash REST compatibility), built-in cluster support for future scaling, and a smoother pipelining API. The ~14M weekly downloads and battle-tested stability outweigh the marginal concurrency edge of node-redis that we don't need.

**Pin:** `"ioredis": "^5.4.0"`

## What We're Replacing

Coaiapy uses `redis<=4.3.6` (Python redis-py) with a lazy-loading pattern:

```python
# coaiapy/coaiamodule.py — lazy import for Pythonista compatibility
def _get_redis():
    """Lazy import of redis module"""
    import redis
    return redis
```

The Python client connects via URL string and performs simple GET/SET with TTL for session data, chart state, and webhook coordination. coaia-narrative's MCP server (Redis-backed medicine wheel) also uses Redis for ceremony state.

## Options Compared

| Feature | ioredis v5.4 | node-redis v4.7 |
|---------|-------------|-----------------|
| Weekly npm downloads | ~14–15M | ~8–9M |
| GitHub stars | ~15,000 | ~17,000 |
| Connection from URL | `new Redis(url)` — native | `createClient({ url })` — native |
| Upstash REST compat | Via `@upstash/redis` wrapper or direct URL | Via `@upstash/redis` wrapper |
| GET/SET with TTL | `redis.set(key, val, 'EX', ttl)` | `client.set(key, val, { EX: ttl })` |
| Pipelining | `redis.pipeline().set().get().exec()` | `client.multi().set().get().exec()` |
| Cluster support | Built-in, first-class | Available but newer |
| Auto-reconnect | Built-in with backoff | Built-in with strategy |
| TypeScript | `@types/ioredis` bundled | Native types |
| Concurrent 100-SET ops/sec | ~2,500 | ~3,800 |
| Sequential GET ops/sec | ~8,700 | ~7,900 |
| Lua scripting | First-class `defineCommand()` | Supported |
| Streams API | Rich ergonomic API | Supported |

## API Overview

### Connection Pattern for coaiajs

```typescript
import Redis from 'ioredis';
import { loadConfig } from '../config.js';

// Connection from URL (matches coaiapy pattern)
const config = loadConfig();
const redis = new Redis(config.redisUrl ?? 'redis://localhost:6379');

// With Upstash (TLS URL)
const upstashRedis = new Redis(process.env.UPSTASH_REDIS_URL!, {
  tls: { rejectUnauthorized: false },
  lazyConnect: true,  // matches coaiapy's lazy pattern
});
```

### Core Operations We Need

```typescript
// Session storage with TTL
async function saveSession(sessionId: string, data: object, ttlSeconds = 3600): Promise<void> {
  await redis.set(`session:${sessionId}`, JSON.stringify(data), 'EX', ttlSeconds);
}

async function loadSession(sessionId: string): Promise<object | null> {
  const raw = await redis.get(`session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

// Chart state persistence (coaia-narrative pattern)
async function saveChart(chartId: string, chart: object): Promise<void> {
  await redis.hset(`chart:${chartId}`, {
    data: JSON.stringify(chart),
    updatedAt: new Date().toISOString(),
  });
}

// Pipeline for batch operations
async function loadMultipleCharts(ids: string[]): Promise<Map<string, object>> {
  const pipeline = redis.pipeline();
  ids.forEach(id => pipeline.hgetall(`chart:${id}`));
  const results = await pipeline.exec();
  // ... process results
}
```

### Lazy Connection Pattern (matching coaiapy)

```typescript
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? 'redis://localhost:6379';
    _redis = new Redis(url, { lazyConnect: true });
  }
  return _redis;
}
```

## Integration Plan

1. **Core module:** `src/redis.ts` — connection singleton, lazy init, URL-from-config
2. **Session storage:** `src/session.ts` — GET/SET with TTL for webhook session management
3. **Chart persistence:** `src/narrative/redis-store.ts` — HSET/HGETALL for structural tension charts
4. **MCP memory:** `mcp/tools/memory.ts` — Redis-backed tool state for MCP servers
5. **Graceful shutdown:** `redis.quit()` in process exit handlers

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 5.4.2 (March 2026) |
| Weekly downloads | ~14.5M |
| TypeScript | Built-in types since v5 |
| Node.js compat | ≥14 (we target ≥20) |
| Maintenance | Active, regular releases |
| License | MIT |
| Bundle size | ~85KB minified |

## Why Not node-redis?

1. **Connection API ergonomics**: ioredis accepts URL in constructor directly; node-redis requires `createClient()` factory
2. **Cluster future-proofing**: ioredis has years of battle-tested cluster support
3. **Pipelining**: ioredis pipeline API is cleaner for our batch chart operations
4. **Lazy connect**: `lazyConnect: true` maps directly to coaiapy's lazy import pattern
5. **Ecosystem**: Used by Bull, BullMQ, and most Redis-dependent MCP servers we integrate with

The 3,800 vs 2,500 ops/sec concurrent difference in node-redis's favor is irrelevant — coaiajs is an agent framework, not a high-throughput data pipeline.

## References

- npm: https://www.npmjs.com/package/ioredis
- GitHub: https://github.com/redis/ioredis
- Benchmark: https://glama.ai/blog/2026-01-26-redis-vs-ioredis-vs-valkey-glide
- npm trends: https://npmtrends.com/ioredis-vs-redis
- Redis migration guide: https://redis.io/docs/latest/develop/clients/nodejs/migration/

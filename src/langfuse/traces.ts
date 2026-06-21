// coaiajs/src/langfuse/traces.ts — Trace operations
// Port of cofuse.py trace functions

import { v4 as uuidv4 } from 'uuid';
import { getClient, nowISO } from './client.js';
import type { IngestionEvent } from './client.js';

export interface TraceFilters {
  sessionId?: string;
  userId?: string;
  name?: string;
  tags?: string[];
  fromTimestamp?: string;
  toTimestamp?: string;
  orderBy?: string;
  version?: string;
  release?: string;
  environment?: string[];
  page?: number;
  limit?: number;
}

export async function addTrace(params: {
  traceId?: string;
  userId?: string;
  sessionId?: string;
  name?: string;
  inputData?: unknown;
  outputData?: unknown;
  metadata?: unknown;
}): Promise<string> {
  const client = getClient();
  const now = nowISO();
  const traceId = params.traceId ?? uuidv4();

  const body: Record<string, unknown> = {
    id: traceId,
    timestamp: now,
  };

  if (params.sessionId) body.sessionId = params.sessionId;
  if (params.name) body.name = params.name;
  if (params.inputData) body.input = params.inputData;
  if (params.outputData) body.output = params.outputData;
  if (params.userId) body.userId = params.userId;
  if (params.metadata) body.metadata = params.metadata;

  const event: IngestionEvent = {
    id: `${traceId}-event`,
    timestamp: now,
    type: 'trace-create',
    body,
  };

  await client.ingest([event]);

  return JSON.stringify({
    success: true,
    traceId,
    message: `Trace ${traceId} created`,
  }, null, 2);
}

export async function patchTraceOutput(
  traceIdOrParams: string | { traceId?: string; output?: string; outputData?: unknown },
  outputData?: unknown,
): Promise<string> {
  const traceId = typeof traceIdOrParams === 'string' ? traceIdOrParams : traceIdOrParams.traceId;
  if (!traceId) throw new Error('traceId is required');
  const output = typeof traceIdOrParams === 'string'
    ? outputData
    : parseJsonOption(traceIdOrParams.outputData ?? traceIdOrParams.output);

  const client = getClient();
  const now = nowISO();

  const body: Record<string, unknown> = {
    id: traceId,
    timestamp: now,
    output,
  };

  const eventId = `${traceId}-patch-${uuidv4().slice(0, 8)}`;
  const event: IngestionEvent = {
    id: eventId,
    timestamp: now,
    type: 'trace-create',
    body,
  };

  await client.ingest([event]);

  return JSON.stringify({
    success: true,
    traceId,
    message: `Trace output patched for ${traceId}`,
  }, null, 2);
}

function parseJsonOption(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function createTrace(params: {
  traceId?: string;
  id?: string;
  userId?: string;
  sessionId?: string;
  name?: string;
  input?: string;
  inputData?: unknown;
  output?: string;
  outputData?: unknown;
  metadata?: string | unknown;
}): Promise<string> {
  return addTrace({
    traceId: params.traceId ?? params.id,
    userId: params.userId,
    sessionId: params.sessionId,
    name: params.name,
    inputData: parseJsonOption(params.inputData ?? params.input),
    outputData: parseJsonOption(params.outputData ?? params.output),
    metadata: parseJsonOption(params.metadata),
  });
}

export async function listTraces(filters: TraceFilters): Promise<string> {
  const client = getClient();
  const params = new URLSearchParams();

  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.name) params.set('name', filters.name);
  if (filters.fromTimestamp) params.set('fromTimestamp', filters.fromTimestamp);
  if (filters.toTimestamp) params.set('toTimestamp', filters.toTimestamp);
  if (filters.orderBy) params.set('orderBy', filters.orderBy);
  if (filters.version) params.set('version', filters.version);
  if (filters.release) params.set('release', filters.release);
  if (filters.tags) {
    for (const tag of filters.tags) params.append('tags', tag);
  }
  if (filters.environment) {
    for (const env of filters.environment) params.append('environment', env);
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  params.set('page', String(page));
  params.set('limit', String(limit));

  const qs = params.toString();
  const path = `/api/public/traces${qs ? `?${qs}` : ''}`;
  const result = await client.request<unknown>('GET', path);
  return JSON.stringify(result, null, 2);
}

export async function getTrace(traceId: string): Promise<string> {
  const client = getClient();

  const trace = await client.request<Record<string, unknown>>('GET', `/api/public/traces/${traceId}`);

  // Fetch observations for this trace
  try {
    const obsResult = await client.request<Record<string, unknown>>(
      'GET',
      `/api/public/observations?traceId=${traceId}`,
    );
    if (obsResult && typeof obsResult === 'object' && 'data' in obsResult) {
      trace.observations = obsResult.data;
    } else {
      trace.observations = obsResult;
    }
  } catch {
    trace.observations = [];
  }

  return JSON.stringify(trace, null, 2);
}

export async function traceView(traceId: string): Promise<string> {
  const raw = await getTrace(traceId);
  return formatTraceTree(raw);
}

export async function sessionView(sessionId: string): Promise<string> {
  const raw = await listTraces({ sessionId, limit: 20, orderBy: 'timestamp.desc' });
  return formatTracesMarkdown(raw);
}

// ─── Formatters ─────────────────────────────────────────────────────

export function formatTracesTable(json: unknown): string {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const traces: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!traces.length) return 'No traces found.';

    const headers = ['ID', 'Name', 'Session', 'User', 'Time'];
    const rows = traces.map((t) => [
      trunc(String(t.id ?? 'N/A'), 20),
      trunc(String(t.name ?? 'Unnamed'), 20),
      trunc(String(t.sessionId ?? 'N/A'), 15),
      trunc(String(t.userId ?? 'N/A'), 12),
      trunc(String(t.timestamp ?? 'N/A').slice(0, 19), 19),
    ]);

    return formatTable(headers, rows) + `\nTotal traces: ${traces.length}`;
  } catch (e) {
    return `Error formatting traces: ${e}`;
  }
}

const TYPE_GLYPHS: Record<string, string> = {
  SPAN: '🔗',
  GENERATION: '🤖',
  EVENT: '⚡',
  SCORE: '📊',
  TRACE: '🛤️',
  DEFAULT: '📦',
};

export function formatTraceTree(json: unknown): string {
  try {
    const trace = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>;
    if ('error' in trace) return `Error: ${trace.error}`;

    const BRANCH = '├── ';
    const LAST = '└── ';
    const VERT = '│   ';
    const SPACE = '    ';

    const lines: string[] = [];
    const name = String(trace.name ?? 'Unnamed');
    const id = String(trace.id ?? 'N/A');
    const userId = String(trace.userId ?? 'N/A');
    const sessionId = String(trace.sessionId ?? 'N/A');
    const ts = String(trace.timestamp ?? 'N/A').slice(0, 19);

    lines.push(`🔗 Trace: ${name}`);
    lines.push(`${BRANCH}🆔 ID: ${id}`);
    lines.push(`${BRANCH}👤 User: ${userId}`);
    lines.push(`${BRANCH}🔗 Session: ${sessionId}`);
    lines.push(`${BRANCH}⏰ Time: ${ts}`);

    const metadata = trace.metadata as Record<string, unknown> | undefined;
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length) {
      lines.push(`${BRANCH}📋 Metadata:`);
      const entries = Object.entries(metadata);
      entries.forEach(([k, v], i) => {
        const pre = i === entries.length - 1 ? LAST : BRANCH;
        lines.push(`${VERT}${pre}${k}: ${v}`);
      });
    }

    const observations = (trace.observations ?? []) as Record<string, unknown>[];
    if (!observations.length) {
      lines.push(`${LAST}📝 No observations`);
      return lines.join('\n');
    }

    lines.push(`${LAST}📝 Observations (${observations.length}):`);

    const roots = observations.filter((o) => !o.parentObservationId);

    function addTree(list: Record<string, unknown>[], prefix: string) {
      list.forEach((obs, i) => {
        const isLast = i === list.length - 1;
        const obsName = String(obs.name ?? `Obs ${String(obs.id ?? '').slice(0, 8)}`);
        const obsType = String(obs.type ?? 'UNKNOWN').toUpperCase();
        const obsTime = String(obs.startTime ?? 'N/A').slice(0, 19);
        const glyph = TYPE_GLYPHS[obsType] ?? TYPE_GLYPHS.DEFAULT;

        const sym = isLast ? LAST : BRANCH;
        const np = prefix + (isLast ? SPACE : VERT);

        lines.push(`${prefix}${sym}${glyph} [${obsType}] ${obsName} (${obs.id})`);
        lines.push(`${np}${BRANCH}⏰ ${obsTime}`);

        if (obs.input) {
          const txt = trunc(String(obs.input).replace(/\n/g, ' '), 90);
          lines.push(`${np}${BRANCH}📥 Input: ${txt}`);
        }
        if (obs.output) {
          const txt = trunc(String(obs.output).replace(/\n/g, ' '), 90);
          lines.push(`${np}${LAST}📤 Output: ${txt}`);
        }

        const children = observations.filter((c) => c.parentObservationId === obs.id);
        if (children.length) {
          lines.push(`${np}${LAST}🌿 Children (${children.length}):`);
          addTree(children, np + SPACE);
        }
      });
    }

    addTree(roots, SPACE);
    return lines.join('\n');
  } catch (e) {
    return `Error formatting trace tree: ${e}`;
  }
}

export function formatTracesMarkdown(json: unknown): string {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const traces: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!traces.length) return '_No traces found._';

    const header = '| ID | Name | Session | User | Timestamp |';
    const sep    = '|----|------|---------|------|-----------|';
    const rows = traces.map((t) => {
      const id      = trunc(String(t.id        ?? ''), 20);
      const name    = trunc(String(t.name      ?? 'Unnamed'), 30);
      const session = trunc(String(t.sessionId ?? ''), 24);
      const user    = trunc(String(t.userId    ?? ''), 16);
      const ts      = String(t.timestamp ?? '').slice(0, 19);
      return `| ${id} | ${name} | ${session} | ${user} | ${ts} |`;
    });

    return [header, sep, ...rows, '', `_Total: ${traces.length} trace(s)_`].join('\n');
  } catch (e) {
    return `Error formatting traces: ${e}`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function trunc(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 3) + '...' : s;
}

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const sep = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const hdr = '| ' + headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + ' |';
  const body = rows.map(
    (r) => '| ' + r.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ') + ' |',
  );
  return [sep, hdr, sep, ...body, sep].join('\n');
}

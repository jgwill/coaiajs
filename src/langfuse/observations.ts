// coaiajs/src/langfuse/observations.ts — Langfuse v4 observation operations

import { getClient } from './client.js';
import type { V4ObservationInput, V4ObservationType } from './client.js';

export const ALL_OBSERVATION_FIELDS = [
  'core', 'basic', 'time', 'io', 'metadata', 'model',
  'usage', 'prompt', 'metrics', 'trace_context',
].join(',');

export interface ObservationFilters {
  fields?: string;
  limit?: number;
  cursor?: string;
  name?: string;
  userId?: string;
  sessionId?: string;
  type?: string;
  traceId?: string;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  parentObservationId?: string;
  isRootObservation?: boolean;
  environment?: string | string[];
  fromStartTime?: string;
  toStartTime?: string;
  version?: string;
  filter?: Array<Record<string, unknown>>;
}

export async function addObservation(params: {
  observationId?: string;
  traceId: string;
  type?: string;
  name: string;
  parentId?: string;
  parentObservationId?: string;
  input?: string;
  inputData?: unknown;
  output?: string;
  outputData?: unknown;
  metadata?: string | Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  level?: string;
  statusMessage?: string;
  model?: string;
  modelParameters?: Record<string, string | number>;
  usage?: Record<string, number>;
  cost?: Record<string, number>;
  traceName?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  traceMetadata?: Record<string, unknown>;
}): Promise<string> {
  const client = getClient();
  const type = normalizeObservationType(params.type);
  const result = await client.exportObservation({
    traceId: params.traceId,
    observationId: params.observationId,
    parentObservationId: params.parentId ?? params.parentObservationId,
    type,
    name: params.name,
    input: parseJsonOption(params.inputData ?? params.input),
    output: parseJsonOption(params.outputData ?? params.output),
    metadata: parseMetadata(params.metadata),
    startTime: params.startTime,
    endTime: params.endTime,
    level: normalizeLevel(params.level),
    statusMessage: params.statusMessage,
    model: params.model,
    modelParameters: params.modelParameters,
    usageDetails: params.usage,
    costDetails: params.cost,
    traceName: params.traceName,
    userId: params.userId,
    sessionId: params.sessionId,
    tags: params.tags,
    traceMetadata: params.traceMetadata,
  });

  return JSON.stringify({
    success: true,
    observationId: result.observationId,
    traceId: result.traceId,
    name: params.name,
    type,
  }, null, 2);
}

export async function listObservations(filters: ObservationFilters = {}): Promise<string> {
  const result = await fetchObservationsPage(filters);
  return JSON.stringify(result, null, 2);
}

export async function fetchObservationsPage(
  filters: ObservationFilters = {},
): Promise<{ data: Array<Record<string, unknown>>; meta: { cursor?: string } }> {
  const client = getClient();
  const result = await client.api.observations.getMany({
    fields: filters.fields ?? ALL_OBSERVATION_FIELDS,
    limit: filters.limit,
    cursor: filters.cursor,
    name: filters.name,
    userId: filters.userId,
    sessionId: filters.sessionId,
    type: filters.type,
    traceId: filters.traceId,
    level: filters.level,
    parentObservationId: filters.parentObservationId,
    isRootObservation: filters.isRootObservation,
    environment: filters.environment,
    fromStartTime: filters.fromStartTime,
    toStartTime: filters.toStartTime,
    version: filters.version,
    filter: filters.filter ? JSON.stringify(filters.filter) : undefined,
  });

  return result as unknown as {
    data: Array<Record<string, unknown>>;
    meta: { cursor?: string };
  };
}

export async function fetchAllObservations(
  filters: ObservationFilters = {},
): Promise<Array<Record<string, unknown>>> {
  const observations: Array<Record<string, unknown>> = [];
  let cursor = filters.cursor;

  do {
    const page = await fetchObservationsPage({ ...filters, cursor });
    observations.push(...page.data);
    cursor = page.meta.cursor;
  } while (cursor);

  return observations;
}

export async function getObservation(observationId: string): Promise<string> {
  const result = await fetchObservationsPage({
    fields: ALL_OBSERVATION_FIELDS,
    limit: 1,
    filter: [{
      type: 'string',
      column: 'id',
      operator: '=',
      value: observationId,
    }],
  });
  const observation = result.data[0];
  if (!observation) throw new Error(`Observation not found: ${observationId}`);
  return JSON.stringify(observation, null, 2);
}

export async function addObservations(params: {
  traceId?: string;
  observations?: Array<Record<string, unknown>>;
}): Promise<string> {
  const observations = params.observations ?? [];
  const results: unknown[] = [];
  for (const observation of observations) {
    const traceId = String(observation.traceId ?? params.traceId ?? '');
    const name = String(observation.name ?? 'Observation');
    if (!traceId) throw new Error('traceId is required for every observation');
    results.push(JSON.parse(await addObservation({
      ...observation,
      traceId,
      name,
    })) as unknown);
  }
  return JSON.stringify({ success: true, count: results.length, observations: results }, null, 2);
}

function normalizeObservationType(type?: string): V4ObservationType {
  const normalized = (type ?? 'EVENT').toUpperCase();
  if (normalized === 'SPAN' || normalized === 'GENERATION' || normalized === 'EVENT') {
    return normalized;
  }
  throw new Error(`Unsupported observation type '${type}'. Use SPAN, GENERATION, or EVENT.`);
}

function normalizeLevel(level?: string): V4ObservationInput['level'] {
  if (!level) return undefined;
  const normalized = level.toUpperCase();
  if (normalized === 'DEBUG' || normalized === 'DEFAULT' || normalized === 'WARNING' || normalized === 'ERROR') {
    return normalized;
  }
  throw new Error(`Unsupported observation level '${level}'.`);
}

function parseJsonOption(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  const parsed = parseJsonOption(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined;
}

// ─── Formatters ─────────────────────────────────────────────────────

const TYPE_GLYPHS: Record<string, string> = {
  SPAN: '🔗',
  GENERATION: '🤖',
  EVENT: '⚡',
  AGENT: '🧠',
  TOOL: '🛠️',
  CHAIN: '⛓️',
  RETRIEVER: '🔎',
  EVALUATOR: '📊',
  EMBEDDING: '🧬',
  GUARDRAIL: '🛡️',
  DEFAULT: '📦',
};

export function formatObservationDisplay(json: unknown): string {
  try {
    const obs = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>;
    if ('error' in obs) return `Error: ${obs.error}`;

    const obsType = String(obs.type ?? 'UNKNOWN').toUpperCase();
    const glyph = TYPE_GLYPHS[obsType] ?? TYPE_GLYPHS.DEFAULT;

    const lines: string[] = [];
    lines.push(`${glyph} Observation: ${obs.name ?? 'Unnamed'}`);
    lines.push(`├── 🆔 ID: ${obs.id ?? 'N/A'}`);
    lines.push(`├── 📋 Type: ${obsType}`);
    lines.push(`├── 🔗 Trace: ${obs.traceId ?? 'N/A'}`);
    lines.push(`├── ⏰ Start: ${String(obs.startTime ?? 'N/A').slice(0, 19)}`);

    if (obs.endTime) lines.push(`├── ⏰ End: ${String(obs.endTime).slice(0, 19)}`);
    if (obs.level && obs.level !== 'DEFAULT') lines.push(`├── 📊 Level: ${obs.level}`);
    if (obs.providedModelName) lines.push(`├── 🤖 Model: ${obs.providedModelName}`);

    if (obs.parentObservationId) {
      lines.push(`├── 👆 Parent: ${obs.parentObservationId}`);
    }

    if (obs.input) {
      const txt = String(obs.input).replace(/\n/g, ' ');
      lines.push(`├── 📥 Input: ${txt.length > 100 ? txt.slice(0, 100) + '...' : txt}`);
    }
    if (obs.output) {
      const txt = String(obs.output).replace(/\n/g, ' ');
      lines.push(`├── 📤 Output: ${txt.length > 100 ? txt.slice(0, 100) + '...' : txt}`);
    }

    const metadata = obs.metadata as Record<string, unknown> | undefined;
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length) {
      lines.push('└── 📋 Metadata:');
      const entries = Object.entries(metadata);
      entries.forEach(([k, v], i) => {
        const pre = i === entries.length - 1 ? '└── ' : '├── ';
        lines.push(`    ${pre}${k}: ${JSON.stringify(v)}`);
      });
    } else if (lines.length > 0) {
      const last = lines[lines.length - 1];
      if (last.startsWith('├── ')) {
        lines[lines.length - 1] = last.replace('├── ', '└── ');
      }
    }

    return lines.join('\n');
  } catch (e) {
    return `Error formatting observation: ${e}`;
  }
}

// coaiajs/src/langfuse/observations.ts — Observation operations
// Port of cofuse.py observation functions

import { v4 as uuidv4 } from 'uuid';
import { getClient, nowISO } from './client.js';
import type { IngestionEvent } from './client.js';

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
  metadata?: string | unknown;
  startTime?: string;
  endTime?: string;
  level?: string;
  model?: string;
  usage?: unknown;
}): Promise<string> {
  const client = getClient();
  const now = nowISO();
  const obsId = params.observationId ?? uuidv4();

  const body: Record<string, unknown> = {
    id: obsId,
    traceId: params.traceId,
    type: params.type ?? 'EVENT',
    startTime: params.startTime ?? now,
    level: params.level ?? 'DEFAULT',
  };

  if (params.name) body.name = params.name;
  if (params.inputData ?? params.input) body.input = parseJsonOption(params.inputData ?? params.input);
  if (params.outputData ?? params.output) body.output = parseJsonOption(params.outputData ?? params.output);
  if (params.metadata) body.metadata = parseJsonOption(params.metadata);
  if (params.parentId ?? params.parentObservationId) body.parentObservationId = params.parentId ?? params.parentObservationId;
  if (params.endTime) body.endTime = params.endTime;
  if (params.model) body.model = params.model;
  if (params.usage) body.usage = params.usage;

  const event: IngestionEvent = {
    id: `${obsId}-event`,
    timestamp: now,
    type: 'observation-create',
    body,
  };

  await client.ingest([event]);

  return JSON.stringify({
    success: true,
    observationId: obsId,
    traceId: params.traceId,
    name: params.name,
    type: params.type ?? 'EVENT',
  }, null, 2);
}

export async function getObservation(observationId: string): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', `/api/public/observations/${observationId}`);
  return JSON.stringify(result, null, 2);
}

function parseJsonOption(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function addObservations(params: { traceId?: string; observations?: Array<Record<string, unknown>> }): Promise<string> {
  const observations = params.observations ?? [];
  const results: unknown[] = [];
  for (const observation of observations) {
    const traceId = String(observation.traceId ?? params.traceId ?? '');
    const name = String(observation.name ?? 'Observation');
    if (!traceId) throw new Error('traceId is required for every observation');
    results.push(JSON.parse(await addObservation({ ...observation, traceId, name })) as unknown);
  }
  return JSON.stringify({ success: true, count: results.length, observations: results }, null, 2);
}

// ─── Formatters ─────────────────────────────────────────────────────

const TYPE_GLYPHS: Record<string, string> = {
  SPAN: '🔗',
  GENERATION: '🤖',
  EVENT: '⚡',
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
    if (obs.model) lines.push(`├── 🤖 Model: ${obs.model}`);

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
      lines.push(`└── 📋 Metadata:`);
      const entries = Object.entries(metadata);
      entries.forEach(([k, v], i) => {
        const pre = i === entries.length - 1 ? '└── ' : '├── ';
        lines.push(`    ${pre}${k}: ${JSON.stringify(v)}`);
      });
    } else {
      // Fix last ├── to └──
      if (lines.length > 0) {
        const last = lines[lines.length - 1];
        if (last.startsWith('├── ')) {
          lines[lines.length - 1] = last.replace('├── ', '└── ');
        }
      }
    }

    return lines.join('\n');
  } catch (e) {
    return `Error formatting observation: ${e}`;
  }
}

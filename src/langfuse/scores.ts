// coaiajs/src/langfuse/scores.ts — Score operations
// Port of cofuse.py score functions including configs, presets, import/export

import { readFileSync, writeFileSync } from 'node:fs';
import { getClient, nowISO } from './client.js';
import type { ScoreConfig } from '../types.js';

export interface ScoreFilters {
  userId?: string;
  name?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  configId?: string;
  page?: number;
}

// ─── Score CRUD ─────────────────────────────────────────────────────

export async function createScore(params: {
  id?: string;
  name?: string;
  value: number;
  traceId?: string;
  observationId?: string;
  configId?: string;
  comment?: string;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = { value: params.value };

  if (params.id) data.id = params.id;
  if (params.name) data.name = params.name;
  if (params.traceId) data.traceId = params.traceId;
  if (params.observationId) data.observationId = params.observationId;
  if (params.configId) data.configId = params.configId;
  if (params.comment) data.comment = params.comment;

  const result = await client.request<unknown>('POST', '/api/public/scores', data);
  return JSON.stringify(result, null, 2);
}

export async function applyScoreToTrace(
  traceId: string,
  scoreId: string,
  value: number,
): Promise<string> {
  return createScoreForTarget({
    targetType: 'trace',
    targetId: traceId,
    scoreId,
    value,
  });
}

export async function createScoreForTarget(params: {
  targetType: 'trace' | 'session';
  targetId: string;
  scoreId?: string;
  value: number;
  scoreName?: string;
  observationId?: string;
  configId?: string;
  comment?: string;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = { value: params.value };

  if (params.targetType === 'trace') {
    data.traceId = params.targetId;
    if (params.observationId) data.observationId = params.observationId;
  } else {
    data.sessionId = params.targetId;
  }

  if (params.configId) {
    data.configId = params.configId;
  } else {
    if (params.scoreId) data.id = params.scoreId;
    if (params.scoreName) data.name = params.scoreName;
  }

  if (params.comment) data.comment = params.comment;

  const result = await client.request<unknown>('POST', '/api/public/scores', data);
  return JSON.stringify(result, null, 2);
}

export async function listScores(filters: ScoreFilters): Promise<string> {
  const client = getClient();
  const allScores: unknown[] = [];
  let page = filters.page ?? 1;

  while (true) {
    const params = new URLSearchParams({ page: String(page) });
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.name) params.set('name', filters.name);
    if (filters.fromTimestamp) params.set('fromTimestamp', filters.fromTimestamp);
    if (filters.toTimestamp) params.set('toTimestamp', filters.toTimestamp);
    if (filters.configId) params.set('configId', filters.configId);

    const data = await client.request<Record<string, unknown>>(
      'GET',
      `/api/public/v2/scores?${params.toString()}`,
    );

    const scores = (data as Record<string, unknown>).data;
    if (!scores || !Array.isArray(scores) || scores.length === 0) break;
    allScores.push(...scores);

    if (!shouldContinuePagination(data, page)) break;
    page++;
  }

  return JSON.stringify(allScores, null, 2);
}

// ─── Score Configs ──────────────────────────────────────────────────

export async function listScoreConfigs(): Promise<string> {
  const client = getClient();
  const allConfigs: unknown[] = [];
  let page = 1;

  while (true) {
    const data = await client.request<Record<string, unknown>>(
      'GET',
      `/api/public/score-configs?page=${page}`,
    );

    const configs = (data as Record<string, unknown>).data;
    if (!configs || !Array.isArray(configs) || configs.length === 0) break;
    allConfigs.push(...configs);

    if (!shouldContinuePagination(data, page)) break;
    page++;
  }

  return JSON.stringify(allConfigs, null, 2);
}

export async function getScoreConfig(configId: string): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', `/api/public/score-configs/${configId}`);
  return JSON.stringify(result, null, 2);
}

export async function createScoreConfig(params: {
  name: string;
  dataType: 'NUMERIC' | 'CATEGORICAL' | 'BOOLEAN';
  description?: string;
  categories?: Array<{ label: string; value: number }>;
  minValue?: number;
  maxValue?: number;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = {
    name: params.name,
    dataType: params.dataType,
  };

  if (params.description) data.description = params.description;
  if (params.categories) data.categories = params.categories;
  if (params.minValue !== undefined) data.minValue = params.minValue;
  if (params.maxValue !== undefined) data.maxValue = params.maxValue;

  const result = await client.request<unknown>('POST', '/api/public/score-configs', data);
  return JSON.stringify(result, null, 2);
}

export async function exportScoreConfigs(outputFile: string): Promise<string> {
  const configsRaw = await listScoreConfigs();
  const configs = JSON.parse(configsRaw) as Record<string, unknown>[];

  const exported = configs.map((c) => ({
    name: c.name,
    dataType: c.dataType,
    description: c.description,
    categories: c.categories,
    minValue: c.minValue,
    maxValue: c.maxValue,
    metadata: {
      id: c.id,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      projectId: c.projectId,
      isArchived: c.isArchived,
    },
  }));

  const exportData = {
    version: '1.0',
    exportedAt: nowISO(),
    totalConfigs: exported.length,
    configs: exported,
  };

  const json = JSON.stringify(exportData, null, 2);
  if (outputFile) {
    writeFileSync(outputFile, json, 'utf-8');
  }
  return json;
}

export async function importScoreConfigs(
  importFile: string,
  options?: { allowDuplicates?: boolean; selectedConfigs?: string[] },
): Promise<string> {
  let importData: Record<string, unknown>;
  try {
    importData = JSON.parse(readFileSync(importFile, 'utf-8')) as Record<string, unknown>;
  } catch (e) {
    return `❌ Failed to read import file: ${e}`;
  }

  const configsList = Array.isArray(importData)
    ? importData
    : (importData.configs as unknown[]) ?? [];

  if (!configsList.length) return '❌ No score configs found in import file.';

  const existingRaw = await listScoreConfigs();
  const existing = JSON.parse(existingRaw) as Record<string, unknown>[];
  const existingNames = new Set(existing.map((c) => String(c.name).toLowerCase()));

  const selected = options?.selectedConfigs
    ? new Set(options.selectedConfigs.map((n) => n.toLowerCase()))
    : null;

  const results: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const raw of configsList) {
    const cfg = raw as Record<string, unknown>;
    const name = String(cfg.name);

    if (selected && !selected.has(name.toLowerCase())) continue;
    if (existingNames.has(name.toLowerCase()) && !options?.allowDuplicates) {
      results.push(`   ⏭️ '${name}' — skipped (duplicate)`);
      skipped++;
      continue;
    }

    try {
      const result = await createScoreConfig({
        name,
        dataType: cfg.dataType as 'NUMERIC' | 'CATEGORICAL' | 'BOOLEAN',
        description: cfg.description as string | undefined,
        categories: cfg.categories as Array<{ label: string; value: number }> | undefined,
        minValue: cfg.minValue as number | undefined,
        maxValue: cfg.maxValue as number | undefined,
      });
      const parsed = JSON.parse(result);
      results.push(`   ✅ '${name}' (ID: ${parsed.id ?? 'created'})`);
      imported++;
    } catch (e) {
      results.push(`   ❌ '${name}' — ${e}`);
    }
  }

  return [
    `📁 Import: ${importFile}`,
    `📊 Summary: ${imported} imported, ${skipped} skipped`,
    ...results,
  ].join('\n');
}

// ─── Score Config Caching / Apply ───────────────────────────────────

export async function applyScoreConfig(
  configNameOrId: string,
  targetType: string,
  targetId: string,
  value: number,
  observationId?: string,
  comment?: string,
): Promise<string> {
  // Resolve config: try by ID first, then search by name
  let configId: string | undefined;

  try {
    const configJson = await getScoreConfig(configNameOrId);
    const config = JSON.parse(configJson);
    if (config.id) configId = config.id;
  } catch {
    // Try listing and searching by name
    const allJson = await listScoreConfigs();
    const all = JSON.parse(allJson) as Record<string, unknown>[];
    const match = all.find(
      (c) => String(c.name).toLowerCase() === configNameOrId.toLowerCase(),
    );
    if (match) configId = String(match.id);
  }

  if (!configId) {
    return JSON.stringify({ error: `Score config '${configNameOrId}' not found` });
  }

  return createScoreForTarget({
    targetType: targetType as 'trace' | 'session',
    targetId,
    configId,
    value,
    observationId,
    comment,
  });
}

// ─── Presets ────────────────────────────────────────────────────────

export function getBuiltInPresets(): ScoreConfig[] {
  return BUILT_IN_PRESETS.map((p) => ({ ...p }));
}

export async function installPreset(
  name: string,
  checkDuplicates = true,
): Promise<string> {
  const preset = BUILT_IN_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!preset) {
    return JSON.stringify({ error: `Preset '${name}' not found` });
  }

  if (checkDuplicates) {
    const existingRaw = await listScoreConfigs();
    const existing = JSON.parse(existingRaw) as Record<string, unknown>[];
    const dup = existing.find((c) => String(c.name).toLowerCase() === preset.name.toLowerCase());
    if (dup) {
      return JSON.stringify({
        warning: `Score config '${preset.name}' already exists (ID: ${dup.id})`,
        existingId: dup.id,
      });
    }
  }

  return createScoreConfig({
    name: preset.name,
    dataType: preset.dataType,
    description: preset.description,
    categories: preset.categories,
    minValue: preset.minValue,
    maxValue: preset.maxValue,
  });
}

// ─── Formatters ─────────────────────────────────────────────────────

export function formatScoresTable(json: unknown): string {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    const scores: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!scores.length) return 'No scores found.';

    const headers = ['ID', 'Name', 'Value', 'Created', 'Trace ID'];
    const rows = scores.map((s) => [
      trunc(String(s.id ?? 'N/A'), 20),
      trunc(String(s.name ?? 'N/A'), 20),
      String(s.value ?? 'N/A'),
      String(s.createdAt ?? 'N/A').slice(0, 16),
      trunc(String(s.traceId ?? 'N/A'), 20),
    ]);

    return formatTable(headers, rows) + `\nTotal scores: ${scores.length}`;
  } catch (e) {
    return `Error formatting scores: ${e}`;
  }
}

export function formatScoreConfigsTable(json: unknown): string {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    const configs: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!configs.length) return 'No score configs found.';

    const headers = ['ID', 'Name', 'Data Type', 'Description', 'Created'];
    const rows = configs.map((c) => [
      trunc(String(c.id ?? 'N/A'), 20),
      trunc(String(c.name ?? 'N/A'), 20),
      String(c.dataType ?? 'N/A'),
      trunc(String(c.description ?? 'N/A'), 35),
      String(c.createdAt ?? 'N/A').slice(0, 16),
    ]);

    return formatTable(headers, rows) + `\nTotal score configs: ${configs.length}`;
  } catch (e) {
    return `Error formatting score configs: ${e}`;
  }
}

// ─── Built-in Presets ───────────────────────────────────────────────

const BUILT_IN_PRESETS: ScoreConfig[] = [
  // Narrative & Storytelling
  { name: 'Narrative Coherence', dataType: 'CATEGORICAL', description: 'Evaluates how well story elements connect and flow together logically.', categories: [{ label: 'Incoherent', value: 1 }, { label: 'Loosely Connected', value: 2 }, { label: 'Coherent', value: 3 }, { label: 'Well-Structured', value: 4 }, { label: 'Masterfully Woven', value: 5 }] },
  { name: 'Character Development', dataType: 'CATEGORICAL', description: 'Measures the depth and growth of characters throughout the narrative.', categories: [{ label: 'Flat/Static', value: 1 }, { label: 'Basic Development', value: 2 }, { label: 'Moderate Growth', value: 3 }, { label: 'Rich Development', value: 4 }, { label: 'Complex Evolution', value: 5 }] },
  { name: 'Emotional Resonance', dataType: 'CATEGORICAL', description: 'Evaluates the emotional impact and connection with the audience.', categories: [{ label: 'No Emotional Impact', value: 1 }, { label: 'Mild Resonance', value: 2 }, { label: 'Moderate Impact', value: 3 }, { label: 'Strong Emotional Connection', value: 4 }, { label: 'Deeply Moving', value: 5 }] },
  { name: 'Originality', dataType: 'CATEGORICAL', description: 'Evaluates the uniqueness and freshness of the ideas or expression.', categories: [{ label: 'Unoriginal', value: 1 }, { label: 'Low Originality', value: 2 }, { label: 'Moderate Originality', value: 3 }, { label: 'High Originality', value: 4 }, { label: 'Highly Original', value: 5 }] },
  { name: 'Thematic Depth', dataType: 'CATEGORICAL', description: 'Measures the depth and sophistication of underlying themes.', categories: [{ label: 'Surface Level', value: 1 }, { label: 'Basic Themes', value: 2 }, { label: 'Developed Themes', value: 3 }, { label: 'Rich Thematic Content', value: 4 }, { label: 'Profound Depth', value: 5 }] },
  // AI Response Evaluation
  { name: 'Helpfulness', dataType: 'CATEGORICAL', description: 'Measures how well the response addresses the user\'s needs.', categories: [{ label: 'Not Helpful', value: 1 }, { label: 'Slightly Helpful', value: 2 }, { label: 'Moderately Helpful', value: 3 }, { label: 'Very Helpful', value: 4 }, { label: 'Extremely Helpful', value: 5 }] },
  { name: 'Accuracy', dataType: 'CATEGORICAL', description: 'Evaluates the factual correctness and precision of information.', categories: [{ label: 'Inaccurate', value: 1 }, { label: 'Mostly Inaccurate', value: 2 }, { label: 'Partially Accurate', value: 3 }, { label: 'Mostly Accurate', value: 4 }, { label: 'Completely Accurate', value: 5 }] },
  { name: 'Safety', dataType: 'CATEGORICAL', description: 'Assesses whether the content is safe and free from harmful elements.', categories: [{ label: 'Unsafe/Harmful', value: 1 }, { label: 'Potentially Unsafe', value: 2 }, { label: 'Neutral/Safe', value: 3 }, { label: 'Very Safe', value: 4 }, { label: 'Exemplarily Safe', value: 5 }] },
  { name: 'Relevance', dataType: 'CATEGORICAL', description: 'Measures how well the response relates to the specific query.', categories: [{ label: 'Irrelevant', value: 1 }, { label: 'Slightly Relevant', value: 2 }, { label: 'Moderately Relevant', value: 3 }, { label: 'Highly Relevant', value: 4 }, { label: 'Perfectly Relevant', value: 5 }] },
  { name: 'Completeness', dataType: 'CATEGORICAL', description: 'Evaluates whether the response fully addresses all aspects.', categories: [{ label: 'Incomplete', value: 1 }, { label: 'Partially Complete', value: 2 }, { label: 'Mostly Complete', value: 3 }, { label: 'Very Complete', value: 4 }, { label: 'Comprehensive', value: 5 }] },
  // General Content
  { name: 'Clarity', dataType: 'CATEGORICAL', description: 'Measures how easy it is to understand the content.', categories: [{ label: 'Unclear', value: 1 }, { label: 'Moderately Clear', value: 2 }, { label: 'Clear', value: 3 }, { label: 'Very Clear', value: 4 }, { label: 'Excellent Clarity', value: 5 }] },
  { name: 'Engagement', dataType: 'CATEGORICAL', description: 'Evaluates how well the content captures attention.', categories: [{ label: 'Disengaging', value: 1 }, { label: 'Slightly Engaging', value: 2 }, { label: 'Engaging', value: 3 }, { label: 'Very Engaging', value: 4 }, { label: 'Highly Engaging', value: 5 }] },
  { name: 'Tone Appropriateness', dataType: 'CATEGORICAL', description: 'Assesses whether the tone matches context and audience expectations.', categories: [{ label: 'Inappropriate Tone', value: 1 }, { label: 'Somewhat Inappropriate', value: 2 }, { label: 'Acceptable Tone', value: 3 }, { label: 'Well-Matched Tone', value: 4 }, { label: 'Perfect Tone', value: 5 }] },
  { name: 'Conciseness', dataType: 'CATEGORICAL', description: 'Evaluates the efficiency of communication.', categories: [{ label: 'Verbose/Wordy', value: 1 }, { label: 'Somewhat Verbose', value: 2 }, { label: 'Balanced', value: 3 }, { label: 'Concise', value: 4 }, { label: 'Perfectly Concise', value: 5 }] },
  // Technical Quality
  { name: 'Structure & Organization', dataType: 'CATEGORICAL', description: 'Evaluates the logical organization and structural quality.', categories: [{ label: 'Disorganized', value: 1 }, { label: 'Basic Structure', value: 2 }, { label: 'Well-Organized', value: 3 }, { label: 'Excellent Structure', value: 4 }, { label: 'Masterful Organization', value: 5 }] },
  { name: 'Language Quality', dataType: 'CATEGORICAL', description: 'Assesses grammar, vocabulary usage, and linguistic competence.', categories: [{ label: 'Poor Language', value: 1 }, { label: 'Fair Language', value: 2 }, { label: 'Good Language', value: 3 }, { label: 'Excellent Language', value: 4 }, { label: 'Exceptional Language', value: 5 }] },
  // Specialized
  { name: 'Critical Thinking', dataType: 'CATEGORICAL', description: 'Measures the depth of analysis, reasoning, and intellectual rigor.', categories: [{ label: 'No Critical Analysis', value: 1 }, { label: 'Basic Analysis', value: 2 }, { label: 'Sound Reasoning', value: 3 }, { label: 'Strong Critical Thinking', value: 4 }, { label: 'Exceptional Analysis', value: 5 }] },
  { name: 'Evidence Support', dataType: 'CATEGORICAL', description: 'Evaluates the use and quality of supporting evidence.', categories: [{ label: 'No Evidence', value: 1 }, { label: 'Weak Evidence', value: 2 }, { label: 'Adequate Evidence', value: 3 }, { label: 'Strong Evidence', value: 4 }, { label: 'Compelling Evidence', value: 5 }] },
  { name: 'Innovation', dataType: 'CATEGORICAL', description: 'Assesses creativity and novel approaches in problem-solving.', categories: [{ label: 'Conventional', value: 1 }, { label: 'Slightly Creative', value: 2 }, { label: 'Moderately Innovative', value: 3 }, { label: 'Highly Innovative', value: 4 }, { label: 'Groundbreaking', value: 5 }] },
  // Numeric
  { name: 'Overall Quality', dataType: 'NUMERIC', description: 'General numeric assessment of overall content quality.', minValue: 0, maxValue: 10 },
  { name: 'Performance Score', dataType: 'NUMERIC', description: 'Numeric performance evaluation score.', minValue: 0, maxValue: 100 },
  // Boolean
  { name: 'Meets Requirements', dataType: 'BOOLEAN', description: 'Binary assessment of whether content meets specified requirements.' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function shouldContinuePagination(data: Record<string, unknown>, currentPage: number): boolean {
  const meta = data.meta as Record<string, unknown> | undefined;
  if (meta?.totalPages) {
    return (meta.page as number ?? currentPage) < (meta.totalPages as number);
  }
  if (data.hasNextPage) return true;
  if (data.totalPages && currentPage < (data.totalPages as number)) return true;
  return false;
}

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

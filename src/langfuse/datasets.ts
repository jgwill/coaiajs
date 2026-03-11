// coaiajs/src/langfuse/datasets.ts — Dataset operations
// Port of cofuse.py dataset functions

import { getClient } from './client.js';

export async function listDatasets(): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', '/api/public/v2/datasets');
  return JSON.stringify(result, null, 2);
}

export async function getDataset(name: string): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>(
    'GET',
    `/api/public/v2/datasets/${encodeURIComponent(name)}`,
  );
  return JSON.stringify(result, null, 2);
}

export async function createDataset(params: {
  name: string;
  description?: string;
  metadata?: unknown;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = { name: params.name };

  if (params.description) data.description = params.description;
  if (params.metadata) {
    data.metadata = typeof params.metadata === 'string'
      ? safeParseJSON(params.metadata)
      : params.metadata;
  }

  const result = await client.request<unknown>('POST', '/api/public/v2/datasets', data);
  return JSON.stringify(result, null, 2);
}

export async function listDatasetItems(name: string): Promise<string> {
  const client = getClient();
  const allItems: unknown[] = [];
  let page = 1;

  while (true) {
    const data = await client.request<Record<string, unknown>>(
      'GET',
      `/api/public/dataset-items?name=${encodeURIComponent(name)}&page=${page}`,
    );

    const items = (data as Record<string, unknown>).data;
    if (!items || !Array.isArray(items) || items.length === 0) break;
    allItems.push(...items);

    const meta = (data as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    if (!meta || (meta.page as number ?? page) >= (meta.totalPages as number ?? 1)) break;
    page++;
  }

  return JSON.stringify(allItems, null, 2);
}

export async function createDatasetItem(params: {
  datasetName: string;
  input: unknown;
  expectedOutput?: unknown;
  metadata?: unknown;
  sourceTraceId?: string;
  sourceObservationId?: string;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = {
    datasetName: params.datasetName,
    input: params.input,
  };

  if (params.expectedOutput !== undefined) data.expectedOutput = params.expectedOutput;
  if (params.metadata) data.metadata = params.metadata;
  if (params.sourceTraceId) data.sourceTraceId = params.sourceTraceId;
  if (params.sourceObservationId) data.sourceObservationId = params.sourceObservationId;

  const result = await client.request<unknown>('POST', '/api/public/dataset-items', data);
  return JSON.stringify(result, null, 2);
}

// ─── Formatters ─────────────────────────────────────────────────────

export function formatDatasetsTable(json: unknown): string {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    const datasets: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!datasets.length) return 'No datasets found.';

    const headers = ['Name', 'Description', 'Items', 'Created'];
    const rows = datasets.map((d) => [
      trunc(String(d.name ?? 'N/A'), 25),
      trunc(String(d.description ?? 'N/A'), 30),
      String(d.items?.toString() ?? 'N/A'),
      String(d.createdAt ?? 'N/A').slice(0, 10),
    ]);

    return formatTable(headers, rows) + `\nTotal datasets: ${datasets.length}`;
  } catch (e) {
    return `Error formatting datasets: ${e}`;
  }
}

export function formatDatasetForFinetuning(
  items: unknown,
  format: 'openai' | 'gemini',
  systemInstruction?: string,
): string {
  try {
    const parsed = (typeof items === 'string' ? JSON.parse(items) : items) as Record<string, unknown>[];
    const sysInstr = systemInstruction ?? 'You are a helpful assistant.';
    const lines: string[] = [];

    for (const item of parsed) {
      const input = item.input;
      const output = item.expectedOutput;
      if (!input || !output) continue;

      if (format === 'openai') {
        lines.push(JSON.stringify({
          messages: [
            { role: 'system', content: sysInstr },
            { role: 'user', content: input },
            { role: 'assistant', content: output },
          ],
        }));
      } else {
        lines.push(JSON.stringify({
          systemInstruction: {
            role: 'system',
            parts: [{ text: sysInstr }],
          },
          contents: [
            { role: 'user', parts: [{ text: input }] },
            { role: 'model', parts: [{ text: output }] },
          ],
        }));
      }
    }

    return lines.join('\n');
  } catch (e) {
    return `Error formatting for fine-tuning: ${e}`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function trunc(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 3) + '...' : s;
}

function safeParseJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { note: s };
  }
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

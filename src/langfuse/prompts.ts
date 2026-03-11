// coaiajs/src/langfuse/prompts.ts — Prompt operations
// Port of cofuse.py prompt functions

import { getClient } from './client.js';

export async function listPrompts(): Promise<string> {
  const client = getClient();
  const allPrompts: unknown[] = [];
  let page = 1;

  while (true) {
    const data = await client.request<Record<string, unknown>>(
      'GET',
      `/api/public/v2/prompts?page=${page}`,
    );

    const prompts = (data as Record<string, unknown>).data;
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) break;
    allPrompts.push(...prompts);

    const meta = (data as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    if (meta?.totalPages && (meta.page as number ?? page) >= (meta.totalPages as number)) break;
    if (!(data as Record<string, unknown>).hasNextPage && !meta?.totalPages) break;
    page++;
  }

  return JSON.stringify(allPrompts, null, 2);
}

export async function getPrompt(name: string, label?: string): Promise<string> {
  const client = getClient();
  const params = label ? `?label=${encodeURIComponent(label)}` : '';
  const result = await client.request<unknown>(
    'GET',
    `/api/public/v2/prompts/${encodeURIComponent(name)}${params}`,
  );
  return JSON.stringify(result, null, 2);
}

export async function createPrompt(params: {
  name: string;
  content: string | unknown[];
  commitMessage?: string;
  labels?: string[];
  tags?: string[];
  promptType?: 'text' | 'chat';
  config?: Record<string, unknown>;
}): Promise<string> {
  const client = getClient();

  const data: Record<string, unknown> = {
    type: params.promptType ?? 'text',
    name: params.name,
    prompt: params.content,
  };

  if (params.commitMessage) data.commitMessage = params.commitMessage;
  if (params.labels) data.labels = params.labels;
  if (params.tags) data.tags = params.tags;
  if (params.config) data.config = params.config;

  const result = await client.request<unknown>('POST', '/api/public/v2/prompts', data);
  return JSON.stringify(result, null, 2);
}

// ─── Formatters ─────────────────────────────────────────────────────

export function formatPromptsTable(json: unknown): string {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    const prompts: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).data as Record<string, unknown>[] ?? [];

    if (!prompts.length) return 'No prompts found.';

    const headers = ['Name', 'Version', 'Created', 'Tags/Labels'];
    const rows = prompts.map((p) => [
      trunc(String(p.name ?? 'N/A'), 30),
      String(p.version ?? 'N/A'),
      String(p.createdAt ?? 'N/A').slice(0, 10),
      ((p.labels as string[]) ?? []).join(', ') || 'None',
    ]);

    return formatTable(headers, rows) + `\nTotal prompts: ${prompts.length}`;
  } catch (e) {
    return `Error formatting prompts: ${e}`;
  }
}

export function formatPromptDisplay(json: unknown): string {
  try {
    const prompt = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>;
    if ('error' in prompt) return `Error: ${prompt.error}`;

    const name = String(prompt.name ?? 'Unnamed');
    const version = String(prompt.version ?? 'N/A');
    const type = String(prompt.type ?? 'text');
    const isActive = Boolean(prompt.isActive);
    const created = String(prompt.createdAt ?? 'N/A').slice(0, 19);
    const updated = String(prompt.updatedAt ?? 'N/A').slice(0, 19);
    const labels = (prompt.labels as string[]) ?? [];
    const tags = (prompt.tags as string[]) ?? [];
    const commitMsg = String(prompt.commitMessage ?? '');
    const config = prompt.config as Record<string, unknown> | undefined;
    const content = String(prompt.prompt ?? '');

    const header = `🎯 PROMPT: ${name}${version !== 'N/A' ? ` (v${version})` : ''}`;
    const sep = '='.repeat(header.length);

    const lines = [sep, header, sep, ''];
    lines.push('📋 METADATA:');
    lines.push(`   Type: ${type}`);
    lines.push(`   Active: ${isActive ? '✅ Yes' : '❌ No'}`);
    lines.push(`   Created: ${created}`);
    lines.push(`   Updated: ${updated}`);
    lines.push(`   Labels: ${labels.length ? labels.join(', ') : 'None'}`);
    if (tags.length) lines.push(`   Tags: ${tags.join(', ')}`);
    if (commitMsg) lines.push(`   Commit: ${commitMsg}`);
    lines.push('');

    if (config && Object.keys(config).length) {
      lines.push('⚙️ CONFIGURATION:');
      for (const [k, v] of Object.entries(config)) {
        lines.push(`   ${k}: ${v}`);
      }
      lines.push('');
    }

    lines.push('📝 PROMPT CONTENT:');
    lines.push('-'.repeat(50));
    lines.push(content || '(No content)');
    lines.push('-'.repeat(50));

    return lines.join('\n');
  } catch (e) {
    return `Error formatting prompt: ${e}`;
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

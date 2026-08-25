import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { formatPromptMarkdown, getPrompt, resetClient } from '../dist/src/langfuse/index.js';

test('getPrompt builds label and version selectors without serializing option objects', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(new URL(String(url)));
    return new Response(JSON.stringify({ prompt: 'found' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    resetClient();
    await getPrompt('prompt/name');
    await getPrompt('prompt/name', { label: 'production' });
    await getPrompt('prompt/name', { version: 3 });
    await getPrompt('prompt/name', 'latest');
    await getPrompt('prompt/name', 4);
  } finally {
    globalThis.fetch = originalFetch;
    resetClient();
  }

  assert.deepEqual(
    requestedUrls.map((url) => `${url.pathname}${url.search}`),
    [
      '/api/public/v2/prompts/prompt%2Fname',
      '/api/public/v2/prompts/prompt%2Fname?label=production',
      '/api/public/v2/prompts/prompt%2Fname?version=3',
      '/api/public/v2/prompts/prompt%2Fname?label=latest',
      '/api/public/v2/prompts/prompt%2Fname?version=4',
    ],
  );
  assert.ok(requestedUrls.every((url) => !url.href.includes('%5Bobject+Object%5D')));
});

test('formatPromptMarkdown renders text prompt metadata, content, and configuration', () => {
  const markdown = formatPromptMarkdown({
    name: 'review-code',
    version: 7,
    type: 'text',
    labels: ['production'],
    tags: ['engineering'],
    prompt: 'Review the following code:\n\n{{code}}',
    config: { model: 'gpt-4.1' },
  });

  assert.match(markdown, /^# review-code \(v7\)$/m);
  assert.match(markdown, /^- \*\*Labels:\*\* production$/m);
  assert.match(markdown, /^## Prompt$/m);
  assert.match(markdown, /Review the following code:\n\n\{\{code\}\}/);
  assert.match(markdown, /^## Configuration$/m);
  assert.match(markdown, /"model": "gpt-4.1"/);
});

test('formatPromptMarkdown renders chat messages as Markdown sections', () => {
  const markdown = formatPromptMarkdown({
    name: 'assistant',
    type: 'chat',
    prompt: [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: '{{question}}' },
    ],
  });

  assert.match(markdown, /^### System$/m);
  assert.match(markdown, /^Be concise\.$/m);
  assert.match(markdown, /^### User$/m);
  assert.match(markdown, /^\{\{question\}\}$/m);
});

test('prompt get help exposes explicit Markdown output option', () => {
  const cli = fileURLToPath(new URL('../dist/src/cli.js', import.meta.url));
  const help = execFileSync(process.execPath, [cli, 'fuse', 'prompts', 'get', '--help'], {
    encoding: 'utf8',
  });

  assert.match(help, /--md\s+Markdown output \(default\)/);
});

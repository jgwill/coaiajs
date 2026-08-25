import assert from 'node:assert/strict';
import test from 'node:test';

import { getPrompt, resetClient } from '../dist/src/langfuse/index.js';

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

// coaiajs/src/langfuse/projects.ts — Project operations

import { getClient } from './client.js';

export async function listProjects(): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', '/api/public/projects');
  return JSON.stringify(result, null, 2);
}

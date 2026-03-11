// coaiajs/src/langfuse/comments.ts — Comment operations
// Port of cofuse.py comment functions

import { getClient } from './client.js';

export interface CommentFilters {
  objectType?: string;
  objectId?: string;
  authorUserId?: string;
  page?: number;
  limit?: number;
}

export async function listComments(filters: CommentFilters): Promise<string> {
  const client = getClient();
  const params = new URLSearchParams();

  if (filters.objectType) params.set('objectType', filters.objectType);
  if (filters.objectId) params.set('objectId', filters.objectId);
  if (filters.authorUserId) params.set('authorUserId', filters.authorUserId);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 50));

  const qs = params.toString();
  const result = await client.request<unknown>('GET', `/api/public/comments?${qs}`);
  return JSON.stringify(result, null, 2);
}

export async function getComment(commentId: string): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', `/api/public/comments/${commentId}`);
  return JSON.stringify(result, null, 2);
}

export async function createComment(params: {
  text: string;
  objectType: string;
  objectId: string;
  authorUserId?: string;
}): Promise<string> {
  const client = getClient();
  const data: Record<string, unknown> = {
    content: params.text,
    objectType: params.objectType,
    objectId: params.objectId,
  };

  if (params.authorUserId) data.authorUserId = params.authorUserId;

  const result = await client.request<unknown>('POST', '/api/public/comments', data);
  return JSON.stringify(result, null, 2);
}

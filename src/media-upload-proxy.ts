#!/usr/bin/env node
// coaiajs/src/media-upload-proxy.ts — Custom GPT file-to-Langfuse media bridge

import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { uploadMediaBytes, type UploadMediaBytesResult } from './langfuse/media.js';

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_BODY_BYTES = 1024 * 1024;
const DEFAULT_OPENAI_FILE_HOSTS = ['files.oaiusercontent.com', 'files.openai.com'];

export interface OpenAIFileReference {
  name: string;
  id: string;
  mime_type: string;
  download_link: string;
}

export interface MediaUploadProxyRequest {
  openaiFileIdRefs: unknown[];
  traceId?: string;
  observationId?: string;
  datasetId?: string;
  datasetItemId?: string;
  field?: 'input' | 'output' | 'expectedOutput' | 'metadata';
}

export interface MediaUploadProxyOptions {
  apiKey?: string;
  maxFileBytes?: number;
  maxBodyBytes?: number;
  openAIFileHosts?: string[];
}

export interface MediaUploadProxyResult extends UploadMediaBytesResult {
  openaiFileId: string;
}

/** Download one Custom GPT conversation file and complete the Langfuse media upload flow. */
export async function uploadOpenAIFileToLangfuse(
  input: MediaUploadProxyRequest,
  options: MediaUploadProxyOptions = {},
): Promise<MediaUploadProxyResult> {
  if (!Array.isArray(input.openaiFileIdRefs) || input.openaiFileIdRefs.length !== 1) {
    throw new Error('openaiFileIdRefs must contain exactly one conversation file');
  }
  const file = parseOpenAIFileReference(input.openaiFileIdRefs[0]);
  const allowedHosts = options.openAIFileHosts ?? configuredOpenAIFileHosts();
  const bytes = await downloadFile(file.download_link, options.maxFileBytes ?? configuredMaxFileBytes(), allowedHosts);
  const result = await uploadMediaBytes({
    data: bytes,
    fileName: file.name,
    contentType: detectDownloadedContentType(bytes, file.mime_type),
    traceId: input.traceId,
    observationId: input.observationId,
    datasetId: input.datasetId,
    datasetItemId: input.datasetItemId,
    field: input.field,
    source: 'bytes',
  });
  return { ...result, openaiFileId: file.id };
}

/** Create the small HTTP service used by the companion Custom GPT action spec. */
export function createMediaUploadProxyServer(options: MediaUploadProxyOptions = {}): Server {
  const apiKey = options.apiKey ?? process.env['COAIA_MEDIA_PROXY_API_KEY'];
  if (!apiKey) throw new Error('COAIA_MEDIA_PROXY_API_KEY is required');
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_BODY_BYTES;

  return createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.method !== 'POST' || request.url !== '/media/upload') {
        sendJson(response, 404, { error: 'Not found' });
        return;
      }
      if (!secureEqual(request.headers['x-coaia-proxy-key'], apiKey)) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await readJsonBody(request, maxBodyBytes) as MediaUploadProxyRequest;
      const result = await uploadOpenAIFileToLangfuse(body, options);
      sendJson(response, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /too large/i.test(message) ? 413 : 400;
      sendJson(response, status, { error: message });
    }
  });
}

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentType = String(request.headers['content-type'] ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) throw new Error('Content-Type must be application/json');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) throw new Error(`Request body is too large (maximum ${maxBytes} bytes)`);
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('Request body must contain valid JSON');
  }
}

function parseOpenAIFileReference(value: unknown): OpenAIFileReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Custom GPT did not provide a runtime file reference object');
  }
  const record = value as Record<string, unknown>;
  const file = {
    name: record.name,
    id: record.id,
    mime_type: record.mime_type,
    download_link: record.download_link,
  };
  for (const [key, item] of Object.entries(file)) {
    if (typeof item !== 'string' || !item) throw new Error(`Conversation file reference is missing ${key}`);
  }
  return file as OpenAIFileReference;
}

async function downloadFile(urlValue: string, maxBytes: number, allowedHosts: string[]): Promise<Buffer> {
  let url = validateDownloadUrl(urlValue, allowedHosts);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Conversation file redirect did not include a location');
      url = validateDownloadUrl(new URL(location, url).toString(), allowedHosts);
      continue;
    }
    if (!response.ok || !response.body) {
      throw new Error(`Unable to download conversation file (HTTP ${response.status})`);
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxBytes) throw new Error(`Conversation file is too large (maximum ${maxBytes} bytes)`);

    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`Conversation file is too large (maximum ${maxBytes} bytes)`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Conversation file download exceeded the redirect limit');
}

function validateDownloadUrl(value: string, allowedHosts: string[]): URL {
  const url = new URL(value);
  const allowHttp = process.env['COAIA_MEDIA_ALLOW_HTTP'] === 'true';
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new Error(`Conversation file URL protocol '${url.protocol}' is not allowed`);
  }
  if (!isAllowedHost(url.hostname, allowedHosts)) {
    throw new Error(`Conversation file URL domain '${url.hostname}' is not allowed`);
  }
  if (url.username || url.password) throw new Error('Conversation file URL credentials are not allowed');
  return url;
}

function detectDownloadedContentType(bytes: Buffer, declaredType: string): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const prefix = bytes.subarray(0, 6).toString('ascii');
  if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return declaredType;
}

function configuredOpenAIFileHosts(): string[] {
  const extra = (process.env['COAIA_OPENAI_FILE_HOSTS'] ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_OPENAI_FILE_HOSTS, ...extra];
}

function configuredMaxFileBytes(): number {
  const configured = Number(process.env['COAIA_MEDIA_MAX_BYTES']);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_FILE_BYTES;
}

function isAllowedHost(hostname: string, allowedHosts: string[]): boolean {
  const lower = hostname.toLowerCase();
  return allowedHosts.some((host) => lower === host || lower.endsWith(`.${host}`));
}

function secureEqual(actual: string | string[] | undefined, expected: string): boolean {
  if (!actual || Array.isArray(actual)) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export async function startMediaUploadProxy(): Promise<Server> {
  const port = Number(process.env['PORT'] ?? process.env['COAIA_MEDIA_PROXY_PORT'] ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid proxy port: ${port}`);
  const server = createMediaUploadProxyServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve());
  });
  console.log(`coaiajs media upload proxy listening on port ${port}`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startMediaUploadProxy().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

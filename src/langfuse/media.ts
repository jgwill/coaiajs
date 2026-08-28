// coaiajs/src/langfuse/media.ts — Media upload operations
// Port of cofuse.py media functions

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { getClient } from './client.js';

const SUPPORTED_CONTENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml',
  'image/tiff', 'image/bmp', 'image/avif', 'image/heic',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/oga', 'audio/aac',
  'audio/mp4', 'audio/flac', 'audio/opus', 'audio/webm',
  'video/mp4', 'video/webm', 'video/ogg', 'video/mpeg', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska',
  'text/plain', 'text/html', 'text/css', 'text/csv', 'text/markdown',
  'text/x-python', 'text/x-typescript',
  'application/javascript', 'application/x-yaml', 'application/pdf', 'application/msword',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/json', 'application/xml', 'application/octet-stream',
  'application/rtf', 'application/x-ndjson', 'application/vnd.apache.parquet',
  'application/gzip', 'application/x-tar', 'application/x-7z-compressed',
]);

const EXTENSION_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff', '.tif': 'image/tiff', '.bmp': 'image/bmp',
  '.avif': 'image/avif', '.heic': 'image/heic',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.weba': 'audio/webm',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.csv': 'text/csv',
  '.json': 'application/json', '.xml': 'application/xml', '.md': 'text/markdown',
  '.py': 'text/x-python', '.ts': 'text/x-typescript', '.yaml': 'application/x-yaml', '.yml': 'application/x-yaml',
  '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip', '.gz': 'application/gzip', '.tar': 'application/x-tar',
  '.7z': 'application/x-7z-compressed', '.parquet': 'application/vnd.apache.parquet',
};

const TRUSTED_DOMAINS = [
  'amazonaws.com',
  's3.amazonaws.com',
  'storage.googleapis.com',
  'blob.core.windows.net',
  'r2.cloudflarestorage.com',
];

export type MediaSource = 'bytes' | 'file' | 'base64_data_uri';

export interface UploadMediaBytesInput {
  data: Uint8Array;
  contentType: string;
  fileName?: string;
  traceId?: string;
  observationId?: string;
  datasetId?: string;
  datasetItemId?: string;
  field?: 'input' | 'output' | 'expectedOutput' | 'metadata';
  source?: MediaSource;
}

export interface UploadMediaBytesResult {
  success: boolean;
  mediaId: string;
  mediaToken: string;
  fileName?: string;
  contentType: string;
  contentLength: number;
  sha256Hash: string;
  traceId?: string;
  observationId?: string;
  datasetId?: string;
  datasetItemId?: string;
  field: string;
  uploadTimeMs: number;
  alreadyUploaded: boolean;
}

/** Upload exact bytes through Langfuse's presigned object-storage flow. */
export async function uploadMediaBytes(params: UploadMediaBytesInput): Promise<UploadMediaBytesResult> {
  const data = Buffer.from(params.data);
  const field = params.field ?? 'input';
  const source = params.source ?? 'bytes';
  if (!data.length) throw new Error('Media data must not be empty');
  if (!SUPPORTED_CONTENT_TYPES.has(params.contentType)) {
    throw new Error(`Unsupported content type: ${params.contentType}`);
  }

  const hasTraceContext = Boolean(params.traceId) && !params.datasetId && !params.datasetItemId;
  const hasDatasetContext = Boolean(params.datasetId && params.datasetItemId) && !params.traceId && !params.observationId;
  if (!hasTraceContext && !hasDatasetContext) {
    throw new Error('Provide traceId (optionally observationId) or both datasetId and datasetItemId');
  }
  if (params.observationId && !params.traceId) {
    throw new Error('observationId requires traceId');
  }

  const sha256Hash = createHash('sha256').update(data).digest('base64');
  const uploadRequest: Record<string, unknown> = {
    contentType: params.contentType,
    contentLength: data.byteLength,
    sha256Hash,
    field,
  };
  if (params.traceId) uploadRequest.traceId = params.traceId;
  if (params.observationId) uploadRequest.observationId = params.observationId;
  if (params.datasetId) uploadRequest.datasetId = params.datasetId;
  if (params.datasetItemId) uploadRequest.datasetItemId = params.datasetItemId;

  const client = getClient();
  const uploadInfo = await client.request<Record<string, unknown>>('POST', '/api/public/media', uploadRequest);
  const mediaId = typeof uploadInfo.mediaId === 'string' ? uploadInfo.mediaId : '';
  const uploadUrl = typeof uploadInfo.uploadUrl === 'string' ? uploadInfo.uploadUrl : undefined;
  if (!mediaId) throw new Error('Langfuse did not return a mediaId');

  let uploadTimeMs = 0;
  if (uploadUrl) {
    validateUploadUrl(uploadUrl);
    const startTime = Date.now();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': params.contentType,
        'Content-Length': String(data.byteLength),
        'x-amz-checksum-sha256': sha256Hash,
      },
      body: data,
    });
    uploadTimeMs = Date.now() - startTime;
    const uploadHttpError = uploadResponse.ok ? undefined : (await uploadResponse.text()).slice(0, 1000);

    await client.request('PATCH', `/api/public/media/${mediaId}`, {
      uploadHttpStatus: uploadResponse.status,
      uploadHttpError,
      uploadTimeMs,
      uploadedAt: new Date().toISOString(),
    });
    if (!uploadResponse.ok) {
      throw new Error(`Media upload failed with HTTP ${uploadResponse.status}: ${uploadHttpError ?? ''}`.trim());
    }
  }

  return {
    success: true,
    mediaId,
    mediaToken: `@@@langfuseMedia:type=${params.contentType}|id=${mediaId}|source=${source}@@@`,
    fileName: params.fileName,
    contentType: params.contentType,
    contentLength: data.byteLength,
    sha256Hash,
    traceId: params.traceId,
    observationId: params.observationId,
    datasetId: params.datasetId,
    datasetItemId: params.datasetItemId,
    field,
    uploadTimeMs,
    alreadyUploaded: !uploadUrl,
  };
}

export async function uploadAndAttachMedia(params: {
  filePath: string;
  traceId: string;
  field?: string;
  observationId?: string;
  contentType?: string;
}): Promise<string> {
  const result = await uploadMediaBytes({
    data: readFileSync(params.filePath),
    fileName: basename(params.filePath),
    contentType: params.contentType ?? detectContentType(params.filePath),
    traceId: params.traceId,
    observationId: params.observationId,
    field: normalizeMediaField(params.field),
    source: 'file',
  });
  return JSON.stringify(result, null, 2);
}

export async function getMedia(mediaId: string): Promise<string> {
  const client = getClient();
  const result = await client.request<unknown>('GET', `/api/public/media/${mediaId}`);
  return JSON.stringify(result, null, 2);
}

export function detectContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? 'application/octet-stream';
}

export function formatMediaDisplay(json: unknown): string {
  try {
    const media = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>;
    if ('error' in media) return `Error: ${media.error}`;

    const contentType = String(media.contentType ?? 'unknown');
    let glyph = '📎';
    if (contentType.startsWith('image/')) glyph = '🖼️';
    else if (contentType.startsWith('video/')) glyph = '🎥';
    else if (contentType.startsWith('audio/')) glyph = '🎵';
    else if (contentType === 'application/pdf') glyph = '📄';

    const lines: string[] = [];
    lines.push(`${glyph} Media: ${media.fileName ?? 'Unnamed'}`);
    lines.push(`├── 🆔 ID: ${media.id ?? media.mediaId ?? 'N/A'}`);
    lines.push(`├── 📝 Content Type: ${contentType}`);
    lines.push(`├── 📏 Size: ${media.contentLength ?? 0} bytes`);
    lines.push(`├── 🔗 Trace ID: ${media.traceId ?? 'N/A'}`);

    if (media.observationId) lines.push(`├── 👁️ Observation ID: ${media.observationId}`);
    if (media.field) lines.push(`├── 🏷️ Field: ${media.field}`);
    if (media.uploadedAt) lines.push(`├── ⏰ Uploaded: ${String(media.uploadedAt).slice(0, 19)}`);

    // Fix last line to └──
    if (lines.length > 1) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.replace('├── ', '└── ');
    }

    return lines.join('\n');
  } catch (e) {
    return `Error formatting media: ${e}`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeMediaField(value?: string): UploadMediaBytesInput['field'] {
  const field = value ?? 'input';
  if (field === 'input' || field === 'output' || field === 'expectedOutput' || field === 'metadata') return field;
  throw new Error(`Unsupported media field: ${field}`);
}

function validateUploadUrl(uploadUrl: string): void {
  const url = new URL(uploadUrl);
  const allowHttp = process.env['COAIA_MEDIA_ALLOW_HTTP'] === 'true';
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new Error(`Security: Upload URL protocol '${url.protocol}' is not allowed`);
  }
  if (!isTrustedDomain(url.hostname)) {
    throw new Error(`Security: Upload URL domain '${url.hostname}' is not trusted`);
  }
}

function isTrustedDomain(hostname: string): boolean {
  const configured = (process.env['COAIA_MEDIA_UPLOAD_HOSTS'] ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const domains = [...TRUSTED_DOMAINS, ...configured];
  const lower = hostname.toLowerCase();
  return domains.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}

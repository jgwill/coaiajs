// coaiajs/src/langfuse/media.ts — Media upload operations
// Port of cofuse.py media functions

import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { getClient } from './client.js';

const SUPPORTED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/tiff', 'image/bmp', 'image/avif',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'application/pdf',
  'text/plain', 'text/html', 'text/css', 'text/csv',
  'application/json', 'application/xml',
]);

const EXTENSION_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff', '.tif': 'image/tiff', '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.weba': 'audio/webm',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.csv': 'text/csv',
  '.json': 'application/json', '.xml': 'application/xml',
};

const TRUSTED_DOMAINS = [
  'amazonaws.com',
  's3.amazonaws.com',
  'storage.googleapis.com',
  'blob.core.windows.net',
  'r2.cloudflarestorage.com',
];

export async function uploadAndAttachMedia(params: {
  filePath: string;
  traceId: string;
  field?: string;
  observationId?: string;
  contentType?: string;
}): Promise<string> {
  const { filePath, traceId, observationId } = params;
  const field = params.field ?? 'input';

  // Detect content type
  const contentType = params.contentType ?? detectContentType(filePath);
  if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
    return JSON.stringify({ error: `Unsupported content type: ${contentType}` });
  }

  // Calculate file info
  const stat = statSync(filePath);
  const fileData = readFileSync(filePath);
  const sha256 = createHash('sha256').update(fileData).digest('base64');

  const client = getClient();

  // Step 1: Get presigned upload URL
  const uploadReqData: Record<string, unknown> = {
    traceId,
    contentType,
    contentLength: stat.size,
    sha256Hash: sha256,
    field,
  };
  if (observationId) uploadReqData.observationId = observationId;

  const uploadInfo = await client.request<Record<string, unknown>>(
    'POST',
    '/api/public/media',
    uploadReqData,
  );

  const uploadUrl = uploadInfo.uploadUrl as string;
  const mediaId = uploadInfo.mediaId as string;

  if (!uploadUrl || !mediaId) {
    return JSON.stringify({ error: 'Failed to get upload URL', detail: uploadInfo });
  }

  // Step 2: Validate upload URL domain
  const url = new URL(uploadUrl);
  if (!isTrustedDomain(url.hostname)) {
    return JSON.stringify({
      error: `Security: Upload URL domain '${url.hostname}' is not trusted`,
    });
  }

  // Step 3: Upload to presigned URL
  const startTime = Date.now();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-checksum-sha256': sha256,
    },
    body: fileData,
  });
  const uploadTimeMs = Date.now() - startTime;

  // Step 4: Patch status
  await client.request('PATCH', `/api/public/media/${mediaId}`, {
    uploadHttpStatus: uploadResponse.status,
    uploadTimeMs,
    uploadedAt: new Date().toISOString(),
  });

  if (!uploadResponse.ok) {
    return JSON.stringify({
      error: `Upload failed: ${uploadResponse.status}`,
      mediaId,
    });
  }

  // Build media token
  const token = `@@@langfuseMedia:type=${contentType}|id=${mediaId}|source=file@@@`;

  return JSON.stringify({
    success: true,
    mediaId,
    fileName: basename(filePath),
    contentType,
    contentLength: stat.size,
    traceId,
    field,
    observationId: observationId ?? null,
    uploadTimeMs,
    mediaToken: token,
  }, null, 2);
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

function isTrustedDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const domain of TRUSTED_DOMAINS) {
    if (lower === domain || lower.endsWith(`.${domain}`)) return true;
  }
  return false;
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';

import { getClient, resetClient } from '../dist/src/langfuse/index.js';
import { createMediaUploadProxyServer } from '../dist/src/media-upload-proxy.js';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('media proxy transfers the actual Custom GPT file bytes into Langfuse storage', async () => {
  const fileBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x63, 0x6f, 0x61, 0x69, 0x61,
  ]);
  const expectedHash = createHash('sha256').update(fileBytes).digest('base64');
  const captured = { mediaRequest: null, upload: null, patch: null };

  const upstream = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/conversation-file') {
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': String(fileBytes.byteLength),
      });
      response.end(fileBytes);
      return;
    }
    if (request.method === 'POST' && request.url === '/api/public/media') {
      captured.mediaRequest = JSON.parse((await readBody(request)).toString('utf8'));
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        mediaId: 'media-1',
        uploadUrl: `http://127.0.0.1:${upstream.address().port}/presigned-upload`,
      }));
      return;
    }
    if (request.method === 'PUT' && request.url === '/presigned-upload') {
      captured.upload = { headers: request.headers, body: await readBody(request) };
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.method === 'PATCH' && request.url === '/api/public/media/media-1') {
      captured.patch = JSON.parse((await readBody(request)).toString('utf8'));
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });

  const upstreamPort = await listen(upstream);
  const previousAllowHttp = process.env.COAIA_MEDIA_ALLOW_HTTP;
  const previousUploadHosts = process.env.COAIA_MEDIA_UPLOAD_HOSTS;
  process.env.COAIA_MEDIA_ALLOW_HTTP = 'true';
  process.env.COAIA_MEDIA_UPLOAD_HOSTS = '127.0.0.1';
  resetClient();
  getClient({ publicKey: 'pk-test', secretKey: 'sk-test', baseUrl: `http://127.0.0.1:${upstreamPort}` });

  const proxy = createMediaUploadProxyServer({
    apiKey: 'proxy-test-key',
    openAIFileHosts: ['127.0.0.1'],
  });
  const proxyPort = await listen(proxy);

  try {
    const unauthorized = await fetch(`http://127.0.0.1:${proxyPort}/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(unauthorized.status, 401);

    const untrusted = await fetch(`http://127.0.0.1:${proxyPort}/media/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Coaia-Proxy-Key': 'proxy-test-key',
      },
      body: JSON.stringify({
        openaiFileIdRefs: [{
          name: 'not-allowed.png',
          id: 'file-untrusted',
          mime_type: 'image/png',
          download_link: 'http://169.254.169.254/latest/meta-data',
        }],
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      }),
    });
    assert.equal(untrusted.status, 400);
    assert.match((await untrusted.json()).error, /domain .* is not allowed/);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/media/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Coaia-Proxy-Key': 'proxy-test-key',
      },
      body: JSON.stringify({
        openaiFileIdRefs: [{
          name: 'actual-user-image.png',
          id: 'file-openai-1',
          mime_type: 'image/png',
          download_link: `http://127.0.0.1:${upstreamPort}/conversation-file`,
        }],
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        observationId: '00f067aa0ba902b7',
        field: 'input',
      }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();

    assert.equal(result.success, true);
    assert.equal(result.openaiFileId, 'file-openai-1');
    assert.equal(result.contentLength, fileBytes.byteLength);
    assert.equal(result.sha256Hash, expectedHash);
    assert.equal(result.mediaToken, '@@@langfuseMedia:type=image/png|id=media-1|source=bytes@@@');

    assert.equal(captured.mediaRequest.contentType, 'image/png');
    assert.equal(captured.mediaRequest.contentLength, fileBytes.byteLength);
    assert.equal(captured.mediaRequest.sha256Hash, expectedHash);
    assert.equal(captured.mediaRequest.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
    assert.equal(captured.mediaRequest.observationId, '00f067aa0ba902b7');

    assert.deepEqual(captured.upload.body, fileBytes);
    assert.equal(captured.upload.headers['content-type'], 'image/png');
    assert.equal(captured.upload.headers['content-length'], String(fileBytes.byteLength));
    assert.equal(captured.upload.headers['x-amz-checksum-sha256'], expectedHash);
    assert.equal(captured.patch.uploadHttpStatus, 200);
    assert.equal(typeof captured.patch.uploadedAt, 'string');
  } finally {
    resetClient();
    if (previousAllowHttp === undefined) delete process.env.COAIA_MEDIA_ALLOW_HTTP;
    else process.env.COAIA_MEDIA_ALLOW_HTTP = previousAllowHttp;
    if (previousUploadHosts === undefined) delete process.env.COAIA_MEDIA_UPLOAD_HOSTS;
    else process.env.COAIA_MEDIA_UPLOAD_HOSTS = previousUploadHosts;
    await close(proxy);
    await close(upstream);
  }
});

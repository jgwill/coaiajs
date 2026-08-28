import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

import {
  addTrace,
  getClient,
  getObservation,
  getTrace,
  listScores,
  listTraces,
  resetClient,
} from '../dist/src/langfuse/index.js';

function observation(overrides = {}) {
  return {
    id: 'obs-root',
    traceId: '0123456789abcdef0123456789abcdef',
    startTime: '2026-08-01T00:00:00.000Z',
    endTime: '2026-08-01T00:00:01.000Z',
    projectId: 'project-1',
    parentObservationId: null,
    isRootObservation: true,
    type: 'SPAN',
    name: 'root',
    traceName: 'ceremony',
    sessionId: 'session-1',
    userId: 'user-1',
    input: '{"request":true}',
    output: '{"response":true}',
    ...overrides,
  };
}

async function createLangfuseStub() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks),
      });

      response.statusCode = 200;
      if (request.url.startsWith('/api/public/v2/observations')) {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ data: [observation()], meta: {} }));
      } else if (request.url.startsWith('/api/public/v3/scores')) {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({
          data: [{
            id: 'score-1',
            projectId: 'project-1',
            name: 'quality',
            value: 0.9,
            dataType: 'NUMERIC',
            source: 'API',
            timestamp: '2026-08-01T00:00:00.000Z',
            environment: 'default',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            subject: { kind: 'trace', id: 'trace-1' },
          }],
          meta: { limit: 100 },
        }));
      } else {
        response.end();
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    requests,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test('Langfuse v4 reads use Observations API v2 and Scores API v3', async () => {
  const stub = await createLangfuseStub();
  resetClient();
  getClient({ publicKey: 'pk-test', secretKey: 'sk-test', baseUrl: stub.baseUrl });

  try {
    const traces = JSON.parse(await listTraces({
      sessionId: 'session-1',
      name: 'ceremony',
      tags: ['v4'],
      fromTimestamp: '2026-08-01T00:00:00.000Z',
      toTimestamp: '2026-08-02T00:00:00.000Z',
    }));
    assert.equal(traces.data[0].id, '0123456789abcdef0123456789abcdef');

    await getTrace('0123456789abcdef0123456789abcdef');
    await getObservation('obs-root');

    const scores = JSON.parse(await listScores({ traceId: 'trace-1' }));
    assert.equal(scores[0].traceId, 'trace-1');

    const observationRequests = stub.requests.filter((request) =>
      request.url.startsWith('/api/public/v2/observations'));
    assert.equal(observationRequests.length, 3);
    assert.ok(stub.requests.some((request) => request.url.startsWith('/api/public/v3/scores')));
    assert.ok(stub.requests.every((request) => !request.url.startsWith('/api/public/traces')));
    assert.ok(stub.requests.every((request) => !request.url.startsWith('/api/public/sessions')));
    assert.ok(stub.requests.every((request) => !request.url.startsWith('/api/public/v2/scores')));

    const listUrl = new URL(observationRequests[0].url, stub.baseUrl);
    const filters = JSON.parse(listUrl.searchParams.get('filter'));
    assert.ok(filters.some((filter) => filter.column === 'isRootObservation' && filter.value === true));
    assert.ok(filters.some((filter) => filter.column === 'sessionId' && filter.value === 'session-1'));
    assert.ok(filters.some((filter) => filter.column === 'tags' && filter.operator === 'all of'));
  } finally {
    resetClient();
    await stub.close();
  }
});

test('trace creation exports immutable spans to the v4 OpenTelemetry endpoint', async () => {
  const stub = await createLangfuseStub();
  resetClient();
  getClient({ publicKey: 'pk-test', secretKey: 'sk-test', baseUrl: stub.baseUrl });

  try {
    const result = JSON.parse(await addTrace({
      traceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'ceremony',
      sessionId: 'session-1',
      userId: 'user-1',
      tags: ['v4'],
      inputData: { request: true },
      outputData: { response: true },
    }));

    assert.equal(result.traceId, '123e4567e89b12d3a456426614174000');
    assert.match(result.rootObservationId, /^[0-9a-f]{16}$/);

    const request = stub.requests.find((item) => item.url === '/api/public/otel/v1/traces');
    assert.ok(request, 'expected an OTLP trace export');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['x-langfuse-ingestion-version'], '4');
    assert.equal(request.headers['x-langfuse-sdk-name'], 'javascript');

    const payload = JSON.parse(request.body.toString('utf8'));
    const span = payload.resourceSpans[0].scopeSpans[0].spans[0];
    const attributes = Object.fromEntries(span.attributes.map((attribute) => [
      attribute.key,
      Object.values(attribute.value)[0],
    ]));
    assert.equal(attributes['langfuse.trace.name'], 'ceremony');
    assert.equal(attributes['langfuse.session.id'], 'session-1');
    assert.equal(attributes['langfuse.user.id'], 'user-1');
    assert.equal(attributes['langfuse.observation.input'], '{"request":true}');
    assert.equal(attributes['langfuse.observation.output'], '{"response":true}');
  } finally {
    resetClient();
    await stub.close();
  }
});

test('Custom GPT spec is OpenAPI 3.1 and contains only supported Langfuse v4 reads', async () => {
  const source = await readFile(new URL('../agents/custom_gpt/ceremony.yml', import.meta.url), 'utf8');
  const spec = yaml.load(source);

  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.info.version, '0.4.0');
  assert.ok(spec.paths['/api/public/v2/observations']?.get);
  assert.ok(spec.paths['/api/public/otel/v1/traces']?.post);
  assert.ok(spec.paths['/api/public/v3/scores']?.get);
  assert.ok(spec.paths['/api/public/scores']?.post);
  assert.equal(spec.paths['/api/public/traces'], undefined);
  assert.equal(spec.paths['/api/public/traces/{traceId}'], undefined);
  assert.equal(spec.paths['/api/public/sessions/{sessionId}'], undefined);
  assert.equal(spec.paths['/api/public/v2/scores'], undefined);
  assert.deepEqual(spec.components.securitySchemes.BasicAuth, { type: 'http', scheme: 'basic' });
  assert.doesNotMatch(source, /\bnullable:/);

  const operationIds = Object.values(spec.paths).flatMap((path) =>
    Object.entries(path)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([, operation]) => operation.operationId));
  assert.equal(new Set(operationIds).size, operationIds.length);
});

test('focused Custom GPT spec can append nested observations within the action limit', async () => {
  const specUrl = new URL('../agents/custom_gpt/ceremony-observations.yml', import.meta.url);
  const source = await readFile(specUrl, 'utf8');
  const spec = yaml.load(source);

  assert.equal(spec.openapi, '3.1.0');
  const auth = spec.components.securitySchemes.LangfuseAuthorization;
  assert.equal(auth.type, 'apiKey');
  assert.equal(auth.in, 'header');
  assert.equal(auth.name, 'Authorization');
  assert.match(auth.description, /Basic BASE64/);

  const operations = Object.entries(spec.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([, operation]) => ({ path, operation })));
  const operationIds = operations.map(({ operation }) => operation.operationId);
  assert.equal(operations.length, 23);
  assert.ok(operations.length < 30);
  assert.equal(new Set(operationIds).size, operationIds.length);

  for (const { path, operation } of operations) {
    assert.equal(operation['x-openai-isConsequential'], false, `${operation.operationId} prompts for confirmation`);
    assert.ok((operation.description?.length ?? 0) <= 300, `${operation.operationId} description exceeds 300 chars`);
    for (const parameter of operation.parameters ?? []) {
      assert.equal(parameter.$ref, undefined, `${operation.operationId} contains a parameter reference`);
      assert.equal(typeof parameter.name, 'string', `${operation.operationId} has a nameless parameter`);
      assert.notEqual(parameter.in, 'header', `${operation.operationId} contains an ignored header parameter`);
    }
    assert.ok(path.startsWith('/api/public/'));
  }
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    if (schema.type === 'object') {
      assert.ok(schema.properties, `${name} is an object component without properties`);
    }
  }

  const exportOperation = spec.paths['/api/public/otel/v1/traces'].post;
  assert.equal(exportOperation.parameters, undefined);

  const example = exportOperation.requestBody.content['application/json']
    .examples.createRootAndChild.value;
  const [root, child] = example.resourceSpans[0].scopeSpans[0].spans;
  assert.match(root.traceId, /^[0-9a-f]{32}$/);
  assert.match(root.spanId, /^[0-9a-f]{16}$/);
  assert.equal(root.parentSpanId, undefined);
  assert.equal(child.traceId, root.traceId);
  assert.equal(child.parentSpanId, root.spanId);
  assert.notEqual(child.spanId, root.spanId);

  assert.ok(spec.paths['/api/public/v2/observations']?.get);
  assert.ok(spec.paths['/api/public/v3/scores']?.get);
  assert.ok(spec.paths['/api/public/scores']?.post);
  assert.ok(spec.paths['/api/public/media']?.post);
  assert.ok(spec.paths['/api/public/media/{mediaId}']?.get);
  assert.ok(spec.paths['/api/public/media/{mediaId}']?.patch);

  const broadSource = await readFile(new URL('../agents/custom_gpt/ceremony.yml', import.meta.url), 'utf8');
  const broadSpec = yaml.load(broadSource);
  for (const [path, pathItem] of Object.entries(broadSpec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (pathItem[method]) {
        assert.ok(spec.paths[path]?.[method], `focused spec removed ${method.toUpperCase()} ${path}`);
      }
    }
  }

  assert.equal(spec.paths['/api/public/ingestion'], undefined);
  assert.equal(spec.paths['/api/public/traces'], undefined);
  assert.equal(spec.paths['/api/public/sessions'], undefined);
  assert.doesNotMatch(source, /\bnullable:/);

  const instructions = await readFile(
    new URL('../agents/custom_gpt/ceremony-observations.instructions.md', import.meta.url),
    'utf8',
  );
  assert.match(instructions, /parentSpanId/);
  assert.match(instructions, /intentionally does not declare `x-langfuse-ingestion-version`/);
  assert.match(instructions, /23 actions/);
});

test('package uses the current scoped Langfuse JS SDK instead of legacy v3', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.dependencies.langfuse, undefined);
  assert.match(packageJson.dependencies['@langfuse/client'], /^\^5\./);
  assert.match(packageJson.dependencies['@langfuse/tracing'], /^\^5\./);
  assert.match(packageJson.dependencies['@langfuse/otel'], /^\^5\./);
});

test('every coaia fuse action maps to an exported implementation', async () => {
  const source = await readFile(new URL('../src/cli.ts', import.meta.url), 'utf8');
  const names = [...source.matchAll(/callModule\('langfuse',\s*'([^']+)'/g)].map((match) => match[1]);
  const langfuse = await import('../dist/src/langfuse/index.js');
  const missing = [...new Set(names.filter((name) => typeof langfuse[name] !== 'function'))];
  assert.deepEqual(missing, []);

  const cli = fileURLToPath(new URL('../dist/src/cli.js', import.meta.url));
  const traceHelp = execFileSync(process.execPath, [cli, 'fuse', 'traces', '--help'], { encoding: 'utf8' });
  const sessionHelp = execFileSync(process.execPath, [cli, 'fuse', 'sessions', '--help'], { encoding: 'utf8' });
  assert.doesNotMatch(traceHelp, /patch-output/);
  assert.doesNotMatch(sessionHelp, /\bcreate\b|addnode/);
});

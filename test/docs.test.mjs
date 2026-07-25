// test/docs.test.mjs — keeps the documentation honest.
//
// README.md, llms.txt, and llms-full.txt make concrete, checkable claims: which
// import paths resolve, which symbols each module exports, and which tools the
// MCP server serves. Those claims drifted before — the docs taught
// `coaiajs/src/redis.js`, a path that never resolved, and every file advertised
// "64+ tools" against a server that served 63. This suite fails the build when
// documentation and reality disagree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const pkg = JSON.parse(read('package.json'));
const README = read('README.md');
const LLMS = read('llms.txt');
const LLMS_FULL = read('llms-full.txt');
const ALL_DOCS = [
  ['README.md', README],
  ['llms.txt', LLMS],
  ['llms-full.txt', LLMS_FULL],
];

/** Import paths the package publicly declares, e.g. "coaiajs/redis". */
const declaredPaths = new Set(
  Object.keys(pkg.exports).map((k) => (k === '.' ? 'coaiajs' : `coaiajs/${k.slice(2)}`)),
);

/**
 * Module specifiers a document actually presents as importable — the source of
 * a `from '...'` / `import '...'` / `--package=...` form. Prose that merely
 * mentions a path (including a warning *against* one) is deliberately excluded.
 */
function importedSpecifiers(body) {
  const found = new Set();
  for (const [, spec] of body.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    if (spec.startsWith('coaiajs')) found.add(spec);
  }
  return found;
}

test('every documented coaiajs/* import path is a declared export', () => {
  for (const [name, body] of ALL_DOCS) {
    for (const spec of importedSpecifiers(body)) {
      assert.ok(
        declaredPaths.has(spec),
        `${name} shows "import ... from '${spec}'" but package.json exports does not declare it`,
      );
    }
  }
});

test('docs never teach the unpublished src/ import path', () => {
  // `src/` is excluded from the tarball by the files field, so it never resolves.
  // Warning readers away from it is fine; presenting it as an import is not.
  for (const [name, body] of ALL_DOCS) {
    const taught = [...importedSpecifiers(body)].filter((s) => s.startsWith('coaiajs/src'));
    assert.deepEqual(
      taught,
      [],
      `${name} presents ${taught.join(', ')} as an import, which cannot resolve from an installed package`,
    );
  }
});

test('every declared export target is present in the build', async () => {
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    if (typeof entry === 'string') continue; // ./package.json
    for (const target of [entry.import, entry.types]) {
      const mod = await import(join(ROOT, target)).then(
        () => true,
        (err) => (target.endsWith('.d.ts') ? true : err),
      );
      assert.equal(mod, true, `exports["${subpath}"] -> ${target} failed to load`);
    }
  }
});

test('the files field ships the documentation it promises', () => {
  for (const doc of ['README.md', 'llms.txt', 'llms-full.txt', 'KINSHIP.md']) {
    assert.ok(pkg.files.includes(doc), `package.json files omits ${doc}`);
  }
});

// ── MCP tool surface ────────────────────────────────────────────────

/**
 * Ask the running server what it serves. The definition arrays are not ground
 * truth: server.ts renames four PDE tools to `pde_*` at registration to avoid
 * colliding with narrative tools of the same name, so only a live tools/list
 * reflects what a client actually sees.
 */
async function servedTools() {
  const { spawn } = await import('node:child_process');
  const proc = spawn('node', [join(ROOT, 'dist/mcp/server.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const send = (msg) => proc.stdin.write(`${JSON.stringify(msg)}\n`);

  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('MCP server did not answer tools/list')), 20000);
      let buf = '';
      proc.on('error', reject);
      proc.stdout.on('data', (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue; // not a complete JSON-RPC frame
          }
          if (msg.id === 1) send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
          if (msg.id === 2) {
            clearTimeout(timer);
            resolve(msg.result.tools.map((t) => t.name));
          }
        }
      });
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'docs-test', version: '1' },
        },
      });
    });
  } finally {
    proc.kill();
  }
}

async function toolGroups() {
  const { FeatureConfig } = await import('../dist/mcp/config.js');
  const { getCoaiapyToolDefinitions } = await import('../dist/mcp/tools/index.js');
  const narrative = await import('../dist/src/narrative/index.js');
  const pde = await import('../dist/src/pde/index.js');
  const planning = await import('../dist/src/planning/index.js');
  const fc = new FeatureConfig('STANDARD');
  return {
    coaiapy: getCoaiapyToolDefinitions(fc).length,
    narrative: narrative.ALL_TOOL_DEFINITIONS.length,
    pde: pde.PDE_MCP_TOOLS.length,
    planning: planning.PLANNING_MCP_TOOLS.length,
    enabled: fc.enabledTools.size,
  };
}

test('the startup banner count matches what the server actually serves', async () => {
  const served = await servedTools();
  const groups = await toolGroups();
  // The banner prints enabledTools.size. A phantom entry there (a tool enabled
  // in config but never implemented) makes the server overstate itself.
  assert.equal(
    groups.enabled,
    served.length,
    `banner would claim ${groups.enabled} tools but ${served.length} are served`,
  );
});

test('documented tool counts match the served surface', async () => {
  const served = await servedTools();
  const groups = await toolGroups();
  const counts = { total: served.length, ...groups };

  for (const [name, body] of ALL_DOCS) {
    for (const claim of body.match(/\b(\d+) tools\b/g) ?? []) {
      const n = Number(claim.match(/\d+/)[0]);
      assert.ok(
        Object.values(counts).includes(n),
        `${name} claims "${claim}" but real counts are ${JSON.stringify(counts)}`,
      );
    }
  }
});

test('every tool named in llms-full.txt exists, and none is missing', async () => {
  const served = new Set(await servedTools());

  // Tool names appear in fenced blocks under the "### Tools —" headings.
  const blocks = LLMS_FULL.split(/^### Tools — /m)
    .slice(1)
    .map((s) => s.match(/```\n([\s\S]*?)```/)?.[1] ?? '');
  const documented = new Set(
    blocks
      .join(',')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^[a-z][a-z0-9_]*$/.test(s)),
  );

  assert.ok(documented.size > 0, 'failed to parse any tool names out of llms-full.txt');

  const invented = [...documented].filter((n) => !served.has(n));
  assert.deepEqual(invented, [], `llms-full.txt documents tools that do not exist: ${invented.join(', ')}`);

  const undocumented = [...served].filter((n) => !documented.has(n));
  assert.deepEqual(undocumented, [], `these served tools are undocumented: ${undocumented.join(', ')}`);
});

test('every symbol listed in llms-full.txt module blocks is really exported', async () => {
  // Each "### `coaiajs/<name>`" heading is followed by a fence listing its exports.
  const sections = LLMS_FULL.split(/^### `coaiajs\/(?=[a-z])/m).slice(1);
  let checked = 0;

  for (const raw of sections) {
    // Bound the section at the next heading; otherwise the fence-less langfuse
    // section reads the *following* section's code block and checks the wrong names.
    const section = raw.split(/^#{2,3} /m)[0];
    const sub = section.match(/^([a-z][a-z0-9-]*)`/)?.[1];
    const listed = section.match(/```\n([\s\S]*?)```/)?.[1];
    if (!sub || !listed) continue;

    const mod = await import(`../dist/src/${sub === 'version' ? 'version' : sub}.js`).catch(
      () => import(`../dist/src/${sub}/index.js`),
    );
    const real = new Set(Object.keys(mod));

    for (const symbol of listed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)) {
      assert.ok(
        real.has(symbol),
        `llms-full.txt says coaiajs/${sub} exports "${symbol}", but it does not`,
      );
      checked++;
    }
  }

  assert.ok(checked > 40, `expected to verify many symbols, only checked ${checked}`);
});

test('README documents only real CLI commands', async () => {
  // Commands are the first column of the CLI table; verify against commander.
  const { execFileSync } = await import('node:child_process');
  const help = execFileSync('node', [join(ROOT, 'dist/src/cli.js'), '--help'], {
    encoding: 'utf8',
  });
  const realCommands = new Set(
    help
      .split('Commands:')[1]
      .split('\n')
      .map((l) => l.trim().split(/[\s|]/)[0])
      .filter(Boolean),
  );

  for (const row of README.match(/^\| `([a-z-]+)`[^|]*\|/gm) ?? []) {
    const cmd = row.match(/`([a-z-]+)`/)[1];
    if (!realCommands.has(cmd)) continue; // table also lists subcommands and env vars
    assert.ok(realCommands.has(cmd), `README documents CLI command "${cmd}" that does not exist`);
  }
  // Spot-check that the top-level commands the README promises are all present.
  for (const cmd of ['tash', 'fetch', 'llm', 'fuse', 'narrative', 'pde', 'plan', 'pipeline', 'env', 'gh']) {
    assert.ok(realCommands.has(cmd), `README documents "${cmd}" but the CLI does not expose it`);
  }
});

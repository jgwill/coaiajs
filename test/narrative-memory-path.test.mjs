// test/narrative-memory-path.test.mjs — every `coaia narrative` command opens the store
// `-M, --memory-path` names.
//
// Before 0.7.0, update, add-action, add-obs, export, export-all, stats, progress and
// mmot ignored -M and opened COAIAJS_MEMORY_PATH or ./coaia-memory.jsonl instead
// (Episode 297 spec lane, finding F2). Each runs here from an empty working directory
// with COAIAJS_MEMORY_PATH unset: a command that ignored -M would find no chart, or
// would create ./coaia-memory.jsonl, and both are checked.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { KnowledgeGraphManager } from '../dist/src/narrative/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'dist/src/cli.js');
const DAY = 24 * 60 * 60 * 1000;

let dir;
let cwd;
let store;
let chartId;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'coaiajs-memory-path-'));
  cwd = join(dir, 'elsewhere');
  mkdirSync(cwd);
  store = join(dir, 'store.jsonl');
  const chart = await new KnowledgeGraphManager(store).createStructuralTensionChart(
    'Every narrative command opens the store -M names',
    'Eight commands opened the default store',
    new Date(Date.now() + 30 * DAY).toISOString(),
    ['Thread the memory path through'],
  );
  chartId = chart.chartId;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(...args) {
  const env = { ...process.env };
  delete env.COAIAJS_MEMORY_PATH;
  return execFileSync('node', [CLI, '-M', store, ...args], { encoding: 'utf8', cwd, env, stdio: 'pipe' });
}

const storeText = () => readFileSync(store, 'utf8');

describe('narrative commands honour -M', () => {
  test('update, add-action and add-obs write to the -M store', () => {
    run('narrative', 'update', chartId, '--desired-outcome', 'All sixteen narrative commands honour -M');
    run('narrative', 'add-action', chartId, '--title', 'Test the eight', '--current-reality', 'Untested');
    run('narrative', 'add-obs', chartId, 'update and add-action wrote here');
    const text = storeText();
    assert.match(text, /All sixteen narrative commands honour -M/, 'update did not write to the -M store');
    assert.match(text, /Test the eight/, 'add-action did not write to the -M store');
    assert.match(text, /update and add-action wrote here/, 'add-obs did not write to the -M store');
  });

  test('export, export-all, stats, progress and mmot read the -M store', () => {
    assert.match(run('narrative', 'export', chartId), /All sixteen narrative commands honour -M/);
    assert.match(run('narrative', 'export-all'), /All sixteen narrative commands honour -M/);
    assert.match(run('narrative', 'stats'), /\| Total Charts \| 2 \|/, 'stats did not count the -M store');
    assert.match(run('narrative', 'progress', chartId), /All sixteen narrative commands honour -M/);
    assert.match(run('narrative', 'mmot', chartId, '--assessment', 'eight of eight'), new RegExp(`\\*\\*Chart\\*\\*: ${chartId}`));
  });

  test('no command opened the default store in the working directory', () => {
    assert.equal(existsSync(join(cwd, 'coaia-memory.jsonl')), false, './coaia-memory.jsonl was created');
    assert.deepEqual(readdirSync(cwd), []);
  });
});

// test/delayed-resolution.test.mjs — a chosen delay on an action step, and the
// agent session it rehydrates.
//
// A due date says when. A delayed resolution says someone chose to wait: until
// when, why, what the wait serves, and which session to bring back. These run
// against the built output, the same modules a consumer imports.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  KnowledgeGraphManager,
  handleToolCall,
  exportChartToMarkdown,
  exportChartProgress,
  exportAllChartsToMarkdown,
  ALL_TOOL_DEFINITIONS,
  STC_TOOLS,
  deriveActionStepStatus,
} from '../dist/src/narrative/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'dist/src/cli.js');
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n, from = new Date()) => new Date(from.getTime() + n * DAY).toISOString();

let dir;
let stores = 0;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'coaiajs-delayed-resolution-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fresh() {
  const path = join(dir, `store-${++stores}.jsonl`);
  return { path, manager: new KnowledgeGraphManager(path) };
}

/** A chart with one written step and one telescoped step. */
async function seed(manager) {
  const chart = await manager.createStructuralTensionChart(
    'A release that records chosen delays',
    'No step records a chosen delay yet',
    inDays(60),
    ['Write the delay record'],
  );
  const telescoped = await manager.addActionStep(
    chart.chartId,
    'Publish the release',
    inDays(10),
    'Nothing published',
  );
  return {
    chartId: chart.chartId,
    written: `${chart.chartId}_action_1`,
    telescoped: telescoped.actionStepName,
    telescopedChartId: telescoped.chartId,
  };
}

function storedEntity(path, name) {
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l))
    .find(r => r.name === name);
  assert.ok(line, `${name} is not in the store`);
  return line;
}

const SESSION = {
  sessionId: '4b1f0c2e-7d3a-4f6e-9a51-0c2d9e8b7a10',
  host: 'gaia',
  cwd: '/srv/miadi/episodes',
  tmux: 'mia:2',
};

// ─────────────────────────────────────────────────────────────────────
describe('delay a step', () => {
  test('a written step carries the record, and its due date becomes resolveBy', async () => {
    const { path, manager } = fresh();
    const { chartId, written } = await seed(manager);
    const resolveBy = inDays(14);

    const entry = await manager.delayResolution(written, {
      resolveBy,
      reason: 'The release waits for the sibling lineage to land first',
      chosenBy: 'William',
      wakeOn: ['coaia-narrative 0.24.0 is published'],
      session: SESSION,
    });

    assert.equal(entry.actionStepName, written);
    assert.equal(entry.chartId, chartId);
    assert.equal(entry.status, 'delayed');
    assert.equal(entry.resolveBy, resolveBy);
    assert.equal(entry.dueDate, resolveBy, "the step's due date was not set to resolveBy");
    assert.equal(entry.owed, false);
    assert.equal(entry.historyCount, 0);
    assert.equal(entry.chosenBy, 'William');
    assert.equal(
      entry.primaryChoice,
      'A release that records chosen delays',
      "primaryChoice did not default to the chart's desired outcome",
    );
    assert.deepEqual(entry.wakeOn, ['coaia-narrative 0.24.0 is published']);
    assert.equal(entry.session.agent, 'claude', 'agent did not default to claude');
    assert.ok(!Number.isNaN(Date.parse(entry.chosenAt)));

    const stored = storedEntity(path, written);
    assert.equal(stored.metadata.dueDate, resolveBy);
    assert.equal(stored.metadata.delayedResolution.reason, entry.reason);
    assert.equal(stored.metadata.delayedResolution.session.sessionId, SESSION.sessionId);
    assert.equal(stored.metadata.completionStatus, false, 'completionStatus must stay the stored truth');
  });

  test('a telescoped step moves its outcome and its chart together, and serves the parent', async () => {
    const { path, manager } = fresh();
    const { chartId, telescoped, telescopedChartId } = await seed(manager);
    const resolveBy = inDays(21);

    const entry = await manager.delayResolution(telescoped, {
      resolveBy,
      reason: 'Publishing waits for the review',
      chosenBy: 'mia',
    });

    assert.equal(entry.chartId, chartId, 'a telescoped step belongs to its parent chart');
    assert.equal(entry.telescopedChartId, telescopedChartId);
    assert.equal(entry.primaryChoice, 'A release that records chosen delays');
    assert.equal(storedEntity(path, telescoped).metadata.dueDate, resolveBy);
    assert.equal(
      storedEntity(path, `${telescopedChartId}_chart`).metadata.dueDate,
      resolveBy,
      "the telescoped chart kept its old date, so listings would show the old one",
    );
  });

  test('a telescoped chart id names the same step', async () => {
    const { manager } = fresh();
    const { telescoped, telescopedChartId } = await seed(manager);
    const entry = await manager.delayResolution(telescopedChartId, {
      resolveBy: inDays(3),
      reason: 'named by its chart',
      chosenBy: 'mia',
    });
    assert.equal(entry.actionStepName, telescoped);
  });

  test('a completed step is refused, and the store is left as it was', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.markActionStepComplete(written);
    const before = readFileSync(path, 'utf8');

    await assert.rejects(
      manager.delayResolution(written, { resolveBy: inDays(5), reason: 'too late', chosenBy: 'mia' }),
      /completed/,
    );
    assert.equal(readFileSync(path, 'utf8'), before);
  });

  test('a past resolveBy and an invalid one are refused', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);

    await assert.rejects(
      manager.delayResolution(written, { resolveBy: inDays(-1), reason: 'r', chosenBy: 'mia' }),
      /not in the future/,
    );
    await assert.rejects(
      manager.delayResolution(written, { resolveBy: 'next tuesday', reason: 'r', chosenBy: 'mia' }),
      /Invalid resolveBy/,
    );

    // Through MCP, the same refusals arrive as tool errors rather than thrown past the server.
    const past = await handleToolCall(
      'delay_resolution',
      { actionStepName: written, resolveBy: inDays(-1), reason: 'r', chosenBy: 'mia' },
      manager,
    );
    assert.equal(past.isError, true);
    assert.match(past.content[0].text, /not in the future/);

    const invalid = await handleToolCall(
      'delay_resolution',
      { actionStepName: written, resolveBy: 'next tuesday', reason: 'r', chosenBy: 'mia' },
      manager,
    );
    assert.equal(invalid.isError, true);
  });

  test('reason and chosenBy are required', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await assert.rejects(
      manager.delayResolution(written, { resolveBy: inDays(2), reason: '', chosenBy: 'mia' }),
      /reason is required/,
    );
    const result = await handleToolCall(
      'delay_resolution',
      { actionStepName: written, resolveBy: inDays(2), reason: 'r' },
      manager,
    );
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /chosenBy/);
  });

  test('re-delaying moves the open record into history, overwriting nothing', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const first = inDays(7);
    const second = inDays(30);

    await manager.delayResolution(written, { resolveBy: first, reason: 'first wait', chosenBy: 'mia' });
    const entry = await manager.delayResolution(written, {
      resolveBy: second,
      reason: 'the wait grew',
      chosenBy: 'William',
    });

    assert.equal(entry.historyCount, 1);
    assert.equal(entry.resolveBy, second);
    const stored = storedEntity(path, written).metadata;
    assert.equal(stored.delayedResolutionHistory.length, 1);
    assert.equal(stored.delayedResolutionHistory[0].resolveBy, first);
    assert.equal(stored.delayedResolutionHistory[0].reason, 'first wait');
    assert.equal(stored.delayedResolution.reason, 'the wait grew');
    assert.equal(stored.dueDate, second);
  });

  test('the record survives other writes to the step', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(4), reason: 'kept', chosenBy: 'mia' });
    await manager.updateActionProgress(written, 'Drafted the record fields');
    assert.equal(storedEntity(path, written).metadata.delayedResolution.reason, 'kept');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('list delayed resolutions', () => {
  test('sorted by resolveBy, with days remaining and owed', async () => {
    const { manager } = fresh();
    const { written, telescoped } = await seed(manager);
    const now = new Date();
    await manager.delayResolution(written, { resolveBy: inDays(20, now), reason: 'later', chosenBy: 'mia' });
    await manager.delayResolution(telescoped, { resolveBy: inDays(5, now), reason: 'sooner', chosenBy: 'mia' });

    const list = await manager.listDelayedResolutions({ now });
    assert.deepEqual(list.map(e => e.actionStepName), [telescoped, written], 'not sorted by resolveBy');
    assert.deepEqual(list.map(e => e.daysRemaining), [5, 20]);
    assert.deepEqual(list.map(e => e.owed), [false, false]);

    // A week on, the sooner one is owed and every listing says so.
    const later = new Date(now.getTime() + 7 * DAY);
    const owedList = await manager.listDelayedResolutions({ now: later });
    assert.equal(owedList[0].actionStepName, telescoped);
    assert.equal(owedList[0].owed, true);
    assert.ok(owedList[0].daysRemaining <= 0);
    assert.equal(owedList[1].owed, false);
    assert.equal(owedList[1].daysRemaining, 13);

    const soon = await manager.listDelayedResolutions({ now, dueWithinDays: 10 });
    assert.deepEqual(soon.map(e => e.actionStepName), [telescoped]);
  });

  test('the MCP listing renders owed delays and returns the entries', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(2),
      reason: 'waits on review',
      chosenBy: 'mia',
      session: SESSION,
    });

    const result = await handleToolCall('list_delayed_resolutions', {}, manager);
    assert.ok(!result.isError);
    const text = result.content[0].text;
    assert.match(text, /Delayed resolutions \(1\)/);
    assert.match(text, /waits on review/);
    const json = JSON.parse(text.slice(text.indexOf('\n[')));
    assert.equal(json.length, 1);
    assert.equal(json[0].session.sessionId, SESSION.sessionId);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('end a delay', () => {
  test('rehydrated returns the stored resume command and keeps the record', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const resumeCommand = `cd ${SESSION.cwd} && claude --resume ${SESSION.sessionId}`;
    await manager.delayResolution(written, {
      resolveBy: inDays(3),
      reason: 'resume this session when the review lands',
      chosenBy: 'mia',
      session: { ...SESSION, resumeCommand },
    });

    const ended = await manager.endDelayedResolution(written, {
      endedBy: 'William',
      outcome: 'rehydrated',
      endNote: 'review landed',
    });

    assert.equal(ended.resumeCommand, resumeCommand);
    assert.equal(ended.outcome, 'rehydrated');
    assert.equal(ended.endedBy, 'William');
    assert.equal(ended.status, 'pending', 'the step did not return to its earlier status');

    const stored = storedEntity(path, written).metadata;
    assert.equal(stored.delayedResolution.outcome, 'rehydrated');
    assert.equal(stored.delayedResolution.endNote, 'review landed');
    assert.ok(stored.delayedResolution.endedAt);
    assert.equal(stored.completionStatus, false);

    assert.deepEqual(await manager.listDelayedResolutions(), [], 'an ended delay is still listed as open');
    const all = await manager.listDelayedResolutions({ includeEnded: true });
    assert.equal(all.length, 1);
    assert.equal(all[0].outcome, 'rehydrated');
  });

  test('rehydrated composes the Claude Code resume when none was stored', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(3),
      reason: 'r',
      chosenBy: 'mia',
      session: SESSION,
    });
    const result = await handleToolCall(
      'end_delayed_resolution',
      { actionStepName: written, endedBy: 'mia', outcome: 'rehydrated' },
      manager,
    );
    assert.ok(!result.isError, result.content[0].text);
    assert.match(
      result.content[0].text,
      new RegExp(`cd ${SESSION.cwd} && claude --resume ${SESSION.sessionId}`),
    );
  });

  test('released ends the delay without a resume command', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(3),
      reason: 'r',
      chosenBy: 'mia',
      session: SESSION,
    });
    const ended = await manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'released' });
    assert.equal(ended.outcome, 'released');
    assert.equal(ended.resumeCommand, undefined);
    assert.equal(ended.status, 'pending');

    await assert.rejects(
      manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'released' }),
      /no open delayed resolution/,
    );
  });

  test('rehydrated is refused when no session was recorded', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(3), reason: 'r', chosenBy: 'mia' });
    await assert.rejects(
      manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'rehydrated' }),
      /nothing to rehydrate/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('status reads delayed, then returns', () => {
  test('get_action_step, get_chart, get_chart_progress, list_active_charts and markdown', async () => {
    const { manager } = fresh();
    const { chartId, written, telescoped, telescopedChartId } = await seed(manager);

    const statusIn = async (tool, args, name) => {
      const result = await handleToolCall(tool, args, manager);
      assert.ok(!result.isError, result.content[0].text);
      return JSON.parse(result.content[0].text).entities.find(e => e.name === name)?.status;
    };

    // Before any delay.
    assert.equal(await statusIn('get_action_step', { actionStepName: written }, written), 'pending');
    assert.equal(await statusIn('get_action_step', { actionStepName: telescoped }, telescoped), 'pending');

    await manager.delayResolution(written, { resolveBy: inDays(9), reason: 'chosen wait', chosenBy: 'mia' });
    await manager.delayResolution(telescoped, { resolveBy: inDays(12), reason: 'chosen wait', chosenBy: 'mia' });

    assert.equal(await statusIn('get_action_step', { actionStepName: written }, written), 'delayed');
    assert.equal(await statusIn('get_action_step', { actionStepName: telescoped }, telescoped), 'delayed');
    assert.equal(await statusIn('get_chart', { chartId }, written), 'delayed');
    assert.equal(await statusIn('get_chart', { chartId: telescopedChartId }, telescoped), 'delayed');

    const progress = await manager.getChartProgress(chartId);
    assert.equal(progress.delayedActions, 2);
    assert.equal(progress.owedActions, 0);

    const summary = (await manager.listActiveCharts()).find(c => c.chartId === chartId);
    assert.equal(summary.actionSteps[0].status, 'delayed');
    const telescopedSummary = (await manager.listActiveCharts()).find(c => c.chartId === telescopedChartId);
    assert.equal(telescopedSummary.status, 'delayed');

    const listing = (await handleToolCall('list_active_charts', {}, manager)).content[0].text;
    assert.equal((listing.match(/delayed until/g) || []).length, 2, listing);

    assert.match(await exportChartToMarkdown(chartId, manager), /\*\*Status\*\*: Delayed until/);
    assert.match(await exportChartToMarkdown(telescopedChartId, manager), /\*\*Status\*\*: Delayed until/);
    assert.match(await exportChartProgress(chartId, manager), /Delayed until/);
    assert.match(await exportAllChartsToMarkdown(manager), /Delayed until/);

    // Ending returns each step to its earlier status everywhere.
    await manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'released' });
    await manager.endDelayedResolution(telescoped, { endedBy: 'mia', outcome: 'released' });

    assert.equal(await statusIn('get_action_step', { actionStepName: written }, written), 'pending');
    assert.equal(await statusIn('get_chart', { chartId: telescopedChartId }, telescoped), 'pending');
    assert.equal((await manager.getChartProgress(chartId)).delayedActions, 0);
    const after = (await handleToolCall('list_active_charts', {}, manager)).content[0].text;
    assert.ok(!after.includes('delayed until'), after);
    assert.doesNotMatch(await exportChartToMarkdown(chartId, manager), /Delayed until/);
  });

  test('a step completed while delayed reads completed', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(9), reason: 'r', chosenBy: 'mia' });
    await manager.markActionStepComplete(written);
    const graph = await manager.readGraph();
    assert.equal(deriveActionStepStatus(graph.entities.find(e => e.name === written)), 'completed');
    assert.deepEqual(await manager.listDelayedResolutions(), []);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('surfaces', () => {
  test('the three tools are defined and grouped with the chart tools', () => {
    const names = ALL_TOOL_DEFINITIONS.map(t => t.name);
    for (const tool of ['delay_resolution', 'list_delayed_resolutions', 'end_delayed_resolution']) {
      assert.ok(names.includes(tool), `${tool} is not defined`);
      assert.ok(STC_TOOLS.includes(tool), `${tool} is not in STC_TOOLS`);
    }
  });

  test('the coaia CLI delays, lists and ends', () => {
    const { path } = fresh();
    const seedManager = new KnowledgeGraphManager(path);
    return seed(seedManager).then(({ written }) => {
      const run = (...args) => execFileSync('node', [CLI, '-M', path, ...args], { encoding: 'utf8' });

      const delayed = run(
        'narrative', 'delay', written,
        '--resolve-by', inDays(6),
        '--reason', 'waits on the sibling release',
        '--chosen-by', 'mia',
        '--wake-on', 'sibling published',
        '--wake-on', 'review approved',
        '--session-id', SESSION.sessionId,
        '--cwd', SESSION.cwd,
      );
      assert.match(delayed, /delayed until/);

      const listed = JSON.parse(run('--json', 'narrative', 'delayed'));
      assert.equal(listed.length, 1);
      assert.equal(listed[0].actionStepName, written);
      assert.deepEqual(listed[0].wakeOn, ['sibling published', 'review approved']);
      assert.equal(listed[0].session.cwd, SESSION.cwd);

      const ended = run('narrative', 'end-delay', written, '--by', 'mia', '--outcome', 'rehydrated');
      assert.match(ended, new RegExp(`claude --resume ${SESSION.sessionId}`));
      assert.match(run('narrative', 'delayed'), /No delayed resolutions/);
    });
  });
});

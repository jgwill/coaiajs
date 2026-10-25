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

  test('rehydrated is refused when neither a session nor a follow-up prompt was recorded', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(3), reason: 'r', chosenBy: 'mia' });
    await assert.rejects(
      manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'rehydrated' }),
      /records neither a follow-up prompt nor an agent session, so there is nothing to rehydrate/,
    );
    const [still] = await manager.listDelayedResolutions();
    assert.equal(still.endedAt, undefined, 'a refused end closed the delay');
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
describe('completing a delayed step resolves its delay (rule 4b)', () => {
  test('the delay ends as resolved, by whoever completed it, noted "completed"', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(9),
      reason: 'waits on review',
      chosenBy: 'mia',
      session: SESSION,
    });

    const { endedDelay } = await manager.markActionStepComplete(written, 'William');
    assert.equal(endedDelay.outcome, 'resolved');

    const record = storedEntity(path, written).metadata.delayedResolution;
    assert.equal(record.outcome, 'resolved');
    assert.equal(record.endedBy, 'William');
    assert.equal(record.endNote, 'completed');
    assert.ok(!Number.isNaN(Date.parse(record.endedAt)));
    assert.equal(record.reason, 'waits on review', 'the record was not kept');

    const all = await manager.listDelayedResolutions({ includeEnded: true });
    assert.equal(all.length, 1);
    assert.equal(all[0].outcome, 'resolved');
    assert.equal(all[0].status, 'completed');
    assert.equal(all[0].owed, false);
  });

  test('a completer not named is recorded as mark_action_complete', async () => {
    const { path, manager } = fresh();
    const { telescoped } = await seed(manager);
    await manager.delayResolution(telescoped, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia' });
    await manager.markActionStepComplete(telescoped);
    const record = storedEntity(path, telescoped).metadata.delayedResolution;
    assert.equal(record.outcome, 'resolved');
    assert.equal(record.endedBy, 'mark_action_complete');
  });

  test('mark_action_complete takes completedBy and says the delay was resolved', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia' });
    const result = await handleToolCall(
      'mark_action_complete',
      { actionStepName: written, completedBy: 'mia' },
      manager,
    );
    assert.ok(!result.isError);
    assert.match(result.content[0].text, /ended as resolved, by mia/);
    assert.doesNotMatch(result.content[0].text, /Ignored unrecognised/);
  });

  test('a step with no open delay is completed without writing a record', async () => {
    const { path, manager } = fresh();
    const { written, telescoped } = await seed(manager);

    const plain = await manager.markActionStepComplete(written, 'mia');
    assert.equal(plain.endedDelay, undefined);
    assert.equal(storedEntity(path, written).metadata.delayedResolution, undefined);

    await manager.delayResolution(telescoped, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia' });
    await manager.endDelayedResolution(telescoped, { endedBy: 'William', outcome: 'released' });
    await manager.markActionStepComplete(telescoped, 'mia');
    const record = storedEntity(path, telescoped).metadata.delayedResolution;
    assert.equal(record.outcome, 'released', 'an ended delay was rewritten by completion');
    assert.equal(record.endedBy, 'William');
  });

  test('end_delayed_resolution does not accept resolved', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia' });

    await assert.rejects(
      manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'resolved' }),
      /written only when the step is completed/,
    );
    const result = await handleToolCall(
      'end_delayed_resolution',
      { actionStepName: written, endedBy: 'mia', outcome: 'resolved' },
      manager,
    );
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /outcome must be one of: rehydrated, released/);
  });

  test('coaia narrative complete --by resolves the delay', async () => {
    const { path } = fresh();
    const { written } = await seed(new KnowledgeGraphManager(path));
    const run = (...args) => execFileSync('node', [CLI, '-M', path, ...args], { encoding: 'utf8' });

    run('narrative', 'delay', written, '--resolve-by', inDays(6), '--reason', 'r', '--chosen-by', 'mia');
    run('narrative', 'complete', written, '--by', 'William');

    const listed = JSON.parse(run('--json', 'narrative', 'delayed', '--all'));
    assert.equal(listed.length, 1);
    assert.equal(listed[0].outcome, 'resolved');
    assert.equal(listed[0].endedBy, 'William');
    assert.equal(listed[0].endNote, 'completed');
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

// ─────────────────────────────────────────────────────────────────────
// 0.7.0: a session carries its LLMOps trace and the prompt version that rehydrates
// it, as `@miadi/llmops rehydrate` prints them. The chart stores both as given and
// hands them back with the resume command; resolving them is LLMOps' work.
const TRACE = 'miadi-tracing:ceremony/session/4b1f0c2e-7d3a-4f6e-9a51-0c2d9e8b7a10';
const REHYDRATE_WITH = 'miadi-tracing:ceremony/prompt/miadiRun-2610201200-mia-ep297-delay@3';

describe('a session carries its trace and the prompt that rehydrates it', () => {
  test('both are stored as given and returned beside the resume command when rehydrated', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const entry = await manager.delayResolution(written, {
      resolveBy: inDays(4),
      reason: 'resume when the sibling lineage lands',
      chosenBy: 'mia',
      session: { ...SESSION, trace: TRACE, rehydrateWith: REHYDRATE_WITH },
    });
    assert.equal(entry.session.trace, TRACE);
    assert.equal(entry.session.rehydrateWith, REHYDRATE_WITH);

    const stored = storedEntity(path, written).metadata.delayedResolution.session;
    assert.equal(stored.trace, TRACE, 'trace was not stored as given');
    assert.equal(stored.rehydrateWith, REHYDRATE_WITH, 'rehydrateWith was not stored as given');

    const [listed] = await manager.listDelayedResolutions();
    assert.equal(listed.session.trace, TRACE);
    assert.equal(listed.session.rehydrateWith, REHYDRATE_WITH);

    const ended = await manager.endDelayedResolution(written, { endedBy: 'William', outcome: 'rehydrated' });
    assert.equal(ended.resumeCommand, `cd ${SESSION.cwd} && claude --resume ${SESSION.sessionId}`);
    assert.equal(ended.trace, TRACE, 'trace was not returned beside resumeCommand');
    assert.equal(ended.rehydrateWith, REHYDRATE_WITH, 'rehydrateWith was not returned beside resumeCommand');
  });

  test('released returns neither, and the record keeps both', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(4),
      reason: 'r',
      chosenBy: 'mia',
      session: { ...SESSION, trace: TRACE, rehydrateWith: REHYDRATE_WITH },
    });
    const ended = await manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'released' });
    assert.equal(ended.resumeCommand, undefined);
    assert.equal(ended.trace, undefined);
    assert.equal(ended.rehydrateWith, undefined);
    const stored = storedEntity(path, written).metadata.delayedResolution.session;
    assert.equal(stored.trace, TRACE);
    assert.equal(stored.rehydrateWith, REHYDRATE_WITH);
  });

  test('a session without them ends rehydrated with the resume command only', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', session: SESSION });
    const ended = await manager.endDelayedResolution(written, { endedBy: 'mia', outcome: 'rehydrated' });
    assert.ok(ended.resumeCommand);
    assert.ok(!('trace' in ended), 'an absent trace was returned');
    assert.ok(!('rehydrateWith' in ended), 'an absent rehydrateWith was returned');
    assert.ok(!('trace' in ended.session) && !('rehydrateWith' in ended.session));
  });

  test("each is refused unless it begins with 'miadi-', and the store is left as it was", async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const before = readFileSync(path, 'utf8');
    for (const [field, value] of [
      ['trace', 'langfuse:trace/abc'],
      ['trace', ''],
      ['trace', 'Miadi-tracing:ceremony/session/x'],
      ['rehydrateWith', 'miadi'],
      ['rehydrateWith', 'tracing:ceremony/prompt/miadiRun-x@1'],
      ['rehydrateWith', 42],
    ]) {
      await assert.rejects(
        manager.delayResolution(written, {
          resolveBy: inDays(4),
          reason: 'r',
          chosenBy: 'mia',
          session: { ...SESSION, [field]: value },
        }),
        new RegExp(`session\\.${field} must be an address beginning with 'miadi-'`),
        `${field}=${JSON.stringify(value)} was accepted`,
      );
    }
    assert.equal(readFileSync(path, 'utf8'), before, 'a refused delay wrote to the store');
  });

  test('the MCP tools accept, refuse and return them', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);

    const refused = await handleToolCall(
      'delay_resolution',
      {
        actionStepName: written,
        resolveBy: inDays(4),
        reason: 'r',
        chosenBy: 'mia',
        session: { ...SESSION, trace: 'langfuse:trace/abc' },
      },
      manager,
    );
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /session\.trace must be an address beginning with 'miadi-'/);

    const delayed = await handleToolCall(
      'delay_resolution',
      {
        actionStepName: written,
        resolveBy: inDays(4),
        reason: 'r',
        chosenBy: 'mia',
        session: { ...SESSION, trace: TRACE, rehydrateWith: REHYDRATE_WITH },
      },
      manager,
    );
    assert.ok(!delayed.isError, delayed.content[0].text);
    assert.doesNotMatch(delayed.content[0].text, /ignored/);
    assert.match(delayed.content[0].text, new RegExp(`Trace: ${TRACE}`));
    assert.match(delayed.content[0].text, new RegExp(`Rehydrate with: ${REHYDRATE_WITH}`));

    const ended = await handleToolCall(
      'end_delayed_resolution',
      { actionStepName: written, endedBy: 'mia', outcome: 'rehydrated' },
      manager,
    );
    assert.ok(!ended.isError, ended.content[0].text);
    assert.match(ended.content[0].text, new RegExp(`trace: ${TRACE}`));
    assert.match(ended.content[0].text, new RegExp(`rehydrateWith: ${REHYDRATE_WITH}`));
    const json = JSON.parse(ended.content[0].text.slice(ended.content[0].text.indexOf('{')));
    assert.equal(json.trace, TRACE);
    assert.equal(json.rehydrateWith, REHYDRATE_WITH);
  });

  test('the delay_resolution schema declares both on its session', () => {
    const tool = ALL_TOOL_DEFINITIONS.find(t => t.name === 'delay_resolution');
    const session = tool.inputSchema.properties.session.properties;
    for (const field of ['trace', 'rehydrateWith']) {
      assert.equal(session[field]?.type, 'string', `${field} is not in the session schema`);
      assert.match(session[field].description, /miadi-/);
    }
  });

  test('the coaia CLI takes --trace and --rehydrate-with; delayed and end-delay show them', async () => {
    const { path } = fresh();
    const { written } = await seed(new KnowledgeGraphManager(path));
    const run = (...args) => execFileSync('node', [CLI, '-M', path, ...args], { encoding: 'utf8', stdio: 'pipe' });

    assert.throws(
      () => run('narrative', 'delay', written, '--resolve-by', inDays(5), '--reason', 'r', '--chosen-by', 'mia',
        '--session-id', SESSION.sessionId, '--rehydrate-with', 'prompt/miadiRun-x@1'),
      e => /session\.rehydrateWith must be an address beginning with 'miadi-'/.test(String(e.stderr)),
    );

    run(
      'narrative', 'delay', written,
      '--resolve-by', inDays(5),
      '--reason', 'resume when the review lands',
      '--chosen-by', 'mia',
      '--session-id', SESSION.sessionId,
      '--cwd', SESSION.cwd,
      '--trace', TRACE,
      '--rehydrate-with', REHYDRATE_WITH,
    );

    const text = run('narrative', 'delayed');
    assert.match(text, new RegExp(`Trace: ${TRACE}`));
    assert.match(text, new RegExp(`Rehydrate with: ${REHYDRATE_WITH}`));
    const [listed] = JSON.parse(run('--json', 'narrative', 'delayed'));
    assert.equal(listed.session.trace, TRACE);
    assert.equal(listed.session.rehydrateWith, REHYDRATE_WITH);

    const ended = JSON.parse(run('--json', 'narrative', 'end-delay', written, '--by', 'mia', '--outcome', 'rehydrated'));
    assert.equal(ended.resumeCommand, `cd ${SESSION.cwd} && claude --resume ${SESSION.sessionId}`);
    assert.equal(ended.trace, TRACE);
    assert.equal(ended.rehydrateWith, REHYDRATE_WITH);
  });
});

// 0.8.0: a delay names the follow-up prompt composed when it was chosen (Episode 297,
// feedback map V1, V2). At the date a talking circle takes it up: what is rehydrated is
// that prompt, "potentially with the session" (William). The chart stores its address
// as given and does not resolve it.
const FOLLOW_UP = {
  address: 'miadi-prompt:ceremony/ep297-follow-up-delay@2',
  text: 'Where does the delayed step stand now?\nWhat did the sibling lineage land?',
  composedBy: 'mia',
};

describe('a delay names its follow-up prompt', () => {
  test('stored as given, composedAt set to chosenAt, a caller value ignored; listed and rendered', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const entry = await manager.delayResolution(written, {
      resolveBy: inDays(6),
      reason: 'a circle takes it up at the date',
      chosenBy: 'william',
      followUpPrompt: { ...FOLLOW_UP, composedAt: '2001-01-01T00:00:00.000Z' },
    });
    assert.deepEqual(entry.followUpPrompt, {
      address: FOLLOW_UP.address,
      text: FOLLOW_UP.text,
      composedAt: entry.chosenAt,
      composedBy: 'mia',
    });

    const stored = storedEntity(path, written).metadata.delayedResolution;
    assert.equal(stored.followUpPrompt.address, FOLLOW_UP.address, 'the address was not stored as given');
    assert.equal(stored.followUpPrompt.composedAt, stored.chosenAt, "composedAt is not the delay's chosenAt");

    const [listed] = await manager.listDelayedResolutions();
    assert.equal(listed.followUpPrompt.address, FOLLOW_UP.address);
    const listing = await handleToolCall('list_delayed_resolutions', {}, manager);
    assert.match(listing.content[0].text, new RegExp(`Follow-up prompt: ${FOLLOW_UP.address} \\(composed by mia\\)`));
  });

  test('address alone is enough; text and composedBy are left out when not given', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    const entry = await manager.delayResolution(written, {
      resolveBy: inDays(6),
      reason: 'r',
      chosenBy: 'mia',
      followUpPrompt: { address: FOLLOW_UP.address },
    });
    assert.deepEqual(Object.keys(entry.followUpPrompt), ['address', 'composedAt']);
  });

  test("an address not beginning with 'miadi-' is refused, and the store is left as it was", async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    const before = readFileSync(path, 'utf8');
    for (const followUpPrompt of [
      { address: 'prompt:ceremony/x@1' },
      { address: '' },
      { address: 'Miadi-prompt:ceremony/x@1' },
      { address: 42 },
      { text: 'no address' },
    ]) {
      await assert.rejects(
        manager.delayResolution(written, { resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt }),
        /followUpPrompt\.address must be an address beginning with 'miadi-'/,
        `${JSON.stringify(followUpPrompt)} was accepted`,
      );
    }
    await assert.rejects(
      manager.delayResolution(written, {
        resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: 'miadi-prompt:ceremony/x@1',
      }),
      /followUpPrompt must be an object/,
    );
    await assert.rejects(
      manager.delayResolution(written, {
        resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: { address: FOLLOW_UP.address, text: 7 },
      }),
      /followUpPrompt\.text must be a string/,
    );
    assert.equal(readFileSync(path, 'utf8'), before, 'a refused delay wrote to the store');
  });

  test('a re-delay moves the open record, with its follow-up prompt, into history', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(3), reason: 'first', chosenBy: 'mia', followUpPrompt: FOLLOW_UP,
    });
    const second = { address: 'miadi-prompt:ceremony/ep297-follow-up-delay@3' };
    const entry = await manager.delayResolution(written, {
      resolveBy: inDays(9), reason: 'second', chosenBy: 'mia', followUpPrompt: second,
    });
    assert.equal(entry.historyCount, 1);
    const meta = storedEntity(path, written).metadata;
    assert.equal(meta.delayedResolutionHistory[0].followUpPrompt.address, FOLLOW_UP.address);
    assert.equal(meta.delayedResolutionHistory[0].followUpPrompt.text, FOLLOW_UP.text);
    assert.equal(meta.delayedResolution.followUpPrompt.address, second.address);
  });

  test('rehydrated returns the follow-up prompt beside resumeCommand', async () => {
    const { manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', session: SESSION, followUpPrompt: FOLLOW_UP,
    });
    const ended = await manager.endDelayedResolution(written, { endedBy: 'william', outcome: 'rehydrated' });
    assert.equal(ended.resumeCommand, `cd ${SESSION.cwd} && claude --resume ${SESSION.sessionId}`);
    assert.equal(ended.followUpPrompt.address, FOLLOW_UP.address);
    assert.equal(ended.followUpPrompt.text, FOLLOW_UP.text);
  });

  test('a delay with a follow-up prompt and no session ends as rehydrated, with no resume command', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: FOLLOW_UP,
    });
    const result = await handleToolCall(
      'end_delayed_resolution',
      { actionStepName: written, endedBy: 'william', outcome: 'rehydrated' },
      manager,
    );
    assert.ok(!result.isError, result.content[0].text);
    const text = result.content[0].text;
    assert.match(text, /ended as rehydrated/);
    assert.match(text, new RegExp(`Follow-up prompt: ${FOLLOW_UP.address}`));
    assert.match(text, /^  Where does the delayed step stand now\?$/m, 'the prompt text was not printed');
    assert.doesNotMatch(text, /Rehydrate with:/);
    const json = JSON.parse(text.slice(text.indexOf('{')));
    assert.equal(json.followUpPrompt.address, FOLLOW_UP.address);
    assert.equal(json.resumeCommand, undefined);
    assert.equal(storedEntity(path, written).metadata.delayedResolution.outcome, 'rehydrated');
  });

  test('released keeps the follow-up prompt on the record and does not print it as rehydrated', async () => {
    const { path, manager } = fresh();
    const { written } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: FOLLOW_UP,
    });
    const result = await handleToolCall(
      'end_delayed_resolution',
      { actionStepName: written, endedBy: 'mia', outcome: 'released' },
      manager,
    );
    assert.ok(!result.isError, result.content[0].text);
    assert.doesNotMatch(result.content[0].text.split('\n\n')[0], /Follow-up prompt/);
    assert.equal(storedEntity(path, written).metadata.delayedResolution.followUpPrompt.address, FOLLOW_UP.address);
  });

  test('the MCP delay_resolution schema declares it, and the tool accepts and refuses it', async () => {
    const tool = ALL_TOOL_DEFINITIONS.find(t => t.name === 'delay_resolution');
    const schema = tool.inputSchema.properties.followUpPrompt;
    assert.equal(schema?.type, 'object', 'followUpPrompt is not in the delay_resolution schema');
    assert.deepEqual(schema.required, ['address']);
    assert.deepEqual(Object.keys(schema.properties).sort(), ['address', 'composedBy', 'text']);
    assert.match(schema.properties.address.description, /miadi-/);

    const { manager } = fresh();
    const { written } = await seed(manager);
    const refused = await handleToolCall(
      'delay_resolution',
      { actionStepName: written, resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: { address: 'prompt/x@1' } },
      manager,
    );
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /followUpPrompt\.address must be an address beginning with 'miadi-'/);

    const delayed = await handleToolCall(
      'delay_resolution',
      { actionStepName: written, resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: FOLLOW_UP },
      manager,
    );
    assert.ok(!delayed.isError, delayed.content[0].text);
    assert.doesNotMatch(delayed.content[0].text, /ignored/i);
    assert.match(delayed.content[0].text, new RegExp(`Follow-up prompt: ${FOLLOW_UP.address}`));
  });

  test('the markdown export shows the address wherever it shows the delay', async () => {
    const { manager } = fresh();
    const { chartId, written, telescoped, telescopedChartId } = await seed(manager);
    await manager.delayResolution(written, {
      resolveBy: inDays(4), reason: 'r', chosenBy: 'mia', followUpPrompt: FOLLOW_UP,
    });
    await manager.delayResolution(telescoped, {
      resolveBy: inDays(5), reason: 'r', chosenBy: 'mia', followUpPrompt: { address: 'miadi-prompt:ceremony/telescoped@1' },
    });
    assert.match(await exportChartToMarkdown(chartId, manager), new RegExp(`\\*\\*Follow-up prompt\\*\\*: ${FOLLOW_UP.address}`));
    assert.match(await exportChartToMarkdown(telescopedChartId, manager), /\*\*Follow-up prompt\*\*: miadi-prompt:ceremony\/telescoped@1/);
    assert.match(await exportChartProgress(chartId, manager), new RegExp(`Follow-up prompt: ${FOLLOW_UP.address}`));
    assert.match(await exportAllChartsToMarkdown(manager), /Follow-up prompt: miadi-prompt:ceremony\/telescoped@1/);
  });

  test('the coaia CLI takes --follow-up-prompt, --follow-up-text and --follow-up-by; delayed and end-delay show it', async () => {
    const { path } = fresh();
    const { written } = await seed(new KnowledgeGraphManager(path));
    const run = (...args) => execFileSync('node', [CLI, '-M', path, ...args], { encoding: 'utf8', stdio: 'pipe' });
    const base = ['narrative', 'delay', written, '--resolve-by', inDays(5), '--reason', 'r', '--chosen-by', 'mia'];

    for (const extra of [['--follow-up-text', 'orphan'], ['--follow-up-by', 'mia']]) {
      assert.throws(
        () => run(...base, ...extra),
        e => e.status === 1 && /--follow-up-prompt <address> is required when --follow-up-text or --follow-up-by is given/.test(String(e.stderr)),
        `${extra[0]} without --follow-up-prompt was accepted`,
      );
    }
    assert.throws(
      () => run(...base, '--follow-up-prompt', 'prompt:ceremony/x@1'),
      e => e.status === 1 && /followUpPrompt\.address must be an address beginning with 'miadi-'/.test(String(e.stderr)),
    );

    run(...base, '--follow-up-prompt', FOLLOW_UP.address, '--follow-up-text', 'Where does it stand?', '--follow-up-by', 'mia');

    assert.match(run('narrative', 'delayed'), new RegExp(`Follow-up prompt: ${FOLLOW_UP.address} \\(composed by mia\\)`));
    const [listed] = JSON.parse(run('--json', 'narrative', 'delayed'));
    assert.equal(listed.followUpPrompt.address, FOLLOW_UP.address);
    assert.equal(listed.followUpPrompt.text, 'Where does it stand?');
    assert.equal(listed.followUpPrompt.composedAt, listed.chosenAt);

    const ended = JSON.parse(run('--json', 'narrative', 'end-delay', written, '--by', 'william', '--outcome', 'rehydrated'));
    assert.equal(ended.outcome, 'rehydrated');
    assert.equal(ended.followUpPrompt.address, FOLLOW_UP.address);
    assert.equal(ended.resumeCommand, undefined);
  });
});

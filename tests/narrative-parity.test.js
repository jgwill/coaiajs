/**
 * Narrative lineage parity — coaia-narrative v0.13.2…v0.16.2 behaviours in coaiajs.
 *
 * Each test names the behaviour it holds and, where the behaviour was earned by a
 * measured failure upstream, what that failure was. These run against the built
 * output, so they exercise the same modules a consumer imports.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  KnowledgeGraphManager,
  handleToolCall,
  parseGithubIssueSpec,
  validate,
  ValidationSchemas,
  ALL_TOOL_DEFINITIONS,
  WAMPUM_TOOLS,
  parseJsonlMemory,
  serializeJsonlMemory,
  findUnparsedCallSyntax,
  normalizeGithubBridgeMetadata,
  createGithubProjectFieldProjection,
  contract,
} from '../dist/src/narrative/index.js';

let dir;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'coaiajs-narrative-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

let storeCounter = 0;
function newStore() {
  return join(dir, `store-${++storeCounter}.jsonl`);
}

function managerWithStore() {
  const path = newStore();
  return { path, manager: new KnowledgeGraphManager(path) };
}

const FUTURE = '2027-12-31T12:00:00.000Z';

async function seedChart(manager, overrides = {}) {
  return manager.createStructuralTensionChart(
    overrides.desiredOutcome ?? 'A working narrative parity suite exists',
    overrides.currentReality ?? 'The port has landed, nothing has been exercised yet',
    overrides.dueDate ?? FUTURE,
    overrides.actionSteps,
    overrides.elementsOfPerformance,
    overrides.githubIssue,
  );
}

function readRecords(path) {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

// ─────────────────────────────────────────────────────────────────────
describe('F1 — JSONL preservation and atomic writes', () => {
  test('a field this package does not model survives a write', async () => {
    const path = newStore();
    writeFileSync(
      path,
      [
        JSON.stringify({
          type: 'entity',
          name: 'chart_seed_chart',
          entityType: 'structural_tension_chart',
          observations: ['seeded'],
          metadata: { chartId: 'chart_seed', dueDate: FUTURE, level: 0, atlasPacket: 'foundations/x' },
          coaiaGithubCursor: 'abc123',
        }),
        JSON.stringify({
          type: 'entity',
          name: 'chart_seed_current_reality',
          entityType: 'current_reality',
          observations: ['nothing exercised yet'],
          metadata: { chartId: 'chart_seed' },
        }),
      ].join('\n') + '\n',
      'utf-8',
    );

    const manager = new KnowledgeGraphManager(path);
    await manager.updateCurrentReality('chart_seed', ['one observation added']);

    const records = readRecords(path);
    const chart = records.find(r => r.name === 'chart_seed_chart');
    assert.equal(chart.coaiaGithubCursor, 'abc123', 'top-level extension field was dropped');
    assert.equal(chart.metadata.atlasPacket, 'foundations/x', 'metadata extension field was dropped');

    const reality = records.find(r => r.name === 'chart_seed_current_reality');
    assert.ok(reality.observations.includes('one observation added'));
  });

  test('the legacy type:"narrative_beat" dialect round-trips as itself', () => {
    const line = JSON.stringify({
      type: 'narrative_beat',
      name: 'beat_1',
      observations: ['a beat'],
      narrative: { description: 'd', prose: 'p', lessons: [] },
      four_directions: { north_vision: 'n', east_intention: null, south_emotion: null, west_introspection: null },
    });

    const graph = parseJsonlMemory(line + '\n');
    assert.equal(graph.entities.length, 1, 'a legacy beat was not read as an entity');
    assert.equal(graph.entities[0].entityType, 'narrative_beat');
    assert.equal(graph.entities[0].metadata.narrative.description, 'd');

    const out = JSON.parse(serializeJsonlMemory(graph).trim());
    assert.equal(out.type, 'narrative_beat', 'the legacy record type was flattened to "entity"');
    assert.deepEqual(out.four_directions, {
      north_vision: 'n',
      east_intention: null,
      south_emotion: null,
      west_introspection: null,
    });
  });

  test('a write leaves no temp file behind and never an empty store', async () => {
    const { path, manager } = managerWithStore();
    await seedChart(manager);
    const leftovers = readdirSync(dir).filter(f => f.includes('.tmp-'));
    assert.deepEqual(leftovers, [], 'a temp file survived the rename');
    assert.ok(readFileSync(path, 'utf-8').length > 0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F2 — unparsed call syntax is refused at the write boundary', () => {
  test('ordinary prose with angle brackets is not refused', () => {
    for (const ok of ['a < b and b > c', 'use <rootDir> in the config', 'render a <div> here']) {
      assert.equal(findUnparsedCallSyntax(ok), null, `refused innocent text: ${ok}`);
    }
  });

  test('a closing argument tag is named and refused', () => {
    const hit = findUnparsedCallSyntax('the store is live</currentReality>');
    assert.ok(hit, 'unparsed call syntax was not detected');
    assert.match(hit.reason, /currentReality/);
  });

  test('the tool call is refused and the store is left untouched', async () => {
    const { path, manager } = managerWithStore();
    const result = await handleToolCall(
      'create_structural_tension_chart',
      {
        desiredOutcome: 'A store that holds prose',
        currentReality: 'The tags did not parse</currentReality>',
        dueDate: FUTURE,
      },
      manager,
    );
    assert.equal(result.isError, true, 'a malformed call was accepted');
    assert.match(result.content[0].text, /Malformed call refused — nothing was written/);
    assert.equal(existsSync(path), false, 'the refused call created a store');
  });

  test('a batch where one body is malformed writes none of it', async () => {
    const { path, manager } = managerWithStore();
    await assert.rejects(
      () =>
        manager.createEntities([
          { name: 'good', entityType: 'note', observations: ['fine'] },
          { name: 'bad', entityType: 'note', observations: ['</dueDate>'] },
        ]),
      /Malformed call refused/,
    );
    assert.equal(existsSync(path), false, 'half a malformed batch landed');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F3 — the read contract', () => {
  test('classification matches the writer, and a bad line is skipped not fatal', () => {
    const raw = [
      JSON.stringify({ type: 'entity', name: 'a_chart', entityType: 'structural_tension_chart', observations: [], metadata: { chartId: 'a' } }),
      '{ not json',
      JSON.stringify({ type: 'narrative_beat', name: 'beat_1', observations: [] }),
    ].join('\n');

    const store = contract.parseStore(raw);
    assert.equal(store.entities.size, 2, 'the legacy beat dialect was dropped by the contract');
    assert.equal(store.entities.get('beat_1').entityType, 'narrative_beat');
    assert.equal(store.skipped, 1, 'the malformed line was not reported');
  });

  test('the contract publishes every entity kind the writer writes', () => {
    const written = new Set(['structural_tension_chart', 'desired_outcome', 'current_reality', 'action_step', 'narrative_beat', 'wampum_belt']);
    const published = new Set(Object.values(contract.ENTITY_TYPES));
    for (const kind of written) {
      assert.ok(published.has(kind), `contract does not publish entity kind ${kind}`);
    }
  });

  test('naming helpers agree with the store the manager writes', async () => {
    const { path, manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    const store = contract.parseStore(readFileSync(path, 'utf-8'));
    assert.ok(contract.getChartEntity(store, chartId), 'chartEntityName disagrees with the writer');
    assert.ok(contract.getDesiredOutcome(store, chartId));
    assert.ok(contract.getCurrentReality(store, chartId));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F4 — GitHub bridge', () => {
  test('a bare #number is refused; the full path is accepted', () => {
    assert.throws(() => parseGithubIssueSpec('#42'), /full path 'owner\/repo#number'/);
    assert.throws(() => parseGithubIssueSpec('coaiajs#42'), /full path/);
    assert.deepEqual(parseGithubIssueSpec('jgwill/coaiajs#7'), {
      owner: 'jgwill',
      repo: 'coaiajs',
      number: 7,
      url: 'https://github.com/jgwill/coaiajs/issues/7',
    });
  });

  test('a chart can be created carrying its issue, and linked afterwards', async () => {
    const { manager } = managerWithStore();
    const created = await seedChart(manager, { githubIssue: 'jgwill/coaiajs#7' });
    const chartEntity = created.entities.find(e => e.entityType === 'structural_tension_chart');
    assert.equal(chartEntity.metadata.github.issue.number, 7);

    const second = await seedChart(manager, { desiredOutcome: 'A second chart exists' });
    const linked = await manager.linkChartToGithubIssue(second.chartId, 'jgwill/coaiajs#9');
    assert.equal(linked.issue.repo, 'coaiajs');

    const graph = await manager.readGraph();
    const stored = graph.entities.find(e => e.name === `${second.chartId}_chart`);
    assert.equal(stored.metadata.github.issue.number, 9);
  });

  test('legacy sync_target metadata normalises into the current shape', () => {
    const normalized = normalizeGithubBridgeMetadata({
      sync_target: { owner: 'jgwill', repo: 'coaiajs', issue_number: 3, project_number: 2, project_owner: 'jgwill', item_id: 'IT_1' },
    });
    assert.equal(normalized.issue.number, 3);
    assert.ok(normalized.sources.includes('metadata.sync_target'));
  });

  test('a chart projects into the GitHub Project field shape', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    const projection = await manager.getGithubProjectFieldProjection(chartId);
    assert.ok(projection, 'a chart in the store did not project');
    assert.equal(typeof projection.goal, 'string');
    assert.ok(createGithubProjectFieldProjection);
  });

  test('the tool refuses a bare number too', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    await assert.rejects(() => manager.linkChartToGithubIssue(chartId, '#12'), /full path/);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F5 — Wampum Belt sequencing', () => {
  test('the three tools are declared and grouped', () => {
    const names = new Set(ALL_TOOL_DEFINITIONS.map(t => t.name));
    for (const tool of WAMPUM_TOOLS) {
      assert.ok(names.has(tool), `${tool} is not declared`);
    }
  });

  test('a belt holds beads by position, and a position is written once', async () => {
    const { manager } = managerWithStore();
    const { beltId } = await manager.createWampumBelt('Parity belt', 'Remember the port', 2, 3);

    await manager.addWampumBead(beltId, 'first', 'white', { row: 0, col: 0 }, 'the opening');
    await assert.rejects(
      () => manager.addWampumBead(beltId, 'again', 'purple', { row: 0, col: 0 }, 'collides'),
      /already occupied/,
    );
    await assert.rejects(
      () => manager.addWampumBead(beltId, 'far', 'white', { row: 5, col: 0 }, 'out'),
      /out of bounds/,
    );

    const { belt, bead, positionalReading } = await manager.readWampumBelt(beltId, { row: 0, col: 0 });
    assert.equal(belt.beads.length, 1);
    assert.equal(bead.mnemonic, 'first');
    assert.equal(positionalReading, 'the opening');
  });

  test('relational readings are chosen by position', async () => {
    const { manager } = managerWithStore();
    const { beltId } = await manager.createWampumBelt('Readings', 'Perspective', 1, 3);
    await manager.addWampumBead(beltId, 'centre', 'mixed', { row: 0, col: 1 }, 'canonical', {
      center: 'seen from the middle',
    });
    const read = await manager.readWampumBelt(beltId, { row: 0, col: 1 });
    assert.equal(read.positionalReading, 'seen from the middle');
  });

  test('two beads linking one chart each keep their own ceremony edge', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    const { beltId } = await manager.createWampumBelt('Ceremony', 'Accountability', 1, 2);

    await manager.addWampumBead(beltId, 'commit', 'white', { row: 0, col: 0 }, 'commitment', undefined, {
      ceremonyType: 'commitment',
      chartId,
    });
    await manager.addWampumBead(beltId, 'witness', 'purple', { row: 0, col: 1 }, 'witnessing', undefined, {
      ceremonyType: 'witness',
      chartId,
    });

    const graph = await manager.readGraph();
    const edges = graph.relations.filter(r => r.relationType === 'wampum_holds_accountable');
    assert.equal(edges.length, 2, 'the second ceremony link was silently discarded');
    assert.deepEqual(
      edges.map(e => e.metadata.context).sort(),
      ['commitment', 'witness'],
      'ceremony types collapsed onto one edge',
    );
  });

  test('a non-integer grid is refused', async () => {
    const { manager } = managerWithStore();
    await assert.rejects(() => manager.createWampumBelt('bad', 'grid', 1.5, 2), /positive integers/);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F6 — update_chart_due_date', () => {
  test('the chart and its desired outcome move together, and the move is recorded', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);

    const moved = await manager.updateChartDueDate(chartId, '2028-01-15T00:00:00Z');
    assert.equal(moved.previousDueDate, FUTURE);
    assert.equal(moved.newDueDate, '2028-01-15T00:00:00.000Z');

    const graph = await manager.readGraph();
    const chart = graph.entities.find(e => e.name === `${chartId}_chart`);
    const outcome = graph.entities.find(e => e.name === `${chartId}_desired_outcome`);
    assert.equal(chart.metadata.dueDate, '2028-01-15T00:00:00.000Z');
    assert.equal(outcome.metadata.dueDate, '2028-01-15T00:00:00.000Z');
    assert.ok(chart.observations.some(o => o.startsWith('Due date changed from')));
  });

  test('open steps past the new date are reported, and redistributed on request', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, { actionSteps: ['draft the suite', 'run the suite'] });

    const pulled = await manager.updateChartDueDate(chartId, '2027-01-15T00:00:00Z');
    assert.equal(pulled.actionStepsRescheduled, 0);
    assert.equal(pulled.actionStepsPastDueDate, 2, 'steps left past the new date were not reported');

    const spread = await manager.updateChartDueDate(chartId, '2027-02-15T00:00:00Z', true);
    assert.equal(spread.actionStepsRescheduled, 2);
    assert.equal(spread.actionStepsPastDueDate, 0);

    const graph = await manager.readGraph();
    const steps = graph.entities.filter(e => e.entityType === 'action_step');
    for (const step of steps) {
      assert.ok(
        new Date(step.metadata.dueDate).getTime() <= Date.parse('2027-02-15T00:00:00Z'),
        'a redistributed step still falls after the chart',
      );
    }
  });

  test('an unparseable date is refused', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    await assert.rejects(() => manager.updateChartDueDate(chartId, 'next tuesday'), /Invalid due date/);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F7 — a chart holding telescoped work no longer reports 0/0', () => {
  test('child charts created by add_action_step are counted', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);

    await manager.addActionStep(chartId, 'Write the parity suite', undefined, 'No tests written yet');
    await manager.addActionStep(chartId, 'Run the parity suite', undefined, 'Suite not yet runnable');

    const progress = await manager.getChartProgress(chartId);
    assert.equal(progress.totalActions, 2, 'telescoped work was invisible to progress');
    assert.equal(progress.completedActions, 0);
  });

  test('a child telescoped out of a step counts once, through the step', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, { actionSteps: ['draft the suite'] });

    const before = await manager.getChartProgress(chartId);
    assert.equal(before.totalActions, 1);

    await manager.telescopeActionStep(`${chartId}_action_1`, 'Nothing drafted yet');

    const after = await manager.getChartProgress(chartId);
    assert.equal(after.totalActions, 1, 'a telescoped step was counted twice');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F8 — list_active_charts renders a chart\'s own action steps', () => {
  test('the summary carries them', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, { actionSteps: ['draft the suite', 'run the suite'] });
    const charts = await manager.listActiveCharts();
    const summary = charts.find(c => c.chartId === chartId);
    assert.equal(summary.actionSteps.length, 2, "a chart's own steps were reported absent");
    assert.equal(summary.actionSteps[0].title, 'draft the suite');
  });

  test('the rendered hierarchy shows them, and a telescoped step appears once', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, { actionSteps: ['draft the suite', 'run the suite'] });
    await manager.telescopeActionStep(`${chartId}_action_1`, 'Nothing drafted yet');

    const text = (await handleToolCall('list_active_charts', {}, manager)).content[0].text;
    assert.ok(!text.includes('(No action steps yet)'), 'a chart holding work rendered as empty');
    assert.ok(text.includes('run the suite'), "the chart's own remaining step was not rendered");
    assert.equal(
      (text.match(/draft the suite/g) || []).length,
      1,
      'a telescoped step rendered twice, as two open results',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F9 — the creative-orientation guard reads words, not letters', () => {
  test('innocent text carrying these letters inside longer words is accepted', async () => {
    for (const outcome of [
      'A fixed ladder of named rungs exists',
      'Each action step resolves tension between current and desired states',
      'An unstoppable rhythm of weekly releases is established',
    ]) {
      const { manager } = managerWithStore();
      await seedChart(manager, { desiredOutcome: outcome });
    }
  });

  test('a genuinely problem-oriented outcome is still met with the teaching', async () => {
    const { manager } = managerWithStore();
    await assert.rejects(
      () => seedChart(manager, { desiredOutcome: 'Eliminate the flaky tests' }),
      /CREATIVE ORIENTATION REQUIRED/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F10 — MMOT: updateReality governs one record', () => {
  test('the evaluation survives when current reality is left alone', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, {
      elementsOfPerformance: [{ description: 'The suite runs green', type: 'EXECUTION' }],
    });

    const result = await handleToolCall(
      'perform_mmot_evaluation',
      { chartId, phase: 'acknowledge', assessment: 'Two of nine checks are unwritten', updateReality: false },
      manager,
    );

    assert.match(result.content[0].text, /chart MMOT trail \(current reality left untouched/);

    const graph = await manager.readGraph();
    const chart = graph.entities.find(e => e.name === `${chartId}_chart`);
    const reality = graph.entities.find(e => e.name === `${chartId}_current_reality`);
    assert.equal(chart.metadata.mmotEvaluations.length, 1, 'the evaluation was lost with the flag');
    assert.ok(
      !reality.observations.some(o => o.startsWith('[MMOT')),
      'current reality was written to despite updateReality:false',
    );
  });

  test('both records are written by default, and the line says so', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager);
    const result = await handleToolCall(
      'perform_mmot_evaluation',
      { chartId, phase: 'acknowledge', assessment: 'Nine checks written, none run' },
      manager,
    );
    assert.match(result.content[0].text, /chart MMOT trail \+ current reality/);

    const graph = await manager.readGraph();
    const reality = graph.entities.find(e => e.name === `${chartId}_current_reality`);
    assert.ok(reality.observations.some(o => o.startsWith('[MMOT acknowledge]')));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F11 — validation names every problem, and what it ignored', () => {
  test('two missing fields are reported in one exchange', () => {
    const result = validate(
      { desiredOutcome: 'x' },
      {
        desiredOutcome: ValidationSchemas.nonEmptyString(),
        currentReality: ValidationSchemas.nonEmptyString(),
        dueDate: ValidationSchemas.isoDate(),
      },
    );
    assert.equal(result.valid, false);
    assert.match(result.error, /currentReality/);
    assert.match(result.error, /dueDate/);
  });

  test('an unknown argument is not fatal, but is named', () => {
    const result = validate({ chartId: 'c' }, { chartId: ValidationSchemas.nonEmptyString() });
    assert.equal(result.valid, true);
    assert.equal(result.ignored, undefined);

    const withExtra = validate(
      { chartId: 'c', dueDate: FUTURE },
      { chartId: ValidationSchemas.nonEmptyString() },
    );
    assert.equal(withExtra.valid, true);
    assert.deepEqual(withExtra.ignored, ['dueDate']);
  });

  test('a successful tool call says which argument it dropped', async () => {
    const { manager } = managerWithStore();
    const result = await handleToolCall(
      'create_structural_tension_chart',
      {
        desiredOutcome: 'A chart exists',
        currentReality: 'No chart written yet',
        dueDate: FUTURE,
        dueDte: FUTURE,
      },
      manager,
    );
    assert.ok(!result.isError, 'an unknown argument became fatal');
    const joined = result.content.map(c => c.text).join('\n');
    assert.match(joined, /Ignored unrecognised argument\(s\): dueDte/);
  });

  test('elementsOfPerformance and githubIssue are no longer reported as unknown', async () => {
    const { manager } = managerWithStore();
    const result = await handleToolCall(
      'create_structural_tension_chart',
      {
        desiredOutcome: 'A chart exists',
        currentReality: 'No chart written yet',
        dueDate: FUTURE,
        elementsOfPerformance: [{ description: 'ships', type: 'EXECUTION' }],
        githubIssue: 'jgwill/coaiajs#1',
      },
      manager,
    );
    const joined = result.content.map(c => c.text).join('\n');
    assert.ok(!joined.includes('Ignored unrecognised'), joined);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F12 — telescope_action_step accepts the sibling tool\'s argument name', () => {
  test('steps supplied as actionSteps are not dropped into a success', async () => {
    const { manager } = managerWithStore();
    const { chartId } = await seedChart(manager, { actionSteps: ['draft the suite'] });

    await handleToolCall(
      'telescope_action_step',
      {
        actionStepName: `${chartId}_action_1`,
        newCurrentReality: 'Nothing drafted yet',
        actionSteps: ['outline the cases', 'write the assertions'],
      },
      manager,
    );

    const graph = await manager.readGraph();
    const child = graph.entities.find(
      e => e.entityType === 'structural_tension_chart' && e.metadata?.parentActionStep === `${chartId}_action_1`,
    );
    assert.ok(child, 'the telescoped chart was not created');
    const childSteps = graph.entities.filter(
      e => e.entityType === 'action_step' && e.metadata?.chartId === child.metadata.chartId,
    );
    assert.equal(childSteps.length, 2, 'the steps vanished into a success');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('F14 — a memory path carrying an unexpanded shell variable is refused', () => {
  test('the manager refuses to open it, naming what happened', () => {
    assert.throws(
      () => new KnowledgeGraphManager('${MIADI_CHART_MEMORY_PATH}'),
      /unexpanded shell variable/,
    );
  });

  test('a legitimate path containing $ is still accepted', () => {
    const path = join(dir, 'has$dollar.jsonl');
    assert.doesNotThrow(() => new KnowledgeGraphManager(path));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('tool surface', () => {
  test('every new tool is declared and routable', async () => {
    const declared = new Set(ALL_TOOL_DEFINITIONS.map(t => t.name));
    for (const name of [
      'update_chart_due_date',
      'link_chart_to_github_issue',
      'create_wampum_belt',
      'add_wampum_bead',
      'read_wampum_belt',
    ]) {
      assert.ok(declared.has(name), `${name} is not declared`);
    }
  });

  test('an unknown tool name is still an error, not a silent success', async () => {
    const { manager } = managerWithStore();
    const result = await handleToolCall('no_such_tool', {}, manager);
    assert.equal(result.isError, true);
  });
});

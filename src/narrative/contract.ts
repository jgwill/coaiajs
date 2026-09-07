/**
 * COAIA Narrative — the store read contract.
 *
 * WHAT THIS IS FOR
 *
 * This package owns the writes. Anything that renders a chart store was, until now,
 * re-deriving the store's shape by hand — entity-kind strings, the `${chartId}_chart`
 * naming scheme, which metadata key holds the MMOT trail. That knowledge living in two
 * places is not a style problem: when it drifts, a renderer does not break, it quietly
 * renders LESS. A chart holding real work looks identical to an empty one.
 *
 * HOW IT AVOIDS BEING THE THING IT WARNS ABOUT
 *
 * The first draft of this module re-implemented record classification by hand, and a
 * review measured it returning 73 entities where the writer's own parser returned 76 —
 * it dropped the legacy `type:"narrative_beat"` dialect and reported the losses as
 * corruption. Duplication relocated rather than removed.
 *
 * So classification is NOT defined here. `./jsonl-records.js` holds the single
 * definition, and both the writer (jsonl-preservation.ts) and this contract import it.
 * What this module adds on top is the two things the writer's parser genuinely does not
 * offer a renderer: per-line TOLERANCE (parseJsonlMemory throws on one bad line, which
 * is correct for a writer and fatal for a surface), and the selectors/naming below.
 *
 * THREE RULES THIS MODULE KEEPS
 *
 * 1. Zero I/O. No `fs`, no `process`, no network. Callers own reading; this owns shape.
 * 2. Never imports the server. The package's `main` IS the MCP bootstrap — importing the
 *    package root starts a stdio server — which is why this lives behind its own subpath.
 * 3. Tolerant by construction, honest about what it skipped.
 */

import type { Entity, JsonlRecord } from '../types.js';
import {
  isEntityRecord,
  isLegacyNarrativeBeatRecord,
  isRelationRecord,
  normalizeLegacyNarrativeBeat,
} from './jsonl-records.js';

/** Bumped when a shape changes in a way a reader must notice. */
export const CONTRACT_VERSION = 2;

// ---------------------------------------------------------------------------
// Entity kinds
// ---------------------------------------------------------------------------

/**
 * Every entityType this package writes. `test-contract.js` scans this package's own
 * source and fails if a kind is written that this list does not publish — so the
 * contract cannot fall behind the writer without the suite going red.
 */
export const ENTITY_TYPES = {
  chart: 'structural_tension_chart',
  desiredOutcome: 'desired_outcome',
  currentReality: 'current_reality',
  actionStep: 'action_step',
  narrativeBeat: 'narrative_beat',
  wampumBelt: 'wampum_belt',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/**
 * `EntityType | (string & {})` rather than `EntityType | string`: the latter collapses
 * to plain `string`, which silently permits `e.entityType === 'strucutral_tension_chart'`
 * — a typo that compiles clean and renders nothing. This form keeps autocomplete AND
 * keeps the comparison checked, while still accepting kinds written by a newer writer.
 */
export type EntityTypeLike = EntityType | (string & {});

/**
 * MMOT phases, as the writer accepts them. `'full'` is included deliberately: it is the
 * tool's DEFAULT (`phase: string = 'full'`) and appears in live stores. An earlier draft
 * omitted it, which would have made a phase rail built from this list silently drop
 * every default-phase evaluation.
 */
export const MMOT_PHASES = ['full', 'acknowledge', 'analyze', 'update', 'recommit'] as const;
export type MmotPhase = (typeof MMOT_PHASES)[number];

export const isMmotPhase = (v: unknown): v is MmotPhase =>
  typeof v === 'string' && (MMOT_PHASES as readonly string[]).includes(v);

/**
 * Fritz's creating phases, carried on a chart as `metadata.phase`. Published alongside
 * MMOT_PHASES because both occupy the key `phase` in different records, and a reader
 * that assumes one vocabulary when it holds the other gets a confident wrong answer.
 */
export const CREATING_PHASES = ['germination', 'assimilation', 'completion'] as const;
export type CreatingPhase = (typeof CREATING_PHASES)[number];

export type Direction = 'North' | 'South' | 'East' | 'West';

// ---------------------------------------------------------------------------
// Naming scheme
// ---------------------------------------------------------------------------

export const chartEntityName = (chartId: string) => `${chartId}_chart`;
export const desiredOutcomeName = (chartId: string) => `${chartId}_desired_outcome`;
export const currentRealityName = (chartId: string) => `${chartId}_current_reality`;

/** MMOT narrative beats are named `${chartId}_mmot_${epochMs}`. */
export const mmotBeatPrefix = (chartId: string) => `${chartId}_mmot_`;
export const isMmotBeatName = (name: string, chartId: string) =>
  name.startsWith(mmotBeatPrefix(chartId));

// ---------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------

/** One entry in a chart's MMOT trail (`chart.metadata.mmotEvaluations`). */
export interface MmotEvaluation {
  phase: MmotPhase | (string & {});
  assessment: string;
  direction?: Direction | (string & {});
  timestamp?: string;
}

export interface StoreEntity {
  name: string;
  entityType: EntityTypeLike;
  observations?: string[];
  metadata?: Record<string, unknown>;
  type: string;
}

export interface StoreRelation {
  from: string;
  to: string;
  relationType: string;
  metadata?: Record<string, unknown>;
  type: 'relation';
}

export interface ParsedStore {
  /** Keyed by entity name; a later record for the same name supersedes an earlier one. */
  entities: Map<string, StoreEntity>;
  relations: StoreRelation[];
  /**
   * Lines that were not valid JSON, or were valid JSON that the writer's own predicates
   * do not classify as any known record. NOT a corruption count on its own — see the
   * warning on `parseStore` about what this can and cannot detect.
   */
  skipped: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse raw JSONL store content. Pure: give it a string, get records back.
 *
 * Classification is delegated to the writer's own predicates, so every dialect the
 * writer round-trips — including the legacy top-level `type:"narrative_beat"` form — is
 * read here identically. The only behaviour added is per-line tolerance: one unparseable
 * line is skipped rather than throwing away the whole store, which is what a live
 * surface needs and what `parseJsonlMemory` deliberately does not do.
 *
 * WHAT `skipped` CANNOT TELL YOU. Since writeJsonlMemoryFile became atomic (temp +
 * rename) a reader should never see a torn file at all, and `skipped > 0` now genuinely
 * suggests a foreign or damaged line. But a store truncated by something OTHER than this
 * package can still be a syntactically perfect PREFIX — every whole line parses, and the
 * result is simply a smaller store with `skipped === 0`. No reader can detect that from
 * content alone. If that matters to a caller, compare entity counts across reads.
 */
export function parseStore(raw: string): ParsedStore {
  const entities = new Map<string, StoreEntity>();
  const relations: StoreRelation[] = [];
  let skipped = 0;

  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;

    let record: JsonlRecord;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        skipped++;
        continue;
      }
      record = parsed as JsonlRecord;
    } catch {
      skipped++;
      continue;
    }

    if (isEntityRecord(record)) {
      entities.set(record.name as string, record as unknown as StoreEntity);
    } else if (isRelationRecord(record)) {
      relations.push(record as unknown as StoreRelation);
    } else if (isLegacyNarrativeBeatRecord(record)) {
      const normalized = normalizeLegacyNarrativeBeat(record) as unknown as StoreEntity;
      entities.set(normalized.name, normalized);
    } else {
      skipped++;
    }
  }

  return { entities, relations, skipped };
}

/** The writer's `Entity` shape, for callers already holding a KnowledgeGraph. */
export type { Entity };

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const meta = (e?: StoreEntity): Record<string, unknown> => (e && e.metadata) || {};

/** Read a string-valued metadata key, or undefined when absent or the wrong type. */
export function metaString(e: StoreEntity | undefined, key: string): string | undefined {
  const v = meta(e)[key];
  return typeof v === 'string' ? v : undefined;
}

/** A step or chart is complete when `metadata.completionStatus` is exactly true. */
export const isComplete = (e: StoreEntity | undefined): boolean =>
  meta(e)['completionStatus'] === true;

export const getChartEntity = (s: ParsedStore, chartId: string) =>
  s.entities.get(chartEntityName(chartId));
export const getDesiredOutcome = (s: ParsedStore, chartId: string) =>
  s.entities.get(desiredOutcomeName(chartId));
export const getCurrentReality = (s: ParsedStore, chartId: string) =>
  s.entities.get(currentRealityName(chartId));

/**
 * FLAT action steps only — `action_step` entities carrying this chart's id.
 *
 * Read the name literally: this is NOT "the chart's work". Only steps passed in the
 * `actionSteps[]` array at chart creation become `action_step` entities. `add_action_step`
 * creates a TELESCOPED CHILD CHART instead, and its step is that child's desired outcome.
 * In the live seat store, 49 of 71 charts carry a parent — most work is telescoped and
 * invisible here. Use `getWork` unless you specifically want the flat ones.
 */
export function getFlatActionSteps(s: ParsedStore, chartId: string): StoreEntity[] {
  const out: StoreEntity[] = [];
  for (const e of s.entities.values()) {
    if (e.entityType === ENTITY_TYPES.actionStep && meta(e)['chartId'] === chartId) {
      out.push(e);
    }
  }
  return out;
}

/**
 * Charts telescoped beneath this one — full charts whose `parentChart` points back here.
 */
export function getChildCharts(s: ParsedStore, chartId: string): StoreEntity[] {
  const out: StoreEntity[] = [];
  for (const e of s.entities.values()) {
    if (e.entityType === ENTITY_TYPES.chart && meta(e)['parentChart'] === chartId) {
      out.push(e);
    }
  }
  return out;
}

/** One unit of work on a chart, whether it is a flat step or a telescoped child. */
export interface WorkItem {
  /** Entity name for a flat step; the CHILD CHART's id for a telescoped one. */
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  updatedAt?: string;
  telescoped: boolean;
  /** The underlying record, for callers that need more than the summary. */
  entity: StoreEntity;
}

/**
 * Everything a chart is actually holding: flat action steps PLUS telescoped children,
 * in one list. This is what a progress indicator or a chart view wants — counting only
 * flat steps is precisely the bug that made get_chart_progress report 0/0 for charts
 * full of telescoped work.
 */
export function getWork(s: ParsedStore, chartId: string): WorkItem[] {
  const out: WorkItem[] = [];

  for (const e of getFlatActionSteps(s, chartId)) {
    out.push({
      id: e.name,
      title: e.observations?.[0] ?? e.name,
      completed: isComplete(e),
      dueDate: metaString(e, 'dueDate'),
      updatedAt: metaString(e, 'updatedAt'),
      telescoped: false,
      entity: e,
    });
  }

  for (const e of getChildCharts(s, chartId)) {
    const childId = metaString(e, 'chartId') ?? e.name.replace(/_chart$/, '');
    const childOutcome = getDesiredOutcome(s, childId);
    out.push({
      id: childId,
      title: childOutcome?.observations?.[0] ?? childId,
      completed: isComplete(e),
      dueDate: metaString(e, 'dueDate'),
      updatedAt: metaString(e, 'updatedAt'),
      telescoped: true,
      entity: e,
    });
  }

  return out;
}

export function getMmotBeats(s: ParsedStore, chartId: string): StoreEntity[] {
  const out: StoreEntity[] = [];
  for (const e of s.entities.values()) {
    if (e.entityType === ENTITY_TYPES.narrativeBeat && isMmotBeatName(e.name, chartId)) {
      out.push(e);
    }
  }
  return out;
}

/**
 * The chart's MMOT trail, normalized. Lives on the CHART entity's metadata, not on
 * current reality — the two are separate records, and a caller may write the trail
 * while deliberately leaving current reality alone.
 */
export function getMmotEvaluations(chart: StoreEntity | undefined): MmotEvaluation[] {
  const raw = meta(chart)['mmotEvaluations'];
  if (!Array.isArray(raw)) return [];
  return raw.map((ev) => {
    const r = (ev || {}) as Record<string, unknown>;
    return {
      phase: String(r['phase'] ?? ''),
      assessment: String(r['assessment'] ?? ''),
      direction: typeof r['direction'] === 'string' ? r['direction'] : undefined,
      timestamp: typeof r['timestamp'] === 'string' ? r['timestamp'] : undefined,
    };
  });
}

/**
 * A content-derived revision token for the WHOLE store — newest timestamp, plus the
 * record counts.
 *
 * The counts are not decoration. Two mutations this package performs move no timestamp
 * a chart-scoped scan would see: `updateActionProgress` stamps the step but not the
 * chart, and `removeActionStep` stamps nothing at all. A token built only from
 * `max(updatedAt)` therefore holds steady across a progress update AND across a
 * deletion — so a renderer caching on it serves a removed action step forever. Folding
 * in `entities.size` and `relations.length` makes a deletion move the token.
 *
 * Still derived from content, never from a file mtime: an mtime changes when the store
 * is rewritten with identical bytes, which makes every reader refetch for nothing and
 * makes a real change indistinguishable from a no-op rewrite.
 */
export function storeRevision(s: ParsedStore): string {
  let newest = '';
  for (const e of s.entities.values()) {
    const u = metaString(e, 'updatedAt') ?? metaString(e, 'createdAt') ?? '';
    if (u > newest) newest = u;
  }
  return `${newest}|${s.entities.size}|${s.relations.length}`;
}

/**
 * Revision across a specific set of entities. Narrower than `storeRevision` and subject
 * to the blind spots described there — a progress update or a deletion may not move it.
 * Prefer `storeRevision` for cache keys; use this only when a per-chart token is
 * genuinely required and its limits are understood.
 */
export function revisionOf(entities: Array<StoreEntity | undefined>): string {
  let revision = '';
  for (const e of entities) {
    const u = metaString(e, 'updatedAt') ?? metaString(e, 'createdAt') ?? '';
    if (u > revision) revision = u;
  }
  return revision;
}

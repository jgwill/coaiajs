/**
 * Delayed resolution — the pure half.
 *
 * A due date says when. It does not say that someone chose to wait. A delayed
 * resolution records that choice on a step (Fritz, LAA-w04-22bc: "a secondary
 * choice to our primary choice"), the date resolution is wanted, and the agent
 * session to rehydrate when that date or an event comes.
 *
 * This module holds what needs no store: deriving a step's status, measuring days
 * remaining and owed, and rendering. The graph manager writes the records; the
 * handlers, the CLI and the markdown export read them through these functions so
 * that every surface says the same thing about the same step.
 */

import type {
  ActionStepStatus,
  AgentSessionRef,
  DelayedResolution,
  DelayedResolutionOutcome,
  Entity,
} from '../types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The outcomes end_delayed_resolution accepts. The third outcome, `resolved`, is
 * written only when a delayed step is completed (design rule 4b).
 */
export const DELAYED_RESOLUTION_OUTCOMES: readonly DelayedResolutionOutcome[] = [
  'rehydrated',
  'released',
];

/** Who ended a delay by completing its step, when the completer is not named. */
export const COMPLETION_ENDED_BY_DEFAULT = 'mark_action_complete';

/**
 * The prefix a session's `trace` and `rehydrateWith` must carry. They are addresses
 * `@miadi/llmops` prints (`miadi-tracing:ceremony/session/<id>`); the chart stores
 * them as given and does not resolve them.
 */
export const MIADI_ADDRESS_PREFIX = 'miadi-';

/** One delay as a listing shows it: the record, where it sits, and what the clock says. */
export interface DelayedResolutionEntry extends DelayedResolution {
  actionStepName: string;
  title: string;
  /** The chart this step belongs to and advances. */
  chartId: string;
  /** For a telescoped step, the step's own chart. */
  telescopedChartId?: string;
  status: ActionStepStatus;
  dueDate?: string;
  /** Whole days until `resolveBy`; zero or negative once it has passed. */
  daysRemaining: number;
  /** An open delay whose `resolveBy` has passed. */
  owed: boolean;
  /** How many earlier delay records this step carries. */
  historyCount: number;
}

/** What ending a delay returns. */
export interface EndedDelayedResolution extends DelayedResolutionEntry {
  /** Present when the outcome is `rehydrated`: the command that resumes the session. */
  resumeCommand?: string;
  /** Present when the outcome is `rehydrated` and the session carries one: its LLMOps trace. */
  trace?: string;
  /** Present when the outcome is `rehydrated` and the session carries one: the prompt that rehydrates it. */
  rehydrateWith?: string;
}

/** The step's current delay when it is still open, else undefined. */
export function openDelay(entity: Entity | undefined): DelayedResolution | undefined {
  const record = entity?.metadata?.delayedResolution;
  if (!record || typeof record !== 'object') return undefined;
  return record.endedAt ? undefined : record;
}

/**
 * The status a reader sees. `completionStatus` is the stored truth and wins: a
 * step completed while a delay was open reads as completed.
 */
export function deriveActionStepStatus(entity: Entity | undefined): ActionStepStatus {
  if (entity?.metadata?.completionStatus === true) return 'completed';
  return openDelay(entity) ? 'delayed' : 'pending';
}

/** Whole days from `now` to `resolveBy`, rounded up; never `-0`. */
export function daysUntil(resolveBy: string, now: Date = new Date()): number {
  const days = Math.ceil((new Date(resolveBy).getTime() - now.getTime()) / DAY_MS);
  return days === 0 ? 0 : days;
}

/** An open delay is owed once its `resolveBy` has passed. An ended one is never owed. */
export function isOwed(record: DelayedResolution | undefined, now: Date = new Date()): boolean {
  if (!record || record.endedAt) return false;
  return new Date(record.resolveBy).getTime() <= now.getTime();
}

/**
 * The command that rehydrates a session. A stored command is used as written; for a
 * Claude Code session without one, the standard resume is composed from its id and
 * working directory. Any other agent's resume is not guessed.
 */
export function resumeCommandFor(session: AgentSessionRef | undefined): string | undefined {
  if (!session) return undefined;
  if (session.resumeCommand) return session.resumeCommand;
  if ((session.agent || 'claude') !== 'claude') return undefined;
  const resume = `claude --resume ${session.sessionId}`;
  return session.cwd ? `cd ${session.cwd} && ${resume}` : resume;
}

// ─── Rendering ────────────────────────────────────────────────────────

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** "in 3 days", "today", "owed by 2 days". */
export function describeRemaining(entry: Pick<DelayedResolutionEntry, 'daysRemaining' | 'owed'>): string {
  if (entry.owed) {
    const by = Math.abs(entry.daysRemaining);
    return by === 0 ? 'owed today' : `owed by ${by} day${by === 1 ? '' : 's'}`;
  }
  if (entry.daysRemaining === 0) return 'due today';
  return `in ${entry.daysRemaining} day${entry.daysRemaining === 1 ? '' : 's'}`;
}

/** "delayed until 2026-11-01 (in 13 days)" for an open delay. */
export function describeOpenDelay(record: DelayedResolution, now: Date = new Date()): string {
  const owed = isOwed(record, now);
  const remaining = describeRemaining({ daysRemaining: daysUntil(record.resolveBy, now), owed });
  return `delayed until ${dateOnly(record.resolveBy)} (${remaining})`;
}

/** One short line for a step's status, used beside a step wherever it is listed. */
export function describeStepDelay(entity: Entity | undefined, now: Date = new Date()): string | undefined {
  const record = openDelay(entity);
  if (!record || deriveActionStepStatus(entity) !== 'delayed') return undefined;
  return describeOpenDelay(record, now);
}

/** The mark a listing puts beside a step: done, owed, delayed, or open. */
export function stepMark(status: ActionStepStatus, record?: DelayedResolution, now: Date = new Date()): string {
  if (status === 'completed') return '✅';
  if (status === 'delayed') return isOwed(record, now) ? '⏰' : '⏸️';
  return '🎯';
}

function entryLines(entry: DelayedResolutionEntry): string[] {
  const mark = entry.endedAt ? (entry.outcome === 'resolved' ? '✅' : '⏹️') : entry.owed ? '⏰' : '⏸️';
  const lines = [
    `${mark} **${entry.title}**`,
    `    Step: ${entry.actionStepName} · Chart: ${entry.chartId}`,
  ];
  if (entry.endedAt) {
    lines.push(
      `    Ended ${dateOnly(entry.endedAt)} by ${entry.endedBy} as ${entry.outcome}` +
        (entry.endNote ? ` — ${entry.endNote}` : ''),
    );
  } else {
    lines.push(`    Resolve by ${dateOnly(entry.resolveBy)} (${describeRemaining(entry)})`);
  }
  lines.push(`    Chosen by ${entry.chosenBy} on ${dateOnly(entry.chosenAt)}: ${entry.reason}`);
  if (entry.primaryChoice) lines.push(`    Serves: ${entry.primaryChoice}`);
  if (entry.wakeOn && entry.wakeOn.length > 0) lines.push(`    Wake on: ${entry.wakeOn.join('; ')}`);
  if (entry.session) {
    const where = [entry.session.host, entry.session.tmux].filter(Boolean).join(' ');
    lines.push(`    Session: ${entry.session.agent} ${entry.session.sessionId}${where ? ` (${where})` : ''}`);
    if (entry.session.trace) lines.push(`    Trace: ${entry.session.trace}`);
    if (entry.session.rehydrateWith) lines.push(`    Rehydrate with: ${entry.session.rehydrateWith}`);
  }
  return lines;
}

/** A readable listing, soonest first, owed ones marked. */
export function formatDelayedResolutionList(entries: DelayedResolutionEntry[]): string {
  if (entries.length === 0) return 'No delayed resolutions.';
  const owed = entries.filter(e => e.owed).length;
  const header =
    `## Delayed resolutions (${entries.length}` + (owed > 0 ? `, ${owed} owed` : '') + ')';
  return [header, '', ...entries.flatMap(e => [...entryLines(e), ''])].join('\n').trimEnd();
}

/** The confirmation for a delay just chosen. */
export function formatDelayChosen(entry: DelayedResolutionEntry): string {
  const replaced = entry.historyCount > 0 ? ` (${entry.historyCount} earlier record(s) kept in history)` : '';
  return [
    `Resolution of '${entry.actionStepName}' delayed until ${entry.resolveBy}${replaced}. The step's due date now carries the delay.`,
    '',
    ...entryLines(entry),
  ].join('\n');
}

/** The confirmation for a delay just ended. */
export function formatDelayEnded(entry: EndedDelayedResolution): string {
  const lines = [
    `Delay on '${entry.actionStepName}' ended as ${entry.outcome}. The step's status is now ${entry.status}; the record is kept.`,
  ];
  if (entry.resumeCommand || entry.trace || entry.rehydrateWith) {
    lines.push('', `Rehydrate with:`);
    if (entry.resumeCommand) lines.push(`  ${entry.resumeCommand}`);
    if (entry.trace) lines.push(`  trace: ${entry.trace}`);
    if (entry.rehydrateWith) lines.push(`  rehydrateWith: ${entry.rehydrateWith}`);
  }
  return lines.join('\n');
}

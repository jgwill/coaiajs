// narrative/index.ts — Module barrel export

export { KnowledgeGraphManager, parseGithubIssueSpec } from './graph-manager.js';
export { handleToolCall } from './tool-handlers.js';
export { validate, ValidationSchemas } from './validation.js';
export type { ValidationResult } from './validation.js';
export {
  ALL_TOOL_DEFINITIONS,
  STC_TOOLS,
  NARRATIVE_TOOLS,
  WAMPUM_TOOLS,
  KG_TOOLS,
  CORE_TOOLS,
} from './tool-definitions.js';
export type { ToolDefinition } from './tool-definitions.js';

// Store round-tripping: read and write the JSONL without losing another
// consumer's fields, and without a truncating write a concurrent reader can see.
export {
  parseJsonlMemory,
  serializeJsonlMemory,
  readJsonlMemoryFile,
  writeJsonlMemoryFile,
} from './jsonl-preservation.js';
export {
  isObject,
  isEntityRecord,
  isLegacyNarrativeBeatRecord,
  isRelationRecord,
  normalizeLegacyNarrativeBeat,
} from './jsonl-records.js';

// Write-boundary refusal of unparsed tool-call syntax.
export {
  findUnparsedCallSyntax,
  findUnparsedCallSyntaxIn,
  describeUnparsedCallSyntax,
  assertNoUnparsedCallSyntax,
  KNOWN_ARGUMENT_NAMES,
} from './argument-hygiene.js';
export type { UnparsedCallSyntaxHit, UnparsedCallSyntaxLocation } from './argument-hygiene.js';

// GitHub Projects bridge.
export {
  GITHUB_PROJECT_FIELD_NAMES,
  normalizeGithubBridgeMetadata,
  createGithubProjectFieldProjection,
  projectEntityToGithubFields,
  deriveGithubProjectStatus,
  getGithubIssueUrl,
} from './github-bridge.js';
export type {
  GithubProjectFieldName,
  GithubProjectFieldProjection,
  GithubProjectStatus,
  GithubBridgeMetadataSource,
  NormalizedGithubBridgeMetadata,
} from './github-bridge.js';

// The read contract: zero I/O, safe to import from a renderer. Also published as
// the `coaiajs/narrative/contract` subpath so a consumer need not pull the rest.
export * as contract from './contract.js';
export {
  exportChartToMarkdown,
  exportAllCharts as exportAllChartsToMarkdown,
  exportChartProgress,
  exportChartStats,
  writeMarkdownToFile,
  getDefaultFilename,
} from './markdown-export.js';
export type { MarkdownOptions } from './markdown-export.js';

// Delayed resolution: deriving a step's status, measuring what is owed, rendering.
export {
  DELAYED_RESOLUTION_OUTCOMES,
  COMPLETION_ENDED_BY_DEFAULT,
  deriveActionStepStatus,
  openDelay,
  isOwed,
  daysUntil,
  resumeCommandFor,
  formatDelayedResolutionList,
  formatDelayChosen,
  formatDelayEnded,
} from './delayed-resolution.js';
export type { DelayedResolutionEntry, EndedDelayedResolution } from './delayed-resolution.js';

// Re-export narrative-relevant types
export type {
  Entity,
  EntityMetadata,
  Relation,
  RelationMetadata,
  KnowledgeGraph,
  McpToolResult,
  ActionStepStatus,
  AgentSessionRef,
  DelayedResolution,
  DelayedResolutionOutcome,
} from './types.js';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KnowledgeGraphManager } from './graph-manager.js';
import { handleToolCall } from './tool-handlers.js';
import {
  exportChartToMarkdown as exportChartMarkdown,
  exportAllCharts as exportAllChartsMarkdown,
  exportChartProgress,
  exportChartStats,
} from './markdown-export.js';
import { createEnvironment } from '../environment.js';
import type { McpToolResult, AgentSessionRef, DelayedResolutionOutcome } from '../types.js';
import type { DelayedResolutionEntry, EndedDelayedResolution } from './delayed-resolution.js';

interface CliGlobals {
  memoryPath?: string;
}

function managerFrom(opts?: CliGlobals): KnowledgeGraphManager {
  return new KnowledgeGraphManager(
    opts?.memoryPath ?? process.env['COAIAJS_MEMORY_PATH'] ?? 'coaia-memory.jsonl',
  );
}

function firstText(result: McpToolResult): string {
  return result.content[0]?.text ?? '';
}

export async function listCharts(opts?: CliGlobals): Promise<string> {
  return firstText(await handleToolCall('list_active_charts', {}, managerFrom(opts)));
}

export async function viewChart(chartId: string, opts?: CliGlobals): Promise<string> {
  return firstText(await handleToolCall('get_chart', { chartId }, managerFrom(opts)));
}

export async function setCurrentChart(chartId: string): Promise<void> {
  const env = createEnvironment();
  env.set('COAIA_CURRENT_CHART_ID', chartId);
  env.save();
}

export function getCurrentChart(): string | undefined {
  return createEnvironment().get('COAIA_CURRENT_CHART_ID');
}

export async function updateChart(
  chartId: string,
  opts: { desiredOutcome?: string; currentReality?: string },
): Promise<string[]> {
  const manager = managerFrom();
  const results: string[] = [];
  if (opts.desiredOutcome) {
    results.push(firstText(await handleToolCall(
      'update_desired_outcome',
      { chartId, newDesiredOutcome: opts.desiredOutcome },
      manager,
    )));
  }
  if (opts.currentReality) {
    results.push(firstText(await handleToolCall(
      'update_current_reality',
      { chartId, newObservations: [opts.currentReality] },
      manager,
    )));
  }
  if (results.length === 0) throw new Error('Provide --desired-outcome or --current-reality');
  return results;
}

export async function addAction(
  chartId: string,
  opts: { title?: string; currentReality?: string; due?: string },
): Promise<string> {
  if (!opts.title) throw new Error('--title is required');
  if (!opts.currentReality) throw new Error('--current-reality is required');
  return firstText(await handleToolCall(
    'add_action_step',
    {
      parentChartId: chartId,
      actionStepTitle: opts.title,
      currentReality: opts.currentReality,
      dueDate: opts.due,
    },
    managerFrom(),
  ));
}

export async function addObservation(chartId: string, observation: string): Promise<string> {
  return firstText(await handleToolCall(
    'update_current_reality',
    { chartId, newObservations: [observation] },
    managerFrom(),
  ));
}

export async function completeAction(
  actionName: string,
  opts: { completedBy?: string } & CliGlobals = {},
): Promise<string> {
  return firstText(await handleToolCall(
    'mark_action_complete',
    { actionStepName: actionName, ...(opts.completedBy ? { completedBy: opts.completedBy } : {}) },
    managerFrom(opts),
  ));
}

export async function exportChart(chartId: string): Promise<string> {
  return exportChartMarkdown(chartId, managerFrom());
}

export async function exportAllCharts(opts: { output?: string } = {}): Promise<string | { output: string }> {
  const markdown = await exportAllChartsMarkdown(managerFrom());
  if (opts.output) {
    const outPath = resolve(opts.output);
    writeFileSync(outPath, markdown, 'utf-8');
    return { output: outPath };
  }
  return markdown;
}

export async function getStats(): Promise<string> {
  return exportChartStats(managerFrom());
}

export async function getProgress(chartId: string): Promise<string> {
  return exportChartProgress(chartId, managerFrom());
}

export async function performMmot(
  chartId: string,
  opts: { assessment?: string; direction?: string },
): Promise<string> {
  return firstText(await handleToolCall(
    'perform_mmot_evaluation',
    {
      chartId,
      assessment: opts.assessment,
      direction: opts.direction,
    },
    managerFrom(),
  ));
}

/**
 * Move a chart's due date.
 *
 * This used to re-serialise the whole store by hand with writeFileSync: it dropped
 * every field the manager does not model, ignored --memory-path in favour of the
 * env var alone, and truncated the file in place where a concurrent reader could
 * see a partial store. It now goes through the manager, which moves the chart and
 * its desired outcome together and writes atomically.
 */
export async function setDueDate(
  chartId: string,
  date: string,
  opts: { redistribute?: boolean } & CliGlobals = {},
): Promise<string> {
  const result = await managerFrom(opts).updateChartDueDate(
    chartId,
    date,
    opts.redistribute === true,
  );
  let text = `Due date for ${chartId} moved from ${result.previousDueDate || 'unset'} to ${result.newDueDate}`;
  if (result.actionStepsRescheduled > 0) {
    text += `\n${result.actionStepsRescheduled} open action step(s) redistributed.`;
  } else if (result.actionStepsPastDueDate > 0) {
    text += `\n⚠️ ${result.actionStepsPastDueDate} open action step(s) still fall after the new due date. Pass --redistribute to move them.`;
  }
  return text;
}

/** Record on an existing chart the GitHub issue it was written from. */
export async function linkGithubIssue(
  chartId: string,
  githubIssue: string,
  opts?: CliGlobals,
): Promise<string> {
  return firstText(
    await handleToolCall('link_chart_to_github_issue', { chartId, githubIssue }, managerFrom(opts)),
  );
}

/** Record that resolving a step is strategically delayed (`coaia narrative delay`). */
export async function delayAction(
  actionStepName: string,
  opts: {
    resolveBy?: string;
    reason?: string;
    chosenBy?: string;
    primaryChoice?: string;
    wakeOn?: string[];
    session?: Partial<AgentSessionRef>;
  } & CliGlobals,
): Promise<DelayedResolutionEntry> {
  if (!opts.resolveBy) throw new Error('--resolve-by is required');
  if (!opts.reason) throw new Error('--reason is required');
  if (!opts.chosenBy) throw new Error('--chosen-by is required');
  const session = opts.session?.sessionId
    ? (opts.session as Partial<AgentSessionRef> & { sessionId: string })
    : undefined;
  if (opts.session && !session && Object.values(opts.session).some(Boolean)) {
    throw new Error('--session-id is required when describing a session');
  }
  return managerFrom(opts).delayResolution(actionStepName, {
    resolveBy: opts.resolveBy,
    reason: opts.reason,
    chosenBy: opts.chosenBy,
    primaryChoice: opts.primaryChoice,
    wakeOn: opts.wakeOn,
    session,
  });
}

/** Delayed steps, soonest first (`coaia narrative delayed`). */
export async function listDelayedActions(
  opts: { dueWithinDays?: number; includeEnded?: boolean } & CliGlobals = {},
): Promise<DelayedResolutionEntry[]> {
  return managerFrom(opts).listDelayedResolutions({
    dueWithinDays: opts.dueWithinDays,
    includeEnded: opts.includeEnded === true,
  });
}

/** End a step's delay, by rehydrating its session or releasing it (`coaia narrative end-delay`). */
export async function endActionDelay(
  actionStepName: string,
  opts: { endedBy?: string; outcome?: string; endNote?: string } & CliGlobals,
): Promise<EndedDelayedResolution> {
  if (!opts.endedBy) throw new Error('--by is required');
  if (!opts.outcome) throw new Error('--outcome is required (rehydrated | released)');
  return managerFrom(opts).endDelayedResolution(actionStepName, {
    endedBy: opts.endedBy,
    outcome: opts.outcome as DelayedResolutionOutcome,
    endNote: opts.endNote,
  });
}

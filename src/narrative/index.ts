// narrative/index.ts — Module barrel export

export { KnowledgeGraphManager } from './graph-manager.js';
export { handleToolCall } from './tool-handlers.js';
export { validate, ValidationSchemas } from './validation.js';
export {
  ALL_TOOL_DEFINITIONS,
  STC_TOOLS,
  NARRATIVE_TOOLS,
  KG_TOOLS,
  CORE_TOOLS,
} from './tool-definitions.js';
export type { ToolDefinition } from './tool-definitions.js';
export {
  exportChartToMarkdown,
  exportAllCharts as exportAllChartsToMarkdown,
  exportChartProgress,
  exportChartStats,
  writeMarkdownToFile,
  getDefaultFilename,
} from './markdown-export.js';
export type { MarkdownOptions } from './markdown-export.js';

// Re-export narrative-relevant types
export type {
  Entity,
  EntityMetadata,
  Relation,
  RelationMetadata,
  KnowledgeGraph,
  McpToolResult,
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
import type { McpToolResult } from '../types.js';

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

export async function completeAction(actionName: string): Promise<string> {
  return firstText(await handleToolCall(
    'mark_action_complete',
    { actionStepName: actionName },
    managerFrom(),
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

export async function setDueDate(chartId: string, date: string): Promise<string> {
  const graph = await managerFrom().readGraph();
  const chart = graph.entities.find(
    (entity) => entity.entityType === 'structural_tension_chart' && entity.metadata?.chartId === chartId,
  );
  if (!chart) throw new Error(`Chart not found: ${chartId}`);
  chart.metadata = { ...chart.metadata, dueDate: date, updatedAt: new Date().toISOString() };
  const entities = graph.entities.map((entity) => entity.name === chart.name ? chart : entity);
  const lines = [
    ...entities.map((entity) => JSON.stringify({ type: 'entity', ...entity })),
    ...graph.relations.map((relation) => JSON.stringify({ type: 'relation', ...relation })),
  ];
  writeFileSync(process.env['COAIAJS_MEMORY_PATH'] ?? 'coaia-memory.jsonl', lines.join('\n'), 'utf-8');
  return `Due date set for ${chartId}`;
}

/**
 * Markdown Export Module for COAIA Narrative
 *
 * Provides markdown generation for structural tension charts,
 * narrative beats, and associated data structures.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Entity, KnowledgeGraph } from '../types.js';
import type { KnowledgeGraphManager } from './graph-manager.js';

export interface MarkdownOptions {
  includeMetadata?: boolean;
  includeObservations?: boolean;
  observationLimit?: number;
  includeToc?: boolean;
  outputPath?: string;
}

// ─── Utility Functions ────────────────────────────────────────────────

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatDateForMarkdown(dateStr?: string): string {
  if (!dateStr) return 'No due date';
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return `Overdue by ${Math.abs(days)} days`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  return `${date.toLocaleDateString()}`;
}

function formatProgressBar(progress: number): string {
  const width = 20;
  const filled = Math.round(progress * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.round(progress * 100);
  return `[${bar}] ${percent}%`;
}

function getStatusIcon(completed: boolean): string {
  return completed ? '✅' : '⏳';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Single Chart Export ──────────────────────────────────────────────

export async function exportChartToMarkdown(
  chartId: string,
  manager: KnowledgeGraphManager,
  options: MarkdownOptions = {},
): Promise<string> {
  const graph = await manager.readGraph();
  const {
    includeMetadata = true,
    includeObservations = true,
    observationLimit = 0,
  } = options;

  const chart = graph.entities.find(
    e =>
      e.entityType === 'structural_tension_chart' &&
      e.metadata?.chartId === chartId,
  );

  if (!chart) {
    return `# Error\n\nChart '${chartId}' not found.`;
  }

  let md = '';

  md += `# Chart: ${chartId}\n\n`;

  if (includeMetadata) {
    if (chart.metadata?.createdAt) {
      const created = new Date(chart.metadata.createdAt).toLocaleString();
      md += `> **Created**: ${created}\n`;
    }
    if (chart.metadata?.parentChart) {
      md += `> **Parent Chart**: ${chart.metadata.parentChart} (Level ${chart.metadata.level})\n`;
    } else {
      md += `> **Master Chart** (Level ${chart.metadata?.level || 0})\n`;
    }
    if (chart.metadata?.dueDate) {
      md += `> **Due**: ${formatDateForMarkdown(chart.metadata.dueDate)}\n`;
    }
    md += '\n';
  }

  // Desired Outcome
  const outcome = graph.entities.find(
    e =>
      e.name === `${chartId}_desired_outcome` &&
      e.entityType === 'desired_outcome',
  );
  md += '## Desired Outcome\n\n';
  if (outcome) {
    md += `${escapeMarkdown(outcome.observations[0])}\n\n`;
  } else {
    md += '*(Unknown)*\n\n';
  }

  // Current Reality
  const currentReality = graph.entities.find(
    e =>
      e.name === `${chartId}_current_reality` &&
      e.entityType === 'current_reality',
  );
  md += '## Current Reality\n\n';
  if (currentReality && currentReality.observations.length > 0) {
    if (includeObservations && observationLimit > 0) {
      const obs = currentReality.observations.slice(-observationLimit);
      obs.forEach(o => (md += `- ${escapeMarkdown(o)}\n`));
    } else if (includeObservations) {
      currentReality.observations.forEach(o => (md += `- ${escapeMarkdown(o)}\n`));
    } else {
      md += `- ${escapeMarkdown(currentReality.observations[currentReality.observations.length - 1])}\n`;
    }
    md += '\n';
  } else {
    md += '*(Not assessed)*\n\n';
  }

  // Progress & Structural Tension
  const actionSteps = graph.entities.filter(
    e => e.entityType === 'action_step' && e.metadata?.chartId === chartId,
  );
  const completed = actionSteps.filter(
    a => a.metadata?.completionStatus === true,
  ).length;
  const total = actionSteps.length;
  const progress = total > 0 ? completed / total : 0;

  md += '## Structural Tension\n\n';
  md += `${formatProgressBar(progress)}\n\n`;
  md += `- **Completed**: ${completed}/${total} action steps\n\n`;

  // Action Steps
  if (actionSteps.length > 0) {
    md += '## Action Steps\n\n';
    actionSteps.forEach((step, idx) => {
      const isComplete = step.metadata?.completionStatus === true;
      const status = getStatusIcon(isComplete);
      const stepId = (step.metadata?.chartId as string) || `step_${idx + 1}`;

      md += `### ${status} ${escapeMarkdown(step.observations[0])}\n\n`;
      md += `- **ID**: ${stepId}\n`;
      md += `- **Status**: ${isComplete ? 'Completed' : 'In Progress'}\n`;
      if (step.metadata?.dueDate) {
        md += `- **Due**: ${formatDateForMarkdown(step.metadata.dueDate)}\n`;
      }

      if (step.observations.length > 1 && includeObservations) {
        md += `- **Notes**:\n`;
        step.observations.slice(1).forEach(note => {
          md += `  - ${escapeMarkdown(note)}\n`;
        });
      }
      md += '\n';
    });
  }

  // Narrative Beats
  const narrativeBeats = graph.entities
    .filter(
      e =>
        e.entityType === 'narrative_beat' && e.metadata?.chartId === chartId,
    )
    .sort((a, b) => ((a.metadata?.act as number) || 0) - ((b.metadata?.act as number) || 0));

  if (narrativeBeats.length > 0) {
    md += '## Narrative Beats\n\n';
    narrativeBeats.forEach(beat => {
      const act = beat.metadata?.act || '?';
      const type = beat.metadata?.type_dramatic || 'Unknown';
      const universes = (beat.metadata?.universes as string[]) || [];

      md += `### Act ${act}: ${escapeMarkdown(type as string)}\n\n`;

      if (universes.length > 0) {
        md += `- **Universes**: ${universes.join(', ')}\n`;
      }
      if (beat.metadata?.timestamp) {
        const ts = new Date(beat.metadata.timestamp).toLocaleString();
        md += `- **Timestamp**: ${ts}\n`;
      }

      if (beat.metadata?.narrative?.description) {
        md += `\n**Description**:\n\n${escapeMarkdown(beat.metadata.narrative.description)}\n`;
      }

      if (beat.metadata?.narrative?.prose) {
        md += `\n**Prose**:\n\n${escapeMarkdown(beat.metadata.narrative.prose)}\n`;
      }

      if (
        beat.metadata?.narrative?.lessons &&
        beat.metadata.narrative.lessons.length > 0
      ) {
        md += `\n**Lessons**:\n\n`;
        beat.metadata.narrative.lessons.forEach(lesson => {
          md += `- ${escapeMarkdown(lesson)}\n`;
        });
      }

      const dirs = beat.metadata?.fourDirections;
      if (
        dirs &&
        (dirs.north_vision ||
          dirs.east_intention ||
          dirs.south_emotion ||
          dirs.west_introspection)
      ) {
        md += `\n**Four Directions**:\n\n`;
        if (dirs.north_vision) md += `- **North (Vision)**: ${escapeMarkdown(dirs.north_vision)}\n`;
        if (dirs.east_intention) md += `- **East (Intention)**: ${escapeMarkdown(dirs.east_intention)}\n`;
        if (dirs.south_emotion) md += `- **South (Emotion)**: ${escapeMarkdown(dirs.south_emotion)}\n`;
        if (dirs.west_introspection) md += `- **West (Introspection)**: ${escapeMarkdown(dirs.west_introspection)}\n`;
      }

      md += '\n';
    });
  }

  return md;
}

// ─── All Charts Export ────────────────────────────────────────────────

export async function exportAllCharts(
  manager: KnowledgeGraphManager,
  options: MarkdownOptions = {},
): Promise<string> {
  const graph = await manager.readGraph();
  const { includeToc = true } = options;

  const charts = graph.entities.filter(
    e => e.entityType === 'structural_tension_chart',
  );
  const masterCharts = charts.filter(c => c.metadata?.level === 0);

  let md = '# Structural Tension Charts\n\n';

  if (includeToc && masterCharts.length > 0) {
    md += '## Table of Contents\n\n';
    masterCharts.forEach(master => {
      const cId = (master.metadata?.chartId as string) || master.name;
      const slug = slugify(cId);
      md += `- [${cId}](#${slug})\n`;
    });
    md += '\n---\n\n';
  }

  masterCharts.forEach((master, masterIdx) => {
    const cId = (master.metadata?.chartId as string) || master.name;

    md += `## ${cId}\n\n`;

    const outcome = graph.entities.find(
      e =>
        e.name === `${cId}_desired_outcome` &&
        e.entityType === 'desired_outcome',
    );
    md += `**Desired Outcome**: ${outcome?.observations[0] || 'Unknown'}\n\n`;

    const cr = graph.entities.find(
      e =>
        e.name === `${cId}_current_reality` &&
        e.entityType === 'current_reality',
    );
    if (cr && cr.observations.length > 0) {
      md += `**Current Reality**: ${cr.observations[cr.observations.length - 1]}\n\n`;
    }

    const actionSteps = graph.entities.filter(
      e => e.entityType === 'action_step' && e.metadata?.chartId === cId,
    );
    const completed = actionSteps.filter(
      a => a.metadata?.completionStatus === true,
    ).length;
    const total = actionSteps.length;
    const progress = total > 0 ? completed / total : 0;

    md += `**Progress**: ${formatProgressBar(progress)} (${completed}/${total})\n\n`;

    if (master.metadata?.dueDate) {
      md += `**Due**: ${formatDateForMarkdown(master.metadata.dueDate)}\n\n`;
    }

    const actionCharts = charts.filter(
      c => c.metadata?.parentChart === cId && c.metadata?.level === 1,
    );

    if (actionCharts.length > 0) {
      md += '### Action Steps\n\n';
      actionCharts.forEach(actionChart => {
        const actionChartId = actionChart.metadata?.chartId as string;
        const actionOutcome = graph.entities.find(
          e =>
            e.name === `${actionChartId}_desired_outcome` &&
            e.entityType === 'desired_outcome',
        );
        const actionActions = graph.entities.filter(
          e =>
            e.entityType === 'action_step' &&
            e.metadata?.chartId === actionChartId,
        );

        const actionCompleted = actionActions.filter(
          a => a.metadata?.completionStatus === true,
        ).length;
        const actionTotal = actionActions.length;
        const actionProgress =
          actionTotal > 0 ? actionCompleted / actionTotal : 0;
        const isComplete = actionChart.metadata?.completionStatus === true;
        const status = isComplete ? '✅' : actionProgress > 0 ? '🔄' : '⏳';

        md += `- ${status} **${escapeMarkdown(actionOutcome?.observations[0] || 'Unknown')}**\n`;
        md += `  - ID: ${actionChartId}\n`;
        if (actionChart.metadata?.dueDate) {
          md += `  - Due: ${formatDateForMarkdown(actionChart.metadata.dueDate)}\n`;
        }
        if (actionTotal > 0) {
          md += `  - Progress: ${formatProgressBar(actionProgress)}\n`;
        }
      });
      md += '\n';
    }

    if (masterIdx < masterCharts.length - 1) {
      md += '---\n\n';
    }
  });

  return md;
}

// ─── Progress Report ──────────────────────────────────────────────────

export async function exportChartProgress(
  chartId: string,
  manager: KnowledgeGraphManager,
): Promise<string> {
  const graph = await manager.readGraph();

  const chart = graph.entities.find(
    e =>
      e.entityType === 'structural_tension_chart' &&
      e.metadata?.chartId === chartId,
  );

  if (!chart) {
    return `# Error\n\nChart '${chartId}' not found.`;
  }

  const outcome = graph.entities.find(
    e => e.name === `${chartId}_desired_outcome`,
  );
  const actions = graph.entities.filter(
    e => e.entityType === 'action_step' && e.metadata?.chartId === chartId,
  );

  const completed = actions.filter(
    a => a.metadata?.completionStatus === true,
  );
  const incomplete = actions.filter(
    a => a.metadata?.completionStatus !== true,
  );
  const progress = actions.length > 0 ? completed.length / actions.length : 0;

  let md = `# Progress Report: ${chartId}\n\n`;

  md += `**Goal**: ${outcome?.observations[0] || 'Unknown'}\n\n`;

  md += `## Overall Progress\n\n`;
  md += `${formatProgressBar(progress)}\n\n`;

  md += '## Completed Actions\n\n';
  if (completed.length > 0) {
    completed.forEach((action, idx) => {
      md += `${idx + 1}. ${escapeMarkdown(action.observations[0])}\n`;
      if (action.metadata?.dueDate) {
        md += `   - Completed: ${formatDateForMarkdown(action.metadata.dueDate)}\n`;
      }
    });
  } else {
    md += '*No completed actions yet.*\n';
  }
  md += '\n';

  md += '## Remaining Actions\n\n';
  if (incomplete.length > 0) {
    incomplete.forEach((action, idx) => {
      md += `${idx + 1}. ${escapeMarkdown(action.observations[0])}\n`;
      if (action.metadata?.dueDate) {
        md += `   - Due: ${formatDateForMarkdown(action.metadata.dueDate)}\n`;
      }
    });
  } else {
    md += '*All actions completed!*\n';
  }
  md += '\n';

  const currentReality = graph.entities.find(
    e => e.name === `${chartId}_current_reality`,
  );
  if (currentReality && currentReality.observations.length > 0) {
    md += '## Current Reality Notes\n\n';
    currentReality.observations.slice(-5).forEach(obs => {
      md += `- ${escapeMarkdown(obs)}\n`;
    });
  }

  return md;
}

// ─── Statistics ───────────────────────────────────────────────────────

export async function exportChartStats(
  manager: KnowledgeGraphManager,
): Promise<string> {
  const graph = await manager.readGraph();

  const charts = graph.entities.filter(
    e => e.entityType === 'structural_tension_chart',
  );
  const masterCharts = charts.filter(c => c.metadata?.level === 0);
  const actionCharts = charts.filter(c => c.metadata?.level === 1);

  const allActions = graph.entities.filter(
    e => e.entityType === 'action_step',
  );
  const completedActions = allActions.filter(
    a => a.metadata?.completionStatus === true,
  );

  const narrativeBeats = graph.entities.filter(
    e => e.entityType === 'narrative_beat',
  );

  const overdueCharts = charts.filter(chart => {
    if (!chart.metadata?.dueDate) return false;
    const dueDate = new Date(chart.metadata.dueDate);
    return dueDate < new Date();
  });

  let md = '# Structural Tension Charts Statistics\n\n';

  md += '## Overview\n\n';
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Master Charts | ${masterCharts.length} |\n`;
  md += `| Action Step Charts | ${actionCharts.length} |\n`;
  md += `| Total Charts | ${charts.length} |\n`;
  md += `| Narrative Beats | ${narrativeBeats.length} |\n`;
  md += '\n';

  md += '## Completion Status\n\n';
  md += `| Status | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Completed Actions | ${completedActions.length}/${allActions.length} |\n`;
  const overallProgress =
    allActions.length > 0
      ? Math.round((completedActions.length / allActions.length) * 100)
      : 0;
  md += `| Overall Progress | ${overallProgress}% |\n`;
  md += '\n';

  if (overdueCharts.length > 0) {
    md += '## ⚠️ Overdue Charts\n\n';
    overdueCharts.forEach((chart, idx) => {
      const chartId = (chart.metadata?.chartId as string) || chart.name;
      md += `${idx + 1}. **${chartId}** - Due: ${formatDateForMarkdown(chart.metadata?.dueDate)}\n`;
    });
  } else {
    md += '## ✅ Status\n\n';
    md += 'All charts are on track!\n';
  }
  md += '\n';

  return md;
}

// ─── File Output ──────────────────────────────────────────────────────

export async function writeMarkdownToFile(
  content: string,
  outputPath: string,
): Promise<void> {
  const dir = path.dirname(outputPath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_e) {
    // Directory may exist
  }
  await fs.writeFile(outputPath, content, 'utf-8');
}

export function getDefaultFilename(exportType: string, chartId?: string): string {
  const timestamp = new Date().toISOString().split('T')[0];

  switch (exportType) {
    case 'chart':
      return `${chartId}-export-${timestamp}.md`;
    case 'list':
      return `structural-tension-charts-${timestamp}.md`;
    case 'progress':
      return `${chartId}-progress-${timestamp}.md`;
    case 'stats':
      return `statistics-${timestamp}.md`;
    default:
      return `export-${timestamp}.md`;
  }
}

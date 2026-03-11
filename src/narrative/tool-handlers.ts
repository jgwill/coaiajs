/**
 * COAIA Narrative - MCP Tool Handlers
 *
 * Pure function: tool name + args + manager → result.
 * No MCP SDK dependency — just returns plain objects.
 * Testable without MCP transport.
 */

import type { Entity, Relation, McpToolResult } from '../types.js';
import type { KnowledgeGraphManager } from './graph-manager.js';
import { validate, ValidationSchemas } from './validation.js';

const LLM_GUIDANCE_QUICK = `## 🚨 COAIA Memory Quick Reference

**CRITICAL**: "Ready to begin" = WRONG. Current reality must be factual assessment.

**Core Tools**:
1. \`list_active_charts\` → Start here, see all charts
2. \`create_structural_tension_chart\` → New chart (outcome + reality + actions)
3. \`add_action_step\` → Add strategic actions (creates telescoped chart)
4. \`telescope_action_step\` → Break down actions into detailed sub-charts

**Common Mistakes**:
❌ "Ready to begin Django tutorial"
✅ "Never used Django, completed Python basics"

Use format="full" for complete guidance.`;

const LLM_GUIDANCE_SAVE_DIRECTIVE = `## 💡 RECOMMENDED: Save This Guidance

**Claude Code**: Add this guidance to CLAUDE.md in your project directory
**Gemini**: Save as GEMINI.md in your workspace
**Other Agents**: Create AGENTS.md or similar session memory file

This ensures you remember COAIA Memory's structural tension principles across our entire conversation.

**Quick Command**: Use format="full" to get the complete guidance content to save.`;

const LLM_GUIDANCE_FULL = `## 🚨 COAIA Memory — Structural Tension Methodology

### Core Principles

1. **Creative Orientation** (Robert Fritz): Focus on what you want to CREATE, not problems to solve.
   - ❌ "Fix the bug" → ✅ "Achieve reliable error handling"
   - ❌ "Reduce latency" → ✅ "Deliver responsive user experience"

2. **Structural Tension**: The gap between Desired Outcome and Current Reality creates productive tension that drives advancement.

3. **Delayed Resolution**: "Tolerate discrepancy, tension, and delayed resolution" - Robert Fritz
   - Current Reality must be honest factual assessment
   - ❌ "Ready to begin" → ✅ "Have not started, familiar with prerequisites"

### Tool Usage Priority

1. \`list_active_charts\` — ALWAYS start here
2. \`create_structural_tension_chart\` — Create new charts
3. \`manage_action_step\` — Add/expand action steps (unified interface)
4. \`mark_action_complete\` — Complete steps (flows into parent reality)
5. \`update_current_reality\` — Add observations to current reality
6. \`perform_mmot_evaluation\` — Self-evaluate against Elements of Performance

### MMOT (Managerial Moment of Truth)
Four phases: Acknowledge → Analyze → Update → Recommit
Used for autonomous self-evaluation against Elements of Performance.

### Chart Structure
- \`chart_{timestamp}_chart\` — STC entity
- \`chart_{timestamp}_desired_outcome\` — Goal
- \`chart_{timestamp}_current_reality\` — Factual state
- \`chart_{timestamp}_action_{N}\` — Action steps (1-indexed)

### Action Steps = Telescoped Charts
Each action step becomes its own full structural tension chart with desired outcome, current reality, and sub-actions.`;

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  manager: KnowledgeGraphManager,
): Promise<McpToolResult> {
  const toolArgs = args || {};

  switch (name) {
    case 'create_entities': {
      const valResult = validate(toolArgs, { entities: ValidationSchemas.entityArray() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.createEntities(toolArgs.entities as Entity[]);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'create_relations': {
      const valResult = validate(toolArgs, { relations: ValidationSchemas.relationArray() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.createRelations(toolArgs.relations as Relation[]);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'add_observations': {
      const valResult = validate(toolArgs, {
        observations: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', required: true },
              contents: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
        },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.addObservations(
        toolArgs.observations as { entityName: string; contents: string[] }[],
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'delete_entities': {
      const valResult = validate(toolArgs, { entityNames: ValidationSchemas.stringArray() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.deleteEntities(toolArgs.entityNames as string[]);
      return { content: [{ type: 'text', text: 'Entities deleted successfully' }] };
    }
    case 'delete_observations': {
      const valResult = validate(toolArgs, {
        deletions: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', required: true },
              observations: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
        },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.deleteObservations(
        toolArgs.deletions as { entityName: string; observations: string[] }[],
      );
      return { content: [{ type: 'text', text: 'Observations deleted successfully' }] };
    }
    case 'delete_relations': {
      const valResult = validate(toolArgs, { relations: ValidationSchemas.relationArray() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.deleteRelations(toolArgs.relations as Relation[]);
      return { content: [{ type: 'text', text: 'Relations deleted successfully' }] };
    }
    case 'read_graph': {
      const result = await manager.readGraph();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'search_nodes': {
      const valResult = validate(toolArgs, { query: ValidationSchemas.nonEmptyString() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.searchNodes(toolArgs.query as string);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'open_nodes': {
      const valResult = validate(toolArgs, {
        names: { type: 'array', required: true, minLength: 1, items: { type: 'string' } },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.openNodes(toolArgs.names as string[]);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'create_structural_tension_chart': {
      const valResult = validate(toolArgs, {
        desiredOutcome: ValidationSchemas.nonEmptyString(),
        currentReality: ValidationSchemas.nonEmptyString(),
        dueDate: ValidationSchemas.isoDate(),
        actionSteps: { type: 'array', items: { type: 'string' } },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const chartResult = await manager.createStructuralTensionChart(
        toolArgs.desiredOutcome as string,
        toolArgs.currentReality as string,
        toolArgs.dueDate as string,
        (Array.isArray(toolArgs.actionSteps) ? toolArgs.actionSteps : []) as string[],
        toolArgs.elementsOfPerformance as Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }> | undefined,
      );
      return { content: [{ type: 'text', text: JSON.stringify(chartResult, null, 2) }] };
    }
    case 'telescope_action_step': {
      const valResult = validate(toolArgs, {
        actionStepName: ValidationSchemas.nonEmptyString(),
        newCurrentReality: ValidationSchemas.nonEmptyString(),
        initialActionSteps: { type: 'array', items: { type: 'string' } },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const telescopeResult = await manager.telescopeActionStep(
        toolArgs.actionStepName as string,
        toolArgs.newCurrentReality as string,
        (Array.isArray(toolArgs.initialActionSteps) ? toolArgs.initialActionSteps : []) as string[],
      );
      return { content: [{ type: 'text', text: JSON.stringify(telescopeResult, null, 2) }] };
    }
    case 'mark_action_complete': {
      const valResult = validate(toolArgs, { actionStepName: ValidationSchemas.nonEmptyString() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.markActionStepComplete(toolArgs.actionStepName as string);
      return {
        content: [
          {
            type: 'text',
            text: `Action step '${toolArgs.actionStepName as string}' marked as complete and current reality updated`,
          },
        ],
      };
    }
    case 'get_chart_progress': {
      const valResult = validate(toolArgs, { chartId: ValidationSchemas.nonEmptyString() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const progressResult = await manager.getChartProgress(toolArgs.chartId as string);
      return { content: [{ type: 'text', text: JSON.stringify(progressResult, null, 2) }] };
    }
    case 'list_active_charts': {
      const chartsResult = await manager.listActiveCharts();
      let hierarchyText = '## Structural Tension Charts Hierarchy\n\n';
      const masterCharts = chartsResult.filter(c => c.level === 0);
      const actionCharts = chartsResult.filter(c => c.level > 0);

      masterCharts.forEach(master => {
        const progress =
          master.progress > 0 ? ` (${Math.round(master.progress * 100)}% complete)` : '';
        const dueDate = master.dueDate
          ? ` [Due: ${new Date(master.dueDate).toLocaleDateString()}]`
          : '';
        hierarchyText += `📋 **${master.desiredOutcome}** (Master Chart)${progress}${dueDate}\n`;
        hierarchyText += `    ID: ${master.chartId}\n`;

        const actions = actionCharts.filter(a => a.parentChart === master.chartId);
        if (actions.length > 0) {
          actions.forEach((action, index) => {
            const isLast = index === actions.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const actionProgress =
              action.progress > 0 ? ` (${Math.round(action.progress * 100)}%)` : '';
            const actionDue = action.dueDate
              ? ` [${new Date(action.dueDate).toLocaleDateString()}]`
              : '';
            hierarchyText += `    ${connector}🎯 ${action.desiredOutcome} (Action Step)${actionProgress}${actionDue}\n`;
            hierarchyText += `        ID: ${action.chartId}\n`;
          });
        } else {
          hierarchyText += `    └── (No action steps yet)\n`;
        }
        hierarchyText += '\n';
      });

      if (masterCharts.length === 0) {
        hierarchyText += 'No active structural tension charts found.\n\n';
        hierarchyText += '💡 Create your first chart with: create_structural_tension_chart\n';
      }

      return { content: [{ type: 'text', text: hierarchyText }] };
    }
    case 'get_chart': {
      const valResult = validate(toolArgs, { chartId: ValidationSchemas.nonEmptyString() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.getChartDetails(toolArgs.chartId as string);
      if (!result) return { content: [{ type: 'text', text: `Error: Chart with ID ${toolArgs.chartId} not found` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'get_action_step': {
      const valResult = validate(toolArgs, { actionStepName: ValidationSchemas.nonEmptyString() });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const result = await manager.getActionStepDetails(toolArgs.actionStepName as string);
      if (!result) return { content: [{ type: 'text', text: `Error: Action step with name ${toolArgs.actionStepName} not found` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'update_action_progress': {
      const valResult = validate(toolArgs, {
        actionStepName: ValidationSchemas.nonEmptyString(),
        progressObservation: ValidationSchemas.nonEmptyString(),
        updateCurrentReality: { type: 'boolean' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.updateActionProgress(
        toolArgs.actionStepName as string,
        toolArgs.progressObservation as string,
        toolArgs.updateCurrentReality === true,
      );
      return {
        content: [{ type: 'text', text: `Action step '${toolArgs.actionStepName as string}' progress updated` }],
      };
    }
    case 'update_current_reality': {
      const valResult = validate(toolArgs, {
        chartId: ValidationSchemas.nonEmptyString(),
        newObservations: { type: 'array', required: true, minLength: 1, items: { type: 'string' } },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.updateCurrentReality(
        toolArgs.chartId as string,
        toolArgs.newObservations as string[],
      );
      return {
        content: [{ type: 'text', text: `Current reality updated for chart '${toolArgs.chartId as string}'` }],
      };
    }
    case 'manage_action_step': {
      const valResult = validate(toolArgs, {
        parentReference: ValidationSchemas.nonEmptyString(),
        actionDescription: ValidationSchemas.nonEmptyString(),
        currentReality: { type: 'string' },
        initialActionSteps: { type: 'array', items: { type: 'string' } },
        dueDate: { type: 'date' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const manageActionResult = await manager.manageActionStep(
        toolArgs.parentReference as string,
        toolArgs.actionDescription as string,
        toolArgs.currentReality as string | undefined,
        toolArgs.initialActionSteps as string[] | undefined,
        toolArgs.dueDate as string | undefined,
        toolArgs.performanceElements as Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }> | undefined,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Action step '${toolArgs.actionDescription as string}' managed for parent '${toolArgs.parentReference as string}'. Result: ${JSON.stringify(manageActionResult, null, 2)}`,
          },
        ],
      };
    }
    case 'add_action_step': {
      const valResult = validate(toolArgs, {
        parentChartId: ValidationSchemas.nonEmptyString(),
        actionStepTitle: ValidationSchemas.nonEmptyString(),
        currentReality: ValidationSchemas.nonEmptyString(),
        dueDate: { type: 'date' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const addActionResult = await manager.addActionStep(
        toolArgs.parentChartId as string,
        toolArgs.actionStepTitle as string,
        toolArgs.dueDate as string | undefined,
        toolArgs.currentReality as string,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Action step '${toolArgs.actionStepTitle as string}' added to chart '${toolArgs.parentChartId as string}' as telescoped chart '${addActionResult.chartId}'`,
          },
        ],
      };
    }
    case 'remove_action_step': {
      const valResult = validate(toolArgs, {
        parentChartId: ValidationSchemas.nonEmptyString(),
        actionStepName: ValidationSchemas.nonEmptyString(),
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.removeActionStep(
        toolArgs.parentChartId as string,
        toolArgs.actionStepName as string,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Action step '${toolArgs.actionStepName as string}' removed from chart '${toolArgs.parentChartId as string}'`,
          },
        ],
      };
    }
    case 'update_desired_outcome': {
      const valResult = validate(toolArgs, {
        chartId: ValidationSchemas.nonEmptyString(),
        newDesiredOutcome: ValidationSchemas.nonEmptyString(),
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      await manager.updateDesiredOutcome(
        toolArgs.chartId as string,
        toolArgs.newDesiredOutcome as string,
      );
      return {
        content: [{ type: 'text', text: `Desired outcome updated for chart '${toolArgs.chartId as string}'` }],
      };
    }
    case 'perform_mmot_evaluation': {
      const valResult = validate(toolArgs, {
        chartId: ValidationSchemas.nonEmptyString(),
        phase: { type: 'enum', enumValues: ['full', 'acknowledge', 'analyze', 'update', 'recommit'] },
        assessment: { type: 'string' },
        direction: { type: 'enum', enumValues: ['South', 'East', 'West', 'North'] },
        correctiveActions: { type: 'array', items: { type: 'string' } },
        updateReality: { type: 'boolean' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const mmotResult = await manager.performMmotEvaluation(
        toolArgs.chartId as string,
        (toolArgs.phase as string) || 'full',
        toolArgs.assessment as string | undefined,
        toolArgs.direction as 'South' | 'East' | 'West' | 'North' | undefined,
        toolArgs.correctiveActions as string[] | undefined,
        toolArgs.updateReality !== false,
      );
      let responseText = mmotResult.guidance;
      if (mmotResult.evaluationStored) {
        responseText += '\n\n✅ Evaluation stored in chart current reality.';
      }
      if (mmotResult.beatEmitted) {
        responseText += '\n📡 MMOT narrative beat emitted.';
      }
      return { content: [{ type: 'text', text: responseText }] };
    }
    case 'create_narrative_beat': {
      const valResult = validate(toolArgs, {
        parentChartId: ValidationSchemas.nonEmptyString(),
        title: ValidationSchemas.nonEmptyString(),
        act: { type: 'number', required: true, minValue: 1 },
        type_dramatic: ValidationSchemas.nonEmptyString(),
        universes: { type: 'array', required: true, minLength: 1, items: { type: 'string' } },
        description: ValidationSchemas.nonEmptyString(),
        prose: ValidationSchemas.nonEmptyString(),
        lessons: { type: 'array', required: true, items: { type: 'string' } },
        assessRelationalAlignment: { type: 'boolean' },
        initiateFourDirectionsInquiry: { type: 'boolean' },
        filePath: { type: 'string' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };

      const beatResult = await manager.createNarrativeBeat(
        toolArgs.parentChartId as string,
        toolArgs.title as string,
        toolArgs.act as number,
        toolArgs.type_dramatic as string,
        toolArgs.universes as string[],
        toolArgs.description as string,
        toolArgs.prose as string,
        toolArgs.lessons as string[],
        (toolArgs.assessRelationalAlignment as boolean) || false,
        (toolArgs.initiateFourDirectionsInquiry as boolean) || false,
        toolArgs.filePath as string | undefined,
      );
      return { content: [{ type: 'text', text: JSON.stringify(beatResult, null, 2) }] };
    }
    case 'telescope_narrative_beat': {
      const valResult = validate(toolArgs, {
        parentBeatName: ValidationSchemas.nonEmptyString(),
        newCurrentReality: ValidationSchemas.nonEmptyString(),
        initialSubBeats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', required: true },
              type_dramatic: { type: 'string', required: true },
              description: { type: 'string', required: true },
              prose: { type: 'string', required: true },
              lessons: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
        },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };

      const telescopeResult = await manager.telescopeNarrativeBeat(
        toolArgs.parentBeatName as string,
        toolArgs.newCurrentReality as string,
        (Array.isArray(toolArgs.initialSubBeats) ? toolArgs.initialSubBeats : []) as Array<{
          title: string;
          type_dramatic: string;
          description: string;
          prose: string;
          lessons: string[];
        }>,
      );
      return { content: [{ type: 'text', text: JSON.stringify(telescopeResult, null, 2) }] };
    }
    case 'list_narrative_beats': {
      const valResult = validate(toolArgs, {
        parentChartId: { type: 'string' },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const parentChartId = toolArgs.parentChartId as string | undefined;
      const beatsResult = await manager.listNarrativeBeats(parentChartId);

      if (beatsResult.length === 0) {
        return { content: [{ type: 'text', text: 'No narrative beats found.' }] };
      }

      let beatsText = '## 📖 Narrative Beats\n\n';
      beatsResult.forEach(beat => {
        const act = beat.metadata?.act || '?';
        const type = beat.metadata?.type_dramatic || 'Unknown';
        const universes = beat.metadata?.universes?.join(', ') || 'Unknown';
        const lessons = beat.metadata?.narrative?.lessons || [];

        beatsText += `### Act ${act}: ${type}\n`;
        beatsText += `**Name**: ${beat.name}\n`;
        beatsText += `**Universes**: ${universes}\n`;
        beatsText += `**Description**: ${beat.metadata?.narrative?.description || 'N/A'}\n`;
        if (lessons.length > 0) {
          beatsText += `**Lessons**: ${lessons.join(', ')}\n`;
        }
        beatsText += '\n';
      });

      return { content: [{ type: 'text', text: beatsText }] };
    }
    case 'init_llm_guidance': {
      const valResult = validate(toolArgs, {
        format: { type: 'enum', enumValues: ['full', 'quick', 'save_directive'] },
      });
      if (!valResult.valid) return { content: [{ type: 'text', text: `Error: ${valResult.error}` }], isError: true };
      const format = (toolArgs.format as string) || 'full';

      if (format === 'save_directive') {
        return { content: [{ type: 'text', text: LLM_GUIDANCE_SAVE_DIRECTIVE }] };
      }

      if (format === 'quick') {
        return { content: [{ type: 'text', text: LLM_GUIDANCE_QUICK }] };
      }

      return { content: [{ type: 'text', text: LLM_GUIDANCE_FULL }] };
    }
    default: {
      return {
        content: [{ type: 'text', text: `Error: Unknown tool: ${name}` }],
        isError: true,
      };
    }
  }
}

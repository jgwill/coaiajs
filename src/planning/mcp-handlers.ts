/**
 * Planning MCP tool dispatch — handles each tool by calling plan-parser functions
 * Ported from coaia-planning/src/index.ts handler logic
 */

import { promises as fs, readFileSync, existsSync } from 'fs';
import path from 'path';
import type { McpToolResult, DecompositionResult, StoredDecomposition } from '../types.js';
import {
  parsePlan,
  parsePlanContent,
  planToSTC,
  exportToJSONL,
  decompositionResultToPlan,
} from './plan-parser.js';
import type { StructuralTensionPlan } from '../types.js';

// Cache for parsed plans
const planCache = new Map<string, StructuralTensionPlan>();

function getCachedOrParse(planPath: string): Promise<StructuralTensionPlan> {
  if (planCache.has(planPath)) {
    return Promise.resolve(planCache.get(planPath)!);
  }
  return parsePlan(planPath).then(parsed => {
    planCache.set(planPath, parsed);
    return parsed;
  });
}

interface ChartEntity {
  name: string;
  entityType: string;
  observations: string[];
  metadata?: Record<string, unknown>;
}

function loadExistingCharts(chartsPath: string): ChartEntity[] {
  try {
    if (!existsSync(chartsPath)) return [];
    const content = readFileSync(chartsPath, 'utf-8');
    return content
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => JSON.parse(line) as ChartEntity);
  } catch {
    return [];
  }
}

interface PlanChange {
  type: 'new_action' | 'completed_action' | 'modified_outcome' | 'modified_reality';
  description: string;
  details: string;
}

function detectPlanChanges(parsed: StructuralTensionPlan, existingCharts: ChartEntity[]): PlanChange[] {
  const changes: PlanChange[] = [];
  const existingActions = existingCharts
    .filter(c => c.entityType === 'action_step')
    .map(c => c.observations[0]);

  for (const step of parsed.actionSteps) {
    if (!existingActions.includes(step.content)) {
      changes.push({
        type: 'new_action',
        description: step.content,
        details: `New action step detected: ${step.content}`,
      });
    }
  }

  return changes;
}

function chartsToPlan(charts: ChartEntity[]): string {
  let md = '';

  const chartEntity = charts.find(c => c.entityType === 'structural_tension_chart');
  if (chartEntity) {
    const title = chartEntity.name.replace(/_chart$/, '').replace(/_/g, ' ');
    md += `# ${title}\n\n`;
  }

  const desiredOutcome = charts.find(c => c.entityType === 'desired_outcome');
  if (desiredOutcome) {
    md += `## Desired Outcome\n\n${desiredOutcome.observations[0]}\n\n`;
  }

  const currentReality = charts.find(c => c.entityType === 'current_reality');
  if (currentReality) {
    md += `## Current Reality\n\n${currentReality.observations[0]}\n\n`;
  }

  const actionSteps = charts
    .filter(c => c.entityType === 'action_step')
    .sort((a, b) => ((a.metadata?.order as number) || 0) - ((b.metadata?.order as number) || 0));

  if (actionSteps.length > 0) {
    md += `## Action Steps\n\n`;
    for (const step of actionSteps) {
      const completed = step.metadata?.completionStatus ? '[x]' : '[ ]';
      md += `- ${completed} ${step.observations[0]}\n`;
    }
  }

  return md;
}

export async function handlePlanningTool(
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  try {
    switch (name) {
      case 'parse_plan_structural': {
        let parsed: StructuralTensionPlan;

        if (args.planPath) {
          const planPath = args.planPath as string;
          parsed = await parsePlan(planPath);
          planCache.set(planPath, parsed);
        } else if (args.planContent) {
          parsed = parsePlanContent(args.planContent as string);
        } else {
          throw new Error('Either planPath or planContent must be provided');
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              structuralAnalysis: {
                title: parsed.title,
                filePath: parsed.filePath,
                desiredOutcome: parsed.desiredOutcome ? {
                  content: parsed.desiredOutcome.content,
                  confidence: parsed.desiredOutcome.confidence,
                } : null,
                currentReality: parsed.currentReality ? {
                  content: parsed.currentReality.content,
                  confidence: parsed.currentReality.confidence,
                } : null,
                actionSteps: parsed.actionSteps.map(s => ({
                  content: s.content,
                  confidence: s.confidence,
                  canTelescope: !!s.telescopesInto,
                })),
                observations: parsed.observations,
              },
            }, null, 2),
          }],
        };
      }

      case 'plan_to_stc': {
        const planPath = args.planPath as string;
        const outputPath = (args.outputPath as string) ||
          path.join(process.cwd(), `${path.basename(planPath, '.md')}.stc.jsonl`);

        const parsed = await getCachedOrParse(planPath);

        // Override current reality if provided
        if (args.currentReality && parsed.currentReality) {
          parsed.currentReality.content = args.currentReality as string;
        } else if (args.currentReality) {
          parsed.currentReality = {
            type: 'current_reality',
            content: args.currentReality as string,
            confidence: 1.0,
            sourceLines: { start: 0, end: 0 },
          };
        }

        const stc = planToSTC(parsed);
        const jsonl = exportToJSONL(stc);

        await fs.writeFile(outputPath, jsonl + '\n');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              chartCreated: {
                title: parsed.title,
                entitiesCount: stc.entities.length,
                relationsCount: stc.relations.length,
                outputPath,
                hasDesiredOutcome: !!parsed.desiredOutcome,
                hasCurrentReality: !!parsed.currentReality,
                actionStepsCount: parsed.actionSteps.length,
                telescopedCount: parsed.actionSteps.filter(s => s.telescopesInto).length,
              },
            }, null, 2),
          }],
        };
      }

      case 'sync_plan_to_chart': {
        const planPath = args.planPath as string;
        const chartsPath = args.chartsPath as string;
        const dryRun = args.dryRun as boolean || false;

        const parsed = await getCachedOrParse(planPath);
        const existingCharts = loadExistingCharts(chartsPath);
        const changes = detectPlanChanges(parsed, existingCharts);

        if (dryRun) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ dryRun: true, changes }, null, 2),
            }],
          };
        }

        // Apply changes: regenerate STC and write
        const stc = planToSTC(parsed);
        const jsonl = exportToJSONL(stc);
        await fs.writeFile(chartsPath, jsonl + '\n');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, changesApplied: changes }, null, 2),
          }],
        };
      }

      case 'sync_chart_to_plan': {
        const chartsPath = args.chartsPath as string;
        const planPath = args.planPath as string;
        const dryRun = args.dryRun as boolean || false;

        const charts = loadExistingCharts(chartsPath);
        const planContent = chartsToPlan(charts);

        if (dryRun) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ dryRun: true, proposedPlanContent: planContent }, null, 2),
            }],
          };
        }

        await fs.writeFile(planPath, planContent);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, planUpdated: planPath }, null, 2),
          }],
        };
      }

      case 'create_plan_trace': {
        const planPath = args.planPath as string;
        const chartsPath = args.chartsPath as string;
        const sessionId = args.sessionId as string | undefined;
        const metadata = args.metadata as Record<string, unknown> || {};

        const parsed = await getCachedOrParse(planPath);
        const charts = loadExistingCharts(chartsPath);

        const traceData = {
          trace_id: `plan-${Date.now()}`,
          name: `📋 Plan→STC: ${parsed.title}`,
          session_id: sessionId,
          input_data: {
            plan_title: parsed.title,
            plan_path: planPath,
            desired_outcome: parsed.desiredOutcome?.content,
            current_reality: parsed.currentReality?.content,
            action_steps: parsed.actionSteps.map(s => s.content),
          },
          output_data: {
            charts_created: charts.length,
            charts_path: chartsPath,
          },
          metadata: {
            ...metadata,
            transformation_timestamp: new Date().toISOString(),
            tool: 'coaia-planning',
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              traceData,
              note: 'Use Langfuse MCP to create trace with this data',
            }, null, 2),
          }],
        };
      }

      case 'pde_to_plan': {
        const workdir = (args.workdir as string) || process.cwd();
        let decomposition: DecompositionResult;
        let originalPrompt: string | undefined = args.original_prompt as string | undefined;

        if (args.pde_id) {
          const pdeId = args.pde_id as string;
          const pdePath = path.join(workdir, '.pde', `${pdeId}.json`);

          let data: string;
          try {
            data = await fs.readFile(pdePath, 'utf-8');
          } catch {
            throw new Error(`PDE decomposition not found: ${pdePath}`);
          }

          const stored = JSON.parse(data) as StoredDecomposition;
          decomposition = stored.result;
          originalPrompt = originalPrompt || stored.prompt;
        } else if (args.decomposition_result) {
          decomposition = args.decomposition_result as DecompositionResult;
        } else {
          throw new Error('Either pde_id or decomposition_result must be provided');
        }

        const stc = decompositionResultToPlan(decomposition, originalPrompt);
        const jsonl = exportToJSONL(stc);

        if (args.outputPath) {
          const outPath = path.isAbsolute(args.outputPath as string)
            ? args.outputPath as string
            : path.resolve(args.outputPath as string);
          await fs.writeFile(outPath, jsonl + '\n');
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              chartCreated: {
                entitiesCount: stc.entities.length,
                relationsCount: stc.relations.length,
                primaryIntent: `${decomposition.primary.action}: ${decomposition.primary.target}`,
                actionStepsCount: decomposition.actionStack.length,
                ambiguitiesCount: decomposition.ambiguities.length,
                outputPath: args.outputPath || null,
              },
              jsonl,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown planning tool: ${name}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}

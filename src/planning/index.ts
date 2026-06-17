/**
 * Planning module — Plan Parser + Plan→STC transformation
 */

export {
  parsePlan,
  parsePlanContent,
  planToSTC,
  exportToJSONL,
  decompositionResultToPlan,
} from './plan-parser.js';
export { PLANNING_MCP_TOOLS } from './mcp-tools.js';
export { handlePlanningTool } from './mcp-handlers.js';

import { handlePlanningTool } from './mcp-handlers.js';
import type { McpToolResult } from '../types.js';

function firstText(result: McpToolResult): string {
  return result.content[0]?.text ?? '';
}

export async function convertToChart(planPath: string, outputPath?: string): Promise<string> {
  return firstText(await handlePlanningTool('plan_to_stc', { planPath, outputPath }));
}

export async function syncToChart(planPath: string, chartsPath: string): Promise<string> {
  return firstText(await handlePlanningTool('sync_plan_to_chart', { planPath, chartsPath }));
}

export async function syncToPlan(chartsPath: string, planPath: string): Promise<string> {
  return firstText(await handlePlanningTool('sync_chart_to_plan', { chartsPath, planPath }));
}

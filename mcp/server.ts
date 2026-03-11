#!/usr/bin/env node
// coaiajs/mcp/server.ts — Unified MCP server
// Consolidates all tools: coaiapy-mcp (20) + narrative (28) + PDE (10) + planning (6) = 64+ tools

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { FeatureConfig } from './config.js';
import { getCoaiapyToolDefinitions } from './tools/index.js';
import type { ToolDefinition } from './tools/index.js';

// Langfuse imports
import {
  addTrace, patchTraceOutput, listTraces, getTrace, formatTracesTable, formatTraceTree,
} from '../src/langfuse/traces.js';
import { addObservation, getObservation, formatObservationDisplay } from '../src/langfuse/observations.js';
import { listPrompts, getPrompt, formatPromptsTable, formatPromptDisplay } from '../src/langfuse/prompts.js';
import { listDatasets, getDataset, formatDatasetsTable } from '../src/langfuse/datasets.js';
import {
  listScoreConfigs, getScoreConfig, applyScoreConfig,
  formatScoreConfigsTable,
} from '../src/langfuse/scores.js';
import { listComments, getComment, createComment } from '../src/langfuse/comments.js';
import { uploadAndAttachMedia, getMedia, formatMediaDisplay } from '../src/langfuse/media.js';

// ─── Server Info ────────────────────────────────────────────────────

const SERVER_NAME = 'coaiajs-mcp';
const SERVER_VERSION = '0.1.0';

// ─── Parse CLI args ─────────────────────────────────────────────────

function parseArgs(): { memoryPath?: string; plansDir?: string; featureLevel?: string } {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--memory-path' && args[i + 1]) {
      result.memoryPath = args[++i];
    } else if (args[i] === '--plans-dir' && args[i + 1]) {
      result.plansDir = args[++i];
    } else if (args[i] === '--features' && args[i + 1]) {
      result.featureLevel = args[++i];
    }
  }
  return result;
}

// ─── Tool Handler ───────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text }], isError };
}

async function handleCoaiapyTool(name: string, args: ToolArgs): Promise<CallToolResult> {
  try {
    switch (name) {
      // ── Redis ──
      case 'coaia_tash': {
        // Redis stash — defer to redis module if available, placeholder for now
        return textResult(JSON.stringify({
          success: false,
          error: 'Redis module not yet wired. Use coaiapy-mcp for Redis operations.',
        }));
      }
      case 'coaia_fetch': {
        return textResult(JSON.stringify({
          success: false,
          error: 'Redis module not yet wired. Use coaiapy-mcp for Redis operations.',
        }));
      }

      // ── Traces ──
      case 'coaia_fuse_trace_create': {
        const result = await addTrace({
          traceId: args.trace_id as string,
          userId: args.user_id as string | undefined,
          sessionId: args.session_id as string | undefined,
          name: args.name as string | undefined,
          metadata: args.metadata as Record<string, unknown> | undefined,
          inputData: args.input_data,
          outputData: args.output_data,
        });
        return textResult(result);
      }

      case 'coaia_fuse_add_observation': {
        const result = await addObservation({
          observationId: args.observation_id as string,
          traceId: args.trace_id as string,
          name: args.name as string,
          type: args.observation_type as string | undefined,
          parentId: args.parent_id as string | undefined,
          metadata: args.metadata as Record<string, unknown> | undefined,
          inputData: args.input_data,
          outputData: args.output_data,
          startTime: args.start_time as string | undefined,
          endTime: args.end_time as string | undefined,
        });
        return textResult(result);
      }

      case 'coaia_fuse_trace_patch_output': {
        const result = await patchTraceOutput(
          args.trace_id as string,
          args.output_data,
        );
        return textResult(result);
      }

      case 'coaia_fuse_trace_get':
      case 'coaia_fuse_trace_view': {
        const traceJson = await getTrace(args.trace_id as string);
        if (args.json_output) {
          return textResult(traceJson);
        }
        const formatted = formatTraceTree(traceJson);
        return textResult(formatted);
      }

      case 'coaia_fuse_observation_get': {
        const obsJson = await getObservation(args.observation_id as string);
        if (args.json_output) {
          return textResult(obsJson);
        }
        return textResult(formatObservationDisplay(obsJson));
      }

      case 'coaia_fuse_traces_list': {
        const result = await listTraces({
          sessionId: args.session_id as string | undefined,
          userId: args.user_id as string | undefined,
          name: args.name as string | undefined,
          tags: args.tags as string[] | undefined,
          fromTimestamp: args.from_timestamp as string | undefined,
          toTimestamp: args.to_timestamp as string | undefined,
          orderBy: args.order_by as string | undefined,
          page: args.page as number | undefined,
          limit: args.limit as number | undefined,
        });
        return textResult(formatTracesTable(result));
      }

      case 'coaia_fuse_traces_session_view': {
        const result = await listTraces({
          sessionId: args.session_id as string,
        });
        if (args.json_output) return textResult(result);
        return textResult(formatTracesTable(result));
      }

      // ── Prompts ──
      case 'coaia_fuse_prompts_list': {
        const result = await listPrompts();
        return textResult(formatPromptsTable(result));
      }

      case 'coaia_fuse_prompts_get': {
        const result = await getPrompt(
          args.name as string,
          args.label as string | undefined,
        );
        return textResult(formatPromptDisplay(result));
      }

      // ── Datasets ──
      case 'coaia_fuse_datasets_list': {
        const result = await listDatasets();
        return textResult(formatDatasetsTable(result));
      }

      case 'coaia_fuse_datasets_get': {
        const result = await getDataset(args.name as string);
        return textResult(result);
      }

      // ── Score Configs ──
      case 'coaia_fuse_score_configs_list': {
        const result = await listScoreConfigs();
        return textResult(formatScoreConfigsTable(result));
      }

      case 'coaia_fuse_score_configs_get': {
        const result = await getScoreConfig(args.name_or_id as string);
        return textResult(result);
      }

      case 'coaia_fuse_score_apply': {
        const result = await applyScoreConfig(
          args.config_name_or_id as string,
          args.target_type as string,
          args.target_id as string,
          args.value as number,
          args.observation_id as string | undefined,
          args.comment as string | undefined,
        );
        return textResult(result);
      }

      // ── Comments ──
      case 'coaia_fuse_comments_list': {
        const result = await listComments({
          objectType: args.object_type as string | undefined,
          objectId: args.object_id as string | undefined,
          authorUserId: args.author_user_id as string | undefined,
          page: args.page as number | undefined,
          limit: args.limit as number | undefined,
        });
        return textResult(result);
      }

      case 'coaia_fuse_comments_get': {
        const result = await getComment(args.comment_id as string);
        return textResult(result);
      }

      case 'coaia_fuse_comments_create': {
        const result = await createComment({
          text: args.text as string,
          objectType: args.object_type as string,
          objectId: args.object_id as string,
          authorUserId: args.author_user_id as string | undefined,
        });
        return textResult(result);
      }

      // ── Media ──
      case 'coaia_fuse_media_upload': {
        const result = await uploadAndAttachMedia({
          filePath: args.file_path as string,
          traceId: args.trace_id as string,
          field: args.field as string | undefined,
          observationId: args.observation_id as string | undefined,
          contentType: args.content_type as string | undefined,
        });
        return textResult(result);
      }

      case 'coaia_fuse_media_get': {
        const result = await getMedia(args.media_id as string);
        return textResult(formatMediaDisplay(result));
      }

      default:
        return textResult(`Unknown tool: ${name}`, true);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return textResult(JSON.stringify({ error: msg }), true);
  }
}

// ─── Narrative/PDE/Planning tool stubs ──────────────────────────────
// These modules will be wired by other direction agents (SOUTH/EAST/WEST).
// For now we register placeholder definitions so the server schema is complete.

function getNarrativeToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  const narrativeToolNames = [
    'create_structural_tension_chart', 'telescope_action_step', 'mark_action_complete',
    'get_chart_progress', 'list_active_charts', 'get_chart', 'get_action_step',
    'update_action_progress', 'update_current_reality', 'manage_action_step',
    'add_action_step', 'remove_action_step', 'update_desired_outcome',
    'perform_mmot_evaluation', 'init_llm_guidance',
    'create_narrative_beat', 'telescope_narrative_beat', 'list_narrative_beats',
    'add_observations', 'create_entities', 'create_relations', 'search_nodes',
    'open_nodes', 'read_graph', 'delete_entities', 'delete_relations',
    'delete_observations', 'merge_entities',
  ];

  return narrativeToolNames
    .filter((name) => featureConfig.isToolEnabled(name))
    .map((name) => ({
      name,
      description: `[Narrative] ${name.replace(/_/g, ' ')} — pending wiring from narrative module`,
      inputSchema: { type: 'object' as const, properties: {} },
    }));
}

function getPdeToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  const pdeToolNames = [
    'pde_decompose', 'pde_parse_response', 'pde_get', 'pde_list',
    'pde_export_markdown', 'import_pde', 'create_stc_from_pde',
    'pde_sessions_list', 'pde_sessions_create', 'pde_sessions_update',
  ];

  return pdeToolNames
    .filter((name) => featureConfig.isToolEnabled(name))
    .map((name) => ({
      name,
      description: `[PDE] ${name.replace(/_/g, ' ')} — pending wiring from PDE module`,
      inputSchema: { type: 'object' as const, properties: {} },
    }));
}

function getPlanningToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  const planToolNames = [
    'parse_plan', 'plan_to_stc', 'sync_plans', 'trace_plan', 'pde_to_plan', 'list_plans',
  ];

  return planToolNames
    .filter((name) => featureConfig.isToolEnabled(name))
    .map((name) => ({
      name,
      description: `[Planning] ${name.replace(/_/g, ' ')} — pending wiring from planning module`,
      inputSchema: { type: 'object' as const, properties: {} },
    }));
}

// ─── Server Creation ────────────────────────────────────────────────

function createServer(): Server {
  const cliArgs = parseArgs();
  const featureConfig = new FeatureConfig(
    cliArgs.featureLevel as 'MINIMAL' | 'STANDARD' | 'OBSERVABILITY' | 'FULL' | undefined,
  );

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // Collect all tool definitions
  const allToolDefs: ToolDefinition[] = [
    ...getCoaiapyToolDefinitions(featureConfig),
    ...getNarrativeToolDefinitions(featureConfig),
    ...getPdeToolDefinitions(featureConfig),
    ...getPlanningToolDefinitions(featureConfig),
  ];

  // ── list_tools handler ──
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefs.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // ── call_tool handler ──
  server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as ToolArgs;

    // Route to coaiapy handler if it's a coaia_* tool
    if (name.startsWith('coaia_')) {
      return handleCoaiapyTool(name, toolArgs);
    }

    // Route to narrative/PDE/planning stubs
    const stubModules = ['create_structural_tension_chart', 'telescope_action_step',
      'mark_action_complete', 'get_chart_progress', 'list_active_charts', 'get_chart',
      'get_action_step', 'update_action_progress', 'update_current_reality',
      'manage_action_step', 'add_action_step', 'remove_action_step',
      'update_desired_outcome', 'perform_mmot_evaluation', 'init_llm_guidance',
      'create_narrative_beat', 'telescope_narrative_beat', 'list_narrative_beats',
      'add_observations', 'create_entities', 'create_relations', 'search_nodes',
      'open_nodes', 'read_graph', 'delete_entities', 'delete_relations',
      'delete_observations', 'merge_entities',
      'pde_decompose', 'pde_parse_response', 'pde_get', 'pde_list',
      'pde_export_markdown', 'import_pde', 'create_stc_from_pde',
      'pde_sessions_list', 'pde_sessions_create', 'pde_sessions_update',
      'parse_plan', 'plan_to_stc', 'sync_plans', 'trace_plan', 'pde_to_plan', 'list_plans',
    ];

    if (stubModules.includes(name)) {
      return textResult(JSON.stringify({
        status: 'pending',
        message: `Tool '${name}' is registered but not yet wired. Module integration pending.`,
        args: toolArgs,
      }));
    }

    return textResult(`Unknown tool: ${name}`, true);
  });

  return server;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const featureConfig = new FeatureConfig();
  const stats = featureConfig.getStats();
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started (${stats.level}: ${stats.tools} tools)`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

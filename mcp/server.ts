#!/usr/bin/env node
// coaiajs/mcp/server.ts — Unified MCP server
// Consolidates all tools: coaiapy-mcp (20) + narrative (28) + PDE (10) + planning (6) = 64+ tools

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { FeatureConfig } from './config.js';
import { getCoaiapyToolDefinitions } from './tools/index.js';
import type { ToolDefinition } from './tools/index.js';
import { readCoaiaResource } from './resources.js';
import { listPrompts as listCoaiaPrompts, renderPrompt } from './prompts.js';
import { tash as redisTash, fetch as redisFetch } from '../src/redis.js';
import {
  ALL_TOOL_DEFINITIONS as NARRATIVE_TOOL_DEFINITIONS,
  handleToolCall as handleNarrativeTool,
  KnowledgeGraphManager,
} from '../src/narrative/index.js';
import { PDE_MCP_TOOLS, handlePdeTool } from '../src/pde/index.js';
import { PLANNING_MCP_TOOLS, handlePlanningTool } from '../src/planning/index.js';
import type { McpToolResult } from '../src/types.js';

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
const SERVER_VERSION = '0.1.1';

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

function toCallToolResult(result: McpToolResult): CallToolResult {
  return {
    content: result.content.map((item) => ({
      type: 'text' as const,
      text: item.text,
    })),
    isError: result.isError,
  };
}

async function handleCoaiapyTool(name: string, args: ToolArgs): Promise<CallToolResult> {
  try {
    switch (name) {
      // ── Redis ──
      case 'coaia_tash': {
        await redisTash(
          args.key as string,
          args.value as string,
          args.ttl as number | undefined,
        );
        return textResult(JSON.stringify({
          success: true,
          message: `Stored '${args.key as string}' in Redis`,
        }, null, 2));
      }
      case 'coaia_fetch': {
        const value = await redisFetch(args.key as string);
        if (value == null) {
          return textResult(JSON.stringify({
            success: false,
            error: `Key '${args.key as string}' not found in Redis`,
          }, null, 2), true);
        }
        return textResult(JSON.stringify({ success: true, value }, null, 2));
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

// ─── Narrative/PDE/Planning tool routing ────────────────────────────

function getNarrativeToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  return NARRATIVE_TOOL_DEFINITIONS
    .filter((tool) => featureConfig.isToolEnabled(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
}

const NARRATIVE_TOOL_NAMES = new Set(NARRATIVE_TOOL_DEFINITIONS.map((tool) => tool.name));
const PDE_ALIAS_TO_TOOL: Record<string, string> = {
  pde_update_action_progress: 'update_action_progress',
  pde_mark_action_complete: 'mark_action_complete',
  pde_add_action_step: 'add_action_step',
  pde_update_current_reality: 'update_current_reality',
};
const PDE_TOOL_NAMES = new Set([
  ...PDE_MCP_TOOLS.map((tool) => tool.name),
  ...Object.keys(PDE_ALIAS_TO_TOOL),
]);
const PLANNING_TOOL_NAMES = new Set(PLANNING_MCP_TOOLS.map((tool) => tool.name));

function namespacePdeToolIfNeeded(tool: ToolDefinition): ToolDefinition {
  if (!NARRATIVE_TOOL_NAMES.has(tool.name)) return tool;
  return {
    ...tool,
    name: `pde_${tool.name}`,
    description: `[PDE session] ${tool.description}`,
  };
}

function getPdeToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  return PDE_MCP_TOOLS
    .map((tool) => namespacePdeToolIfNeeded(tool as ToolDefinition))
    .filter((tool) => featureConfig.isToolEnabled(tool.name));
}

function getPlanningToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  return PLANNING_MCP_TOOLS
    .filter((tool) => featureConfig.isToolEnabled(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
}

function normalizePdeToolName(name: string): string {
  return PDE_ALIAS_TO_TOOL[name] ?? name;
}

// ─── Server Creation ────────────────────────────────────────────────

function createServer(): Server {
  const cliArgs = parseArgs();
  const featureConfig = new FeatureConfig(
    cliArgs.featureLevel as 'MINIMAL' | 'STANDARD' | 'OBSERVABILITY' | 'FULL' | undefined,
  );

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  const memoryPath = cliArgs.memoryPath ?? process.env['COAIAJS_MEMORY_PATH'] ?? 'coaia-memory.jsonl';
  const narrativeManager = new KnowledgeGraphManager(memoryPath);

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

  // ── resources/list handler ──
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'coaia://templates/',
          name: 'Pipeline Templates',
          description: 'List of all available pipeline templates',
          mimeType: 'application/json',
        },
      ].filter((resource) => featureConfig.isResourceEnabled(resource.uri)),
    };
  });

  // ── resources/read handler ──
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (!featureConfig.isResourceEnabled(uri)) {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: `Resource '${uri}' is not available in ${featureConfig.getFeatureLevel()} feature set`,
          }, null, 2),
        }],
      };
    }
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: await readCoaiaResource(uri),
      }],
    };
  });

  // ── prompts/list handler ──
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: listCoaiaPrompts()
        .filter((prompt) => featureConfig.isPromptEnabled(prompt.id))
        .map((prompt) => ({
          name: prompt.id,
          title: prompt.name,
          description: prompt.description,
          arguments: prompt.variables.map((variable) => ({
            name: variable.name,
            description: variable.description,
            required: variable.required,
          })),
        })),
    };
  });

  // ── prompts/get handler ──
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;
    if (!featureConfig.isPromptEnabled(name)) {
      const error = `Prompt '${name}' is not available in ${featureConfig.getFeatureLevel()} feature set`;
      return {
        description: `Error: ${error}`,
        messages: [{ role: 'user', content: { type: 'text', text: error } }],
      };
    }

    try {
      const rendered = renderPrompt(name, promptArgs ?? {});
      if (!rendered) {
        const error = `Prompt '${name}' not found`;
        return {
          description: `Error: ${error}`,
          messages: [{ role: 'user', content: { type: 'text', text: error } }],
        };
      }
      return {
        description: `Rendered prompt: ${name}`,
        messages: [{ role: 'user', content: { type: 'text', text: rendered } }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        description: `Error: ${message}`,
        messages: [{ role: 'user', content: { type: 'text', text: message } }],
      };
    }
  });

  // ── call_tool handler ──
  server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as ToolArgs;

    // Route to coaiapy handler if it's a coaia_* tool
    if (name.startsWith('coaia_')) {
      return handleCoaiapyTool(name, toolArgs);
    }

    if (NARRATIVE_TOOL_NAMES.has(name)) {
      return toCallToolResult(await handleNarrativeTool(name, toolArgs, narrativeManager));
    }

    if (PDE_TOOL_NAMES.has(name)) {
      return toCallToolResult(await handlePdeTool(normalizePdeToolName(name), toolArgs));
    }

    if (PLANNING_TOOL_NAMES.has(name)) {
      return toCallToolResult(await handlePlanningTool(name, toolArgs));
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

  const cliArgs = parseArgs();
  const featureConfig = new FeatureConfig(
    cliArgs.featureLevel as 'MINIMAL' | 'STANDARD' | 'OBSERVABILITY' | 'FULL' | undefined,
  );
  const stats = featureConfig.getStats();
  console.error(
    `${SERVER_NAME} v${SERVER_VERSION} started (${stats.level}: ${stats.tools} tools, ${stats.prompts} prompts, ${stats.resources} resources)`,
  );
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

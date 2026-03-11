// coaiajs/mcp/tools/coaiapy-tools.ts — Tool definitions for coaiapy-equivalent tools
// Port of coaiapy-mcp/server.py tool schemas (20 tools)

import type { FeatureConfig } from '../config.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export function getCoaiapyToolDefinitions(featureConfig: FeatureConfig): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // ─── Redis Tools ────────────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_tash')) {
    tools.push({
      name: 'coaia_tash',
      description: 'Stash key-value pair to Redis',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Redis key' },
          value: { type: 'string', description: 'Value to store' },
        },
        required: ['key', 'value'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fetch')) {
    tools.push({
      name: 'coaia_fetch',
      description: 'Fetch value from Redis by key',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Redis key to fetch' },
        },
        required: ['key'],
      },
    });
  }

  // ─── Trace Tools ────────────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_trace_create')) {
    tools.push({
      name: 'coaia_fuse_trace_create',
      description: 'Create a Langfuse trace for observability tracking',
      inputSchema: {
        type: 'object',
        properties: {
          trace_id: { type: 'string', description: 'Unique trace identifier' },
          user_id: { type: 'string', description: 'User identifier' },
          session_id: { type: 'string', description: 'Session identifier' },
          name: { type: 'string', description: 'Trace name' },
          metadata: { type: 'object', description: 'Metadata dictionary' },
          input_data: { description: 'Input data' },
          output_data: { description: 'Output data' },
        },
        required: ['trace_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_add_observation')) {
    tools.push({
      name: 'coaia_fuse_add_observation',
      description: 'Add an observation (event, span, or generation) to a trace',
      inputSchema: {
        type: 'object',
        properties: {
          observation_id: { type: 'string', description: 'Unique observation identifier' },
          trace_id: { type: 'string', description: 'Parent trace ID' },
          name: { type: 'string', description: 'Observation name' },
          observation_type: { type: 'string', enum: ['SPAN', 'EVENT', 'GENERATION'], description: 'Observation type' },
          parent_id: { type: 'string', description: 'Parent observation ID for nesting' },
          metadata: { type: 'object', description: 'Metadata' },
          input_data: { description: 'Input data' },
          output_data: { description: 'Output data' },
          start_time: { type: 'string', description: 'Start timestamp (ISO 8601)' },
          end_time: { type: 'string', description: 'End timestamp (ISO 8601)' },
        },
        required: ['observation_id', 'trace_id', 'name'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_trace_patch_output')) {
    tools.push({
      name: 'coaia_fuse_trace_patch_output',
      description: 'Update the output field of an existing trace',
      inputSchema: {
        type: 'object',
        properties: {
          trace_id: { type: 'string', description: 'Trace ID to update' },
          output_data: { description: 'New output data' },
        },
        required: ['trace_id', 'output_data'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_trace_get')) {
    tools.push({
      name: 'coaia_fuse_trace_get',
      description: 'Get a specific trace by ID with all its observations',
      inputSchema: {
        type: 'object',
        properties: {
          trace_id: { type: 'string', description: 'Trace ID to fetch' },
          json_output: { type: 'boolean', description: 'Return raw JSON instead of formatted tree' },
        },
        required: ['trace_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_trace_view')) {
    tools.push({
      name: 'coaia_fuse_trace_view',
      description: 'View trace details with observations (alias for trace_get)',
      inputSchema: {
        type: 'object',
        properties: {
          trace_id: { type: 'string', description: 'Trace ID' },
          json_output: { type: 'boolean', description: 'Return raw JSON' },
        },
        required: ['trace_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_observation_get')) {
    tools.push({
      name: 'coaia_fuse_observation_get',
      description: 'Get a specific observation by ID',
      inputSchema: {
        type: 'object',
        properties: {
          observation_id: { type: 'string', description: 'Observation ID' },
          json_output: { type: 'boolean', description: 'Return raw JSON' },
        },
        required: ['observation_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_traces_list')) {
    tools.push({
      name: 'coaia_fuse_traces_list',
      description: 'List traces with optional filtering by session, user, name, tags, and time range',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Filter by session ID' },
          user_id: { type: 'string', description: 'Filter by user ID' },
          name: { type: 'string', description: 'Filter by trace name' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
          from_timestamp: { type: 'string', description: 'Filter from timestamp (ISO 8601)' },
          to_timestamp: { type: 'string', description: 'Filter to timestamp (ISO 8601)' },
          order_by: { type: 'string', description: 'Sort order' },
          page: { type: 'integer', description: 'Page number', default: 1 },
          limit: { type: 'integer', description: 'Items per page', default: 50 },
        },
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_traces_session_view')) {
    tools.push({
      name: 'coaia_fuse_traces_session_view',
      description: 'View all traces for a specific session',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session ID to view traces for' },
          json_output: { type: 'boolean', description: 'Return raw JSON' },
        },
        required: ['session_id'],
      },
    });
  }

  // ─── Prompts Tools ──────────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_prompts_list')) {
    tools.push({
      name: 'coaia_fuse_prompts_list',
      description: 'List all Langfuse prompts',
      inputSchema: { type: 'object', properties: {} },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_prompts_get')) {
    tools.push({
      name: 'coaia_fuse_prompts_get',
      description: 'Get a specific Langfuse prompt by name',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Prompt name' },
          label: { type: 'string', description: 'Optional deployment label' },
        },
        required: ['name'],
      },
    });
  }

  // ─── Dataset Tools ──────────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_datasets_list')) {
    tools.push({
      name: 'coaia_fuse_datasets_list',
      description: 'List all Langfuse datasets',
      inputSchema: { type: 'object', properties: {} },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_datasets_get')) {
    tools.push({
      name: 'coaia_fuse_datasets_get',
      description: 'Get a specific dataset by name with its items',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Dataset name' },
        },
        required: ['name'],
      },
    });
  }

  // ─── Score Config Tools ─────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_score_configs_list')) {
    tools.push({
      name: 'coaia_fuse_score_configs_list',
      description: 'List all Langfuse score configurations',
      inputSchema: { type: 'object', properties: {} },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_score_configs_get')) {
    tools.push({
      name: 'coaia_fuse_score_configs_get',
      description: 'Get specific Langfuse score configuration',
      inputSchema: {
        type: 'object',
        properties: {
          name_or_id: { type: 'string', description: 'Score config name or ID' },
        },
        required: ['name_or_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_score_apply')) {
    tools.push({
      name: 'coaia_fuse_score_apply',
      description: 'Apply a score configuration to a trace or observation with validation',
      inputSchema: {
        type: 'object',
        properties: {
          config_name_or_id: { type: 'string', description: 'Name or ID of the score configuration' },
          target_type: { type: 'string', enum: ['trace', 'session'], description: 'Target type' },
          target_id: { type: 'string', description: 'ID of the trace or session' },
          value: { description: 'Score value (validated against config)' },
          observation_id: { type: 'string', description: 'Optional observation ID' },
          comment: { type: 'string', description: 'Optional comment' },
        },
        required: ['config_name_or_id', 'target_type', 'target_id', 'value'],
      },
    });
  }

  // ─── Comment Tools ──────────────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_comments_list')) {
    tools.push({
      name: 'coaia_fuse_comments_list',
      description: 'List comments with optional filtering by object type/ID or author',
      inputSchema: {
        type: 'object',
        properties: {
          object_type: { type: 'string', description: 'Filter by object type (trace, observation, session, prompt)' },
          object_id: { type: 'string', description: 'Filter by specific object ID' },
          author_user_id: { type: 'string', description: 'Filter by author user ID' },
          page: { type: 'integer', description: 'Page number', default: 1 },
          limit: { type: 'integer', description: 'Items per page', default: 50 },
        },
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_comments_get')) {
    tools.push({
      name: 'coaia_fuse_comments_get',
      description: 'Get a specific comment by ID',
      inputSchema: {
        type: 'object',
        properties: {
          comment_id: { type: 'string', description: 'Comment ID' },
        },
        required: ['comment_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_comments_create')) {
    tools.push({
      name: 'coaia_fuse_comments_create',
      description: 'Create a comment attached to an object (trace, observation, session, or prompt)',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Comment text' },
          object_type: { type: 'string', description: 'Object type (trace, observation, session, prompt)' },
          object_id: { type: 'string', description: 'Object ID' },
          author_user_id: { type: 'string', description: 'Author user ID' },
        },
        required: ['text', 'object_type', 'object_id'],
      },
    });
  }

  // ─── Media Tools (FULL only) ────────────────────────────────────

  if (featureConfig.isToolEnabled('coaia_fuse_media_upload')) {
    tools.push({
      name: 'coaia_fuse_media_upload',
      description: 'Upload a file and attach it to a Langfuse trace or observation. Supports images, video, audio, documents. Auto-detects MIME type.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file to upload' },
          trace_id: { type: 'string', description: 'Trace ID to attach media to' },
          field: { type: 'string', enum: ['input', 'output', 'metadata'], description: 'Field to attach to', default: 'input' },
          observation_id: { type: 'string', description: 'Optional observation ID' },
          content_type: { type: 'string', description: 'MIME type override (auto-detected if omitted)' },
        },
        required: ['file_path', 'trace_id'],
      },
    });
  }

  if (featureConfig.isToolEnabled('coaia_fuse_media_get')) {
    tools.push({
      name: 'coaia_fuse_media_get',
      description: 'Get media metadata by media ID',
      inputSchema: {
        type: 'object',
        properties: {
          media_id: { type: 'string', description: 'Media ID' },
        },
        required: ['media_id'],
      },
    });
  }

  return tools;
}

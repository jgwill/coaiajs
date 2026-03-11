/**
 * MCP tool definitions for Planning module (6 tools)
 * Ported from coaia-planning/src/tools/index.ts
 */

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const PLANNING_MCP_TOOLS: McpToolDef[] = [
  {
    name: 'parse_plan_structural',
    description: 'Parse a Claude plan as structural tension chart. Extracts desired outcome, current reality, and action steps (which telescope into sub-charts). Returns confidence scores.',
    inputSchema: {
      type: 'object',
      properties: {
        planPath: {
          type: 'string',
          description: 'Path to the Claude plan markdown file',
        },
        planContent: {
          type: 'string',
          description: 'Alternative: raw markdown content (if path not provided)',
        },
      },
    },
  },
  {
    name: 'plan_to_stc',
    description: 'Convert plan to structural tension chart (JSONL). Action steps become telescoped STCs with their own desired outcome/current reality.',
    inputSchema: {
      type: 'object',
      properties: {
        planPath: {
          type: 'string',
          description: 'Path to the Claude plan markdown file',
        },
        currentReality: {
          type: 'string',
          description: 'Override: provide current reality if not detected in plan',
        },
        outputPath: {
          type: 'string',
          description: 'Path to write the STC JSONL (default: <planname>.stc.jsonl)',
        },
      },
      required: ['planPath'],
    },
  },
  {
    name: 'sync_plan_to_chart',
    description: 'Plan → Chart sync. When plan changes, update the structural tension chart.',
    inputSchema: {
      type: 'object',
      properties: {
        planPath: {
          type: 'string',
          description: 'Path to the Claude plan markdown file',
        },
        chartsPath: {
          type: 'string',
          description: 'Path to the charts JSONL file',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, show changes without applying',
        },
      },
      required: ['planPath', 'chartsPath'],
    },
  },
  {
    name: 'sync_chart_to_plan',
    description: 'Chart → Plan sync. When agents modify chart (observations, completions), regenerate plan markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        chartsPath: {
          type: 'string',
          description: 'Path to the charts JSONL file',
        },
        planPath: {
          type: 'string',
          description: 'Path to write the updated plan markdown',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, show proposed plan without writing',
        },
      },
      required: ['chartsPath', 'planPath'],
    },
  },
  {
    name: 'create_plan_trace',
    description: 'Generate Langfuse trace data for plan→STC transformation.',
    inputSchema: {
      type: 'object',
      properties: {
        planPath: {
          type: 'string',
          description: 'Path to the source plan',
        },
        chartsPath: {
          type: 'string',
          description: 'Path to generated charts',
        },
        sessionId: {
          type: 'string',
          description: 'Optional Langfuse session ID',
        },
        metadata: {
          type: 'object',
          description: 'Additional trace metadata',
        },
      },
      required: ['planPath', 'chartsPath'],
    },
  },
  {
    name: 'pde_to_plan',
    description: 'Convert a PDE DecompositionResult to a structural tension chart (JSONL). Takes pre-decomposed PDE output and produces coaia-narrative compatible entities and relations.',
    inputSchema: {
      type: 'object',
      properties: {
        pde_id: {
          type: 'string',
          description: 'ID of a stored PDE decomposition in .pde/ folder',
        },
        decomposition_result: {
          type: 'object',
          description: 'Alternative: provide DecompositionResult JSON directly',
        },
        original_prompt: {
          type: 'string',
          description: 'The original prompt (required if providing decomposition_result)',
        },
        outputPath: {
          type: 'string',
          description: 'Path to write the STC JSONL output',
        },
        workdir: {
          type: 'string',
          description: 'Working directory containing .pde/ folder (default: cwd)',
        },
      },
    },
  },
];

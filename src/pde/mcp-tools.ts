/**
 * MCP tool definitions for PDE module (10 tools)
 * Ported from coaia-pde/src/mcp-server.ts tool schemas
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

export const PDE_MCP_TOOLS: McpToolDef[] = [
  {
    name: 'import_pde_decomposition',
    description: 'Import a .pde/*.json StoredDecomposition and create an STC session from it. Reads the decomposition result, maps it to Structural Tension Chart entities, and persists as .coaia/pde/<UUID>.jsonl.',
    inputSchema: {
      type: 'object',
      properties: {
        pde_id: {
          type: 'string',
          description: 'ID of the PDE decomposition in .pde/ folder'
        },
        workdir: {
          type: 'string',
          description: 'Working directory containing .pde/ folder (default: cwd)'
        }
      },
      required: ['pde_id']
    }
  },
  {
    name: 'create_stc_from_pde',
    description: 'One-shot: provide a DecompositionResult JSON directly and create a Structural Tension Chart session. Use when you already have the decomposition in memory.',
    inputSchema: {
      type: 'object',
      properties: {
        decomposition_result: {
          type: 'object',
          description: 'DecompositionResult JSON object from mcp-pde'
        },
        original_prompt: {
          type: 'string',
          description: 'The original prompt that was decomposed'
        }
      },
      required: ['decomposition_result', 'original_prompt']
    }
  },
  {
    name: 'list_pde_decompositions',
    description: 'List available .pde/*.json decomposition files that can be imported into STC sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        workdir: {
          type: 'string',
          description: 'Working directory containing .pde/ folder (default: cwd)'
        }
      }
    }
  },
  {
    name: 'get_session',
    description: 'Get the current state of a PDE session including the Structural Tension Chart, action steps, and progress.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        }
      },
      required: ['session_id']
    }
  },
  {
    name: 'list_sessions',
    description: 'List all PDE sessions in the current directory.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'completed', 'abandoned', 'all'],
          description: 'Filter by session status'
        }
      }
    }
  },
  {
    name: 'update_action_progress',
    description: 'Update progress on an action step with a factual observation.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        },
        action_name: {
          type: 'string',
          description: 'The action step entity name (e.g., chart_abc123_action_1)'
        },
        observation: {
          type: 'string',
          description: 'Factual progress observation (what was done, not what will be done)'
        },
        update_current_reality: {
          type: 'boolean',
          description: 'Whether to also add this observation to the chart current reality'
        }
      },
      required: ['session_id', 'action_name', 'observation']
    }
  },
  {
    name: 'mark_action_complete',
    description: 'Mark an action step as complete. The completion flows into current reality.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        },
        action_name: {
          type: 'string',
          description: 'The action step entity name'
        },
        completion_note: {
          type: 'string',
          description: 'Optional note about what was accomplished'
        }
      },
      required: ['session_id', 'action_name']
    }
  },
  {
    name: 'add_action_step',
    description: 'Add a new strategic action step to the chart. Each action step is a secondary choice supporting the primary goal.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        },
        action_description: {
          type: 'string',
          description: 'Description of the strategic action'
        },
        current_reality: {
          type: 'string',
          description: 'Current reality for this specific action step'
        }
      },
      required: ['session_id', 'action_description']
    }
  },
  {
    name: 'update_current_reality',
    description: 'Add observations to the current reality of the chart.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        },
        observations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Factual observations to add to current reality'
        }
      },
      required: ['session_id', 'observations']
    }
  },
  {
    name: 'complete_session',
    description: 'Mark the session as completed when the desired outcome is achieved.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session UUID'
        },
        final_note: {
          type: 'string',
          description: 'Final observation about the completed outcome'
        }
      },
      required: ['session_id']
    }
  },
];

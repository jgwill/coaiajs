/**
 * COAIA Narrative - MCP Tool Definitions (Schemas)
 *
 * Pure data: array of MCP tool schema objects.
 * No logic, no side effects — easy to review, test, and extend.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  // ─── Knowledge Graph Tools (9) ────────────────────────────────────

  {
    name: 'create_entities',
    description:
      'ADVANCED: Create traditional knowledge graph entities. For structural tension charts, use create_structural_tension_chart or add_action_step instead.',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the entity' },
              entityType: { type: 'string', description: 'The type of the entity' },
              observations: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents associated with the entity',
              },
            },
            required: ['name', 'entityType', 'observations'],
          },
        },
      },
      required: ['entities'],
    },
  },
  {
    name: 'create_relations',
    description:
      'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'The name of the entity where the relation starts' },
              to: { type: 'string', description: 'The name of the entity where the relation ends' },
              relationType: { type: 'string', description: 'The type of the relation' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'add_observations',
    description:
      'ADVANCED: Add observations to traditional knowledge graph entities. For structural tension charts, use update_current_reality instead.',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'The name of the entity to add the observations to' },
              contents: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents to add',
              },
            },
            required: ['entityName', 'contents'],
          },
        },
      },
      required: ['observations'],
    },
  },
  {
    name: 'delete_entities',
    description: 'Delete multiple entities and their associated relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'An array of entity names to delete',
        },
      },
      required: ['entityNames'],
    },
  },
  {
    name: 'delete_observations',
    description: 'Delete specific observations from entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        deletions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'The name of the entity containing the observations' },
              observations: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observations to delete',
              },
            },
            required: ['entityName', 'observations'],
          },
        },
      },
      required: ['deletions'],
    },
  },
  {
    name: 'delete_relations',
    description: 'Delete multiple relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'The name of the entity where the relation starts' },
              to: { type: 'string', description: 'The name of the entity where the relation ends' },
              relationType: { type: 'string', description: 'The type of the relation' },
            },
            required: ['from', 'to', 'relationType'],
          },
          description: 'An array of relations to delete',
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'read_graph',
    description:
      'RARELY USED: Dumps entire knowledge graph (all entities and relations). Only use for debugging or when you need to see ALL data. For chart work, use list_active_charts instead.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_nodes',
    description: 'Search for nodes in the knowledge graph based on a query',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to match against entity names, types, and observation content',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'open_nodes',
    description:
      "ADVANCED: Open specific entity nodes by exact name (e.g. 'chart_123_current_reality'). Only use if you need to inspect specific chart components. NOT for general chart viewing - use list_active_charts instead.",
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: "An array of exact entity names to retrieve (e.g. 'chart_123_desired_outcome')",
        },
      },
      required: ['names'],
    },
  },

  // ─── STC Tools (14) ───────────────────────────────────────────────

  {
    name: 'create_structural_tension_chart',
    description:
      "Create a new structural tension chart with desired outcome, current reality, and optional action steps. CRITICAL: Use creative orientation (what you want to CREATE) not problem-solving (what you want to fix/solve). Current reality must be factual assessment, never 'ready to begin'.",
    inputSchema: {
      type: 'object',
      properties: {
        desiredOutcome: {
          type: 'string',
          description: 'What you want to CREATE (not solve/fix). Focus on positive outcomes, not problems to eliminate.',
        },
        currentReality: {
          type: 'string',
          description:
            "Your current situation - factual assessment only. NEVER use 'ready to begin' or similar readiness statements.",
        },
        dueDate: { type: 'string', description: 'When you want to achieve this outcome (ISO date string)' },
        actionSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of action steps needed to achieve the outcome',
        },
        elementsOfPerformance: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'What is being evaluated' },
              type: {
                type: 'string',
                enum: ['DESIGN', 'EXECUTION'],
                description: 'DESIGN = structural intent/architecture, EXECUTION = delivery/implementation quality',
              },
            },
            required: ['description', 'type'],
          },
          description: 'Optional Elements of Performance for MMOT evaluation — criteria the agent uses to self-assess output',
        },
      },
      required: ['desiredOutcome', 'currentReality', 'dueDate'],
    },
  },
  {
    name: 'manage_action_step',
    description:
      '✨ RECOMMENDED: Unified interface for managing action steps - handles both creation and expansion. Automatically detects whether you\'re creating a new action step (chart ID) or expanding an existing one (entity name). Provides clear error messages when parameters are invalid.',
    inputSchema: {
      type: 'object',
      properties: {
        parentReference: {
          type: 'string',
          description:
            "Chart ID (e.g., 'chart_123') to create new action step, OR action step entity name (e.g., 'chart_123_action_1' or 'chart_123_desired_outcome') to expand existing action step",
        },
        actionDescription: {
          type: 'string',
          description: 'Title/description of the action step',
        },
        currentReality: {
          type: 'string',
          description:
            "REQUIRED for new action creation. Honest assessment of actual current state relative to this action step. Examples: 'Never used Django', 'Completed models, struggling with views'. AVOID: 'Ready to begin'. Optional when expanding existing actions.",
        },
        initialActionSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of sub-actions for the action step',
        },
        dueDate: {
          type: 'string',
          description: 'Optional due date (ISO string). Auto-distributed if not provided.',
        },
        performanceElements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'What is being evaluated for this action step' },
              type: { type: 'string', enum: ['DESIGN', 'EXECUTION'], description: 'DESIGN or EXECUTION element' },
            },
            required: ['description', 'type'],
          },
          description: 'Optional per-step Elements of Performance for MMOT evaluation',
        },
      },
      required: ['parentReference', 'actionDescription'],
    },
  },
  {
    name: 'add_action_step',
    description:
      "⚠️ DEPRECATED: Use 'manage_action_step' instead for unified interface. Add a strategic action step to an existing structural tension chart (creates telescoped chart). WARNING: Requires honest current reality assessment - avoid 'ready to begin' language. Action steps become full structural tension charts.",
    inputSchema: {
      type: 'object',
      properties: {
        parentChartId: { type: 'string', description: 'ID of the parent chart to add the action step to' },
        actionStepTitle: {
          type: 'string',
          description: 'Title of the action step (becomes desired outcome of telescoped chart)',
        },
        dueDate: {
          type: 'string',
          description: 'Optional due date for the action step (ISO string). If not provided, auto-distributed between now and parent due date',
        },
        currentReality: {
          type: 'string',
          description:
            'Current reality specific to this action step. Required to maintain structural tension - assess the actual current state relative to this action step, not readiness to begin.',
        },
      },
      required: ['parentChartId', 'actionStepTitle', 'currentReality'],
    },
  },
  {
    name: 'telescope_action_step',
    description:
      "⚠️ DEPRECATED: Use 'manage_action_step' instead for unified interface. Break down an action step into a detailed structural tension chart. CRITICAL: Current reality must be an honest assessment of actual current state relative to this specific action step, NOT readiness or preparation statements. This maintains structural tension essential for creative advancement.",
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: { type: 'string', description: 'Name of the action step to telescope' },
        newCurrentReality: {
          type: 'string',
          description:
            "REQUIRED: Honest assessment of actual current state relative to this action step. Examples: 'Never used Django before', 'Completed models section, struggling with views'. AVOID: 'Ready to begin', 'Prepared to start'.",
        },
        initialActionSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of initial action steps for the telescoped chart',
        },
      },
      required: ['actionStepName', 'newCurrentReality'],
    },
  },
  {
    name: 'remove_action_step',
    description: 'Remove an action step from a structural tension chart (deletes telescoped chart)',
    inputSchema: {
      type: 'object',
      properties: {
        parentChartId: { type: 'string', description: 'ID of the parent chart containing the action step' },
        actionStepName: {
          type: 'string',
          description: "Name of the action step to remove (telescoped chart's desired outcome name)",
        },
      },
      required: ['parentChartId', 'actionStepName'],
    },
  },
  {
    name: 'mark_action_complete',
    description: 'Mark an action step as completed and update current reality',
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: { type: 'string', description: 'Name of the completed action step' },
      },
      required: ['actionStepName'],
    },
  },
  {
    name: 'get_chart_progress',
    description:
      'Get detailed progress for a specific chart (redundant if you just used list_active_charts which shows progress). Only use if you need the nextAction details.',
    inputSchema: {
      type: 'object',
      properties: {
        chartId: { type: 'string', description: 'ID of the chart to check progress for' },
      },
      required: ['chartId'],
    },
  },
  {
    name: 'list_active_charts',
    description:
      "List all active structural tension charts with their progress. Use this FIRST to see all charts and their IDs. This shows chart overview with progress - you don't need other tools after this for basic chart information.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_chart',
    description:
      'Get the full details of a specific structural tension chart, including its desired outcome, current reality, and all associated action steps.',
    inputSchema: {
      type: 'object',
      properties: {
        chartId: { type: 'string', description: 'ID of the chart to retrieve.' },
      },
      required: ['chartId'],
    },
  },
  {
    name: 'get_action_step',
    description: 'Get the full details of a specific action step, which is itself a telescoped chart.',
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: {
          type: 'string',
          description: "Name of the action step (e.g., 'chart_123_desired_outcome') to retrieve.",
        },
      },
      required: ['actionStepName'],
    },
  },
  {
    name: 'update_action_progress',
    description: 'Update progress on an action step without marking it complete, optionally updating current reality',
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: { type: 'string', description: 'Name of the action step to update progress for' },
        progressObservation: { type: 'string', description: 'Description of progress made on this action step' },
        updateCurrentReality: {
          type: 'boolean',
          description: 'Whether to also add this progress to current reality (optional, defaults to false)',
        },
      },
      required: ['actionStepName', 'progressObservation'],
    },
  },
  {
    name: 'update_current_reality',
    description:
      'FOR STRUCTURAL TENSION CHARTS: Add observations to current reality. DO NOT use add_observations or create_entities for chart work - use this instead.',
    inputSchema: {
      type: 'object',
      properties: {
        chartId: { type: 'string', description: 'ID of the chart to update current reality for' },
        newObservations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of new observations to add to current reality',
        },
      },
      required: ['chartId', 'newObservations'],
    },
  },
  {
    name: 'update_desired_outcome',
    description:
      "Update a chart's desired outcome (goal). Works for BOTH master charts AND action steps (which are telescoped charts). Provide the chart ID of the chart you want to update - whether it's a master chart or an action step chart.",
    inputSchema: {
      type: 'object',
      properties: {
        chartId: {
          type: 'string',
          description: "ID of the chart to update (works for master charts like 'chart_123' or action step charts like 'chart_456')",
        },
        newDesiredOutcome: { type: 'string', description: 'New desired outcome text' },
      },
      required: ['chartId', 'newDesiredOutcome'],
    },
  },
  {
    name: 'perform_mmot_evaluation',
    description:
      "Autonomous MMOT (Managerial Moment of Truth) self-evaluation on a structural tension chart. The agent compares produced output against defined Elements of Performance, acknowledges discrepancy, analyzes dynamics, updates the chart, and recommits or redirects. Runs the four Creator's Moment of Truth steps: acknowledge → analyze → update → recommit. Can be called from any directional perspective (South/East/West/North) for collective inquiry.",
    inputSchema: {
      type: 'object',
      properties: {
        chartId: { type: 'string', description: 'ID of the chart to evaluate' },
        phase: {
          type: 'string',
          enum: ['full', 'acknowledge', 'analyze', 'update', 'recommit'],
          default: 'full',
          description: "Which MMOT phase: 'full' runs all four steps, or run individual phases",
        },
        assessment: {
          type: 'string',
          description:
            "The agent's honest assessment — what was expected vs. what was delivered, observations, corrective insights",
        },
        direction: {
          type: 'string',
          enum: ['South', 'East', 'West', 'North'],
          description:
            'Optional directional perspective: South=DESIGN/structure (Mia), East=EXECUTION/narrative (Miette), West=EXECUTION/embodied (Heyva), North=DESIGN/wisdom (Echo Weaver)',
        },
        correctiveActions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional corrective action steps to add to the chart based on evaluation',
        },
        updateReality: {
          type: 'boolean',
          default: true,
          description: 'Whether to write evaluation observations into current reality',
        },
      },
      required: ['chartId'],
    },
  },

  // ─── Narrative Tools (3) ──────────────────────────────────────────

  {
    name: 'create_narrative_beat',
    description:
      'Create a new narrative beat with multi-universe perspective and optional IAIP integration. Documents story progression across three archetypal universes (engineer-world, ceremony-world, story-engine-world).',
    inputSchema: {
      type: 'object',
      properties: {
        parentChartId: { type: 'string', description: 'ID of the parent structural tension chart' },
        title: { type: 'string', description: 'Title of the narrative beat' },
        act: { type: 'number', description: 'Act number in the narrative sequence' },
        type_dramatic: {
          type: 'string',
          description: "Dramatic type (e.g. 'Crisis/Antagonist Force', 'Setup', 'Turning Point')",
        },
        universes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Universe perspectives (engineer-world, ceremony-world, story-engine-world)',
        },
        description: { type: 'string', description: 'Detailed description of the narrative beat' },
        prose: { type: 'string', description: 'Prose narrative of the beat' },
        lessons: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key lessons or insights from this beat',
        },
        assessRelationalAlignment: { type: 'boolean', description: 'Whether to call iaip-mcp assess_relational_alignment' },
        initiateFourDirectionsInquiry: { type: 'boolean', description: 'Whether to call iaip-mcp get_direction_guidance' },
        filePath: { type: 'string', description: 'Path to narrative JSONL file (optional)' },
      },
      required: ['parentChartId', 'title', 'act', 'type_dramatic', 'universes', 'description', 'prose', 'lessons'],
    },
  },
  {
    name: 'telescope_narrative_beat',
    description:
      'Telescope a narrative beat into sub-beats for detailed exploration. Creates detailed sub-narrative structure from a parent beat.',
    inputSchema: {
      type: 'object',
      properties: {
        parentBeatName: { type: 'string', description: 'Name of the parent narrative beat to telescope' },
        newCurrentReality: { type: 'string', description: 'Updated current reality for the telescoped beat' },
        initialSubBeats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              type_dramatic: { type: 'string' },
              description: { type: 'string' },
              prose: { type: 'string' },
              lessons: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'type_dramatic', 'description', 'prose', 'lessons'],
          },
          description: 'Optional initial sub-beats to create',
        },
      },
      required: ['parentBeatName', 'newCurrentReality'],
    },
  },
  {
    name: 'list_narrative_beats',
    description: 'List all narrative beats, optionally filtered by parent chart ID. Shows multi-universe story progression.',
    inputSchema: {
      type: 'object',
      properties: {
        parentChartId: { type: 'string', description: 'Optional: Filter by parent chart ID' },
      },
    },
  },

  // ─── System (1) ───────────────────────────────────────────────────

  {
    name: 'init_llm_guidance',
    description:
      "🚨 NEW LLM? Essential guidance for understanding COAIA Memory's structural tension methodology, delayed resolution principle, and proper tool usage. Run this FIRST to avoid common mistakes.",
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['full', 'quick', 'save_directive'],
          default: 'full',
          description: "Level of detail: 'full' for complete guidance, 'quick' for essentials only, 'save_directive' for session memory instructions",
        },
      },
    },
  },
];

// ─── Tool Group Subsets ─────────────────────────────────────────────

export const STC_TOOLS = [
  'create_structural_tension_chart',
  'manage_action_step',
  'add_action_step',
  'telescope_action_step',
  'remove_action_step',
  'mark_action_complete',
  'get_chart_progress',
  'list_active_charts',
  'get_chart',
  'get_action_step',
  'update_action_progress',
  'update_current_reality',
  'update_desired_outcome',
  'perform_mmot_evaluation',
] as const;

export const NARRATIVE_TOOLS = [
  'create_narrative_beat',
  'telescope_narrative_beat',
  'list_narrative_beats',
] as const;

export const KG_TOOLS = [
  'create_entities',
  'create_relations',
  'add_observations',
  'delete_entities',
  'delete_observations',
  'delete_relations',
  'search_nodes',
  'open_nodes',
  'read_graph',
] as const;

export const CORE_TOOLS = [
  'list_active_charts',
  'create_structural_tension_chart',
  'add_action_step',
  'mark_action_complete',
] as const;

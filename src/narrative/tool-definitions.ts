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
        githubIssue: {
          type: 'string',
          description:
            "Optional GitHub issue this chart is written from, as the FULL path 'owner/repo#number' (e.g. jgwill/coaiajs#1). A bare '#number' is rejected — charts travel between repositories, and a bare number cites the wrong project once the chart is read elsewhere.",
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
          description:
            "Optional list of initial action steps for the telescoped chart. Also accepted as 'actionSteps', the name its sibling create_structural_tension_chart uses for the same concept.",
        },
        actionSteps: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Alias for 'initialActionSteps'. Present because create_structural_tension_chart names this same concept 'actionSteps'; supplying either works.",
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
    name: 'update_chart_due_date',
    description:
      'Change the date a chart is due after it was created. Works for BOTH master charts AND action step charts. Moves the chart and its desired outcome together. Open action steps keep their own dates unless redistributeActionSteps is true; the count still falling after the new date is reported either way. The change is recorded as an observation on the chart.',
    inputSchema: {
      type: 'object',
      properties: {
        chartId: {
          type: 'string',
          description: "ID of the chart to update (works for master charts like 'chart_123' or action step charts like 'chart_456')",
        },
        newDueDate: {
          type: 'string',
          description: "New due date as an ISO date string (e.g. '2026-09-30T12:00:00Z')",
        },
        redistributeActionSteps: {
          type: 'boolean',
          default: false,
          description:
            'When true, open action steps and telescoped child charts are redistributed evenly between now and the new due date. When false (default), their dates are left as the caller set them.',
        },
      },
      required: ['chartId', 'newDueDate'],
    },
  },
  {
    name: 'delay_resolution',
    description:
      "Record on an action step that someone strategically chose to delay its resolution: until when (resolveBy, which becomes the step's due date), why, who chose it, what the delay serves, the events that should wake it, and the agent session to rehydrate when it comes due. A due date says when; this says the wait was chosen. A completed step is refused, and so is a resolveBy not in the future. Delaying a step already delayed moves the earlier record into its history.",
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: {
          type: 'string',
          description:
            "The step: a written step ('chart_123_action_1') or a telescoped step ('chart_456_desired_outcome', as add_action_step returns it).",
        },
        resolveBy: {
          type: 'string',
          description: "When resolution is wanted, an ISO date in the future (e.g. '2026-11-01T09:00:00Z'). Becomes the step's due date.",
        },
        reason: { type: 'string', description: 'Why delaying serves the work now.' },
        chosenBy: { type: 'string', description: 'The person or seat that chose the delay.' },
        primaryChoice: {
          type: 'string',
          description: "What the delay serves. Defaults to the chart's desired outcome, copied now.",
        },
        wakeOn: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event cues, in words, that should bring the step back before resolveBy.',
        },
        session: {
          type: 'object',
          description: 'The agent session to rehydrate when the delay ends.',
          properties: {
            sessionId: { type: 'string', description: "Claude Code session id, or another agent's." },
            agent: { type: 'string', description: "Defaults to 'claude'." },
            host: { type: 'string', description: 'e.g. gaia, ilex, eury' },
            cwd: { type: 'string', description: 'Working directory the session ran in.' },
            tmux: { type: 'string', description: 'tmux session or pane.' },
            resumeCommand: { type: 'string', description: "e.g. 'cd <cwd> && claude --resume <id>'" },
            inventoryRecord: { type: 'string', description: "Path of the session's record in the session inventory." },
          },
          required: ['sessionId'],
        },
      },
      required: ['actionStepName', 'resolveBy', 'reason', 'chosenBy'],
    },
  },
  {
    name: 'list_delayed_resolutions',
    description:
      'List delayed action steps, soonest resolveBy first, each with its chart, days remaining, whether it is owed (resolveBy has passed), what it serves, its wake cues and its agent session.',
    inputSchema: {
      type: 'object',
      properties: {
        dueWithinDays: {
          type: 'number',
          description: 'Keep only delays resolving within this many days from now (owed ones included).',
        },
        includeEnded: {
          type: 'boolean',
          default: false,
          description: 'Also list steps whose latest delay has ended.',
        },
      },
    },
  },
  {
    name: 'end_delayed_resolution',
    description:
      "End an action step's open delay, either by rehydrating its agent session or by releasing the step. The record is kept with who ended it, when, and how; the step reads as it did before the delay. When rehydrated, returns the session's resume command.",
    inputSchema: {
      type: 'object',
      properties: {
        actionStepName: { type: 'string', description: 'The delayed step, named as for delay_resolution.' },
        endedBy: { type: 'string', description: 'The person or seat ending the delay.' },
        outcome: {
          type: 'string',
          enum: ['rehydrated', 'released'],
          description: "'rehydrated' when the session is resumed, 'released' when the step is let go of its delay.",
        },
        endNote: { type: 'string', description: 'Optional note on how the delay ended.' },
      },
      required: ['actionStepName', 'endedBy', 'outcome'],
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
  {
    name: 'link_chart_to_github_issue',
    description:
      "Record on an existing chart the GitHub issue it was written from. The reference must be the full 'owner/repo#number' path.",
    inputSchema: {
      type: 'object',
      properties: {
        chartId: { type: 'string', description: 'ID of the chart to link' },
        githubIssue: {
          type: 'string',
          description: "GitHub issue as the FULL path 'owner/repo#number' (e.g. jgwill/coaiajs#1). A bare '#number' is rejected.",
        },
      },
      required: ['chartId', 'githubIssue'],
    },
  },
  {
    name: 'create_wampum_belt',
    description:
      'Create a Wampum Belt: a non-linear mnemonic grid that runs in parallel with linear narrative beats.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Name of this Wampum belt' },
        purpose: { type: 'string', description: 'What this belt encodes or remembers' },
        rows: { type: 'number', description: 'Grid row count (default 1)' },
        cols: { type: 'number', description: 'Grid column count (default 1)' },
      },
      required: ['title', 'purpose'],
    },
  },
  {
    name: 'add_wampum_bead',
    description:
      'Add a bead at a grid position with mnemonic anchor, optional relational readings, and optional ceremony/accountability links.',
    inputSchema: {
      type: 'object',
      properties: {
        beltId: { type: 'string', description: 'Target belt ID' },
        mnemonic: { type: 'string', description: 'Short anchor phrase for this bead' },
        color: {
          type: 'string',
          enum: ['white', 'purple', 'black', 'mixed'],
          description: 'Bead color',
        },
        position: {
          type: 'object',
          properties: {
            row: { type: 'number' },
            col: { type: 'number' },
          },
          required: ['row', 'col'],
        },
        reading: { type: 'string', description: 'Canonical meaning for the bead' },
        relationalReadings: {
          type: 'object',
          description: 'Optional perspective-specific readings (left/center/right/row:N/col:N)',
        },
        ceremonyLink: {
          type: 'object',
          properties: {
            ceremonyType: {
              type: 'string',
              enum: ['commitment', 'accountability', 'witness', 'renewal'],
            },
            chartId: { type: 'string' },
            beatName: { type: 'string' },
            witnessNames: { type: 'array', items: { type: 'string' } },
            renewalDate: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['ceremonyType'],
        },
        observations: { type: 'array', items: { type: 'string' } },
      },
      required: ['beltId', 'mnemonic', 'color', 'position', 'reading'],
    },
  },
  {
    name: 'read_wampum_belt',
    description: 'Read a Wampum Belt in full, or read a bead by position with relational interpretation.',
    inputSchema: {
      type: 'object',
      properties: {
        beltId: { type: 'string', description: 'Wampum belt ID' },
        position: {
          type: 'object',
          properties: {
            row: { type: 'number' },
            col: { type: 'number' },
          },
          required: ['row', 'col'],
        },
      },
      required: ['beltId'],
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
  'update_chart_due_date',
  'delay_resolution',
  'list_delayed_resolutions',
  'end_delayed_resolution',
  'link_chart_to_github_issue',
  'perform_mmot_evaluation',
] as const;

export const NARRATIVE_TOOLS = [
  'create_narrative_beat',
  'telescope_narrative_beat',
  'list_narrative_beats',
] as const;

export const WAMPUM_TOOLS = [
  'create_wampum_belt',
  'add_wampum_bead',
  'read_wampum_belt',
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

/**
 * The shortest path a newcomer can take through this surface.
 *
 * `init_llm_guidance` leads because every other tool's guidance assumes it was read.
 * `manage_action_step` is here rather than `add_action_step`: the latter's own
 * description begins "⚠️ DEPRECATED", and a group literally presented as "start here"
 * must not point at a tool that tells the reader to use a different one.
 */
export const CORE_TOOLS = [
  'init_llm_guidance',
  'list_active_charts',
  'create_structural_tension_chart',
  'manage_action_step',
  'mark_action_complete',
] as const;

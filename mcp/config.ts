// coaiajs/mcp/config.ts — Feature gating
// Port of coaiapy-mcp/config.py

export type FeatureLevel = 'MINIMAL' | 'STANDARD' | 'OBSERVABILITY' | 'FULL';

// All available tool names across all modules
const ALL_TOOLS = new Set([
  // Redis (coaiapy-mcp)
  'coaia_tash',
  'coaia_fetch',
  // Langfuse traces (coaiapy-mcp)
  'coaia_fuse_trace_create',
  'coaia_fuse_add_observation',
  'coaia_fuse_trace_patch_output',
  'coaia_fuse_trace_get',
  'coaia_fuse_trace_view',
  'coaia_fuse_observation_get',
  'coaia_fuse_traces_list',
  'coaia_fuse_traces_session_view',
  // Langfuse comments (coaiapy-mcp)
  'coaia_fuse_comments_list',
  'coaia_fuse_comments_get',
  'coaia_fuse_comments_create',
  // Langfuse prompts (coaiapy-mcp)
  'coaia_fuse_prompts_list',
  'coaia_fuse_prompts_get',
  // Langfuse datasets (coaiapy-mcp)
  'coaia_fuse_datasets_list',
  'coaia_fuse_datasets_get',
  // Score configs (coaiapy-mcp)
  'coaia_fuse_score_configs_list',
  'coaia_fuse_score_configs_get',
  'coaia_fuse_score_apply',
  // Media (coaiapy-mcp, FULL only)
  'coaia_fuse_media_upload',
  'coaia_fuse_media_get',
  // Narrative (coaia-narrative, 28 tools)
  'create_structural_tension_chart',
  'telescope_action_step',
  'mark_action_complete',
  'get_chart_progress',
  'list_active_charts',
  'get_chart',
  'get_action_step',
  'update_action_progress',
  'update_current_reality',
  'manage_action_step',
  'add_action_step',
  'remove_action_step',
  'update_desired_outcome',
  'perform_mmot_evaluation',
  'init_llm_guidance',
  'create_narrative_beat',
  'telescope_narrative_beat',
  'list_narrative_beats',
  'add_observations',
  'create_entities',
  'create_relations',
  'search_nodes',
  'open_nodes',
  'read_graph',
  'delete_entities',
  'delete_relations',
  'delete_observations',
  'merge_entities',
  // PDE (coaia-pde, 10 tools)
  'pde_decompose',
  'pde_parse_response',
  'pde_get',
  'pde_list',
  'pde_export_markdown',
  'import_pde',
  'create_stc_from_pde',
  'pde_sessions_list',
  'pde_sessions_create',
  'pde_sessions_update',
  // Planning (coaia-planning, 6 tools)
  'parse_plan',
  'plan_to_stc',
  'sync_plans',
  'trace_plan',
  'pde_to_plan',
  'list_plans',
]);

const MINIMAL_TOOLS = new Set([
  'coaia_tash',
  'coaia_fetch',
  'coaia_fuse_trace_create',
  'coaia_fuse_add_observation',
  'coaia_fuse_trace_patch_output',
  'coaia_fuse_trace_get',
  'coaia_fuse_trace_view',
  'coaia_fuse_observation_get',
  'coaia_fuse_traces_list',
  'coaia_fuse_traces_session_view',
  'coaia_fuse_comments_list',
  'coaia_fuse_comments_get',
  'coaia_fuse_comments_create',
  'coaia_fuse_prompts_list',
  'coaia_fuse_prompts_get',
  'coaia_fuse_datasets_list',
  'coaia_fuse_datasets_get',
  'coaia_fuse_score_configs_list',
  'coaia_fuse_score_configs_get',
  'coaia_fuse_score_apply',
]);

const STANDARD_TOOLS = new Set([
  ...MINIMAL_TOOLS,
  // Narrative STC tools
  'create_structural_tension_chart',
  'telescope_action_step',
  'mark_action_complete',
  'get_chart_progress',
  'list_active_charts',
  'get_chart',
  'get_action_step',
  'update_action_progress',
  'update_current_reality',
  'manage_action_step',
  'add_action_step',
  'remove_action_step',
  'update_desired_outcome',
  'perform_mmot_evaluation',
  'init_llm_guidance',
  'create_narrative_beat',
  'telescope_narrative_beat',
  'list_narrative_beats',
  // KG tools
  'add_observations',
  'create_entities',
  'create_relations',
  'search_nodes',
  'open_nodes',
  'read_graph',
  'delete_entities',
  'delete_relations',
  'delete_observations',
  'merge_entities',
  // PDE tools
  'pde_decompose',
  'pde_parse_response',
  'pde_get',
  'pde_list',
  'pde_export_markdown',
  'import_pde',
  'create_stc_from_pde',
  'pde_sessions_list',
  'pde_sessions_create',
  'pde_sessions_update',
  // Planning tools
  'parse_plan',
  'plan_to_stc',
  'sync_plans',
  'trace_plan',
  'pde_to_plan',
  'list_plans',
]);

const FEATURE_SETS: Record<FeatureLevel, Set<string>> = {
  MINIMAL: MINIMAL_TOOLS,
  STANDARD: STANDARD_TOOLS,
  OBSERVABILITY: STANDARD_TOOLS,
  FULL: ALL_TOOLS,
};

export class FeatureConfig {
  private level: FeatureLevel;
  private enabledTools: Set<string>;

  constructor(level?: FeatureLevel) {
    const envLevel = (level ?? process.env['COAIAJS_FEATURES'] ?? 'STANDARD').toUpperCase() as FeatureLevel;
    this.level = envLevel in FEATURE_SETS ? envLevel : 'STANDARD';
    this.enabledTools = FEATURE_SETS[this.level];
  }

  isToolEnabled(toolName: string): boolean {
    return this.enabledTools.has(toolName);
  }

  getEnabledTools(): Set<string> {
    return new Set(this.enabledTools);
  }

  getFeatureLevel(): FeatureLevel {
    return this.level;
  }

  getStats(): { tools: number; level: FeatureLevel } {
    return {
      tools: this.enabledTools.size,
      level: this.level,
    };
  }
}

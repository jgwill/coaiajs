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
  'import_pde_decomposition',
  'create_stc_from_pde',
  'list_pde_decompositions',
  'get_session',
  'list_sessions',
  'complete_session',
  'pde_update_action_progress',
  'pde_mark_action_complete',
  'pde_add_action_step',
  'pde_update_current_reality',
  // Planning (coaia-planning, 6 tools)
  'parse_plan_structural',
  'plan_to_stc',
  'sync_plan_to_chart',
  'sync_chart_to_plan',
  'create_plan_trace',
  'pde_to_plan',
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
  'import_pde_decomposition',
  'create_stc_from_pde',
  'list_pde_decompositions',
  'get_session',
  'list_sessions',
  'complete_session',
  'pde_update_action_progress',
  'pde_mark_action_complete',
  'pde_add_action_step',
  'pde_update_current_reality',
  // Planning tools
  'parse_plan_structural',
  'plan_to_stc',
  'sync_plan_to_chart',
  'sync_chart_to_plan',
  'create_plan_trace',
  'pde_to_plan',
]);

const ALL_RESOURCES = new Set([
  'coaia://templates/',
  'coaia://templates/{name}',
  'coaia://templates/{name}/variables',
]);

const ALL_PROMPTS = new Set([
  'mia_miette_duo',
  'create_observability_pipeline',
  'analyze_audio_workflow',
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

  isResourceEnabled(uri: string): boolean {
    if (uri === 'coaia://templates/') return ALL_RESOURCES.has(uri);
    if (uri.startsWith('coaia://templates/') && uri.endsWith('/variables')) {
      return ALL_RESOURCES.has('coaia://templates/{name}/variables');
    }
    if (uri.startsWith('coaia://templates/')) {
      return ALL_RESOURCES.has('coaia://templates/{name}');
    }
    return false;
  }

  isPromptEnabled(promptName: string): boolean {
    return ALL_PROMPTS.has(promptName);
  }

  getEnabledTools(): Set<string> {
    return new Set(this.enabledTools);
  }

  getFeatureLevel(): FeatureLevel {
    return this.level;
  }

  getStats(): { tools: number; prompts: number; resources: number; level: FeatureLevel } {
    return {
      tools: this.enabledTools.size,
      prompts: ALL_PROMPTS.size,
      resources: ALL_RESOURCES.size,
      level: this.level,
    };
  }
}

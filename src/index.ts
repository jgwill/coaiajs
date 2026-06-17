// coaiajs/src/index.ts — Published package entry point

export {
  findExistingConfig,
  mergeConfigs,
  readConfig,
  getConfig,
  resetConfig,
  config,
} from './config.js';

export {
  getClient as getRedisClient,
  tash,
  fetch,
  del,
  keys,
  exists,
  disconnect,
  resetClient as resetRedisClient,
} from './redis.js';

export {
  llm,
  transcribeAudio,
  generateImage,
  abstractProcess,
  resetClient as resetLlmClient,
} from './llm.js';

export {
  synthesize,
  resetClient as resetAudioClient,
} from './audio.js';

export {
  listIssues,
  getIssue,
  getIssueComments,
  resetClient as resetGithubClient,
} from './github.js';

export {
  EnvironmentManager,
  createEnvironment,
  findEnvironment,
} from './environment.js';

export * as langfuse from './langfuse/index.js';
export * as narrative from './narrative/index.js';
export * as pde from './pde/index.js';
export * as planning from './planning/index.js';
export * as pipeline from './pipeline/index.js';

export type {
  Entity,
  EntityMetadata,
  Relation,
  RelationMetadata,
  KnowledgeGraph,
  McpToolResult,
  PrimaryIntent,
  SecondaryIntent,
  ContextRequirements,
  ExpectedOutputs,
  DirectionItem,
  DirectionMap,
  ActionItem,
  AmbiguityFlag,
  DecompositionResult,
  StoredDecomposition,
  DecompositionOptions,
  PdeSession,
  StructuralElement,
  StructuralTensionPlan,
  ScoreCategory,
  ScoreConfig,
  PipelineVariable,
  PipelineStep,
  PipelineTemplate,
  CoaiaConfig,
} from './types.js';

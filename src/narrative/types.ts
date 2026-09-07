// narrative/types.ts — Re-export knowledge graph types from shared types
export type {
  Entity,
  EntityMetadata,
  Relation,
  RelationMetadata,
  KnowledgeGraph,
  JsonlRecord,
  McpToolResult,
  // GitHub bridge
  GithubIssueRef,
  GithubProjectItemRef,
  GithubBridgeMetadata,
  GithubChartProvenance,
  GithubActionStepProvenance,
  GithubSyncState,
  GithubSyncAuthority,
  LegacyGithubRef,
  LegacyGithubSyncTarget,
  // Provenance & research lineage
  SourceSystem,
  SourceProvenance,
  DeepResearchFoundationMetadata,
  HermesSessionLineageMetadata,
  SessionContextMetadata,
  // Wampum belt sequencing
  WampumBead,
  WampumBeadPosition,
  WampumBeltMetadata,
  WampumCeremonyLink,
} from '../types.js';

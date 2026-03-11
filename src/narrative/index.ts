// narrative/index.ts — Module barrel export

export { KnowledgeGraphManager } from './graph-manager.js';
export { handleToolCall } from './tool-handlers.js';
export { validate, ValidationSchemas } from './validation.js';
export {
  ALL_TOOL_DEFINITIONS,
  STC_TOOLS,
  NARRATIVE_TOOLS,
  KG_TOOLS,
  CORE_TOOLS,
} from './tool-definitions.js';
export type { ToolDefinition } from './tool-definitions.js';
export {
  exportChartToMarkdown,
  exportAllCharts,
  exportChartProgress,
  exportChartStats,
  writeMarkdownToFile,
  getDefaultFilename,
} from './markdown-export.js';
export type { MarkdownOptions } from './markdown-export.js';

// Re-export narrative-relevant types
export type {
  Entity,
  EntityMetadata,
  Relation,
  RelationMetadata,
  KnowledgeGraph,
  McpToolResult,
} from './types.js';

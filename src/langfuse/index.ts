// coaiajs/src/langfuse/index.ts — Barrel export

export { LangfuseClient, LangfuseApiError, getClient, resetClient, nowISO } from './client.js';
export type {
  LangfuseClientConfig, V4ObservationInput, V4ObservationResult, V4ObservationType,
} from './client.js';

export {
  addTrace, createTrace, patchTraceOutput,
  listTraces, getTrace, traceView, sessionView,
  formatTracesTable, formatTracesMarkdown, formatTraceTree,
} from './traces.js';
export type { TraceFilters } from './traces.js';

export {
  addObservation, addObservations, listObservations, getObservation,
  formatObservationDisplay,
} from './observations.js';
export type { ObservationFilters } from './observations.js';

export {
  listPrompts, getPrompt, createPrompt,
  formatPromptsTable, formatPromptMarkdown, formatPromptDisplay,
} from './prompts.js';
export type { PromptSelector } from './prompts.js';

export {
  listDatasets, getDataset, createDataset, listDatasetItems, createDatasetItem,
  formatDatasetsTable, formatDatasetForFinetuning,
} from './datasets.js';

export {
  createScore, applyScoreToTrace, createScoreForTarget, listScores,
  listScoreConfigs, getScoreConfig, createScoreConfig,
  exportScoreConfigs, importScoreConfigs,
  applyScoreConfig,
  getBuiltInPresets, installPreset,
  formatScoresTable, formatScoreConfigsTable,
} from './scores.js';
export type { ScoreFilters } from './scores.js';

export { listComments, getComment, createComment } from './comments.js';
export type { CommentFilters } from './comments.js';

export {
  uploadMediaBytes, uploadAndAttachMedia, getMedia, detectContentType, formatMediaDisplay,
} from './media.js';
export type { UploadMediaBytesInput, UploadMediaBytesResult, MediaSource } from './media.js';

export { listProjects } from './projects.js';

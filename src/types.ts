// coaiajs/src/types.ts — Shared types
// Union of coaia-narrative + coaia-pde + coaia-planning type systems

// ─── Knowledge Graph Core ────────────────────────────────────────────

export interface Entity {
  /** Present on records read straight from the JSONL store, where it carries the line's kind. */
  type?: string;
  name: string;
  entityType: string;
  observations: string[];
  metadata?: EntityMetadata;
  [key: string]: unknown;
}

// ─── GitHub Bridge ───────────────────────────────────────────────────

export type GithubSyncState = 'synced' | 'diverged' | 'conflict' | 'project-only' | 'chart-only';

export type GithubSyncAuthority = 'jsonl' | 'project';

export interface GithubIssueRef {
  owner: string;
  repo: string;
  number: number;
  nodeId?: string;
  url?: string;
}

export interface GithubProjectItemRef {
  projectNumber: number;
  projectOwner: string;
  projectTitle?: string;
  itemId: string;
  url?: string;
}

export interface GithubBridgeMetadata {
  issue?: GithubIssueRef;
  projectItem?: GithubProjectItemRef;
  projectItems?: GithubProjectItemRef[];
  syncState?: GithubSyncState;
  lastSyncedAt?: string;
  fieldHash?: string;
  authoritativeOnLastSync?: GithubSyncAuthority;
}

export type GithubChartProvenance = GithubBridgeMetadata;

export type GithubActionStepProvenance = GithubBridgeMetadata;

export interface LegacyGithubSyncTarget {
  owner?: string;
  repo?: string;
  issue_number?: number;
  issueNumber?: number;
  number?: number;
  node_id?: string;
  nodeId?: string;
  issue_url?: string;
  url?: string;
  project_id?: string;
  projectId?: string;
  project_number?: number;
  projectNumber?: number;
  project_owner?: string;
  projectOwner?: string;
  project_title?: string;
  projectTitle?: string;
  item_id?: string;
  itemId?: string;
  project_url?: string;
}

export interface LegacyGithubRef {
  owner?: string;
  repo?: string;
  issue_number?: number;
  issueNumber?: number;
  number?: number;
  node_id?: string;
  nodeId?: string;
  issue_url?: string;
  url?: string;
}

// ─── Provenance & Research Lineage ───────────────────────────────────

export type SourceSystem =
  | 'coaia-narrative'
  | 'coaia-pde'
  | 'coaia-planning'
  | 'mcp-pde'
  | 'manual'
  | 'miadi'
  | 'coaia-github'
  | 'coaiajs'
  | (string & {});

export interface SourceProvenance {
  system: SourceSystem;
  version?: string;
  toolName?: string;
  sessionId?: string;
  createdAt?: string;
}

/**
 * Deep Research Foundations metadata for tracking research packet context and evaluation status.
 * Used by Atlas Chronicle and research delegation workflows.
 *
 * @see https://github.com/avadisabelle/coaia-narrative/issues/39
 */
export interface DeepResearchFoundationMetadata {
  packetRoot?: string;
  foundationType?: string;
  parentIssue?: string;
  baselineIssue?: string;
  inquiryIssue?: string;
  protocolIssue?: string;
  schemaIssue?: string;
  visualizerIssue?: string;
  expectedArtifacts?: string[];
  producedArtifacts?: string[];
  evaluationStatus?: 'expected' | 'delegated' | 'produced' | 'evaluated';
  privacyClass?: 'public-safe' | 'private' | 'mixed';
  publicationStatus?: 'planned' | 'draft' | 'reviewed' | 'published';
  commitHandles?: string[];
}

/**
 * Hermes session lineage metadata tracking conversation branching and handoff state.
 * Used for reconstructing branch maps and session traceability.
 *
 * @see https://github.com/avadisabelle/coaia-narrative/issues/40
 */
export interface HermesSessionLineageMetadata {
  platform?: string;
  parentChartId?: string;
  sourceBeat?: string;
  originalSessionId?: string;
  branchSessionId?: string;
  branchIndex?: number;
  copiedMessageCount?: number;
  branchPurpose?: string;
  relatedIssues?: string[];
  handoffState?: 'requirements-created' | 'implementation-ready' | 'returned-to-parent';
}

/**
 * Beat-level lived session context metadata capturing the embodied condition of working sessions.
 * Records land-based learning, voice/terminal mode, environmental constraints, and continuity context.
 *
 * @see https://github.com/avadisabelle/coaia-narrative/issues/42
 */
export interface SessionContextMetadata {
  mode?: 'voice' | 'terminal' | 'mixed';
  setting?: 'desk' | 'walking' | 'land-based' | 'transit' | 'unknown';
  landBasedLearning?: boolean;
  environmentNotes?: string[];
  listeningContext?: string;
  captureQuality?: 'clear' | 'windy' | 'partial';
  continuationKind?: 'branch' | 'parent-return' | 'follow-up';
  privateChroniclePath?: string;
  publicSummaryAllowed?: boolean;
}

// ─── Wampum Belt Sequencing ──────────────────────────────────────────

export interface WampumBeadPosition {
  row: number;
  col: number;
}

export interface WampumCeremonyLink {
  ceremonyType: 'commitment' | 'accountability' | 'witness' | 'renewal';
  chartId?: string;
  beatName?: string;
  witnessNames?: string[];
  renewalDate?: string;
  notes?: string;
}

export interface WampumBead {
  id: string;
  mnemonic: string;
  color: 'white' | 'purple' | 'black' | 'mixed';
  position: WampumBeadPosition;
  reading: string;
  relationalReadings?: Record<string, string>;
  ceremonyLink?: WampumCeremonyLink;
  observations: string[];
  createdAt: string;
}

export interface WampumBeltMetadata {
  beltId: string;
  title: string;
  purpose: string;
  rows: number;
  cols: number;
  beads: WampumBead[];
  createdAt: string;
  updatedAt: string;
}

export interface EntityMetadata {
  dueDate?: string;
  chartId?: string;
  phase?: 'germination' | 'assimilation' | 'completion';
  completionStatus?: boolean;
  parentChart?: string;
  parentActionStep?: string;
  level?: number;
  createdAt?: string;
  updatedAt?: string;
  direction?: string;
  confidence?: number;
  implicit?: boolean;
  pdeId?: string;
  act?: number;
  type_dramatic?: string;
  universes?: string[];
  timestamp?: string;
  elementsOfPerformance?: Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }>;
  mmotEvaluations?: Array<{
    phase: 'acknowledge' | 'analyze' | 'update' | 'recommit';
    assessment: string;
    direction?: 'South' | 'East' | 'West' | 'North';
    timestamp: string;
  }>;
  relationalAlignment?: {
    assessed: boolean;
    score: number | null;
    principles: string[];
  };
  fourDirections?: {
    north_vision: string | null;
    east_intention: string | null;
    south_emotion: string | null;
    west_introspection: string | null;
  };
  narrative?: {
    description: string;
    prose: string;
    lessons: string[];
  };
  order?: number;
  github?: GithubBridgeMetadata;
  source?: SourceProvenance;
  /** Deep Research Foundations metadata for research packet tracking and evaluation. */
  foundation?: DeepResearchFoundationMetadata;
  /** Hermes session lineage metadata for conversation branching and handoff tracking. */
  sessionLineage?: HermesSessionLineageMetadata;
  /** Beat-level lived session context capturing embodied working conditions. */
  sessionContext?: SessionContextMetadata;
  /** Wampum Belt metadata for non-linear mnemonic sequencing with ceremony links. */
  wampumBelt?: WampumBeltMetadata;
  /** Belt identifier carried on the wampum_belt entity itself. */
  beltId?: string;
  /** @deprecated Use github.issue and github.projectItem instead. */
  sync_target?: LegacyGithubSyncTarget;
  /** @deprecated Use github.issue instead. */
  github_ref?: LegacyGithubRef;
  [key: string]: unknown;
}

export interface Relation {
  /** Present on records read straight from the JSONL store, where it carries the line's kind. */
  type?: string;
  from: string;
  to: string;
  relationType: string;
  metadata?: RelationMetadata;
  [key: string]: unknown;
}

export interface RelationMetadata {
  createdAt?: string;
  strength?: number;
  context?: string;
  description?: string;
  beltId?: string;
  [key: string]: unknown;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  /**
   * The store's lines exactly as they were read, kept so a write can round-trip
   * fields this package does not model. Absent on a graph built in memory.
   */
  rawRecords?: JsonlRecord[];
}

export type JsonlRecord = Record<string, unknown>;

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// ─── PDE Types ───────────────────────────────────────────────────────

export type Urgency = 'immediate' | 'session' | 'persistent';
export type Direction = 'east' | 'south' | 'west' | 'north';

export interface PrimaryIntent {
  action: string;
  target: string;
  urgency: Urgency;
  confidence: number;
}

export interface SecondaryIntent {
  action: string;
  target: string;
  implicit: boolean;
  dependency: string | null;
  confidence: number;
}

export interface ContextRequirements {
  files_needed: string[];
  tools_required: string[];
  assumptions: string[];
}

export interface ExpectedOutputs {
  artifacts: string[];
  updates: string[];
  communications: string[];
}

export interface DirectionItem {
  text: string;
  confidence: number;
  implicit: boolean;
}

export type DirectionMap = Record<Direction, DirectionItem[]>;

export interface ActionItem {
  text: string;
  direction: Direction;
  dependency: string | null;
  completed?: boolean;
}

export interface AmbiguityFlag {
  text: string;
  suggestion: string;
}

export interface DecompositionResult {
  primary: PrimaryIntent;
  secondary: SecondaryIntent[];
  context: ContextRequirements;
  outputs: ExpectedOutputs;
  directions: DirectionMap;
  actionStack: ActionItem[];
  ambiguities: AmbiguityFlag[];
}

export interface StoredDecomposition {
  id: string;
  timestamp: string;
  prompt: string;
  result: DecompositionResult;
  options: DecompositionOptions;
  markdownPath?: string;
}

export interface DecompositionOptions {
  extractImplicit: boolean;
  mapDependencies: boolean;
}

export interface PdeSession {
  type: 'pde_session';
  sessionId: string;
  originalPrompt: string;
  masterChartId: string;
  pdeDecompositionId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'abandoned';
  metadata?: Record<string, unknown>;
}

export const URGENCY_DAYS: Record<string, number> = {
  immediate: 1,
  session: 7,
  persistent: 30,
};

// ─── Plan Parser Types ───────────────────────────────────────────────

export interface StructuralElement {
  type: 'desired_outcome' | 'current_reality' | 'action_step' | 'observation';
  content: string;
  confidence: number;
  sourceLines: { start: number; end: number };
  telescopesInto?: StructuralTensionPlan;
}

export interface StructuralTensionPlan {
  title: string;
  filePath: string;
  desiredOutcome: StructuralElement | null;
  currentReality: StructuralElement | null;
  actionSteps: StructuralElement[];
  observations: string[];
  metadata: {
    parsedAt: string;
    telescopeLevel: number;
    parentAction?: string;
    dueDate?: string;
    completionStatus: 'pending' | 'in_progress' | 'completed';
  };
}

// ─── Langfuse Types ──────────────────────────────────────────────────

export interface ScoreCategory {
  label: string;
  value: number;
}

export interface ScoreConfig {
  name: string;
  dataType: 'NUMERIC' | 'CATEGORICAL' | 'BOOLEAN';
  description?: string;
  categories?: ScoreCategory[];
  minValue?: number;
  maxValue?: number;
  isArchived?: boolean;
}

// ─── Pipeline Types ──────────────────────────────────────────────────

export interface PipelineVariable {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description?: string;
  choices?: string[];
}

export interface PipelineStep {
  name: string;
  observationType: string;
  description?: string;
  parent?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  conditional?: string;
}

export interface PipelineTemplate {
  name: string;
  version: string;
  description: string;
  author?: string;
  createdAt?: string;
  variables: PipelineVariable[];
  steps: PipelineStep[];
  extends?: string;
  metadata?: Record<string, unknown>;
}

// ─── Config Types ────────────────────────────────────────────────────

export interface CoaiaConfig {
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    ssl?: boolean;
    upstashUrl?: string;
    upstashToken?: string;
  };
  langfuse?: {
    publicKey?: string;
    secretKey?: string;
    baseUrl?: string;
  };
  openai?: {
    apiKey?: string;
    model?: string;
  };
  aws?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  };
  github?: {
    token?: string;
  };
  [key: string]: unknown;
}

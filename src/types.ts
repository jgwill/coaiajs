// coaiajs/src/types.ts — Shared types
// Union of coaia-narrative + coaia-pde + coaia-planning type systems

// ─── Knowledge Graph Core ────────────────────────────────────────────

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  metadata?: EntityMetadata;
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
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  metadata?: RelationMetadata;
}

export interface RelationMetadata {
  createdAt?: string;
  strength?: number;
  context?: string;
  description?: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

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

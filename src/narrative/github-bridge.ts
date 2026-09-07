import type {
  Entity,
  EntityMetadata,
  GithubBridgeMetadata,
  GithubIssueRef,
  GithubProjectItemRef,
  GithubSyncAuthority,
  GithubSyncState,
  KnowledgeGraph,
  LegacyGithubRef,
  LegacyGithubSyncTarget,
} from '../types.js';

export const GITHUB_PROJECT_FIELD_NAMES = [
  'goal',
  'current_reality',
  'observations',
  'question',
  'Status',
  'phase',
  'session_id',
  'four_dir_east',
  'four_dir_south',
  'four_dir_west',
  'four_dir_north',
  'relational_assessed',
  'relational_principles',
] as const;

export type GithubProjectFieldName = typeof GITHUB_PROJECT_FIELD_NAMES[number];

export type GithubProjectFieldProjection = Partial<Record<GithubProjectFieldName, string>>;

export type GithubProjectStatus =
  | 'In action planning'
  | 'Actionnable'
  | 'In progress'
  | 'Delaying Resolution'
  | 'In MOT'
  | 'Completed'
  | 'Aspirational';

export type GithubBridgeMetadataSource =
  | 'metadata.github'
  | 'metadata.sync_target'
  | 'metadata.github_ref';

export interface NormalizedGithubBridgeMetadata {
  issue?: GithubIssueRef;
  projectItems: GithubProjectItemRef[];
  syncState?: GithubSyncState;
  lastSyncedAt?: string;
  fieldHash?: string;
  authoritativeOnLastSync?: GithubSyncAuthority;
  legacyProjectId?: string;
  legacyProjectItemId?: string;
  sources: GithubBridgeMetadataSource[];
}

interface ChartProjectionContext {
  chart?: Entity;
  desiredOutcome?: Entity;
  currentReality?: Entity;
  actionSteps: Entity[];
}

export function normalizeGithubBridgeMetadata(metadata?: EntityMetadata): NormalizedGithubBridgeMetadata {
  const sources: GithubBridgeMetadataSource[] = [];
  const github = metadata?.github;
  const syncTarget = metadata?.sync_target;
  const githubRef = metadata?.github_ref;

  if (github) sources.push('metadata.github');

  const canonicalIssue = normalizeGithubIssueRef(github?.issue);
  const syncTargetIssue = normalizeLegacyIssueRef(syncTarget);
  const githubRefIssue = normalizeLegacyIssueRef(githubRef);

  if (!canonicalIssue && syncTargetIssue) sources.push('metadata.sync_target');
  if (!canonicalIssue && !syncTargetIssue && githubRefIssue) sources.push('metadata.github_ref');

  const canonicalProjectItems = normalizeGithubProjectItems(github);
  const legacyProjectItem = normalizeLegacyProjectItemRef(syncTarget);
  const projectItems = uniqueProjectItems(
    canonicalProjectItems.length > 0
      ? canonicalProjectItems
      : legacyProjectItem
        ? [legacyProjectItem]
        : []
  );

  if (canonicalProjectItems.length === 0 && legacyProjectItem && !sources.includes('metadata.sync_target')) {
    sources.push('metadata.sync_target');
  }

  const legacyRecord = isRecord(syncTarget) ? syncTarget : undefined;
  const legacyProjectId = legacyRecord ? getString(legacyRecord, ['project_id', 'projectId']) : undefined;
  const legacyProjectItemId = legacyRecord ? getString(legacyRecord, ['item_id', 'itemId']) : undefined;

  return {
    issue: canonicalIssue ?? syncTargetIssue ?? githubRefIssue,
    projectItems,
    syncState: github?.syncState,
    lastSyncedAt: github?.lastSyncedAt,
    fieldHash: github?.fieldHash,
    authoritativeOnLastSync: github?.authoritativeOnLastSync,
    legacyProjectId,
    legacyProjectItemId,
    sources: uniqueSources(sources),
  };
}

export function createGithubProjectFieldProjection(
  entity: Entity,
  graph?: KnowledgeGraph
): GithubProjectFieldProjection {
  const context = getChartProjectionContext(entity, graph);
  const projection: GithubProjectFieldProjection = {};

  setField(projection, 'goal', resolveGoal(entity, context));
  setField(projection, 'current_reality', resolveCurrentReality(entity, context));
  setField(projection, 'observations', joinObservations(entity.observations));
  setField(projection, 'question', resolveQuestion(entity, context));
  setField(projection, 'Status', deriveGithubProjectStatus(entity, graph));
  setField(projection, 'phase', entity.metadata?.phase);
  setField(projection, 'session_id', resolveSessionId(entity.metadata));
  setField(projection, 'four_dir_east', entity.metadata?.fourDirections?.east_intention);
  setField(projection, 'four_dir_south', entity.metadata?.fourDirections?.south_emotion);
  setField(projection, 'four_dir_west', entity.metadata?.fourDirections?.west_introspection);
  setField(projection, 'four_dir_north', entity.metadata?.fourDirections?.north_vision);
  setField(projection, 'relational_assessed', resolveRelationalAssessed(entity.metadata));
  setField(projection, 'relational_principles', entity.metadata?.relationalAlignment?.principles?.join('\n'));

  return orderProjection(projection);
}

export const projectEntityToGithubFields = createGithubProjectFieldProjection;

export function deriveGithubProjectStatus(entity: Entity, graph?: KnowledgeGraph): GithubProjectStatus | undefined {
  if (entity.metadata?.completionStatus === true) return 'Completed';

  const context = getChartProjectionContext(entity, graph);
  const completionRatio = getCompletionRatio(context.actionSteps);

  switch (entity.metadata?.phase) {
    case 'germination':
      return 'In action planning';
    case 'assimilation':
      return completionRatio !== undefined && completionRatio > 0 ? 'In progress' : 'Actionnable';
    case 'completion':
      return completionRatio !== undefined && completionRatio < 1 ? 'In MOT' : 'Completed';
    default:
      if (completionRatio === undefined) return undefined;
      return completionRatio > 0 ? 'In progress' : 'Actionnable';
  }
}

export function getGithubIssueUrl(issue: GithubIssueRef): string {
  return issue.url ?? `https://github.com/${issue.owner}/${issue.repo}/issues/${issue.number}`;
}

function normalizeGithubIssueRef(value: unknown): GithubIssueRef | undefined {
  if (!isRecord(value)) return undefined;

  const owner = getString(value, ['owner']);
  const repo = getString(value, ['repo']);
  const number = getPositiveInteger(value, ['number']);

  if (!owner || !repo || number === undefined) return undefined;

  return {
    owner,
    repo,
    number,
    ...optionalStringProp('nodeId', getString(value, ['nodeId', 'node_id'])),
    url: getString(value, ['url']) ?? `https://github.com/${owner}/${repo}/issues/${number}`,
  };
}

function normalizeLegacyIssueRef(value: LegacyGithubSyncTarget | LegacyGithubRef | undefined): GithubIssueRef | undefined {
  if (!isRecord(value)) return undefined;

  const owner = getString(value, ['owner']);
  const repo = getString(value, ['repo']);
  const number = getPositiveInteger(value, ['issue_number', 'issueNumber', 'number']);

  if (!owner || !repo || number === undefined) return undefined;

  return {
    owner,
    repo,
    number,
    ...optionalStringProp('nodeId', getString(value, ['node_id', 'nodeId'])),
    url: getString(value, ['issue_url', 'url']) ?? `https://github.com/${owner}/${repo}/issues/${number}`,
  };
}

function normalizeGithubProjectItems(github?: GithubBridgeMetadata): GithubProjectItemRef[] {
  if (!github) return [];

  const items = [
    normalizeGithubProjectItemRef(github.projectItem),
    ...(Array.isArray(github.projectItems) ? github.projectItems.map(normalizeGithubProjectItemRef) : []),
  ];

  return uniqueProjectItems(items.filter((item): item is GithubProjectItemRef => item !== undefined));
}

function normalizeGithubProjectItemRef(value: unknown): GithubProjectItemRef | undefined {
  if (!isRecord(value)) return undefined;

  const projectNumber = getPositiveInteger(value, ['projectNumber', 'project_number']);
  const projectOwner = getString(value, ['projectOwner', 'project_owner']);
  const itemId = getString(value, ['itemId', 'item_id']);

  if (projectNumber === undefined || !projectOwner || !itemId) return undefined;

  return {
    projectNumber,
    projectOwner,
    ...optionalStringProp('projectTitle', getString(value, ['projectTitle', 'project_title'])),
    itemId,
    ...optionalStringProp('url', getString(value, ['url'])),
  };
}

function normalizeLegacyProjectItemRef(syncTarget?: LegacyGithubSyncTarget): GithubProjectItemRef | undefined {
  if (!isRecord(syncTarget)) return undefined;

  const projectNumber = getPositiveInteger(syncTarget, ['project_number', 'projectNumber']);
  const projectOwner = getString(syncTarget, ['project_owner', 'projectOwner', 'owner']);
  const itemId = getString(syncTarget, ['item_id', 'itemId']);

  if (projectNumber === undefined || !projectOwner || !itemId) return undefined;

  return {
    projectNumber,
    projectOwner,
    ...optionalStringProp('projectTitle', getString(syncTarget, ['project_title', 'projectTitle'])),
    itemId,
    ...optionalStringProp('url', getString(syncTarget, ['project_url'])),
  };
}

function getChartProjectionContext(entity: Entity, graph?: KnowledgeGraph): ChartProjectionContext {
  if (!graph) return { chart: entity.entityType === 'structural_tension_chart' ? entity : undefined, actionSteps: [] };

  const chartId = resolveChartId(entity);
  const chart =
    entity.entityType === 'structural_tension_chart'
      ? entity
      : graph.entities.find(candidate =>
          candidate.entityType === 'structural_tension_chart' &&
          candidate.metadata?.chartId === chartId
        );

  if (!chart || !chartId) {
    return { chart, actionSteps: [] };
  }

  return {
    chart,
    desiredOutcome: findChartComponent(graph, chart, chartId, 'desired_outcome'),
    currentReality: findChartComponent(graph, chart, chartId, 'current_reality'),
    actionSteps: findActionSteps(graph, chart, chartId),
  };
}

function resolveChartId(entity: Entity): string | undefined {
  if (entity.metadata?.chartId) return entity.metadata.chartId;
  if (entity.entityType === 'structural_tension_chart' && entity.name.endsWith('_chart')) {
    return entity.name.slice(0, -'_chart'.length);
  }
  return undefined;
}

function findChartComponent(
  graph: KnowledgeGraph,
  chart: Entity,
  chartId: string,
  entityType: 'desired_outcome' | 'current_reality'
): Entity | undefined {
  const containedNames = new Set(
    graph.relations
      .filter(relation => relation.from === chart.name && relation.relationType === 'contains')
      .map(relation => relation.to)
  );

  return graph.entities.find(entity => containedNames.has(entity.name) && entity.entityType === entityType)
    ?? graph.entities.find(entity => entity.name === `${chartId}_${entityType}` && entity.entityType === entityType)
    ?? graph.entities.find(entity => entity.metadata?.chartId === chartId && entity.entityType === entityType);
}

function findActionSteps(graph: KnowledgeGraph, chart: Entity, chartId: string): Entity[] {
  const containedNames = new Set(
    graph.relations
      .filter(relation => relation.from === chart.name && relation.relationType === 'contains')
      .map(relation => relation.to)
  );

  const actionSteps = graph.entities.filter(entity =>
    entity.entityType === 'action_step' &&
    (entity.metadata?.chartId === chartId || containedNames.has(entity.name))
  );

  return actionSteps.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveGoal(entity: Entity, context: ChartProjectionContext): string | undefined {
  if (entity.entityType === 'desired_outcome' || entity.entityType === 'action_step') {
    return entity.observations[0];
  }

  if (entity.entityType === 'structural_tension_chart') {
    return context.desiredOutcome?.observations[0];
  }

  return undefined;
}

function resolveCurrentReality(entity: Entity, context: ChartProjectionContext): string | undefined {
  if (entity.entityType === 'current_reality') {
    return joinObservations(entity.observations);
  }

  if (entity.entityType === 'structural_tension_chart') {
    return joinObservations(context.currentReality?.observations);
  }

  return undefined;
}

function resolveQuestion(entity: Entity, context: ChartProjectionContext): string | undefined {
  const narrativeQuestion = entity.metadata?.narrative?.description;
  if (isNonEmptyString(narrativeQuestion)) return narrativeQuestion;

  const goal = resolveGoal(entity, context);
  return firstSentence(goal);
}

function resolveSessionId(metadata?: EntityMetadata): string | undefined {
  if (!metadata) return undefined;
  return metadata.source?.sessionId ?? getString(metadata as Record<string, unknown>, ['session_id', 'sessionId']);
}

function resolveRelationalAssessed(metadata?: EntityMetadata): string | undefined {
  if (metadata?.relationalAlignment?.assessed === true) return 'Yes';
  if (metadata?.relationalAlignment?.assessed === false) return 'Not yet';
  return undefined;
}

function getCompletionRatio(actionSteps: Entity[]): number | undefined {
  if (actionSteps.length === 0) return undefined;
  const completed = actionSteps.filter(step => step.metadata?.completionStatus === true).length;
  return completed / actionSteps.length;
}

function joinObservations(observations?: string[]): string | undefined {
  const value = observations?.map(observation => observation.trim()).filter(Boolean).join('\n');
  return isNonEmptyString(value) ? value : undefined;
}

function firstSentence(value: string | undefined): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const match = value.match(/^[^.!?]+[.!?]?/);
  return match?.[0].trim() || value.trim();
}

function setField(
  projection: GithubProjectFieldProjection,
  field: GithubProjectFieldName,
  value: string | null | undefined
): void {
  if (!isNonEmptyString(value)) return;
  projection[field] = value.trim();
}

function orderProjection(projection: GithubProjectFieldProjection): GithubProjectFieldProjection {
  const ordered: GithubProjectFieldProjection = {};
  for (const fieldName of GITHUB_PROJECT_FIELD_NAMES) {
    if (projection[fieldName] !== undefined) {
      ordered[fieldName] = projection[fieldName];
    }
  }
  return ordered;
}

function uniqueProjectItems(items: GithubProjectItemRef[]): GithubProjectItemRef[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.projectOwner}/${item.projectNumber}/${item.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSources(sources: GithubBridgeMetadataSource[]): GithubBridgeMetadataSource[] {
  return sources.filter((source, index) => sources.indexOf(source) === index);
}

function optionalStringProp<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value ? { [key]: value } as Partial<Record<K, string>> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

function getPositiveInteger(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  return undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

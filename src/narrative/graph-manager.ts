/**
 * KnowledgeGraphManager — JSONL-backed knowledge graph engine
 *
 * Ported from coaia-narrative/src/graph-manager.ts (1294 lines).
 * Implements structural tension charts, narrative beats, MMOT evaluation,
 * and general-purpose entity/relation CRUD over a JSONL file.
 */

import { promises as fs } from 'fs';
import type { Entity, Relation, KnowledgeGraph } from '../types.js';

export class KnowledgeGraphManager {
  private memoryFilePath: string;

  constructor(memoryFilePath: string) {
    this.memoryFilePath = memoryFilePath;
  }

  // ─── JSONL Storage ──────────────────────────────────────────────────

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, 'utf-8');
      const lines = data.split('\n').filter(line => line.trim() !== '');
      return lines.reduce(
        (graph: KnowledgeGraph, line) => {
          const item = JSON.parse(line);
          if (item.type === 'entity') graph.entities.push(item as Entity);
          if (item.type === 'relation') graph.relations.push(item as Relation);
          // Support narrative_beat entities stored in legacy format
          if (item.type === 'narrative_beat') {
            const narrativeBeat: Entity = {
              name: item.name,
              entityType: 'narrative_beat',
              observations: item.observations || [],
              metadata: {
                ...item.metadata,
                narrative: item.narrative,
                relationalAlignment: item.relational_alignment,
                fourDirections: item.four_directions,
              },
            };
            graph.entities.push(narrativeBeat);
          }
          return graph;
        },
        { entities: [], relations: [] },
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map(e => JSON.stringify({ type: 'entity', ...e })),
      ...graph.relations.map(r => JSON.stringify({ type: 'relation', ...r })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join('\n'));
  }

  // ─── Knowledge Graph CRUD ───────────────────────────────────────────

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const newEntities = entities.filter(
      e => !graph.entities.some(existing => existing.name === e.name),
    );
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    return newEntities;
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const newRelations = relations.filter(
      r =>
        !graph.relations.some(
          existing =>
            existing.from === r.from &&
            existing.to === r.to &&
            existing.relationType === r.relationType,
        ),
    );
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    return newRelations;
  }

  async addObservations(
    observations: { entityName: string; contents: string[] }[],
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(
        content => !entity.observations.includes(content),
      );
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(
      r => !entityNames.includes(r.from) && !entityNames.includes(r.to),
    );
    await this.saveGraph(graph);
  }

  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[],
  ): Promise<void> {
    const graph = await this.loadGraph();
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(
          o => !d.observations.includes(o),
        );
      }
    });
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(
      r =>
        !relations.some(
          del =>
            r.from === del.from &&
            r.to === del.to &&
            r.relationType === del.relationType,
        ),
    );
    await this.saveGraph(graph);
  }

  async readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const q = query.toLowerCase();

    const filteredEntities = graph.entities.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        e.observations.some(o => o.toLowerCase().includes(q)),
    );

    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );

    return { entities: filteredEntities, relations: filteredRelations };
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );
    return { entities: filteredEntities, relations: filteredRelations };
  }

  // ─── Chart Details ──────────────────────────────────────────────────

  async getChartDetails(chartId: string): Promise<KnowledgeGraph | null> {
    const graph = await this.loadGraph();
    const chartEntities = graph.entities.filter(
      e => e.metadata?.chartId === chartId,
    );
    if (chartEntities.length === 0) return null;
    const chartEntityNames = new Set(chartEntities.map(e => e.name));
    const chartRelations = graph.relations.filter(
      r => chartEntityNames.has(r.from) && chartEntityNames.has(r.to),
    );
    return { entities: chartEntities, relations: chartRelations };
  }

  async getActionStepDetails(actionStepName: string): Promise<KnowledgeGraph | null> {
    const graph = await this.loadGraph();
    const actionStepEntity = graph.entities.find(
      e =>
        e.name === actionStepName &&
        (e.entityType === 'action_step' || e.entityType === 'desired_outcome'),
    );
    if (!actionStepEntity) return null;

    // Follow the telescopes_into relation
    const telescopesRelation = graph.relations.find(
      r => r.from === actionStepName && r.relationType === 'telescopes_into',
    );
    if (!telescopesRelation) return null;

    const telescopedOutcomeEntity = graph.entities.find(
      e => e.name === telescopesRelation.to,
    );
    if (!telescopedOutcomeEntity || !telescopedOutcomeEntity.metadata?.chartId) {
      return null;
    }

    return this.getChartDetails(telescopedOutcomeEntity.metadata.chartId);
  }

  // ─── Structural Tension Charts ──────────────────────────────────────

  async createStructuralTensionChart(
    desiredOutcome: string,
    currentReality: string,
    dueDate: string,
    actionSteps?: string[],
    elementsOfPerformance?: Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }>,
  ): Promise<{ chartId: string; entities: Entity[]; relations: Relation[] }> {
    // Creative orientation validation
    const problemSolvingWords = ['fix', 'solve', 'eliminate', 'prevent', 'stop', 'avoid', 'reduce', 'remove'];
    const detectedProblemWords = problemSolvingWords.filter(word =>
      desiredOutcome.toLowerCase().includes(word),
    );

    if (detectedProblemWords.length > 0) {
      throw new Error(
        `🌊 CREATIVE ORIENTATION REQUIRED\n\n` +
        `Desired Outcome: "${desiredOutcome}"\n\n` +
        `❌ **Problem**: Contains problem-solving language: "${detectedProblemWords.join(', ')}"\n` +
        `📚 **Principle**: Structural Tension Charts use creative orientation - focus on what you want to CREATE, not what you want to eliminate.\n\n` +
        `🎯 **Reframe Your Outcome**:\n` +
        `Instead of elimination → Creation focus\n\n` +
        `✅ **Examples**:\n` +
        `- Instead of: "Fix communication problems"\n` +
        `- Use: "Establish clear, effective communication practices"\n\n` +
        `- Instead of: "Reduce website loading time"\n` +
        `- Use: "Achieve fast, responsive website performance"\n\n` +
        `**Why This Matters**: Problem-solving creates oscillating patterns. Creative orientation creates advancing patterns toward desired outcomes.\n\n` +
        `💡 **Tip**: Run 'init_llm_guidance' for complete methodology overview.`,
      );
    }

    // Delayed resolution validation
    const readinessWords = ['ready to', 'prepared to', 'all set', 'ready for', 'set to'];
    const detectedReadinessWords = readinessWords.filter(phrase =>
      currentReality.toLowerCase().includes(phrase),
    );

    if (detectedReadinessWords.length > 0) {
      throw new Error(
        `🌊 DELAYED RESOLUTION PRINCIPLE VIOLATION\n\n` +
        `Current Reality: "${currentReality}"\n\n` +
        `❌ **Problem**: Contains readiness assumptions: "${detectedReadinessWords.join(', ')}"\n` +
        `📚 **Principle**: "Tolerate discrepancy, tension, and delayed resolution" - Robert Fritz\n\n` +
        `🎯 **What's Needed**: Factual assessment of your actual current state (not readiness or preparation).\n\n` +
        `✅ **Examples**:\n` +
        `- Instead of: "Ready to learn Python"\n` +
        `- Use: "Never programmed before, interested in web development"\n\n` +
        `- Instead of: "Prepared to start the project"\n` +
        `- Use: "Have project requirements, no code written yet"\n\n` +
        `**Why This Matters**: Readiness assumptions prematurely resolve the structural tension needed for creative advancement.\n\n` +
        `💡 **Tip**: Run 'init_llm_guidance' for complete methodology overview.`,
      );
    }

    const chartId = `chart_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const entities: Entity[] = [
      {
        name: `${chartId}_chart`,
        entityType: 'structural_tension_chart',
        observations: [`Chart created on ${timestamp}`],
        metadata: {
          chartId,
          dueDate,
          level: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...(elementsOfPerformance && elementsOfPerformance.length > 0
            ? { elementsOfPerformance }
            : {}),
        },
      },
      {
        name: `${chartId}_desired_outcome`,
        entityType: 'desired_outcome',
        observations: [desiredOutcome],
        metadata: {
          chartId,
          dueDate,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      {
        name: `${chartId}_current_reality`,
        entityType: 'current_reality',
        observations: [currentReality],
        metadata: {
          chartId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ];

    // Add action steps if provided
    if (actionSteps && actionSteps.length > 0) {
      const stepDueDates = this.distributeActionStepDates(
        new Date(),
        new Date(dueDate),
        actionSteps.length,
      );

      actionSteps.forEach((step, index) => {
        entities.push({
          name: `${chartId}_action_${index + 1}`,
          entityType: 'action_step',
          observations: [step],
          metadata: {
            chartId,
            dueDate: stepDueDates[index].toISOString(),
            completionStatus: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
      });
    }

    // Create relations
    const relations: Relation[] = [
      {
        from: `${chartId}_chart`,
        to: `${chartId}_desired_outcome`,
        relationType: 'contains',
        metadata: { createdAt: timestamp },
      },
      {
        from: `${chartId}_chart`,
        to: `${chartId}_current_reality`,
        relationType: 'contains',
        metadata: { createdAt: timestamp },
      },
      {
        from: `${chartId}_current_reality`,
        to: `${chartId}_desired_outcome`,
        relationType: 'creates_tension_with',
        metadata: { createdAt: timestamp },
      },
    ];

    // Add action step relations
    if (actionSteps && actionSteps.length > 0) {
      actionSteps.forEach((_, index) => {
        const actionName = `${chartId}_action_${index + 1}`;
        relations.push(
          {
            from: `${chartId}_chart`,
            to: actionName,
            relationType: 'contains',
            metadata: { createdAt: timestamp },
          },
          {
            from: actionName,
            to: `${chartId}_desired_outcome`,
            relationType: 'advances_toward',
            metadata: { createdAt: timestamp },
          },
        );
      });
    }

    await this.createEntities(entities);
    await this.createRelations(relations);

    return { chartId, entities, relations };
  }

  // ─── Telescope Action Step ──────────────────────────────────────────

  async telescopeActionStep(
    actionStepName: string,
    newCurrentReality: string,
    initialActionSteps?: string[],
  ): Promise<{ chartId: string; parentChart: string }> {
    const graph = await this.loadGraph();
    const actionStep = graph.entities.find(
      e => e.name === actionStepName && e.entityType === 'action_step',
    );

    if (!actionStep || !actionStep.metadata?.chartId) {
      throw new Error(`Action step ${actionStepName} not found or not properly configured`);
    }

    const parentChartId = actionStep.metadata.chartId as string;
    const inheritedDueDate =
      (actionStep.metadata.dueDate as string) ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const desiredOutcome = actionStep.observations[0];

    const result = await this.createStructuralTensionChart(
      desiredOutcome,
      newCurrentReality,
      inheritedDueDate,
      initialActionSteps,
    );

    // Update new chart metadata to reflect telescoping relationship
    const newGraph = await this.loadGraph();
    const chartEntity = newGraph.entities.find(
      e => e.name === `${result.chartId}_chart`,
    );
    if (chartEntity && chartEntity.metadata) {
      chartEntity.metadata.parentChart = parentChartId;
      chartEntity.metadata.parentActionStep = actionStepName;
      chartEntity.metadata.level = ((actionStep.metadata.level as number) || 0) + 1;
      chartEntity.metadata.updatedAt = new Date().toISOString();
    }

    await this.saveGraph(newGraph);

    return { chartId: result.chartId, parentChart: parentChartId };
  }

  // ─── Mark Action Complete ───────────────────────────────────────────

  async markActionStepComplete(actionStepName: string): Promise<void> {
    const graph = await this.loadGraph();
    const actionStep = graph.entities.find(
      e =>
        e.name === actionStepName &&
        (e.entityType === 'action_step' || e.entityType === 'desired_outcome'),
    );

    if (!actionStep) {
      throw new Error(`Action step ${actionStepName} not found`);
    }

    const chartId = actionStep.metadata?.chartId;
    if (!chartId) {
      throw new Error(`Chart ID not found for action step ${actionStepName}`);
    }

    if (actionStep.metadata) {
      actionStep.metadata.completionStatus = true;
      actionStep.metadata.updatedAt = new Date().toISOString();
    }

    // Also mark the parent chart entity as complete
    const chartEntity = graph.entities.find(e => e.name === `${chartId}_chart`);
    if (chartEntity && chartEntity.metadata) {
      chartEntity.metadata.completionStatus = true;
      chartEntity.metadata.updatedAt = new Date().toISOString();
    }

    // Completed action steps flow into parent chart's current reality
    const parentChartId = chartEntity?.metadata?.parentChart as string | undefined;
    if (parentChartId) {
      const parentCurrentReality = graph.entities.find(
        e =>
          e.name === `${parentChartId}_current_reality` &&
          e.entityType === 'current_reality',
      );

      if (parentCurrentReality) {
        const completionMessage = `Completed: ${actionStep.observations[0]}`;
        if (!parentCurrentReality.observations.includes(completionMessage)) {
          parentCurrentReality.observations.push(completionMessage);
          if (parentCurrentReality.metadata) {
            parentCurrentReality.metadata.updatedAt = new Date().toISOString();
          }
        }
      }
    }

    await this.saveGraph(graph);
  }

  // ─── Chart Progress ─────────────────────────────────────────────────

  async getChartProgress(
    chartId: string,
    preloadedGraph?: KnowledgeGraph,
  ): Promise<{
    chartId: string;
    progress: number;
    completedActions: number;
    totalActions: number;
    nextAction?: string;
    dueDate?: string;
  }> {
    const graph = preloadedGraph ?? (await this.loadGraph());
    const actionSteps = graph.entities.filter(
      e => e.entityType === 'action_step' && e.metadata?.chartId === chartId,
    );

    const completedActions = actionSteps.filter(
      e => e.metadata?.completionStatus === true,
    ).length;
    const totalActions = actionSteps.length;
    const progress = totalActions > 0 ? completedActions / totalActions : 0;

    // Next incomplete action step by earliest due date
    const incompleteActions = actionSteps
      .filter(e => e.metadata?.completionStatus !== true)
      .sort((a, b) => {
        const dateA = new Date(a.metadata?.dueDate || '').getTime();
        const dateB = new Date(b.metadata?.dueDate || '').getTime();
        return dateA - dateB;
      });

    const chart = graph.entities.find(e => e.name === `${chartId}_chart`);

    return {
      chartId,
      progress,
      completedActions,
      totalActions,
      nextAction: incompleteActions[0]?.name,
      dueDate: chart?.metadata?.dueDate,
    };
  }

  // ─── List Active Charts ─────────────────────────────────────────────

  async listActiveCharts(): Promise<
    Array<{
      chartId: string;
      desiredOutcome: string;
      dueDate?: string;
      progress: number;
      completedActions: number;
      totalActions: number;
      level: number;
      parentChart?: string;
    }>
  > {
    const graph = await this.loadGraph();
    const charts = graph.entities.filter(
      e => e.entityType === 'structural_tension_chart',
    );

    const chartSummaries = await Promise.all(
      charts.map(async chart => {
        const chartId =
          (chart.metadata?.chartId as string) || chart.name.replace('_chart', '');
        const progress = await this.getChartProgress(chartId, graph);

        const desiredOutcome = graph.entities.find(
          e =>
            e.name === `${chartId}_desired_outcome` &&
            e.entityType === 'desired_outcome',
        );

        return {
          chartId,
          desiredOutcome: desiredOutcome?.observations[0] || 'Unknown outcome',
          dueDate: chart.metadata?.dueDate,
          progress: progress.progress,
          completedActions: progress.completedActions,
          totalActions: progress.totalActions,
          level: (chart.metadata?.level as number) || 0,
          parentChart: chart.metadata?.parentChart as string | undefined,
        };
      }),
    );

    return chartSummaries.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const dateA = new Date(a.dueDate || '').getTime();
      const dateB = new Date(b.dueDate || '').getTime();
      return dateA - dateB;
    });
  }

  // ─── Update Action Progress ─────────────────────────────────────────

  async updateActionProgress(
    actionStepName: string,
    progressObservation: string,
    updateCurrentReality?: boolean,
  ): Promise<void> {
    const graph = await this.loadGraph();
    const actionStep = graph.entities.find(
      e =>
        e.name === actionStepName &&
        (e.entityType === 'action_step' || e.entityType === 'desired_outcome'),
    );

    if (!actionStep) {
      throw new Error(`Action step ${actionStepName} not found`);
    }

    actionStep.observations.push(progressObservation);
    if (actionStep.metadata) {
      actionStep.metadata.updatedAt = new Date().toISOString();
    }

    if (updateCurrentReality && actionStep.metadata?.chartId) {
      const chartEntity = graph.entities.find(
        e => e.name === `${actionStep.metadata!.chartId}_chart`,
      );
      const parentChartId = chartEntity?.metadata?.parentChart as string | undefined;
      const targetChartId = parentChartId || (actionStep.metadata!.chartId as string);

      const currentReality = graph.entities.find(
        e =>
          e.name === `${targetChartId}_current_reality` &&
          e.entityType === 'current_reality',
      );

      if (currentReality) {
        const progressMessage = `Progress on ${actionStep.observations[0]}: ${progressObservation}`;
        if (!currentReality.observations.includes(progressMessage)) {
          currentReality.observations.push(progressMessage);
          if (currentReality.metadata) {
            currentReality.metadata.updatedAt = new Date().toISOString();
          }
        }
      }
    }

    await this.saveGraph(graph);
  }

  // ─── Update Current Reality ─────────────────────────────────────────

  async updateCurrentReality(chartId: string, newObservations: string[]): Promise<void> {
    const graph = await this.loadGraph();
    const currentReality = graph.entities.find(
      e =>
        e.name === `${chartId}_current_reality` &&
        e.entityType === 'current_reality',
    );

    if (!currentReality) {
      throw new Error(`Chart ${chartId} not found or missing current reality`);
    }

    const uniqueObservations = newObservations.filter(
      obs => !currentReality.observations.includes(obs),
    );
    currentReality.observations.push(...uniqueObservations);

    if (currentReality.metadata) {
      currentReality.metadata.updatedAt = new Date().toISOString();
    }

    await this.saveGraph(graph);
  }

  // ─── Update Desired Outcome ─────────────────────────────────────────

  async updateDesiredOutcome(chartId: string, newDesiredOutcome: string): Promise<void> {
    const graph = await this.loadGraph();
    const desiredOutcomeEntity = graph.entities.find(
      e =>
        e.name === `${chartId}_desired_outcome` &&
        e.entityType === 'desired_outcome',
    );

    if (!desiredOutcomeEntity) {
      throw new Error(`Chart ${chartId} desired outcome not found`);
    }

    desiredOutcomeEntity.observations[0] = newDesiredOutcome;

    if (desiredOutcomeEntity.metadata) {
      desiredOutcomeEntity.metadata.updatedAt = new Date().toISOString();
    }

    await this.saveGraph(graph);
  }

  // ─── MMOT Evaluation ────────────────────────────────────────────────

  async performMmotEvaluation(
    chartId: string,
    phase: string = 'full',
    assessment?: string,
    direction?: 'South' | 'East' | 'West' | 'North',
    correctiveActions?: string[],
    updateReality: boolean = true,
  ): Promise<{ guidance: string; evaluationStored: boolean; beatEmitted: boolean }> {
    const graph = await this.loadGraph();
    const chartEntity = graph.entities.find(
      e =>
        e.entityType === 'structural_tension_chart' &&
        e.metadata?.chartId === chartId,
    );
    if (!chartEntity) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const desiredOutcome = graph.entities.find(
      e => e.name === `${chartId}_desired_outcome`,
    );
    const currentReality = graph.entities.find(
      e => e.name === `${chartId}_current_reality`,
    );
    const actionSteps = graph.entities.filter(
      e => e.entityType === 'action_step' && e.metadata?.chartId === chartId,
    );
    const completedActions = actionSteps.filter(a => a.metadata?.completionStatus);
    const totalActions = actionSteps.length;
    const progressPct =
      totalActions > 0
        ? Math.round((completedActions.length / totalActions) * 100)
        : 0;

    const elementsOfPerformance =
      (chartEntity.metadata?.elementsOfPerformance as Array<{ description: string; type: string }>) || [];
    const designElements = elementsOfPerformance.filter(e => e.type === 'DESIGN');
    const executionElements = elementsOfPerformance.filter(e => e.type === 'EXECUTION');

    const directionLabel = direction ? ` [${direction}]` : '';
    const timestamp = new Date().toISOString();

    // Build phase-specific guidance
    const phaseGuidance: Record<string, string> = {
      acknowledge:
        `## MMOT Phase 1: Acknowledge the Truth${directionLabel}\n\n` +
        `**Chart**: ${chartId}\n` +
        `**Desired Outcome**: ${desiredOutcome?.observations[0] || 'Unknown'}\n` +
        `**Current Reality**: ${currentReality?.observations.join('; ') || 'Unknown'}\n` +
        `**Progress**: ${progressPct}% (${completedActions.length}/${totalActions} actions)\n\n` +
        (elementsOfPerformance.length > 0
          ? `**Elements of Performance:**\n` +
            designElements.map(e => `- 🏗️ DESIGN: ${e.description}`).join('\n') +
            '\n' +
            executionElements.map(e => `- ⚡ EXECUTION: ${e.description}`).join('\n') +
            '\n\n'
          : '') +
        `**Task**: Compare produced output against each element of performance. What difference exists between expected and delivered?\n\n` +
        (assessment
          ? `**Assessment**: ${assessment}`
          : 'Provide honest assessment of what was expected vs. what actually happened.'),

      analyze:
        `## MMOT Phase 2: Analyze How It Got There${directionLabel}\n\n` +
        `**Task**: Blow-by-blow of what actions were taken and what dynamics produced the current result.\n` +
        `- What assumptions were made?\n` +
        `- What worked and what didn't?\n` +
        `- What did the engagement reveal?\n\n` +
        (assessment
          ? `**Analysis**: ${assessment}`
          : 'Walk through the sequence of events that led to the current state.'),

      update:
        `## MMOT Phase 3: Update the Chart${directionLabel}\n\n` +
        `**Task**: Based on what was learned:\n` +
        `- Update current reality with new observations\n` +
        `- Adjust remaining action steps\n` +
        `- Add corrective actions if needed\n\n` +
        (assessment
          ? `**Updates Applied**: ${assessment}`
          : 'Describe what observations should flow into current reality.'),

      recommit:
        `## MMOT Phase 4: Recommit or Redirect${directionLabel}\n\n` +
        `**Desired Outcome**: ${desiredOutcome?.observations[0] || 'Unknown'}\n\n` +
        `**Task**: Is this desired outcome still what you want to create?\n` +
        `- If yes: What are the next strategic secondary choices?\n` +
        `- If no: Close this chart and create a new one with the actual desired outcome.\n\n` +
        (assessment
          ? `**Decision**: ${assessment}`
          : 'Recommit to the desired outcome or redirect.'),
    };

    if (phase === 'full') {
      phaseGuidance.full = Object.values(phaseGuidance).join('\n\n---\n\n');
    }

    const guidance =
      phaseGuidance[phase] || phaseGuidance.full || phaseGuidance.acknowledge;
    let evaluationStored = false;
    let beatEmitted = false;

    // Store evaluation observations
    if (assessment && updateReality) {
      const evalObservation = `[MMOT ${phase}${directionLabel}] ${assessment}`;

      if (currentReality) {
        currentReality.observations.push(evalObservation);
        if (currentReality.metadata) {
          currentReality.metadata.updatedAt = timestamp;
        }
      }

      if (!chartEntity.metadata!.mmotEvaluations) {
        chartEntity.metadata!.mmotEvaluations = [];
      }
      chartEntity.metadata!.mmotEvaluations.push({
        phase: phase as 'acknowledge' | 'analyze' | 'update' | 'recommit',
        assessment,
        direction,
        timestamp,
      });
      chartEntity.metadata!.updatedAt = timestamp;

      evaluationStored = true;
    }

    // Add corrective action steps
    if (correctiveActions && correctiveActions.length > 0) {
      const existingActionCount = actionSteps.length;
      correctiveActions.forEach((action, index) => {
        const actionName = `${chartId}_action_${existingActionCount + index + 1}`;
        graph.entities.push({
          name: actionName,
          entityType: 'action_step',
          observations: [action],
          metadata: {
            chartId,
            completionStatus: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        graph.relations.push({
          from: actionName,
          to: `${chartId}_desired_outcome`,
          relationType: 'advances_toward',
          metadata: { createdAt: timestamp },
        });
      });
    }

    // Persist when there's something meaningful
    const shouldSave =
      evaluationStored || (correctiveActions && correctiveActions.length > 0);
    if (shouldSave) {
      const beatName = `${chartId}_mmot_${Date.now()}`;
      const mmotBeat: Entity = {
        name: beatName,
        entityType: 'narrative_beat',
        observations: [
          `MMOT evaluation: ${phase}${directionLabel}`,
          ...(assessment ? [`Assessment: ${assessment}`] : []),
        ],
        metadata: {
          chartId,
          type_dramatic: 'mmot_evaluation',
          timestamp,
          fourDirections: direction
            ? {
                north_vision: direction === 'North' ? assessment || null : null,
                east_intention: direction === 'East' ? assessment || null : null,
                south_emotion: direction === 'South' ? assessment || null : null,
                west_introspection: direction === 'West' ? assessment || null : null,
              }
            : undefined,
        },
      };
      graph.entities.push(mmotBeat);
      graph.relations.push({
        from: beatName,
        to: `${chartId}_chart`,
        relationType: 'evaluates',
        metadata: { createdAt: timestamp },
      });
      beatEmitted = true;

      await this.saveGraph(graph);
    }

    return { guidance, evaluationStored, beatEmitted };
  }

  // ─── Narrative Beats ────────────────────────────────────────────────

  async createNarrativeBeat(
    parentChartId: string,
    title: string,
    act: number,
    type_dramatic: string,
    universes: string[],
    description: string,
    prose: string,
    lessons: string[],
    assessRelationalAlignment = false,
    initiateFourDirectionsInquiry = false,
    _filePath?: string,
  ): Promise<{ entity: Entity; beatName: string }> {
    const timestamp = Date.now();
    const beatName = `${parentChartId}_beat_${timestamp}`;

    const entity: Entity = {
      name: beatName,
      entityType: 'narrative_beat',
      observations: [
        `Act ${act} ${type_dramatic}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Universe: ${universes.join(', ')}`,
      ],
      metadata: {
        chartId: parentChartId,
        act,
        type_dramatic,
        universes,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        narrative: {
          description,
          prose,
          lessons,
        },
        relationalAlignment: {
          assessed: false,
          score: null,
          principles: [],
        },
        fourDirections: {
          north_vision: null,
          east_intention: null,
          south_emotion: null,
          west_introspection: null,
        },
      },
    };

    await this.createEntities([entity]);

    // Create relation to parent chart if it exists
    const graph = await this.loadGraph();
    const parentChart = graph.entities.find(
      e =>
        e.entityType === 'structural_tension_chart' &&
        e.metadata?.chartId === parentChartId,
    );

    if (parentChart) {
      await this.createRelations([
        {
          from: beatName,
          to: `${parentChartId}_chart`,
          relationType: 'documents',
          metadata: {
            createdAt: new Date().toISOString(),
            description: 'Narrative beat documents chart progress',
          },
        },
      ]);
    }

    if (assessRelationalAlignment) {
      console.log('🔮 Relational alignment assessment requested (iaip-mcp integration pending)');
    }

    if (initiateFourDirectionsInquiry) {
      console.log('🧭 Four Directions inquiry requested (iaip-mcp integration pending)');
    }

    return { entity, beatName };
  }

  async telescopeNarrativeBeat(
    parentBeatName: string,
    newCurrentReality: string,
    initialSubBeats?: Array<{
      title: string;
      type_dramatic: string;
      description: string;
      prose: string;
      lessons: string[];
    }>,
  ): Promise<{ parentBeat: Entity; subBeats: Entity[] }> {
    const graph = await this.loadGraph();
    const parentBeat = graph.entities.find(
      e => e.name === parentBeatName && e.entityType === 'narrative_beat',
    );

    if (!parentBeat) {
      throw new Error(`Parent narrative beat not found: ${parentBeatName}`);
    }

    parentBeat.observations.push(`Telescoped: ${newCurrentReality}`);
    if (parentBeat.metadata) {
      parentBeat.metadata.updatedAt = new Date().toISOString();
    }

    const subBeats: Entity[] = [];

    if (initialSubBeats && initialSubBeats.length > 0) {
      for (let i = 0; i < initialSubBeats.length; i++) {
        const subBeat = initialSubBeats[i];

        const result = await this.createNarrativeBeat(
          parentBeatName,
          subBeat.title,
          i + 1,
          subBeat.type_dramatic,
          (parentBeat.metadata?.universes as string[]) || ['engineer-world'],
          subBeat.description,
          subBeat.prose,
          subBeat.lessons,
        );

        subBeats.push(result.entity);
      }
    }

    await this.saveGraph(graph);

    return { parentBeat, subBeats };
  }

  async listNarrativeBeats(parentChartId?: string): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const beats = graph.entities.filter(e => e.entityType === 'narrative_beat');

    if (parentChartId) {
      return beats.filter(beat => beat.metadata?.chartId === parentChartId);
    }

    return beats;
  }

  // ─── Add Action Step (telescoped chart) ─────────────────────────────

  async addActionStep(
    parentChartId: string,
    actionStepTitle: string,
    dueDate?: string,
    currentReality?: string,
    performanceElements?: Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }>,
  ): Promise<{ chartId: string; actionStepName: string }> {
    const graph = await this.loadGraph();
    const parentChart = graph.entities.find(
      e =>
        e.entityType === 'structural_tension_chart' &&
        e.metadata?.chartId === parentChartId,
    );

    if (!parentChart) {
      throw new Error(`Parent chart ${parentChartId} not found`);
    }

    const parentDueDate = parentChart.metadata?.dueDate as string | undefined;
    if (!parentDueDate) {
      throw new Error(`Parent chart ${parentChartId} has no due date`);
    }

    let actionStepDueDate = dueDate;
    if (!actionStepDueDate) {
      const now = new Date();
      const parentEnd = new Date(parentDueDate);
      const midpoint = new Date(
        now.getTime() + (parentEnd.getTime() - now.getTime()) / 2,
      );
      actionStepDueDate = midpoint.toISOString();
    }

    if (!currentReality) {
      throw new Error(
        `🌊 DELAYED RESOLUTION PRINCIPLE VIOLATION\n\n` +
        `Action step: "${actionStepTitle}"\n\n` +
        `❌ **Problem**: Current reality assessment missing\n` +
        `📚 **Principle**: "Tolerate discrepancy, tension, and delayed resolution" - Robert Fritz\n\n` +
        `🎯 **What's Needed**: Honest assessment of your actual current state relative to this action step.\n\n` +
        `✅ **Examples**:\n` +
        `- "Never used Django, completed Python basics"\n` +
        `- "Built one API, struggling with authentication"\n` +
        `- "Read 3 chapters, concepts still unclear"\n\n` +
        `❌ **Avoid**: "Ready to begin", "Prepared to start", "All set to..."\n\n` +
        `**Why This Matters**: Premature resolution destroys the structural tension that generates creative advancement. The system NEEDS honest current reality to create productive tension.\n\n` +
        `💡 **Tip**: Run 'init_llm_guidance' for complete methodology overview.`,
      );
    }

    const actionCurrentReality = currentReality;

    // Create telescoped structural tension chart
    const telescopedChart = await this.createStructuralTensionChart(
      actionStepTitle,
      actionCurrentReality,
      actionStepDueDate,
      undefined,
      performanceElements,
    );

    // Load once, apply all mutations, save once
    const updatedGraph = await this.loadGraph();
    const timestamp = new Date().toISOString();

    const telescopedChartEntity = updatedGraph.entities.find(
      e => e.name === `${telescopedChart.chartId}_chart`,
    );
    if (telescopedChartEntity && telescopedChartEntity.metadata) {
      telescopedChartEntity.metadata.parentChart = parentChartId;
      telescopedChartEntity.metadata.level =
        ((parentChart.metadata?.level as number) || 0) + 1;
      telescopedChartEntity.metadata.updatedAt = timestamp;
    }

    const parentDesiredOutcome = updatedGraph.entities.find(
      e =>
        e.name === `${parentChartId}_desired_outcome` &&
        e.entityType === 'desired_outcome',
    );
    if (parentDesiredOutcome) {
      updatedGraph.relations.push({
        from: `${telescopedChart.chartId}_desired_outcome`,
        to: parentDesiredOutcome.name,
        relationType: 'advances_toward',
        metadata: { createdAt: timestamp },
      });
    }

    await this.saveGraph(updatedGraph);

    return {
      chartId: telescopedChart.chartId,
      actionStepName: `${telescopedChart.chartId}_desired_outcome`,
    };
  }

  // ─── Manage Action Step (unified interface) ─────────────────────────

  async manageActionStep(
    parentReference: string,
    actionDescription: string,
    currentReality?: string,
    initialActionSteps?: string[],
    dueDate?: string,
    performanceElements?: Array<{ description: string; type: 'DESIGN' | 'EXECUTION' }>,
  ): Promise<{ chartId: string; actionStepName: string }> {
    const graph = await this.loadGraph();

    const actionStepPattern = /^chart_\d+_action_\d+$/;
    const desiredOutcomePattern = /^chart_\d+_desired_outcome$/;
    const chartIdPattern = /^chart_\d+$/;

    const isActionStepEntity = actionStepPattern.test(parentReference);
    const isDesiredOutcomeEntity = desiredOutcomePattern.test(parentReference);
    const isChartId = chartIdPattern.test(parentReference);

    // Route 1: Expanding existing action_step entity (legacy pattern)
    if (isActionStepEntity) {
      const actionStep = graph.entities.find(
        e => e.name === parentReference && e.entityType === 'action_step',
      );

      if (!actionStep) {
        const allActionSteps = graph.entities
          .filter(e => e.entityType === 'action_step')
          .map(e => `- ${e.name}: "${e.observations[0]}"`);

        throw new Error(
          `🔍 ACTION STEP ENTITY NOT FOUND\n\n` +
          `Received: "${parentReference}"\n` +
          `Expected: Valid action_step entity name (e.g., "chart_123_action_1")\n\n` +
          `Available action steps in memory:\n` +
          `${allActionSteps.length > 0 ? allActionSteps.join('\n') : '(none found)'}\n\n` +
          `Tip: If creating a new action step, use the parent chart ID instead.`,
        );
      }

      const currentRealityToUse =
        currentReality || 'Expanding action step into detailed sub-chart';
      const telescopedResult = await this.telescopeActionStep(
        parentReference,
        currentRealityToUse,
        initialActionSteps,
      );
      return {
        chartId: telescopedResult.chartId,
        actionStepName: `${telescopedResult.chartId}_desired_outcome`,
      };
    }

    // Route 2: Expanding existing desired_outcome entity (modern pattern)
    if (isDesiredOutcomeEntity) {
      const desiredOutcome = graph.entities.find(
        e => e.name === parentReference && e.entityType === 'desired_outcome',
      );

      if (!desiredOutcome || !desiredOutcome.metadata?.chartId) {
        throw new Error(
          `🔍 DESIRED OUTCOME ENTITY NOT FOUND\n\n` +
          `Received: "${parentReference}"\n` +
          `Expected: Valid desired_outcome entity name (e.g., "chart_123_desired_outcome")\n\n` +
          `Tip: If creating a new action step, use the parent chart ID instead.`,
        );
      }

      const currentRealityToUse =
        currentReality || 'Expanding desired outcome into detailed sub-chart';
      const telescopedResult = await this.telescopeActionStep(
        parentReference,
        currentRealityToUse,
        initialActionSteps,
      );
      return {
        chartId: telescopedResult.chartId,
        actionStepName: `${telescopedResult.chartId}_desired_outcome`,
      };
    }

    // Route 3: Creating new action step under parent chart
    if (isChartId) {
      const parentChart = graph.entities.find(
        e =>
          e.entityType === 'structural_tension_chart' &&
          e.metadata?.chartId === parentReference,
      );

      if (!parentChart) {
        const allCharts = graph.entities
          .filter(e => e.entityType === 'structural_tension_chart')
          .map(e => {
            const outcome = graph.entities.find(
              o => o.name === `${e.metadata?.chartId}_desired_outcome`,
            );
            return `- ${e.metadata?.chartId}: "${outcome?.observations[0] || 'Unknown'}"`;
          });

        throw new Error(
          `🔍 PARENT CHART NOT FOUND\n\n` +
          `Received: "${parentReference}"\n` +
          `Expected: Valid chart ID (e.g., "chart_123")\n\n` +
          `Available charts in memory:\n` +
          `${allCharts.length > 0 ? allCharts.join('\n') : '(none found)'}\n\n` +
          `Tip: Use 'list_active_charts' to see all available charts.`,
        );
      }

      if (!currentReality) {
        throw new Error(
          `🌊 DELAYED RESOLUTION PRINCIPLE VIOLATION\n\n` +
          `Action step: "${actionDescription}"\n` +
          `Parent chart: "${parentReference}"\n\n` +
          `❌ **Problem**: Current reality assessment missing\n` +
          `📚 **Principle**: "Tolerate discrepancy, tension, and delayed resolution" - Robert Fritz\n\n` +
          `🎯 **What's Needed**: Honest assessment of actual current state relative to this action step.\n\n` +
          `✅ **Examples**:\n` +
          `- "Never used Django, completed Python basics"\n` +
          `- "Built one API, struggling with authentication"\n` +
          `- "Read 3 chapters, concepts still unclear"\n\n` +
          `❌ **Avoid**: "Ready to begin", "Prepared to start", "All set to..."\n\n` +
          `**Why This Matters**: Premature resolution destroys structural tension essential for creative advancement.\n\n` +
          `💡 **Tip**: Run 'init_llm_guidance' for complete methodology overview.`,
        );
      }

      return await this.addActionStep(
        parentReference,
        actionDescription,
        dueDate,
        currentReality,
        performanceElements,
      );
    }

    // Route 4: Invalid format
    throw new Error(
      `🚨 INVALID PARENT REFERENCE FORMAT\n\n` +
      `Received: "${parentReference}"\n\n` +
      `Valid formats:\n` +
      `1. Chart ID: "chart_123" → Creates new action step\n` +
      `2. Action entity: "chart_123_action_1" → Expands existing legacy action step\n` +
      `3. Desired outcome: "chart_123_desired_outcome" → Expands existing modern action step\n\n` +
      `Examples:\n` +
      `- Create new action: manageActionStep("chart_123", "Complete tutorial", "Never used Django")\n` +
      `- Expand existing: manageActionStep("chart_123_action_1", "Complete tutorial", undefined, ["Step 1", "Step 2"])\n\n` +
      `💡 **Tip**: Use 'list_active_charts' to see available charts and their IDs.`,
    );
  }

  // ─── Remove Action Step ─────────────────────────────────────────────

  async removeActionStep(parentChartId: string, actionStepName: string): Promise<void> {
    const graph = await this.loadGraph();

    const actionStepEntity = graph.entities.find(e => e.name === actionStepName);
    if (!actionStepEntity || !actionStepEntity.metadata?.chartId) {
      throw new Error(`Action step ${actionStepName} not found`);
    }

    const telescopedChartId = actionStepEntity.metadata.chartId as string;

    // Verify it belongs to the parent chart
    const telescopedChart = graph.entities.find(
      e =>
        e.entityType === 'structural_tension_chart' &&
        e.metadata?.chartId === telescopedChartId &&
        e.metadata?.parentChart === parentChartId,
    );

    if (!telescopedChart) {
      throw new Error(
        `Action step ${actionStepName} does not belong to chart ${parentChartId}`,
      );
    }

    // Remove all entities belonging to the telescoped chart
    const entitiesToRemove = graph.entities
      .filter(e => e.metadata?.chartId === telescopedChartId)
      .map(e => e.name);

    await this.deleteEntities(entitiesToRemove);
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  private extractCurrentRealityFromContext(
    userInput: string,
    _actionStepTitle: string,
  ): string | null {
    const realityPatterns = [
      /(?:currently|right now|at present|today)\s+(.{10,})/i,
      /(?:i am|we are|the situation is)\s+(.{10,})/i,
      /(?:i have|we have|there is|there are)\s+(.{10,})/i,
      /(?:my current|our current|the current)\s+(.{10,})/i,
    ];

    for (const pattern of realityPatterns) {
      const match = userInput.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private distributeActionStepDates(
    startDate: Date,
    endDate: Date,
    stepCount: number,
  ): Date[] {
    const totalTime = endDate.getTime() - startDate.getTime();
    const stepInterval = totalTime / (stepCount + 1);

    const dates: Date[] = [];
    for (let i = 1; i <= stepCount; i++) {
      dates.push(new Date(startDate.getTime() + stepInterval * i));
    }

    return dates;
  }
}

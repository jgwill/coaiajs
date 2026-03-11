/**
 * STC Mapper — Transforms mcp-pde DecompositionResult into Entity[]/Relation[]
 * Ported from coaia-pde/src/stc-mapper.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DecompositionResult,
  Entity,
  Relation,
  EntityMetadata,
} from '../types.js';
import { URGENCY_DAYS } from '../types.js';

export class StcMapper {

  /**
   * Core method: Transform a DecompositionResult into Entity[]/Relation[].
   */
  mapDecompositionToChart(
    result: DecompositionResult,
    originalPrompt: string,
    options?: { pdeId?: string; dueDate?: string }
  ): { entities: Entity[]; relations: Relation[]; chartId: string } {
    const chartId = `chart_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const dueDate = options?.dueDate || this.calculateDueDate(result.primary.urgency);
    const fourDirections = this.mapDirectionsToFourDirections(result.directions);

    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // 1. Master chart entity
    entities.push({
      name: `${chartId}_chart`,
      entityType: 'structural_tension_chart',
      observations: [`Master chart for: ${result.primary.action} ${result.primary.target}`],
      metadata: {
        chartId,
        dueDate,
        level: 0,
        phase: 'germination',
        createdAt: now,
        updatedAt: now,
        pdeId: options?.pdeId,
        fourDirections,
      }
    });

    // 2. Desired outcome entity
    const desiredOutcomeObs = [this.formatDesiredOutcome(result.primary)];
    for (const a of result.outputs.artifacts) desiredOutcomeObs.push(`Artifact: ${a}`);
    for (const u of result.outputs.updates) desiredOutcomeObs.push(`Update: ${u}`);
    for (const c of result.outputs.communications) desiredOutcomeObs.push(`Communication: ${c}`);

    entities.push({
      name: `${chartId}_desired_outcome`,
      entityType: 'desired_outcome',
      observations: desiredOutcomeObs,
      metadata: {
        chartId,
        confidence: result.primary.confidence,
        createdAt: now,
        updatedAt: now,
      }
    });

    // 3. Current reality entity
    entities.push({
      name: `${chartId}_current_reality`,
      entityType: 'current_reality',
      observations: this.formatCurrentReality(result.context, result.ambiguities),
      metadata: {
        chartId,
        createdAt: now,
        updatedAt: now,
      }
    });

    // 4. Action step entities from secondary[] + actionStack[]
    const totalActionCount = result.secondary.length + result.actionStack.length;
    const actionDueDates = this.distributeActionDates(new Date(), new Date(dueDate), totalActionCount);
    let actionIndex = 0;

    for (const sec of result.secondary) {
      const actionName = `${chartId}_action_${++actionIndex}`;

      entities.push({
        name: actionName,
        entityType: 'action_step',
        observations: [`${sec.action} ${sec.target}`],
        metadata: {
          chartId,
          dueDate: actionDueDates[actionIndex - 1]?.toISOString(),
          completionStatus: false,
          level: 1,
          parentChart: chartId,
          implicit: sec.implicit,
          confidence: sec.confidence,
          createdAt: now,
          updatedAt: now,
        }
      });

      relations.push({
        from: `${chartId}_chart`,
        to: actionName,
        relationType: 'has_action_step',
        metadata: { createdAt: now }
      });

      relations.push({
        from: actionName,
        to: `${chartId}_desired_outcome`,
        relationType: 'advances_toward',
        metadata: { createdAt: now }
      });

      if (sec.dependency) {
        this.addDependencyRelation(entities, relations, actionName, sec.dependency, now);
      }
    }

    for (const item of result.actionStack) {
      const actionName = `${chartId}_action_${++actionIndex}`;

      entities.push({
        name: actionName,
        entityType: 'action_step',
        observations: [item.text],
        metadata: {
          chartId,
          dueDate: actionDueDates[actionIndex - 1]?.toISOString(),
          completionStatus: item.completed || false,
          level: 1,
          parentChart: chartId,
          direction: item.direction,
          createdAt: now,
          updatedAt: now,
        }
      });

      relations.push({
        from: `${chartId}_chart`,
        to: actionName,
        relationType: 'has_action_step',
        metadata: { createdAt: now }
      });

      relations.push({
        from: actionName,
        to: `${chartId}_desired_outcome`,
        relationType: 'advances_toward',
        metadata: { createdAt: now }
      });

      if (item.dependency) {
        this.addDependencyRelation(entities, relations, actionName, item.dependency, now);
      }
    }

    // 5. Structural relations
    relations.push(
      {
        from: `${chartId}_chart`,
        to: `${chartId}_desired_outcome`,
        relationType: 'has_desired_outcome',
        metadata: { createdAt: now }
      },
      {
        from: `${chartId}_chart`,
        to: `${chartId}_current_reality`,
        relationType: 'has_current_reality',
        metadata: { createdAt: now }
      },
      {
        from: `${chartId}_current_reality`,
        to: `${chartId}_desired_outcome`,
        relationType: 'creates_tension_with',
        metadata: { createdAt: now }
      }
    );

    return { entities, relations, chartId };
  }

  private addDependencyRelation(
    entities: Entity[],
    relations: Relation[],
    fromName: string,
    dependency: string,
    now: string
  ): void {
    const depEntity = entities.find(
      e => e.entityType === 'action_step' && e.observations[0]?.includes(dependency)
    );
    if (depEntity) {
      relations.push({
        from: fromName,
        to: depEntity.name,
        relationType: 'depends_on',
        metadata: { createdAt: now, context: dependency }
      });
    }
  }

  private formatDesiredOutcome(primary: { action: string; target: string }): string {
    const { action, target } = primary;

    const resultPhrases: Record<string, string> = {
      create: `Completed ${target}`,
      build: `Functional ${target}`,
      implement: `Working ${target}`,
      write: `Finished ${target}`,
      design: `Complete design for ${target}`,
      develop: `Deployed ${target}`,
      analyze: `Clear understanding of ${target}`,
      integrate: `Fully integrated ${target}`,
      test: `Validated ${target}`,
      fix: `Resolved ${target}`,
      refactor: `Refactored ${target}`,
    };

    for (const [verb, phrase] of Object.entries(resultPhrases)) {
      if (action.startsWith(verb)) {
        return phrase;
      }
    }

    return `Completed: ${action} ${target}`;
  }

  private formatCurrentReality(
    context: DecompositionResult['context'],
    ambiguities: DecompositionResult['ambiguities']
  ): string[] {
    const observations: string[] = [];

    if (context.files_needed.length > 0) {
      observations.push(`Files to reference: ${context.files_needed.join(', ')}`);
    }

    if (context.tools_required.length > 0) {
      observations.push(`Tools available: ${context.tools_required.join(', ')}`);
    }

    for (const assumption of context.assumptions) {
      observations.push(`Assumption: ${assumption}`);
    }

    for (const ambiguity of ambiguities) {
      observations.push(`⚠️ Ambiguity: ${ambiguity.text} — Suggestion: ${ambiguity.suggestion}`);
    }

    if (observations.length === 0) {
      observations.push('Starting point: No prior work on this goal');
    }

    return observations;
  }

  private mapDirectionsToFourDirections(
    directions: DecompositionResult['directions']
  ): EntityMetadata['fourDirections'] {
    const join = (items: Array<{ text: string }>) =>
      items.length > 0 ? items.map(i => i.text).join('; ') : null;

    return {
      north_vision: join(directions.north || []),
      east_intention: join(directions.east || []),
      south_emotion: join(directions.south || []),
      west_introspection: join(directions.west || []),
    };
  }

  private calculateDueDate(urgency: string): string {
    const days = URGENCY_DAYS[urgency] || URGENCY_DAYS['session'];
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  private distributeActionDates(start: Date, end: Date, count: number): Date[] {
    if (count === 0) return [];

    const totalTime = end.getTime() - start.getTime();
    const interval = totalTime / (count + 1);

    const dates: Date[] = [];
    for (let i = 1; i <= count; i++) {
      dates.push(new Date(start.getTime() + interval * i));
    }

    return dates;
  }
}

export const stcMapper = new StcMapper();

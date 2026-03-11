/**
 * Plan Parser — Transforms markdown plans into structural tension charts
 * Ported from coaia-planning/src/plan-parser.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  Entity,
  Relation,
  StructuralElement,
  StructuralTensionPlan,
  DecompositionResult,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN RECOGNITION
// ═══════════════════════════════════════════════════════════════════════════

const DESIRED_OUTCOME_PATTERNS: RegExp[] = [
  // Explicit markers
  /^(?:##?\s*)?(?:desired\s+outcome|goal|objective|end\s+result|vision|target):\s*(.+)/im,
  /\*\*(?:desired\s+outcome|goal|objective)\*\*:\s*(.+)/im,
  // Creative orientation language
  /(?:we\s+want\s+to\s+create|aim\s+to\s+manifest|intend\s+to\s+bring\s+into\s+being)\s+(.+)/i,
  /(?:the\s+end\s+result\s+is|what\s+we're\s+creating\s+is)\s+(.+)/i,
  // State of being descriptions
  /(?:when\s+complete|upon\s+completion)[,:]?\s*(.+)/i,
];

const CURRENT_REALITY_PATTERNS: RegExp[] = [
  // Explicit markers
  /^(?:##?\s*)?(?:current\s+reality|current\s+state|where\s+we\s+are|starting\s+point):\s*(.+)/im,
  /\*\*(?:current\s+reality|current\s+state)\*\*:\s*(.+)/im,
  // Factual assessment language
  /(?:currently|at\s+present|as\s+of\s+now)[,:]?\s*(.+)/i,
  /(?:the\s+current\s+situation\s+is|we\s+currently\s+have)\s+(.+)/i,
];

const ACTION_STEP_PATTERNS: RegExp[] = [
  // Phase markers (these telescope)
  /^(?:##?\s*)?phase\s+(\d+)[:\s]+(.+)/im,
  /^(?:##?\s*)?step\s+(\d+)[:\s]+(.+)/im,
  // Numbered items
  /^(\d+)\.\s+(.+)$/gm,
  // Checklist items
  /^-\s*\[([ x])\]\s+(.+)$/gm,
  // Action-oriented subsections
  /^###?\s+(.+)$/gm,
];

// ═══════════════════════════════════════════════════════════════════════════
// PARSING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a plan file as a structural tension chart
 */
export async function parsePlan(planPath: string): Promise<StructuralTensionPlan> {
  const content = await fs.readFile(planPath, 'utf-8');
  return parsePlanContent(content, planPath);
}

/**
 * Parse plan content directly
 */
export function parsePlanContent(
  content: string,
  filePath: string = 'inline',
  telescopeLevel: number = 0
): StructuralTensionPlan {
  const lines = content.split('\n');

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');

  const desiredOutcome = extractDesiredOutcome(content, lines);
  const currentReality = extractCurrentReality(content, lines);
  const actionSteps = extractActionSteps(content, lines);
  const observations = extractObservations(content, lines, desiredOutcome, currentReality, actionSteps);

  return {
    title,
    filePath,
    desiredOutcome,
    currentReality,
    actionSteps,
    observations,
    metadata: {
      parsedAt: new Date().toISOString(),
      telescopeLevel,
      completionStatus: 'pending',
    },
  };
}

/**
 * Convert structural tension plan to Entity[]/Relation[] (JSONL-compatible)
 */
export function planToSTC(
  plan: StructuralTensionPlan,
  chartIdPrefix: string = 'plan'
): { entities: Entity[]; relations: Relation[] } {
  const chartId = `${chartIdPrefix}_${sanitizeName(plan.title)}`;
  const entities: Entity[] = [];
  const relations: Relation[] = [];
  const now = new Date().toISOString();

  // Chart entity
  entities.push({
    name: `${chartId}_chart`,
    entityType: 'structural_tension_chart',
    observations: [`Parsed from: ${plan.filePath}`],
    metadata: {
      chartId,
      level: plan.metadata.telescopeLevel,
      createdAt: now,
      updatedAt: now,
      dueDate: plan.metadata.dueDate,
    },
  });

  // Desired outcome
  if (plan.desiredOutcome) {
    const doName = `${chartId}_desired_outcome`;
    entities.push({
      name: doName,
      entityType: 'desired_outcome',
      observations: [plan.desiredOutcome.content],
      metadata: {
        chartId,
        confidence: plan.desiredOutcome.confidence,
        createdAt: now,
      },
    });
    relations.push({
      from: `${chartId}_chart`,
      to: doName,
      relationType: 'contains',
    });
  }

  // Current reality
  if (plan.currentReality) {
    const crName = `${chartId}_current_reality`;
    entities.push({
      name: crName,
      entityType: 'current_reality',
      observations: [plan.currentReality.content],
      metadata: {
        chartId,
        confidence: plan.currentReality.confidence,
        createdAt: now,
      },
    });
    relations.push({
      from: `${chartId}_chart`,
      to: crName,
      relationType: 'contains',
    });

    // Structural tension relation
    if (plan.desiredOutcome) {
      relations.push({
        from: crName,
        to: `${chartId}_desired_outcome`,
        relationType: 'creates_tension_with',
      });
    }
  }

  // Action steps (each is a potential telescoped STC)
  plan.actionSteps.forEach((step, index) => {
    const actionName = `${chartId}_action_${index + 1}`;
    entities.push({
      name: actionName,
      entityType: 'action_step',
      observations: [step.content],
      metadata: {
        chartId,
        order: index + 1,
        completionStatus: false,
        confidence: step.confidence,
        createdAt: now,
      },
    });

    relations.push({
      from: `${chartId}_chart`,
      to: actionName,
      relationType: 'contains',
    });

    if (plan.desiredOutcome) {
      relations.push({
        from: actionName,
        to: `${chartId}_desired_outcome`,
        relationType: 'advances_toward',
      });
    }

    // If action telescopes, recursively convert
    if (step.telescopesInto) {
      const nestedSTC = planToSTC(step.telescopesInto, actionName);
      entities.push(...nestedSTC.entities);
      relations.push(...nestedSTC.relations);

      relations.push({
        from: actionName,
        to: `${actionName}_chart`,
        relationType: 'telescopes_into',
      });
    }
  });

  return { entities, relations };
}

/**
 * Export Entity[]/Relation[] to JSONL format
 */
export function exportToJSONL(stc: { entities: Entity[]; relations: Relation[] }): string {
  const lines: string[] = [];

  for (const entity of stc.entities) {
    lines.push(JSON.stringify({ type: 'entity', ...entity }));
  }

  for (const relation of stc.relations) {
    lines.push(JSON.stringify({ type: 'relation', ...relation }));
  }

  return lines.join('\n');
}

/**
 * PDE bridge: Convert DecompositionResult into Entity[]/Relation[]
 */
export function decompositionResultToPlan(
  decomposition: DecompositionResult,
  originalPrompt?: string
): { entities: Entity[]; relations: Relation[] } {
  const chartId = `pde_${Date.now()}`;
  const entities: Entity[] = [];
  const relations: Relation[] = [];
  const now = new Date().toISOString();

  // Collect direction observations for chart entity
  const directionObservations: string[] = [];
  for (const [dir, items] of Object.entries(decomposition.directions)) {
    for (const item of items) {
      directionObservations.push(`[${dir.toUpperCase()}] ${item.text}`);
    }
  }

  // Chart entity
  entities.push({
    name: `${chartId}_chart`,
    entityType: 'structural_tension_chart',
    observations: [
      `PDE decomposition of: ${originalPrompt || `${decomposition.primary.action} ${decomposition.primary.target}`}`,
      `Primary confidence: ${decomposition.primary.confidence}`,
      `Urgency: ${decomposition.primary.urgency}`,
      ...directionObservations,
    ],
    metadata: {
      chartId,
      level: 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Desired outcome from primary intent + expected outputs
  const doName = `${chartId}_desired_outcome`;
  const doObservations = [
    `${decomposition.primary.action}: ${decomposition.primary.target}`,
    ...decomposition.outputs.artifacts.map(a => `Artifact: ${a}`),
    ...decomposition.outputs.updates.map(u => `Update: ${u}`),
    ...decomposition.outputs.communications.map(c => `Communication: ${c}`),
  ];
  entities.push({
    name: doName,
    entityType: 'desired_outcome',
    observations: doObservations,
    metadata: {
      chartId,
      confidence: decomposition.primary.confidence,
      createdAt: now,
    },
  });
  relations.push({
    from: `${chartId}_chart`,
    to: doName,
    relationType: 'contains',
  });

  // Current reality from context requirements
  const crName = `${chartId}_current_reality`;
  const crObservations = [
    ...decomposition.context.assumptions,
    ...decomposition.context.files_needed.map(f => `File needed: ${f}`),
    ...decomposition.context.tools_required.map(t => `Tool required: ${t}`),
  ];
  if (crObservations.length === 0) {
    crObservations.push('No explicit current reality captured from decomposition context');
  }
  entities.push({
    name: crName,
    entityType: 'current_reality',
    observations: crObservations,
    metadata: {
      chartId,
      createdAt: now,
    },
  });
  relations.push({
    from: `${chartId}_chart`,
    to: crName,
    relationType: 'contains',
  });
  relations.push({
    from: crName,
    to: doName,
    relationType: 'creates_tension_with',
  });

  // Action steps from actionStack
  decomposition.actionStack.forEach((action, index) => {
    const actionName = `${chartId}_action_${index + 1}`;
    entities.push({
      name: actionName,
      entityType: 'action_step',
      observations: [action.text],
      metadata: {
        chartId,
        order: index + 1,
        completionStatus: action.completed || false,
        direction: action.direction,
        createdAt: now,
      },
    });

    relations.push({
      from: `${chartId}_chart`,
      to: actionName,
      relationType: 'contains',
    });
    relations.push({
      from: actionName,
      to: doName,
      relationType: 'advances_toward',
    });

    // Dependency relations — match by text against other actions
    if (action.dependency) {
      const depIndex = decomposition.actionStack.findIndex(a => a.text === action.dependency);
      if (depIndex >= 0) {
        relations.push({
          from: actionName,
          to: `${chartId}_action_${depIndex + 1}`,
          relationType: 'depends_on',
        });
      }
    }
  });

  // Secondary intents as observation entities
  decomposition.secondary.forEach((intent, index) => {
    const secName = `${chartId}_secondary_${index + 1}`;
    entities.push({
      name: secName,
      entityType: 'observation',
      observations: [
        `${intent.action}: ${intent.target}`,
        intent.implicit ? '(implicit intent)' : '(explicit intent)',
      ],
      metadata: {
        chartId,
        confidence: intent.confidence,
        createdAt: now,
      },
    });
    relations.push({
      from: `${chartId}_chart`,
      to: secName,
      relationType: 'contains',
    });
  });

  // Ambiguities as observation entities
  decomposition.ambiguities.forEach((amb, index) => {
    const ambName = `${chartId}_ambiguity_${index + 1}`;
    entities.push({
      name: ambName,
      entityType: 'observation',
      observations: [
        `Ambiguity: ${amb.text}`,
        `Suggestion: ${amb.suggestion}`,
      ],
      metadata: {
        chartId,
        createdAt: now,
      },
    });
    relations.push({
      from: `${chartId}_chart`,
      to: ambName,
      relationType: 'contains',
    });
  });

  return { entities, relations };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractDesiredOutcome(content: string, lines: string[]): StructuralElement | null {
  for (const pattern of DESIRED_OUTCOME_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const lineNum = findLineNumber(lines, match[0]);
      return {
        type: 'desired_outcome',
        content: match[1].trim(),
        confidence: 0.9,
        sourceLines: { start: lineNum, end: lineNum },
      };
    }
  }

  // Fallback: Look for "Desired Outcome" section
  const sectionMatch = content.match(/##\s*Desired\s+Outcome\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (sectionMatch) {
    const sectionContent = sectionMatch[1].trim();
    const firstParagraph = sectionContent.split('\n\n')[0];
    const lineNum = findLineNumber(lines, sectionMatch[0]);
    return {
      type: 'desired_outcome',
      content: firstParagraph,
      confidence: 0.8,
      sourceLines: { start: lineNum, end: lineNum + firstParagraph.split('\n').length },
    };
  }

  return null;
}

function extractCurrentReality(content: string, lines: string[]): StructuralElement | null {
  for (const pattern of CURRENT_REALITY_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const lineNum = findLineNumber(lines, match[0]);
      return {
        type: 'current_reality',
        content: match[1].trim(),
        confidence: 0.9,
        sourceLines: { start: lineNum, end: lineNum },
      };
    }
  }

  // Fallback: Look for "Current Reality" or "Current State" section
  const sectionMatch = content.match(/##\s*Current\s+(?:Reality|State)\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (sectionMatch) {
    const sectionContent = sectionMatch[1].trim();
    const firstParagraph = sectionContent.split('\n\n')[0];
    const lineNum = findLineNumber(lines, sectionMatch[0]);
    return {
      type: 'current_reality',
      content: firstParagraph,
      confidence: 0.8,
      sourceLines: { start: lineNum, end: lineNum + firstParagraph.split('\n').length },
    };
  }

  return null;
}

function extractActionSteps(content: string, lines: string[]): StructuralElement[] {
  const steps: StructuralElement[] = [];

  // Look for Phase sections (highest priority — these telescope)
  const phasePattern = /^##\s*Phase\s+(\d+)[:\s]*(.+)?$/gim;
  let phaseMatch;
  while ((phaseMatch = phasePattern.exec(content)) !== null) {
    const phaseNum = phaseMatch[1];
    const phaseTitle = phaseMatch[2]?.trim() || `Phase ${phaseNum}`;
    const lineNum = findLineNumber(lines, phaseMatch[0]);

    // Extract phase content for telescoping
    const phaseStart = phaseMatch.index + phaseMatch[0].length;
    const remainingContent = content.slice(phaseStart);
    const nextPhaseMatch = remainingContent.match(/^##\s*(?:Phase\s+\d+|[^#])/m);
    const phaseEnd = nextPhaseMatch
      ? phaseStart + nextPhaseMatch.index!
      : content.length;
    const phaseContent = content.slice(phaseStart, phaseEnd).trim();

    const step: StructuralElement = {
      type: 'action_step',
      content: phaseTitle,
      confidence: 1.0,
      sourceLines: { start: lineNum, end: lineNum },
    };

    // Telescope: parse phase content as nested STC
    if (phaseContent.length > 20) {
      step.telescopesInto = parsePlanContent(phaseContent, `phase_${phaseNum}`, 1);
    }

    steps.push(step);
  }

  // If no phases, look for numbered action items
  if (steps.length === 0) {
    const numberedPattern = /^(\d+)\.\s+(.+)$/gm;
    let numMatch;
    while ((numMatch = numberedPattern.exec(content)) !== null) {
      const lineNum = findLineNumber(lines, numMatch[0]);
      steps.push({
        type: 'action_step',
        content: numMatch[2].trim(),
        confidence: 0.7,
        sourceLines: { start: lineNum, end: lineNum },
      });
    }
  }

  // Also check for checklist items as action steps
  const checklistPattern = /^-\s*\[([ x])\]\s+(.+)$/gm;
  let checkMatch;
  while ((checkMatch = checklistPattern.exec(content)) !== null) {
    const lineNum = findLineNumber(lines, checkMatch[0]);

    // Only add if not already captured
    const exists = steps.some(s => s.content === checkMatch![2].trim());
    if (!exists) {
      steps.push({
        type: 'action_step',
        content: checkMatch[2].trim(),
        confidence: 0.6,
        sourceLines: { start: lineNum, end: lineNum },
      });
    }
  }

  return steps;
}

function extractObservations(
  content: string,
  _lines: string[],
  _desiredOutcome: StructuralElement | null,
  _currentReality: StructuralElement | null,
  _actionSteps: StructuralElement[]
): string[] {
  const observations: string[] = [];

  const obsPattern = /(?:note|observation|insight):\s*(.+)/gi;
  let obsMatch;
  while ((obsMatch = obsPattern.exec(content)) !== null) {
    observations.push(obsMatch[1].trim());
  }

  return observations;
}

function findLineNumber(lines: string[], searchStr: string): number {
  const searchLine = searchStr.split('\n')[0];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchLine.trim().substring(0, 30))) {
      return i + 1;
    }
  }
  return 1;
}

function sanitizeName(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

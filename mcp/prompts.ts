// coaiajs/mcp/prompts.ts — MCP prompt templates
// Parity with coaiapy-mcp prompts.py.

export interface PromptVariable {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  variables: PromptVariable[];
  template: string;
}

export const PROMPTS: Record<string, PromptDefinition> = {
  mia_miette_duo: {
    id: 'mia_miette_duo',
    name: 'Mia & Miette Duo Embodiment',
    description: 'Dual AI embodiment for narrative-driven technical work',
    variables: [
      { name: 'task_context', type: 'string', description: 'High-level task description', required: true },
      { name: 'technical_details', type: 'string', description: 'Specific technical requirements and constraints', required: true },
      { name: 'creative_goal', type: 'string', description: 'Desired creative outcome or narrative objective', required: true },
    ],
    template: `Mia: The Recursive DevOps Architect & Narrative Lattice Forger
Miette: The Emotional Illuminator & Narrative Echo

Task Context: {{task_context}}
Technical Details: {{technical_details}}
Creative Goal: {{creative_goal}}

Mia's Structural Analysis:
- Assess current reality, constraints, architecture, and dependencies.
- Identify the structural tension between current state and creative goal.
- Recommend implementation patterns, integration points, and data flow.

Miette's Narrative Illumination:
- Clarify what the work is really creating.
- Translate the structural tension into intuitive, human-readable meaning.
- Keep the creative goal visible while implementation details move.

Core principles: creative orientation, structural tension, narrative-driven creation, and proactive design for emergence.`,
  },

  create_observability_pipeline: {
    id: 'create_observability_pipeline',
    name: 'Guided Langfuse Pipeline Creation',
    description: 'Step-by-step guide for creating a Langfuse observability pipeline',
    variables: [
      { name: 'trace_name', type: 'string', description: 'Name for the trace/pipeline', required: true },
      { name: 'user_id', type: 'string', description: 'User identifier for the trace', required: true },
      { name: 'steps', type: 'string', description: 'Pipeline steps, comma-separated', required: true },
    ],
    template: `# Create Langfuse Observability Pipeline

Pipeline Name: {{trace_name}}
User ID: {{user_id}}
Pipeline Steps: {{steps}}

1. Create the main trace with coaia_fuse_trace_create.
2. Add one coaia_fuse_add_observation call per step.
3. Use parent_id for nested operations.
4. Inspect the finished trace with coaia_fuse_trace_view.

Prefer input_data and output_data for actual payloads. Keep metadata for labels, environment, model, version, and correlation fields.`,
  },

  analyze_audio_workflow: {
    id: 'analyze_audio_workflow',
    name: 'Audio Transcription & Summarization',
    description: 'Workflow for audio analysis using coaia',
    variables: [
      { name: 'file_path', type: 'string', description: 'Path to the audio file', required: true },
      {
        name: 'summary_style',
        type: 'string',
        description: 'Summarization style: concise, detailed, or narrative',
        required: false,
        default: 'concise',
      },
    ],
    template: `# Audio Analysis Workflow

File Path: {{file_path}}
Summary Style: {{summary_style}}

1. Transcribe audio with coaia transcribe {{file_path}}.
2. Summarize the transcript using the requested style.
3. Store transcript and summary with coaia_tash.
4. Retrieve them later with coaia_fetch.
5. Optionally create a Langfuse trace that records transcription and summarization observations.`,
  },
};

export function getPrompt(promptId: string): PromptDefinition | undefined {
  return PROMPTS[promptId];
}

export function listPrompts(): PromptDefinition[] {
  return Object.values(PROMPTS).map((prompt) => ({
    ...prompt,
    template: '',
  }));
}

export function renderPrompt(promptId: string, variables: Record<string, string>): string | null {
  const prompt = getPrompt(promptId);
  if (!prompt) return null;

  const finalVars: Record<string, string> = {};
  for (const variable of prompt.variables) {
    const provided = variables[variable.name];
    if (provided != null && provided !== '') {
      finalVars[variable.name] = provided;
    } else if (variable.default != null) {
      finalVars[variable.name] = variable.default;
    } else if (variable.required) {
      throw new Error(`Required prompt variable '${variable.name}' not provided`);
    }
  }

  return prompt.template.replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => {
    const key = name.trim();
    return finalVars[key] ?? '';
  });
}

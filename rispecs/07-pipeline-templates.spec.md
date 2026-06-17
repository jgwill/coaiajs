# 07 — Pipeline Templates

> Pipeline template engine with variable substitution and conditional rendering.

## Desired Outcome

A template engine that loads pipeline definitions, renders them with `{{variable}}` substitution, supports conditionals and built-in functions, and executes multi-step pipelines — enabling reusable agent workflows defined in YAML or JSON.

## Structural Tension

**Current Reality:**
- [`src/pipeline/`](../src/pipeline/) is implemented:
  - [`template-engine.ts`](../src/pipeline/template-engine.ts) ports coaiapy `pipeline.py` and `mobile_template.py` patterns into `MobileTemplateEngine`, `TemplateLoader`, and `TemplateRenderer`.
  - [`index.ts`](../src/pipeline/index.ts) exports the public pipeline API.
- Types are defined in [`src/types.ts`](../src/types.ts): `PipelineVariable`, `PipelineStep`, `PipelineTemplate`.
- Pipeline templates use `{{variable}}` substitution, simple filters, conditionals, defaults, and built-in functions.
- [`mcp/resources.ts`](../mcp/resources.ts) exposes template listing, template detail, and template-variable resources.
- Remaining gap: pipeline execution as a first-class MCP tool remains desired; current implementation renders template steps but does not execute external action dependencies.

**Desired Outcome:**
Pipeline engine in `src/pipeline/` that:
- Loads templates from YAML/JSON files
- Renders templates with variable substitution
- Supports conditionals (`{{#if condition}}...{{/if}}`)
- Provides built-in functions (`{{now}}`, `{{uuid}}`, `{{env.VAR}}`)
- Executes multi-step pipelines with step dependencies
- Exposes 3 MCP tools

## Template Format

```yaml
name: session-init
description: Initialize a CoAiA agent session
variables:
  - name: session_id
    required: true
  - name: agent_name
    default: "unnamed"
  - name: trace_id
    default: "{{uuid}}"
steps:
  - name: create-trace
    action: langfuse.createTrace
    params:
      name: "{{agent_name}}-session"
      sessionId: "{{session_id}}"
      metadata:
        traceId: "{{trace_id}}"
  - name: init-redis
    action: redis.tash
    params:
      key: "session:{{session_id}}"
      value: '{"agent":"{{agent_name}}","started":"{{now}}"}'
      ttl: 86400
```

## Core API

```typescript
class PipelineEngine {
  loadTemplate(pathOrName: string): Promise<PipelineTemplate>
  render(template: PipelineTemplate, variables: Record<string, string>): PipelineTemplate
  execute(template: PipelineTemplate, variables: Record<string, string>): Promise<PipelineResult>
  listTemplates(directory?: string): Promise<string[]>
}

interface PipelineResult {
  success: boolean;
  steps: { name: string; status: 'success' | 'failed' | 'skipped'; output?: unknown; error?: string }[];
  duration: number;
}
```

## Built-in Functions

| Function | Output |
|----------|--------|
| `{{now}}` | ISO 8601 timestamp |
| `{{uuid}}` | Random UUID v4 |
| `{{env.VAR_NAME}}` | Environment variable value |
| `{{date.YYYY-MM-DD}}` | Formatted date |

## MCP Tools (3)

| Tool | Purpose |
|------|---------|
| `pipeline_list` | List available pipeline templates |
| `pipeline_render` | Render template with variables (preview) |
| `pipeline_execute` | Execute pipeline with variables |

## Quality Criteria

- ✅ Templates load from both YAML and JSON formats
- ✅ Missing required variables produce clear error with variable name
- ✅ Default values applied when optional variables are absent
- ✅ Built-in functions resolve at render time
- ✅ Step execution is sequential; failure stops pipeline unless step is marked optional

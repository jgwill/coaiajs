# Zod Runtime Validation: Technical Assessment for CoAiA.js

> Package selection brief — TypeScript-first schema validation replacing coaia-narrative's custom 181-line validation.ts

## Summary & Recommendation

**Use `zod` v4.x** as the unified validation layer for all coaiajs modules. Zod replaces coaia-narrative's custom `validation.ts` (181 lines of hand-rolled recursive validation) with a standard, composable, type-inferring schema library. The MCP SDK already requires Zod as a peer dependency for tool argument schemas — using it everywhere eliminates dual validation code.

**Pin:** `"zod": "^4.0.0"` (v4.3.6 stable, required by `@modelcontextprotocol/sdk`)

## What We're Replacing

coaia-narrative has a custom `validation.ts` implementing recursive schema validation:

```typescript
// coaia-narrative/src/validation.ts — 181 lines of custom validation
type ValidationType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'enum';

interface ValidationRule {
  type: ValidationType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  minValue?: number;
  maxValue?: number;
  enumValues?: (string | number)[];
  items?: ValidationRule;         // array items schema
  properties?: Record<string, ValidationRule>;  // object properties
}

export function validate(args: any, schema: ValidationSchema): { valid: boolean; error?: string }
```

Pre-built schemas: `stringArray()`, `entityArray()`, `relationArray()`, `isoDate()`, `nonEmptyString()`.

This works but: no type inference, no composition, no transform/coerce, no JSON Schema export, and every new validation type requires manual code.

## Options Compared

| Feature | Zod v4 | Custom validation.ts | io-ts | Yup |
|---------|--------|---------------------|-------|-----|
| Type inference | ✅ Automatic `z.infer<>` | ❌ Manual types | ✅ (verbose) | ⚠️ Partial |
| Schema composition | ✅ `.merge()`, `.extend()`, `.pick()` | ❌ Manual nesting | ✅ | ✅ |
| MCP SDK compat | ✅ Required peer dep | ❌ N/A | ❌ | ❌ |
| JSON Schema export | ✅ `toJSONSchema()` | ❌ N/A | ❌ | ❌ |
| Transform/coerce | ✅ `.transform()`, `.coerce` | ❌ N/A | ❌ | ✅ |
| Error messages | ✅ Structured `ZodError` | ⚠️ Single string | ⚠️ Verbose | ✅ |
| Bundle size | ~2KB gzip (core) | ~3KB | ~15KB | ~12KB |
| Weekly downloads | ~100M+ | N/A | ~8M | ~15M |
| Performance (v4) | 14x faster strings, 7x faster arrays vs v3 | Adequate | Slower | Slower |

## API Overview

### Replacing Custom Schemas

```typescript
import { z } from 'zod';

// Replaces: ValidationSchemas.nonEmptyString()
const NonEmptyString = z.string().min(1);

// Replaces: ValidationSchemas.isoDate()
const IsoDate = z.string().datetime();

// Replaces: ValidationSchemas.stringArray(minLength)
const StringArray = (min = 0) => z.array(z.string()).min(min);

// Replaces: ValidationSchemas.entityArray()
const Entity = z.object({
  name: z.string().min(1),
  entityType: z.string().min(1),
  observations: z.array(z.string()).default([]),
});
const EntityArray = z.array(Entity).min(1);

// Replaces: ValidationSchemas.relationArray()
const Relation = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationType: z.string().min(1),
});
const RelationArray = z.array(Relation);
```

### Structural Tension Chart Schema

```typescript
const ChartSchema = z.object({
  id: z.string().min(1),
  desiredOutcome: z.string().min(1),
  currentReality: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  actionSteps: z.array(z.object({
    title: z.string().min(1),
    status: z.enum(['pending', 'in_progress', 'done', 'blocked']),
    currentReality: z.string().optional(),
  })).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type Chart = z.infer<typeof ChartSchema>;  // TypeScript type auto-generated
```

### MCP Tool Argument Validation

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'coaiajs', version: '1.0.0' });

// Zod schemas ARE the MCP tool input schemas — zero duplication
server.tool(
  'create_chart',
  'Create a structural tension chart',
  {
    desiredOutcome: z.string().describe('What you want to CREATE'),
    currentReality: z.string().describe('Factual assessment of current state'),
    dueDate: z.string().datetime().optional().describe('Target date (ISO 8601)'),
    actionSteps: z.array(z.string()).optional().describe('Initial action steps'),
  },
  async ({ desiredOutcome, currentReality, dueDate, actionSteps }) => {
    // Arguments are already validated and typed
    const chart = await createChart({ desiredOutcome, currentReality, dueDate, actionSteps });
    return { content: [{ type: 'text', text: JSON.stringify(chart) }] };
  }
);
```

### Pipeline Template Validation

```typescript
// Replaces coaiapy's pipeline.py validate_variables()
const PipelineVariable = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'list']).default('string'),
  required: z.boolean().default(true),
  default: z.unknown().optional(),
  choices: z.array(z.unknown()).optional(),
});

const PipelineTemplate = z.object({
  name: z.string().min(1),
  version: z.string().default('1.0'),
  variables: z.array(PipelineVariable).default([]),
  steps: z.array(z.object({
    name: z.string().min(1),
    observation_type: z.enum(['EVENT', 'SPAN', 'GENERATION']).default('EVENT'),
    conditional: z.string().optional(),
  })).min(1),
});

// Validate and get typed result
function loadTemplate(raw: unknown): PipelineTemplate {
  return PipelineTemplate.parse(raw);  // throws ZodError on invalid
}
```

### Error Handling

```typescript
import { z } from 'zod';

function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { valid: true; data: T } | { valid: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  // Structured error messages
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  return { valid: false, error: messages.join('; ') };
}
```

## Integration Plan

1. **Shared schemas:** `src/schemas/` directory with reusable Zod schemas
   - `chart.ts` — ChartSchema, ActionStepSchema
   - `entity.ts` — Entity, Relation schemas (replaces validation.ts)
   - `pipeline.ts` — PipelineTemplate, PipelineVariable
   - `session.ts` — Session, Trace schemas
2. **MCP tools:** Direct Zod schemas in tool definitions (no separate validation layer)
3. **Config validation:** Zod for config file/env var validation at startup
4. **JSON Schema export:** `toJSONSchema()` for documentation and interop
5. **Migration:** Delete coaia-narrative's `validation.ts`, import from `@coaiajs/schemas`

### @zod/mini for Future Frontend

If coaiajs adds a web UI, use `@zod/mini` (~1.9KB) for client-side validation with the same schemas.

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 4.3.6 (Jan 2026) |
| Weekly downloads | ~100M+ |
| TypeScript | First-class, type inference is the core value |
| Bundle size | ~2KB gzip (core), ~1.9KB (@zod/mini) |
| MCP SDK | Required peer dependency |
| JSON Schema | `toJSONSchema()` built-in |
| Node.js compat | Any (zero native deps) |
| License | MIT |

## References

- npm: https://www.npmjs.com/package/zod
- GitHub: https://github.com/colinhacks/zod
- v4 announcement: https://www.infoq.com/news/2025/08/zod-v4-available/
- What's new in v4: https://basicutils.com/learn/zod/whats-new-in-zod-v4
- MCP SDK peer dep: https://www.npmjs.com/package/@modelcontextprotocol/sdk

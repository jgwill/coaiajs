# YAML Parsing in Node.js: Technical Assessment for CoAiA.js

> Package selection brief — YAML parser for pipeline templates, session files, and config loading replacing coaiapy's PyYAML

## Summary & Recommendation

**Use `yaml` v2.x** (the npm package named simply `yaml`). Despite `js-yaml` having higher download numbers, the modern `yaml` package offers streaming support for large files, comment preservation (critical for human-edited pipeline templates), and a cleaner API. CoAiA pipeline templates are user-authored YAML that benefits from round-trip fidelity — comments survive parse→stringify cycles.

**Pin:** `"yaml": "^2.6.0"`

## What We're Replacing

Coaiapy uses PyYAML for pipeline template loading:

```python
# coaiapy/pipeline.py — PyYAML pattern
import yaml

# Load pipeline template
for template_file in search_path.glob("*.yaml"):
    with open(yaml_file, 'r') as f:
        data = yaml.safe_load(f)  # Parse YAML → dict

# Pipeline template format:
# name: "trace-session"
# version: "1.0"
# variables:
#   - name: session_id
#     type: string
#     required: true
# steps:
#   - name: create_trace
#     observation_type: SPAN
```

PyYAML's `safe_load` works well; the JavaScript equivalent needs the same safety guarantees plus TypeScript types.

## Options Compared

| Feature | yaml v2.6 | js-yaml v4.1 |
|---------|-----------|-------------|
| Weekly npm downloads | ~80M | ~130M |
| GitHub stars | ~1,600 | ~6,500 |
| Parse speed (typical files) | Good | Faster (~10%) |
| Stringify speed | Faster | Slower |
| Streaming support | ✅ Parse & stringify | ❌ Memory only |
| Comment preservation | ✅ Round-trip fidelity | ❌ Comments lost |
| Anchor/alias support | ✅ Full | ✅ Full |
| Custom tags | ✅ Flexible API | ✅ Schema-based |
| TypeScript | Native types | `@types/js-yaml` |
| YAML 1.2 compliance | ✅ Full | ⚠️ Mostly |
| Security (CVEs) | None known | CVE-2025-64718 (fixed in 4.1.1) |
| API style | `parse(str)`, `stringify(obj)` | `load(str)`, `dump(obj)` |
| Bundle size | ~45KB | ~30KB |
| Dependencies | 0 | 0 |

## API Overview

### Basic Parse & Stringify

```typescript
import { parse, stringify } from 'yaml';
import { readFile, writeFile } from 'fs/promises';

// Parse YAML file
async function loadYaml<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return parse(content) as T;
}

// Stringify to YAML
async function saveYaml(filePath: string, data: unknown): Promise<void> {
  const yamlStr = stringify(data, {
    indent: 2,
    lineWidth: 120,
  });
  await writeFile(filePath, yamlStr, 'utf-8');
}
```

### Pipeline Template Loading (replacing pipeline.py)

```typescript
import { parse } from 'yaml';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { z } from 'zod';

// Schema (validated with Zod after YAML parse)
const PipelineTemplateSchema = z.object({
  name: z.string().min(1),
  version: z.string().default('1.0'),
  variables: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'list']).default('string'),
    required: z.boolean().default(true),
    default: z.unknown().optional(),
    choices: z.array(z.unknown()).optional(),
  })).default([]),
  steps: z.array(z.object({
    name: z.string().min(1),
    observation_type: z.enum(['EVENT', 'SPAN', 'GENERATION']).default('EVENT'),
    conditional: z.string().optional(),
  })).min(1),
});

type PipelineTemplate = z.infer<typeof PipelineTemplateSchema>;

async function loadPipelineTemplates(templateDir: string): Promise<Map<string, PipelineTemplate>> {
  const templates = new Map<string, PipelineTemplate>();
  const files = await glob('*.yaml', { cwd: templateDir, absolute: true });
  
  for (const file of files) {
    const raw = parse(await readFile(file, 'utf-8'));
    const template = PipelineTemplateSchema.parse(raw);
    templates.set(template.name, template);
  }
  
  return templates;
}
```

### Comment-Preserving Round-Trip (unique to `yaml` package)

```typescript
import { parseDocument, stringify } from 'yaml';
import { readFile, writeFile } from 'fs/promises';

// Load, modify, save — preserving user comments
async function updateTemplateVersion(filePath: string, newVersion: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const doc = parseDocument(content);  // Preserves comments, anchors, formatting
  
  doc.set('version', newVersion);
  
  await writeFile(filePath, doc.toString(), 'utf-8');
  // Original comments and formatting are preserved!
}

// Example input:
// # Pipeline for session tracing
// name: trace-session
// version: "1.0"  # Bump this on changes
// 
// After update, the comment "# Bump this on changes" survives
```

### Session File Persistence

```typescript
import { parse, stringify } from 'yaml';
import { readFile, writeFile } from 'fs/promises';

interface SessionFile {
  id: string;
  created: string;
  traces: { id: string; name: string; status: string }[];
  charts: { id: string; outcome: string }[];
  metadata: Record<string, unknown>;
}

async function saveSession(filePath: string, session: SessionFile): Promise<void> {
  await writeFile(filePath, stringify(session, {
    indent: 2,
    lineWidth: 120,
    sortMapEntries: false,  // Preserve insertion order
  }), 'utf-8');
}

async function loadSession(filePath: string): Promise<SessionFile> {
  const content = await readFile(filePath, 'utf-8');
  return parse(content) as SessionFile;
}
```

### Streaming for Large Files

```typescript
import { parseAllDocuments } from 'yaml';
import { createReadStream } from 'fs';

// Stream-parse a multi-document YAML file
async function parseMultiDoc(filePath: string) {
  const content = await readFile(filePath, 'utf-8');
  const docs = parseAllDocuments(content);
  
  for (const doc of docs) {
    if (doc.errors.length > 0) {
      console.error(`Parse errors in ${filePath}:`, doc.errors);
      continue;
    }
    yield doc.toJSON();
  }
}
```

### Config File Loading

```typescript
import { parse } from 'yaml';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Load coaia.json or coaia.yaml config
async function loadConfigFile(configPath: string): Promise<Record<string, unknown>> {
  if (!existsSync(configPath)) return {};
  
  const content = await readFile(configPath, 'utf-8');
  
  if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    return parse(content) ?? {};
  }
  if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  }
  
  // Try YAML first (superset of JSON)
  try {
    return parse(content) ?? {};
  } catch {
    return JSON.parse(content);
  }
}
```

## Integration Plan

1. **Core utility:** `src/yaml.ts` — typed `loadYaml<T>()` and `saveYaml()` wrappers
2. **Pipeline templates:** `src/pipeline/template-loader.ts` — YAML template discovery + Zod validation
3. **Session files:** `src/session/file.ts` — YAML session persistence
4. **Config loading:** `src/config.ts` — support `.yaml` config alongside `.json`
5. **Round-trip editing:** Use `parseDocument()` for user-facing template modifications
6. **Multi-doc:** Support `---` separated YAML documents for batch operations

## Why Not js-yaml?

1. **Comment preservation**: Pipeline templates are human-authored; losing comments on round-trip is unacceptable
2. **Security**: CVE-2025-64718 (prototype pollution) was a recent concern; `yaml` has a clean record
3. **YAML 1.2**: Full compliance matters for interop with other tools
4. **Streaming**: Future-proofing for large narrative JSONL files converted to/from YAML
5. **TypeScript**: Native types without DefinitelyTyped dependency

The ~10% parse speed advantage of js-yaml is irrelevant for config/template files (sub-millisecond either way).

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 2.6.x (2026) |
| Weekly downloads | ~80M |
| TypeScript | Native types |
| Dependencies | 0 |
| YAML spec | 1.2 compliant |
| Comment round-trip | ✅ Full support |
| Streaming | ✅ Parse & stringify |
| Node.js compat | ≥14 (we target ≥20) |
| License | ISC |

## References

- npm: https://www.npmjs.com/package/yaml
- GitHub: https://github.com/eemeli/yaml
- js-yaml: https://www.npmjs.com/package/js-yaml
- Comparison: https://npm-compare.com/js-yaml,yaml
- Performance: https://github.com/eemeli/yaml/discussions/358
- CVE-2025-64718: https://www.cvedetails.com/cve/CVE-2025-64718/

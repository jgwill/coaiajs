// coaiajs/src/pipeline/template-engine.ts — Pipeline template engine
// Port of coaiapy's pipeline.py + mobile_template.py

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import type { PipelineTemplate, PipelineStep, PipelineVariable } from '../types.js';

// ─── MobileTemplateEngine ───────────────────────────────────────────
// Lightweight template engine replacing Jinja2 for TypeScript

const VARIABLE_RE = /\{\{([^}]+)\}\}/g;
const CONDITION_RE = /\{%\s*if\s+([^%]+)%\}(.*?)\{%\s*endif\s*%\}/gs;

type BuiltinFn = () => string;

const BUILTIN_FUNCTIONS: Record<string, BuiltinFn> = {
  uuid4: () => uuidv4(),
  now: () => new Date().toISOString(),
  timestamp: () => new Date().toISOString(),
  mobile_id: () => `mobile_${uuidv4().slice(0, 8)}`,
  touch_timestamp: () => new Date().toLocaleTimeString('en-US', { hour12: false }),
};

export class MobileTemplateEngine {
  renderString(text: string, variables: Record<string, string>): string {
    if (!text) return '';
    let result = processConditionals(text, variables);
    result = processVariables(result, variables);
    return result;
  }

  renderDict(
    data: Record<string, unknown>,
    variables: Record<string, string>,
  ): Record<string, unknown> {
    if (!data || typeof data !== 'object') return data;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = this.renderString(value, variables);
      } else if (Array.isArray(value)) {
        result[key] = this.renderList(value, variables);
      } else if (value !== null && typeof value === 'object') {
        result[key] = this.renderDict(value as Record<string, unknown>, variables);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private renderList(data: unknown[], variables: Record<string, string>): unknown[] {
    return data.map((item) => {
      if (typeof item === 'string') return this.renderString(item, variables);
      if (Array.isArray(item)) return this.renderList(item, variables);
      if (item !== null && typeof item === 'object') {
        return this.renderDict(item as Record<string, unknown>, variables);
      }
      return item;
    });
  }
}

// ─── Template Processing ────────────────────────────────────────────

function processVariables(content: string, variables: Record<string, string>): string {
  return content.replace(VARIABLE_RE, (_match, expr: string) => {
    const trimmed = expr.trim();

    // Function calls: uuid4(), now(), etc.
    if (trimmed.endsWith('()')) {
      const fnName = trimmed.slice(0, -2);
      if (fnName in BUILTIN_FUNCTIONS) return BUILTIN_FUNCTIONS[fnName]();
    }

    // Filters: variable|title, variable|upper
    if (trimmed.includes('|')) {
      const [varName, filterName] = trimmed.split('|').map((s) => s.trim());
      const val = variables[varName];
      if (val !== undefined) return applyFilter(val, filterName);
      return `[${varName}]`;
    }

    // "variable or default" expressions
    if (trimmed.includes(' or ')) {
      const parts = trimmed.split(' or ').map((p) => p.trim());
      for (const part of parts) {
        const unquoted = part.replace(/^['"]|['"]$/g, '');
        if (part in variables && variables[part] != null) return variables[part];
        if (part.startsWith("'") || part.startsWith('"')) return unquoted;
      }
      return parts[parts.length - 1].replace(/^['"]|['"]$/g, '');
    }

    // Simple lookup
    if (trimmed in variables) return variables[trimmed] ?? '';
    return `[${trimmed}]`;
  });
}

function processConditionals(content: string, variables: Record<string, string>): string {
  return content.replace(CONDITION_RE, (_match, condition: string, body: string) => {
    return evaluateCondition(condition.trim(), variables) ? body : '';
  });
}

function evaluateCondition(condition: string, variables: Record<string, string>): boolean {
  if (condition.startsWith('not ')) {
    const varName = condition.slice(4).trim();
    return !isTruthy(variables[varName]);
  }
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    return String(variables[left] ?? left) === right;
  }
  if (condition.includes('!=')) {
    const [left, right] = condition.split('!=').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    return String(variables[left] ?? left) !== right;
  }
  return isTruthy(variables[condition]);
}

function isTruthy(value: unknown): boolean {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', 'no', 'off', 'disabled'].includes(value.toLowerCase());
  return Boolean(value);
}

function applyFilter(value: string, filter: string): string {
  switch (filter) {
    case 'title': return value.replace(/\b\w/g, (c) => c.toUpperCase());
    case 'upper': return value.toUpperCase();
    case 'lower': return value.toLowerCase();
    case 'capitalize': return value.charAt(0).toUpperCase() + value.slice(1);
    case 'strip': return value.trim();
    default: return value;
  }
}

// ─── TemplateLoader ─────────────────────────────────────────────────

export class TemplateLoader {
  private searchPaths: string[];

  constructor() {
    this.searchPaths = this.getSearchPaths();
  }

  private getSearchPaths(): string[] {
    const paths: string[] = [];
    const projectPath = join(process.cwd(), '.coaia', 'templates');
    if (existsSync(projectPath)) paths.push(projectPath);

    const userPath = join(homedir(), '.coaia', 'templates');
    if (existsSync(userPath)) paths.push(userPath);

    return paths;
  }

  listTemplates(includePath = false): Array<Record<string, unknown>> {
    const templates: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    for (const searchPath of this.searchPaths) {
      if (!existsSync(searchPath)) continue;

      for (const file of readdirSync(searchPath)) {
        const ext = extname(file);
        if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') continue;

        const stem = file.replace(ext, '');
        if (seen.has(stem)) continue;

        try {
          const template = this.loadTemplate(stem);
          if (template) {
            const info: Record<string, unknown> = {
              name: template.name,
              description: template.description,
              version: template.version,
              author: template.author,
            };
            if (includePath) info.path = join(searchPath, file);
            templates.push(info);
            seen.add(stem);
          }
        } catch {
          continue;
        }
      }
    }

    return templates;
  }

  loadTemplate(name: string): PipelineTemplate | null {
    for (const searchPath of this.searchPaths) {
      // Try JSON
      const jsonFile = join(searchPath, `${name}.json`);
      if (existsSync(jsonFile)) {
        try {
          const data = JSON.parse(readFileSync(jsonFile, 'utf-8'));
          return parsePipelineTemplate(data);
        } catch { continue; }
      }

      // Try YAML
      for (const ext of ['.yaml', '.yml']) {
        const yamlFile = join(searchPath, `${name}${ext}`);
        if (existsSync(yamlFile)) {
          try {
            const data = yaml.load(readFileSync(yamlFile, 'utf-8')) as Record<string, unknown>;
            return parsePipelineTemplate(data);
          } catch { continue; }
        }
      }
    }
    return null;
  }

  saveTemplate(template: PipelineTemplate, location: 'user' | 'project' = 'user'): void {
    const savePath = location === 'project'
      ? join(process.cwd(), '.coaia', 'templates')
      : join(homedir(), '.coaia', 'templates');

    mkdirSync(savePath, { recursive: true });

    const data = serializePipelineTemplate(template);
    if (!data.createdAt) data.createdAt = new Date().toISOString();

    const filePath = join(savePath, `${template.name}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// ─── TemplateRenderer ───────────────────────────────────────────────

export class TemplateRenderer {
  private engine = new MobileTemplateEngine();

  renderTemplate(
    template: PipelineTemplate,
    variables: Record<string, string>,
  ): PipelineStep[] {
    const errors = validateVariables(template, variables);
    if (errors.length) throw new Error(`Template validation failed: ${errors.join('; ')}`);

    const finalVars = mergeDefaults(template, variables);
    const rendered: PipelineStep[] = [];

    for (const step of template.steps) {
      if (step.conditional) {
        const expanded = this.engine.renderString(step.conditional, finalVars);
        if (!expanded.trim()) continue;
      }

      rendered.push({
        name: this.engine.renderString(step.name, finalVars),
        observationType: step.observationType,
        description: step.description ? this.engine.renderString(step.description, finalVars) : undefined,
        parent: step.parent ? this.engine.renderString(step.parent, finalVars) : undefined,
        variables: step.variables
          ? this.engine.renderDict(step.variables as Record<string, unknown>, finalVars) as Record<string, string>
          : undefined,
        metadata: step.metadata
          ? this.engine.renderDict(step.metadata, finalVars) as Record<string, unknown>
          : undefined,
      });
    }

    return rendered;
  }

  renderWithJudgeIntegration(
    template: PipelineTemplate,
    variables: Record<string, string>,
    enableJudge = false,
  ): PipelineStep[] {
    const observations = this.renderTemplate(template, variables);

    if (!enableJudge) return observations;

    return observations.map((obs) => {
      const name = (obs.name ?? '').toLowerCase();
      const desc = (obs.description ?? '').toLowerCase();
      const indicators = ['judge', 'evaluation', 'assess', 'scoring', 'rating'];
      const isJudge = indicators.some((i) => name.includes(i) || desc.includes(i));

      if (isJudge) {
        return {
          ...obs,
          metadata: {
            ...obs.metadata,
            judge_integration_ready: true,
            judge_api_placeholder: true,
          },
        };
      }
      return obs;
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function parsePipelineTemplate(data: Record<string, unknown>): PipelineTemplate {
  return {
    name: String(data.name),
    version: String(data.version ?? '1.0'),
    description: String(data.description ?? ''),
    author: data.author as string | undefined,
    createdAt: data.created_at as string | undefined ?? data.createdAt as string | undefined,
    variables: ((data.variables ?? []) as Array<Record<string, unknown>>).map((v) => ({
      name: String(v.name),
      type: String(v.type ?? 'string'),
      required: v.required !== false,
      default: v.default as string | undefined,
      description: v.description as string | undefined,
      choices: v.choices as string[] | undefined,
    })),
    steps: ((data.steps ?? []) as Array<Record<string, unknown>>).map((s) => ({
      name: String(s.name),
      observationType: String(s.observation_type ?? s.observationType ?? 'EVENT'),
      description: s.description as string | undefined,
      parent: s.parent as string | undefined,
      variables: (s.variables ?? {}) as Record<string, string>,
      metadata: (s.metadata ?? {}) as Record<string, unknown>,
      conditional: s.conditional as string | undefined,
    })),
    extends: data.extends as string | undefined,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

function serializePipelineTemplate(t: PipelineTemplate): Record<string, unknown> {
  return {
    name: t.name,
    version: t.version,
    description: t.description,
    author: t.author,
    createdAt: t.createdAt,
    extends: t.extends,
    metadata: t.metadata,
    variables: (t.variables ?? []).map((v: PipelineVariable) => ({
      name: v.name,
      type: v.type,
      required: v.required,
      default: v.default,
      description: v.description,
      choices: v.choices,
    })),
    steps: (t.steps ?? []).map((s: PipelineStep) => ({
      name: s.name,
      observation_type: s.observationType,
      description: s.description,
      parent: s.parent,
      variables: s.variables,
      metadata: s.metadata,
      conditional: s.conditional,
    })),
  };
}

function validateVariables(
  template: PipelineTemplate,
  provided: Record<string, string>,
): string[] {
  const errors: string[] = [];
  for (const v of template.variables ?? []) {
    if (v.required && v.default == null && !(v.name in provided)) {
      errors.push(`Required variable '${v.name}' not provided`);
    }
    if (v.choices && v.name in provided && !v.choices.includes(provided[v.name])) {
      errors.push(`Variable '${v.name}' must be one of: ${v.choices.join(', ')}`);
    }
  }
  return errors;
}

function mergeDefaults(
  template: PipelineTemplate,
  provided: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of template.variables ?? []) {
    if (v.name in provided) {
      result[v.name] = provided[v.name];
    } else if (v.default != null) {
      result[v.name] = String(v.default);
    }
  }
  return result;
}

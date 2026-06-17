#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { tash, fetch as redisFetch, keys as redisKeys, disconnect as redisDisconnect } from './redis.js';
import { readConfig, getConfig } from './config.js';
import { llm as llmCall, transcribeAudio, abstractProcess } from './llm.js';
import { listIssues, getIssue } from './github.js';
import { createEnvironment, findEnvironment } from './environment.js';
import {
  formatTable, formatJson, formatError, formatSuccess,
  truncate, formatDate, formatProgress, setColorEnabled,
} from './cli-helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalOpts {
  env?: string;
  memoryPath?: string;
  color: boolean;
  json: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = Record<string, (...args: any[]) => any>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadModule(name: string): Promise<AnyModule> {
  const paths: Record<string, string> = {
    langfuse: './langfuse/index.js',
    narrative: './narrative/index.js',
    pde: './pde/index.js',
    planning: './planning/index.js',
    pipeline: './pipeline/index.js',
  };
  const p = paths[name];
  if (!p) throw new Error(`Unknown module: ${name}`);
  try {
    return (await import(p)) as AnyModule;
  } catch {
    throw new Error(`Module '${name}' is not yet implemented. Expected at ${p}`);
  }
}

async function callModule(moduleName: string, funcName: string, ...args: unknown[]): Promise<unknown> {
  const mod = await loadModule(moduleName);
  const fn = mod[funcName];
  if (typeof fn !== 'function') {
    throw new Error(`${moduleName}.${funcName} is not available`);
  }
  return fn(...args);
}

function globals(cmd: Command): GlobalOpts {
  return cmd.optsWithGlobals() as GlobalOpts;
}

function output(data: unknown, cmd: Command): void {
  if (globals(cmd).json) {
    console.log(formatJson(data));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(formatJson(data));
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  return chunks.join('');
}

function resolveText(
  positional: string | undefined,
  opts: { file?: string },
): string | undefined {
  if (opts.file) return readFileSync(resolve(opts.file), 'utf-8');
  return positional;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actionHandler(
  fn: (...args: any[]) => Promise<void>,
): (...args: any[]) => Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(formatError(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  };
}

// ---------------------------------------------------------------------------
// Root commands
// ---------------------------------------------------------------------------

function registerRootCommands(program: Command): void {
  // ── tash ─────────────────────────────────────────────────────────────
  program
    .command('tash')
    .alias('m')
    .description('Store a key-value pair in Redis')
    .argument('<key>', 'Redis key')
    .argument('[value]', 'Value to store')
    .option('--file <path>', 'Read value from file')
    .option('--ttl <seconds>', 'Time to live in seconds', parseInt)
    .option('--verbose', 'Verbose output')
    .action(
      actionHandler(async (key: string, value: string | undefined, opts: { file?: string; ttl?: number; verbose?: boolean }, cmd: Command) => {
        const val = resolveText(value, opts);
        if (!val) {
          console.error(formatError('Value required — provide as argument or with --file'));
          process.exit(1);
        }
        await tash(key, val, opts.ttl);
        if (opts.verbose) {
          console.log(formatSuccess(`Stored ${key} (${val.length} bytes${opts.ttl ? `, ttl=${opts.ttl}s` : ''})`));
        } else {
          console.log(formatSuccess(`Stored ${key}`));
        }
      }),
    );

  // ── fetch ────────────────────────────────────────────────────────────
  program
    .command('fetch')
    .description('Get a value from Redis')
    .argument('<key>', 'Redis key')
    .option('--output <path>', 'Write result to file')
    .option('--verbose', 'Verbose output')
    .action(
      actionHandler(async (key: string, opts: { output?: string; verbose?: boolean }, cmd: Command) => {
        const result = await redisFetch(key);
        if (result === null) {
          console.error(formatError(`Key not found: ${key}`));
          process.exit(1);
        }
        if (opts.output) {
          writeFileSync(resolve(opts.output), result);
          console.log(formatSuccess(`Written to ${opts.output}`));
        } else {
          output(result, cmd);
        }
      }),
    );

  // ── transcribe ───────────────────────────────────────────────────────
  program
    .command('transcribe')
    .alias('t')
    .description('Transcribe audio via Whisper')
    .argument('<file>', 'Audio file path')
    .option('--output <path>', 'Write transcript to file')
    .action(
      actionHandler(async (file: string, opts: { output?: string }, cmd: Command) => {
        const result = await transcribeAudio(resolve(file));
        if (opts.output) {
          writeFileSync(resolve(opts.output), result);
          console.log(formatSuccess(`Transcript written to ${opts.output}`));
        } else {
          output(result, cmd);
        }
      }),
    );

  // ── summarize ────────────────────────────────────────────────────────
  program
    .command('summarize')
    .alias('s')
    .description('Summarize text')
    .argument('[text]', 'Text to summarize')
    .option('--output <path>', 'Write summary to file')
    .option('--file <path>', 'Read text from file')
    .action(
      actionHandler(async (text: string | undefined, opts: { output?: string; file?: string }, cmd: Command) => {
        let input = resolveText(text, opts);
        if (!input) input = await readStdin();
        if (!input) {
          console.error(formatError('Text required — provide as argument, --file, or pipe via stdin'));
          process.exit(1);
        }
        const result = await abstractProcess('summarize', input);
        if (opts.output) {
          writeFileSync(resolve(opts.output), result);
          console.log(formatSuccess(`Summary written to ${opts.output}`));
        } else {
          output(result, cmd);
        }
      }),
    );

  // ── p (process) ──────────────────────────────────────────────────────
  program
    .command('p')
    .description('Process text with a custom tag')
    .argument('<tag>', 'Processing tag')
    .argument('[text]', 'Text to process')
    .option('--output <path>', 'Write result to file')
    .option('--file <path>', 'Read text from file')
    .action(
      actionHandler(async (tag: string, text: string | undefined, opts: { output?: string; file?: string }, cmd: Command) => {
        let input = resolveText(text, opts);
        if (!input) input = await readStdin();
        if (!input) {
          console.error(formatError('Text required — provide as argument, --file, or pipe via stdin'));
          process.exit(1);
        }
        const result = await abstractProcess(tag, input);
        if (opts.output) {
          writeFileSync(resolve(opts.output), result);
          console.log(formatSuccess(`Result written to ${opts.output}`));
        } else {
          output(result, cmd);
        }
      }),
    );

  // ── init ─────────────────────────────────────────────────────────────
  program
    .command('init')
    .description('Create a sample coaia.json config')
    .action(
      actionHandler(async () => {
        const target = resolve('coaia.json');
        if (existsSync(target)) {
          console.error(formatError('coaia.json already exists'));
          process.exit(1);
        }
        const sample = {
          redis: { url: 'redis://localhost:6379' },
          langfuse: { publicKey: '', secretKey: '', baseUrl: 'https://cloud.langfuse.com' },
          openai: { apiKey: '', model: 'gpt-4o-mini' },
          github: { token: '' },
        };
        writeFileSync(target, JSON.stringify(sample, null, 2) + '\n');
        console.log(formatSuccess('Created coaia.json'));
      }),
    );

  // ── llm ──────────────────────────────────────────────────────────────
  program
    .command('llm')
    .description('Make a raw LLM call')
    .argument('<user>', 'User message')
    .argument('[system]', 'System message')
    .option('--temperature <n>', 'Temperature (0-2)', parseFloat)
    .action(
      actionHandler(async (user: string, system: string | undefined, opts: { temperature?: number }, cmd: Command) => {
        const result = await llmCall(user, system, opts.temperature);
        output(result, cmd);
      }),
    );
}

// ---------------------------------------------------------------------------
// Fuse (Langfuse) commands
// ---------------------------------------------------------------------------

function registerFuseCommands(program: Command): void {
  const fuse = program
    .command('fuse')
    .description('Langfuse operations');

  // ── comments ─────────────────────────────────────────────────────────
  const comments = fuse.command('comments').description('Comment operations');

  comments
    .command('list')
    .description('List comments')
    .option('--trace-id <id>', 'Filter by trace ID')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listComments', opts);
      output(result, cmd);
    }));

  comments
    .command('post')
    .description('Post a comment')
    .option('--trace-id <id>', 'Trace ID')
    .option('--content <text>', 'Comment content')
    .option('--author <name>', 'Author name')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'postComment', opts);
      output(result, cmd);
    }));

  // ── prompts ──────────────────────────────────────────────────────────
  const prompts = fuse.command('prompts').description('Prompt management');

  prompts
    .command('list')
    .description('List prompts')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listPrompts', opts);
      output(result, cmd);
    }));

  prompts
    .command('get')
    .description('Get a prompt')
    .argument('<name>', 'Prompt name')
    .option('--version <n>', 'Prompt version', parseInt)
    .action(actionHandler(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'getPrompt', name, opts);
      output(result, cmd);
    }));

  prompts
    .command('create')
    .description('Create a prompt')
    .option('--name <name>', 'Prompt name')
    .option('--prompt <text>', 'Prompt text')
    .option('--model <model>', 'Model name')
    .option('--config <json>', 'Config JSON')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createPrompt', opts);
      output(result, cmd);
    }));

  // ── datasets ─────────────────────────────────────────────────────────
  const datasets = fuse.command('datasets').description('Dataset management');

  datasets
    .command('list')
    .description('List datasets')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listDatasets', opts);
      output(result, cmd);
    }));

  datasets
    .command('get')
    .description('Get a dataset')
    .argument('<name>', 'Dataset name')
    .action(actionHandler(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'getDataset', name);
      output(result, cmd);
    }));

  datasets
    .command('create')
    .description('Create a dataset')
    .option('--name <name>', 'Dataset name')
    .option('--description <text>', 'Description')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createDataset', opts);
      output(result, cmd);
    }));

  // ── sessions ─────────────────────────────────────────────────────────
  const sessions = fuse.command('sessions').description('Session management');

  sessions
    .command('create')
    .description('Create a session')
    .option('--id <id>', 'Session ID')
    .option('--project-id <id>', 'Project ID')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createSession', opts);
      output(result, cmd);
    }));

  sessions
    .command('addnode')
    .description('Add a node to a session')
    .option('--session-id <id>', 'Session ID')
    .option('--trace-id <id>', 'Trace ID')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'addSessionNode', opts);
      output(result, cmd);
    }));

  sessions
    .command('view')
    .description('View a session')
    .argument('<sessionId>', 'Session ID')
    .action(actionHandler(async (sessionId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'viewSession', sessionId);
      output(result, cmd);
    }));

  // ── scores ───────────────────────────────────────────────────────────
  const scores = fuse.command('scores').alias('sc').description('Score management');

  scores
    .command('create')
    .description('Create a score')
    .option('--name <name>', 'Score name')
    .option('--trace-id <id>', 'Trace ID')
    .option('--observation-id <id>', 'Observation ID')
    .option('--value <n>', 'Score value', parseFloat)
    .option('--data-type <type>', 'Data type (NUMERIC|CATEGORICAL|BOOLEAN)')
    .option('--comment <text>', 'Comment')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createScore', opts);
      output(result, cmd);
    }));

  scores
    .command('apply')
    .description('Apply a score config')
    .option('--config <name>', 'Score config name')
    .option('--trace-id <id>', 'Trace ID')
    .option('--value <n>', 'Score value', parseFloat)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'applyScore', opts);
      output(result, cmd);
    }));

  scores
    .command('list')
    .description('List scores')
    .option('--trace-id <id>', 'Filter by trace ID')
    .option('--name <name>', 'Filter by name')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listScores', opts);
      output(result, cmd);
    }));

  // ── score-configs ────────────────────────────────────────────────────
  const scc = fuse.command('score-configs').alias('scc').description('Score config management');

  scc
    .command('list')
    .description('List score configs')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listScoreConfigs', opts);
      output(result, cmd);
    }));

  scc
    .command('get')
    .description('Get a score config')
    .argument('<name>', 'Config name')
    .action(actionHandler(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'getScoreConfig', name);
      output(result, cmd);
    }));

  scc
    .command('create')
    .description('Create a score config')
    .option('--name <name>', 'Config name')
    .option('--data-type <type>', 'NUMERIC | CATEGORICAL | BOOLEAN')
    .option('--description <text>', 'Description')
    .option('--min <n>', 'Min value (NUMERIC)', parseFloat)
    .option('--max <n>', 'Max value (NUMERIC)', parseFloat)
    .option('--categories <json>', 'Categories JSON (CATEGORICAL)')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createScoreConfig', opts);
      output(result, cmd);
    }));

  scc
    .command('export')
    .description('Export score configs')
    .option('--output <path>', 'Output file path')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'exportScoreConfigs', opts);
      output(result, cmd);
    }));

  scc
    .command('import')
    .description('Import score configs')
    .argument('<path>', 'Config file path')
    .action(actionHandler(async (path: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'importScoreConfigs', resolve(path));
      output(result, cmd);
    }));

  scc
    .command('presets')
    .description('List available presets')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listScoreConfigPresets');
      output(result, cmd);
    }));

  scc
    .command('apply')
    .description('Apply a preset')
    .argument('<preset>', 'Preset name')
    .action(actionHandler(async (preset: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'applyScoreConfigPreset', preset);
      output(result, cmd);
    }));

  scc
    .command('available')
    .description('Show available score types')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'availableScoreTypes');
      output(result, cmd);
    }));

  scc
    .command('show')
    .description('Show a score config in detail')
    .argument('<name>', 'Config name')
    .action(actionHandler(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'showScoreConfig', name);
      output(result, cmd);
    }));

  // ── traces ───────────────────────────────────────────────────────────
  const traces = fuse.command('traces').description('Trace operations');

  traces
    .command('list')
    .description('List traces with optional filters')
    .option('--session-id <id>', 'Filter by session ID')
    .option('--user-id <id>', 'Filter by user ID')
    .option('--name <name>', 'Filter by trace name')
    .option('--tags <tags>', 'Comma-separated tags to filter by')
    .option('--from <timestamp>', 'From timestamp (ISO 8601)')
    .option('--to <timestamp>', 'To timestamp (ISO 8601)')
    .option('--order-by <field>', 'Order by field')
    .option('--page <n>', 'Page number', parseInt)
    .option('--limit <n>', 'Items per page (default 50)', parseInt)
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const filters = {
        sessionId:     opts.sessionId as string | undefined,
        userId:        opts.userId as string | undefined,
        name:          opts.name as string | undefined,
        tags:          opts.tags ? (opts.tags as string).split(',').map((t: string) => t.trim()) : undefined,
        fromTimestamp: opts.from as string | undefined,
        toTimestamp:   opts.to as string | undefined,
        orderBy:       opts.orderBy as string | undefined,
        page:          opts.page as number | undefined,
        limit:         opts.limit as number | undefined,
      };
      const raw = await callModule('langfuse', 'listTraces', filters) as string;
      if (globals(cmd).json) {
        console.log(raw);
      } else {
        const formatted = await callModule('langfuse', 'formatTracesMarkdown', raw);
        console.log(formatted);
      }
    }));

  traces
    .command('create')
    .description('Create a trace')
    .option('--name <name>', 'Trace name')
    .option('--session-id <id>', 'Session ID')
    .option('--input <json>', 'Input JSON')
    .option('--metadata <json>', 'Metadata JSON')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createTrace', opts);
      output(result, cmd);
    }));

  traces
    .command('add-observation')
    .description('Add an observation to a trace')
    .option('--trace-id <id>', 'Trace ID')
    .option('--name <name>', 'Observation name')
    .option('--type <type>', 'Type: generation | span | event')
    .option('--input <json>', 'Input JSON')
    .option('--output <json>', 'Output JSON')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'addObservation', opts);
      output(result, cmd);
    }));

  traces
    .command('add-observations')
    .description('Add multiple observations from a file')
    .option('--trace-id <id>', 'Trace ID')
    .option('--file <path>', 'JSON file with observations')
    .action(actionHandler(async (opts: { traceId?: string; file?: string }, cmd: Command) => {
      let data: unknown = opts;
      if (opts.file) {
        const raw = readFileSync(resolve(opts.file), 'utf-8');
        data = { traceId: opts.traceId, observations: JSON.parse(raw) };
      }
      const result = await callModule('langfuse', 'addObservations', data);
      output(result, cmd);
    }));

  traces
    .command('patch-output')
    .description('Patch trace output')
    .option('--trace-id <id>', 'Trace ID')
    .option('--output <json>', 'Output JSON')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'patchTraceOutput', opts);
      output(result, cmd);
    }));

  traces
    .command('session-view')
    .description('View traces by session')
    .argument('<sessionId>', 'Session ID')
    .action(actionHandler(async (sessionId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'sessionView', sessionId);
      output(result, cmd);
    }));

  traces
    .command('trace-view')
    .description('View a specific trace')
    .argument('<traceId>', 'Trace ID')
    .action(actionHandler(async (traceId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'traceView', traceId);
      output(result, cmd);
    }));

  traces
    .command('get-observation')
    .description('Get an observation')
    .argument('<observationId>', 'Observation ID')
    .action(actionHandler(async (observationId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'getObservation', observationId);
      output(result, cmd);
    }));

  // ── projects ─────────────────────────────────────────────────────────
  fuse
    .command('projects')
    .description('List projects')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'listProjects');
      output(result, cmd);
    }));

  // ── media ────────────────────────────────────────────────────────────
  const media = fuse.command('media').description('Media operations');

  media
    .command('upload')
    .description('Upload a media file')
    .argument('<file>', 'File path')
    .option('--trace-id <id>', 'Associate with trace')
    .action(actionHandler(async (file: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'uploadMedia', resolve(file), opts);
      output(result, cmd);
    }));

  media
    .command('get')
    .description('Get media details')
    .argument('<mediaId>', 'Media ID')
    .action(actionHandler(async (mediaId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'getMedia', mediaId);
      output(result, cmd);
    }));

  // ── dataset-items ────────────────────────────────────────────────────
  const datasetItems = fuse.command('dataset-items').description('Dataset item operations');

  datasetItems
    .command('create')
    .description('Create a dataset item')
    .option('--dataset <name>', 'Dataset name')
    .option('--input <json>', 'Input JSON')
    .option('--expected <json>', 'Expected output JSON')
    .option('--metadata <json>', 'Metadata JSON')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('langfuse', 'createDatasetItem', opts);
      output(result, cmd);
    }));
}

// ---------------------------------------------------------------------------
// Pipeline commands
// ---------------------------------------------------------------------------

function registerPipelineCommands(program: Command): void {
  const pipeline = program
    .command('pipeline')
    .description('Pipeline template operations');

  pipeline
    .command('list')
    .description('List pipeline templates')
    .option('--path <dir>', 'Templates directory')
    .option('--json', 'JSON output')
    .action(actionHandler(async (opts: { path?: string; json?: boolean }, cmd: Command) => {
      const result = await callModule('pipeline', 'listTemplates', opts);
      output(result, cmd);
    }));

  pipeline
    .command('show')
    .description('Show a pipeline template')
    .argument('<name>', 'Template name')
    .option('--preview', 'Preview rendered template')
    .action(actionHandler(async (name: string, opts: { preview?: boolean }, cmd: Command) => {
      const result = await callModule('pipeline', 'showTemplate', name, opts);
      output(result, cmd);
    }));

  pipeline
    .command('create')
    .description('Create a run from template')
    .argument('<name>', 'Template name')
    .option(
      '--var <pair>',
      'Template variable (KEY=value), repeatable',
      (val: string, list: string[]) => { list.push(val); return list; },
      [] as string[],
    )
    .option('--trace-id <id>', 'Trace ID')
    .option('--session-id <id>', 'Session ID')
    .option('--dry-run', 'Preview without executing')
    .action(actionHandler(async (name: string, opts: { var: string[]; traceId?: string; sessionId?: string; dryRun?: boolean }, cmd: Command) => {
      const vars: Record<string, string> = {};
      for (const pair of opts.var) {
        const eq = pair.indexOf('=');
        if (eq === -1) { console.error(formatError(`Invalid --var format: ${pair} (expected KEY=value)`)); process.exit(1); }
        vars[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      const result = await callModule('pipeline', 'createFromTemplate', name, {
        variables: vars,
        traceId: opts.traceId,
        sessionId: opts.sessionId,
        dryRun: opts.dryRun,
      });
      output(result, cmd);
    }));

  pipeline
    .command('init')
    .description('Create a new pipeline template')
    .argument('<name>', 'Template name')
    .action(actionHandler(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('pipeline', 'initTemplate', name);
      output(result, cmd);
    }));
}

// ---------------------------------------------------------------------------
// Environment commands
// ---------------------------------------------------------------------------

function registerEnvCommands(program: Command): void {
  const env = program
    .command('env')
    .description('Environment variable management');

  env
    .command('init')
    .description('Initialize environment file')
    .action(actionHandler(async () => {
      const mgr = createEnvironment();
      mgr.init();
      console.log(formatSuccess(`Initialized ${mgr.getFilePath()}`));
    }));

  env
    .command('list')
    .description('List environment variables')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const mgr = findEnvironment();
      const vars = mgr.list();
      if (globals(cmd).json) {
        console.log(formatJson(vars));
      } else {
        const entries = Object.entries(vars);
        if (entries.length === 0) {
          console.log('(no variables set)');
        } else {
          console.log(formatTable(
            ['Key', 'Value'],
            entries.map(([k, v]) => [k, truncate(v, 60)]),
          ));
        }
      }
    }));

  env
    .command('source')
    .description('Load env vars into process')
    .action(actionHandler(async () => {
      const mgr = findEnvironment();
      mgr.source();
      console.log(formatSuccess('Environment loaded'));
    }));

  env
    .command('set')
    .description('Set an environment variable')
    .argument('<key>', 'Variable name')
    .argument('<value>', 'Variable value')
    .action(actionHandler(async (key: string, value: string) => {
      const mgr = findEnvironment();
      mgr.set(key, value);
      console.log(formatSuccess(`Set ${key}`));
    }));

  env
    .command('get')
    .description('Get an environment variable')
    .argument('<key>', 'Variable name')
    .action(actionHandler(async (key: string, opts: Record<string, unknown>, cmd: Command) => {
      const mgr = findEnvironment();
      const value = mgr.get(key);
      if (value === undefined) {
        console.error(formatError(`Variable not set: ${key}`));
        process.exit(1);
      }
      output(value, cmd);
    }));

  env
    .command('unset')
    .description('Remove an environment variable')
    .argument('<key>', 'Variable name')
    .action(actionHandler(async (key: string) => {
      const mgr = findEnvironment();
      mgr.unset(key);
      console.log(formatSuccess(`Unset ${key}`));
    }));

  env
    .command('clear')
    .description('Remove environment file')
    .action(actionHandler(async () => {
      const mgr = findEnvironment();
      mgr.clear();
      console.log(formatSuccess('Environment cleared'));
    }));

  env
    .command('save')
    .description('Save current context')
    .action(actionHandler(async () => {
      const mgr = findEnvironment();
      mgr.save();
      console.log(formatSuccess(`Saved to ${mgr.getFilePath()}`));
    }));
}

// ---------------------------------------------------------------------------
// GitHub commands
// ---------------------------------------------------------------------------

function registerGhCommands(program: Command): void {
  const gh = program
    .command('gh')
    .description('GitHub operations');

  const issues = gh.command('issues').description('Issue operations');

  issues
    .command('list')
    .description('List issues')
    .requiredOption('--owner <owner>', 'Repository owner')
    .requiredOption('--repo <repo>', 'Repository name')
    .option('--state <state>', 'Filter: open | closed | all', 'open')
    .option('--labels <labels>', 'Comma-separated labels')
    .option('--per-page <n>', 'Results per page', parseInt)
    .action(actionHandler(async (opts: { owner: string; repo: string; state?: string; labels?: string; perPage?: number }, cmd: Command) => {
      const result = await listIssues(opts.owner, opts.repo, {
        state: opts.state as 'open' | 'closed' | 'all' | undefined,
        labels: opts.labels,
        per_page: opts.perPage,
      });
      if (globals(cmd).json) {
        console.log(formatJson(result));
      } else {
        console.log(formatTable(
          ['#', 'State', 'Title', 'Labels', 'Updated'],
          result.map(i => [
            String(i.number),
            i.state,
            truncate(i.title, 50),
            i.labels.map(l => l.name).join(', '),
            formatDate(i.updated_at),
          ]),
        ));
      }
    }));

  issues
    .command('get')
    .description('Get an issue (owner/repo#123 or number with --owner/--repo)')
    .argument('<spec>', 'Issue spec: owner/repo#123 or issue number')
    .option('--owner <owner>', 'Repository owner')
    .option('--repo <repo>', 'Repository name')
    .action(actionHandler(async (spec: string, opts: { owner?: string; repo?: string }, cmd: Command) => {
      let owner = opts.owner;
      let repo = opts.repo;
      let num: number;

      const match = spec.match(/^([^/]+)\/([^#]+)#(\d+)$/);
      if (match) {
        owner = match[1];
        repo = match[2];
        num = parseInt(match[3]!, 10);
      } else {
        num = parseInt(spec, 10);
        if (isNaN(num) || !owner || !repo) {
          console.error(formatError('Provide owner/repo#number or a number with --owner and --repo'));
          process.exit(1);
        }
      }

      const issue = await getIssue(owner!, repo!, num);
      if (globals(cmd).json) {
        console.log(formatJson(issue));
      } else {
        console.log([
          `${chalk.bold(`#${issue.number}`)} ${issue.title}`,
          `State: ${issue.state}  Author: ${issue.user?.login ?? '?'}`,
          `Labels: ${issue.labels.map(l => l.name).join(', ') || '(none)'}`,
          `URL: ${issue.html_url}`,
          '',
          issue.body ?? '(no body)',
        ].join('\n'));
      }
    }));
}

// ---------------------------------------------------------------------------
// Narrative commands
// ---------------------------------------------------------------------------

function registerNarrativeCommands(program: Command): void {
  const narr = program
    .command('narrative')
    .alias('n')
    .description('Structural tension narrative operations');

  narr
    .command('list')
    .alias('ls')
    .description('List active charts')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'listCharts', globals(cmd));
      output(result, cmd);
    }));

  narr
    .command('view')
    .alias('v')
    .description('View chart details')
    .argument('<chartId>', 'Chart ID')
    .action(actionHandler(async (chartId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'viewChart', chartId, globals(cmd));
      output(result, cmd);
    }));

  narr
    .command('current')
    .alias('cur')
    .description('Show or set the current chart')
    .argument('[chartId]', 'Chart ID to set as current')
    .action(actionHandler(async (chartId: string | undefined, opts: Record<string, unknown>, cmd: Command) => {
      if (chartId) {
        await callModule('narrative', 'setCurrentChart', chartId);
        console.log(formatSuccess(`Current chart set to ${chartId}`));
      } else {
        const result = await callModule('narrative', 'getCurrentChart');
        output(result, cmd);
      }
    }));

  narr
    .command('update')
    .alias('up')
    .description('Update a chart')
    .argument('<chartId>', 'Chart ID')
    .option('--desired-outcome <text>', 'New desired outcome')
    .option('--current-reality <text>', 'New current reality observation')
    .action(actionHandler(async (chartId: string, opts: { desiredOutcome?: string; currentReality?: string }, cmd: Command) => {
      const result = await callModule('narrative', 'updateChart', chartId, opts);
      output(result, cmd);
    }));

  narr
    .command('add-action')
    .alias('aa')
    .description('Add an action step to a chart')
    .argument('<chartId>', 'Chart ID')
    .option('--title <text>', 'Action step title')
    .option('--current-reality <text>', 'Current reality for this step')
    .option('--due <date>', 'Due date (ISO)')
    .action(actionHandler(async (chartId: string, opts: { title?: string; currentReality?: string; due?: string }, cmd: Command) => {
      const result = await callModule('narrative', 'addAction', chartId, opts);
      output(result, cmd);
    }));

  narr
    .command('add-obs')
    .alias('ao')
    .description('Add an observation to a chart')
    .argument('<chartId>', 'Chart ID')
    .argument('[text...]', 'Observation text')
    .action(actionHandler(async (chartId: string, text: string[], opts: Record<string, unknown>, cmd: Command) => {
      const observation = text.join(' ');
      if (!observation) {
        console.error(formatError('Observation text required'));
        process.exit(1);
      }
      const result = await callModule('narrative', 'addObservation', chartId, observation);
      output(result, cmd);
    }));

  narr
    .command('complete')
    .alias('done')
    .description('Mark an action step complete')
    .argument('<actionName>', 'Action step name')
    .action(actionHandler(async (actionName: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'completeAction', actionName);
      if (typeof result === 'string') console.log(formatSuccess(result));
      else output(result, cmd);
    }));

  narr
    .command('export')
    .alias('exp')
    .description('Export a chart to markdown')
    .argument('<chartId>', 'Chart ID')
    .option('--output <path>', 'Output file path')
    .action(actionHandler(async (chartId: string, opts: { output?: string }, cmd: Command) => {
      const result = await callModule('narrative', 'exportChart', chartId) as string;
      if (opts.output) {
        writeFileSync(resolve(opts.output), result);
        console.log(formatSuccess(`Exported to ${opts.output}`));
      } else {
        console.log(result);
      }
    }));

  narr
    .command('export-all')
    .description('Export all charts to markdown')
    .option('--output <dir>', 'Output directory')
    .action(actionHandler(async (opts: { output?: string }, cmd: Command) => {
      const result = await callModule('narrative', 'exportAllCharts', opts);
      output(result, cmd);
    }));

  narr
    .command('stats')
    .alias('st')
    .description('Show chart statistics')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'getStats', globals(cmd));
      output(result, cmd);
    }));

  narr
    .command('progress')
    .alias('pg')
    .description('Progress report for a chart')
    .argument('<chartId>', 'Chart ID')
    .action(actionHandler(async (chartId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'getProgress', chartId) as {
        completed: number; total: number; chartId: string;
      } | unknown;
      if (globals(cmd).json) {
        console.log(formatJson(result));
      } else if (
        result &&
        typeof result === 'object' &&
        'completed' in result &&
        'total' in result
      ) {
        const r = result as { completed: number; total: number; chartId: string };
        console.log(`${chalk.bold(r.chartId)}  ${formatProgress(r.completed, r.total)}`);
      } else {
        output(result, cmd);
      }
    }));

  narr
    .command('mmot')
    .description('Run MMOT evaluation on a chart')
    .argument('<chartId>', 'Chart ID')
    .option('--assessment <text>', 'Assessment text')
    .option('--direction <dir>', 'Direction: South | East | West | North')
    .action(actionHandler(async (chartId: string, opts: { assessment?: string; direction?: string }, cmd: Command) => {
      const result = await callModule('narrative', 'performMmot', chartId, opts);
      output(result, cmd);
    }));

  narr
    .command('set-date')
    .alias('sd')
    .description('Set due date on a chart')
    .argument('<chartId>', 'Chart ID')
    .argument('<date>', 'Due date (ISO)')
    .action(actionHandler(async (chartId: string, date: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('narrative', 'setDueDate', chartId, date);
      if (typeof result === 'string') console.log(formatSuccess(result));
      else output(result, cmd);
    }));
}

// ---------------------------------------------------------------------------
// PDE commands
// ---------------------------------------------------------------------------

function registerPdeCommands(program: Command): void {
  const pde = program
    .command('pde')
    .description('Prompt Decomposition Engine');

  pde
    .command('import')
    .description('Import a PDE decomposition into narrative')
    .argument('<pdeId>', 'Decomposition ID')
    .action(actionHandler(async (pdeId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('pde', 'importDecomposition', pdeId);
      output(result, cmd);
    }));

  pde
    .command('list')
    .description('List decompositions')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('pde', 'listDecompositions');
      output(result, cmd);
    }));

  pde
    .command('sessions')
    .description('List PDE sessions')
    .action(actionHandler(async (opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('pde', 'listSessions');
      output(result, cmd);
    }));

  pde
    .command('show')
    .description('Show session details')
    .argument('<sessionId>', 'Session ID')
    .action(actionHandler(async (sessionId: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('pde', 'showSession', sessionId);
      output(result, cmd);
    }));
}

// ---------------------------------------------------------------------------
// Planning commands
// ---------------------------------------------------------------------------

function registerPlanCommands(program: Command): void {
  const plan = program
    .command('plan')
    .description('Structural tension plan operations');

  plan
    .command('parse')
    .description('Parse a plan file structurally')
    .argument('<planPath>', 'Path to plan file')
    .action(actionHandler(async (planPath: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('planning', 'parsePlan', resolve(planPath));
      output(result, cmd);
    }));

  plan
    .command('convert')
    .description('Convert a plan to a structural tension chart')
    .argument('<planPath>', 'Path to plan file')
    .action(actionHandler(async (planPath: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('planning', 'convertToChart', resolve(planPath));
      output(result, cmd);
    }));

  plan
    .command('sync-to-chart')
    .description('Sync a plan file into charts')
    .argument('<planPath>', 'Path to plan file')
    .argument('<chartsPath>', 'Path to charts JSONL')
    .action(actionHandler(async (planPath: string, chartsPath: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('planning', 'syncToChart', resolve(planPath), resolve(chartsPath));
      output(result, cmd);
    }));

  plan
    .command('sync-to-plan')
    .description('Sync chart data back to a plan file')
    .argument('<chartsPath>', 'Path to charts JSONL')
    .argument('<planPath>', 'Path to plan file')
    .action(actionHandler(async (chartsPath: string, planPath: string, opts: Record<string, unknown>, cmd: Command) => {
      const result = await callModule('planning', 'syncToPlan', resolve(chartsPath), resolve(planPath));
      output(result, cmd);
    }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('coaia')
    .version('0.1.0', '-V, --version')
    .description('CoAIA unified CLI — structural tension, narrative, and DevOps tooling')
    .option('--env <path>', 'Load environment file')
    .option('-M, --memory-path <path>', 'JSONL memory file path')
    .option('--no-color', 'Disable colors')
    .option('--json', 'JSON output', false);

  program.hook('preAction', (_thisCmd, actionCmd) => {
    const opts = actionCmd.optsWithGlobals();
    if (opts.color === false) {
      setColorEnabled(false);
    }
    if (opts.env) {
      readConfig(opts.env as string);
    }
  });

  registerRootCommands(program);
  registerFuseCommands(program);
  registerPipelineCommands(program);
  registerEnvCommands(program);
  registerGhCommands(program);
  registerNarrativeCommands(program);
  registerPdeCommands(program);
  registerPlanCommands(program);

  program.hook('postAction', async () => {
    try { await redisDisconnect(); } catch { /* client may not have been initialized */ }
  });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(formatError(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});

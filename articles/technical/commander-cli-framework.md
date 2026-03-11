# Commander.js CLI Framework: Technical Assessment for CoAiA.js

> Package selection brief — CLI framework for coaiajs's multi-subcommand interface (tash, fetch, fuse, pipeline, env, gh, narrative, pde, planning)

## Summary & Recommendation

**Use `commander` v12.x** for the coaiajs CLI. Commander's Git-style subcommand model maps directly to our 9+ subcommand structure. It's the most widely adopted Node.js CLI framework (weekly downloads dwarf alternatives), has zero dependencies, generates help automatically, and every team member already knows it. Clipanion's class-based approach is elegant but niche; yargs is powerful but over-engineered for our tree.

**Pin:** `"commander": "^12.1.0"`

## What We're Replacing

**Coaiapy** uses Python's `argparse` with subparsers:

```python
# coaiapy/coaiacli.py — argparse subcommand pattern
import argparse
parser = argparse.ArgumentParser(description='CoAiA CLI')
subparsers = parser.add_subparsers(dest='command')
parser_fuse = subparsers.add_parser('fuse', help='Manage Langfuse integrations.')
parser_gh = subparsers.add_parser('gh', help='GitHub operations.')
# ... 9+ subcommands
```

**coaia-narrative** uses `minimist` — bare-bones argv parsing with no help generation:

```typescript
// coaia-narrative/src/cli.ts — minimist pattern
import minimist from 'minimist';
const args = minimist(process.argv.slice(2));
// Manual flag handling: --memory-path, -M, --json, --no-color, --interactive
```

**coaia-planning** also uses `minimist` for `--plans-dir` and `--output-dir`.

## Options Compared

| Feature | Commander v12 | Yargs v17 | Clipanion v4 | minimist v1.2 |
|---------|--------------|-----------|-------------|--------------|
| Weekly downloads | ~125M | ~80M | ~4M | ~50M |
| Dependencies | 0 | 5+ | 0 | 0 |
| Subcommand model | Git-style `.command()` | Builder callbacks | Class-based `paths` | None (manual) |
| Auto-help | ✅ Excellent | ✅ Excellent | ✅ Good | ❌ None |
| TypeScript | Good (DefinitelyTyped) | Good | Excellent (first-class) | Minimal |
| Learning curve | Low | Medium | Medium-high | Very low |
| Argument parsing | Options, args, variadic | All types + coercion | All types + validation | Raw key-value |
| Completion (bash/zsh) | Plugin available | Built-in | Not built-in | ❌ |
| Version handling | Built-in `.version()` | Built-in | Manual | ❌ |
| Nested subcommands | `.command()` nesting | Recursive builders | Arbitrary `paths` depth | ❌ |
| Exit override | `.exitOverride()` for testing | `fail()` handler | Exception-based | N/A |

## API Overview

### Main CLI Entry Point

```typescript
// src/cli.ts
import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command()
  .name('coaia')
  .version(version)
  .description('CoAiA.js — Structural Tension Agent Framework');

// Register subcommands
program.addCommand(createTashCommand());
program.addCommand(createFetchCommand());
program.addCommand(createFuseCommand());
program.addCommand(createPipelineCommand());
program.addCommand(createEnvCommand());
program.addCommand(createGhCommand());
program.addCommand(createNarrativeCommand());
program.addCommand(createPdeCommand());
program.addCommand(createPlanningCommand());

program.parse();
```

### Subcommand Definition Pattern

```typescript
// src/commands/fuse.ts
import { Command } from 'commander';

export function createFuseCommand(): Command {
  const fuse = new Command('fuse')
    .description('Manage Langfuse integrations');

  fuse
    .command('trace')
    .description('Create or list traces')
    .option('-s, --session <id>', 'Session ID')
    .option('--list', 'List recent traces')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      if (opts.list) {
        const traces = await listTraces(opts);
        console.log(opts.json ? JSON.stringify(traces) : formatTable(traces));
      } else {
        await createTrace(opts);
      }
    });

  fuse
    .command('score')
    .description('Score a trace')
    .requiredOption('-t, --trace-id <id>', 'Trace ID to score')
    .requiredOption('-n, --name <name>', 'Score name')
    .requiredOption('-v, --value <number>', 'Score value', parseFloat)
    .action(async (opts) => {
      await scoreTrace(opts.traceId, opts.name, opts.value);
    });

  return fuse;
}
```

### GitHub Subcommand (replacing cogh.py)

```typescript
// src/commands/gh.ts
import { Command } from 'commander';

export function createGhCommand(): Command {
  const gh = new Command('gh')
    .description('GitHub operations');

  gh.command('issues')
    .description('List repository issues')
    .argument('<owner>', 'Repository owner')
    .argument('<repo>', 'Repository name')
    .option('--state <state>', 'Filter by state', 'open')
    .option('--labels <labels...>', 'Filter by labels')
    .option('--json', 'JSON output')
    .action(async (owner, repo, opts) => {
      const issues = await listIssues(owner, repo, opts);
      console.log(opts.json ? JSON.stringify(issues) : formatIssuesTable(issues));
    });

  gh.command('issue <owner> <repo> <number>')
    .description('Get a specific issue')
    .action(async (owner, repo, number) => {
      const issue = await getIssue(owner, repo, parseInt(number));
      console.log(JSON.stringify(issue, null, 2));
    });

  return gh;
}
```

### Pipeline Subcommand (with YAML template loading)

```typescript
// src/commands/pipeline.ts
import { Command } from 'commander';

export function createPipelineCommand(): Command {
  const pipeline = new Command('pipeline')
    .description('Execute pipeline templates');

  pipeline
    .command('run <template>')
    .description('Run a pipeline template')
    .option('-v, --var <key=value...>', 'Template variables')
    .option('--dry-run', 'Show execution plan without running')
    .option('--template-dir <dir>', 'Template search directory')
    .action(async (template, opts) => {
      const vars = parseVars(opts.var ?? []);
      await runPipeline(template, vars, opts);
    });

  pipeline
    .command('list')
    .description('List available templates')
    .action(async () => {
      const templates = await listTemplates();
      templates.forEach(t => console.log(`  ${t.name} (v${t.version})`));
    });

  return pipeline;
}
```

### Global Options Pattern

```typescript
// Shared options across all subcommands
program
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Verbose logging')
  .option('-M, --memory-path <path>', 'Memory file path')
  .option('--env <file>', 'Custom env file');

// Access in any subcommand action
function getGlobalOpts(cmd: Command) {
  const root = cmd.parent ?? cmd;
  return root.opts() as { json?: boolean; color?: boolean; verbose?: boolean; memoryPath?: string };
}
```

## Integration Plan

1. **Entry point:** `src/cli.ts` — Commander program with `.parse()`
2. **Command directory:** `src/commands/` — one file per subcommand
   - `tash.ts` — Task management (structural tension)
   - `fetch.ts` — Data fetching operations
   - `fuse.ts` — Langfuse integration
   - `pipeline.ts` — Pipeline template execution
   - `env.ts` — Environment management
   - `gh.ts` — GitHub operations
   - `narrative.ts` — Narrative/chart operations
   - `pde.ts` — Prompt decomposition
   - `planning.ts` — Plan-to-STC operations
3. **Bin entry:** `package.json` → `"bin": { "coaia": "./dist/src/cli.js" }`
4. **Testing:** Commander's `.exitOverride()` + `.configureOutput()` for unit tests

### Migration Path from minimist

```typescript
// BEFORE (coaia-narrative minimist pattern)
const args = minimist(process.argv.slice(2));
const memoryPath = args['memory-path'] || args.M || process.env.COAIA_MEMORY_PATH;

// AFTER (Commander)
program.option('-M, --memory-path <path>', 'Memory file path', process.env.COAIA_MEMORY_PATH);
// memoryPath is now typed and auto-documented in --help
```

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 12.1.0 |
| Weekly downloads | ~125M |
| Dependencies | 0 |
| TypeScript | `@types/commander` (DefinitelyTyped) |
| GitHub stars | ~27,000 |
| Used by | npm CLI, Vue CLI, create-react-app |
| Node.js compat | ≥16 (we target ≥20) |
| License | MIT |

## Why Not Yargs?

Yargs is powerful but overkill. Our subcommand tree is wide (9 commands) but not deeply nested. Commander's chainable API makes each command file self-contained and readable. Yargs' middleware system and callback-based builders add complexity we don't need.

## Why Not Clipanion?

Clipanion's TypeScript-first class-based approach is architecturally beautiful, but:
1. ~4M weekly downloads vs Commander's ~125M = smaller help ecosystem
2. Class-based commands are less familiar to contributors
3. Yarn is its primary consumer; documentation coverage is thin for edge cases
4. Commander is already in our `package.json`

## References

- npm: https://www.npmjs.com/package/commander
- GitHub: https://github.com/tj/commander.js
- Guide: https://betterstack.com/community/guides/scaling-nodejs/commander-explained/
- Comparison: https://npm-compare.com/commander,yargs
- Clipanion: https://github.com/arcanis/clipanion

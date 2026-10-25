# 08 — CLI Interface

> Unified `coaia` command with subcommands for all modules.

## Desired Outcome

A single `coaia` CLI binary that provides subcommands for every CoAiA module — replacing the separate CLIs in coaiapy (argparse-based) and coaia-narrative (minimist-based) with a unified commander-based interface.

## Structural Tension

**Current Reality:**
- [`package.json`](../package.json) defines `"coaia": "./dist/src/cli.js"`.
- [`src/cli.ts`](../src/cli.ts) implements a commander-based CLI covering root coaiapy parity commands, Langfuse, pipeline, environment, GitHub, narrative, PDE, and planning command groups.
- [`src/narrative/index.ts`](../src/narrative/index.ts), [`src/pde/index.ts`](../src/pde/index.ts), and [`src/planning/index.ts`](../src/planning/index.ts) expose helper functions used by the CLI dynamic module loader.
- `npx coaia --help` works from an installed package tarball.
- Remaining gaps: `synthesize` and explicit `mcp` CLI subcommands are desired but not currently registered as CLI groups.

**Desired Outcome:**
Unified CLI at `src/cli.ts` using commander, with subcommands:

```
coaia tash <key> <value> [--ttl N]
coaia fetch <key>
coaia env [list|get|set|unset|init]
coaia fuse [traces|trace|prompts|scores|datasets]
coaia pipeline [list|render|execute] <template>
coaia transcribe <audio-file>
coaia gh [issues|issue|comments]
coaia narrative [list|view|current|update|add-action|add-obs|complete|export|export-all|stats|progress|mmot|set-date|delay|delayed|end-delay|link-issue]
coaia pde [import|list|sessions|show]
coaia plan [parse|convert|sync-to-chart|sync-to-plan]
```

## Core Structure

```typescript
import { Command } from 'commander';

const program = new Command()
  .name('coaia')
  .version(pkg.version)
  .description('CoAiA unified CLI');

// Register subcommands
program.addCommand(redisCommands());
program.addCommand(envCommands());
program.addCommand(fuseCommands());
program.addCommand(pipelineCommands());
program.addCommand(audioCommands());
program.addCommand(ghCommands());
program.addCommand(narrativeCommands());
program.addCommand(pdeCommands());
program.addCommand(planCommands());
```

## Command Details

### Redis Commands
```
coaia tash <key> <value> [--ttl N]     # Set key with optional TTL
coaia fetch <key>                       # Get value by key
coaia del <key>                         # Delete key
coaia keys [pattern]                    # List keys matching pattern
```

### Environment Commands
```
coaia env init                          # Create .coaia-env file
coaia env list                          # Show all env vars
coaia env get <key>                     # Get specific var
coaia env set <key> <value>             # Set env var
coaia env unset <key>                   # Remove env var
```

### Langfuse Commands
```
coaia fuse traces list [--from ISO --to ISO --cursor X]  # V4 traces reconstructed from observations
coaia fuse traces trace-view <id>                        # V4 observation tree
coaia fuse traces create --name X [--input JSON --output JSON] # OTEL root observation
coaia fuse prompts get <name> [--version <n>] [--label <l>] [--md]  # Markdown by default
coaia fuse scores list [--trace-id X --cursor X]         # Scores API v3
coaia fuse sessions view <id>                            # Session reconstructed by sessionId
```

A subcommand's own `--version` takes precedence over the root's `-V, --version` (0.8.0): `fuse prompts get <name> --version <n>` asks Langfuse for that prompt version, and `fuse traces create --version <v>` sets the trace version. Before 0.8.0 commander read the root option anywhere on the line, so both printed the package version and exited (found 2026-10-22). `buildProgram()` finds the command the arguments reach and, when that command declares `--version`, leaves the flag to it; `coaia --version` and `coaia -V` still print the package version.

Langfuse v4 removes legacy session entities and immutable observation updates, so the CLI does not expose session creation/add-node or trace patch-output commands.

### Narrative Commands

`coaia narrative` (alias `coaia n`). From 0.7.0, every narrative command that opens a store honours the global `-M, --memory-path <path>`, then `COAIAJS_MEMORY_PATH`, then `./coaia-memory.jsonl` (`current` reads and writes the environment file, not a store). Before 0.7.0, `update`, `add-action`, `add-obs`, `export`, `export-all`, `stats`, `progress` and `mmot` ignored `-M` because their helpers in `src/narrative/index.ts` called `managerFrom()` without the options (Episode 297 spec lane, finding F2). [`test/narrative-memory-path.test.mjs`](../test/narrative-memory-path.test.mjs) runs all eight from an empty working directory with `COAIAJS_MEMORY_PATH` unset and checks that they used the `-M` store and created no `./coaia-memory.jsonl`.

```
coaia narrative list                    # List active charts
coaia narrative view <chartId>          # Show chart details
coaia narrative current [chartId]       # Show or set the current chart
coaia narrative update <chartId> [--desired-outcome <text>] [--current-reality <text>]
coaia narrative add-action <chartId> --title <text> [--current-reality <text>] [--due <ISO>]
coaia narrative add-obs <chartId> [text...]
coaia narrative complete <actionName> [--by <who>]   # a delayed step has its delay ended as resolved
coaia narrative export <chartId> [--output <path>]
coaia narrative export-all [--output <dir>]
coaia narrative stats
coaia narrative progress <chartId>
coaia narrative mmot <chartId> [--assessment <text>] [--direction South|East|West|North]
coaia narrative set-date <chartId> <ISO> [-r, --redistribute]
coaia narrative link-issue <chartId> <owner/repo#number>
```

Delayed resolution (0.6.0, Episode 297, `miadi-chronicle://297`; `--trace` and `--rehydrate-with` from 0.7.0; `--follow-up-prompt`, `--follow-up-text`, `--follow-up-by` from 0.8.0; specified in [`11-delayed-resolution.spec.md`](./11-delayed-resolution.spec.md)):

```
coaia narrative delay <actionStepName> --resolve-by <ISO> --reason <text> --chosen-by <who>
    [--primary-choice <text>] [--wake-on <cue>]... [--session-id <id> --agent <name> --host <host>
    --cwd <dir> --tmux <target> --resume-command <cmd> --inventory-record <path>
    --trace <miadi-addr> --rehydrate-with <miadi-addr>]
    [--follow-up-prompt <miadi-addr> [--follow-up-text <text>] [--follow-up-by <who>]]
coaia narrative delayed [--within <days>] [--all]
coaia narrative end-delay <actionStepName> --by <who> --outcome rehydrated|released [--note <text>]
```

`--trace` is the session's LLMOps record and `--rehydrate-with` the pinned prompt version that rehydrates it, as `@miadi/llmops rehydrate` prints them (e.g. `miadi-tracing:ceremony/session/<id>`, `miadi-tracing:ceremony/prompt/miadiRun-<name>@<N>`). Each needs `--session-id` and must begin with `miadi-`; the CLI exits 1 otherwise. `delayed` shows them under the session line (`Trace:`, `Rehydrate with:`), and `end-delay --outcome rehydrated` prints them after the resume command (`--json` returns `resumeCommand`, `trace`, `rehydrateWith` at the top level).

`--follow-up-prompt` (0.8.0) names the follow-up prompt composed when the delay is chosen, by an address beginning with `miadi-` (e.g. `miadi-prompt:ceremony/<name>@<v>`), stored as given; `--follow-up-text` is its text and `--follow-up-by` who composed it. Either of those two without `--follow-up-prompt`, or an address not beginning with `miadi-`, exits 1. The record's `followUpPrompt.composedAt` is the delay's `chosenAt`. `delayed` shows `Follow-up prompt: <address> (composed by <who>)`. `end-delay --outcome rehydrated` prints the address and text before the resume command, and `--json` returns `followUpPrompt` at the top level beside `resumeCommand`. A delay with a follow-up prompt and no session can end as `rehydrated`; one with neither is refused.

### PDE Commands
```
coaia pde import <id>                   # Import stored PDE decomposition into STC session
coaia pde list                          # List decompositions
coaia pde sessions                      # List PDE sessions
coaia pde show <session-id>             # Show PDE session state
```

### Plan Commands
```
coaia plan parse <file>                 # Parse plan markdown
coaia plan convert <file>               # Convert plan to STC JSONL
coaia plan sync-to-chart <file> <jsonl> # Sync plan into chart JSONL
coaia plan sync-to-plan <jsonl> <file>  # Sync chart JSONL back to plan markdown
```

## Output Formatting

- Use `chalk` for colored terminal output
- JSON output available via `--json` global flag
- Quiet mode via `--quiet` global flag (exit code only)
- Error output to stderr, data to stdout

## Quality Criteria

- ✅ Every coaiapy CLI command has an equivalent subcommand
- ✅ `coaia --help` shows all subcommands with descriptions
- ✅ `coaia <subcommand> --help` shows subcommand-specific help
- ✅ Exit code 0 on success, 1 on error
- ✅ `--json` flag produces machine-parseable output for every command
- ✅ Works in pipe context (no TTY-dependent formatting when piped)

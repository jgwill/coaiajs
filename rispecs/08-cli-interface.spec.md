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
coaia narrative [charts|chart|progress|export]
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
coaia fuse traces [--limit N]           # List traces
coaia fuse trace <id>                   # Get trace details
coaia fuse prompts [--name X]           # List prompts
coaia fuse scores [--trace-id X]        # List scores
coaia fuse datasets                     # List datasets
```

### Narrative Commands
```
coaia narrative charts                  # List all active charts
coaia narrative chart <id>              # Show chart details
coaia narrative progress <id>           # Show chart progress
coaia narrative export <id> [--format md|json]  # Export chart
```

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

# 08 — CLI Interface

> Unified `coaia` command with subcommands for all modules.

## Desired Outcome

A single `coaia` CLI binary that provides subcommands for every CoAiA module — replacing the separate CLIs in coaiapy (argparse-based) and coaia-narrative (minimist-based) with a unified commander-based interface.

## Structural Tension

**Current Reality:**
- CLI entry point defined in `package.json` as `"coaia": "./dist/src/cli.js"` but no implementation exists
- commander dependency is installed
- coaiapy has an argparse-based CLI covering: tash, fetch, env, pipeline, transcribe, synthesize, fuse, gh
- coaia-narrative has a minimist-based CLI covering: chart visualization, markdown export, progress display
- coaia-pde has no CLI
- coaia-planning has no CLI

**Desired Outcome:**
Unified CLI at `src/cli.ts` using commander, with subcommands:

```
coaia tash <key> <value> [--ttl N]
coaia fetch <key>
coaia env [list|get|set|unset|init]
coaia fuse [traces|trace|prompts|scores|datasets]
coaia pipeline [list|render|execute] <template>
coaia transcribe <audio-file>
coaia synthesize <text> --output <file>
coaia gh [issues|issue|comments]
coaia narrative [charts|chart|progress|export]
coaia pde [decompose|list|get|export|to-stc]
coaia plan [parse|to-stc|from-stc|sync|diff]
coaia mcp [start|tools]
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
program.addCommand(mcpCommands());
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
coaia pde decompose <prompt>            # Decompose a prompt
coaia pde list                          # List decompositions
coaia pde get <id>                      # Get decomposition
coaia pde export <id>                   # Export as markdown
coaia pde to-stc <id>                   # Transform to STC
```

### Plan Commands
```
coaia plan parse <file>                 # Parse plan markdown
coaia plan to-stc <file>                # Convert plan to STC
coaia plan from-stc <chart-id>          # Generate plan from STC
coaia plan sync <file> <chart-id>       # Bidirectional sync
coaia plan diff <file> <chart-id>       # Show differences
```

### MCP Commands
```
coaia mcp start [--mode MINIMAL|STANDARD|FULL]  # Start MCP server
coaia mcp tools [--mode X]                       # List available tools
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

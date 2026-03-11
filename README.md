# coaiajs

**CoAIA unified TypeScript monorepo** — CLI, MCP server, and library consolidating `coaia-narrative`, `coaia-pde`, `coaia-planning`, and `coaiapy` patterns into a single package.

## What is this?

`coaiajs` is the TypeScript consolidation of the CoAIA (Creative Orientation AI Architecture) ecosystem. It unifies four previously separate projects:

| Origin Project | What it did | Where it lives now |
|---|---|---|
| `coaia-narrative` | JSONL knowledge graph, structural tension charts, narrative beats | `src/narrative/` |
| `coaia-pde` | Prompt Decomposition Engine | `src/pde/` |
| `coaia-planning` | Action planning, structural tension chart management | `src/planning/` |
| `coaiapy` | Python CLI with Redis, LLM, audio, GitHub, config, environment | `src/` (core modules) |

The shared type system in `src/types.ts` is the union of all four projects.

## Installation

```bash
# Clone and install
cd coaiajs
npm install

# Build
npm run build
```

### Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.7

## Usage

### CLI

```bash
# Run the CLI
npx coaia <command>

# Or after global install
coaia <command>
```

### MCP Server

```bash
# Start the MCP server (for Claude, Copilot, etc.)
npx coaiajs-mcp

# Or via npm script
npm run mcp
```

### Library

```typescript
import { readConfig } from 'coaiajs/src/config.js';
import { tash, fetch } from 'coaiajs/src/redis.js';
import { llm } from 'coaiajs/src/llm.js';
import { createEnvironment } from 'coaiajs/src/environment.js';
import type { Entity, DecompositionResult, CoaiaConfig } from 'coaiajs/src/types.js';
```

## Configuration

Configuration is loaded with the following priority (highest wins):

1. **Environment variables** — `REDIS_URL`, `OPENAI_API_KEY`, `LANGFUSE_PUBLIC_KEY`, etc.
2. **`.env` file** — in current working directory
3. **`coaia.json`** — searched in `./coaia.json`, `~/coaia.json`, `~/.coaia/config.json`
4. **Defaults**

### Environment Variables

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection URL |
| `OPENAI_API_KEY` | OpenAI API key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Polly |
| `GITHUB_TOKEN` | GitHub API token |

### coaia.json

```json
{
  "redis": { "url": "redis://localhost:6379" },
  "openai": { "apiKey": "sk-...", "model": "gpt-4o" },
  "langfuse": { "publicKey": "pk-...", "secretKey": "sk-..." },
  "github": { "token": "ghp_..." }
}
```

## Project Structure

```
coaiajs/
├── src/                    # Core library and CLI
│   ├── types.ts            # Shared type definitions (union of all projects)
│   ├── config.ts           # Configuration management
│   ├── redis.ts            # Redis tash/fetch operations
│   ├── environment.ts      # Environment variable management
│   ├── llm.ts              # OpenAI LLM wrapper
│   ├── audio.ts            # AWS Polly text-to-speech
│   ├── github.ts           # GitHub API wrapper
│   ├── cli.ts              # CLI entry point
│   ├── langfuse/           # Langfuse observability integration
│   ├── narrative/          # Knowledge graph, STC, narrative beats
│   ├── pde/                # Prompt Decomposition Engine
│   ├── planning/           # Action planning and STC management
│   └── pipeline/           # Pipeline template engine
├── mcp/                    # MCP server
│   ├── server.ts           # MCP server entry point
│   └── tools/              # MCP tool definitions
├── tests/                  # Test files
├── articles/               # Documentation articles
└── rispecs/                # RISE specification files
```

## Development

```bash
# Watch mode
npm run dev

# Type checking without emit
npm run lint

# Run tests
npm test
```

## Architecture

The architecture follows the **Structural Tension** pattern from Robert Fritz's creative process framework:

- **Desired Outcome** — what you want to create
- **Current Reality** — honest assessment of where you are
- **Action Steps** — telescoped sub-charts bridging the gap

Each module operates independently but shares the unified type system (`src/types.ts`), enabling the MCP server to expose all capabilities through a single protocol.

## License

MIT

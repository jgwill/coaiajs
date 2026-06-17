# CoAiA.js — RISE Specifications

> Complete RISE-based specifications for rebuilding CoAiA.js from scratch.
> Another LLM or developer reading these specs alone should be able to re-implement the entire system.

## Purpose

These rispecs define the structural specifications for **coaiajs** — the unified TypeScript platform that consolidates `coaiapy`, `coaia-narrative`, `coaia-pde`, and `coaia-planning` into a single modern Node.js package.

## RISE Framework Source

These specs use the RISE Framework at `/src/llms/llms-rise-framework.txt` as the governing method:

- **Reverse-engineer** parent package behavior from `coaiapy`, `coaia-narrative`, `coaia-pde`, and `coaia-planning`.
- **Intent-extract** the creative outcome each module makes possible.
- **Specify** the structural tension between current implementation and desired package behavior.
- **Export** enough code-linked detail for an evaluator or implementation agent to act without rediscovery.

## Specification Index

### Platform

| # | Spec | Scope |
|---|------|-------|
| 00 | [coaiajs-platform](./00-coaiajs-platform.spec.md) | Master platform spec — vision, lineage, component map |

### Core Modules

| # | Spec | Scope | Lineage |
|---|------|-------|---------|
| 01 | [core-config](./01-core-config.spec.md) | Config loading, env vars, deep merge | coaiapy `read_config()` |
| 02 | [redis-module](./02-redis-module.spec.md) | Redis tash/fetch, lazy connection, Upstash | coaiapy `tash/fetch` |
| 03 | [langfuse-module](./03-langfuse-module.spec.md) | Langfuse observability REST client | coaiapy `cofuse.py` |

### Engine Modules

| # | Spec | Scope | Lineage |
|---|------|-------|---------|
| 04 | [narrative-engine](./04-narrative-engine.spec.md) | JSONL knowledge graph, STC, beats, MMOT | coaia-narrative `graph-manager.ts` |
| 05 | [pde-engine](./05-pde-engine.spec.md) | PDE→STC transformation, session management | coaia-pde `stc-mapper.ts` |
| 06 | [planning-engine](./06-planning-engine.spec.md) | Plan parsing, plan↔STC sync | coaia-planning `plan-parser.ts` |

### Support Modules

| # | Spec | Scope | Lineage |
|---|------|-------|---------|
| 07 | [pipeline-templates](./07-pipeline-templates.spec.md) | Template rendering, variable substitution | coaiapy `pipeline.py` |
| 10 | [audio-module](./10-audio-module.spec.md) | Whisper transcription, Polly synthesis | coaiapy `syntation.py` |

### Interface Layers

| # | Spec | Scope | Lineage |
|---|------|-------|---------|
| 08 | [cli-interface](./08-cli-interface.spec.md) | Unified `coaia` CLI with all subcommands | coaiapy argparse + coaia-narrative minimist |
| 09 | [mcp-server](./09-mcp-server.spec.md) | Unified MCP server with 64+ tools | 4 separate MCP servers |

## How Specs Relate

```
┌─────────────────────────────────────────────────────┐
│  00-coaiajs-platform (master)                       │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │01 config │→ │02 redis  │  │03 langfuse        │  │
│  └────┬─────┘  └─────┬────┘  └────────┬──────────┘  │
│       │              │               │              │
│  ┌────▼──────────────▼───────────────▼──────────┐   │
│  │  04 narrative-engine (JSONL, STC, MMOT)      │   │
│  └────────┬──────────────────────┬──────────────┘   │
│           │                      │                  │
│  ┌────────▼──────┐  ┌───────────▼──────────────┐   │
│  │05 pde-engine  │  │06 planning-engine        │   │
│  └───────────────┘  └──────────────────────────┘   │
│                                                     │
│  ┌───────────────┐  ┌──────────────────────────┐   │
│  │07 pipeline    │  │10 audio                  │   │
│  └───────────────┘  └──────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 08 cli-interface        09 mcp-server        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Implementation Map

| Spec | Primary implementation |
|------|------------------------|
| 00 platform | [`package.json`](../package.json), [`src/index.ts`](../src/index.ts) |
| 01 config | [`src/config.ts`](../src/config.ts), [`src/types.ts`](../src/types.ts) |
| 02 redis | [`src/redis.ts`](../src/redis.ts), [`mcp/tools/coaiapy-tools.ts`](../mcp/tools/coaiapy-tools.ts) |
| 03 langfuse | [`src/langfuse/`](../src/langfuse/), [`mcp/server.ts`](../mcp/server.ts) |
| 04 narrative | [`src/narrative/`](../src/narrative/), [`src/narrative/index.ts`](../src/narrative/index.ts) |
| 05 PDE | [`src/pde/`](../src/pde/), [`src/pde/mcp-tools.ts`](../src/pde/mcp-tools.ts) |
| 06 planning | [`src/planning/`](../src/planning/), [`src/planning/mcp-tools.ts`](../src/planning/mcp-tools.ts) |
| 07 pipeline | [`src/pipeline/`](../src/pipeline/), [`mcp/resources.ts`](../mcp/resources.ts) |
| 08 CLI | [`src/cli.ts`](../src/cli.ts), [`package.json`](../package.json) `bin.coaia` |
| 09 MCP | [`mcp/server.ts`](../mcp/server.ts), [`mcp/config.ts`](../mcp/config.ts), [`mcp/prompts.ts`](../mcp/prompts.ts) |
| 10 audio | [`src/audio.ts`](../src/audio.ts), [`src/llm.ts`](../src/llm.ts) |

## Conventions

- **Creative orientation**: Desired Outcome describes what IS CREATED, not what is fixed
- **Honest current reality**: Factual assessment of where things stand today
- **Structural tension**: The gap between current and desired that drives advancement
- **Variable detail**: Broad for obvious patterns, precise for critical behavior
- **Naming**: `NN-kebab-case.spec.md`
- **Code-linked**: Specs describe behavior and link to the implementation files that currently carry it

## Relationship to Parent Rispecs

| Project | Rispecs location | Status |
|---------|-----------------|--------|
| coaia-narrative | `/src/coaia-narrative/rispecs/` | 15 specs — most mature, patterns inherited here |
| coaia-pde | `/src/coaia-pde/rispecs/` | 1 spec — PDE→STC transformation |
| coaia-planning | — | No rispecs yet — spec 06 here is the first |
| coaiapy | — | No rispecs — specs 01-03, 07, 10 here are the first |

## Maintenance Protocol

When code changes, update the relevant spec in the same pass:

1. Adjust **Current Reality** to match implemented files and verified behavior.
2. Add or revise implementation links in the local spec and this README map.
3. Keep **Desired Outcome** forward-looking only where a gap remains.
4. Re-run `npm run build`, `npm test`, and `npm pack --dry-run` before handing off.

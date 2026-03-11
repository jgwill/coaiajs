# CoAiA.js — RISE Specifications

> Complete RISE-based specifications for rebuilding CoAiA.js from scratch.
> Another LLM or developer reading these specs alone should be able to re-implement the entire system.

## Purpose

These rispecs define the structural specifications for **coaiajs** — the unified TypeScript platform that consolidates `coaiapy`, `coaia-narrative`, `coaia-pde`, and `coaia-planning` into a single modern Node.js package.

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

## Conventions

- **Creative orientation**: Desired Outcome describes what IS CREATED, not what is fixed
- **Honest current reality**: Factual assessment of where things stand today
- **Structural tension**: The gap between current and desired that drives advancement
- **Variable detail**: Broad for obvious patterns, precise for critical behavior
- **Naming**: `NN-kebab-case.spec.md`
- **Codebase-agnostic**: Specs describe behavior, not implementation details

## Relationship to Parent Rispecs

| Project | Rispecs location | Status |
|---------|-----------------|--------|
| coaia-narrative | `/src/coaia-narrative/rispecs/` | 15 specs — most mature, patterns inherited here |
| coaia-pde | `/src/coaia-pde/rispecs/` | 1 spec — PDE→STC transformation |
| coaia-planning | — | No rispecs yet — spec 06 here is the first |
| coaiapy | — | No rispecs — specs 01-03, 07, 10 here are the first |

## RISE Framework Reference

These specs follow the RISE Framework (`/src/llms/llms-rise-framework.txt`):
- **R**everse-engineer: Extract creative intent from parent projects
- **I**ntent-extract: Identify what each module enables users to create
- **S**pecify: Define structural tension between current and desired
- **E**xport: Produce specs sufficient for autonomous re-implementation

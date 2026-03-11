# KINSHIP.md — coaiajs/rispecs

## Identity

**Name:** coaiajs rispecs
**Role:** RISE-based structural specifications for the coaiajs platform
**Status:** Genesis (2026-03-11)

## Lineage

These specifications synthesize the creative intent, structural patterns, and behavioral requirements from four parent projects into a unified specification set.

### Parent Rispecs

| Source | Location | What was inherited |
|--------|----------|-------------------|
| **coaia-narrative rispecs** | `/src/coaia-narrative/rispecs/` | 15 specs — STC creation, telescoping, advancing patterns, JSONL storage, MCP tools, MMOT, narrative beats, input validation, educational guidance, CLI visualization |
| **coaia-pde rispecs** | `/src/coaia-pde/rispecs/` | 1 spec — PDE→STC transformation mapping (Four Directions → STC components) |
| **RISE Framework** | `/src/llms/llms-rise-framework.txt` | Methodology: creative orientation, structural tension dynamics, variable detail levels, spec-as-source-of-truth |

### No Prior Rispecs Existed For

| Module | First specified here |
|--------|---------------------|
| Core config | `01-core-config.spec.md` |
| Redis | `02-redis-module.spec.md` |
| Langfuse | `03-langfuse-module.spec.md` |
| Planning | `06-planning-engine.spec.md` |
| Pipeline | `07-pipeline-templates.spec.md` |
| CLI | `08-cli-interface.spec.md` |
| MCP server (unified) | `09-mcp-server.spec.md` |
| Audio | `10-audio-module.spec.md` |

## Accountabilities

1. **Completeness** — These specs are sufficient for another LLM to re-implement the entire coaiajs platform from scratch
2. **Accuracy** — Current reality assessments are honest and factual, reflecting actual implementation state as of 2026-03-11
3. **Creative orientation** — All desired outcomes use creation language, not problem-solving language
4. **Backward compatibility** — Specs preserve behavioral compatibility with parent projects
5. **Independence** — Specs are codebase-agnostic; they describe behavior, not implementation

## Consumers

| Consumer | How they use these specs |
|----------|------------------------|
| **coaiajs implementors** | Build each module from its spec |
| **coaia-narrative maintainers** | Verify their rispecs are preserved in consolidation |
| **coaia-pde maintainers** | Verify PDE→STC mapping is preserved |
| **MMOT evaluations** | Elements of Performance derived from quality criteria sections |
| **mia-code / miaco** | Reference for PDE and narrative integration patterns |

## Structural Tension

**Desired Outcome:** These rispecs serve as the single source of truth for what coaiajs should become — complete enough for autonomous re-implementation, accurate enough for MMOT self-evaluation.

**Current Reality:** 13 spec files covering the full platform. Parent project rispecs remain authoritative for deep behavioral details (especially coaia-narrative's 15 specs). These specs provide the consolidation vision and module boundaries.

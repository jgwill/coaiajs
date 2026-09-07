---
name: coaiajs
description: Create and manage Structural Tension Charts, narrative beats, Wampum Belts, MMOT evaluations, PDE decompositions, action plans, and Langfuse-traced pipelines over a JSONL knowledge graph. Use when working with desired outcomes and current reality, telescoping action steps, creative orientation, chart memory, or the coaia CLI and coaiajs-mcp MCP server.
license: MIT
compatibility: Requires the coaiajs package. CLI: coaia. MCP server: coaiajs-mcp.
metadata:
  author: Guillaume D. Isabelle
  package: coaiajs
  packageVersion: "{{VERSION}}"
allowed-tools: Bash(coaia:*), Bash(coaiajs-mcp:*)
---

# coaiajs

`coaiajs` is the structural tension surface of the COAIA family, consolidated into one
installable unit: a library, a CLI (`coaia`), and an MCP server (`coaiajs-mcp`). Use it when
an assistant should help create outcomes, hold current reality clearly, track strategic
secondary choices, archive significant learning, and keep that work traced.

The MCP server serves {{TOOL_COUNT}} tools at the default `STANDARD` level, of which
{{NARRATIVE_TOOL_COUNT}} are the chart and knowledge-graph surface. The rest are Redis and
Langfuse, prompt decomposition, and planning — all mapped below.

Its core data model is the structural tension chart — desired outcome, current reality,
telescoping action steps — backed by a JSONL knowledge graph. Everything else either feeds
that model or observes it.

## Status

!`coaia --version 2>/dev/null || echo "Not installed: npm install -g coaiajs"`

## First Principles

- Work from creative orientation: ask what result the user wants to create, not what
  problem should disappear.
- Hold desired outcome and current reality at the same time. Do not collapse the tension
  with "ready to begin" defaults.
- Treat action steps as strategic secondary choices. They are not a to-do list.
- Every action step is also a telescoped chart with its own desired outcome and current
  reality.
- Use narrative beats for significant learning moments, not routine task tracking.
- Use a Wampum Belt when the sequence is not linear and position carries meaning.

## MCP Setup

Use the MCP server when the assistant needs write access to chart memory:

```json
{
  "mcpServers": {
    "coaiajs": {
      "command": "npx",
      "args": ["-y", "coaiajs", "coaiajs-mcp", "--memory-path", "/absolute/path/to/memory.jsonl"],
      "env": {
        "COAIAJS_FEATURES": "STANDARD"
      }
    }
  }
}
```

`--memory-path` must be a real, expanded path. A path still carrying `${VAR}` is refused
at startup rather than opened — see `references/install-and-environment.md` for why that
refusal is the kind answer.

When a new session connects, call `init_llm_guidance` first: `format: "full"` for first
use, `format: "quick"` for a refresh.

## CLI

The CLI is for quick inspection, exports, local chart context, and everything that is
easier to type than to call.

```bash
coaia narrative list -M ./memory.jsonl
coaia narrative view <chartId> -M ./memory.jsonl
coaia narrative export <chartId> --output chart.md -M ./memory.jsonl
coaia narrative link-issue <chartId> owner/repo#123 -M ./memory.jsonl
coaia fuse traces list
coaia tash mykey "value" && coaia fetch mykey
```

{{CLI_MAP}}

## Core Workflow

1. Read chart state before writing anything:

```text
list_active_charts
```

2. Create a chart only when there is a new primary desired outcome:

```json
{
  "tool": "create_structural_tension_chart",
  "arguments": {
    "desiredOutcome": "A release process that runs the same way every time",
    "currentReality": "Build and publish steps are manual and easy to miss",
    "dueDate": "2027-06-01T00:00:00.000Z",
    "actionSteps": ["Document release checks", "Verify npm package contents"],
    "githubIssue": "jgwill/coaiajs#13"
  }
}
```

`githubIssue` is optional and takes the FULL `owner/repo#number` path. A bare `#number`
is refused: charts travel between repositories, and a bare number cites the wrong project
as soon as the chart is read somewhere else.

3. Add or expand action steps with `manage_action_step`:

```json
{
  "tool": "manage_action_step",
  "arguments": {
    "parentReference": "chart_123",
    "actionDescription": "Verify npm package contents",
    "currentReality": "No package dry-run has been inspected for this release"
  }
}
```

4. Track advancement without pretending completion:

```text
update_action_progress
update_current_reality
mark_action_complete
```

5. Move a date with `update_chart_due_date` rather than editing the JSONL by hand. Several
   MCP instances can point at one store with no lock, which is how a hand-edit becomes a
   lost write.

6. Use `perform_mmot_evaluation` when output and expected performance diverge, or when a
   chart needs a truth-based review.

7. Create a narrative beat when the work produced a significant learning moment across
   engineer-world, ceremony-world, and story-engine-world.

## Tool Map

Generated from the server's own tool definitions, so it cannot list a tool that is not
served or omit one that is.

{{TOOL_MAP}}

Two names appear in both the narrative and PDE groups with different meaning.
`add_action_step`, `update_action_progress`, `mark_action_complete`, and
`update_current_reality` target the narrative chart; their `pde_`-prefixed twins target
the PDE session. Calling the wrong one writes to the wrong store and reports success.

## References

- `references/creative-orientation.md` — the creation-vs-problem-solving distinction
- `references/structural-tension-charting.md` — chart and action-step rules
- `references/delayed-resolution.md` — current reality discipline
- `references/narrative-beats.md` — story archive usage
- `references/wampum-belts.md` — non-linear mnemonic sequencing
- `references/reading-the-store.md` — reading a chart store without re-deriving its shape
- `references/beyond-narrative.md` — PDE, planning, Langfuse, pipeline
- `references/mcp-tools.md` — feature levels and environment variables
- `references/install-and-environment.md` — install, run, and the refusals worth knowing

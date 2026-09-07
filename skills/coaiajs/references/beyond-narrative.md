# Beyond Narrative

`coaiajs` consolidates four CoAIA sub-projects. The chart engine is the centre, but three
other surfaces feed it and one observes it.

The tools themselves are in SKILL.md's generated Tool Map. This file is what the map cannot
tell you: when to reach for each surface, and where they overlap dangerously.

## PDE — Prompt Decomposition Engine

Decomposes a complex prompt into an intent map — primary intent, secondary intents,
context requirements, expected outputs, and the four directions — then turns that map into
a chart.

Four of its tools carry a `pde_` prefix — `pde_add_action_step`,
`pde_update_action_progress`, `pde_mark_action_complete`, `pde_update_current_reality` —
because their unprefixed names belong to the narrative group. `add_action_step` targets the
narrative chart; `pde_add_action_step` targets the PDE session. Getting this wrong writes
to the wrong store and reports success.

```bash
coaia pde --help
```

## Planning

Parses a structured plan file into structural tension form and keeps it in sync with a
chart store, in both directions.

Choose the sync direction deliberately: `sync_plan_to_chart` treats the plan as
authoritative, `sync_chart_to_plan` treats the chart as authoritative. Both write.

```bash
coaia plan --help
```

## Langfuse

Traces, observations, scores, prompts, datasets, comments, and media, over the Langfuse
REST API. Use it to make the chart work observable rather than to store it — the JSONL
store remains the record.

```bash
coaia fuse traces list
coaia fuse trace view <traceId>
coaia fuse prompts get <name>
```

The `coaia_fuse_*` MCP tools mirror these. Media tools are `FULL`-level only.

## Pipeline

A Jinja2-style template engine for prompt pipelines, exposed as the `coaia://templates/`
MCP resources and the `coaia pipeline` commands.

```bash
coaia pipeline list
coaia pipeline run <name>
```

## Redis shorthand

`tash` / `fetch` are the COAIA SET/GET shorthand, used for stashing plan perspectives and
intermediate content:

```bash
coaia tash mykey "value"
coaia fetch mykey
```

Prefer the CLI over the MCP tool for these — it is the more reliable path.

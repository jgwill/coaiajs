# Beyond Narrative

`coaiajs` consolidates four CoAIA sub-projects. The chart engine is the centre, but three
other surfaces feed it and one observes it.

## PDE — Prompt Decomposition Engine

Decomposes a complex prompt into an intent map — primary intent, secondary intents,
context requirements, expected outputs, and the four directions — then turns that map into
a chart.

| Tool | Use |
|---|---|
| `import_pde_decomposition` | Bring a decomposition JSON into the session store |
| `create_stc_from_pde` | Turn a decomposition into a structural tension chart |
| `list_pde_decompositions` | See what has been imported |
| `get_session`, `list_sessions`, `complete_session` | Session lifecycle |
| `pde_update_action_progress`, `pde_mark_action_complete`, `pde_add_action_step`, `pde_update_current_reality` | The chart verbs, targeting the PDE session |

The last four carry a `pde_` prefix because their unprefixed names belong to the narrative
group. Calling `add_action_step` targets the narrative chart; `pde_add_action_step`
targets the PDE session. Getting this wrong writes to the wrong store and reports success.

```bash
coaia pde --help
```

## Planning

Parses a structured plan file into structural tension form and keeps it in sync with a
chart store, in both directions.

| Tool | Use |
|---|---|
| `parse_plan_structural` | Read a plan file into chart shape |
| `plan_to_stc` | Create charts from a plan |
| `sync_plan_to_chart` | Plan is authoritative |
| `sync_chart_to_plan` | Chart is authoritative |
| `create_plan_trace` | Emit a Langfuse trace for the plan |
| `pde_to_plan` | Turn a decomposition into a plan |

Choose the sync direction deliberately. Both write.

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

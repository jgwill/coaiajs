# MCP Tools And Environment

The MCP server is `coaiajs-mcp`. It speaks stdio and serves tools, prompts, and resources.

## Feature levels

`COAIAJS_FEATURES` selects the tool set. Default is `STANDARD`.

| Level | Serves |
|---|---|
| `MINIMAL` | Redis shorthand and the core Langfuse read/write tools |
| `STANDARD` | Default — everything except the media tools |
| `OBSERVABILITY` | Langfuse-focused |
| `FULL` | Everything, including media upload/get |

Pass `--features <LEVEL>` on the command line to override the environment.

## Tool groups (library-side)

`coaiajs/narrative` exports these name lists so a caller can gate its own surface:

| Group | Contents |
|---|---|
| `CORE_TOOLS` | The minimal list / create / add / complete workflow |
| `STC_TOOLS` | Chart creation, action steps, progress, reality, outcome, due date, GitHub link, MMOT |
| `NARRATIVE_TOOLS` | Narrative beat creation, telescoping, listing |
| `WAMPUM_TOOLS` | Belt creation, bead placement, belt reading |
| `KG_TOOLS` | Lower-level knowledge graph entities and relations |

Prefer STC tools for chart work. Use KG tools only when deliberately managing generic
entities and relations — they bypass the chart-shaped validation.

## Environment variables

| Variable | Purpose |
|---|---|
| `COAIAJS_FEATURES` | Feature level: `MINIMAL` / `STANDARD` / `OBSERVABILITY` / `FULL` |
| `COAIAJS_MEMORY_PATH` | Default JSONL store path for CLI and MCP server |
| `COAIA_CURRENT_CHART_ID` | Chart the CLI treats as current (`coaia narrative current`) |
| `REDIS_URL` / `REDIS_HOST` etc. | Redis endpoint for `tash` / `fetch` |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | Langfuse credentials |
| `OPENAI_API_KEY` | LLM and transcription calls |

Config resolution order is: environment variables, then `.env`, then `coaia.json`.

## Arguments this server will tell you about

Two behaviours worth relying on:

**Unknown arguments are named, not swallowed.** A tool call carrying a key the schema does
not know still succeeds, but the result appends:

```
⚠️ Ignored unrecognised argument(s): dueDte. They were NOT applied — check the tool's inputSchema for the accepted names.
```

A dropped argument is otherwise invisible from the caller's side — the call succeeds, the
record is written, and the ignored part looks exactly like an honoured one.

**Every validation problem is reported at once.** Two missing required fields come back in
one message rather than costing a round trip each.

**`telescope_action_step` accepts `actionSteps`** as an alias for `initialActionSteps`,
because its sibling `create_structural_tension_chart` names the same concept `actionSteps`
and callers reach for that name.

## Refusals

A call whose argument tags did not parse arrives with its own raw text inside a value.
That is refused at the write boundary, with the fragment quoted and nothing written:

```
Malformed call refused — nothing was written.

`currentReality` carries unparsed call syntax, not prose:
    </currentReality>
That is a closing tag for the 'currentReality' argument.
```

The refusal exists because that text used to persist verbatim: a live store was found
carrying seven observations ending in `</currentReality>` followed by a parameter block,
rendered as prose by every consumer since. A read-side filter arrives too late — anything
that reaches the JSONL is already in every reader's render.

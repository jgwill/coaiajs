# Structural Tension Charting

A chart has three core parts:

1. **Desired Outcome** — what the user wants to create.
2. **Current Reality** — the honest present state in relation to that outcome.
3. **Action Steps** — strategic secondary choices that support the primary choice.

Action steps are not independent checklist items. They must make sense together as an
overview strategy. Test them with: "If these steps were taken, would the desired outcome
likely be created?"

Each action step is a telescoped chart. Its title becomes the desired outcome of the child
chart, and it needs its own current reality. Never use "ready to begin" as that reality.

Good current reality examples:

- "No Django experience."
- "Package builds locally, publish dry-run not inspected."
- "Budget: $5000."
- "Completed models section, struggling with views."

Poor current reality examples:

- "Ready to begin."
- "Need to retrieve the notes."
- "Excited to start."
- "Prepared to tackle the action step."

## How a chart is laid out in the store

For a chart with id `chart_1757200000000`:

| Entity | `entityType` |
|---|---|
| `chart_1757200000000_chart` | `structural_tension_chart` |
| `chart_1757200000000_desired_outcome` | `desired_outcome` |
| `chart_1757200000000_current_reality` | `current_reality` |
| `chart_1757200000000_action_1` … `_action_N` | `action_step` |

A telescoped child chart is a full chart of its own, carrying `metadata.parentChart` and,
when it grew out of a specific step, `metadata.parentActionStep`.

## The two shapes work takes

This is the single most common source of a wrong reading. A chart holds its work in **two**
shapes:

1. `action_step` entities that live on the chart itself.
2. Telescoped child charts, which is what `add_action_step` produces.

Counting or rendering only one of them under-reports. A chart built entirely with
`add_action_step` used to report `0/0` progress while holding real work, and a chart
holding eight of its own steps used to render as "(No action steps yet)".

A child telescoped out of one of the chart's own steps is that same result seen closer up.
It counts **once**, through the step — not twice.

`getChartProgress`, `listActiveCharts`, `updateChartDueDate`, and
`coaiajs/narrative/contract`'s `getWork()` all apply that rule. Prefer them over walking
the graph by hand.

## Moving a date

Use `update_chart_due_date`. It moves the chart and its desired outcome together, records
the move as an observation on the chart, and reports how many open steps still fall after
the new date. Pass `redistributeActionSteps: true` to spread those open steps evenly
between now and the new date.

Do not hand-edit the JSONL to change a date. Several MCP instances can point at one store
with no lock; a hand-edit races every one of them.

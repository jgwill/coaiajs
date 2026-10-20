# Delayed Resolution

Tolerate discrepancy and delayed resolution. Do not smooth over the contradiction between
desired outcome and current reality.

When information is missing, ask for current reality or name the missing reality
explicitly. Do not invent readiness.

`create_structural_tension_chart` refuses a current reality containing "ready to",
"prepared to", "all set", "ready for", or "set to", and answers with the principle. That
refusal exists because a readiness assumption prematurely resolves the tension the chart
was created to hold.

## MMOT — the Managerial Moment of Truth

Run `perform_mmot_evaluation` when output and expected performance diverge. Four phases,
in order:

1. **Acknowledge** the difference between expected and delivered.
2. **Analyze** how it came to pass.
3. **Update** the chart and current reality.
4. **Recommit** or redirect based on what is now true.

Call with `phase` set to one of those, or omit it for `full`.

## What `updateReality` governs

`updateReality` controls **one** record: the append into current reality. The chart's own
`metadata.mmotEvaluations[]` trail is a separate record and is written whenever an
assessment was made.

An earlier version gated both on that one flag, so a caller who only asked to leave
current reality alone lost the evaluation entirely — while still being handed a full
phase response that read like a success. The response line now names which records were
actually written:

- `✅ Evaluation stored: chart MMOT trail + current reality.`
- `✅ Evaluation stored: chart MMOT trail (current reality left untouched, as requested).`

Read that line. A success line that names the wrong record is the same failure class as a
success line over zero bytes.

## Elements of Performance

Pass `elementsOfPerformance` when creating a chart to define what the MMOT will evaluate
against. Each is `{ description, type }` where `type` is `DESIGN` (structural intent,
architecture) or `EXECUTION` (delivery, implementation quality). Without them, MMOT still
runs, but it has nothing concrete to compare the work to.

## Choosing to delay a step's resolution

A due date says when. A delayed resolution says someone **chose** to wait: Fritz calls it
a secondary choice made in favour of a primary one. Record it on the step, do not leave
it as an unexplained late date.

- `delay_resolution` — `actionStepName`, `resolveBy` (an ISO date in the future, which
  becomes the step's due date), `reason`, `chosenBy`; optional `primaryChoice` (defaults
  to the chart's desired outcome), `wakeOn` (event cues, in words) and `session` (the agent
  session to rehydrate: `sessionId`, `agent`, `host`, `cwd`, `tmux`, `resumeCommand`,
  `inventoryRecord`). A completed step is refused. A re-delay keeps the earlier record in
  `metadata.delayedResolutionHistory`.
- `list_delayed_resolutions` — open delays, soonest first, with `daysRemaining` and
  `owed` (the date has passed). `dueWithinDays` narrows it; `includeEnded` widens it.
- `end_delayed_resolution` — `outcome` is `rehydrated` (returns the session's resume
  command) or `released`. The record is kept, with who ended it and when.
- Completing a delayed step (`mark_action_complete`, with `completedBy` when you know who)
  ends its delay as `resolved`, noted `completed`. `resolved` comes only from completion.

A delayed step reads `delayed` in `get_action_step`, `get_chart`, `get_chart_progress`,
`list_active_charts` and the markdown export. `completionStatus` is unchanged by a delay.
The CLI carries the same three: `coaia narrative delay`, `delayed`, `end-delay`.

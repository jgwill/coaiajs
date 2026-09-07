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

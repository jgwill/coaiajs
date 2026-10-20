# 11 — Delayed Resolution

> An action step records that someone strategically chose to delay its resolution, until when, why, for what, and which agent session to rehydrate when the delay ends.

**Status:** 0.7.0. `coaiajs` 0.6.0 (`880b7a7`) brought the record, the three operations, the CLI and the derived status; 0.6.1 (`8565dee`) made completion end a delay as `resolved`, and a consumer installing 0.6.1 from npm ran delay, list and end with exit 0 (Episode 297 `validation/coaiajs/output-261019.txt`). 0.7.0 adds the session's `trace` and `rehydrateWith` (design addition of 2026-10-20, Episode 297 `c06b57cd`) and makes every narrative command honour `-M`; 123 of 123 tests on the release commit. Its consumer run, against `@miadi/llmops` 0.1.0, is kept as Episode 297 `validation/coaiajs/output-261020.txt`.
**Origin:** Miadi Chronicle Episode 297 (`miadi-chronicle://297`), design `2026-07-24-episode-297-mino-bimaadizi-daa-stc-bot-ceremony/delayed-resolution-design-261019.md`, shared with `coaia-narrative` and the medicine wheel. coaiajs carries its own port and depends on neither.
**Lineage:** coaia-narrative's `delayed-resolution` (0.24.0, 0.24.1) is the sibling implementation; the two were built the same night from the same design.

## Desired Outcome

A person or an agent holding a structural tension chart in coaiajs can:

1. choose to delay a step's resolution until a date, saying why and what the delay serves, with the agent session that holds the work;
2. list every delayed step by that date, with the days remaining and which are now owed;
3. end a delay by rehydrating its session (and receive the command that resumes it) or by releasing the step;
4. see a delay end as `resolved` when the step is completed.

Fritz, course lesson `LAA-w04-22bc-Delay_Resolution`: "Part of the maturation process is to learn how to delay resolution in favor of longer-term goals." The delay "is a secondary choice to our primary choice". William, 2026-10-19: "It's not just there is a due date... there is a due date and we chose to delay resolution."

**Two meanings of the phrase in this package.** The older one, in `create_structural_tension_chart`'s refusal of "ready to" in current reality and in `skills/coaiajs/references/delayed-resolution.md`, means holding the tension instead of resolving it early by assumption. This spec is about the newer one: a recorded choice to wait on a step. The skill reference covers both.

## Structural Tension

**Current Reality:**
- Before 0.6.0 a step carried `metadata.dueDate` and nothing said that someone chose to wait. No step linked to an agent session, and no listing ordered steps by date.
- From 0.6.0, [`src/narrative/delayed-resolution.ts`](../src/narrative/delayed-resolution.ts) holds the pure half (status, days remaining, owed, resume command, rendering), and [`src/narrative/graph-manager.ts`](../src/narrative/graph-manager.ts) writes the records (`delayResolution`, `listDelayedResolutions`, `endDelayedResolution`, `markActionStepComplete`).
- The MCP server exposes the three tools at every feature level that loads narrative tools (STANDARD: 70 tools, FULL: 72, measured on the server built from 0.6.1 with `tools/list`).
- The CLI carries `coaia narrative delay`, `delayed`, `end-delay`, and `complete --by`.
- From 0.7.0 a session carries `trace` and `rehydrateWith`, the two addresses `@miadi/llmops` 0.1.0 prints (jgwill/Miadi#829), and ending a delay as `rehydrated` hands them back beside `resumeCommand`.

**Desired Outcome:** every surface of the package (library, MCP, CLI, markdown export) says the same thing about the same delayed step, and the record is kept whole after it ends.

## The record

Written camelCase in the step entity's `metadata`, with the same fields and meaning as the design's snake_case record.

```typescript
interface AgentSessionRef {
  sessionId: string;          // required
  agent?: string;             // "claude" when not given
  host?: string; cwd?: string; tmux?: string;
  resumeCommand?: string; inventoryRecord?: string;
  trace?: string;             // 0.7.0: the session's LLMOps record, begins with "miadi-"
  rehydrateWith?: string;     // 0.7.0: the pinned prompt version that rehydrates it, begins with "miadi-"
}

type DelayedResolutionOutcome = 'rehydrated' | 'released' | 'resolved';

interface DelayedResolution {
  chosenAt: string;           // ISO, set by the tool
  chosenBy: string;
  resolveBy: string;          // ISO, in the future when chosen
  reason: string;
  primaryChoice?: string;     // defaults to the chart's desired outcome, copied when chosen
  wakeOn?: string[];          // event cues, in words
  session?: AgentSessionRef;
  endedAt?: string; endedBy?: string;
  outcome?: DelayedResolutionOutcome;
  endNote?: string;
}

// on a step entity's metadata:
delayedResolution?: DelayedResolution;            // the current delay, open or ended
delayedResolutionHistory?: DelayedResolution[];   // earlier records, oldest first

type ActionStepStatus = 'completed' | 'delayed' | 'pending';   // derived, never stored
```

A step is named the way the package's other step tools name it: a written step (`chart_123_action_1`), a telescoped step's `<chart>_desired_outcome`, or a telescoped chart's id, which resolves to its desired outcome. A top-level chart's `<chart>_desired_outcome` is also accepted; coaia-narrative refuses that case.

## Rules

1. Choosing a delay sets the step's `dueDate` to `resolveBy`. For a telescoped step, the step's desired outcome and its chart carry the date together; a written step that grew a child chart carries that chart along.
2. A completed step is refused. `resolveBy` must parse as a date and lie in the future. `reason` and `chosenBy` are required. A `session` must carry a `sessionId`. A session's `trace` and `rehydrateWith`, when given, must each be a string beginning with `miadi-` (case-sensitive; an empty string is refused) and are stored exactly as given. The chart does not resolve them: that is `@miadi/llmops`' work.
3. Delaying a step that already carries a record, open or ended, moves that record to `delayedResolutionHistory` and writes the new one.
4. Ending keeps the record with `endedAt`, `endedBy`, `outcome` and an optional `endNote`. `completionStatus` is never changed by a delay, so the step reads as it did before.
4b. Completing a delayed step (`markActionStepComplete(name, completedBy?)`, `mark_action_complete` with `completedBy`, `coaia narrative complete --by`) ends its open delay with `outcome: "resolved"`, `endedBy` = the completer or `"mark_action_complete"`, `endNote: "completed"`. A delay already ended is not rewritten.
5. The derived status: `completed` when `completionStatus` is true (it wins over an open delay), else `delayed` while a delay is open, else `pending`.
6. Owed: an open delay whose `resolveBy` is at or before now. An ended delay is never owed.
7. Free-text arguments (`reason`, `primaryChoice`, `wakeOn`, `endNote`) are refused when they carry unparsed call syntax, as in the package's other writing operations.

## Operations

| library | MCP tool | CLI | input | result |
|---|---|---|---|---|
| `delayResolution(name, opts)` | `delay_resolution` | `coaia narrative delay <name> --resolve-by --reason --chosen-by [--primary-choice] [--wake-on]... [--session-id --agent --host --cwd --tmux --resume-command --inventory-record --trace --rehydrate-with]` | `actionStepName`, `resolveBy`, `reason`, `chosenBy`, optional `primaryChoice`, `wakeOn[]`, `session` | the listing entry of the new delay; `historyCount` says how many earlier records were kept |
| `listDelayedResolutions(opts)` | `list_delayed_resolutions` | `coaia narrative delayed [--within <days>] [--all]` | optional `dueWithinDays` (≥ 0), `includeEnded` | entries sorted by `resolveBy`, soonest first |
| `endDelayedResolution(name, opts)` | `end_delayed_resolution` | `coaia narrative end-delay <name> --by <who> --outcome <rehydrated\|released> [--note]` | `actionStepName`, `endedBy`, `outcome`, optional `endNote` | the closed entry; when rehydrated, `resumeCommand`, `trace` and `rehydrateWith`, each when known |

- A listing entry is the record plus `actionStepName`, `title`, `chartId` (the chart the step advances), `telescopedChartId` (for a telescoped step), `status`, `dueDate`, `daysRemaining`, `owed`, `historyCount`.
- `daysRemaining` is whole days to `resolveBy`, rounded up, never `-0`: 0 within the last day, negative once owed.
- Without `includeEnded`, only steps whose derived status is `delayed` are listed. With it, steps whose latest record has ended (or whose step was completed while the delay stood) appear too. Records in history are not listed.
- `dueWithinDays: N` keeps entries resolving at or before now + N days, owed ones included.
- `end_delayed_resolution` accepts only `rehydrated` and `released`; `resolved` is refused with a message naming `mark_action_complete`. `rehydrated` is refused when the record has no session.
- `resumeCommand`: the stored one; for a `claude` session without one, `claude --resume <sessionId>`, prefixed by `cd <cwd> && ` when `cwd` is known; for any other agent, none is guessed.
- When a delay ends as `rehydrated`, the entry carries `trace` and `rehydrateWith` at its top level, copied from the session, each only when the session holds it. `released` returns neither; the record keeps them either way. `delayed` shows them under the session line, and `end-delay` prints them after the resume command.
- `delay`, `delayed`, `end-delay` and `complete` honour the global `-M, --memory-path` (`complete` from 0.6.1; it opened the default store before). From 0.7.0 every narrative command that opens a store does (spec 08).
- The pure helpers are exported from `coaiajs/narrative`: `deriveActionStepStatus`, `openDelay`, `isOwed`, `daysUntil`, `resumeCommandFor`, `formatDelayedResolutionList`, `formatDelayChosen`, `formatDelayEnded`, `DELAYED_RESOLUTION_OUTCOMES`, `COMPLETION_ENDED_BY_DEFAULT`, `MIADI_ADDRESS_PREFIX` (0.7.0).

## Where the status shows

`get_action_step`, `get_chart`, `get_chart_progress` (adds `delayedActions` and `owedActions`), `list_active_charts` and the markdown export report the derived status and, for an open delay, "delayed until <date> (in N days | due today | owed by N days)". Listing marks: ✅ completed, ⏸️ delayed, ⏰ owed, 🎯 pending. `nextAction` in `get_chart_progress` is the incomplete step due earliest, delayed ones included (the medicine wheel skips them).

`get_action_step` reads a written step as itself plus any chart it grew into, and a telescoped step as its chart. Before 0.6.0 it answered "not found" for every written step, because nothing in this package writes `telescopes_into`.

## Creative Advancement Scenarios

**Creative Advancement Scenario**: Setting a session aside until a date

**User Intent**: William sets aside a session he will not need for two weeks and wants it back on that date with its reason intact.
**Current Reality**: The step sits on a coaiajs chart with a due date, and the session that was working on it is idle.
**Natural Progression Steps**:
  1. `coaia narrative delay chart_123_action_2 --resolve-by 2026-11-03 --reason "..." --chosen-by william --session-id <id> --cwd <dir>` records the choice; the step's due date becomes 2026-11-03.
  2. `coaia narrative delayed` places it among the other delays, soonest first, and marks it owed once the date passes.
  3. On the date, `coaia narrative end-delay chart_123_action_2 --by william --outcome rehydrated` closes the record and prints `cd <dir> && claude --resume <id>`.
**Achieved Outcome**: The session comes back with the reason it stopped, and the closed record stays on the step.
**Supporting Features**: `delayResolution`, `listDelayedResolutions`, `endDelayedResolution`, `resumeCommandFor`.

**Creative Advancement Scenario**: Rehydrating a session with its trace and its pinned prompt (0.7.0)

**User Intent**: A seat that sets a session aside wants the person who brings it back to receive the session's LLMOps record and the prompt version that restarts it, not only the resume command.
**Current Reality**: `npx @miadi/llmops rehydrate --domain ceremony --trace <T> --mission miadiRun-<name>.v<N>` prints `trace` and `rehydrate_with` for the session.
**Natural Progression Steps**:
  1. `coaia narrative delay <step> ... --session-id <id> --cwd <dir> --trace <trace> --rehydrate-with <rehydrate_with>` stores both on the session, as printed.
  2. `coaia narrative delayed` shows them under the session line.
  3. `coaia narrative end-delay <step> --by <who> --outcome rehydrated` prints the resume command, then `trace:` and `rehydrateWith:`.
**Achieved Outcome**: The session comes back with the trace that recorded it and the prompt version that restarts it, both exactly as `@miadi/llmops` printed them.
**Supporting Features**: `AgentSessionRef.trace`, `AgentSessionRef.rehydrateWith`, `MIADI_ADDRESS_PREFIX`, `formatDelayEnded`.

**Creative Advancement Scenario**: A delayed step is completed before its date

**User Intent**: Work that was set aside gets done another way, earlier.
**Current Reality**: The step holds an open delay and a session that no longer needs to come back.
**Natural Progression Steps**:
  1. `coaia narrative complete chart_123_action_2 --by mia` completes the step.
  2. The open delay ends with `outcome: "resolved"`, `endedBy: "mia"`, `endNote: "completed"`.
**Achieved Outcome**: Nobody rehydrates a session whose work is done, and the record shows the delay ended in resolution.
**Supporting Features**: rule 4b, `markActionStepComplete(name, completedBy)`.

## Out of scope

- The clock that steers a session before `resolveBy`. Who runs it is undecided (Episode 297, resolve-by 2026-10-27).
- Writing these fields from the session inventory, which owns its own records.

## Quality Criteria

- ✅ A completed step cannot be delayed, and a past `resolveBy` is refused
- ✅ A re-delay keeps the earlier record in history
- ✅ Ending keeps the record and leaves `completionStatus` untouched
- ✅ Completing a delayed step ends its delay as `resolved`
- ✅ Library, MCP, CLI and markdown export report the same derived status
- ✅ A session's `trace` and `rehydrateWith` are refused unless they begin with `miadi-`, stored as given, and returned when rehydrated
- ✅ `test/delayed-resolution.test.mjs` covers the three operations, rule 4b and the session's LLMOps fields (31 tests)

## Implementation Links

| behaviour | file |
|---|---|
| record types | [`src/types.ts`](../src/types.ts) |
| pure half: status, days, owed, resume command, rendering | [`src/narrative/delayed-resolution.ts`](../src/narrative/delayed-resolution.ts) |
| writes | [`src/narrative/graph-manager.ts`](../src/narrative/graph-manager.ts) |
| MCP schemas and handlers | [`src/narrative/tool-definitions.ts`](../src/narrative/tool-definitions.ts), [`src/narrative/tool-handlers.ts`](../src/narrative/tool-handlers.ts) |
| CLI | [`src/cli.ts`](../src/cli.ts) `delay`, `delayed`, `end-delay`, `complete`; helpers in [`src/narrative/index.ts`](../src/narrative/index.ts) |
| agent-facing guide | [`skills/coaiajs/references/delayed-resolution.md`](../skills/coaiajs/references/delayed-resolution.md) |
| tests | [`test/delayed-resolution.test.mjs`](../test/delayed-resolution.test.mjs) |

# Narrative Beats

Narrative beats document significant learning moments. They are not replacements for
charts or action steps, and they are not routine task tracking.

Create a beat when a moment matters across multiple perspectives:

- **engineer-world** — technical structure and consequences
- **ceremony-world** — relational protocol and accountability
- **story-engine-world** — narrative progression and meaning

A useful beat carries title, act, dramatic type, universes, description, prose, and
lessons. Use beats after a real transition, discovery, crisis, MMOT, or integration
moment.

## Tools

| Tool | Use |
|---|---|
| `create_narrative_beat` | Archive a significant multi-universe learning moment |
| `telescope_narrative_beat` | Break a beat into sub-beats with their own current reality |
| `list_narrative_beats` | Review the archive, optionally filtered by parent chart |

## Beat-level session context

`metadata.sessionContext` records the embodied condition of the session a beat came from:
`mode` (voice / terminal / mixed), `setting` (desk / walking / land-based / transit),
`landBasedLearning`, `environmentNotes`, `captureQuality`, and whether a public summary is
allowed. Use it when the conditions of the work are part of what the beat means.

`metadata.sessionLineage` records conversation branching — parent chart, source beat,
original and branch session ids, branch purpose, and handoff state — so a branch map can
be reconstructed later.

## The legacy on-disk dialect

Some live stores hold beats written with a top-level `type: "narrative_beat"` rather than
`type: "entity"` with `entityType: "narrative_beat"`. Both are read, both round-trip as
themselves, and a writer never flattens one into the other.

This matters to anyone reading the store directly: a reader that does not know the legacy
dialect renders **fewer beats than exist** and may report the difference as corruption.
Use `coaiajs/narrative/contract` rather than classifying records by hand — see
`reading-the-store.md`.

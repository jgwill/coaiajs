# Wampum Belts

A Wampum Belt is a non-linear mnemonic grid that runs in **parallel** with the linear
narrative beats. Beats are a sequence; a belt is a surface where position itself carries
meaning.

Reach for a belt when the order of things is not a line: when a reading depends on where
it sits relative to its neighbours, when several perspectives on one bead are all true,
or when a commitment needs a witness rather than a timestamp.

## Shape

A belt has `rows` × `cols` positions. Each position holds at most one bead, written once.

A bead carries:

| Field | Meaning |
|---|---|
| `mnemonic` | Short anchor phrase |
| `color` | `white`, `purple`, `black`, or `mixed` |
| `position` | `{ row, col }`, zero-indexed, inside the grid |
| `reading` | The canonical meaning |
| `relationalReadings` | Optional per-perspective readings, keyed `left` / `center` / `right` / `row:N` / `col:N` |
| `ceremonyLink` | Optional tie to a chart or a beat |
| `observations` | Free notes |

`read_wampum_belt` with a `position` resolves the reading for that position: it prefers
`col:N`, then `row:N`, then the positional label (`left` / `center` / `right`), and falls
back to the canonical `reading`.

## Ceremony links

`ceremonyLink.ceremonyType` is one of `commitment`, `accountability`, `witness`, or
`renewal`. With `chartId` it writes a `wampum_holds_accountable` edge to that chart; with
`beatName` it writes a `wampum_witnesses` edge to that beat.

**The edge is subject to the bead, not the belt.** A relation's identity in the store is
`(from, to, relationType)`. With the belt as subject, a second bead linking the same chart
under a different `ceremonyType` collided on that triple: the existence check matched, the
edge was skipped, and the bead kept a ceremony type the graph had no edge for. Silent
discard, with the bead's own record disagreeing with the graph and nothing saying so.

A bead id is `bead_<beltId>_<row>_<col>` and a position is written once, so
`(bead, target, relationType)` is unique by construction and every ceremony link survives
carrying its own type.

## Tools

```json
{ "tool": "create_wampum_belt",
  "arguments": { "title": "Release ceremony", "purpose": "Hold what each step promised", "rows": 2, "cols": 3 } }
```

```json
{ "tool": "add_wampum_bead",
  "arguments": {
    "beltId": "belt_1757200000000",
    "mnemonic": "witnessed",
    "color": "purple",
    "position": { "row": 0, "col": 1 },
    "reading": "The publish was seen by someone other than its author",
    "relationalReadings": { "center": "seen from the middle of the belt" },
    "ceremonyLink": { "ceremonyType": "witness", "chartId": "chart_1757200000000" }
  } }
```

```json
{ "tool": "read_wampum_belt", "arguments": { "beltId": "belt_1757200000000" } }
```

Out-of-bounds positions, occupied positions, and non-integer grids are refused with the
reason named.

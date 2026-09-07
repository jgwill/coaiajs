# Reading the Store

`coaiajs` owns the writes. Anything that renders a chart store — a dashboard, a report, a
Twine promotion, another agent — needs the store's shape, and re-deriving that shape by
hand is where readers quietly go wrong.

It is not a style problem. When a hand-rolled reader drifts from the writer, it does not
break: it renders **less**. A chart holding real work looks identical to an empty one.

## Use the contract

```typescript
import { parseStore, getWork, getChartEntity } from 'coaiajs/narrative/contract';
import { readFile } from 'node:fs/promises';

const store = parseStore(await readFile('./memory.jsonl', 'utf8'));
const chart = getChartEntity(store, 'chart_1757200000000');
const work  = getWork(store, 'chart_1757200000000');
```

The contract keeps three rules:

1. **Zero I/O.** No `fs`, no `process`, no network. The caller owns reading; this owns
   shape.
2. **Never imports the server.** The package root is safe to import, but the contract
   lives behind its own subpath so a renderer pulls nothing it does not need.
3. **Tolerant by construction, honest about what it skipped.** One unparseable line is
   skipped and counted in `skipped`, where `parseJsonlMemory` — correctly, for a writer —
   throws.

Classification is **not** defined in the contract. `jsonl-records.ts` holds the single
definition, and both the writer and the contract import it. The first draft of the
contract re-implemented classification by hand and a review measured it returning 73
entities where the writer returned 76: it dropped the legacy `type:"narrative_beat"`
dialect and reported the losses as corruption. Duplication relocated rather than removed.

## What it gives you

| Export | Use |
|---|---|
| `parseStore(raw)` | `{ entities: Map, relations: [], skipped: number }` |
| `ENTITY_TYPES` | Every entity kind the writer writes |
| `MMOT_PHASES`, `CREATING_PHASES` | The vocabularies, including `full` |
| `chartEntityName`, `desiredOutcomeName`, `currentRealityName` | The naming scheme, once |
| `getChartEntity`, `getDesiredOutcome`, `getCurrentReality` | Chart parts by id |
| `getFlatActionSteps`, `getChildCharts`, `getWork` | The two shapes work takes, counted once |
| `getMmotBeats`, `getMmotEvaluations` | The MMOT trail |
| `storeRevision`, `revisionOf` | Cheap change detection between reads |

## What `skipped` cannot tell you

Writes are temp-file-plus-rename, so a reader should never see a torn file and
`skipped > 0` genuinely suggests a foreign or damaged line.

But a store truncated by something *other* than this package can still be a syntactically
perfect prefix: every whole line parses, and the result is simply a smaller store with
`skipped === 0`. No reader can detect that from content alone. If it matters, compare
entity counts across reads.

## Writing from outside

If you must write, go through `KnowledgeGraphManager` or
`readJsonlMemoryFile` / `writeJsonlMemoryFile`. They preserve fields this package does not
model — another consumer's metadata survives — and they write atomically. A bare
`writeFile` over the store truncates first, and a reader landing in that window gets a
valid partial store.

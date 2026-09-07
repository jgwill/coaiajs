# Lineage: coaia-narrative → coaiajs

## What the relationship is

`coaiajs` is the package we maintain. `avadisabelle/coaia-narrative` is where several of
these ideas were first built and several of these bugs were first paid for.

That makes this a **one-way port, not a mirror**. We read that repository for corrections
worth carrying, we decide what shape they take here, and we own the result. Nothing in
this package is expected to stay byte-identical to anything over there, and a future
instance should not treat a difference as drift to be undone.

The direction never reverses. We do not push changes back, and we do not wait on that
repository before fixing something here.

## Ported through

| | |
|---|---|
| Upstream repo | `avadisabelle/coaia-narrative` (`git@github.com:avadisabelle/coaia-narrative.git`) |
| Original snapshot taken at | `12c60f8` (2026-03-08) — landed here as `d6a544e`, 2026-03-11 |
| **Ported through** | **`68f6e2f`** — merge of PR #55, upstream v0.16.2, 2026-08-11 |
| Landed here as | `03658fa` (narrative parity) and the commit adding this file |
| Tracking issue | jgwill/coaiajs#13 |

**Update the "Ported through" row in the same commit that lands the next port.** It is the
only record of where the last one stopped, and a port that does not update it costs the
next instance the whole diff again.

## How to find the next port

```bash
UPSTREAM=/path/to/coaia-narrative        # or: git clone git@github.com:avadisabelle/coaia-narrative.git
PORTED_THROUGH=68f6e2f

cd "$UPSTREAM" && git fetch --all

# What changed in code since we last looked
git diff --stat "$PORTED_THROUGH..origin/main" -- '*.ts'

# Release-shaped commits carry their reason in the subject line — read these first,
# they are usually one measured failure each
git log --oneline "$PORTED_THROUGH..origin/main"

# The full text of one change, with its comments, which is where the reasoning lives
git show <sha>
```

Upstream writes its commit subjects as the failure that was found, not as the change that
was made ("a --memory-path carrying an unexpanded shell variable is refused"). Read the
subject lines before the diff — they tell you which changes carry a real finding and which
are packaging.

## How to port

The two trees are not diff-compatible. When the March snapshot was taken it was
reformatted (single quotes, trailing commas, prettier widths), types were moved to
`src/types.ts`, and `LLM_GUIDANCE` was inlined. `git apply` will not work and should not
be attempted. Port **semantically**: read the upstream change, understand the finding
behind it, then write it here in this codebase's shape.

Rules that have held so far:

1. **Carry the reasoning, not just the code.** Upstream comments name the date, the
   measurement, and the cost of the bug. Those comments are the most valuable part of the
   change — a future reader who does not know why a guard exists will delete it. Rewrite
   them for this package's context rather than dropping them.
2. **Adapt anything that names the other package.** Binary names, MCP server names,
   environment variables, and example issue references all differ. A copy that still says
   `cnarrative` or `COAIA_TOOLS` is wrong here even if it compiles.
3. **Put the change where this codebase already puts that kind of thing.** Shared types go
   in `src/types.ts`, not a per-module types file. The memory-path guard belongs in the
   `KnowledgeGraphManager` constructor here, because that covers the CLI, the MCP server,
   and library consumers at once — upstream put it in its single entry point because that
   is all it has.
4. **Write a test per finding.** `tests/narrative-parity.test.js` is organised as one
   `describe` per finding, named for the behaviour it holds. A ported correction with no
   test is a correction that will be un-ported by the next refactor.
5. **Update the docs in the same commit.** `test/docs.test.mjs` fails the build when
   `README.md` / `llms.txt` / `llms-full.txt` disagree with the served tool surface, so
   this is enforced, not optional.

## What has been adapted rather than copied

### The skill (`src/skill.ts`, `skills/coaiajs/`)

Upstream ships `cnarrative skill show|install`. We ship `coaia skill show|install|check`.
Four deliberate differences:

| | upstream | here | why |
|---|---|---|---|
| Content location | ~250 lines of markdown as a TypeScript string array | real `.md` files under `skills/coaiajs/`, shipped via `files` | a doc change should read as a doc diff, and markdown tooling should be able to see it |
| Tool map | hand-written table | generated from `ALL_TOOL_DEFINITIONS` at render time | a hand-written map advertises tools the server does not serve the moment one is added |
| Subject | `coaia-narrative`, `cnarrative`, `COAIA_TOOLS` | `coaiajs`, `coaia`, `coaiajs-mcp`, `COAIAJS_FEATURES` | it has to describe the surface it actually installs next to |
| Staleness | not detectable | `coaia skill check`, plus `packageVersion` in the installed frontmatter | a skill installed by an older version describes an older surface and nothing else says so |

The reference set is also larger, because this package has more surface: `wampum-belts.md`,
`reading-the-store.md`, and `beyond-narrative.md` (PDE, planning, Langfuse, pipeline) have
no upstream counterpart.

**If upstream changes its skill content, do not copy the change in.** Read what it learned
and decide whether it applies to our surface. These are two skills describing two packages.

### The read contract subpath

Upstream publishes `coaia-narrative/contract` because its package root **is** the MCP
server bootstrap — importing it starts a stdio server, so a renderer must have a separate
door. Our root is a plain library and has no such hazard. We publish
`coaiajs/narrative/contract` anyway, because the other reason holds: a renderer should be
able to pull the store's shape without pulling the whole package.

## Deliberately not ported

| Upstream | Why not |
|---|---|
| `index.ts` / `cli.ts` entry points | We have our own, with a different command surface and argument style |
| `generated-llm-guidance.ts` | Inlined here as `LLM_GUIDANCE_FULL` / `_QUICK` / `_SAVE_DIRECTIVE` in `src/narrative/tool-handlers.ts` |
| `src/help.ts`, `src/tool-groups.ts` | Commander provides help; the groups live in `src/narrative/tool-definitions.ts` |
| `handlers/` (push, issues, ceremony, story-engine) | Webhook event handlers for that repo's deployment, not library capability |
| `types.ts`'s `Direction = 'EAST' \| 'SOUTH' \| ...` | Unused upstream, and the name is already taken here by the PDE lowercase direction type |
| `scripts/check-schema-parity.cjs` | Bound to that repo's `schema/` fixtures |

Revisit any of these if the reason stops being true. Record the decision here when you do.

## Where this package is deliberately ahead or different

Do not "correct" these back toward upstream:

- **`setDueDate` goes through `updateChartDueDate`.** It used to re-serialise the store by
  hand with `writeFileSync`, which ignored `--memory-path` and dropped unmodelled fields.
- **The memory-path guard is in the constructor**, so it covers library consumers, not only
  a CLI entry point.
- **`mcp/server.ts` catches that guard** and exits 1 with a one-line refusal rather than an
  unhandled throw.
- **`src/version.ts` exports `getPackageRoot()`**, which is how anything shipped beside
  `dist/` (the skill, the Custom GPT specs) is located. Do not reach for `process.cwd()`.
- **Tool counts in the docs are enforced by `test/docs.test.mjs`.** Upstream has no
  equivalent; do not relax ours to match.

## Checklist for the next port

- [ ] `git log --oneline <PORTED_THROUGH>..origin/main` in the upstream checkout; read the subjects
- [ ] `git diff --stat <PORTED_THROUGH>..origin/main -- '*.ts'`
- [ ] For each change: is it a finding, packaging, or entry-point specific?
- [ ] Port the findings semantically, carrying their reasoning as comments
- [ ] One `describe` block per finding in `tests/narrative-parity.test.js`
- [ ] `npm run build && npm test` — the docs suite will catch a stale tool count
- [ ] `coaia skill check` after a local install, if the tool surface changed
- [ ] Update **Ported through** above, and the "not ported" table if a decision changed
- [ ] Bump the version, publish, and note the upstream range in the commit body

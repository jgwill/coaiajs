# Install And Environment

## Install

```bash
npm install -g coaiajs
coaia --version
```

## The skill

```bash
coaia skill show                 # print the packaged SKILL.md
coaia skill install              # write ./.agents/skills/coaiajs
coaia skill install --global     # write ~/.agents/skills/coaiajs
coaia skill install --yes        # also create the .claude/skills/coaiajs symlink
coaia skill install --force      # replace an existing install
coaia skill check                # is the installed skill current?
```

`coaia skill check` compares an installed skill against the packaged one and reports
`current`, `stale`, or `missing`. Run it after upgrading `coaiajs`: a skill installed by an
older version describes an older tool surface, and nothing else will tell you.

The tool map inside `SKILL.md` is generated from the server's own tool definitions at
install time, so an installed skill cannot advertise a tool this package does not serve.
The version it was generated from is recorded in the frontmatter as `packageVersion`.

## Run the MCP server

```bash
coaiajs-mcp --memory-path ./memory.jsonl
COAIAJS_FEATURES=FULL coaiajs-mcp --memory-path ./memory.jsonl
```

## Inspect from the CLI

```bash
coaia narrative list -M ./memory.jsonl
coaia narrative view <chartId> -M ./memory.jsonl
coaia narrative stats -M ./memory.jsonl
coaia narrative progress <chartId> -M ./memory.jsonl
coaia narrative export <chartId> --output chart.md -M ./memory.jsonl
coaia narrative set-date <chartId> 2027-06-01T00:00:00Z --redistribute -M ./memory.jsonl
coaia narrative link-issue <chartId> owner/repo#123 -M ./memory.jsonl
```

## Refusals worth knowing about

### A memory path carrying an unexpanded shell variable

```
Refusing to open memory store: the path contains an unexpanded shell variable.
  got: ${MIADI_CHART_MEMORY_PATH}
```

A seat once booted with that variable unset, so its `.mcp.json` handed the process the
placeholder verbatim. The server started happily and wrote live charts into a file
literally named `${MIADI_CHART_MEMORY_PATH}`. Nothing failed — the charts were simply
somewhere nobody would look, and another seat auditing the boot found them.

The sibling failure is worse and is why this is fatal rather than a warning: had the
variable been set to a path that does not exist, the server would have started **clean and
empty**, and the seat would have reported its whole store lost. A store is the one input
where "start anyway" is never the kind answer.

`$` is legal in a filename, so a path containing `$` alone is fine. Only `${` is refused —
a caller writing that is quoting a shell it expected to have run.

### A bare GitHub issue number

`githubIssue` and `link_chart_to_github_issue` require the full `owner/repo#number` path.
A bare `#42` resolves against whichever repository the reader happens to be in, which is
how an issue from one project ends up cited as another project's.

### A malformed tool call

See `mcp-tools.md`. Nothing is written and the offending fragment is quoted back.

## What this package does not lock

Writes are atomic — temp file, then rename — so a reader never sees a torn store. That
removes torn **reads**; it does not provide compare-and-swap. Two processes that both
load, then both write, still lose the earlier update, and both report success. If several
MCP instances point at one store, keep their write windows apart.

# coaiajs-langfuse — Claude Code Plugin

A Claude Code plugin that registers the `coaiajs-mcp` server — 63 tools, 3 prompts, and a pipeline-templates resource — as an MCP server inside Claude Code. It does not bundle its own copy of the server; it launches the published `coaiajs` npm package on demand via `npx`:

```
npx -y --package=coaiajs coaiajs-mcp
```

That command is declared in `.mcp.json` at the root of this plugin, which Claude Code auto-loads on install.

## Install

From a marketplace source (GitHub):

```
claude plugin marketplace add https://github.com/jgwill/coaiajs
claude plugin install coaiajs-langfuse@coaiajs-marketplace
```

Or from a local checkout:

```
claude plugin marketplace add /a/src/coaiajs/coaiajs-langfuse-claude-plugin
claude plugin install coaiajs-langfuse@coaiajs-marketplace
```

Confirm it registered:

```
claude plugin list
```

## Tool families

- **Structural-tension charts** — desired outcome / current reality / action steps, the core CoAIA data model.
- **Narrative knowledge graph** — entities, relations, and graph queries (from coaia-narrative).
- **PDE (Prompt Decomposition Engine)** — decompose complex prompts into actionable intent maps.
- **Action planning** — structural tension plans and action-step management (from coaia-planning).
- **Redis tash/fetch** — SET/GET shorthand against a Redis store.
- **Langfuse tracing** — trace, span, and observation tools for Langfuse-backed observability.

## Environment variables

The server boots with no configuration — it connects to nothing at import time. Individual tool families activate only when their own credentials are present in the environment Claude Code runs in:

| Variable | Used by |
| --- | --- |
| `REDIS_URL` | tash/fetch |
| `OPENAI_API_KEY` | LLM-backed tools |
| `LANGFUSE_PUBLIC_KEY` | Langfuse tracing |
| `LANGFUSE_SECRET_KEY` | Langfuse tracing |
| `LANGFUSE_BASE_URL` | Langfuse tracing |
| `GITHUB_TOKEN` | GitHub-integration tools |
| AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.) | Polly audio tools |

None of these are set by the plugin itself — they are inherited from whatever shell/environment Claude Code is launched in. Set them in your shell profile, `.env`, or however you normally manage secrets for this machine.

## Versioning

This plugin tracks the published npm `coaiajs` package rather than vendoring source. `.mcp.json` calls `npx -y --package=coaiajs coaiajs-mcp`, which always resolves the latest published version at launch time. To pin a specific version, edit `.mcp.json` and change `--package=coaiajs` to `--package=coaiajs@<version>` (e.g. `coaiajs@0.3.0`).

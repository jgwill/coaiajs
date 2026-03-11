# @octokit/rest: Technical Assessment for CoAiA.js

> Package selection brief — GitHub REST API client replacing coaiapy's raw requests in cogh.py

## Summary & Recommendation

**Use `@octokit/rest` v22.x** (currently 22.0.1). Octokit is the official GitHub-maintained JavaScript client for the GitHub REST API. It replaces coaiapy's `cogh.py` which manually constructs HTTP requests with auth headers. Octokit provides typed methods for every GitHub endpoint, automatic pagination, built-in authentication, and rate limit handling.

**Pin:** `"@octokit/rest": "^22.0.0"`

## What We're Replacing

Coaiapy's `cogh.py` uses raw HTTP requests:

```python
# coaiapy/cogh.py — manual GitHub API
import requests
import os

def _get_github_headers():
    config = read_config()
    token = config.get("github", {}).get("api_token") or os.getenv("GH_TOKEN")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

def list_issues(owner, repo):
    headers = _get_github_headers()
    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues",
        headers=headers
    )
    return response.json()

def get_issue(owner, repo, issue_number):
    headers = _get_github_headers()
    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
        headers=headers
    )
    return response.json()
```

Issues: no pagination handling, no rate limit awareness, no type safety, manual URL construction, no retry logic.

## Options Compared

| Feature | @octokit/rest v22 | Raw fetch/requests | graphql (@octokit/graphql) |
|---------|-------------------|-------------------|--------------------------|
| API coverage | All REST endpoints typed | Manual per endpoint | GraphQL (different paradigm) |
| Authentication | Token, App, OAuth, Action | Manual headers | Same as octokit |
| Pagination | `octokit.paginate()` automatic | Manual `Link` header parsing | Cursor-based (manual) |
| Rate limiting | Built-in retry plugin | Manual `X-RateLimit-*` handling | Same as octokit |
| TypeScript | Full types for every endpoint | Manual interfaces | Partial |
| Request/response hooks | Plugin system | Manual interceptors | Plugin system |
| Bundle size | ~150KB | 0 | ~50KB |
| Maintenance | GitHub-maintained official | N/A | GitHub-maintained official |

## API Overview

### Client Setup

```typescript
import { Octokit } from '@octokit/rest';
import { loadConfig } from '../config.js';

const config = loadConfig();

const octokit = new Octokit({
  auth: config.githubToken ?? process.env.GH_TOKEN,
  userAgent: 'coaiajs/1.0.0',
});
```

### Issues API (replacing cogh.py)

```typescript
// List issues (replaces cogh.list_issues)
async function listIssues(owner: string, repo: string, options?: {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  per_page?: number;
}) {
  const { data } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: options?.state ?? 'open',
    labels: options?.labels?.join(','),
    per_page: options?.per_page ?? 30,
  });
  return data;
}

// Get single issue (replaces cogh.get_issue)
async function getIssue(owner: string, repo: string, issueNumber: number) {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return data;
}

// Create issue
async function createIssue(owner: string, repo: string, title: string, body: string, labels?: string[]) {
  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });
  return data;
}

// Add comment to issue
async function commentOnIssue(owner: string, repo: string, issueNumber: number, body: string) {
  const { data } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  return data;
}
```

### Automatic Pagination

```typescript
// Fetch ALL issues across all pages
async function listAllIssues(owner: string, repo: string) {
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  });
  return issues; // All pages concatenated
}
```

### Session Management (Miadi webhook pattern)

```typescript
// Create issue for agent session tracking
async function createSessionIssue(
  owner: string,
  repo: string,
  sessionId: string,
  metadata: Record<string, string>
) {
  const body = [
    `## Agent Session: ${sessionId}`,
    '',
    '| Key | Value |',
    '|-----|-------|',
    ...Object.entries(metadata).map(([k, v]) => `| ${k} | ${v} |`),
  ].join('\n');

  return createIssue(owner, repo, `Session: ${sessionId}`, body, ['agent-session']);
}

// Update session with results
async function updateSessionIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  results: string
) {
  await commentOnIssue(owner, repo, issueNumber, results);
  
  // Close when session completes
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    state: 'closed',
  });
}
```

### Repository Operations

```typescript
// Get file contents
async function getFileContent(owner: string, repo: string, path: string, ref?: string) {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });
  if ('content' in data) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }
  throw new Error(`${path} is not a file`);
}

// List commits
async function listRecentCommits(owner: string, repo: string, count = 10) {
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: count,
  });
  return data.map(c => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name,
    date: c.commit.author?.date,
  }));
}
```

### Authentication Patterns

```typescript
// Pattern 1: Personal Access Token (default)
const octokit = new Octokit({ auth: process.env.GH_TOKEN });

// Pattern 2: GitHub Actions token
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Pattern 3: GitHub App (for Miadi webhook integration)
import { createAppAuth } from '@octokit/auth-app';

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: config.githubAppId,
    privateKey: config.githubPrivateKey,
    installationId: config.githubInstallationId,
  },
});
```

### Formatting (replacing cogh.format_issues_table)

```typescript
function formatIssuesTable(issues: Awaited<ReturnType<typeof listIssues>>): string {
  const header = '| # | Title | State | Labels | Updated |';
  const separator = '|---|-------|-------|--------|---------|';
  const rows = issues.map(i => 
    `| ${i.number} | ${i.title} | ${i.state} | ${i.labels.map(l => 
      typeof l === 'string' ? l : l.name).join(', ')} | ${i.updated_at?.slice(0, 10)} |`
  );
  return [header, separator, ...rows].join('\n');
}
```

## Integration Plan

1. **Core client:** `src/github/client.ts` — Octokit singleton from config
2. **Issues module:** `src/github/issues.ts` — CRUD + pagination (replaces cogh.py)
3. **Session tracking:** `src/github/sessions.ts` — issue-based session management
4. **Repository module:** `src/github/repos.ts` — file content, commits
5. **CLI command:** `src/commands/gh.ts` — Commander subcommand for GitHub ops
6. **MCP tool:** `mcp/tools/github.ts` — GitHub operations as agent tools
7. **Auth:** Support PAT, Actions token, and GitHub App auth

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 22.0.1 (Feb 2026) |
| Weekly downloads | ~10M+ |
| TypeScript | Full native types for every endpoint |
| Node.js compat | ≥20 (v22 dropped Node 18) |
| Authentication | PAT, OAuth, App, Actions |
| Pagination | Built-in `octokit.paginate()` |
| Rate limiting | Plugin-based retry |
| Maintained by | GitHub (official) |
| License | MIT |

### Ecosystem Packages

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@octokit/rest` | REST API client | Primary — all REST operations |
| `@octokit/graphql` | GraphQL API | Complex queries (PR reviews, nested data) |
| `@octokit/auth-app` | GitHub App auth | Miadi webhook integration |
| `@octokit/webhooks` | Webhook handling | Receiving GitHub webhooks |
| `@octokit/plugin-paginate-rest` | Pagination | Included in @octokit/rest |

## References

- npm: https://www.npmjs.com/package/@octokit/rest
- GitHub: https://github.com/octokit/rest.js
- Docs: https://octokit.github.io/rest.js/v22/
- Auth patterns: https://github.com/octokit/auth-app.js
- Releases: https://github.com/octokit/rest.js/releases

// coaiajs/src/github.ts — GitHub module
// Parity with coaiapy's cogh.py using @octokit/rest

import { Octokit } from '@octokit/rest';
import { getConfig } from './config.js';

let _client: Octokit | null = null;

function getOctokit(): Octokit {
  if (!_client) {
    const cfg = getConfig();
    _client = new Octokit({
      auth: cfg.github?.token ?? process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'],
    });
  }
  return _client;
}

/** Reset client (testing). */
export function resetClient(): void {
  _client = null;
}

export interface Issue {
  number: number;
  title: string;
  state: string;
  body: string | null;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
}

export interface IssueComment {
  id: number;
  body: string;
  user: { login: string } | null;
  created_at: string;
}

/**
 * List issues for a repository.
 * Parity with coaiapy's cogh list_issues.
 */
export async function listIssues(
  owner: string,
  repo: string,
  options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    per_page?: number;
    page?: number;
  },
): Promise<Issue[]> {
  const client = getOctokit();

  const response = await client.issues.listForRepo({
    owner,
    repo,
    state: options?.state ?? 'open',
    labels: options?.labels,
    per_page: options?.per_page ?? 30,
    page: options?.page ?? 1,
  });

  return response.data.map(mapIssue);
}

/**
 * Get a single issue by number.
 */
export async function getIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Issue> {
  const client = getOctokit();

  const response = await client.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return mapIssue(response.data);
}

/**
 * Get comments for an issue.
 */
export async function getIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueComment[]> {
  const client = getOctokit();

  const response = await client.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return response.data.map((c) => ({
    id: c.id,
    body: c.body ?? '',
    user: c.user ? { login: c.user.login } : null,
    created_at: c.created_at,
  }));
}

function mapIssue(data: Record<string, unknown>): Issue {
  const d = data as {
    number: number;
    title: string;
    state: string;
    body: string | null;
    labels: Array<{ name?: string } | string>;
    assignees: Array<{ login: string }> | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    user: { login: string } | null;
  };

  return {
    number: d.number,
    title: d.title,
    state: d.state,
    body: d.body,
    labels: (d.labels ?? []).map((l) =>
      typeof l === 'string' ? { name: l } : { name: l.name ?? '' },
    ),
    assignees: (d.assignees ?? []).map((a) => ({ login: a.login })),
    created_at: d.created_at,
    updated_at: d.updated_at,
    html_url: d.html_url,
    user: d.user ? { login: d.user.login } : null,
  };
}

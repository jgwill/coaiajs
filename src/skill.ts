/**
 * coaiajs — the packaged agent skill.
 *
 * WHY THE CONTENT IS NOT IN THIS FILE
 *
 * The lineage this is adapted from (coaia-narrative's `src/skill.ts`) embedded ~250
 * lines of markdown as `['---', 'name: ...', ...].join('\n')`. That works, and it is
 * unreadable: a documentation change shows up in review as a diff of quoted string
 * fragments, no markdown tool can lint it, and the prose cannot be read in the form
 * the reader will see.
 *
 * So the skill lives as real markdown under `skills/coaiajs/`, shipped by the `files`
 * field, and is read from the package root at run time. `tests/skill.test.mjs` fails
 * if a file listed here does not resolve, which is the failure mode this trades for.
 *
 * WHY THE TOOL MAP IS GENERATED
 *
 * A hand-written tool table drifts from the server the moment a tool is added, and a
 * skill that advertises a tool the server does not serve teaches an agent to make a
 * call that fails. `{{TOOL_MAP}}` is rendered from `ALL_TOOL_DEFINITIONS` — the same
 * array the MCP server registers — so the two cannot disagree.
 */

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative as relativePath, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { getPackageRoot, getPackageVersion } from './version.js';
import {
  ALL_TOOL_DEFINITIONS,
  CORE_TOOLS,
  STC_TOOLS,
  NARRATIVE_TOOLS,
  WAMPUM_TOOLS,
  KG_TOOLS,
} from './narrative/index.js';

export const SKILL_NAME = 'coaiajs';

/**
 * Files that make up the skill, in the order a reader meets them.
 *
 * Listed explicitly rather than discovered by walking the directory: a stray file
 * under `skills/` should not silently become part of what gets installed, and a
 * missing one should be an error rather than a quietly shorter skill.
 */
export const SKILL_FILES: readonly string[] = [
  'SKILL.md',
  'references/creative-orientation.md',
  'references/structural-tension-charting.md',
  'references/delayed-resolution.md',
  'references/narrative-beats.md',
  'references/wampum-belts.md',
  'references/reading-the-store.md',
  'references/beyond-narrative.md',
  'references/mcp-tools.md',
  'references/install-and-environment.md',
];

/** Directory inside the package holding the skill's markdown. */
export function getPackagedSkillDir(): string {
  return join(getPackageRoot(), 'skills', SKILL_NAME);
}

// ─── Tool map generation ──────────────────────────────────────────────

/**
 * Abbreviations whose trailing period does not end a sentence. Without these,
 * `open_nodes` — whose description reads "…by exact name (e.g. 'chart_123_chart')" —
 * rendered as "Open specific entity nodes by exact name (e.g." in the table, which
 * reads as a truncation bug rather than as a description.
 */
const NON_TERMINAL_ABBREVIATIONS = ['e.g', 'i.e', 'etc', 'vs', 'cf', 'approx', 'no'];

/**
 * One line of description, trimmed to something a table cell can hold.
 *
 * Leading emphasis markers ("🚨 NEW LLM?", "✨ RECOMMENDED:", "⚠️ DEPRECATED:") are kept
 * deliberately — they carry the tool's own stance about itself, and a map that hides a
 * deprecation is worse than one that shows it.
 */
function shortDescription(description: string): string {
  const collapsed = description.replace(/\s+/g, ' ').trim();

  // Cut at the first period that actually ends a sentence: followed by whitespace and
  // something that starts one, and not preceded by an abbreviation or a single letter.
  let sentence = collapsed;
  for (const match of collapsed.matchAll(/\.(?=\s+[A-Z0-9`'"(\u{1F300}-\u{1FAFF}])/gu)) {
    const before = collapsed.slice(0, match.index);
    const lastWord = (/([A-Za-z.]+)$/.exec(before)?.[1] ?? '').toLowerCase();
    if (NON_TERMINAL_ABBREVIATIONS.includes(lastWord)) continue;
    if (/^[a-z]$/.test(lastWord)) continue; // an initial, not a sentence end
    sentence = collapsed.slice(0, match.index + 1);
    break;
  }

  const escaped = sentence.replace(/\|/g, '\\|');
  return escaped.length > 180 ? `${escaped.slice(0, 177)}…` : escaped;
}

const TOOL_GROUP_ORDER: Array<{ title: string; names: readonly string[] }> = [
  { title: 'Start here', names: CORE_TOOLS },
  { title: 'Structural tension charts', names: STC_TOOLS },
  { title: 'Narrative beats', names: NARRATIVE_TOOLS },
  { title: 'Wampum belts', names: WAMPUM_TOOLS },
  { title: 'Knowledge graph', names: KG_TOOLS },
];

/**
 * Render the narrative tool surface as grouped markdown tables, from the definitions
 * the MCP server actually registers. A tool that belongs to no group still appears,
 * under "Other" — a tool silently absent from its own map is the drift this avoids.
 */
export function renderToolMap(): string {
  const byName = new Map(ALL_TOOL_DEFINITIONS.map(t => [t.name, t] as const));
  const placed = new Set<string>();
  const sections: string[] = [];

  for (const group of TOOL_GROUP_ORDER) {
    const rows: string[] = [];
    for (const name of group.names) {
      const tool = byName.get(name);
      if (!tool || placed.has(name)) continue;
      placed.add(name);
      rows.push(`| \`${name}\` | ${shortDescription(tool.description)} |`);
    }
    if (rows.length === 0) continue;
    sections.push(`### ${group.title}\n\n| Tool | Use |\n|---|---|\n${rows.join('\n')}`);
  }

  const leftover = ALL_TOOL_DEFINITIONS.filter(t => !placed.has(t.name));
  if (leftover.length > 0) {
    const rows = leftover.map(t => `| \`${t.name}\` | ${shortDescription(t.description)} |`);
    sections.push(`### Other\n\n| Tool | Use |\n|---|---|\n${rows.join('\n')}`);
  }

  return sections.join('\n\n');
}

// ─── Rendering ────────────────────────────────────────────────────────

/** Placeholders a packaged skill file may carry. */
function substitutions(): Record<string, string> {
  return {
    VERSION: getPackageVersion(),
    // The narrative/chart surface only. The server also serves Langfuse, PDE, and
    // planning tools, and counting those here would mean importing the MCP feature
    // config into the library — see references/beyond-narrative.md instead.
    NARRATIVE_TOOL_COUNT: String(ALL_TOOL_DEFINITIONS.length),
    TOOL_MAP: renderToolMap(),
  };
}

function applySubstitutions(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(
        `Packaged skill carries an unknown placeholder {{${key}}}. ` +
          `Add it to substitutions() in src/skill.ts or remove it from the markdown.`,
      );
    }
    return value;
  });
}

/** Read one packaged skill file and fill its placeholders. */
export function renderSkillFile(relativeFilePath: string): string {
  const source = join(getPackagedSkillDir(), relativeFilePath);
  let raw: string;
  try {
    raw = readFileSync(source, 'utf8');
  } catch {
    throw new Error(
      `Packaged skill file missing: ${source}. ` +
        `The published package must ship skills/ — check the "files" field in package.json.`,
    );
  }
  return applySubstitutions(raw, substitutions());
}

/** Every skill file, rendered, keyed by its path within the skill directory. */
export function renderSkill(): Map<string, string> {
  const values = substitutions();
  const rendered = new Map<string, string>();
  for (const file of SKILL_FILES) {
    const source = join(getPackagedSkillDir(), file);
    let raw: string;
    try {
      raw = readFileSync(source, 'utf8');
    } catch {
      throw new Error(
        `Packaged skill file missing: ${source}. ` +
          `The published package must ship skills/ — check the "files" field in package.json.`,
      );
    }
    rendered.set(file, applySubstitutions(raw, values));
  }
  return rendered;
}

// ─── Install locations ────────────────────────────────────────────────

export function getSkillInstallDir(globalInstall: boolean): string {
  return globalInstall
    ? resolve(homedir(), '.agents', 'skills', SKILL_NAME)
    : resolve(process.cwd(), '.agents', 'skills', SKILL_NAME);
}

export function getClaudeSkillLinkPath(globalInstall: boolean): string {
  return globalInstall
    ? resolve(homedir(), '.claude', 'skills', SKILL_NAME)
    : resolve(process.cwd(), '.claude', 'skills', SKILL_NAME);
}

function pathExists(pathName: string): boolean {
  try {
    lstatSync(pathName);
    return true;
  } catch {
    return false;
  }
}

function removePath(pathName: string): void {
  const stat = lstatSync(pathName);
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    rmSync(pathName, { recursive: true, force: true });
  } else {
    unlinkSync(pathName);
  }
}

function writeRenderedSkill(targetDir: string, force: boolean): void {
  // Render before touching anything on disk: a missing packaged file must not leave
  // a half-written skill where a whole one used to be.
  const rendered = renderSkill();

  if (pathExists(targetDir)) {
    if (!force) {
      throw new Error(`Skill already exists: ${targetDir} (use --force to replace it)`);
    }
    removePath(targetDir);
  }

  mkdirSync(targetDir, { recursive: true });
  for (const [file, content] of rendered) {
    const destination = resolve(targetDir, file);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content, 'utf-8');
  }
}

function ensureClaudeSymlink(linkPath: string, targetDir: string, force: boolean): boolean {
  const parentDir = dirname(linkPath);
  if (pathExists(parentDir)) {
    const resolvedTargetParent = realpathSync(dirname(targetDir));
    const resolvedLinkParent = realpathSync(parentDir);

    // Already the same directory — Claude sees the skill without a link.
    if (resolvedTargetParent === resolvedLinkParent) {
      return false;
    }
  }

  const linkTarget = relativePath(parentDir, targetDir) || '.';
  mkdirSync(parentDir, { recursive: true });

  if (pathExists(linkPath)) {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink() && readlinkSync(linkPath) === linkTarget) {
      return true;
    }
    if (!force) {
      throw new Error(`Claude skill path already exists: ${linkPath} (use --force to replace it)`);
    }
    removePath(linkPath);
  }

  symlinkSync(linkTarget, linkPath, 'dir');
  return true;
}

async function shouldCreateClaudeSymlink(linkPath: string, autoYes: boolean): Promise<boolean> {
  if (autoYes) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(`Tip: create a Claude symlink manually at ${linkPath}`);
    return false;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Create a symlink in ${linkPath}? [y/N] `);
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}

// ─── Commands ─────────────────────────────────────────────────────────

/** Print the packaged SKILL.md, rendered. */
export function showSkill(): void {
  process.stdout.write(renderSkillFile('SKILL.md'));
}

export interface InstallSkillOptions {
  global?: boolean;
  force?: boolean;
  yes?: boolean;
}

export async function installSkill(options: InstallSkillOptions = {}): Promise<string> {
  const globalInstall = options.global === true;
  const installDir = getSkillInstallDir(globalInstall);
  writeRenderedSkill(installDir, options.force === true);
  console.log(`Installed the coaiajs skill (v${getPackageVersion()}) to ${installDir}`);

  const claudeLinkPath = getClaudeSkillLinkPath(globalInstall);
  if (await shouldCreateClaudeSymlink(claudeLinkPath, options.yes === true)) {
    const linked = ensureClaudeSymlink(claudeLinkPath, installDir, options.force === true);
    console.log(
      linked
        ? `Linked Claude skill at ${claudeLinkPath}`
        : `Claude already sees the skill via ${dirname(claudeLinkPath)}`,
    );
  }

  return installDir;
}

export interface SkillCheckResult {
  status: 'current' | 'stale' | 'missing';
  installDir: string;
  packageVersion: string;
  /** Version recorded in the installed SKILL.md frontmatter, when one is readable. */
  installedVersion?: string;
  /** Files whose installed content differs from what this package would write. */
  differing: string[];
  /** Files this package ships that the install does not have. */
  absent: string[];
}

/**
 * Compare an installed skill against the packaged one.
 *
 * The failure this exists for is silent: a skill installed by an older `coaiajs`
 * describes an older tool surface, sits there looking authoritative, and nothing in
 * the normal flow ever says so. An agent then reads a tool map that no longer matches
 * the server it is talking to.
 */
export function checkSkill(options: { global?: boolean } = {}): SkillCheckResult {
  const installDir = getSkillInstallDir(options.global === true);
  const packageVersion = getPackageVersion();

  if (!pathExists(installDir)) {
    return { status: 'missing', installDir, packageVersion, differing: [], absent: [...SKILL_FILES] };
  }

  const rendered = renderSkill();
  const differing: string[] = [];
  const absent: string[] = [];
  let installedVersion: string | undefined;

  for (const [file, expected] of rendered) {
    let actual: string;
    try {
      actual = readFileSync(resolve(installDir, file), 'utf8');
    } catch {
      absent.push(file);
      continue;
    }
    if (file === 'SKILL.md') {
      installedVersion = /^\s*packageVersion:\s*"?([^"\n]+)"?\s*$/m.exec(actual)?.[1]?.trim();
    }
    if (actual !== expected) differing.push(file);
  }

  const status = differing.length === 0 && absent.length === 0 ? 'current' : 'stale';
  return { status, installDir, packageVersion, installedVersion, differing, absent };
}

/** Human-readable form of a check, for the CLI. */
export function formatSkillCheck(result: SkillCheckResult): string {
  const lines: string[] = [];
  switch (result.status) {
    case 'missing':
      lines.push(`No skill installed at ${result.installDir}`);
      lines.push(`Install it with: coaia skill install`);
      break;
    case 'current':
      lines.push(`Skill at ${result.installDir} is current (v${result.packageVersion})`);
      break;
    case 'stale':
      lines.push(
        `Skill at ${result.installDir} is stale: installed from ` +
          `v${result.installedVersion ?? 'unknown'}, package is v${result.packageVersion}`,
      );
      if (result.absent.length > 0) lines.push(`  absent: ${result.absent.join(', ')}`);
      if (result.differing.length > 0) lines.push(`  differs: ${result.differing.join(', ')}`);
      lines.push(`Refresh it with: coaia skill install --force`);
      break;
  }
  return lines.join('\n');
}

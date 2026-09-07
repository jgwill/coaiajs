/**
 * The packaged agent skill.
 *
 * The skill's content lives on disk as markdown rather than inside the TypeScript, which
 * buys readability and costs a resolution step. These tests are what that trade is paid
 * with: a file that does not ship, a placeholder nobody substitutes, or a tool map that
 * has fallen behind the server must fail the build rather than reach a published package.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SKILL_NAME,
  SKILL_FILES,
  getPackagedSkillDir,
  renderSkill,
  renderSkillFile,
  renderToolMap,
  installSkill,
  checkSkill,
  formatSkillCheck,
  getSkillInstallDir,
} from '../dist/src/skill.js';
import { ALL_TOOL_DEFINITIONS } from '../dist/src/narrative/index.js';
import { getPackageVersion, getPackageRoot } from '../dist/src/version.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

describe('the packaged skill ships', () => {
  test('the package root resolves to this repository', () => {
    assert.equal(getPackageRoot(), ROOT.replace(/\/$/, ''));
  });

  test('every file the installer writes exists in the package', () => {
    const dir = getPackagedSkillDir();
    for (const file of SKILL_FILES) {
      assert.ok(existsSync(join(dir, file)), `packaged skill file missing: ${file}`);
    }
  });

  test('package.json ships the skills directory', () => {
    assert.ok(
      pkg.files.includes('skills'),
      'skills/ is not in the files field, so the published package would have no skill to install',
    );
  });

  test('SKILL.md references exactly the reference files that are installed', () => {
    const skillMd = readFileSync(join(getPackagedSkillDir(), 'SKILL.md'), 'utf8');
    const referenced = new Set(
      [...skillMd.matchAll(/`(references\/[a-z-]+\.md)`/g)].map(m => m[1]),
    );
    const installed = new Set(SKILL_FILES.filter(f => f.startsWith('references/')));

    for (const ref of referenced) {
      assert.ok(installed.has(ref), `SKILL.md points at ${ref}, which the installer does not write`);
    }
    for (const file of installed) {
      assert.ok(referenced.has(file), `${file} is installed but SKILL.md never points a reader at it`);
    }
  });
});

describe('rendering', () => {
  test('no placeholder survives rendering', () => {
    for (const [file, content] of renderSkill()) {
      const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
      assert.equal(leftover, null, `${file} still carries ${leftover?.join(', ')}`);
    }
  });

  test('an unknown placeholder is refused rather than left in place', () => {
    // Guards the substitution table itself: a typo'd placeholder must not ship silently.
    const skillMd = readFileSync(join(getPackagedSkillDir(), 'SKILL.md'), 'utf8');
    const known = new Set(['VERSION', 'NARRATIVE_TOOL_COUNT', 'TOOL_MAP']);
    for (const [, key] of skillMd.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
      assert.ok(known.has(key), `SKILL.md uses {{${key}}}, which substitutions() does not define`);
    }
  });

  test('the frontmatter records the version it was rendered from', () => {
    const rendered = renderSkillFile('SKILL.md');
    assert.match(rendered, new RegExp(`packageVersion: "${getPackageVersion()}"`));
    assert.match(rendered, /^name: coaiajs$/m);
    assert.match(rendered, /MCP server: coaiajs-mcp/);
  });

  test('the skill names this package, not the lineage it was adapted from', () => {
    for (const [file, content] of renderSkill()) {
      for (const foreign of ['cnarrative', 'COAIA_TOOLS', 'COAIAN_MF', 'COAIAN_CC']) {
        assert.ok(
          !content.includes(foreign),
          `${file} still names ${foreign}, which belongs to coaia-narrative rather than coaiajs`,
        );
      }
    }
  });
});

describe('the tool map cannot drift from the server', () => {
  test('every served narrative tool appears in the map', () => {
    const map = renderToolMap();
    for (const tool of ALL_TOOL_DEFINITIONS) {
      assert.ok(map.includes(`\`${tool.name}\``), `${tool.name} is served but absent from the tool map`);
    }
  });

  test('the map invents no tool', () => {
    const served = new Set(ALL_TOOL_DEFINITIONS.map(t => t.name));
    const listed = [...renderToolMap().matchAll(/^\| `([a-z_]+)` \|/gm)].map(m => m[1]);
    assert.ok(listed.length > 0, 'the tool map parsed to zero rows');
    for (const name of listed) {
      assert.ok(served.has(name), `the tool map lists ${name}, which the server does not serve`);
    }
  });

  test('each tool appears exactly once', () => {
    const listed = [...renderToolMap().matchAll(/^\| `([a-z_]+)` \|/gm)].map(m => m[1]);
    assert.equal(new Set(listed).size, listed.length, 'a tool is listed under two groups');
  });

  test('a description is not cut at an abbreviation', () => {
    // open_nodes reads "...by exact name (e.g. 'chart_123_current_reality')". A naive
    // split on ". " renders that as "(e.g." and reads as a truncation bug.
    const map = renderToolMap();
    const row = map.split('\n').find(l => l.startsWith('| `open_nodes`'));
    assert.ok(row, 'open_nodes row not found');
    assert.ok(!row.trimEnd().endsWith('(e.g. |'), `description cut at an abbreviation: ${row}`);
    assert.match(row, /chart_123/);
  });

  test('table cells escape pipes', () => {
    for (const line of renderToolMap().split('\n')) {
      if (!line.startsWith('| `')) continue;
      const cells = line.split(/(?<!\\)\|/).filter(c => c !== '');
      assert.equal(cells.length, 2, `row does not have exactly two cells: ${line}`);
    }
  });
});

describe('install and check', () => {
  let dir;
  let previousCwd;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'coaiajs-skill-'));
    previousCwd = process.cwd();
    process.chdir(dir);
  });

  after(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test('check reports missing before anything is installed', () => {
    const result = checkSkill();
    assert.equal(result.status, 'missing');
    assert.match(formatSkillCheck(result), /coaia skill install/);
  });

  test('install writes every file, and check then reports current', async () => {
    const installDir = await installSkill({ yes: false });
    assert.equal(installDir, getSkillInstallDir(false));
    for (const file of SKILL_FILES) {
      assert.ok(existsSync(join(installDir, file)), `${file} was not installed`);
    }
    const result = checkSkill();
    assert.equal(result.status, 'current', JSON.stringify(result));
    assert.equal(result.installedVersion, getPackageVersion());
  });

  test('installing over an existing skill is refused without --force', async () => {
    await assert.rejects(() => installSkill({}), /use --force to replace it/);
  });

  test('a hand-edited install reports stale, naming the file', () => {
    const installDir = getSkillInstallDir(false);
    writeFileSync(join(installDir, 'references/mcp-tools.md'), '# edited\n', 'utf8');
    const result = checkSkill();
    assert.equal(result.status, 'stale');
    assert.deepEqual(result.differing, ['references/mcp-tools.md']);
    assert.match(formatSkillCheck(result), /coaia skill install --force/);
  });

  test('a missing file reports stale, naming it', () => {
    const installDir = getSkillInstallDir(false);
    rmSync(join(installDir, 'references/wampum-belts.md'));
    const result = checkSkill();
    assert.equal(result.status, 'stale');
    assert.ok(result.absent.includes('references/wampum-belts.md'));
  });

  test('--force restores it to current', async () => {
    await installSkill({ force: true });
    assert.equal(checkSkill().status, 'current');
  });

  test('the installed skill is the rendered one, not the raw markdown', () => {
    const installed = readFileSync(join(getSkillInstallDir(false), 'SKILL.md'), 'utf8');
    assert.ok(!installed.includes('{{'), 'an unrendered placeholder was installed');
    assert.ok(installed.includes('| `create_wampum_belt` |'), 'the tool map was not rendered in');
  });

  test('the skill name is stable', () => {
    assert.equal(SKILL_NAME, 'coaiajs');
    assert.ok(getSkillInstallDir(false).endsWith(join('.agents', 'skills', 'coaiajs')));
  });
});

// coaiajs/src/version.ts — single source of truth for the runtime version and the
// installed package root. Reads package.json at runtime so the CLI banner, the MCP
// handshake, the packaged skill, and the published package can never drift apart.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'coaiajs';

let cachedVersion: string | undefined;
let cachedRoot: string | undefined;

/**
 * Directory holding this package's own `package.json`.
 *
 * Anything shipped alongside `dist/` — the packaged skill under `skills/`, the
 * Custom GPT specs, the rispecs — is found from here rather than from
 * `process.cwd()`, which is the caller's directory and says nothing about where
 * the package was installed.
 */
export function getPackageRoot(): string {
  if (cachedRoot) return cachedRoot;

  const here = dirname(fileURLToPath(import.meta.url));
  // dist/src/version.js -> package root is two levels up.
  // src/version.ts (ts-node/tsx) -> package root is one level up.
  const candidates = [join(here, '..', '..'), join(here, '..')];

  for (const root of candidates) {
    let raw: string;
    try {
      raw = readFileSync(join(root, 'package.json'), 'utf8');
    } catch {
      continue; // not at this depth; try the next candidate
    }
    const pkg = JSON.parse(raw) as { name?: string; version?: string };
    if (pkg.name === PACKAGE_NAME && pkg.version) {
      cachedRoot = root;
      cachedVersion = pkg.version;
      return cachedRoot;
    }
  }

  throw new Error(
    `Unable to resolve the ${PACKAGE_NAME} package root: no matching package.json near ${here}`,
  );
}

/** Resolved version of the installed `coaiajs` package. */
export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion;
  getPackageRoot(); // populates cachedVersion, or throws naming the reason
  return cachedVersion as string;
}

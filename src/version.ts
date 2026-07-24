// coaiajs/src/version.ts — single source of truth for the runtime version.
// Reads package.json at runtime so the CLI banner, the MCP handshake, and the
// published package can never drift apart again.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'coaiajs';

let cached: string | undefined;

/** Resolved version of the installed `coaiajs` package. */
export function getPackageVersion(): string {
  if (cached) return cached;

  const here = dirname(fileURLToPath(import.meta.url));
  // dist/src/version.js -> package root is two levels up.
  // src/version.ts (ts-node/tsx) -> package root is one level up.
  const candidates = [join(here, '..', '..', 'package.json'), join(here, '..', 'package.json')];

  for (const candidate of candidates) {
    let raw: string;
    try {
      raw = readFileSync(candidate, 'utf8');
    } catch {
      continue; // not at this depth; try the next candidate
    }
    const pkg = JSON.parse(raw) as { name?: string; version?: string };
    if (pkg.name === PACKAGE_NAME && pkg.version) {
      cached = pkg.version;
      return cached;
    }
  }

  throw new Error(
    `Unable to resolve ${PACKAGE_NAME} version: no package.json found near ${here}`,
  );
}

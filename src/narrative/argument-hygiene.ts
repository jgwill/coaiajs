/**
 * COAIA Narrative - Argument Hygiene
 *
 * A malformed tool call must not become chart content.
 *
 * On 2026-07-30 a live store was found carrying seven observations whose bodies
 * ended in `</currentReality>` followed by a `<parameter name="dueDate">` block:
 * the raw text of a call whose argument tags never parsed, persisted verbatim as
 * if it were prose. The call did not fail — it wrote, and every consumer that
 * renders current reality has shown that tag ever since.
 *
 * The check belongs here, at the write boundary. Anything that reaches the JSONL
 * is already in every reader's render, so a read-side filter arrives too late.
 * A body carrying plainly unparsed call syntax is refused with the offending
 * fragment named, so the caller can retry with the text it meant to record.
 */

import { ALL_TOOL_DEFINITIONS } from './tool-definitions.js';

export interface UnparsedCallSyntaxHit {
  /** The offending text, quoted back so the caller can see what it sent. */
  fragment: string;
  /** Plain-language account of what the fragment is. */
  reason: string;
  /** Where in the body the prose ended and the call text began. */
  index: number;
}

export interface UnparsedCallSyntaxLocation extends UnparsedCallSyntaxHit {
  /** Where in the arguments it was found, e.g. `newObservations[0]`. */
  path: string;
}

/**
 * Tool-call machinery that has no business inside a text body. These are the
 * tags a call is *made of*, not tags a chart can legitimately talk about in the
 * same breath as its own content.
 */
const CALL_MACHINERY: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: 'a tool-call parameter tag',
    pattern: /<\s*\/?\s*(?:[A-Za-z][\w.-]*:)?parameter\b/i
  },
  {
    reason: 'a tool-call invoke tag',
    pattern: /<\s*\/?\s*(?:[A-Za-z][\w.-]*:)?invoke\b/i
  },
  {
    reason: 'a tool-call function_calls tag',
    pattern: /<\s*\/?\s*(?:[A-Za-z][\w.-]*:)?function_calls\b/i
  }
];

/**
 * Every argument name this package declares, gathered from the tool schemas so
 * the vocabulary cannot drift from the tools themselves. A bare closing tag for
 * one of these names inside a text body is a parse that failed, not prose.
 */
const ARGUMENT_NAMES: string[] = (() => {
  const names = new Set<string>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;

    const properties = record.properties;
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
        if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) names.add(key);
        walk(child);
      }
    }

    if (record.items) walk(record.items);
  };

  for (const tool of ALL_TOOL_DEFINITIONS) walk(tool.inputSchema);

  // Longest first, so a report names `</currentReality>` rather than a shorter
  // suffix that happens to match inside it.
  return [...names].sort((a, b) => b.length - a.length);
})();

const ARGUMENT_CLOSING_TAG = new RegExp(`<\\s*/\\s*(${ARGUMENT_NAMES.join('|')})\\s*>`, 'i');

/** Quote back enough of the offending text to be recognisable, not the whole body. */
function quoteFragment(text: string, index: number, matchLength: number): string {
  const close = text.indexOf('>', index + matchLength - 1);
  const end = close !== -1 && close - index < 80 ? close + 1 : Math.min(text.length, index + 60);
  const fragment = text.slice(index, end).replace(/\s+/g, ' ').trim();
  return end < text.length && close === -1 ? `${fragment}…` : fragment;
}

/**
 * Return the first unparsed-call-syntax fragment in `text`, or null if the text
 * is ordinary prose. Angle brackets on their own are fine — `<div>`, `a < b`,
 * `<rootDir>` all pass. Only call machinery and argument closing tags are refused.
 */
export function findUnparsedCallSyntax(text: string): UnparsedCallSyntaxHit | null {
  if (typeof text !== 'string' || !text.includes('<')) return null;

  // Report the earliest fragment, not the first pattern that happens to match.
  // The earliest one is where the prose ended and the call text began — the place
  // the caller needs to look.
  let earliest: { index: number; length: number; reason: string } | null = null;
  const consider = (index: number, length: number, reason: string) => {
    if (!earliest || index < earliest.index) earliest = { index, length, reason };
  };

  for (const { reason, pattern } of CALL_MACHINERY) {
    const match = pattern.exec(text);
    if (match) consider(match.index, match[0].length, reason);
  }

  const closing = ARGUMENT_CLOSING_TAG.exec(text);
  if (closing) consider(closing.index, closing[0].length, `a closing tag for the '${closing[1]}' argument`);

  if (!earliest) return null;
  const hit = earliest as { index: number; length: number; reason: string };
  return {
    fragment: quoteFragment(text, hit.index, hit.length),
    reason: hit.reason,
    index: hit.index
  };
}

/**
 * Walk any argument value — string, array, or object — and return the first
 * location carrying unparsed call syntax.
 */
export function findUnparsedCallSyntaxIn(value: unknown, path = ''): UnparsedCallSyntaxLocation | null {
  if (typeof value === 'string') {
    const hit = findUnparsedCallSyntax(value);
    return hit ? { ...hit, path: path || 'value' } : null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = findUnparsedCallSyntaxIn(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const found = findUnparsedCallSyntaxIn(child, path ? `${path}.${key}` : key);
      if (found) return found;
    }
    return null;
  }

  return null;
}

/** The message a caller sees: what was refused, where, and what to do next. */
export function describeUnparsedCallSyntax(location: UnparsedCallSyntaxLocation): string {
  return [
    `Malformed call refused — nothing was written.`,
    ``,
    `\`${location.path}\` carries unparsed call syntax, not prose:`,
    `    ${location.fragment}`,
    `That is ${location.reason}.`,
    ``,
    `The argument tags of this call did not parse, so raw call text arrived as the`,
    `value. Storing it would put a tag into the chart where a sentence belongs.`,
    `Re-send the call with \`${location.path}\` holding only the text meant to be recorded.`
  ].join('\n');
}

/** Throw unless `value` is free of unparsed call syntax. Used at the store's edge. */
export function assertNoUnparsedCallSyntax(value: unknown, path: string): void {
  const location = findUnparsedCallSyntaxIn(value, path);
  if (location) throw new Error(describeUnparsedCallSyntax(location));
}

/** The argument-name vocabulary, exported so the scrubber reports what the server refuses. */
export const KNOWN_ARGUMENT_NAMES: readonly string[] = ARGUMENT_NAMES;

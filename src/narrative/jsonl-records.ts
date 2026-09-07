/**
 * Record classification for the JSONL store — pure, no I/O, no imports beyond types.
 *
 * WHY THIS FILE EXISTS
 *
 * These predicates decide what a line in the store IS. They were private to
 * jsonl-preservation.ts, which cannot be imported by a renderer because its first line
 * is `import fs`. So the read contract re-implemented them by hand — and got it wrong:
 * it dropped the legacy `type:"narrative_beat"` dialect this package still writes and
 * reads, losing real beats AND reporting them as corruption.
 *
 * Splitting them out costs nothing and means classification has exactly one definition.
 * jsonl-preservation.ts imports it, so the writer round-trips through these; contract.ts
 * imports it, so a reader classifies identically. They cannot drift, because there is
 * no second copy to drift from.
 */

import type { Entity, JsonlRecord } from '../types.js';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function removeUndefined<T extends Record<string, unknown>>(record: T): T {
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) {
      delete record[key];
    }
  }
  return record;
}

export function isEntityRecord(record: JsonlRecord): boolean {
  return record.type === 'entity' && typeof record.name === 'string';
}

/**
 * The older on-disk dialect: a beat written with `type:"narrative_beat"` at the top
 * level instead of `type:"entity"` + `entityType:"narrative_beat"`. Still present in
 * live stores, still round-tripped by serializeEntity, still asserted by
 * test-metadata-preservation.js. A reader that does not know this dialect silently
 * renders fewer beats than exist.
 */
export function isLegacyNarrativeBeatRecord(record: JsonlRecord): boolean {
  return record.type === 'narrative_beat' && typeof record.name === 'string';
}

export function isRelationRecord(record: JsonlRecord): boolean {
  return record.type === 'relation' &&
    typeof record.from === 'string' &&
    typeof record.to === 'string' &&
    typeof record.relationType === 'string';
}

export function normalizeLegacyNarrativeBeat(record: JsonlRecord): Entity {
  const metadata = {
    ...(isObject(record.metadata) ? record.metadata : {}),
    narrative: isObject(record.metadata) && record.metadata.narrative !== undefined
      ? record.metadata.narrative
      : record.narrative,
    relationalAlignment: isObject(record.metadata) && record.metadata.relationalAlignment !== undefined
      ? record.metadata.relationalAlignment
      : record.relational_alignment,
    fourDirections: isObject(record.metadata) && record.metadata.fourDirections !== undefined
      ? record.metadata.fourDirections
      : record.four_directions
  };

  return removeUndefined({
    ...record,
    type: 'narrative_beat',
    name: record.name as string,
    entityType: 'narrative_beat',
    observations: Array.isArray(record.observations) ? record.observations as string[] : [],
    metadata: removeUndefined(metadata)
  }) as Entity;
}

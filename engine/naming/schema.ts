// The naming file format `ccrug.naming/1` (NAM-03, D-09, D-11, 07-RESEARCH Pattern 6): the constants of the format and the one
// serializer. The same text is the export file, the per-base browser storage slot and, read back by validate.ts, the import, so
// there is exactly one writer and one reader.
//
// The text is deterministic: the same naming gives the same bytes. Keys come in a fixed order, locks are sorted ascending and
// override keys are written in ascending numeric order, there is no timestamp and no clock (the engine may not read one). A
// seed-only naming (no dense table, above the interactive ceiling) is written as the seed record alone: no zones, locks or
// overrides, because none exist there (D-11).
//
// An override key is the decimal mesh number of the demon (meshOf in engine/core), the same id at every base and in memory.

import { GENERATOR_ID } from './generate'
import { PRNG_ALGO } from './prng'
import type { StyleId } from './banks'
import type { JoinOrder, Naming, Smoothing } from './types'

/** The format version this code reads and writes. */
export const SCHEMA_ID = 'ccrug.naming/1'

/** Every version id starts with this; another suffix is an "unknown format version", anything else is "not a names file". */
export const SCHEMA_PREFIX = 'ccrug.naming/'

/** Longest text the validator reads, 8 MiB: admits a full rename of every demon at base 666 (3.88 MiB measured) and refuses absurd files. */
export const NAMING_IMPORT_MAX_BYTES = 8388608

/** Most overrides a file may carry: a second guard on memory, above any real use (221,445 demons at base 666). */
export const NAMING_MAX_OVERRIDES = 250000

/** Longest `meta.title` and `meta.notes`, in UTF-16 units. */
export const META_MAX_LENGTH = 200

/** Issues an import refusal keeps; the exact total is reported separately so the UI can say "And {k} more.". */
export const ISSUES_MAX = 5

/** Unknown keys an import success lists; the exact total is reported separately. */
export const UNKNOWN_KEYS_MAX = 5

/** What a link or a wrong-base refusal can carry over to another base: the generator inputs and the join rule, no per-zone data. */
export interface SeedRecord {
  readonly seed: string
  readonly style: StyleId
  readonly join: JoinOrder
  readonly smoothing: Smoothing
}

/**
 * The file text of a naming. Compact by default (one line, for the browser storage slot); `pretty` indents with two spaces and ends
 * with a newline (for people, the export download). Both read back identically through validateNamingJson. The naming is not changed.
 */
export function serializeNaming(n: Naming, opts?: { readonly pretty?: boolean }): string {
  // Object literals in the fixed order below; every key is a literal, so no text of the naming is ever used as a property name
  // except the override keys, which are decimal numbers.
  const doc: Record<string, unknown> = {
    schema: SCHEMA_ID,
    base: n.base,
    source: n.source,
    generator: { prng: PRNG_ALGO, gen: GENERATOR_ID, seed: n.seed, style: n.style },
    join: { order: n.join, smoothing: n.smoothing },
  }
  if (n.sounds !== null) {
    doc.zones = [...n.sounds]
    doc.locks = [...n.locks].sort((a, b) => a - b)
    // ascending by explicit sort: an object lists its array-index keys ascending on its own, but a mesh number from 2^32 - 1 up is an
    // ordinary key and would keep the order it was inserted in
    const overrides: Record<string, string> = {}
    for (const mesh of [...n.overrides.keys()].sort((a, b) => a - b)) overrides[String(mesh)] = n.overrides.get(mesh) as string
    doc.overrides = overrides
  }
  if (n.meta !== null) doc.meta = { title: n.meta.title, notes: n.meta.notes }
  return opts?.pretty === true ? JSON.stringify(doc, null, 2) + '\n' : JSON.stringify(doc)
}

// Naming limits (Phase 7, orchestrator decision 3): every number the Names feature uses is a named data value, so no component
// types a limit, a base or a ceiling. Original CCRUG code (MIT, NOTICE section 1). Each value is a [default] a later measurement
// may tune without reopening a contract; the one limit that depends on a measured ceiling reads it from the tier table.
import { INTERACTIVE_MAX_N } from './tierBounds'

/**
 * [default] Most zones the collision report scans by the resumable partitioned scan (plan 07-10 measured the cost; a certified
 * generated table needs no scan). Never above the engine's own scan cap, and never above the interactive ceiling: use
 * `collisionScanLimit()`, which takes the smaller of this and the ceiling read from the tier table.
 */
export const NAMING_COLLISION_SCAN_MAX_N = 1024

/** [default] Quiet time (ms) after the last committed edit before the per-base browser slot is written. */
export const NAMING_AUTOSAVE_DEBOUNCE_MS = 400

/**
 * [default] Time (ms) an export's object URL stays valid after the click. Some browsers start the download after the click handler has
 * returned, and a revoked URL cancels it (the file can be megabytes), so the URL is revoked seconds later, not on the next tick.
 */
export const NAMES_EXPORT_REVOKE_DELAY_MS = 10_000

/** [default] Key prefix of the per-base browser storage slot; the base number follows it. The slot holds the export JSON. */
export const NAMING_STORAGE_PREFIX = 'ccrug.naming.v1.'

/** [default] A naming with more overrides than this keeps a short undo history (research Pitfall 18: each entry shares its parts, but a big override map is costly to copy). */
export const NAMING_UNDO_OVERRIDE_LIMIT = 5000

/** [default] The most history entries kept while a naming holds more than NAMING_UNDO_OVERRIDE_LIMIT overrides. */
export const NAMING_UNDO_HEAVY_DEPTH = 8

/** [default] Characters of a seed written by the Reroll button (lowercase base 36 from the platform random source). */
export const REROLL_SEED_LENGTH = 8

/** [default] Repeated names shown in the collision list, and added by each `Show more names` press. */
export const COLLISION_LINES_STEP = 20

/** [default] Jump buttons shown on one collision line before `+{k} more`. */
export const COLLISION_JUMPS_SHOWN = 4

/** [default] Graphemes of a demon name shown in the matrix tooltip and its keyboard live text before the cut. */
export const NAME_TOOLTIP_GRAPHEMES = 32

/** [default] Rows of the name preview table. */
export const NAMES_PREVIEW_ROWS = 3

/** [default] Height (px) of one zone row in the virtualized list: the 24px lock plus a hairline above and below. */
export const ZONE_ROW_HEIGHT_PX = 28

/** [default] Rows rendered beyond the visible window of the zone list. */
export const ZONE_LIST_OVERSCAN = 8

/** [default] Rows a PageUp or PageDown jumps in the zone list. */
export const ZONE_PAGE_STEP = 10

/** [default] Milliseconds of one slice of the collision scan before it yields to the browser. */
export const COLLISION_SLICE_MS = 8

/** [default] Pixels the panel's scroller is shorter than the body height handed to the panel, so the panel's own wrapper never scrolls. */
export const NAMES_SCROLL_INSET_PX = 12

/** [default] The sound field's maxLength, so an absurd paste is cut before validation names the real problem. */
export const SOUND_FIELD_MAX_INPUT = 64

/** The collision scan limit the panel uses: the smaller of NAMING_COLLISION_SCAN_MAX_N and the interactive ceiling (tier table). */
export function collisionScanLimit(): number {
  return Math.min(NAMING_COLLISION_SCAN_MAX_N, INTERACTIVE_MAX_N)
}

// Pure helpers of the viewer's undo history for the naming (Phase 7, plan 18; D-09, Pitfall 7). The history key reads the naming's
// revision and never the naming itself; a naming that arrives by hydration (a saved slot or a shared link at load) is adopted into
// the previous snapshot so it never becomes an undo entry; and an undo or redo reports the one zone it changed. Nothing here reads
// the DOM, the storage or a clock. Original CCRUG code (MIT, NOTICE section 1).
import type { Naming } from '../../engine/index'

/**
 * The history key of a snapshot: its JSON text with the `naming` field left out (Pitfall 7). A naming holds a table of thousands of
 * sounds, so stringifying it on every render would be costly; the snapshot's `namingRev` stands for it, because the client's
 * monotonic counter gives every committed or restored naming a revision no other naming has had.
 */
export function historySnapshotKey(snapshot: object): string {
  return JSON.stringify(snapshot, (k, v) => (k === 'naming' ? undefined : v))
}

/**
 * `previous` with the naming and revision of `current`: how a naming that was loaded rather than edited joins the history. The first
 * snapshot after a load still holds the naming the page opened with, so without this rewrite the load would count as a change of the
 * naming and Undo would bring the pre-load naming back (and autosave would then write it over the saved slot). Every other field of
 * `previous` is kept, so a real change made by the same load (a layout, say) still differs from `current` and is recorded as before.
 */
export function withHydratedNaming<T extends { naming: unknown; namingRev: number }>(previous: T, current: T): T {
  return { ...previous, naming: current.naming, namingRev: current.namingRev }
}

/**
 * The one zone whose sound or lock differs between two namings of a base (the zone list scrolls to it after an undo or redo), else
 * null: no zone differs, several differ, or there is no per-zone table to compare (seed-only, or tables of another length).
 */
export function singleChangedZone(a: Naming, b: Naming): number | null {
  if (a.sounds === null || b.sounds === null || a.sounds.length !== b.sounds.length) return null
  let changed: number | null = null
  for (let zone = 0; zone < a.sounds.length; zone++) {
    if (a.sounds[zone] === b.sounds[zone] && a.locks.has(zone) === b.locks.has(zone)) continue
    if (changed !== null) return null
    changed = zone
  }
  return changed
}

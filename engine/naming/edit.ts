// Immutable edit operations on a Naming (NAM-01, NAM-02, plan 07-05, 07-RESEARCH Pattern 8 "Store"). Every operation returns a
// new frozen Naming and shares the unchanged parts by reference: a sound edit copies the sounds array and never the overrides Map,
// a join or smoothing change copies nothing, so 80 undo entries stay small (T-07-20). The one exception to "always a new object":
// an override edit that changes nothing (resetting an absent key, saving a value that is already stored or that equals what the
// rule or preset gives for a demon with no override) returns its argument, so a caller can skip the history entry with `===`.
//
// These functions are the only way text enters a Naming after the UI, so every text is validated here again and an invalid one is a
// RangeError (T-07-03b): no control or format character can get in even if a caller skipped its own check. Messages carry the
// reason code, never the raw text. Seed-only namings (sounds null, above the interactive ceiling) have no per-zone table, locks or
// overrides: only the seed, style, join and smoothing change.
//
// Decisions (plan 07-05): editing a sound locks its zone; setSeed and setStyle switch the source to generated; setSource ccru loads
// the preset sounds and clears the locks; setSource generated regenerates the unlocked zones and keeps the locks; saving an override
// equal to what the rule or preset gives removes the override.

import { netSpanOf } from '../core/demons'
import { checkIndex } from '../core/index-check'
import { isStyleId } from './banks'
import type { StyleId } from './banks'
import { createNameResolver } from './derive'
import { createGenerator, generateSounds } from './generate'
import { normalizeSeed, toNfc, validateName, validateSound } from './text'
import { isJoinOrder } from './types'
import type { JoinOrder, Naming, NamingPreset, NamingSource, Smoothing } from './types'

/** The dense sound table of a naming that has one; RangeError for a seed-only naming. */
function requireDense(n: Naming): readonly string[] {
  if (n.sounds === null) throw new RangeError(`Base ${n.base} is seed-only: it has no per-zone sounds, locks or overrides to edit`)
  return n.sounds
}

function soundText(raw: unknown): string {
  if (typeof raw !== 'string') throw new RangeError('Invalid sound: expected text')
  const check = validateSound(raw)
  if (!check.ok) throw new RangeError(`Invalid sound: ${check.reason}`)
  return check.text
}

function nameText(raw: unknown): string {
  if (typeof raw !== 'string') throw new RangeError('Invalid name: expected text')
  const check = validateName(raw)
  if (!check.ok) throw new RangeError(`Invalid name: ${check.reason}`)
  return check.text
}

/** Zone -> sound for every locked zone of a dense naming. */
function lockedMap(n: Naming, sounds: readonly string[]): Map<number, string> {
  const locked = new Map<number, string>()
  for (const zone of n.locks) {
    const sound = sounds[zone]
    if (sound !== undefined) locked.set(zone, sound)
  }
  return locked
}

/** The table regenerated for (seed, style) with the locked zones kept; null for a seed-only naming (nothing is stored). */
function regenerate(n: Naming, seed: string, style: StyleId): readonly string[] | null {
  if (n.sounds === null) return null
  return Object.freeze(generateSounds(createGenerator(seed, style), n.base, lockedMap(n, n.sounds)))
}

function overridesWithout(overrides: ReadonlyMap<number, string>, mesh: number): Map<number, string> {
  const next = new Map(overrides)
  next.delete(mesh)
  return next
}

/** Sets the sound of one zone (validated, NFC, trimmed) and locks the zone. The overrides Map is shared, not copied. */
export function editSound(n: Naming, zone: number, sound: string): Naming {
  const sounds = requireDense(n)
  const z = checkIndex('zone', zone, n.base)
  const text = soundText(sound)
  const next = sounds.slice()
  next[z] = text
  return Object.freeze({
    ...n,
    sounds: Object.freeze(next),
    locks: n.locks.has(z) ? n.locks : new Set(n.locks).add(z),
  })
}

/**
 * Puts the sounds of `list` into consecutive zones from startZone and locks them. Sounds past the last zone are dropped; `used` is
 * how many went in. Every sound that goes in is validated first, so a bad one changes nothing (RangeError). An empty list, or one
 * that fits nowhere, returns the argument and used 0.
 */
export function pasteSounds(n: Naming, startZone: number, list: readonly string[]): { naming: Naming; used: number } {
  const sounds = requireDense(n)
  const start = checkIndex('zone', startZone, n.base)
  const used = Math.min(list.length, n.base - start)
  if (used <= 0) return { naming: n, used: 0 }
  const texts: string[] = []
  for (let i = 0; i < used; i++) texts.push(soundText(list[i]))
  const next = sounds.slice()
  const locks = new Set(n.locks)
  for (let i = 0; i < used; i++) {
    next[start + i] = texts[i] as string
    locks.add(start + i)
  }
  return { naming: Object.freeze({ ...n, sounds: Object.freeze(next), locks }), used }
}

/** Toggles a zone's lock. The sounds and overrides are shared. */
export function toggleLock(n: Naming, zone: number): Naming {
  requireDense(n)
  const z = checkIndex('zone', zone, n.base)
  const locks = new Set(n.locks)
  if (!locks.delete(z)) locks.add(z)
  return Object.freeze({ ...n, locks })
}

/** A new seed (normalised; RangeError unless 1..64 characters with no control character): unlocked zones regenerate, locked ones stay, the source becomes generated. */
export function setSeed(n: Naming, seed: string): Naming {
  const normalised = typeof seed === 'string' ? normalizeSeed(seed) : null
  if (normalised === null) throw new RangeError('Invalid seed: expected 1 to 64 characters with no control characters')
  return Object.freeze({ ...n, source: 'generated' as const, seed: normalised, sounds: regenerate(n, normalised, n.style) })
}

/** A new style: unlocked zones regenerate, locked ones stay, the source becomes generated. RangeError for an unknown style. */
export function setStyle(n: Naming, style: StyleId): Naming {
  if (!isStyleId(style)) throw new RangeError('Invalid style: expected one of the known styles')
  return Object.freeze({ ...n, source: 'generated' as const, style, sounds: regenerate(n, n.seed, style) })
}

export function setJoin(n: Naming, join: JoinOrder): Naming {
  if (!isJoinOrder(join)) throw new RangeError('Invalid join order: expected hi-lo or lo-hi')
  return Object.freeze({ ...n, join })
}

export function setSmoothing(n: Naming, smoothing: Smoothing): Naming {
  if (smoothing !== 0 && smoothing !== 1) throw new RangeError('Invalid smoothing: expected 0 or 1')
  return Object.freeze({ ...n, smoothing })
}

/**
 * ccru: the preset's sounds replace the table, the locks clear, the overrides stay (RangeError without a preset of this base, with a
 * preset whose table is not one sound per zone, and on a seed-only naming). generated: the unlocked zones regenerate from the
 * naming's seed and style, the locked zones stay.
 */
export function setSource(n: Naming, source: NamingSource, preset: NamingPreset | null): Naming {
  if (source === 'ccru') {
    requireDense(n)
    if (preset === null || preset.base !== n.base || preset.sounds.length !== n.base) {
      throw new RangeError(`Source ccru needs a preset with one sound for each of the ${n.base} zones`)
    }
    return Object.freeze({ ...n, source, sounds: Object.freeze([...preset.sounds]), locks: new Set<number>() })
  }
  if (source === 'generated') {
    return Object.freeze({ ...n, source, sounds: regenerate(n, n.seed, n.style) })
  }
  throw new RangeError('Invalid source: expected generated or ccru')
}

/**
 * Stores a demon name under its mesh number. A name equal (after NFC) to what the preset or the rule gives for that demon removes
 * the override instead. `preset` is the CCRU preset the application passes in (or null); it counts only while the naming's source
 * is ccru. RangeError for an invalid name, a mesh number outside [0, base(base-1)/2) and a seed-only naming.
 */
export function setOverride(n: Naming, mesh: number, name: string, preset: NamingPreset | null): Naming {
  requireDense(n)
  const m = checkIndex('mesh number', mesh, (n.base * (n.base - 1)) / 2)
  const text = nameText(name)
  const [a, b] = netSpanOf(m)
  // what the demon would show with no override of its own: the layer below the user's text
  const without: Naming = { ...n, overrides: new Map<number, string>() }
  const given = toNfc(createNameResolver(without, preset).nameOf(a, b))
  const current = n.overrides.get(m)
  if (text === given) return current === undefined ? n : Object.freeze({ ...n, overrides: overridesWithout(n.overrides, m) })
  if (current === text) return n
  const overrides = new Map(n.overrides)
  overrides.set(m, text)
  return Object.freeze({ ...n, overrides })
}

/** Removes a demon's override ("reset to generated" or "reset to the CCRU name"). Returns the argument when there is none. */
export function resetOverride(n: Naming, mesh: number): Naming {
  requireDense(n)
  const m = checkIndex('mesh number', mesh, (n.base * (n.base - 1)) / 2)
  if (!n.overrides.has(m)) return n
  return Object.freeze({ ...n, overrides: overridesWithout(n.overrides, m) })
}

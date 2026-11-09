// Name derivation and the read-time layered resolver (NAM-02, D-06, D-08, D-11, plan 07-05, 07-RESEARCH Pattern 3).
//
// Names are derived on demand and never stored per demon (at 221,445 demons nothing per-demon exists). A demon's name is the
// first layer that has one:
//   1. the user's override (a sparse Map keyed by the decimal mesh number), shown exactly as typed;
//   2. the preset's canonical name, only while the naming's source is ccru and the preset is for this base;
//   3. the rule: the join of the two zone sounds (higher zone first by default), optionally smoothed (euphony), with its first
//      letter capitalised (D-08).
// The CCRU preset is an argument: the base-10 preset layer of the application reads the canonical table by reference
// (Phase 2 D-06), so the engine owns no preset table and no canonical name.
//
// Above the interactive ceiling a naming has no dense table (`sounds` is null) and every sound comes lazily from the generator,
// which does not depend on the base, so a name costs two permutation evaluations and no storage (D-11).

import { assertBase } from '../core/base'
import { meshOf } from '../core/demons'
import { checkIndex } from '../core/index-check'
import { DEFAULT_STYLE, isStyleId } from './banks'
import { smoothName } from './euphony'
import { DEFAULT_SEED, createGenerator, generateSounds } from './generate'
import type { SoundGenerator } from './generate'
import { normalizeSeed, toNfc, upperFirst } from './text'
import { isJoinOrder } from './types'
import type { CreateNamingOptions, JoinOrder, NameResolver, NameState, Naming, NamingPreset, Smoothing } from './types'

/**
 * The rule name of a demon from its higher-zone sound and lower-zone sound: the join in the given order (NFC), smoothed when
 * smoothing is 1, with the first letter in upper case. A sound typed in capitals keeps its case apart from that forced capital.
 */
export function deriveName(hi: string, lo: string, join: JoinOrder, smoothing: Smoothing): string {
  const raw = toNfc(join === 'hi-lo' ? hi + lo : lo + hi)
  return upperFirst(smoothing === 0 ? raw : smoothName(raw))
}

/**
 * A fresh naming for a base: source generated (or ccru with a matching preset), the seed's sounds (the preset's sounds for
 * ccru), no locks, no overrides, no meta. RangeError for an invalid base, seed, style, join, smoothing or ceiling, and for source
 * ccru without a preset of this base. Whether the table is dense depends on the base alone: above the ceiling `sounds` is null.
 */
export function createNaming(o: CreateNamingOptions): Naming {
  assertBase(o.base)
  if (typeof o.interactiveMaxN !== 'number' || Number.isNaN(o.interactiveMaxN)) {
    throw new RangeError('Invalid interactive ceiling: expected a number')
  }
  const seed = normalizeSeed(o.seed ?? DEFAULT_SEED)
  if (seed === null) throw new RangeError('Invalid seed: expected 1 to 64 characters with no control characters')
  const style = o.style ?? DEFAULT_STYLE
  if (!isStyleId(style)) throw new RangeError('Invalid style: expected one of the known styles')
  const join = o.join ?? 'hi-lo'
  if (!isJoinOrder(join)) throw new RangeError('Invalid join order: expected hi-lo or lo-hi')
  const smoothing = o.smoothing ?? 0
  if (smoothing !== 0 && smoothing !== 1) throw new RangeError('Invalid smoothing: expected 0 or 1')
  const source = o.source ?? 'generated'
  if (source !== 'generated' && source !== 'ccru') throw new RangeError('Invalid source: expected generated or ccru')

  let preset: NamingPreset | null = null
  if (source === 'ccru') {
    if (o.preset == null || o.preset.base !== o.base) {
      throw new RangeError(`Source ccru needs a preset for base ${o.base}`)
    }
    if (o.preset.sounds.length !== o.base) throw new RangeError(`The preset has ${o.preset.sounds.length} sounds for base ${o.base}`)
    preset = o.preset
  }

  let sounds: readonly string[] | null = null
  if (o.base <= o.interactiveMaxN) {
    sounds =
      preset !== null
        ? Object.freeze([...preset.sounds])
        : Object.freeze(generateSounds(createGenerator(seed, style), o.base))
  }

  return Object.freeze({
    base: o.base,
    source,
    seed,
    style,
    join,
    smoothing,
    sounds,
    locks: new Set<number>(),
    overrides: new Map<number, string>(),
    meta: null,
  })
}

/**
 * The O(1) reader of a naming's names. `preset` is the CCRU preset the application passes in (or null); it applies only while
 * naming.source is ccru and the preset is for naming.base. Every call checks its zones against the base, so a zone outside the
 * table is a RangeError, never a stale override or a preset name. No cache and no per-demon array: a name is two sound reads,
 * one Map read and one join.
 */
export function createNameResolver(naming: Naming, preset: NamingPreset | null): NameResolver {
  const base = naming.base
  const presetApplies = naming.source === 'ccru' && preset !== null && preset.base === base
  const dense = naming.sounds
  const gen: SoundGenerator | null = dense === null ? createGenerator(naming.seed, naming.style) : null

  const soundOf = (zone: number): string => {
    const z = checkIndex('zone', zone, base)
    return dense !== null ? (dense[z] as string) : (gen as SoundGenerator).soundAt(z)
  }

  // zones are checked against the base BEFORE the mesh lookup, so a demon outside the table never reads an override or the preset
  const meshOfPair = (a: number, b: number): number => {
    checkIndex('zone', a, base)
    checkIndex('zone', b, base)
    return meshOf(a, b) // order-normalising; RangeError for a === b
  }

  const presetName = (mesh: number): string | null => {
    if (!presetApplies) return null
    const name = (preset as NamingPreset).names[mesh]
    return name === undefined ? null : name
  }

  const ruleNameOf = (a: number, b: number, smoothing: Smoothing): string => {
    meshOfPair(a, b)
    return a > b
      ? deriveName(soundOf(a), soundOf(b), naming.join, smoothing)
      : deriveName(soundOf(b), soundOf(a), naming.join, smoothing)
  }

  const nameOf = (a: number, b: number): string => {
    const mesh = meshOfPair(a, b)
    const overridden = naming.overrides.get(mesh)
    if (overridden !== undefined) return overridden
    const canonical = presetName(mesh)
    if (canonical !== null) return canonical
    return a > b
      ? deriveName(soundOf(a), soundOf(b), naming.join, naming.smoothing)
      : deriveName(soundOf(b), soundOf(a), naming.join, naming.smoothing)
  }

  const presetNameOf = (a: number, b: number): string | null => presetName(meshOfPair(a, b))

  const stateOf = (a: number, b: number): NameState => {
    const mesh = meshOfPair(a, b)
    if (naming.overrides.has(mesh)) return 'overridden'
    return presetName(mesh) !== null ? 'preset' : 'generated'
  }

  return Object.freeze({ base, soundOf, nameOf, ruleNameOf, presetNameOf, stateOf })
}

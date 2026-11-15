// The naming session rules (plan 07-13, D-09, D-10, D-11, D-13, Pitfall 7): defaults per base, the link form, the preview/adopt
// rule, the guarded action reducer and the history helpers. Everything here is pure, so no DOM, no storage and no clock: the
// monotonic revision counter is injected as a fake. The CCRU preset is read by reference from the preset adapter and a neutral
// fake preset proves the preset base comes from the environment, so no zone sound or canonical name is typed in this file.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEED,
  DEFAULT_STYLE,
  createGenerator,
  createNameResolver,
  createNaming,
  editSound,
  generateSounds,
  setJoin,
  setOverride,
  setSeed,
  setSmoothing,
  setStyle,
  toggleLock,
  type JoinOrder,
  type Naming,
  type NamingPreset,
  type SeedRecord,
  type Smoothing,
  type StyleId,
} from '../../engine/index'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { sameNamesLink, type NamesLink } from '../../app/lib/namesLink'
import {
  EMPTY_ANNOUNCEMENT,
  announced,
  applyNamingAction,
  autosaveWanted,
  defaultNamingFor,
  hasUncarriedEdits,
  keepPreview,
  linkFormOf,
  namesPanelState,
  namingFromLink,
  restoreNaming,
  revertPreview,
  sessionForBase,
  snapshotNaming,
  type NamingAction,
  type NamingEnv,
  type NamingSession,
} from '../../app/lib/namingSession'

const SESSION_SOURCE = fileURLToPath(new URL('../../app/lib/namingSession.ts', import.meta.url))

const env: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }
const CCRU_BASE = CCRU_NAMING_PRESET.base
const DENSE = 28
const SEED_ONLY = INTERACTIVE_MAX_N + 2

// a neutral preset for another base: proves the preset's base is read from the environment, never typed in the session module
const FAKE_BASE = 12
const FAKE_PRESET: NamingPreset = Object.freeze({
  id: 'ccru',
  base: FAKE_BASE,
  sounds: Object.freeze(['ba', 'be', 'bi', 'bo', 'bu', 'ca', 'ce', 'ci', 'co', 'cu', 'da', 'de']),
  names: Object.freeze({}),
})
const fakeEnv: NamingEnv = { interactiveMaxN: env.interactiveMaxN, preset: FAKE_PRESET }

// a small ceiling makes the boundary cheap to test
const smallEnv: NamingEnv = { interactiveMaxN: 28, preset: null }

function counter(): () => number {
  let r = 0
  return () => ++r
}

function fresh(base: number, e: NamingEnv = env, nextRev: () => number = counter()): NamingSession {
  return sessionForBase(base, null, null, e, nextRev)
}

const SEED_LINK_ABC: NamesLink = { kind: 'seed', seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1 }

describe('defaultNamingFor', () => {
  it('opens the preset base on the CCRU preset with the preset sounds', () => {
    const n = defaultNamingFor(CCRU_BASE, env)
    expect(n.source).toBe('ccru')
    expect(n.base).toBe(CCRU_BASE)
    expect(n.sounds).toEqual([...CCRU_NAMING_PRESET.sounds])
    expect(n.locks.size).toBe(0)
    expect(n.overrides.size).toBe(0)
  })

  it('opens every other base on the engine default seed, harsh, high then low, smoothing off', () => {
    const n = defaultNamingFor(DENSE, env)
    expect(DEFAULT_STYLE).toBe('harsh')
    expect(n.source).toBe('generated')
    expect(n.seed).toBe(DEFAULT_SEED)
    expect(n.style).toBe(DEFAULT_STYLE)
    expect(n.join).toBe('hi-lo')
    expect(n.smoothing).toBe(0)
    expect(n.sounds).toEqual(generateSounds(createGenerator(DEFAULT_SEED, DEFAULT_STYLE), DENSE))
  })

  it('is seed-only above the ceiling and dense at the ceiling', () => {
    expect(defaultNamingFor(SEED_ONLY, env).sounds).toBeNull()
    expect(defaultNamingFor(INTERACTIVE_MAX_N, env).sounds).not.toBeNull()
  })

  it('reads the preset base from the environment', () => {
    expect(defaultNamingFor(CCRU_BASE, { interactiveMaxN: env.interactiveMaxN, preset: null }).source).toBe('generated')
    expect(defaultNamingFor(FAKE_BASE, fakeEnv).source).toBe('ccru')
    expect(defaultNamingFor(FAKE_BASE, fakeEnv).sounds).toEqual([...FAKE_PRESET.sounds])
    expect(defaultNamingFor(CCRU_BASE, fakeEnv).source).toBe('generated')
  })
})

describe('linkFormOf', () => {
  it('is null for every default naming', () => {
    for (const b of [CCRU_BASE, DENSE, SEED_ONLY]) expect(linkFormOf(defaultNamingFor(b, env), env)).toBeNull()
    expect(linkFormOf(defaultNamingFor(FAKE_BASE, fakeEnv), fakeEnv)).toBeNull()
    expect(linkFormOf(defaultNamingFor(CCRU_BASE, fakeEnv), fakeEnv)).toBeNull()
  })

  it('gives a generated naming at the preset base a seed link', () => {
    const n = createNaming({ base: CCRU_BASE, interactiveMaxN: env.interactiveMaxN })
    expect(linkFormOf(n, env)).toEqual({ kind: 'seed', seed: DEFAULT_SEED, style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 0 })
  })

  it('gives a ccru naming at the preset base no link, whatever its join and smoothing', () => {
    const n = setSmoothing(setJoin(defaultNamingFor(CCRU_BASE, env), 'lo-hi'), 1)
    expect(n.source).toBe('ccru')
    expect(linkFormOf(n, env)).toBeNull()
  })

  it('gives a seed link carrying all four settings', () => {
    const n = setSmoothing(setJoin(setStyle(setSeed(defaultNamingFor(DENSE, env), 'abc'), 'soft'), 'lo-hi'), 1)
    expect(linkFormOf(n, env)).toEqual(SEED_LINK_ABC)
  })

  it('has a link as soon as any one of the four settings leaves its default', () => {
    const base = defaultNamingFor(DENSE, env)
    const changed: Naming[] = [setSeed(base, 'other'), setStyle(base, 'soft'), setJoin(base, 'lo-hi'), setSmoothing(base, 1)]
    for (const n of changed) expect(linkFormOf(n, env)).not.toBeNull()
    expect(linkFormOf(changed[0] as Naming, env)).toMatchObject({ kind: 'seed', seed: 'other', style: DEFAULT_STYLE })
    expect(linkFormOf(changed[1] as Naming, env)).toMatchObject({ kind: 'seed', seed: DEFAULT_SEED, style: 'soft' })
    expect(linkFormOf(changed[2] as Naming, env)).toMatchObject({ kind: 'seed', join: 'lo-hi' })
    expect(linkFormOf(changed[3] as Naming, env)).toMatchObject({ kind: 'seed', smoothing: 1 })
  })

  it('never carries typed sounds, locks or overrides', () => {
    const typed = setOverride(editSound(defaultNamingFor(DENSE, env), 3, 'zed'), 5, 'Zed', null)
    expect(linkFormOf(typed, env)).toBeNull()
  })

  it('gives a seed-only naming a link by its seed settings', () => {
    expect(linkFormOf(setSeed(defaultNamingFor(SEED_ONLY, env), 'abc'), env)).toMatchObject({ kind: 'seed', seed: 'abc' })
  })

  it('is read from the environment preset, not from a base number', () => {
    const generatedFake = createNaming({ base: FAKE_BASE, interactiveMaxN: env.interactiveMaxN })
    expect(linkFormOf(generatedFake, fakeEnv)).not.toBeNull()
    expect(linkFormOf(generatedFake, env)).toBeNull()
  })
})

describe('namingFromLink', () => {
  it('turns a ccru link at the preset base into the ccru default', () => {
    const n = namingFromLink({ kind: 'ccru' }, CCRU_BASE, env)
    expect(n.source).toBe('ccru')
    expect(n.sounds).toEqual([...CCRU_NAMING_PRESET.sounds])
  })

  it('ignores a ccru link where the preset does not apply', () => {
    expect(namingFromLink({ kind: 'ccru' }, DENSE, env)).toEqual(defaultNamingFor(DENSE, env))
  })

  it('turns a seed link into a generated naming with its four settings', () => {
    const n = namingFromLink(SEED_LINK_ABC, DENSE, env)
    expect(n).toMatchObject({ base: DENSE, source: 'generated', seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1 })
    expect(n.sounds).toEqual(generateSounds(createGenerator('abc', 'soft'), DENSE))
    expect(n.locks.size).toBe(0)
    expect(n.overrides.size).toBe(0)
  })

  it('reaches a seed-only naming above the ceiling', () => {
    const n = namingFromLink(SEED_LINK_ABC, SEED_ONLY, env)
    expect(n.sounds).toBeNull()
    expect(n).toMatchObject({ seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1 })
  })

  it('reproduces seed, style, join, smoothing and source from the link form of a naming', () => {
    const base = defaultNamingFor(DENSE, env)
    const namings: Naming[] = [
      createNaming({ base: CCRU_BASE, interactiveMaxN: env.interactiveMaxN }),
      setSeed(base, 'abc'),
      setStyle(base, 'syllabic'),
      setJoin(base, 'lo-hi'),
      setSmoothing(base, 1),
      setSmoothing(setJoin(setStyle(setSeed(base, 'x y'), 'soft'), 'lo-hi'), 1),
      setSeed(defaultNamingFor(SEED_ONLY, env), 'far'),
    ]
    for (const n of namings) {
      const link = linkFormOf(n, env)
      expect(link).not.toBeNull()
      const back = namingFromLink(link as NamesLink, n.base, env)
      expect(back).toMatchObject({ seed: n.seed, style: n.style, join: n.join, smoothing: n.smoothing, source: n.source })
    }
  })
})

describe('sessionForBase', () => {
  it('opens a base with no link and no slot on its default, unsaved', () => {
    const s = fresh(DENSE)
    expect(s.base).toBe(DENSE)
    expect(s.working).toEqual(defaultNamingFor(DENSE, env))
    expect(s).toMatchObject({ saved: null, preview: false, edited: false })
  })

  it('opens the saved slot when there is no link, still unedited', () => {
    const saved = editSound(defaultNamingFor(DENSE, env), 3, 'zed')
    const s = sessionForBase(DENSE, saved, null, env, counter())
    expect(s.working).toBe(saved)
    expect(s.saved).toBe(saved)
    expect(s).toMatchObject({ preview: false, edited: false })
  })

  it('makes a link the working naming when there is no slot, unsaved until the first edit', () => {
    const s = sessionForBase(DENSE, null, SEED_LINK_ABC, env, counter())
    expect(s.working).toEqual(namingFromLink(SEED_LINK_ABC, DENSE, env))
    expect(s).toMatchObject({ saved: null, preview: false, edited: false })
  })

  it('opens a link whose form differs from the saved slot as a preview and keeps the slot', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const s = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, counter())
    expect(s.preview).toBe(true)
    expect(s.edited).toBe(false)
    expect(s.working).toEqual(namingFromLink(SEED_LINK_ABC, DENSE, env))
    expect(s.saved).toBe(saved)
    expect(s.savedRev).not.toBe(s.rev)
  })

  it('previews a link that differs in only one setting', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'abc')
    for (const link of [
      { kind: 'seed', seed: 'abc', style: 'soft', join: 'hi-lo', smoothing: 0 },
      { kind: 'seed', seed: 'abc', style: DEFAULT_STYLE, join: 'lo-hi', smoothing: 0 },
      { kind: 'seed', seed: 'abc', style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 1 },
      { kind: 'seed', seed: 'abd', style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 0 },
    ] as const) {
      expect(sessionForBase(DENSE, saved, link, env, counter()).preview).toBe(true)
    }
  })

  it('opens the saved slot, not a preview, when the link has the slot form', () => {
    const base = setSeed(defaultNamingFor(DENSE, env), 'abc')
    const saved = editSound(base, 3, 'zed')
    const link: NamesLink = { kind: 'seed', seed: 'abc', style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 0 }
    const s = sessionForBase(DENSE, saved, link, env, counter())
    expect(s.working).toBe(saved)
    expect(s).toMatchObject({ preview: false, edited: false })
  })

  it('treats a link equal to the default as the default form of a saved default-form slot', () => {
    const saved = editSound(defaultNamingFor(DENSE, env), 3, 'zed')
    const link: NamesLink = { kind: 'seed', seed: DEFAULT_SEED, style: DEFAULT_STYLE, join: 'hi-lo', smoothing: 0 }
    const s = sessionForBase(DENSE, saved, link, env, counter())
    expect(s.working).toBe(saved)
    expect(s.preview).toBe(false)
  })

  it('compares the ccru form at the preset base both ways', () => {
    const ccruSaved = setOverride(defaultNamingFor(CCRU_BASE, env), 0, 'Zed', CCRU_NAMING_PRESET)
    const sameForm = sessionForBase(CCRU_BASE, ccruSaved, { kind: 'ccru' }, env, counter())
    expect(sameForm.working).toBe(ccruSaved)
    expect(sameForm.preview).toBe(false)

    const generatedSaved = setSeed(defaultNamingFor(CCRU_BASE, env), 'abc')
    const other = sessionForBase(CCRU_BASE, generatedSaved, { kind: 'ccru' }, env, counter())
    expect(other.preview).toBe(true)
    expect(other.working.source).toBe('ccru')
    expect(other.saved).toBe(generatedSaved)
  })

  it('ignores a saved slot at a seed-only base and never previews there', () => {
    // a stray slot of the very same base (an older build, another tab) and one of another base: both are ignored above the ceiling
    for (const stray of [setSeed(defaultNamingFor(SEED_ONLY, env), 'mine'), setSeed(defaultNamingFor(DENSE, env), 'abc')]) {
      const none = sessionForBase(SEED_ONLY, stray, null, env, counter())
      expect(none.saved).toBeNull()
      expect(none.preview).toBe(false)
      expect(none.working).toEqual(defaultNamingFor(SEED_ONLY, env))
      const linked = sessionForBase(SEED_ONLY, stray, SEED_LINK_ABC, env, counter())
      expect(linked.saved).toBeNull()
      expect(linked.preview).toBe(false)
      expect(linked.working).toEqual(namingFromLink(SEED_LINK_ABC, SEED_ONLY, env))
    }
  })

  it('still uses the slot at the ceiling itself, and only above it ignores one', () => {
    const atCeiling = editSound(defaultNamingFor(smallEnv.interactiveMaxN, smallEnv), 3, 'zed')
    const s = sessionForBase(smallEnv.interactiveMaxN, atCeiling, null, smallEnv, counter())
    expect(s.working).toBe(atCeiling)
    expect(s.saved).toBe(atCeiling)
  })

  it('ignores a saved naming that belongs to another base', () => {
    const other = setSeed(defaultNamingFor(DENSE + 2, env), 'abc')
    const s = sessionForBase(DENSE, other, null, env, counter())
    expect(s.saved).toBeNull()
    expect(s.working).toEqual(defaultNamingFor(DENSE, env))
  })

  it('takes every revision from the injected counter, never repeating one', () => {
    const nextRev = counter()
    const a = sessionForBase(DENSE, null, null, env, nextRev)
    const b = sessionForBase(DENSE, null, null, env, nextRev)
    expect(b.rev).toBeGreaterThan(a.rev)
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const p = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, nextRev)
    expect(p.rev).toBeGreaterThan(b.rev)
    expect(p.savedRev).toBeGreaterThan(b.rev)
  })

  it('reads the preset from the environment', () => {
    expect(fresh(FAKE_BASE, fakeEnv).working.source).toBe('ccru')
    expect(fresh(FAKE_BASE, env).working.source).toBe('generated')
  })
})

// every action type with a payload that changes a rich dense naming: a sound edit, an override and two locks make each one effective
function richSession(): NamingSession {
  const nextRev = counter()
  let s = fresh(DENSE, env, nextRev)
  s = applyNamingAction(s, { type: 'sound', zone: 2, sound: 'zed' }, env, nextRev)
  s = applyNamingAction(s, { type: 'override', mesh: 5, name: 'Zed' }, env, nextRev)
  return s
}

const IMPORTED = setSeed(defaultNamingFor(DENSE, env), 'imported')
const SEED_RECORD: SeedRecord = { seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1 }
const ALL_ACTIONS: readonly NamingAction[] = [
  { type: 'sound', zone: 3, sound: 'kab' },
  { type: 'paste', zone: 4, sounds: ['ba', 'be'] },
  { type: 'lock', zone: 1 },
  { type: 'seed', seed: 'abc' },
  { type: 'reroll', seed: 'q7r8s9t0' },
  { type: 'style', style: 'soft' },
  { type: 'join', join: 'lo-hi' },
  { type: 'smoothing', smoothing: 1 },
  { type: 'source', source: 'generated' },
  { type: 'override', mesh: 6, name: 'Kab' },
  { type: 'reset-override', mesh: 5 },
  { type: 'import', naming: IMPORTED },
  { type: 'use-seed', record: SEED_RECORD },
]

describe('applyNamingAction', () => {
  it('covers every action type of the contract', () => {
    expect(new Set(ALL_ACTIONS.map((a) => a.type)).size).toBe(13)
  })

  it('applies each action to a dense naming: new session, edited, a newer revision', () => {
    for (const action of ALL_ACTIONS) {
      const s = richSession()
      const next = applyNamingAction(s, action, env, counter())
      expect(next, action.type).not.toBe(s)
      expect(next.edited, action.type).toBe(true)
      expect(next.working, action.type).not.toBe(s.working)
      expect(next.preview).toBe(false)
      expect(next.base).toBe(s.base)
      expect(next.saved).toBe(s.saved)
      expect(next.savedRev).toBe(s.savedRev)
    }
  })

  it('refuses every action type while previewing and returns the same session', () => {
    for (const action of ALL_ACTIONS) {
      const s = richSession()
      const preview: NamingSession = { ...s, preview: true }
      expect(applyNamingAction(preview, action, env, counter()), action.type).toBe(preview)
    }
  })

  it('takes a new, strictly increasing revision from the counter for every applied action', () => {
    const nextRev = counter()
    let s = fresh(DENSE, env, nextRev)
    const seen: number[] = [s.rev]
    for (const action of [ALL_ACTIONS[0], ALL_ACTIONS[2], ALL_ACTIONS[3]] as NamingAction[]) {
      s = applyNamingAction(s, action, env, nextRev)
      seen.push(s.rev)
    }
    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  it('does the work of the engine edit it names', () => {
    const s = fresh(DENSE)
    const sound = applyNamingAction(s, { type: 'sound', zone: 3, sound: 'Kab' }, env, counter())
    expect(sound.working.sounds?.[3]).toBe('Kab')
    expect(sound.working.locks.has(3)).toBe(true)

    const paste = applyNamingAction(s, { type: 'paste', zone: 4, sounds: ['ba', 'be'] }, env, counter())
    expect(paste.working.sounds?.slice(4, 6)).toEqual(['ba', 'be'])
    expect([...paste.working.locks].sort((a, b) => a - b)).toEqual([4, 5])

    const lock = applyNamingAction(s, { type: 'lock', zone: 7 }, env, counter())
    expect(lock.working.locks.has(7)).toBe(true)
    expect(applyNamingAction(lock, { type: 'lock', zone: 7 }, env, counter()).working.locks.has(7)).toBe(false)

    const seed = applyNamingAction(s, { type: 'seed', seed: 'abc' }, env, counter())
    expect(seed.working.seed).toBe('abc')
    expect(seed.working.sounds).toEqual(generateSounds(createGenerator('abc', DEFAULT_STYLE), DENSE))
    const reroll = applyNamingAction(s, { type: 'reroll', seed: 'q7r8s9t0' }, env, counter())
    expect(reroll.working.seed).toBe('q7r8s9t0')

    expect(applyNamingAction(s, { type: 'style', style: 'soft' }, env, counter()).working.style).toBe('soft')
    expect(applyNamingAction(s, { type: 'join', join: 'lo-hi' }, env, counter()).working.join).toBe('lo-hi')
    expect(applyNamingAction(s, { type: 'smoothing', smoothing: 1 }, env, counter()).working.smoothing).toBe(1)

    const withOverride = applyNamingAction(s, { type: 'override', mesh: 6, name: 'Kab' }, env, counter())
    expect(withOverride.working.overrides.get(6)).toBe('Kab')
    expect(applyNamingAction(withOverride, { type: 'reset-override', mesh: 6 }, env, counter()).working.overrides.has(6)).toBe(false)
  })

  it('applies a seed record as one step: all four settings, one new revision', () => {
    const nextRev = counter()
    const s = fresh(DENSE, env, nextRev)
    const before = nextRev()
    const next = applyNamingAction(s, { type: 'use-seed', record: SEED_RECORD }, env, nextRev)
    expect(next.working).toMatchObject({ seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1, source: 'generated' })
    expect(next.rev).toBe(before + 1)
  })

  it('switches the source with the environment preset', () => {
    const s = fresh(CCRU_BASE)
    expect(s.working.source).toBe('ccru')
    const generated = applyNamingAction(s, { type: 'source', source: 'generated' }, env, counter())
    expect(generated.working.source).toBe('generated')
    const back = applyNamingAction(generated, { type: 'source', source: 'ccru' }, env, counter())
    expect(back.working.source).toBe('ccru')
    expect(back.working.sounds).toEqual([...CCRU_NAMING_PRESET.sounds])
    // ccru has no preset at another base: the engine refuses and the session stays
    const dense = fresh(DENSE)
    expect(applyNamingAction(dense, { type: 'source', source: 'ccru' }, env, counter())).toBe(dense)
  })

  it('replaces the naming on an import of the same base', () => {
    const s = fresh(DENSE)
    const next = applyNamingAction(s, { type: 'import', naming: IMPORTED }, env, counter())
    expect(next.working).toBe(IMPORTED)
    expect(next.edited).toBe(true)
  })

  it('refuses an import that belongs to another base', () => {
    const s = fresh(DENSE)
    const other = setSeed(defaultNamingFor(DENSE + 2, env), 'imported')
    expect(applyNamingAction(s, { type: 'import', naming: other }, env, counter())).toBe(s)
  })

  it('refuses an import whose table shape does not fit the base', () => {
    const s = fresh(DENSE)
    const sparse = createNaming({ base: DENSE, interactiveMaxN: DENSE - 2 })
    expect(sparse.sounds).toBeNull()
    expect(applyNamingAction(s, { type: 'import', naming: sparse }, env, counter())).toBe(s)
  })

  it('returns the same session for an invalid sound, paste, seed, setting, override or position', () => {
    const s = richSession()
    const bad: NamingAction[] = [
      { type: 'sound', zone: 3, sound: 'a1' },
      { type: 'sound', zone: 3, sound: '' },
      { type: 'sound', zone: 3, sound: 'two words' },
      { type: 'sound', zone: DENSE, sound: 'kab' },
      { type: 'sound', zone: -1, sound: 'kab' },
      { type: 'paste', zone: 4, sounds: ['ba', 'b3', 'bi'] },
      { type: 'paste', zone: DENSE, sounds: ['ba'] },
      { type: 'lock', zone: DENSE },
      { type: 'seed', seed: '' },
      { type: 'reroll', seed: 'x'.repeat(200) },
      { type: 'style', style: 'bogus' as StyleId },
      { type: 'join', join: 'sideways' as JoinOrder },
      { type: 'smoothing', smoothing: 2 as Smoothing },
      { type: 'source', source: 'bogus' as 'ccru' },
      { type: 'override', mesh: 6, name: 'two words' },
      { type: 'override', mesh: 100000, name: 'Kab' },
      { type: 'reset-override', mesh: 100000 },
      { type: 'use-seed', record: { ...SEED_RECORD, style: 'bogus' as StyleId } },
    ]
    for (const action of bad) expect(applyNamingAction(s, action, env, counter()), JSON.stringify(action)).toBe(s)
  })

  it('does not hide a malformed action object: only the engine RangeError of an invalid value is refused quietly', () => {
    const s = fresh(DENSE)
    expect(() => applyNamingAction(s, { type: 'paste', zone: 0, sounds: null as unknown as string[] }, env, counter())).toThrow(TypeError)
  })

  it('refuses a paste with one bad token even when it lies past the last zone, so nothing is half applied', () => {
    const s = fresh(DENSE)
    const long = Array.from({ length: DENSE + 2 }, () => 'ba')
    long[DENSE + 1] = 'b9'
    expect(applyNamingAction(s, { type: 'paste', zone: 0, sounds: long }, env, counter())).toBe(s)
  })

  it('returns the same session for an edit that changes nothing', () => {
    const s = fresh(DENSE)
    expect(applyNamingAction(s, { type: 'reset-override', mesh: 5 }, env, counter())).toBe(s)
    expect(applyNamingAction(s, { type: 'paste', zone: 4, sounds: [] }, env, counter())).toBe(s)
    const resolver = createNameResolver(s.working, null)
    const same = resolver.nameOf(1, 0)
    expect(applyNamingAction(s, { type: 'override', mesh: 0, name: same }, env, counter())).toBe(s)
  })

  it('keeps the dense-only actions out of a seed-only base and lets the seed settings through', () => {
    const s = fresh(SEED_ONLY)
    const denseOnly: NamingAction[] = [
      { type: 'sound', zone: 3, sound: 'kab' },
      { type: 'paste', zone: 4, sounds: ['ba'] },
      { type: 'lock', zone: 1 },
      { type: 'override', mesh: 6, name: 'Kab' },
      { type: 'reset-override', mesh: 5 },
      { type: 'source', source: 'generated' },
    ]
    for (const action of denseOnly) expect(applyNamingAction(s, action, env, counter()), action.type).toBe(s)

    const seed = applyNamingAction(s, { type: 'seed', seed: 'abc' }, env, counter())
    expect(seed.working).toMatchObject({ seed: 'abc', sounds: null })
    expect(seed.edited).toBe(true)
    expect(applyNamingAction(s, { type: 'style', style: 'soft' }, env, counter()).working.style).toBe('soft')
    expect(applyNamingAction(s, { type: 'join', join: 'lo-hi' }, env, counter()).working.join).toBe('lo-hi')
    expect(applyNamingAction(s, { type: 'smoothing', smoothing: 1 }, env, counter()).working.smoothing).toBe(1)
    const used = applyNamingAction(s, { type: 'use-seed', record: SEED_RECORD }, env, counter())
    expect(used.working).toMatchObject({ seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1, sounds: null })
    const imported = createNaming({ base: SEED_ONLY, interactiveMaxN: env.interactiveMaxN, seed: 'imp' })
    expect(applyNamingAction(s, { type: 'import', naming: imported }, env, counter()).working).toBe(imported)
  })
})

describe('keepPreview and revertPreview', () => {
  function previewSession(): NamingSession {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    return sessionForBase(DENSE, saved, SEED_LINK_ABC, env, counter())
  }

  it('adopts the previewed naming as the saved one, marks the session edited and takes a new revision', () => {
    const p = previewSession()
    const nextRev = counter()
    for (let i = 0; i < 50; i++) nextRev()
    const kept = keepPreview(p, nextRev)
    expect(kept.preview).toBe(false)
    expect(kept.saved).toBe(p.working)
    expect(kept.working).toBe(p.working)
    expect(kept.edited).toBe(true)
    expect(kept.rev).toBe(51)
    expect(kept.savedRev).toBe(kept.rev)
  })

  it('does nothing when there is no preview', () => {
    const s = fresh(DENSE)
    expect(keepPreview(s, counter())).toBe(s)
    expect(revertPreview(s)).toBe(s)
  })

  it('goes back to the saved naming with its own revision and leaves the session unedited', () => {
    const p = previewSession()
    const back = revertPreview(p)
    expect(back.preview).toBe(false)
    expect(back.working).toBe(p.saved)
    expect(back.rev).toBe(p.savedRev)
    expect(back.edited).toBe(false)
  })

  it('has a saved naming for every preview, so a revert always has something to restore', () => {
    const p = previewSession()
    expect(p.saved).not.toBeNull()
  })
})

describe('snapshotNaming and restoreNaming', () => {
  it('snapshots the working naming and its revision', () => {
    const s = richSession()
    expect(snapshotNaming(s)).toEqual({ naming: s.working, rev: s.rev })
    expect(snapshotNaming(s).naming).toBe(s.working)
  })

  it('snapshots the saved naming and its revision while previewing', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const p = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, counter())
    expect(snapshotNaming(p)).toEqual({ naming: saved, rev: p.savedRev })
    expect(snapshotNaming(p).naming).toBe(saved)
  })

  it('makes keep one undoable entry and the way back none: the snapshot key changes only on keep', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const nextRev = counter()
    const p = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, nextRev)
    const before = snapshotNaming(p).rev
    expect(snapshotNaming(revertPreview(p)).rev).toBe(before)
    expect(snapshotNaming(keepPreview(p, nextRev)).rev).not.toBe(before)
  })

  it('restores a naming and revision, leaves preview and marks the session edited so autosave rewrites the slot', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const p = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, counter())
    const older = setSeed(defaultNamingFor(DENSE, env), 'older')
    const restored = restoreNaming(p, older, 7)
    expect(restored.working).toBe(older)
    expect(restored.rev).toBe(7)
    expect(restored.preview).toBe(false)
    expect(restored.edited).toBe(true)
    expect(restored.base).toBe(p.base)
  })

  it('refuses to restore a naming of another base', () => {
    const s = fresh(DENSE)
    const other = defaultNamingFor(DENSE + 2, env)
    expect(restoreNaming(s, other, 9)).toBe(s)
  })
})

describe('hasUncarriedEdits', () => {
  it('is false for every default naming', () => {
    for (const b of [CCRU_BASE, DENSE, SEED_ONLY]) expect(hasUncarriedEdits(defaultNamingFor(b, env), env), String(b)).toBe(false)
  })

  it('is false after any seed, style, join or smoothing change', () => {
    const generated = defaultNamingFor(DENSE, env)
    const ccru = defaultNamingFor(CCRU_BASE, env)
    for (const n of [generated, ccru]) {
      expect(hasUncarriedEdits(setSeed(n, 'abc'), env)).toBe(false)
      expect(hasUncarriedEdits(setStyle(n, 'soft'), env)).toBe(false)
      expect(hasUncarriedEdits(setJoin(n, 'lo-hi'), env)).toBe(false)
      expect(hasUncarriedEdits(setSmoothing(n, 1), env)).toBe(false)
    }
    expect(hasUncarriedEdits(setSeed(defaultNamingFor(SEED_ONLY, env), 'abc'), env)).toBe(false)
  })

  it('is true after a lock, an override or a typed sound', () => {
    const n = defaultNamingFor(DENSE, env)
    expect(hasUncarriedEdits(toggleLock(n, 3), env)).toBe(true)
    expect(hasUncarriedEdits(setOverride(n, 5, 'Zed', null), env)).toBe(true)
    expect(hasUncarriedEdits(editSound(n, 3, 'zed'), env)).toBe(true)
    const ccru = defaultNamingFor(CCRU_BASE, env)
    expect(hasUncarriedEdits(setOverride(ccru, 0, 'Zed', CCRU_NAMING_PRESET), env)).toBe(true)
    expect(hasUncarriedEdits(editSound(ccru, 3, 'zed'), env)).toBe(true)
  })

  it('stays true when the locked zone of a typed sound is unlocked again', () => {
    const typed = editSound(defaultNamingFor(DENSE, env), 3, 'zed')
    const unlocked = toggleLock(typed, 3)
    expect(unlocked.locks.size).toBe(0)
    expect(hasUncarriedEdits(unlocked, env)).toBe(true)
  })

  it('is false when a typed sound equals what the link form regenerates', () => {
    const n = defaultNamingFor(DENSE, env)
    const same = editSound(n, 3, n.sounds?.[3] as string)
    expect(hasUncarriedEdits(toggleLock(same, 3), env)).toBe(false)
  })
})

describe('namesPanelState and autosaveWanted', () => {
  it('is pending whenever a worker base switch is in flight, over every other state', () => {
    const p: NamingSession = { ...fresh(DENSE, smallEnv), preview: true }
    expect(namesPanelState(DENSE, p, smallEnv, true)).toBe('pending')
    expect(namesPanelState(DENSE + 2, fresh(DENSE + 2, smallEnv), smallEnv, true)).toBe('pending')
    expect(namesPanelState(DENSE, fresh(DENSE, smallEnv), smallEnv, true)).toBe('pending')
  })

  it('is seed-only above the ceiling, over preview', () => {
    expect(namesPanelState(DENSE + 2, fresh(DENSE + 2, smallEnv), smallEnv, false)).toBe('seed-only')
    const p: NamingSession = { ...fresh(DENSE + 2, smallEnv), preview: true }
    expect(namesPanelState(DENSE + 2, p, smallEnv, false)).toBe('seed-only')
  })

  it('is preview while previewing and ready otherwise, up to and including the ceiling', () => {
    const s = fresh(DENSE, smallEnv)
    expect(namesPanelState(DENSE, s, smallEnv, false)).toBe('ready')
    expect(namesPanelState(DENSE, { ...s, preview: true }, smallEnv, false)).toBe('preview')
    expect(namesPanelState(INTERACTIVE_MAX_N, fresh(INTERACTIVE_MAX_N), env, false)).toBe('ready')
    expect(namesPanelState(SEED_ONLY, fresh(SEED_ONLY), env, false)).toBe('seed-only')
  })

  it('wants an autosave only for an edited session, not previewing, at or below the ceiling', () => {
    const s = fresh(DENSE, smallEnv)
    expect(autosaveWanted(s, smallEnv)).toBe(false)
    const edited: NamingSession = { ...s, edited: true }
    expect(autosaveWanted(edited, smallEnv)).toBe(true)
    expect(autosaveWanted({ ...edited, preview: true }, smallEnv)).toBe(false)
    const above: NamingSession = { ...fresh(DENSE + 2, smallEnv), edited: true }
    expect(autosaveWanted(above, smallEnv)).toBe(false)
  })

  it('writes the edited default only after its first edit', () => {
    const nextRev = counter()
    const s = fresh(DENSE, env, nextRev)
    expect(autosaveWanted(s, env)).toBe(false)
    expect(autosaveWanted(applyNamingAction(s, { type: 'lock', zone: 2 }, env, nextRev), env)).toBe(true)
  })

  it('never autosaves a preview, and starts a link at no edit', () => {
    const saved = setSeed(defaultNamingFor(DENSE, env), 'mine')
    const p = sessionForBase(DENSE, saved, SEED_LINK_ABC, env, counter())
    expect(autosaveWanted(p, env)).toBe(false)
    expect(autosaveWanted(keepPreview(p, counter()), env)).toBe(true)
    expect(autosaveWanted(revertPreview(p), env)).toBe(false)
  })
})

// Review WR-08: every announcement is a new value, so the live carrier (which renders it under a key of its nonce) changes its DOM even
// when the sentence is the one it already said, and a screen reader reads it again.
describe('announced', () => {
  it('starts empty', () => {
    expect(EMPTY_ANNOUNCEMENT).toEqual({ text: '', nonce: 0 })
  })

  it('carries the text and a nonce that is new every time', () => {
    const first = announced(EMPTY_ANNOUNCEMENT, 'Restored.')
    expect(first.text).toBe('Restored.')
    expect(first.nonce).toBeGreaterThan(EMPTY_ANNOUNCEMENT.nonce)
  })

  it('gives the same sentence a different nonce the second time, which is what makes it a DOM change again', () => {
    const first = announced(EMPTY_ANNOUNCEMENT, 'Restored.')
    const second = announced(first, 'Restored.')
    expect(second.text).toBe(first.text)
    expect(second.nonce).not.toBe(first.nonce)
    expect(second).not.toBe(first)
  })

  it('a cleared line is an announcement too, with its own nonce, and never reuses an earlier one', () => {
    const seen = new Set<number>()
    let a = EMPTY_ANNOUNCEMENT
    for (const text of ['a', 'a', '', '', 'b', 'a']) {
      a = announced(a, text)
      expect(seen.has(a.nonce)).toBe(false)
      seen.add(a.nonce)
      expect(a.text).toBe(text)
    }
  })

  it('does not change its input', () => {
    const before = announced(EMPTY_ANNOUNCEMENT, 'x')
    const snapshot = { ...before }
    announced(before, 'y')
    expect(before).toEqual(snapshot)
  })
})

describe('the session module source', () => {
  const source = readFileSync(SESSION_SOURCE, 'utf8')

  it('types no ceiling and no preset base: both come from the environment', () => {
    expect(source).not.toMatch(/4000/)
    expect(source).not.toMatch(/=== 10\b/)
  })

  it('compares link forms through sameNamesLink', () => {
    expect(source).toMatch(/sameNamesLink\(/)
    expect(sameNamesLink(null, null)).toBe(true)
  })
})

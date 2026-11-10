// Pure naming session rules (Phase 7, plan 13; D-09, D-10, D-11, D-13, 07-RESEARCH Pattern 8, Pitfall 7): the defaults per base,
// the naming's link form, the preview/adopt rule for a shared link, the guarded action reducer and the history helpers.
// NumogramClient applies the results in one batched update (plan 07-18); the revision `rev` comes from the client's monotonic
// counter (injected as nextRev) so a history entry's key never reuses a value. Nothing here reads the DOM, the storage or a clock,
// and no ceiling or preset base is typed: both come from the environment. Original CCRUG code (MIT, NOTICE section 1).
import {
  DEFAULT_SEED,
  DEFAULT_STYLE,
  createGenerator,
  createNaming,
  editSound,
  generateSounds,
  pasteSounds,
  resetOverride,
  setJoin,
  setOverride,
  setSeed,
  setSmoothing,
  setSource,
  setStyle,
  toggleLock,
  validateSound,
  type JoinOrder,
  type Naming,
  type NamingPreset,
  type SeedRecord,
  type Smoothing,
  type StyleId,
} from '../../engine/index'
import { sameNamesLink, type NamesLink } from './namesLink'

/** What the session rules need from the application: the interactive ceiling (tier table) and the CCRU preset (or null). */
export interface NamingEnv {
  readonly interactiveMaxN: number
  readonly preset: NamingPreset | null
}

/**
 * The naming state of one displayed base. `working` is what the panel and the displays show, `rev` its history key. `saved` is the
 * naming the visitor's browser slot held when the session opened (or the working naming at the moment of Keep): it is only read
 * while previewing and by Keep and Back, never kept in step with later edits. `edited` becomes true on the first edit, undo or
 * keep, and is what lets autosave write a slot.
 */
export interface NamingSession {
  readonly base: number
  readonly working: Naming
  readonly rev: number
  readonly saved: Naming | null
  readonly savedRev: number
  readonly preview: boolean
  readonly edited: boolean
}

/** The monotonic revision counter of the client, injected so the rules stay pure. */
export type NextRev = () => number

export type NamingAction =
  | { readonly type: 'sound'; readonly zone: number; readonly sound: string }
  | { readonly type: 'paste'; readonly zone: number; readonly sounds: readonly string[] }
  | { readonly type: 'lock'; readonly zone: number }
  | { readonly type: 'seed'; readonly seed: string }
  | { readonly type: 'reroll'; readonly seed: string }
  | { readonly type: 'style'; readonly style: StyleId }
  | { readonly type: 'join'; readonly join: JoinOrder }
  | { readonly type: 'smoothing'; readonly smoothing: Smoothing }
  | { readonly type: 'source'; readonly source: 'generated' | 'ccru' }
  | { readonly type: 'override'; readonly mesh: number; readonly name: string }
  | { readonly type: 'reset-override'; readonly mesh: number }
  | { readonly type: 'import'; readonly naming: Naming }
  | { readonly type: 'use-seed'; readonly record: SeedRecord }

export type NamesPanelState = 'ready' | 'pending' | 'seed-only' | 'preview'

/** The CCRU preset when it is the preset of `base`, else null (the preset base is data of the environment). */
function presetFor(base: number, env: NamingEnv): NamingPreset | null {
  return env.preset !== null && env.preset.base === base ? env.preset : null
}

/**
 * The naming a base opens on with no link and no slot: the CCRU preset where the environment has one for the base (D-14), else the
 * engine's default seed, style, high-then-low and smoothing off (D-10). Above the ceiling the table is absent (seed-only).
 */
export function defaultNamingFor(base: number, env: NamingEnv): Naming {
  const preset = presetFor(base, env)
  if (preset !== null) return createNaming({ base, interactiveMaxN: env.interactiveMaxN, source: 'ccru', preset })
  return createNaming({ base, interactiveMaxN: env.interactiveMaxN })
}

/** The naming a link names at `base`: a ccru link only means something where the preset applies (else the default), a seed link its four settings. */
export function namingFromLink(link: NamesLink, base: number, env: NamingEnv): Naming {
  if (link.kind === 'ccru') return defaultNamingFor(base, env)
  return createNaming({
    base,
    interactiveMaxN: env.interactiveMaxN,
    seed: link.seed,
    style: link.style,
    join: link.join,
    smoothing: link.smoothing,
  })
}

/**
 * The link form of a naming: null when it is what the base opens on by default (no link is needed to reproduce it), else `ccru` or a
 * seed link carrying the four generator settings. Sounds, locks and overrides are never part of a link form. Compares fields only;
 * it never generates sounds, so it is cheap at every base.
 */
export function linkFormOf(n: Naming, env: NamingEnv): NamesLink | null {
  const defaultSource = presetFor(n.base, env) !== null ? 'ccru' : 'generated'
  if (n.source === defaultSource) {
    if (n.source === 'ccru') return null
    if (n.seed === DEFAULT_SEED && n.style === DEFAULT_STYLE && n.join === 'hi-lo' && n.smoothing === 0) return null
  }
  if (n.source === 'ccru') return { kind: 'ccru' }
  return { kind: 'seed', seed: n.seed, style: n.style, join: n.join, smoothing: n.smoothing }
}

/**
 * The session for a base that was just switched to or opened (D-09, D-10, D-13), a pure function of (slot, link):
 * - no link: the saved slot, else the default;
 * - a link and no slot: the link's naming, unsaved until the first edit;
 * - a link and a slot of the same link form: the slot (it carries the visitor's edits on top of the same settings);
 * - a link and a slot of another link form: the link's naming as an unsaved preview, the slot kept.
 * Above the ceiling nothing is saved (D-11): a saved argument is ignored and there is never a preview. A saved naming of another
 * base is ignored too. Nothing is edited yet, so nothing is written until the first edit.
 */
export function sessionForBase(
  base: number,
  saved: Naming | null,
  link: NamesLink | null,
  env: NamingEnv,
  nextRev: NextRev,
): NamingSession {
  const slot = base <= env.interactiveMaxN && saved !== null && saved.base === base ? saved : null
  const rev = nextRev()
  const open = (working: Naming, kept: Naming | null): NamingSession => ({
    base,
    working,
    rev,
    saved: kept,
    savedRev: rev,
    preview: false,
    edited: false,
  })

  if (link === null) return open(slot ?? defaultNamingFor(base, env), slot)

  const fromLink = namingFromLink(link, base, env)
  if (slot === null) return open(fromLink, null)
  if (sameNamesLink(linkFormOf(fromLink, env), linkFormOf(slot, env))) return open(slot, slot)
  return { base, working: fromLink, rev, saved: slot, savedRev: nextRev(), preview: true, edited: false }
}

/** The actions that need the per-zone table, which a seed-only naming does not have. */
const DENSE_ONLY: ReadonlySet<NamingAction['type']> = new Set<NamingAction['type']>([
  'sound',
  'paste',
  'lock',
  'override',
  'reset-override',
  'source',
])

/** True when every text of the list is a valid sound: a paste changes nothing when any token is bad. */
function allSounds(list: readonly string[]): boolean {
  for (const text of list) {
    if (typeof text !== 'string' || !validateSound(text).ok) return false
  }
  return true
}

/** The naming after `action`, or `n` itself when the action does not apply (the engine edit throws a RangeError for an invalid one). */
function reduce(n: Naming, action: NamingAction, env: NamingEnv): Naming {
  if (n.sounds === null && DENSE_ONLY.has(action.type)) return n
  switch (action.type) {
    case 'sound':
      if (typeof action.sound !== 'string' || !validateSound(action.sound).ok) return n
      return editSound(n, action.zone, action.sound)
    case 'paste':
      if (!allSounds(action.sounds)) return n
      return pasteSounds(n, action.zone, action.sounds).naming
    case 'lock':
      return toggleLock(n, action.zone)
    case 'seed':
    case 'reroll':
      return setSeed(n, action.seed)
    case 'style':
      return setStyle(n, action.style)
    case 'join':
      return setJoin(n, action.join)
    case 'smoothing':
      return setSmoothing(n, action.smoothing)
    case 'source':
      return setSource(n, action.source, env.preset)
    case 'override':
      return setOverride(n, action.mesh, action.name, env.preset)
    case 'reset-override':
      return resetOverride(n, action.mesh)
    case 'use-seed':
      return setSmoothing(setJoin(setStyle(setSeed(n, action.record.seed), action.record.style), action.record.join), action.record.smoothing)
    case 'import':
      // another base, or a table whose shape does not fit this base (dense against seed-only), is not for this session
      return action.naming.base === n.base && (action.naming.sounds === null) === (n.sounds === null) ? action.naming : n
  }
}

/**
 * Applies one naming action (Pitfall 7). While previewing every action is refused and the same session comes back. Otherwise a
 * changed naming gives a new session with `edited` set and a new revision from `nextRev`; an invalid action, a dense-only action at a
 * seed-only base, an import of another base and an edit that changes nothing return the same session (no history entry, no autosave).
 */
export function applyNamingAction(s: NamingSession, action: NamingAction, env: NamingEnv, nextRev: NextRev): NamingSession {
  if (s.preview) return s
  let next: Naming
  try {
    next = reduce(s.working, action, env)
  } catch (e) {
    if (e instanceof RangeError) return s
    throw e
  }
  if (next === s.working) return s
  return { ...s, working: next, rev: nextRev(), edited: true }
}

/** "Keep this naming" (D-13): the previewed naming becomes the saved one. The session counts as edited so autosave writes it, with a new revision so history sees one entry. */
export function keepPreview(s: NamingSession, nextRev: NextRev): NamingSession {
  if (!s.preview) return s
  const rev = nextRev()
  return { ...s, preview: false, saved: s.working, savedRev: rev, rev, edited: true }
}

/** "Back to my saved naming" (D-13): the saved naming and its own revision return, so history sees no new entry. */
export function revertPreview(s: NamingSession): NamingSession {
  if (!s.preview || s.saved === null) return s
  return { ...s, working: s.saved, rev: s.savedRev, preview: false }
}

/**
 * The naming a history entry records: while previewing it is the SAVED naming (so Keep is one undoable entry and Back creates
 * none), otherwise the working one.
 */
export function snapshotNaming(s: NamingSession): { readonly naming: Naming; readonly rev: number } {
  if (s.preview && s.saved !== null) return { naming: s.saved, rev: s.savedRev }
  return { naming: s.working, rev: s.rev }
}

/** The session after an undo or redo restored `naming` (with its revision): previewing ends and the session counts as edited, so autosave rewrites the slot. A naming of another base is refused. */
export function restoreNaming(s: NamingSession, naming: Naming, rev: number): NamingSession {
  if (naming.base !== s.base) return s
  return { ...s, working: naming, rev, preview: false, edited: true }
}

/**
 * True when the naming holds work a link cannot carry (the "edits not in links" note): a lock, an override, or a dense table that
 * differs from what its link form regenerates. Cheap unless the table must be compared, which generates the table once; callers
 * memoise it on the (immutable) naming.
 */
export function hasUncarriedEdits(n: Naming, env: NamingEnv): boolean {
  if (n.locks.size > 0 || n.overrides.size > 0) return true
  if (n.sounds === null) return false
  let expected: readonly string[] | null
  if (n.source === 'ccru') expected = presetFor(n.base, env)?.sounds ?? null
  else expected = generateSounds(createGenerator(n.seed, n.style), n.base)
  if (expected === null || expected.length !== n.sounds.length) return true
  for (let zone = 0; zone < expected.length; zone++) {
    if (expected[zone] !== n.sounds[zone]) return true
  }
  return false
}

/** The Names panel state (UI-SPEC "States"): a pending worker base switch first, then seed-only by the base alone (never a render tier), then preview. */
export function namesPanelState(base: number, s: NamingSession, env: NamingEnv, pending: boolean): NamesPanelState {
  if (pending) return 'pending'
  if (base > env.interactiveMaxN) return 'seed-only'
  return s.preview ? 'preview' : 'ready'
}

/** True when the browser slot should be written: after a first edit, never in preview, never above the ceiling (D-09, D-11). */
export function autosaveWanted(s: NamingSession, env: NamingEnv): boolean {
  return s.edited && !s.preview && s.base <= env.interactiveMaxN
}

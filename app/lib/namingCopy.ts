// Copy of the Names feature (Phase 7, 07-UI-SPEC Copywriting Contract, research Pitfall 14). Original CCRUG code (MIT, NOTICE section 1).
// Every visible string of the feature lives here once: the panel, the demon name editor, statuses, import and export, the label mode
// and the shortcut line. Numbers, bases, caps and ceilings are always parameters or imported constants, never typed prose, so a
// component never writes a sentence and a limit has one home. Voice (Phases 4 to 6): short, factual, present tense, no apology, no
// exclamation, no em dash, plurals as `1 locked zone` and `{n} locked zones`. Text the visitor typed or a file supplied is echoed
// through clipEcho, so a status line stays bounded; everything here renders as a React text node.
import { clipEcho } from '../../engine/core/base'
import {
  ISSUES_MAX,
  NAME_MAX_LENGTH,
  SEED_MAX_LENGTH,
  SOUND_MAX_LENGTH,
  UNKNOWN_KEYS_MAX,
  type JoinOrder,
  type NamingIssue,
  type StyleId,
  type TextProblem,
} from '../../engine/index'
import { CCRU_LINK_BASE } from './namesLink'
import { ZONE_PAGE_STEP } from './namingLimits'
import { INTERACTIVE_MAX_N } from './tierBounds'

// U+00B7 MIDDLE DOT, built as data (never a typed character): the separator of the matrix tooltip.
const MIDDLE_DOT = String.fromCodePoint(0xb7)

const freezeRecord = <K extends string>(record: Record<K, string>): Readonly<Record<K, string>> => Object.freeze(record)

/** The fixed strings of the Names feature. The key names are read by the panel, editor, browser, label and share components. */
export const NAMES_COPY = Object.freeze({
  // panel and header
  title: 'Names',
  tagPreview: 'unsaved preview',
  tagEdits: 'edits not in links',
  // eyebrows
  sourceEyebrow: 'Source:',
  seedEyebrow: 'Seed',
  styleEyebrow: 'Style:',
  joinEyebrow: 'Join order:',
  previewEyebrow: 'Preview',
  collisionsEyebrow: 'Collisions',
  // radio groups: source, style, join order
  sourceCcru: 'CCRU',
  sourceGenerated: 'Generated',
  styleLabels: freezeRecord<StyleId>({ harsh: 'Harsh', soft: 'Soft', syllabic: 'Syllabic' }),
  styleDescriptions: freezeRecord<StyleId>({
    harsh: 'Consonant clusters, like the CCRU names.',
    soft: 'Fewer clusters, more vowels.',
    syllabic: 'Short syllables you can read aloud.',
  }),
  joinLabels: freezeRecord<JoinOrder>({ 'hi-lo': 'High then low', 'lo-hi': 'Low then high' }),
  joinDescriptions: freezeRecord<JoinOrder>({
    'hi-lo': "The higher zone's sound comes first.",
    'lo-hi': "The lower zone's sound comes first.",
  }),
  sourceGroupAria: 'Naming source',
  styleGroupAria: 'Style',
  joinGroupAria: 'Join order',
  // smoothing
  smoothingLabel: 'Smooth names',
  smoothingHelper: 'Adds vowels between consonant clusters. Off by default.',
  smoothingInert: 'Smoothing makes no difference to these sounds.',
  // the hint for a base that has no CCRU source
  ccruHint: `CCRU names exist for base ${CCRU_LINK_BASE} only.`,
  // preview table
  previewHeaderAb: 'A::B',
  previewHeaderRaw: 'Raw',
  previewHeaderSmoothed: 'Smoothed',
  previewCaption: 'CCRU names are set by hand. This preview shows what the join and smoothing rules give.',
  // honest sharing
  shareNote: 'Links carry the preset or seed only. Choose Export names to share your edits.',
  shareTitle: 'Share current state',
  shareTitleUncarried:
    'Share current state. Links carry the preset or seed only. Choose Export names in the Names panel to share your edits.',
  // buttons (every one names its verb and its noun)
  reroll: 'Reroll unlocked sounds',
  showCollisions: 'Show repeated names',
  hideCollisions: 'Hide repeated names',
  showMoreNames: 'Show more names',
  exportNames: 'Export names',
  importNames: 'Import names',
  useSeed: 'Use its seed here',
  undoChange: 'Undo this change',
  keep: 'Keep this naming',
  revert: 'Back to my saved naming',
  // unsaved preview notice
  noticeLabel: 'Unsaved preview',
  // autosave line
  savedNone: 'Edits save in this browser, one slot per base.',
  savedFailed: "Couldn't save in this browser. Choose Export names to keep a copy.",
  savedPreview: 'Not saved. Choose Keep this naming to save it.',
  savedSeedOnly: 'Not saved in this browser at this size. The page link keeps the seed and style.',
  // collisions
  collisionsNone: 'None. Every demon name is unique.',
  collisionsChecking: 'Checking...',
  previewJump: 'Keep this naming to rename demons.',
  // zone list
  zoneHeader: 'Zone',
  soundHeader: 'Sound',
  lockHeader: 'Lock',
  gotoPlaceholder: 'zone number',
  gotoAria: 'Go to zone',
  listHelperLock: 'Editing a sound locks it. Locked zones keep their sound when you reroll or change the seed.',
  listHelperPaste: 'Paste a list into a row to fill the rows below it.',
  lockTitle: 'Locked zones keep their sound when you reroll or change the seed.',
  // demon name editor
  editorLabel: 'Name',
  tagGenerated: 'generated',
  tagCcru: 'CCRU name',
  tagOverridden: 'overridden',
  rename: 'Rename demon',
  resetGenerated: 'Reset to generated name',
  resetCcru: 'Reset to CCRU name',
  saveName: 'Save name',
  cancelRename: 'Cancel rename',
  // overridden marker in the demon browser
  overriddenTitle: 'Overridden name',
  overriddenHidden: ', overridden',
  // label mode
  soundsRadio: 'Sounds',
  soundsNote: "Nodes show each zone's sound from the Names panel.",
  numeralsNote: 'This layout shows numerals.',
  labelsRowSounds: 'Sounds',
  labelsInfoSounds: 'Show or hide zone sounds on the diagram (numerals on the pair graph and planetary layouts).',
  // shortcuts modal
  shortcutLine: `Names panel: in the zone list, Up and Down move between rows, Page Up and Page Down jump ${ZONE_PAGE_STEP} rows, Enter saves a sound, Escape reverts it. Editing a sound locks its zone.`,
  // result statuses that need no number
  kept: 'Kept this naming. Undo restores your previous names.',
  backToSaved: 'Back to your saved names.',
  restored: 'Names restored from history.',
  loadedCcru: `Loaded the CCRU names for base ${CCRU_LINK_BASE}.`,
})

// ----- counts and text rules -----

/** `n` followed by the right word: `plural(1, 'locked zone', 'locked zones')` is `1 locked zone`. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// one place for the five reasons of a rejected text; `thing` is the singular noun and `things` the capitalised plural
function reason(r: TextProblem, thing: string, things: string, limit: number): string {
  switch (r) {
    case 'empty':
      return `A ${thing} needs at least 1 letter.`
    case 'space':
      return `${things} can't contain spaces.`
    case 'digit':
      return `${things} can't contain digits.`
    case 'long':
      return `A ${thing} can be at most ${limit} characters.`
    default:
      return `${things} can only contain letters.`
  }
}

/** Why a zone sound is refused (typed, pasted or imported). */
export function soundReason(r: TextProblem): string {
  return reason(r, 'sound', 'Sounds', SOUND_MAX_LENGTH)
}

/** Why a demon name is refused. */
export function nameReason(r: TextProblem): string {
  return reason(r, 'name', 'Names', NAME_MAX_LENGTH)
}

/** `Zone {label}: {reason}`. */
export function zoneIssue(label: string, r: TextProblem): string {
  return `Zone ${label}: ${soundReason(r)}`
}

/** `{a}::{b}: {reason}`, `netSpan` being the demon's net-span as shown to people. */
export function demonIssue(netSpan: string, r: TextProblem): string {
  return `${netSpan}: ${nameReason(r)}`
}

/** The refusal under the seed field. */
export function seedError(): string {
  return `A seed needs 1 to ${SEED_MAX_LENGTH} characters.`
}

// ----- summary and collisions -----

/** `{l} locked zones, {o} renamed demons.` */
export function summaryLine(locked: number, overridden: number): string {
  return `${plural(locked, 'locked zone', 'locked zones')}, ${plural(overridden, 'renamed demon', 'renamed demons')}.`
}

/** `{g} repeated names across {d} demons.` */
export function collisionsSome(groups: number, demons: number): string {
  return `${plural(groups, 'repeated name', 'repeated names')} across ${plural(demons, 'demon', 'demons')}.`
}

/** `Not checked above {n} zones.` (the scan limit is data). */
export function collisionsNotChecked(limit: number): string {
  return `Not checked above ${limit} zones.`
}

/** `Showing {shown} of {g} names.` */
export function showingNames(shown: number, groups: number): string {
  return `Showing ${shown} of ${groups} names.`
}

/** `+{k} more`, after the jump buttons of a collision line. */
export function moreJumps(k: number): string {
  return `+${k} more`
}

/** The accessible name of a jump button: it extends the visible net-span, so the visible text is inside it. */
export function jumpAriaLabel(a: string, b: string, name: string): string {
  return `Rename demon ${a}::${b}, currently ${name}`
}

/** The status after a rename is saved. */
export function renamed(a: string, b: string, name: string): string {
  return `Renamed ${a}::${b} to ${name}.`
}

/** The status after an override is reset. */
export function backTo(a: string, b: string, name: string): string {
  return `${a}::${b} is back to ${name}.`
}

// ----- export and import -----

/** `Exported names for base {n}.` */
export function exportSuccess(base: number): string {
  return `Exported names for base ${base}.`
}

/** The seed-only export: no zone sounds exist above the interactive ceiling. */
export function exportSeedOnly(base: number): string {
  return `Exported the seed and style for base ${base}. Zone sounds are not included above ${INTERACTIVE_MAX_N} zones.`
}

/** `Imported names for base {n}: {z} sounds, {o} renamed demons.` */
export function importSuccess(base: number, zones: number, overrides: number): string {
  return `Imported names for base ${base}: ${plural(zones, 'sound', 'sounds')}, ${plural(overrides, 'renamed demon', 'renamed demons')}.`
}

/** The success line of a seed-only import. */
export function importSeedOnly(base: number): string {
  return `Imported the seed and style for base ${base}.`
}

/** The sentence appended to a success line for keys this version ignored: at most UNKNOWN_KEYS_MAX listed, then `and {k} more`. */
export function unknownKeysSuffix(shown: readonly string[], total: number): string {
  const listed = shown.slice(0, UNKNOWN_KEYS_MAX)
  if (listed.length === 0 || total <= 0) return ''
  const more = total - listed.length
  const keys = listed.map(key => clipEcho(key)).join(', ')
  return ` Ignored unknown keys: ${keys}${more > 0 ? ` and ${more} more` : ''}.`
}

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB

function scaled(value: number, unit: string): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`
}

/** A size as whole MB when exact (`8 MB`), else with one decimal; below a megabyte the same rule in KB, then plain bytes. */
export function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return scaled(bytes / BYTES_PER_MB, 'MB')
  if (bytes >= BYTES_PER_KB) return scaled(bytes / BYTES_PER_KB, 'KB')
  return plural(bytes, 'byte', 'bytes')
}

/** What an import refusal can be: a validator issue, or the browser failing to read the file at all. */
export type ImportFailure = NamingIssue | { readonly kind: 'unreadable' }

/** The failures whose sentence needs nothing from the current naming. */
export type ContextFreeFailure = Extract<
  ImportFailure,
  { readonly kind: 'not-json' | 'not-names-file' | 'too-large' | 'unknown-version' | 'unreadable' }
>

/** What the sentences that name a base, a zone or a demon need from the app: the displayed base and the active label scheme's labels. */
export interface ImportCopyContext {
  readonly base: number
  /** A zone as every other panel labels it. */
  readonly zoneLabel: (zone: number) => string
  /** A demon's net-span (`A::B`) from its mesh number, in the active label scheme. */
  readonly netSpan: (mesh: number) => string
}

function needContext(kind: string, ctx: ImportCopyContext | undefined): ImportCopyContext {
  if (ctx === undefined) throw new TypeError('importError needs the import context for an issue of kind ' + kind)
  return ctx
}

// the one line of a refused entry; the kinds that end a read by themselves never reach a list and get a plain fallback
function entryLine(issue: NamingIssue, ctx: ImportCopyContext): string {
  switch (issue.kind) {
    case 'bad-sound':
      return zoneIssue(ctx.zoneLabel(issue.zone), issue.reason)
    case 'bad-override-name':
      return demonIssue(ctx.netSpan(issue.mesh), issue.reason)
    case 'bad-override-key':
      return `Override key "${clipEcho(issue.key)}" is not a demon of base ${ctx.base}.`
    case 'bad-field':
      return `Field ${clipEcho(issue.path)} is not valid.`
    case 'seed-only-base':
      return `Base ${ctx.base} is above ${INTERACTIVE_MAX_N} zones, so only a seed and style can be imported.`
    case 'not-json':
    case 'not-names-file':
    case 'too-large':
    case 'unknown-version':
    case 'wrong-base':
      return 'This file is not valid.'
    default: {
      const unreachable: never = issue
      void unreachable
      return 'This file is not valid.'
    }
  }
}

/**
 * The refusal of an import that listed entries: `Nothing was imported.`, one line per issue (at most ISSUES_MAX), `And {k} more.` from
 * the exact total, then what to do next. `issueCount` is the validator's exact total, which can be more than `issues` keeps.
 */
export function invalidEntries(issues: readonly NamingIssue[], issueCount: number, ctx: ImportCopyContext): string {
  const shown = issues.slice(0, ISSUES_MAX)
  const more = Math.max(0, issueCount - shown.length)
  const everyZone = shown.length > 0 && shown.every(issue => issue.kind === 'bad-sound')
  const parts = ['Nothing was imported.', ...shown.map(issue => entryLine(issue, ctx))]
  if (more > 0) parts.push(`And ${more} more.`)
  parts.push(everyZone ? 'Fix these zones in the file and import it again.' : 'Fix these entries in the file and import it again.')
  return parts.join(' ')
}

/**
 * The sentence for one refused import. The kinds that name a base, a zone or a demon need the context; the others do not, so a caller
 * that has none (a file too large to read, a failed read) calls it with the issue alone.
 */
export function importError(issue: ContextFreeFailure): string
export function importError(issue: ImportFailure, ctx: ImportCopyContext): string
export function importError(issue: ImportFailure, ctx?: ImportCopyContext): string {
  switch (issue.kind) {
    case 'not-json':
      return "This file isn't valid JSON. Nothing was imported. Choose a file exported from the Names panel."
    case 'too-large':
      return `This file is larger than ${formatBytes(issue.maxBytes)}. Nothing was imported. Choose a smaller file exported from the Names panel.`
    case 'wrong-base':
      return `This file is for base ${issue.fileBase}, and you are on base ${needContext(issue.kind, ctx).base}. Nothing was imported. Switch to base ${issue.fileBase} to import it.`
    case 'unknown-version':
      return `This file uses names format ${clipEcho(issue.version)}, which this version can't read. Nothing was imported. Export the names again from this version.`
    case 'not-names-file':
      return "This file isn't a names file for this app. Nothing was imported. Choose a file exported from the Names panel."
    case 'seed-only-base':
      return `Base ${needContext(issue.kind, ctx).base} is above ${INTERACTIVE_MAX_N} zones, so only a seed and style can be imported. Nothing was imported. Choose a seed-only file, or switch to a base up to ${INTERACTIVE_MAX_N}.`
    case 'bad-sound':
    case 'bad-override-name':
    case 'bad-override-key':
    case 'bad-field':
      return invalidEntries([issue], 1, needContext(issue.kind, ctx))
    case 'unreadable':
      return "Couldn't read this file. Nothing was imported. Choose the file again."
    default: {
      const unreachable: never = issue
      void unreachable
      return "Couldn't read this file. Nothing was imported. Choose the file again."
    }
  }
}

// ----- zone list: paste, go to zone -----

/** `Pasted {t} sounds from zone {label}.` */
export function pasted(tokens: number, label: string): string {
  return `Pasted ${plural(tokens, 'sound', 'sounds')} from zone ${label}.`
}

/** A paste with more tokens than rows below the focused one: how many fit and how many were not used. */
export function pastedPartial(tokens: number, used: number, label: string, unused: number): string {
  return `Pasted ${plural(tokens, 'sound', 'sounds')}. ${used} fit from zone ${label} and ${unused} ${unused === 1 ? 'was' : 'were'} not used.`
}

/** A paste refused whole: the first bad zone and why. */
export function pasteRefused(label: string, r: TextProblem): string {
  return `Paste not applied. ${zoneIssue(label, r)}`
}

/** The go-to field found no zone; the typed text is echoed clipped. */
export function noZone(text: string, base: number): string {
  return `No zone "${clipEcho(text)}" at base ${base}.`
}

// ----- result statuses -----

/** `Generated names for base {n} from seed {seed}.` */
export function generated(base: number, seed: string): string {
  return `Generated names for base ${base} from seed ${clipEcho(seed)}.`
}

/** The status after Reroll. */
export function rerolled(unlocked: number, locked: number): string {
  return `Rerolled ${plural(unlocked, 'unlocked zone', 'unlocked zones')}. ${plural(locked, 'locked zone', 'locked zones')} kept.`
}

/** The status after a style change regenerated the unlocked zones. */
export function regenerated(unlocked: number, style: StyleId, locked: number): string {
  return `Regenerated ${plural(unlocked, 'unlocked zone', 'unlocked zones')} with the ${style} style. ${plural(locked, 'locked zone', 'locked zones')} kept.`
}

/** `Join order: high then low.` or `Join order: low then high.` */
export function joinStatus(join: JoinOrder): string {
  return `Join order: ${NAMES_COPY.joinLabels[join].toLowerCase()}.`
}

/** `Smoothing on.` or `Smoothing off.` */
export function smoothingStatus(on: boolean): string {
  return on ? 'Smoothing on.' : 'Smoothing off.'
}

// ----- notices and states -----

/** The body of the unsaved-preview notice. */
export function noticeBody(base: number): string {
  return `This link's names are shown for base ${base}. Your saved names are kept until you choose.`
}

/** The autosave line after the first save. */
export function savedLine(base: number): string {
  return `Saved in this browser for base ${base}.`
}

/** The sentence under the seed field above the interactive ceiling. */
export function seedOnlySentence(): string {
  return `Above ${INTERACTIVE_MAX_N} zones, names come from the seed, style and join order. Zone sounds can't be edited at this size.`
}

/** The list region's text while a base's naming is still being built. */
export function pendingLine(base: number): string {
  return `Generating names for base ${base}...`
}

/** The line that replaces the rename button above the interactive ceiling. */
export function renamingUnavailable(): string {
  return `Renaming is available up to ${INTERACTIVE_MAX_N} zones.`
}

// ----- accessible names, tooltip -----

/** `Sound for zone {label}`, the field of a list row. */
export function zoneAria(label: string): string {
  return `Sound for zone ${label}`
}

/** `Lock sound for zone {label}`, the constant name of a lock button. */
export function lockAria(label: string): string {
  return `Lock sound for zone ${label}`
}

/** `Name for demon {a}::{b}`, the name field of the editor. */
export function nameFieldAria(a: string, b: string): string {
  return `Name for demon ${a}::${b}`
}

/**
 * The matrix tooltip and its keyboard live text: `A::B · Name · MESH · Subtype`. The name segment (and its separator) is left out
 * while there is no name; cutting a long name for the tooltip is the caller's job (NAME_TOOLTIP_GRAPHEMES).
 */
export function matrixTooltip(netSpan: string, name: string | null, mesh: number, subtype: string): string {
  const parts = name === null ? [netSpan, String(mesh), subtype] : [netSpan, name, String(mesh), subtype]
  return parts.join(` ${MIDDLE_DOT} `)
}

/** The accessible name of a zone node in sounds mode: the full sound, so the visible text is inside it. */
export function zoneSoundAria(digits: string, sound: string, region: string, selected: boolean): string {
  return `Zone ${digits}, sound ${sound}, ${region}${selected ? ', selected' : ''}`
}

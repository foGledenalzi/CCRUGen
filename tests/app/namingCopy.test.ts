// The single copy module of the Names feature (plan 07-11, 07-UI-SPEC Copywriting Contract, research Pitfall 14). Every visible string
// exists once, equals the contract, fills numbers from data (the engine limits, the interactive ceiling) and never carries an em dash or
// an exclamation mark. The expectations below are the UI-SPEC sentences written out; limits are interpolated from the engine constants
// the module imports, so the test also proves they are not typed into the prose.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as copy from '../../app/lib/namingCopy'
import { NAMES_COPY } from '../../app/lib/namingCopy'
import { CCRU_LINK_BASE } from '../../app/lib/namesLink'
import { ZONE_PAGE_STEP } from '../../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import {
  ISSUES_MAX,
  NAME_MAX_LENGTH,
  NAMING_IMPORT_MAX_BYTES,
  SEED_MAX_LENGTH,
  SOUND_MAX_LENGTH,
  UNKNOWN_KEYS_MAX,
  netSpanOf,
  type NamingIssue,
  type TextProblem,
} from '../../engine/index'

const EM_DASH = String.fromCodePoint(0x2014)
const MIDDLE_DOT = String.fromCodePoint(0xb7)
const COPY_SOURCE = readFileSync(fileURLToPath(new URL('../../app/lib/namingCopy.ts', import.meta.url)), 'utf8')

const ctx: copy.ImportCopyContext = {
  base: 28,
  zoneLabel: (z: number) => z.toString(36),
  netSpan: (mesh: number) => {
    const [a, b] = netSpanOf(mesh)
    return `${a.toString(36)}::${b.toString(36)}`
  },
}

// the UI-SPEC Copywriting Contract rows that are fixed strings, keyed by the NAMES_COPY key the later plans read
const EXPECTED_FIXED = {
  title: 'Names',
  tagPreview: 'unsaved preview',
  tagEdits: 'edits not in links',
  sourceEyebrow: 'Source:',
  seedEyebrow: 'Seed',
  styleEyebrow: 'Style:',
  joinEyebrow: 'Join order:',
  previewEyebrow: 'Preview',
  collisionsEyebrow: 'Collisions',
  sourceCcru: 'CCRU',
  sourceGenerated: 'Generated',
  sourceGroupAria: 'Naming source',
  styleGroupAria: 'Style',
  joinGroupAria: 'Join order',
  smoothingLabel: 'Smooth names',
  smoothingHelper: 'Adds vowels between consonant clusters. Off by default.',
  smoothingInert: 'Smoothing makes no difference to these sounds.',
  ccruHint: 'CCRU names exist for base 10 only.',
  previewHeaderAb: 'A::B',
  previewHeaderRaw: 'Raw',
  previewHeaderSmoothed: 'Smoothed',
  previewCaption: 'CCRU names are set by hand. This preview shows what the join and smoothing rules give.',
  shareNote: 'Links carry the preset or seed only. Choose Export names to share your edits.',
  shareTitle: 'Share current state',
  shareTitleUncarried:
    'Share current state. Links carry the preset or seed only. Choose Export names in the Names panel to share your edits.',
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
  noticeLabel: 'Unsaved preview',
  savedNone: 'Edits save in this browser, one slot per base.',
  savedFailed: "Couldn't save in this browser. Choose Export names to keep a copy.",
  savedPreview: 'Not saved. Choose Keep this naming to save it.',
  savedSeedOnly: 'Not saved in this browser at this size. The page link keeps the seed and style.',
  collisionsNone: 'None. Every demon name is unique.',
  collisionsChecking: 'Checking...',
  collisionsAnnounceNone: 'No repeated names.',
  previewJump: 'Keep this naming to rename demons.',
  zoneHeader: 'Zone',
  soundHeader: 'Sound',
  lockHeader: 'Lock',
  gotoPlaceholder: 'zone number',
  gotoAria: 'Go to zone',
  listHelperLock: 'Editing a sound locks it. Locked zones keep their sound when you reroll or change the seed.',
  listHelperPaste: 'Paste a list into a row to fill the rows below it.',
  lockTitle: 'Locked zones keep their sound when you reroll or change the seed.',
  editorLabel: 'Name',
  tagGenerated: 'generated',
  tagCcru: 'CCRU name',
  tagOverridden: 'overridden',
  rename: 'Rename demon',
  resetGenerated: 'Reset to generated name',
  resetCcru: 'Reset to CCRU name',
  saveName: 'Save name',
  cancelRename: 'Cancel rename',
  overriddenTitle: 'Overridden name',
  overriddenHidden: ', overridden',
  soundsRadio: 'Sounds',
  soundsNote: "Nodes show each zone's sound from the Names panel.",
  numeralsNote: 'This layout shows numerals.',
  labelsRowSounds: 'Sounds',
  labelsInfoSounds: 'Show or hide zone sounds on the diagram (numerals on the pair graph and planetary layouts).',
  shortcutLine:
    'Names panel: in the zone list, Up and Down move between rows, Page Up and Page Down jump 10 rows, Enter saves a sound, Escape reverts it. Editing a sound locks its zone.',
  kept: 'Kept this naming. Undo restores your previous names.',
  backToSaved: 'Back to your saved names.',
  restored: 'Names restored from history.',
  loadedCcru: 'Loaded the CCRU names for base 10.',
} as const

const EXPECTED_RECORDS = {
  styleLabels: { harsh: 'Harsh', soft: 'Soft', syllabic: 'Syllabic' },
  styleDescriptions: {
    harsh: 'Consonant clusters, like the CCRU names.',
    soft: 'Fewer clusters, more vowels.',
    syllabic: 'Short syllables you can read aloud.',
  },
  joinLabels: { 'hi-lo': 'High then low', 'lo-hi': 'Low then high' },
  joinDescriptions: {
    'hi-lo': "The higher zone's sound comes first.",
    'lo-hi': "The lower zone's sound comes first.",
  },
} as const

const BUTTON_KEYS = [
  'reroll',
  'showCollisions',
  'hideCollisions',
  'showMoreNames',
  'exportNames',
  'importNames',
  'useSeed',
  'undoChange',
  'keep',
  'revert',
  'rename',
  'resetGenerated',
  'resetCcru',
  'saveName',
  'cancelRename',
] as const

const REASONS: readonly TextProblem[] = ['empty', 'space', 'digit', 'other', 'long']

const bad = (zone: number, reason: TextProblem): NamingIssue => ({ kind: 'bad-sound', zone, reason })

/** One call of every string-returning function, so the voice rules cover everything the module can say. */
function sampleOutputs(): string[] {
  const out: string[] = []
  for (const r of REASONS) {
    out.push(copy.soundReason(r), copy.nameReason(r), copy.zoneIssue('c', r), copy.demonIssue('9::8', r))
    out.push(copy.pasteRefused('c', r))
  }
  out.push(
    copy.pastedPartial(8, 5, 'c', 3),
    copy.plural(1, 'locked zone', 'locked zones'),
    copy.plural(3, 'locked zone', 'locked zones'),
    copy.seedError(),
    copy.summaryLine(1, 0),
    copy.summaryLine(3, 1),
    copy.collisionsSome(1, 2),
    copy.collisionsSome(2, 5),
    copy.collisionsAnnounceSome(1),
    copy.collisionsAnnounceSome(3),
    copy.collisionsNotChecked(1024),
    copy.showingNames(20, 41),
    copy.moreJumps(3),
    copy.jumpAriaLabel('9', '8', 'Zed'),
    copy.renamed('9', '8', 'Zed'),
    copy.backTo('9', '8', 'Zed'),
    copy.exportSuccess(28),
    copy.exportSeedOnly(INTERACTIVE_MAX_N + 2),
    copy.importSuccess(28, 28, 1),
    copy.importSeedOnly(INTERACTIVE_MAX_N + 2),
    copy.unknownKeysSuffix(['a', 'b'], 2),
    copy.unknownKeysSuffix(['a', 'b', 'c', 'd', 'e'], 7),
    copy.formatBytes(NAMING_IMPORT_MAX_BYTES),
    copy.pasted(5, 'c'),
    copy.noZone('zz', 28),
    copy.generated(28, 'ccrug'),
    copy.rerolled(25, 3),
    copy.regenerated(25, 'soft', 3),
    copy.joinStatus('hi-lo'),
    copy.joinStatus('lo-hi'),
    copy.smoothingStatus(true),
    copy.smoothingStatus(false),
    copy.noticeBody(28),
    copy.savedLine(28),
    copy.seedOnlySentence(),
    copy.pendingLine(28),
    copy.renamingUnavailable(),
    copy.zoneAria('c'),
    copy.lockAria('c'),
    copy.nameFieldAria('9', '8'),
    copy.matrixTooltip('c::3', 'Zed', 69, 'Cyclic chrono'),
    copy.matrixTooltip('c::3', null, 69, 'Cyclic chrono'),
    copy.zoneSoundAria('c', 'gl', 'Torque', false),
    copy.zoneSoundAria('c', 'gl', 'Torque', true),
  )
  const failures: copy.ImportFailure[] = [
    { kind: 'not-json' },
    { kind: 'not-names-file' },
    { kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES },
    { kind: 'unknown-version', version: '2' },
    { kind: 'wrong-base', fileBase: 30 },
    { kind: 'seed-only-base' },
    { kind: 'unreadable' },
    bad(12, 'digit'),
    { kind: 'bad-override-name', mesh: 69, reason: 'space' },
    { kind: 'bad-override-key', key: 'abc' },
    { kind: 'bad-field', path: 'generator.seed' },
  ]
  for (const f of failures) out.push(copy.importError(f, ctx))
  out.push(copy.invalidEntries([bad(12, 'digit'), bad(13, 'empty')], 2, ctx))
  out.push(copy.invalidEntries(failures.slice(7) as NamingIssue[], 4, ctx))
  return out
}

function flatStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(flatStrings)
  return []
}

describe('NAMES_COPY: the fixed strings of the Copywriting Contract', () => {
  it('has exactly the keys the later plans read, no more and no fewer', () => {
    const expectedKeys = [...Object.keys(EXPECTED_FIXED), ...Object.keys(EXPECTED_RECORDS)].sort()
    expect(Object.keys(NAMES_COPY).sort()).toEqual(expectedKeys)
    expect(expectedKeys).toHaveLength(77)
  })

  it.each(Object.entries(EXPECTED_FIXED))('%s equals the UI-SPEC string', (key, text) => {
    expect((NAMES_COPY as Record<string, unknown>)[key]).toBe(text)
  })

  it.each(Object.entries(EXPECTED_RECORDS))('%s equals the UI-SPEC record', (key, record) => {
    expect((NAMES_COPY as Record<string, unknown>)[key]).toEqual(record)
  })

  it('is frozen, including its records', () => {
    expect(Object.isFrozen(NAMES_COPY)).toBe(true)
    for (const key of Object.keys(EXPECTED_RECORDS)) {
      expect(Object.isFrozen((NAMES_COPY as Record<string, unknown>)[key]), key).toBe(true)
    }
  })

  it('takes the base of the CCRU hint and status from the link codec, and the page step of the shortcut line from the limits', () => {
    expect(CCRU_LINK_BASE).toBe(10)
    expect(ZONE_PAGE_STEP).toBe(10)
    expect(NAMES_COPY.ccruHint).toContain(`base ${CCRU_LINK_BASE} only`)
    expect(NAMES_COPY.loadedCcru).toContain(`base ${CCRU_LINK_BASE}.`)
    expect(NAMES_COPY.shortcutLine).toContain(`jump ${ZONE_PAGE_STEP} rows`)
  })
})

describe('voice rules (UI-SPEC: short, factual, no em dash, no exclamation, specific buttons)', () => {
  const strings = [...flatStrings(NAMES_COPY), ...sampleOutputs()]

  it('covers every string of the module (a sanity floor on the sample)', () => {
    expect(strings.length).toBeGreaterThan(140)
  })

  it('no string holds an em dash or an exclamation mark', () => {
    for (const s of strings) {
      expect(s.includes(EM_DASH), s).toBe(false)
      expect(s.includes('!'), s).toBe(false)
    }
  })

  it('no string holds an invisible format character or a typographic apostrophe', () => {
    for (const s of strings) {
      expect(/\p{Cf}/u.test(s), s).toBe(false)
      expect(s.includes(String.fromCodePoint(0x2019)), s).toBe(false)
    }
  })

  it('no sentence has a doubled space or a stray edge space (only the unknown-keys suffix starts with one)', () => {
    for (const s of strings) {
      expect(s.includes('  '), s).toBe(false)
      if (!s.startsWith(' Ignored unknown keys')) expect(s, s).toBe(s.trim())
    }
  })

  it('every button label has at least two words', () => {
    for (const key of BUTTON_KEYS) {
      const label = NAMES_COPY[key]
      expect(label.trim().split(/\s+/).length, key).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('text reasons', () => {
  it('sound reasons, with the length limit read from the engine', () => {
    expect(copy.soundReason('empty')).toBe('A sound needs at least 1 letter.')
    expect(copy.soundReason('space')).toBe("Sounds can't contain spaces.")
    expect(copy.soundReason('digit')).toBe("Sounds can't contain digits.")
    expect(copy.soundReason('other')).toBe('Sounds can only contain letters.')
    expect(copy.soundReason('long')).toBe(`A sound can be at most ${SOUND_MAX_LENGTH} characters.`)
    expect(SOUND_MAX_LENGTH).toBe(16)
  })

  it('name reasons, with the length limit read from the engine', () => {
    expect(copy.nameReason('empty')).toBe('A name needs at least 1 letter.')
    expect(copy.nameReason('space')).toBe("Names can't contain spaces.")
    expect(copy.nameReason('digit')).toBe("Names can't contain digits.")
    expect(copy.nameReason('other')).toBe('Names can only contain letters.')
    expect(copy.nameReason('long')).toBe(`A name can be at most ${NAME_MAX_LENGTH} characters.`)
    expect(NAME_MAX_LENGTH).toBe(32)
  })

  it('the seed error reads the seed limit from the engine', () => {
    expect(copy.seedError()).toBe(`A seed needs 1 to ${SEED_MAX_LENGTH} characters.`)
    expect(SEED_MAX_LENGTH).toBe(64)
  })

  it('zoneIssue and demonIssue prefix the reason with the row', () => {
    expect(copy.zoneIssue('c', 'digit')).toBe("Zone c: Sounds can't contain digits.")
    expect(copy.demonIssue('9::8', 'space')).toBe("9::8: Names can't contain spaces.")
  })
})

describe('counts and plurals', () => {
  it('plural puts the count before the right word', () => {
    expect(copy.plural(1, 'locked zone', 'locked zones')).toBe('1 locked zone')
    expect(copy.plural(0, 'locked zone', 'locked zones')).toBe('0 locked zones')
    expect(copy.plural(2, 'locked zone', 'locked zones')).toBe('2 locked zones')
  })

  it('summaryLine', () => {
    expect(copy.summaryLine(1, 0)).toBe('1 locked zone, 0 renamed demons.')
    expect(copy.summaryLine(3, 1)).toBe('3 locked zones, 1 renamed demon.')
    expect(copy.summaryLine(0, 0)).toBe('0 locked zones, 0 renamed demons.')
  })

  it('collision lines', () => {
    expect(copy.collisionsSome(1, 2)).toBe('1 repeated name across 2 demons.')
    expect(copy.collisionsSome(2, 5)).toBe('2 repeated names across 5 demons.')
    expect(copy.collisionsAnnounceSome(1)).toBe('1 repeated name.')
    expect(copy.collisionsAnnounceSome(3)).toBe('3 repeated names.')
    expect(copy.collisionsNotChecked(1024)).toBe('Not checked above 1024 zones.')
    expect(copy.showingNames(20, 41)).toBe('Showing 20 of 41 names.')
    expect(copy.moreJumps(3)).toBe('+3 more')
  })

  it('jump label, rename status and revert status', () => {
    expect(copy.jumpAriaLabel('9', '8', 'Zed')).toBe('Rename demon 9::8, currently Zed')
    expect(copy.renamed('9', '8', 'Zed')).toBe('Renamed 9::8 to Zed.')
    expect(copy.backTo('9', '8', 'Zed')).toBe('9::8 is back to Zed.')
  })
})

describe('formatBytes', () => {
  it('prints whole MB when exact and one decimal otherwise', () => {
    expect(copy.formatBytes(8388608)).toBe('8 MB')
    expect(copy.formatBytes(NAMING_IMPORT_MAX_BYTES)).toBe('8 MB')
    expect(copy.formatBytes(1048576)).toBe('1 MB')
    expect(copy.formatBytes(1572864)).toBe('1.5 MB')
    expect(copy.formatBytes(2621440)).toBe('2.5 MB')
  })

  it('stays readable below a megabyte', () => {
    expect(copy.formatBytes(524288)).toBe('512 KB')
    expect(copy.formatBytes(1536)).toBe('1.5 KB')
    expect(copy.formatBytes(1024)).toBe('1 KB')
    expect(copy.formatBytes(1)).toBe('1 byte')
    expect(copy.formatBytes(500)).toBe('500 bytes')
  })
})

describe('import errors', () => {
  it('not JSON', () => {
    expect(copy.importError({ kind: 'not-json' })).toBe(
      "This file isn't valid JSON. Nothing was imported. Choose a file exported from the Names panel.",
    )
  })

  it('too large prints the cap through formatBytes', () => {
    expect(copy.importError({ kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES })).toBe(
      'This file is larger than 8 MB. Nothing was imported. Choose a smaller file exported from the Names panel.',
    )
    expect(copy.importError({ kind: 'too-large', maxBytes: 2097152 })).toContain('larger than 2 MB.')
  })

  it('wrong base names both bases', () => {
    expect(copy.importError({ kind: 'wrong-base', fileBase: 30 }, ctx)).toBe(
      'This file is for base 30, and you are on base 28. Nothing was imported. Switch to base 30 to import it.',
    )
  })

  it('unknown format version names the version', () => {
    expect(copy.importError({ kind: 'unknown-version', version: '2' })).toBe(
      "This file uses names format 2, which this version can't read. Nothing was imported. Export the names again from this version.",
    )
  })

  it('an echoed version is clipped', () => {
    const text = copy.importError({ kind: 'unknown-version', version: 'v'.repeat(100) })
    expect(text).toContain(`names format ${'v'.repeat(40)}...,`)
    expect(text).not.toContain('v'.repeat(41))
  })

  it('not a names file', () => {
    expect(copy.importError({ kind: 'not-names-file' })).toBe(
      "This file isn't a names file for this app. Nothing was imported. Choose a file exported from the Names panel.",
    )
  })

  it('seed-only base reads the interactive ceiling from the tier table', () => {
    const above = INTERACTIVE_MAX_N + 2
    expect(copy.importError({ kind: 'seed-only-base' }, { ...ctx, base: above })).toBe(
      `Base ${above} is above ${INTERACTIVE_MAX_N} zones, so only a seed and style can be imported. Nothing was imported. Choose a seed-only file, or switch to a base up to ${INTERACTIVE_MAX_N}.`,
    )
  })

  it('unreadable', () => {
    expect(copy.importError({ kind: 'unreadable' })).toBe("Couldn't read this file. Nothing was imported. Choose the file again.")
  })

  it('an entry issue given alone reads as a one-entry list', () => {
    expect(copy.importError(bad(12, 'digit'), ctx)).toBe(
      "Nothing was imported. Zone c: Sounds can't contain digits. Fix these zones in the file and import it again.",
    )
    expect(copy.importError(bad(12, 'digit'), ctx)).toBe(copy.invalidEntries([bad(12, 'digit')], 1, ctx))
  })

  it('a kind that needs the base and zone labels refuses to answer without them', () => {
    const wrong = copy.importError as unknown as (issue: copy.ImportFailure, c?: copy.ImportCopyContext) => string
    expect(() => wrong({ kind: 'wrong-base', fileBase: 30 })).toThrow(TypeError)
    expect(() => wrong(bad(12, 'digit'))).toThrow(TypeError)
    expect(() => wrong({ kind: 'seed-only-base' })).toThrow(TypeError)
  })
})

describe('invalid entries', () => {
  it('lists zone issues, then the zone closing sentence', () => {
    expect(copy.invalidEntries([bad(12, 'digit'), bad(13, 'empty')], 2, ctx)).toBe(
      "Nothing was imported. Zone c: Sounds can't contain digits. Zone d: A sound needs at least 1 letter. Fix these zones in the file and import it again.",
    )
  })

  it('keeps at most ISSUES_MAX lines, then says how many more, before the closing sentence', () => {
    expect(ISSUES_MAX).toBe(5)
    const issues = [0, 1, 2, 3, 4, 5, 6].map(z => bad(z, 'digit'))
    expect(copy.invalidEntries(issues, 7, ctx)).toBe(
      "Nothing was imported. Zone 0: Sounds can't contain digits. Zone 1: Sounds can't contain digits. Zone 2: Sounds can't contain digits. Zone 3: Sounds can't contain digits. Zone 4: Sounds can't contain digits. And 2 more. Fix these zones in the file and import it again.",
    )
  })

  it('counts more from the exact total when the validator kept only five', () => {
    const issues = [0, 1, 2, 3, 4].map(z => bad(z, 'space'))
    const text = copy.invalidEntries(issues, 12, ctx)
    expect(text).toContain(' And 7 more. Fix these zones')
    expect(copy.invalidEntries(issues, 5, ctx)).not.toContain('more')
  })

  it('override names, bad keys and other fields read as entries, closing with the entries sentence', () => {
    const issues: NamingIssue[] = [
      bad(12, 'digit'),
      { kind: 'bad-override-name', mesh: 69, reason: 'space' },
      { kind: 'bad-override-key', key: 'abc' },
      { kind: 'bad-field', path: 'generator.seed' },
    ]
    expect(copy.invalidEntries(issues, 4, ctx)).toBe(
      "Nothing was imported. Zone c: Sounds can't contain digits. c::3: Names can't contain spaces. Override key \"abc\" is not a demon of base 28. Field generator.seed is not valid. Fix these entries in the file and import it again.",
    )
  })

  it('a seed-only refusal beside other field issues reads as one line of the list', () => {
    const issues: NamingIssue[] = [{ kind: 'bad-field', path: 'join.order' }, { kind: 'seed-only-base' }]
    const text = copy.invalidEntries(issues, 2, { ...ctx, base: INTERACTIVE_MAX_N + 2 })
    expect(text).toContain(`Base ${INTERACTIVE_MAX_N + 2} is above ${INTERACTIVE_MAX_N} zones, so only a seed and style can be imported.`)
    expect(text.endsWith('Fix these entries in the file and import it again.')).toBe(true)
  })

  it('echoed keys and paths are clipped to 40 characters', () => {
    const key = copy.invalidEntries([{ kind: 'bad-override-key', key: 'k'.repeat(100) }], 1, ctx)
    expect(key).toContain(`"${'k'.repeat(40)}..."`)
    expect(key).not.toContain('k'.repeat(41))
    const path = copy.invalidEntries([{ kind: 'bad-field', path: 'p'.repeat(100) }], 1, ctx)
    expect(path).toContain(`Field ${'p'.repeat(40)}... is not valid.`)
  })
})

describe('import and export results', () => {
  it('import success counts sounds and renamed demons', () => {
    expect(copy.importSuccess(28, 28, 1)).toBe('Imported names for base 28: 28 sounds, 1 renamed demon.')
    expect(copy.importSuccess(10, 10, 0)).toBe('Imported names for base 10: 10 sounds, 0 renamed demons.')
    expect(copy.importSeedOnly(INTERACTIVE_MAX_N + 2)).toBe(`Imported the seed and style for base ${INTERACTIVE_MAX_N + 2}.`)
  })

  it('unknown keys: listed up to UNKNOWN_KEYS_MAX, then and k more, none when there are none', () => {
    expect(UNKNOWN_KEYS_MAX).toBe(5)
    expect(copy.unknownKeysSuffix(['a', 'b'], 2)).toBe(' Ignored unknown keys: a, b.')
    expect(copy.unknownKeysSuffix(['a', 'b', 'c', 'd', 'e'], 7)).toBe(' Ignored unknown keys: a, b, c, d, e and 2 more.')
    expect(copy.unknownKeysSuffix(['a', 'b', 'c', 'd', 'e'], 5)).toBe(' Ignored unknown keys: a, b, c, d, e.')
    expect(copy.unknownKeysSuffix([], 0)).toBe('')
  })

  it('unknown keys are echoed through clipEcho (40 characters)', () => {
    const text = copy.unknownKeysSuffix(['x'.repeat(100)], 1)
    expect(text).toBe(` Ignored unknown keys: ${'x'.repeat(40)}....`)
    expect(text).not.toContain('x'.repeat(41))
  })

  it('export success, and the seed-only export reads the ceiling from the tier table', () => {
    expect(copy.exportSuccess(28)).toBe('Exported names for base 28.')
    expect(copy.exportSeedOnly(4002)).toBe(`Exported the seed and style for base 4002. Zone sounds are not included above ${INTERACTIVE_MAX_N} zones.`)
  })
})

describe('paste and go-to messages', () => {
  it('paste results', () => {
    expect(copy.pasted(5, 'c')).toBe('Pasted 5 sounds from zone c.')
    expect(copy.pastedPartial(8, 5, 'c', 3)).toBe('Pasted 8 sounds. 5 fit from zone c and 3 were not used.')
    expect(copy.pastedPartial(6, 5, 'c', 1)).toBe('Pasted 6 sounds. 5 fit from zone c and 1 was not used.')
    expect(copy.pasteRefused('c', 'digit')).toBe("Paste not applied. Zone c: Sounds can't contain digits.")
  })

  it('no zone echoes the typed text clipped to 40 characters', () => {
    expect(copy.noZone('zz', 28)).toBe('No zone "zz" at base 28.')
    const text = copy.noZone('z'.repeat(100), 28)
    expect(text).toBe(`No zone "${'z'.repeat(40)}..." at base 28.`)
  })
})

describe('status lines', () => {
  it('generation statuses', () => {
    expect(copy.generated(28, 'ccrug')).toBe('Generated names for base 28 from seed ccrug.')
    expect(copy.rerolled(25, 3)).toBe('Rerolled 25 unlocked zones. 3 locked zones kept.')
    expect(copy.rerolled(1, 0)).toBe('Rerolled 1 unlocked zone. 0 locked zones kept.')
    expect(copy.regenerated(25, 'soft', 3)).toBe('Regenerated 25 unlocked zones with the soft style. 3 locked zones kept.')
    expect(copy.regenerated(1, 'harsh', 1)).toBe('Regenerated 1 unlocked zone with the harsh style. 1 locked zone kept.')
  })

  it('a long seed in the status is clipped like every echo', () => {
    expect(copy.generated(28, 's'.repeat(64))).toBe(`Generated names for base 28 from seed ${'s'.repeat(40)}....`)
  })

  it('join and smoothing statuses', () => {
    expect(copy.joinStatus('hi-lo')).toBe('Join order: high then low.')
    expect(copy.joinStatus('lo-hi')).toBe('Join order: low then high.')
    expect(copy.smoothingStatus(true)).toBe('Smoothing on.')
    expect(copy.smoothingStatus(false)).toBe('Smoothing off.')
  })

  it('preview notice, autosave, seed-only, pending and unavailable lines', () => {
    expect(copy.noticeBody(28)).toBe("This link's names are shown for base 28. Your saved names are kept until you choose.")
    expect(copy.savedLine(28)).toBe('Saved in this browser for base 28.')
    expect(copy.seedOnlySentence()).toBe(
      `Above ${INTERACTIVE_MAX_N} zones, names come from the seed, style and join order. Zone sounds can't be edited at this size.`,
    )
    expect(copy.pendingLine(28)).toBe('Generating names for base 28...')
    expect(copy.renamingUnavailable()).toBe(`Renaming is available up to ${INTERACTIVE_MAX_N} zones.`)
  })
})

describe('accessible names and tooltips', () => {
  it('row, lock and name field labels', () => {
    expect(copy.zoneAria('c')).toBe('Sound for zone c')
    expect(copy.lockAria('c')).toBe('Lock sound for zone c')
    expect(copy.nameFieldAria('9', '8')).toBe('Name for demon 9::8')
  })

  it('matrix tooltip uses the middle dot and omits the name segment when there is no name', () => {
    expect(copy.matrixTooltip('c::3', 'Zed', 69, 'Cyclic chrono')).toBe(
      ['c::3', 'Zed', '69', 'Cyclic chrono'].join(` ${MIDDLE_DOT} `),
    )
    expect(copy.matrixTooltip('c::3', null, 69, 'Cyclic chrono')).toBe(['c::3', '69', 'Cyclic chrono'].join(` ${MIDDLE_DOT} `))
    expect(copy.matrixTooltip('c::3', null, 69, 'Cyclic chrono')).toBe('c::3 · 69 · Cyclic chrono')
  })

  it('sounds-mode accessible name carries the full sound, with the selected suffix only when selected', () => {
    expect(copy.zoneSoundAria('c', 'gl', 'Torque', false)).toBe('Zone c, sound gl, Torque')
    expect(copy.zoneSoundAria('c', 'gl', 'Torque', true)).toBe('Zone c, sound gl, Torque, selected')
    const long = 'a'.repeat(16)
    expect(copy.zoneSoundAria('12', long, 'Warp', false)).toBe(`Zone 12, sound ${long}, Warp`)
  })
})

describe('the module source', () => {
  it('types no limit as prose: the engine limits and the ceiling are imported', () => {
    expect(COPY_SOURCE).not.toMatch(/\b(4000|16 characters|32 characters|64 characters)\b/)
    for (const name of ['INTERACTIVE_MAX_N', 'SOUND_MAX_LENGTH', 'NAME_MAX_LENGTH', 'SEED_MAX_LENGTH']) {
      expect(COPY_SOURCE, name).toContain(name)
    }
  })

  it('types no base and no page step as prose either: the CCRU base and the page step come from their constants', () => {
    expect(COPY_SOURCE).not.toMatch(/\bbase 10\b/)
    expect(COPY_SOURCE).not.toMatch(/\bjump 10 rows\b/)
    expect(COPY_SOURCE).toContain('CCRU_LINK_BASE')
    expect(COPY_SOURCE).toContain('ZONE_PAGE_STEP')
  })

  it('holds no em dash and no invisible format character', () => {
    expect(COPY_SOURCE.includes(EM_DASH)).toBe(false)
    expect(/\p{Cf}/u.test(COPY_SOURCE)).toBe(false)
  })

  it('declares NAMES_COPY once, with each key written as a property', () => {
    expect(COPY_SOURCE.split('export const NAMES_COPY')).toHaveLength(2)
    for (const key of [
      'shareTitleUncarried',
      'overriddenTitle',
      'overriddenHidden',
      'shortcutLine',
      'numeralsNote',
      'soundsNote',
      'labelsRowSounds',
      'labelsInfoSounds',
      'restored',
      'smoothingInert',
    ]) {
      expect(COPY_SOURCE.split(`${key}:`).length, key).toBeGreaterThanOrEqual(2)
    }
  })

  it('echoes user text through clipEcho from the engine core', () => {
    expect(COPY_SOURCE).toContain("from '../../engine/core/base'")
    expect(COPY_SOURCE).toContain('clipEcho')
  })
})

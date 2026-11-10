// The demon name editor (plan 07-16, D-02, NAM-02, T-07-03e, T-07-17b, T-07-10c; 07-UI-SPEC "The demon name editor"): one component
// that reads the NamingContext, shows the source tag and the Rename and Reset buttons, edits the name in a validated field, is
// disabled in preview (and while a base is building), and is not offered above the interactive ceiling. A server render reaches the
// markup of every mode (autoEdit starts in edit mode); the handlers a render cannot reach are pulled into pure helpers (commitName,
// editKeyAction, editorAvailability, activeEdit, resetLabelOf) and tested directly. Names here come from the engine's own naming and
// the preset by reference: no canonical name or CCRU sound is typed. No JSX (plain node test file).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  NAME_MAX_LENGTH,
  createNameResolver,
  createNaming,
  createNumogram,
  setOverride,
  toNfc,
  type Naming,
  type NamingPreset,
} from '../../engine/index'
import {
  DemonNameEditor,
  DemonNameEditorView,
  activeEdit,
  commitName,
  editKeyAction,
  editorAvailability,
  resetLabelOf,
  type DemonNameEditorProps,
  type DemonNameEditorViewProps,
} from '../../app/components/names/DemonNameEditor'
import { NamingContext, type NamingContextValue } from '../../app/components/names/NamingContext'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { NAMES_COPY, demonIssue, nameFieldAria, nameReason, renamingUnavailable } from '../../app/lib/namingCopy'
import type { NamesPanelState } from '../../app/lib/namingSession'
import { buildNumogramView, summarize, type NumogramView } from '../../app/lib/numogramView'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'

const EDITOR_SOURCE = fileURLToPath(new URL('../../app/components/names/DemonNameEditor.tsx', import.meta.url))
const noop = () => {}
const CCRU_BASE = CCRU_NAMING_PRESET.base
// a text no rule or preset gives for any demon: it only has to be valid letters
const CUSTOM = 'zzyxq'

// ── fixtures ────────────────────────────────────────────────────────────────

function viewCtx(base: number, view: NumogramView | null = null): NumogramViewContextValue {
  const g = createNumogram(base)
  return {
    base,
    g,
    summary: summarize(g),
    view,
    zoneLabels: null,
    labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: 'off',
    tier: view ? 'svg' : 'headless',
    interactiveMaxN: INTERACTIVE_MAX_N,
  }
}

function namingValue(naming: Naming, preset: NamingPreset | null, over: Partial<NamingContextValue> = {}): NamingContextValue {
  return {
    base: naming.base,
    naming,
    rev: 1,
    resolver: createNameResolver(naming, preset),
    preset,
    state: 'ready',
    pendingBase: null,
    saved: 'none',
    uncarried: false,
    interactiveMaxN: INTERACTIVE_MAX_N,
    announcement: '',
    restored: { tick: 0, zone: null },
    apply: () => false,
    keep: noop,
    revert: noop,
    undo: noop,
    announce: noop,
    ...over,
  }
}

const generated = (base: number): Naming => createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N })
const ccru10 = (): Naming => createNaming({ base: CCRU_BASE, interactiveMaxN: INTERACTIVE_MAX_N, source: 'ccru', preset: CCRU_NAMING_PRESET })

type EditorProps = Omit<DemonNameEditorProps, 'a' | 'b'> & { readonly a?: number; readonly b?: number }

/** The editor on demon 12::3 (mesh 69) unless said otherwise, inside a naming value and, optionally, the view context. */
function renderEditor(naming: NamingContextValue | null, props: EditorProps = { context: 'selection' }, view: NumogramViewContextValue | null = null): string {
  const el = createElement(DemonNameEditor, { a: 12, b: 3, ...props })
  const inner = naming === null ? el : createElement(NamingContext.Provider, { value: naming }, el)
  return view === null ? renderToStaticMarkup(inner) : renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: view }, inner))
}

const g28Naming = generated(28)
const resolver28 = createNameResolver(g28Naming, null)
const NAME_12_3 = resolver28.nameOf(12, 3)
const view28 = viewCtx(28)

/** Every opening `<tag ...>` of a markup, in order. */
const openTags = (markup: string, tag: string): string[] => Array.from(markup.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g')), m => m[0])

/** The opening tag of the first element that carries the marker attribute. */
function tagWith(markup: string, marker: string): string {
  const found = Array.from(markup.matchAll(/<[a-z][^>]*>/g), m => m[0]).find(t => t.includes(` ${marker}=""`) || t.includes(` ${marker}=`))
  return found ?? ''
}

/** The text inside the first button that carries the marker attribute, or null when there is none. */
function buttonText(markup: string, marker: string): string | null {
  const m = new RegExp(`<button[^>]*\\s${marker}=""[^>]*>(.*?)</button>`).exec(markup)
  return m === null ? null : (m[1] as string)
}

const textOf = (html: string): string => html.replace(/<[^>]*>/g, '')

function overridden28(): NamingContextValue {
  const naming = setOverride(g28Naming, 69, CUSTOM, null)
  expect(naming.overrides.get(69)).toBe(CUSTOM)
  return namingValue(naming, null)
}

// ── provider-less and base guard ────────────────────────────────────────────

describe('DemonNameEditor: without a naming', () => {
  it('renders nothing outside a NamingContext provider, with or without a view context', () => {
    expect(renderEditor(null)).toBe('')
    expect(renderEditor(null, { context: 'overlay', autoEdit: true }, view28)).toBe('')
  })

  it('renders nothing when the naming is for another base than the displayed one (a switch in flight)', () => {
    expect(renderEditor(namingValue(generated(30), null), { context: 'selection' }, view28)).toBe('')
  })
})

// ── read mode ───────────────────────────────────────────────────────────────

describe('DemonNameEditor: read mode', () => {
  const markup = renderEditor(namingValue(g28Naming, null), { context: 'selection' }, view28)

  it('root carries the data hooks, the post-baseline mark, the context and the name state', () => {
    const root = tagWith(markup, 'data-demon-name-editor')
    expect(root.startsWith('<div ')).toBe(true)
    expect(root).toContain('data-post-baseline=""')
    expect(root).toContain('data-demon-name-context="selection"')
    expect(root).toContain('data-demon-name-state="generated"')
    expect(root).toContain('class="space-y-1 pt-1"')
    expect(root).not.toContain('aria-disabled')
  })

  it('shows the Name label, the generated tag and only the Rename button', () => {
    expect(markup).toContain(`>${NAMES_COPY.editorLabel}<`)
    expect(markup).toContain(`>${NAMES_COPY.tagGenerated}<`)
    expect(NAMES_COPY.editorLabel).toBe('Name')
    expect(NAMES_COPY.tagGenerated).toBe('generated')
    expect(buttonText(markup, 'data-demon-rename')).toBe('Rename demon')
    expect(markup).not.toContain('data-demon-name-reset')
    expect(markup).not.toContain('<input')
    expect(markup).not.toContain('data-demon-name-save')
  })

  it('the Rename button is a small 24px target and is enabled', () => {
    const rename = tagWith(markup, 'data-demon-rename')
    expect(rename).toContain('min-h-[24px]')
    expect(rename).toContain('type="button"')
    expect(rename).not.toContain('disabled')
  })

  it('the context hook follows the prop: overlay and collision', () => {
    expect(tagWith(renderEditor(namingValue(g28Naming, null), { context: 'overlay' }, view28), 'data-demon-name-context')).toContain('data-demon-name-context="overlay"')
    expect(tagWith(renderEditor(namingValue(g28Naming, null), { context: 'collision' }, view28), 'data-demon-name-context')).toContain('data-demon-name-context="collision"')
  })

  it('renders without a view context too (labels fall back to the default scheme) and either argument order gives the same demon', () => {
    const noView = renderEditor(namingValue(g28Naming, null), { context: 'selection', autoEdit: true })
    expect(noView).toContain(`aria-label="${nameFieldAria('c', '3')}"`)
    const swapped = renderEditor(namingValue(g28Naming, null), { context: 'selection', autoEdit: true, a: 3, b: 12 }, view28)
    expect(swapped).toContain(`aria-label="${nameFieldAria('c', '3')}"`)
  })
})

// ── source tag and reset ────────────────────────────────────────────────────

describe('DemonNameEditor: the three name states', () => {
  it('an overridden demon: tag overridden, state attribute, and Reset to generated name', () => {
    const markup = renderEditor(overridden28(), { context: 'selection' }, view28)
    expect(tagWith(markup, 'data-demon-name-editor')).toContain('data-demon-name-state="overridden"')
    expect(markup).toContain(`>${NAMES_COPY.tagOverridden}<`)
    expect(markup).not.toContain(`>${NAMES_COPY.tagGenerated}<`)
    expect(buttonText(markup, 'data-demon-name-reset')).toBe('Reset to generated name')
    expect(buttonText(markup, 'data-demon-rename')).toBe('Rename demon')
    expect(tagWith(markup, 'data-demon-name-reset')).toContain('min-h-[24px]')
  })

  it('an override at base 10 under the CCRU naming resets to the CCRU name (mesh 44 is 9::8)', () => {
    const naming = setOverride(ccru10(), 44, CUSTOM, CCRU_NAMING_PRESET)
    expect(naming.overrides.get(44)).toBe(CUSTOM)
    const markup = renderEditor(namingValue(naming, CCRU_NAMING_PRESET), { context: 'selection', a: 9, b: 8 }, viewCtx(CCRU_BASE))
    expect(markup).toContain(`>${NAMES_COPY.tagOverridden}<`)
    expect(buttonText(markup, 'data-demon-name-reset')).toBe('Reset to CCRU name')
  })

  it('an unmodified CCRU demon: tag CCRU name, state preset, no reset', () => {
    const markup = renderEditor(namingValue(ccru10(), CCRU_NAMING_PRESET), { context: 'selection', a: 9, b: 8 }, viewCtx(CCRU_BASE))
    expect(tagWith(markup, 'data-demon-name-editor')).toContain('data-demon-name-state="preset"')
    expect(markup).toContain(`>${NAMES_COPY.tagCcru}<`)
    expect(NAMES_COPY.tagCcru).toBe('CCRU name')
    expect(markup).not.toContain('data-demon-name-reset')
  })

  it('an override at base 10 under a generated naming resets to the generated name (no preset applies)', () => {
    const naming = setOverride(createNaming({ base: CCRU_BASE, interactiveMaxN: INTERACTIVE_MAX_N }), 44, CUSTOM, null)
    const markup = renderEditor(namingValue(naming, CCRU_NAMING_PRESET), { context: 'selection', a: 9, b: 8 }, viewCtx(CCRU_BASE))
    expect(buttonText(markup, 'data-demon-name-reset')).toBe('Reset to generated name')
  })

  it('resetLabelOf: nothing unless overridden, the CCRU label only when a preset name exists', () => {
    expect(resetLabelOf('generated', null)).toBeNull()
    expect(resetLabelOf('preset', 'x')).toBeNull()
    expect(resetLabelOf('overridden', null)).toBe(NAMES_COPY.resetGenerated)
    expect(resetLabelOf('overridden', 'x')).toBe(NAMES_COPY.resetCcru)
  })
})

// ── edit mode ───────────────────────────────────────────────────────────────

describe('DemonNameEditor: edit mode (autoEdit)', () => {
  const markup = renderEditor(namingValue(g28Naming, null), { context: 'overlay', autoEdit: true }, view28)
  const input = tagWith(markup, 'data-demon-name-input')

  it('the field is prefilled with the current name and labelled with the net-span', () => {
    expect(input.startsWith('<input ')).toBe(true)
    expect(input).toContain(`value="${NAME_12_3}"`)
    expect(input).toContain('aria-label="Name for demon c::3"')
    expect(nameFieldAria('c', '3')).toBe('Name for demon c::3')
  })

  it('the field takes any script and never autocorrects', () => {
    expect(input).toContain('dir="auto"')
    expect(input).toContain('autoCapitalize="none"')
    expect(input).toContain('autoCorrect="off"')
    expect(input).toContain('spellcheck="false"')
    expect(input).toContain('autoComplete="off"')
    expect(input).toContain('class="ui-terminal-input w-full px-0 py-1 text-sm text-gray-100"')
  })

  it('the field is bounded so an absurd paste is cut before validation', () => {
    const max = /maxLength="(\d+)"/.exec(input)
    expect(max).not.toBeNull()
    expect(Number((max as RegExpExecArray)[1])).toBeGreaterThanOrEqual(NAME_MAX_LENGTH)
    expect(Number((max as RegExpExecArray)[1])).toBeLessThanOrEqual(1024)
  })

  it('has Save name and Cancel rename in a wrapping row, and no Rename or Reset button', () => {
    expect(buttonText(markup, 'data-demon-name-save')).toBe('Save name')
    expect(buttonText(markup, 'data-demon-name-cancel')).toBe('Cancel rename')
    expect(markup).toContain('class="mt-1 flex flex-wrap gap-1"')
    expect(tagWith(markup, 'data-demon-name-save')).toContain('min-h-[24px]')
    expect(tagWith(markup, 'data-demon-name-cancel')).toContain('min-h-[24px]')
    expect(markup).not.toContain('data-demon-rename')
    expect(markup).not.toContain('data-demon-name-reset')
  })

  it('a valid draft shows no message and no invalid styling', () => {
    expect(markup).not.toContain('ui-terminal-field--invalid')
    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain('aria-describedby')
    expect(markup).not.toContain('data-demon-name-message')
    expect(markup).toContain('class="ui-terminal-field block w-full"')
  })

  it('an overridden demon opens prefilled with the override', () => {
    const o = renderEditor(overridden28(), { context: 'selection', autoEdit: true }, view28)
    expect(tagWith(o, 'data-demon-name-input')).toContain(`value="${CUSTOM}"`)
  })

  it('typed text is an attribute value, never markup (T-07-10c)', () => {
    const hostile = '"><img src=x onerror=alert(1)>'
    const naming: Naming = { ...g28Naming, overrides: new Map([[69, hostile]]) }
    const out = renderEditor(namingValue(naming, null), { context: 'selection', autoEdit: true }, view28)
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
    expect(out).not.toContain('dangerouslySetInnerHTML')
  })
})

// ── the presentational view: the invalid draft ──────────────────────────────

function renderView(over: Partial<DemonNameEditorViewProps> = {}): string {
  const props: DemonNameEditorViewProps = {
    context: 'selection',
    nameState: 'generated',
    mode: 'edit',
    locked: false,
    tag: 'generated',
    resetLabel: null,
    fieldAria: 'Name for demon c::3',
    draft: 'abc',
    message: null,
    messageId: 'msg-1',
    onRename: noop,
    onReset: noop,
    onSave: noop,
    onCancel: noop,
    onDraft: noop,
    onKeyDown: noop,
    ...over,
  }
  return renderToStaticMarkup(createElement(DemonNameEditorView, props))
}

describe('DemonNameEditorView: an invalid draft', () => {
  const message = demonIssue('c::3', 'digit')
  const markup = renderView({ draft: 'ab1', message })

  it('the field gets the invalid underline, aria-invalid and aria-describedby pointing at the message', () => {
    expect(markup).toContain('ui-terminal-field block w-full ui-terminal-field--invalid')
    const input = tagWith(markup, 'data-demon-name-input')
    expect(input).toContain('aria-invalid="true"')
    expect(input).toContain('aria-describedby="msg-1"')
    expect(input).toContain('value="ab1"')
  })

  it('the message line sits directly under the field, in the refusal red, with the exact copy', () => {
    const p = tagWith(markup, 'data-demon-name-message')
    expect(p.startsWith('<p ')).toBe(true)
    expect(p).toContain('id="msg-1"')
    expect(p).toContain('text-[#f87171]')
    // the static markup writes an apostrophe as a character reference
    expect(textOf(markup).replace(/&#x27;/g, "'")).toContain("c::3: Names can't contain digits.")
    expect(markup.indexOf('data-demon-name-input')).toBeLessThan(markup.indexOf('data-demon-name-message'))
    expect(markup.indexOf('data-demon-name-message')).toBeLessThan(markup.indexOf('data-demon-name-save'))
  })

  it('a message is escaped text (T-07-10c)', () => {
    const out = renderView({ message: '<b>x</b>' })
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(out).not.toContain('<b>')
  })

  it('read mode ignores a stale message and shows the label, tag and buttons', () => {
    const out = renderView({ mode: 'read', message, tag: 'overridden', resetLabel: 'Reset to generated name' })
    expect(out).not.toContain('data-demon-name-message')
    expect(out).not.toContain('<input')
    expect(textOf(out)).toContain('overridden')
    expect(buttonText(out, 'data-demon-name-reset')).toBe('Reset to generated name')
  })

  it('a view that is locked disables its buttons and sets aria-disabled on the root', () => {
    const out = renderView({ mode: 'read', locked: true, resetLabel: 'Reset to generated name' })
    expect(tagWith(out, 'data-demon-name-editor')).toContain('aria-disabled="true"')
    const buttons = openTags(out, 'button')
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b).toContain('disabled=""')
  })

  it('the unavailable mode shows the one line and no button, no input', () => {
    const out = renderView({ mode: 'unavailable' })
    expect(textOf(out)).toContain(renamingUnavailable())
    expect(out).not.toContain('<button')
    expect(out).not.toContain('<input')
    expect(tagWith(out, 'data-demon-name-editor')).toContain('data-demon-name-context="selection"')
  })
})

// ── preview, pending, ceiling ───────────────────────────────────────────────

describe('DemonNameEditor: preview and pending (T-07-17b)', () => {
  for (const state of ['preview', 'pending'] as const) {
    it(`${state}: every button is natively disabled and the root is aria-disabled (overridden demon: Rename and Reset)`, () => {
      const base = overridden28()
      const markup = renderEditor({ ...base, state }, { context: 'selection' }, view28)
      const root = tagWith(markup, 'data-demon-name-editor')
      expect(root).toContain('aria-disabled="true"')
      const buttons = openTags(markup, 'button')
      expect(buttons).toHaveLength(2)
      for (const b of buttons) expect(b).toContain('disabled=""')
      expect(buttonText(markup, 'data-demon-rename')).toBe('Rename demon')
      expect(buttonText(markup, 'data-demon-name-reset')).toBe('Reset to generated name')
    })

    it(`${state}: autoEdit still renders read mode with disabled buttons, never an input`, () => {
      const markup = renderEditor(namingValue(g28Naming, null, { state }), { context: 'collision', autoEdit: true }, view28)
      expect(markup).not.toContain('<input')
      expect(markup).not.toContain('data-demon-name-save')
      for (const b of openTags(markup, 'button')) expect(b).toContain('disabled=""')
    })
  }

  it('the ready state has no aria-disabled and no disabled button', () => {
    const markup = renderEditor(overridden28(), { context: 'selection' }, view28)
    expect(markup).not.toContain('aria-disabled')
    expect(markup).not.toContain('disabled')
  })
})

describe('DemonNameEditor: above the interactive ceiling', () => {
  const base = INTERACTIVE_MAX_N + 2
  const seedOnly = createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N })
  const value = namingValue(seedOnly, null, { state: 'seed-only' })

  it('offers no button and says where renaming stops (no view context needed)', () => {
    const markup = renderEditor(value, { context: 'selection', a: base - 1, b: 3 })
    expect(seedOnly.sounds).toBeNull()
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<input')
    expect(textOf(markup)).toContain(`Renaming is available up to ${INTERACTIVE_MAX_N} zones.`)
    expect(textOf(markup)).toContain(renamingUnavailable())
    expect(tagWith(markup, 'data-demon-name-editor')).toContain('data-demon-name-context="selection"')
  })

  it('autoEdit does not open an input there either', () => {
    expect(renderEditor(value, { context: 'collision', autoEdit: true, a: base - 1, b: 3 })).not.toContain('<input')
  })

  it('the ceiling is the context value: a smaller one makes a small base unavailable, an equal one keeps it open', () => {
    const small = namingValue(g28Naming, null, { interactiveMaxN: 20 })
    expect(textOf(renderEditor(small, { context: 'selection' }, view28))).toContain(renamingUnavailable())
    const equal = namingValue(g28Naming, null, { interactiveMaxN: 28 })
    expect(buttonText(renderEditor(equal, { context: 'selection' }, view28), 'data-demon-rename')).toBe('Rename demon')
  })
})

// ── pure helpers ────────────────────────────────────────────────────────────

describe('editorAvailability', () => {
  it('open when ready and at or below the ceiling', () => {
    expect(editorAvailability('ready', 28, 4000)).toBe('open')
    expect(editorAvailability('ready', 4000, 4000)).toBe('open')
  })
  it('unavailable above the ceiling or in the seed-only state, whatever else', () => {
    expect(editorAvailability('ready', 4002, 4000)).toBe('unavailable')
    expect(editorAvailability('seed-only', 4002, 4000)).toBe('unavailable')
    expect(editorAvailability('preview', 4002, 4000)).toBe('unavailable')
    expect(editorAvailability('pending', 4002, 4000)).toBe('unavailable')
    expect(editorAvailability('seed-only', 28, 4000)).toBe('unavailable')
  })
  it('locked in preview and while a base is building', () => {
    const states: NamesPanelState[] = ['preview', 'pending']
    for (const s of states) expect(editorAvailability(s, 28, 4000)).toBe('locked')
  })
})

describe('commitName', () => {
  const span = 'c::3'
  it('refuses each reason with the demon issue sentence and keeps no text', () => {
    const cases: ReadonlyArray<[string, 'empty' | 'space' | 'digit' | 'other' | 'long']> = [
      ['', 'empty'],
      ['   ', 'empty'],
      ['ab cd', 'space'],
      ['ab1', 'digit'],
      ['ab!', 'other'],
      ['a'.repeat(NAME_MAX_LENGTH + 1), 'long'],
    ]
    for (const [draft, reason] of cases) {
      const result = commitName(draft, 'current', span)
      expect(result).toEqual({ ok: false, message: demonIssue(span, reason) })
    }
    expect(nameReason('long')).toBe(`A name can be at most ${NAME_MAX_LENGTH} characters.`)
  })

  it('accepts a name of exactly the limit and refuses one more', () => {
    expect(commitName('a'.repeat(NAME_MAX_LENGTH), 'current', span)).toMatchObject({ ok: true })
    expect(commitName('a'.repeat(NAME_MAX_LENGTH + 1), 'current', span)).toMatchObject({ ok: false })
  })

  it('returns the trimmed NFC text', () => {
    const decomposed = 'écho'
    expect(toNfc(decomposed)).not.toBe(decomposed)
    const result = commitName(`  ${decomposed} `, 'current', span)
    expect(result).toEqual({ ok: true, text: toNfc(decomposed), unchanged: false })
  })

  it('takes letters of another script', () => {
    const word = String.fromCodePoint(0x6e, 0xe3, 0x6f)
    expect(commitName(word, 'x', span)).toMatchObject({ ok: true, text: word })
  })

  it('flags the draft that equals the current name (compared after NFC) as unchanged', () => {
    expect(commitName('Alpha', 'Alpha', span)).toEqual({ ok: true, text: 'Alpha', unchanged: true })
    expect(commitName(' Alpha ', 'Alpha', span)).toMatchObject({ unchanged: true })
    expect(commitName('Alphb', 'Alpha', span)).toMatchObject({ unchanged: false })
    expect(commitName('é', toNfc('é'), span)).toMatchObject({ unchanged: true })
  })
})

describe('editKeyAction', () => {
  it('Enter in the field saves, Escape anywhere cancels', () => {
    expect(editKeyAction('Enter', false, true)).toBe('save')
    expect(editKeyAction('Escape', false, true)).toBe('cancel')
    expect(editKeyAction('Escape', false, false)).toBe('cancel')
  })
  it('Enter on a button is the button own click, never a second save', () => {
    expect(editKeyAction('Enter', false, false)).toBeNull()
  })
  it('keys during an IME composition do nothing', () => {
    expect(editKeyAction('Enter', true, true)).toBeNull()
    expect(editKeyAction('Escape', true, true)).toBeNull()
  })
  it('other keys do nothing', () => {
    for (const key of ['a', 'Tab', ' ', 'ArrowLeft']) expect(editKeyAction(key, false, true)).toBeNull()
  })
})

describe('activeEdit', () => {
  const edit = { mesh: 69, draft: 'abc', message: null }
  it('is the edit only while it targets the displayed demon', () => {
    expect(activeEdit(edit, 69)).toBe(edit)
    expect(activeEdit(edit, 70)).toBeNull()
    expect(activeEdit(null, 69)).toBeNull()
  })
})

// ── the wiring a server render cannot reach ─────────────────────────────────

describe('DemonNameEditor: source wiring', () => {
  const src = readFileSync(EDITOR_SOURCE, 'utf8')
  const count = (needle: string): number => src.split(needle).length - 1

  it('applies one override action and one reset action, each through the naming context', () => {
    expect(count("type: 'override'")).toBe(1)
    expect(count("type: 'reset-override'")).toBe(1)
    expect(src).toContain('naming.apply(')
  })

  it('announces a result through the live carrier with the copy functions, never a typed sentence', () => {
    expect(src).toContain('naming.announce(')
    expect(src).toContain('renamed(')
    expect(src).toContain('backTo(')
  })

  it('stops the key events it handles, so the overlay does not close on Escape', () => {
    expect(src).toContain('e.stopPropagation()')
    expect(src).toContain('e.preventDefault()')
  })

  it('never writes markup from typed text and has no upstream branding', () => {
    expect(src).not.toContain('dangerouslySetInnerHTML')
    expect(src).not.toMatch(/qliphoth|delight nexus/i)
    expect(src).toContain("'use client'")
  })

  it('reads the view context optionally (the collision mount may render without one)', () => {
    expect(src).toContain('useContext(NumogramViewContext)')
  })
})

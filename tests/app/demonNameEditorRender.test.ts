// The demon name editor (plan 07-16, D-02, NAM-02, T-07-03e, T-07-17b, T-07-10c; 07-UI-SPEC "The demon name editor"): one component
// that reads the NamingContext, shows the source tag and the Rename and Reset buttons, edits the name in a validated field, is
// disabled in preview (and while a base is building), and is not offered above the interactive ceiling. A server render reaches the
// markup of every mode (autoEdit starts in edit mode); the handlers a render cannot reach are pulled into pure helpers (commitName,
// editKeyAction, editorAvailability, activeEdit, resetLabelOf) and tested directly. Names here come from the engine's own naming and
// the preset by reference: no canonical name or CCRU sound is typed. No JSX (plain node test file).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  NAME_MAX_LENGTH,
  createNameResolver,
  createNaming,
  createNumogram,
  resetOverride,
  setOverride,
  toNfc,
  type Naming,
  type NamingPreset,
  type Numogram,
} from '../../engine/index'
import type { HoverInfo } from '../../app/data/types'
import { DemonsOverlay, detailShown, type DemonsOverlayProps } from '../../app/components/demons/DemonsOverlay'
import { DemonInfo, InfoDisplay } from '../../app/components/info/InfoDisplay'
import { legacyDemon } from '../../app/lib/demonBrowser'
import { BASE10 } from '../../app/presets/base10/numogram'
import {
  DemonNameEditor,
  DemonNameEditorView,
  activeEdit,
  commitName,
  editKeyAction,
  editorAvailability,
  nameAfterReset,
  resetLabelOf,
  resetOutcome,
  saveOutcome,
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

function viewCtx(base: number, view: NumogramView | null = null, numogram?: Numogram): NumogramViewContextValue {
  const g = numogram ?? createNumogram(base)
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
    undo: () => false,
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

  it('the Rename button is a small 24px target and is enabled, in a wrapping row', () => {
    const rename = tagWith(markup, 'data-demon-rename')
    expect(rename).toContain('min-h-[24px]')
    expect(rename).toContain('type="button"')
    expect(rename).not.toContain('disabled')
    expect(markup).toContain('<div class="flex flex-wrap gap-1"><button')
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

  it('the field is bounded so an absurd paste is cut, with room for a full-length name of letters that carry marks', () => {
    const max = /maxLength="(\d+)"/.exec(input)
    expect(max).not.toBeNull()
    // more code units than characters: a base letter and its marks are one character of several units
    expect(Number((max as RegExpExecArray)[1])).toBeGreaterThanOrEqual(NAME_MAX_LENGTH * 2)
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

function viewProps(over: Partial<DemonNameEditorViewProps> = {}): DemonNameEditorViewProps {
  return {
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
}

function renderView(over: Partial<DemonNameEditorViewProps> = {}): string {
  return renderToStaticMarkup(createElement(DemonNameEditorView, viewProps(over)))
}

type AnyElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>

/** Every element of a React tree, in order (the view has no hooks, so calling it as a function gives its element tree). */
function elementsOf(node: ReactNode, into: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsOf(child as ReactNode, into)
    return into
  }
  if (node === null || typeof node !== 'object') return into
  const el = node as AnyElement
  into.push(el)
  elementsOf(el.props.children, into)
  return into
}

/** The CyberButton element that carries the data marker, whose handler props the markup cannot show. */
function buttonElement(over: Partial<DemonNameEditorViewProps>, marker: string): AnyElement {
  const found = elementsOf(DemonNameEditorView(viewProps(over))).find(el => (el.props.dataAttrs as Record<string, string> | undefined)?.[marker] === '')
  if (found === undefined) throw new Error(`no button with ${marker}`)
  return found
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
    // the same name written composed and decomposed is still the same name
    expect(commitName('é', 'é', span)).toMatchObject({ unchanged: true })
    expect(commitName('é', 'é', span)).toMatchObject({ unchanged: true })
    expect(commitName('é', 'é', span)).toMatchObject({ unchanged: true })
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

// ── the decisions behind Save name and the reset buttons ────────────────────

const SPAN = { text: 'c::3', hi: 'c', lo: '3' }

describe('saveOutcome', () => {
  it('a refused draft carries the sentence for under the field and no action', () => {
    const out = saveOutcome('ab1', 'cur', 69, SPAN)
    expect(out).toEqual({ kind: 'refused', message: demonIssue('c::3', 'digit') })
  })

  it('a changed draft becomes one override action on the mesh it was opened on, with the announcement', () => {
    const out = saveOutcome(' Zed ', 'cur', 69, SPAN)
    expect(out).toEqual({
      kind: 'rename',
      action: { type: 'override', mesh: 69, name: 'Zed' },
      status: 'Renamed c::3 to Zed.',
    })
  })

  it('a draft equal to the name shown has nothing to save', () => {
    expect(saveOutcome('cur', 'cur', 69, SPAN)).toEqual({ kind: 'unchanged' })
  })

  it('saving the name the rule gives is a rename action the engine turns into removing the override', () => {
    const base = overridden28()
    const ruleName = base.resolver.ruleNameOf(12, 3, base.naming.smoothing)
    expect(ruleName).not.toBe(CUSTOM)
    const out = saveOutcome(ruleName, base.resolver.nameOf(12, 3), 69, SPAN)
    expect(out.kind).toBe('rename')
    if (out.kind !== 'rename') return
    const after = setOverride(base.naming, out.action.mesh, out.action.name, null)
    expect(after.overrides.has(69)).toBe(false)
    expect(createNameResolver(after, null).nameOf(12, 3)).toBe(ruleName)
    expect(createNameResolver(after, null).stateOf(12, 3)).toBe('generated')
  })

  it('saving the CCRU name over an override clears it too (mesh 44 at base 10)', () => {
    const naming = setOverride(ccru10(), 44, CUSTOM, CCRU_NAMING_PRESET)
    const resolver = createNameResolver(naming, CCRU_NAMING_PRESET)
    const preset = resolver.presetNameOf(9, 8)
    expect(preset).not.toBeNull()
    const out = saveOutcome(preset as string, resolver.nameOf(9, 8), 44, { text: '9::8', hi: '9', lo: '8' })
    expect(out.kind).toBe('rename')
    if (out.kind !== 'rename') return
    const after = setOverride(naming, out.action.mesh, out.action.name, CCRU_NAMING_PRESET)
    expect(after.overrides.has(44)).toBe(false)
    expect(createNameResolver(after, CCRU_NAMING_PRESET).stateOf(9, 8)).toBe('preset')
  })
})

describe('resetOutcome and nameAfterReset', () => {
  it('the reset action names the mesh and the announcement says what the demon is called now', () => {
    expect(resetOutcome(69, 'Back', SPAN)).toEqual({ action: { type: 'reset-override', mesh: 69 }, status: 'c::3 is back to Back.' })
  })

  it('without a preset the name after a reset is the rule name under the naming smoothing', () => {
    const base = overridden28()
    const reset = createNameResolver(resetOverride(base.naming, 69), null)
    expect(nameAfterReset(base.resolver, 12, 3, base.naming.smoothing)).toBe(reset.nameOf(12, 3))
    const smoothed: Naming = { ...base.naming, smoothing: 1 }
    const resolver = createNameResolver(smoothed, null)
    expect(nameAfterReset(resolver, 12, 3, 1)).toBe(createNameResolver(resetOverride(smoothed, 69), null).nameOf(12, 3))
    expect(nameAfterReset(resolver, 12, 3, 1)).toBe(resolver.ruleNameOf(12, 3, 1))
  })

  it('with the CCRU preset it is the preset name, not the rule name', () => {
    const naming = setOverride(ccru10(), 44, CUSTOM, CCRU_NAMING_PRESET)
    const resolver = createNameResolver(naming, CCRU_NAMING_PRESET)
    const preset = resolver.presetNameOf(9, 8) as string
    expect(nameAfterReset(resolver, 9, 8, naming.smoothing)).toBe(preset)
    expect(createNameResolver(resetOverride(naming, 44), CCRU_NAMING_PRESET).nameOf(9, 8)).toBe(preset)
    expect(preset).not.toBe(resolver.ruleNameOf(9, 8, naming.smoothing))
  })
})

// ── the handlers the markup cannot show ─────────────────────────────────────

describe('DemonNameEditorView: handler wiring', () => {
  it('each button calls its own handler', () => {
    const calls: string[] = []
    const over = {
      resetLabel: 'Reset',
      onRename: () => calls.push('rename'),
      onReset: () => calls.push('reset'),
      onSave: () => calls.push('save'),
      onCancel: () => calls.push('cancel'),
    }
    ;(buttonElement({ ...over, mode: 'read' }, 'data-demon-rename').props.onClick as () => void)()
    ;(buttonElement({ ...over, mode: 'read' }, 'data-demon-name-reset').props.onClick as () => void)()
    ;(buttonElement({ ...over, mode: 'edit' }, 'data-demon-name-save').props.onClick as () => void)()
    ;(buttonElement({ ...over, mode: 'edit' }, 'data-demon-name-cancel').props.onClick as () => void)()
    expect(calls).toEqual(['rename', 'reset', 'save', 'cancel'])
  })

  it('the read buttons are disabled exactly when locked, the edit buttons never', () => {
    expect(buttonElement({ mode: 'read', locked: true }, 'data-demon-rename').props.disabled).toBe(true)
    expect(buttonElement({ mode: 'read', locked: false }, 'data-demon-rename').props.disabled).toBe(false)
    expect(buttonElement({ mode: 'read', locked: true, resetLabel: 'R' }, 'data-demon-name-reset').props.disabled).toBe(true)
    expect(buttonElement({ mode: 'read', locked: false, resetLabel: 'R' }, 'data-demon-name-reset').props.disabled).toBe(false)
    expect(buttonElement({ mode: 'edit', locked: false }, 'data-demon-name-save').props.disabled).toBeUndefined()
  })

  it('typing in the field reports the new text', () => {
    const typed: string[] = []
    const input = elementsOf(DemonNameEditorView(viewProps({ mode: 'edit', onDraft: t => typed.push(t) }))).find(el => el.type === 'input')
    expect(input).toBeDefined()
    ;(input?.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'typed' } })
    expect(typed).toEqual(['typed'])
    expect(input?.props.value).toBe('abc')
  })

  it('the key handler is on the root only in edit mode, so a read-mode Escape still reaches the overlay', () => {
    const handler = () => undefined
    expect(DemonNameEditorView(viewProps({ mode: 'edit', onKeyDown: handler })).props.onKeyDown).toBe(handler)
    expect(DemonNameEditorView(viewProps({ mode: 'read', onKeyDown: handler })).props.onKeyDown).toBeUndefined()
    expect(DemonNameEditorView(viewProps({ mode: 'unavailable', onKeyDown: handler })).props.onKeyDown).toBeUndefined()
  })
})

// ── the wiring a server render cannot reach ─────────────────────────────────

describe('DemonNameEditor: source wiring', () => {
  const src = readFileSync(EDITOR_SOURCE, 'utf8')
  const count = (needle: string): number => src.split(needle).length - 1

  it('names one override action and one reset action, applied through the naming context', () => {
    expect(count("type: 'override'")).toBe(1)
    expect(count("type: 'reset-override'")).toBe(1)
    expect(count('naming.apply(outcome.action)')).toBe(2)
  })

  it('announces a result and a refusal through the live carrier, only after the action was accepted', () => {
    expect(count('naming.announce(outcome.status)')).toBe(2)
    expect(count('naming.announce(outcome.message)')).toBe(1)
    // Save and Reset each announce only when the action was accepted (a refused one, say in preview, says nothing)
    expect(count("if (outcome.kind === 'rename' && naming.apply(outcome.action)) naming.announce(outcome.status)")).toBe(1)
    expect(count('if (naming.apply(outcome.action)) naming.announce(outcome.status)')).toBe(1)
    expect(src).toContain('renamed(')
    expect(src).toContain('backTo(')
  })

  it('a refused draft keeps the edit open, announces the refusal and puts the caret back in the field', () => {
    expect(src).toMatch(
      /setEdit\(\{ \.\.\.active, message: outcome\.message \}\)\s+naming\.announce\(outcome\.message\)\s+\/\/[^\n]*\n\s+inputRef\.current\?\.focus\(\)\s+return/,
    )
  })

  it('a key event is ignored unless an edit is showing', () => {
    expect(src).toMatch(/function onKeyDown\([^)]*\): void \{\s*if \(active === null\) return/)
  })

  it('tells its owner when an edit opens and closes, and when it unmounts while open', () => {
    expect(src).toContain('onEditingChange?.(true)')
    expect(src).toContain('onEditingChange?.(false)')
    expect(src).toContain('changeRef.current?.(true)')
    expect(count('changeRef.current?.(false)')).toBe(2)
  })

  it('returns focus to the Rename button after a save, a cancel or a reset, except in the collision mount', () => {
    expect(src).toContain("refocusRename.current = context !== 'collision'")
    expect(src).toContain("[data-demon-rename]")
    expect(src).toContain('onDone?.()')
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

// ── the mounts: DemonInfo (Selection detail) and the Demons overlay detail ──

const INFO_SOURCE = fileURLToPath(new URL('../../app/components/info/InfoDisplay.tsx', import.meta.url))
const OVERLAY_SOURCE = fileURLToPath(new URL('../../app/components/demons/DemonsOverlay.tsx', import.meta.url))

const g28 = createNumogram(28)
const g10 = BASE10

const demonInfo = (g: Numogram, a: number, b: number): HoverInfo & { type: 'demon' } => ({
  type: 'demon',
  demon: legacyDemon(g.demons.ref(a, b), g.base),
})

function renderIn(g: Numogram, withView: boolean, naming: NamingContextValue | null, el: ReturnType<typeof createElement>): string {
  const ctx = viewCtx(g.base, withView ? buildNumogramView(g) : null, g)
  const inner = naming === null ? el : createElement(NamingContext.Provider, { value: naming }, el)
  return renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: ctx }, inner))
}

const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1

/** The detail frame (SectionFrame's root div) is closed before the editor's root starts, so the editor is its sibling. */
function expectFrameClosedBeforeEditor(markup: string): void {
  const frameStart = markup.indexOf('<div class="pl-2 py-1">')
  const editorStart = markup.indexOf('<div data-post-baseline="" data-demon-name-editor=""')
  expect(frameStart).toBeGreaterThanOrEqual(0)
  expect(editorStart).toBeGreaterThan(frameStart)
  const between = markup.slice(frameStart, editorStart)
  expect(occurrences(between, '<div')).toBe(occurrences(between, '</div>'))
}

describe('DemonInfo: the editor mount', () => {
  const info28 = demonInfo(g28, 12, 3)

  it('non-lore variant (base 28): one selection editor after the detail frame, the last child of the wrapper', () => {
    const markup = renderIn(g28, true, namingValue(g28Naming, null), createElement(DemonInfo, { data: info28, editorContext: 'selection' }))
    expect(occurrences(markup, 'data-demon-name-editor')).toBe(1)
    expect(markup).toContain('data-demon-name-context="selection"')
    expect(markup.indexOf('Cyclic chrono')).toBeGreaterThan(0)
    expect(markup.indexOf('data-demon-name-editor')).toBeGreaterThan(markup.indexOf('Cyclic chrono'))
    // the editor root is the last element inside the space-y-1.5 wrapper, a sibling after the frame and not inside it
    expect(markup.endsWith('</div></div>')).toBe(true)
    expectFrameClosedBeforeEditor(markup)
    expect(buttonText(markup, 'data-demon-rename')).toBe('Rename demon')
  })

  it('lore variant (base 10): the editor follows the frame, tagged as a CCRU name', () => {
    const naming = namingValue(ccru10(), CCRU_NAMING_PRESET)
    const info = demonInfo(g10, 9, 8)
    const markup = renderIn(g10, true, naming, createElement(DemonInfo, { data: info, editorContext: 'selection' }))
    expect(occurrences(markup, 'data-demon-name-editor')).toBe(1)
    expect(tagWith(markup, 'data-demon-name-editor')).toContain('data-demon-name-state="preset"')
    expect(markup).toContain(`>${NAMES_COPY.tagCcru}<`)
    expect(markup.indexOf('data-demon-name-editor')).toBeGreaterThan(markup.indexOf('TYPE'))
    expect(markup.endsWith('</div></div>')).toBe(true)
    expectFrameClosedBeforeEditor(markup)
  })

  it('the editor is for the demon on show: an override of that demon alone changes its tag', () => {
    const markup = renderIn(g28, true, overridden28(), createElement(DemonInfo, { data: info28, editorContext: 'selection' }))
    expect(tagWith(markup, 'data-demon-name-editor')).toContain('data-demon-name-state="overridden"')
    expect(buttonText(markup, 'data-demon-name-reset')).toBe('Reset to generated name')
    // another demon of the same numogram is not overridden
    const other = renderIn(g28, true, overridden28(), createElement(DemonInfo, { data: demonInfo(g28, 12, 4), editorContext: 'selection' }))
    expect(tagWith(other, 'data-demon-name-editor')).toContain('data-demon-name-state="generated"')
    expect(other).not.toContain('data-demon-name-reset')
  })

  it('the overlay context is passed through to the root', () => {
    const markup = renderIn(g28, true, namingValue(g28Naming, null), createElement(DemonInfo, { data: info28, editorContext: 'overlay' }))
    expect(markup).toContain('data-demon-name-context="overlay"')
    expect(markup).not.toContain('data-demon-name-context="selection"')
  })

  it('without editorContext no editor is mounted, in either variant, even inside a provider', () => {
    const lore = renderIn(g10, true, namingValue(ccru10(), CCRU_NAMING_PRESET), createElement(DemonInfo, { data: demonInfo(g10, 9, 8) }))
    const plain = renderIn(g28, true, namingValue(g28Naming, null), createElement(DemonInfo, { data: info28 }))
    expect(lore).not.toContain('data-demon-name')
    expect(plain).not.toContain('data-demon-name')
  })

  it('with no provider the markup is byte-identical with and without editorContext', () => {
    for (const [g, info] of [[g10, demonInfo(g10, 9, 8)], [g28, info28]] as const) {
      const without = renderIn(g, true, null, createElement(DemonInfo, { data: info }))
      const withContext = renderIn(g, true, null, createElement(DemonInfo, { data: info, editorContext: 'selection' }))
      expect(withContext).toBe(without)
      expect(without).not.toContain('data-demon-name')
    }
  })

  it('with the naming of another base it renders the legacy detail and no editor', () => {
    const markup = renderIn(g28, true, namingValue(generated(30), null), createElement(DemonInfo, { data: info28, editorContext: 'selection' }))
    expect(markup).not.toContain('data-demon-name')
  })

  it('forwards onEditingChange to the editor (source)', () => {
    const src = readFileSync(INFO_SOURCE, 'utf8')
    expect(occurrences(src, '<DemonNameEditor')).toBe(2)
    expect(occurrences(src, 'onEditingChange={onEditingChange}')).toBe(2)
    expect(occurrences(src, 'context={editorContext}')).toBe(2)
  })
})

describe('InfoDisplay: the Selection panel passes the selection context', () => {
  it('a pinned demon shows its editor with context selection', () => {
    const markup = renderIn(
      g28,
      true,
      namingValue(g28Naming, null),
      createElement(InfoDisplay, { hoverInfo: null, pinnedInfo: demonInfo(g28, 12, 3) }),
    )
    expect(occurrences(markup, 'data-demon-name-editor')).toBe(1)
    expect(markup).toContain('data-demon-name-context="selection"')
  })

  it('a pinned zone has no editor, and with no provider nothing changes', () => {
    const zone = renderIn(g28, true, namingValue(g28Naming, null), createElement(InfoDisplay, { hoverInfo: null, pinnedInfo: { type: 'zone', zone: 5 } }))
    expect(zone).not.toContain('data-demon-name')
    const bare = renderIn(g28, true, null, createElement(InfoDisplay, { hoverInfo: null, pinnedInfo: demonInfo(g28, 12, 3) }))
    expect(bare).not.toContain('data-demon-name')
  })
})

describe('DemonsOverlay: the detail pane mount', () => {
  const noopProps: DemonsOverlayProps = {
    isMobile: false,
    tab: 'browser',
    onTabChange: noop,
    filter: null,
    onFilterChange: noop,
    focus: null,
    onFocusChange: noop,
    showDiagram: false,
    hoverInfo: null,
    pinnedInfo: null,
    onHoverInfo: noop,
    onPinInfo: noop,
    onClose: noop,
  }
  const overlay = (over: Partial<DemonsOverlayProps>) => createElement(DemonsOverlay, { ...noopProps, ...over })

  it('a pinned demon: the editor sits inside the detail aside with context overlay', () => {
    const markup = renderIn(g28, false, namingValue(g28Naming, null), overlay({ pinnedInfo: demonInfo(g28, 12, 3) }))
    expect(occurrences(markup, 'data-demon-name-editor')).toBe(1)
    expect(markup).toContain('data-demon-name-context="overlay"')
    expect(markup.indexOf('data-demon-name-editor')).toBeGreaterThan(markup.indexOf('data-demon-detail'))
  })

  it('no demon shown: the hint and no editor', () => {
    const markup = renderIn(g28, false, namingValue(g28Naming, null), overlay({}))
    expect(markup).toContain('Hover or click a demon to inspect it.')
    expect(markup).not.toContain('data-demon-name')
  })

  it('with no provider the overlay shows no editor', () => {
    const markup = renderIn(g28, false, null, overlay({ pinnedInfo: demonInfo(g28, 12, 3) }))
    expect(markup).not.toContain('data-demon-name')
  })

  it('wires the detail pane through detailShown and the bound edit (source)', () => {
    const src = readFileSync(OVERLAY_SOURCE, 'utf8')
    expect(src).toContain('const shown = detailShown(hoverInfo, pinnedInfo, boundEdit)')
    expect(occurrences(src, 'editorContext="overlay"')).toBe(1)
    // an opened editor binds the pane to the demon on show (with its base), a closed one releases it
    expect(src).toContain('onEditingChange={editing => setBound(editing ? { base, info: shown } : null)}')
    expect(src).toContain('export function detailShown')
    expect(src).toContain('const boundEdit = bound !== null && bound.base === base ? bound.info : null')
  })

  it('clears the bound demon when the base changes or the overlay closes (source)', () => {
    const src = readFileSync(OVERLAY_SOURCE, 'utf8')
    expect(src).toMatch(/bound\.base === base/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*setBound\(null\)\s*\}, \[base\]\)/)
  })
})

describe('detailShown: the pane follows hover, except while an editor is open (binding)', () => {
  const A = demonInfo(g28, 12, 3)
  const B = demonInfo(g28, 9, 4)
  const C = demonInfo(g28, 7, 2)
  const zone: HoverInfo = { type: 'zone', zone: 5 }

  it('the demon an editor is open on wins over hover and over the pinned demon', () => {
    expect(detailShown(B, C, A)).toBe(A)
    expect(detailShown(null, C, A)).toBe(A)
    expect(detailShown(B, null, A)).toBe(A)
  })

  it('with no editor open a hovered demon wins over the pinned one', () => {
    expect(detailShown(B, C, null)).toBe(B)
  })

  it('with nothing hovered the pinned demon is shown', () => {
    expect(detailShown(null, C, null)).toBe(C)
  })

  it('a hovered or pinned item that is not a demon is ignored', () => {
    expect(detailShown(zone, C, null)).toBe(C)
    expect(detailShown(zone, zone, null)).toBeNull()
    expect(detailShown(null, zone, null)).toBeNull()
    expect(detailShown(B, C, zone)).toBe(B)
  })

  it('nothing at all gives nothing', () => {
    expect(detailShown(null, null, null)).toBeNull()
  })
})

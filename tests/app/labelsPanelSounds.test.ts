// The Sounds label mode controls (Phase 7 plan 07-12, D-03, 07-UI-SPEC "Sounds Label Mode Contract"): the fourth radio of the
// label scheme row, its one-line note (a different note on the pair graph and planetary layouts), and the Labels panel row that
// reads `Sounds` only while the scheme is `sounds`. Every other string stays what it was, because the behaviour baseline records
// the Labels panel at base 10. Server render only (no JSX, plain node test file): the click handlers are reached through a spy that
// wraps CyberRadio, and the hover text of the panel through a spy that wraps HoverInfoList (it only shows on hover).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNumogram, type Numogram } from '../../engine/index'
import type { CyberRadio } from '../../app/components/ui/CyberRadio'
import { NAMES_COPY } from '../../app/lib/namingCopy'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, zoneLabelsFor, type LabelScheme } from '../../app/lib/labelScheme'
import { buildNumogramView, summarize } from '../../app/lib/numogramView'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../../app/lib/tierBounds'
import { BASE10 } from '../../app/presets/base10/numogram'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { LabelSchemeControls } from '../../app/components/numogram/LabelSchemeControls'
import { BasePicker, type BasePickerProps } from '../../app/components/numogram/BasePicker'
import { LabelsPanel } from '../../app/components/panels/LabelsPanel'

type RadioProps = ComponentProps<typeof CyberRadio>
interface PanelItem {
  readonly id: string
  readonly info: string
  readonly active: boolean
  readonly label: ReactNode
  readonly onClick: () => void
}

// Spies: CyberRadio still renders exactly its own markup (it has no hooks, so it can be called as a function) and HoverInfoList
// hands back the items the panel built instead of drawing them.
const seen = vi.hoisted(() => ({ radios: [] as { label: string; checked: boolean; onChange: () => void }[], items: [] as PanelItem[][] }))

vi.mock('../../app/components/ui/CyberRadio', async importOriginal => {
  const actual = await importOriginal<typeof import('../../app/components/ui/CyberRadio')>()
  return {
    ...actual,
    CyberRadio: (props: RadioProps) => {
      seen.radios.push({ label: props.label, checked: props.checked, onChange: props.onChange })
      return actual.CyberRadio(props)
    },
  }
})

vi.mock('../../app/components/panels/HoverInfoList', () => ({
  HoverInfoList: (props: { items: PanelItem[] }) => {
    seen.items.push(props.items)
    return null
  },
}))

beforeEach(() => {
  seen.radios.length = 0
  seen.items.length = 0
})

const noop = () => {}

// The text of a markup string: tags removed, the one entity React emits for an apostrophe decoded.
const textOf = (markup: string): string => markup.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'")

function renderControls(scheme: LabelScheme, extra: { numeralsLayout?: boolean; onChange?: (s: LabelScheme) => void } = {}): string {
  return renderToStaticMarkup(
    createElement('div', { 'data-post-baseline': '' },
      createElement(LabelSchemeControls, { base: 10, scheme, onChange: extra.onChange ?? noop, numeralsLayout: extra.numeralsLayout })),
  )
}

describe('LabelSchemeControls: the Sounds radio', () => {
  it('renders four radios in the order Digits, Xeno, Sounds, Custom, all in the one group', () => {
    const markup = renderControls(DEFAULT_LABEL_SCHEME)
    expect(seen.radios.map(r => r.label)).toEqual(['Digits', 'Xeno', 'Sounds', 'Custom'])
    expect(NAMES_COPY.soundsRadio).toBe('Sounds')
    const at = ['Digits', 'Xeno', 'Sounds', 'Custom'].map(label => markup.indexOf(`>${label}</span>`))
    expect(at.every(i => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect((markup.match(/name="ccrug-labels"/g) ?? []).length).toBe(4)
  })

  it('wraps: the row is a flex row with flex-wrap and gap-y-1', () => {
    const markup = renderControls(DEFAULT_LABEL_SCHEME)
    const row = /<div class="([^"]*)"><span[^>]*>Labels:<\/span>/.exec(markup)
    expect(row).not.toBeNull()
    const classes = ((row as RegExpExecArray)[1]).split(' ')
    expect(classes).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'items-center', 'gap-2', 'gap-y-1']))
  })

  it('checks exactly the radio of the active scheme', () => {
    const checkedFor = (scheme: LabelScheme): string[] => {
      seen.radios.length = 0
      renderControls(scheme)
      return seen.radios.filter(r => r.checked).map(r => r.label)
    }
    expect(checkedFor({ mode: 'digits' })).toEqual(['Digits'])
    expect(checkedFor({ mode: 'xeno' })).toEqual(['Xeno'])
    expect(checkedFor({ mode: 'sounds' })).toEqual(['Sounds'])
    expect(checkedFor({ mode: 'preset', preset: 'base62' })).toEqual(['Custom'])
    expect(checkedFor({ mode: 'custom', chars: ['a', 'b'] })).toEqual(['Custom'])
  })

  it('choosing Sounds calls onChange with { mode: sounds }; the other radios keep their schemes', () => {
    const onChange = vi.fn()
    renderControls(DEFAULT_LABEL_SCHEME, { onChange })
    const radio = (label: string) => {
      const found = seen.radios.find(r => r.label === label)
      if (!found) throw new Error(`no ${label} radio`)
      return found
    }
    radio('Sounds').onChange()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'sounds' })
    radio('Xeno').onChange()
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'xeno' })
    radio('Digits').onChange()
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_LABEL_SCHEME)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('selectSounds closes the custom disclosure before it reports the choice', () => {
    const source = readFileSync(fileURLToPath(new URL('../../app/components/numogram/LabelSchemeControls.tsx', import.meta.url)), 'utf8')
      .replace(/\r\n/g, '\n')
    // the function ends at the first closing brace on its own line, indented like the function
    const body = /function selectSounds\(\): void \{\n([\s\S]*?)\n  \}\n/.exec(source)
    expect(body).not.toBeNull()
    const lines = ((body as RegExpExecArray)[1]).split('\n').map(l => l.trim()).filter(Boolean)
    expect(lines).toEqual(["setOpen(false)", "onChange({ mode: 'sounds' })"])
  })
})

describe('LabelSchemeControls: the note under the row', () => {
  it('shows the sounds note only while the scheme is sounds', () => {
    const note = (scheme: LabelScheme, numeralsLayout?: boolean) => textOf(renderControls(scheme, { numeralsLayout }))
    expect(NAMES_COPY.soundsNote).toBe("Nodes show each zone's sound from the Names panel.")
    expect(note({ mode: 'sounds' })).toContain("Nodes show each zone's sound from the Names panel.")
    expect(note({ mode: 'digits' })).not.toContain('Nodes show')
    expect(note({ mode: 'xeno' })).not.toContain('Nodes show')
    expect(note({ mode: 'custom', chars: ['a', 'b'] })).not.toContain('Nodes show')
  })

  it('reads This layout shows numerals. on a layout that keeps numerals, and never shows both notes', () => {
    const sounds = textOf(renderControls({ mode: 'sounds' }, { numeralsLayout: true }))
    expect(sounds).toContain('This layout shows numerals.')
    expect(sounds).not.toContain('Nodes show')
    expect(textOf(renderControls({ mode: 'sounds' }, { numeralsLayout: false }))).not.toContain('This layout shows numerals.')
    // the numerals note belongs to sounds mode: in another mode the flag shows nothing
    expect(textOf(renderControls({ mode: 'digits' }, { numeralsLayout: true }))).not.toContain('This layout shows numerals.')
  })

  it('puts the note in a post-baseline paragraph at the 10px helper size, gray-400', () => {
    const markup = renderControls({ mode: 'sounds' })
    expect(markup).toMatch(/<p [^>]*data-post-baseline=""[^>]*class="text-\[10px\] text-gray-400"[^>]*>Nodes show/)
    // and the whole control sits inside a post-baseline element, as it does in the dropdown portal
    expect(markup.startsWith('<div data-post-baseline="">')).toBe(true)
  })
})

describe('BasePicker forwards numeralsLayout', () => {
  const source = readFileSync(fileURLToPath(new URL('../../app/components/numogram/BasePicker.tsx', import.meta.url)), 'utf8')

  it('takes an optional numeralsLayout prop, default false, and hands it to LabelSchemeControls', () => {
    expect(source).toMatch(/numeralsLayout\?: boolean/)
    expect(source).toMatch(/numeralsLayout = false/)
    expect(source).toMatch(/<LabelSchemeControls[^>]*numeralsLayout=\{numeralsLayout\}/)
  })

  it('renders with the prop true or absent (it only reaches the dropdown, which is not part of a static render)', () => {
    const props: BasePickerProps = {
      base: 10,
      summary: summarize(createNumogram(10)),
      externalRefusal: null,
      onCommitBase: noop,
      labelScheme: { mode: 'sounds' },
      onLabelSchemeChange: noop,
      packer: 'spiral',
      onPackerChange: noop,
      packerVisible: false,
    }
    const plain = renderToStaticMarkup(createElement(BasePicker, props))
    const flagged = renderToStaticMarkup(createElement(BasePicker, { ...props, numeralsLayout: true }))
    expect(flagged.replace(/id="[^"]*"/g, '')).toBe(plain.replace(/id="[^"]*"/g, ''))
  })
})

function ctxFor(g: Numogram, scheme: LabelScheme): NumogramViewContextValue {
  const base = g.base
  return {
    base,
    g,
    summary: summarize(g),
    view: buildNumogramView(g),
    zoneLabels: zoneLabelsFor(base, scheme),
    labelScheme: scheme,
    zoneLabel: (z: number) => formatZoneLabel(z, base, scheme),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: 'on',
    tier: 'svg',
    interactiveMaxN: INTERACTIVE_MAX_N,
  }
}

function panelRows(g: Numogram, scheme: LabelScheme): { id: string; label: string; info: string }[] {
  seen.items.length = 0
  renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: ctxFor(g, scheme) },
      createElement(LabelsPanel, { labels: { numbers: true, xenotation: false, planets: true }, onToggleLabel: noop })),
  )
  const items = seen.items[0]
  if (!items) throw new Error('the panel built no list')
  return items.map(item => ({ id: item.id, label: textOf(renderToStaticMarkup(createElement('div', null, item.label))), info: item.info }))
}

const NUMBERS_INFO_BASE10 = 'Show or hide numeric zone ids (0-9) on the diagram.'
const SOUNDS_INFO = 'Show or hide zone sounds on the diagram (numerals on the pair graph and planetary layouts).'

describe('LabelsPanel: the zone label row', () => {
  const base10 = BASE10

  it('with the digits scheme at base 10 reads exactly today\'s strings', () => {
    const rows = panelRows(base10, { mode: 'digits' })
    expect(rows.find(r => r.id === 'numbers')).toEqual({ id: 'numbers', label: 'Numbers', info: NUMBERS_INFO_BASE10 })
    expect(rows.map(r => r.id)).toEqual(['numbers', 'xenotation', 'planets'])
  })

  it('with the sounds scheme the numbers row reads Sounds and its hover text names sounds and the numeral layouts', () => {
    expect(NAMES_COPY.labelsRowSounds).toBe('Sounds')
    expect(NAMES_COPY.labelsInfoSounds).toBe(SOUNDS_INFO)
    const row = panelRows(base10, { mode: 'sounds' }).find(r => r.id === 'numbers')
    expect(row).toEqual({ id: 'numbers', label: 'Sounds', info: SOUNDS_INFO })
  })

  it('keeps the numbers row (and its toggle id) unchanged in the xeno and custom schemes', () => {
    for (const scheme of [{ mode: 'xeno' }, { mode: 'custom', chars: Array.from('abcdefghij') }] as LabelScheme[]) {
      const row = panelRows(base10, scheme).find(r => r.id === 'numbers')
      expect(row?.label).toBe('Numbers')
      expect(row?.info).toBe(NUMBERS_INFO_BASE10)
    }
  })

  it('reads the generic hover text of a base without lore in every scheme but sounds', () => {
    const g12 = createNumogram(12)
    const digits = panelRows(g12, { mode: 'digits' }).find(r => r.id === 'numbers')
    expect(digits?.label).toBe('Numbers')
    expect(digits?.info).toBe(`Show or hide zone labels (${formatZoneLabel(0, 12, DEFAULT_LABEL_SCHEME)}-${formatZoneLabel(11, 12, DEFAULT_LABEL_SCHEME)}).`)
    const sounds = panelRows(g12, { mode: 'sounds' }).find(r => r.id === 'numbers')
    expect(sounds).toEqual({ id: 'numbers', label: 'Sounds', info: SOUNDS_INFO })
  })

  it('changes no other row: Tic Xenotation and Planets read the same in sounds mode as in digits mode', () => {
    const others = (scheme: LabelScheme) => panelRows(base10, scheme).filter(r => r.id !== 'numbers')
    expect(others({ mode: 'sounds' })).toEqual(others({ mode: 'digits' }))
    expect(others({ mode: 'sounds' }).map(r => r.label)).toEqual(['Tic Xenotation', 'Planets'])
  })

  it('leaves the toggle wired to the same key', () => {
    seen.items.length = 0
    const onToggleLabel = vi.fn()
    renderToStaticMarkup(
      createElement(NumogramViewContext.Provider, { value: ctxFor(base10, { mode: 'sounds' }) },
        createElement(LabelsPanel, { labels: { numbers: true, xenotation: false, planets: true }, onToggleLabel })),
    )
    const numbers = seen.items[0].find(item => item.id === 'numbers')
    numbers?.onClick()
    expect(onToggleLabel).toHaveBeenCalledWith('numbers')
  })
})

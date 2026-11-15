// Render-time names in every display (plan 07-15, D-03, D-08, NAM-02, NAM-04, research Pitfall 6, T-07-10b, T-07-03d): the demon
// browser NAME cell, the matrix tooltip text and keyboard live text, the Selection demon detail heading, the selected-item title
// and the pinned background all read the name from the NamingContext resolver at render time, never from the name baked into the
// HoverInfo by legacyDemon. Without a provider every display renders exactly as before. The virtualizer is replaced by a fixed
// window of items, because a server render has no scroll element and would otherwise render no rows at all. Names here come from
// the engine's own naming (and the preset by reference); no canonical name is typed. No JSX (plain node test file).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number; scrollMargin?: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(opts.count, 50) }, (_, i) => ({
        index: i,
        key: i,
        start: (opts.scrollMargin ?? 0) + i * opts.estimateSize(),
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    scrollToIndex: () => undefined,
    scrollToOffset: () => undefined,
  }),
}))

import {
  createNameResolver,
  createNaming,
  createNumogram,
  setOverride,
  splitGraphemes,
  type Naming,
  type NamingPreset,
  type Numogram,
} from '../../engine/index'
import type { HoverInfo } from '../../app/data/types'
import { DemonRowList } from '../../app/components/demons/DemonRowList'
import { DemonMatrix, demonText } from '../../app/components/demons/DemonMatrix'
import { DemonInfo, InfoDisplay, selectedInfoMeta } from '../../app/components/info/InfoDisplay'
import { PinnedBackground } from '../../app/components/info/PinnedBackground'
import { NamingContext, type NamingContextValue } from '../../app/components/names/NamingContext'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { SUBTYPE_LABEL, legacyDemon, netSpanLabel } from '../../app/lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, zoneLabelsFor } from '../../app/lib/labelScheme'
import { NAMES_COPY, matrixTooltip } from '../../app/lib/namingCopy'
import { NAME_TOOLTIP_GRAPHEMES } from '../../app/lib/namingLimits'
import { buildNumogramView, summarize, type NumogramView } from '../../app/lib/numogramView'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'

const INFO_SOURCE = fileURLToPath(new URL('../../app/components/info/InfoDisplay.tsx', import.meta.url))
const ROW_LIST_SOURCE = fileURLToPath(new URL('../../app/components/demons/DemonRowList.tsx', import.meta.url))
const MATRIX_SOURCE = fileURLToPath(new URL('../../app/components/demons/DemonMatrix.tsx', import.meta.url))
const noop = () => {}
const ELLIPSIS = String.fromCodePoint(0x2026)
const MIDDLE_DOT = String.fromCodePoint(0xb7)
const CCRU_BASE = CCRU_NAMING_PRESET.base

const g28 = createNumogram(28)
const g10 = createNumogram(10)

// ── fixtures ────────────────────────────────────────────────────────────────

function viewCtx(g: Numogram, withView: boolean): NumogramViewContextValue {
  const base = g.base
  const view: NumogramView | null = withView ? buildNumogramView(g) : null
  return {
    base,
    g,
    summary: summarize(g),
    view,
    zoneLabels: withView ? zoneLabelsFor(base, DEFAULT_LABEL_SCHEME) : null,
    labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: 'off',
    tier: withView ? 'svg' : 'headless',
    interactiveMaxN: INTERACTIVE_MAX_N,
  }
}

function namingValue(naming: Naming, preset: NamingPreset | null = null): NamingContextValue {
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
    announcementNonce: 0,
    restored: { tick: 0, zone: null },
    apply: () => false,
    keep: noop,
    revert: noop,
    undo: () => false,
    announce: noop,
  }
}

const generated = (base: number): Naming => createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N })
const ccru10 = (): Naming => createNaming({ base: CCRU_BASE, interactiveMaxN: INTERACTIVE_MAX_N, source: 'ccru', preset: CCRU_NAMING_PRESET })
const valueOf = (naming: Naming): NamingContextValue => namingValue(naming, naming.source === 'ccru' ? CCRU_NAMING_PRESET : null)

function render(g: Numogram, withView: boolean, naming: NamingContextValue | null, el: ReturnType<typeof createElement>): string {
  const inner = naming === null ? el : createElement(NamingContext.Provider, { value: naming }, el)
  return renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: viewCtx(g, withView) }, inner))
}

function renderRows(g: Numogram, naming: NamingContextValue | null): string {
  return render(
    g,
    false,
    naming,
    createElement(DemonRowList, {
      listId: 'browser',
      source: g.demons,
      ariaLabel: 'Demons',
      selectedMesh: null,
      revealIndex: null,
      revealNonce: 0,
      onHoverDemon: noop,
      onSelectDemon: noop,
    }),
  )
}

/** The inner HTML of each NAME gridcell, in row order. The pattern also pins the cell's own attributes: nothing is added to it. */
function nameCells(markup: string): string[] {
  return Array.from(markup.matchAll(/<div role="gridcell" data-col="name">(.*?)<\/div>/g), m => m[1] as string)
}

const textOf = (html: string): string => html.replace(/<[^>]*>/g, '')

/** The text of the first (truncating) span of a provider-rendered cell. */
function nameSpanText(cell: string): string {
  const m = /^<span class="truncate" title="([^"]*)"[^>]*>([^<]*)<\/span>/.exec(cell)
  expect(m, `cell ${cell}`).not.toBeNull()
  expect((m as RegExpExecArray)[1]).toBe((m as RegExpExecArray)[2])
  return (m as RegExpExecArray)[2] as string
}

const MARKER = `<span data-post-baseline="" data-name-overridden="" title="${NAMES_COPY.overriddenTitle}">*<span class="sr-only">${NAMES_COPY.overriddenHidden}</span></span>`

// ── the browser NAME cell ───────────────────────────────────────────────────

describe('DemonRowList NAME cell', () => {
  it('without a provider renders exactly the legacy text node: the base-10 canonical name, an empty cell elsewhere', () => {
    const at10 = nameCells(renderRows(g10, null))
    expect(at10).toHaveLength(45)
    for (let mesh = 0; mesh < 45; mesh++) expect(at10[mesh]).toBe(CCRU_NAMING_PRESET.names[mesh])
    const at28 = nameCells(renderRows(g28, null))
    expect(at28).toHaveLength(50)
    expect(at28.every(cell => cell === '')).toBe(true)
    expect(renderRows(g10, null)).not.toContain('data-name-overridden')
    expect(renderRows(g10, null)).not.toContain('unicode-bidi')
  })

  it('with a provider shows the resolver name for every row, in a truncating span with the full name in title', () => {
    const naming = generated(28)
    const value = valueOf(naming)
    const cells = nameCells(renderRows(g28, value))
    expect(cells).toHaveLength(50)
    for (let mesh = 0; mesh < cells.length; mesh++) {
      const [a, b] = g28.demons.netSpanOf(mesh)
      const name = value.resolver.nameOf(a, b)
      expect(nameSpanText(cells[mesh] as string)).toBe(name)
      expect(cells[mesh]).not.toContain('data-name-overridden')
    }
  })

  it('sets unicode-bidi plaintext on the rendered name (T-07-03d)', () => {
    const cells = nameCells(renderRows(g28, valueOf(generated(28))))
    expect(cells[0]).toMatch(/^<span [^>]*style="[^"]*unicode-bidi:plaintext/)
  })

  it('marks an overridden name with a post-baseline sibling span outside the truncating one, and no other row', () => {
    const naming = setOverride(generated(28), 0, 'Zed', null)
    const markup = renderRows(g28, valueOf(naming))
    const cells = nameCells(markup)
    expect(nameSpanText(cells[0] as string)).toBe('Zed')
    expect(cells[0]).toMatch(/<\/span>/)
    expect((cells[0] as string).endsWith(MARKER)).toBe(true)
    expect((cells[0] as string).indexOf(MARKER)).toBeGreaterThan((cells[0] as string).indexOf('</span>'))
    expect(textOf(cells[0] as string)).toBe(`Zed*${NAMES_COPY.overriddenHidden}`)
    for (let mesh = 1; mesh < cells.length; mesh++) expect(cells[mesh]).not.toContain('data-name-overridden')
    expect(markup.match(/data-name-overridden/g)).toHaveLength(1)
  })

  it('follows a rename: the same row shows the new text, never a remembered one (Pitfall 6)', () => {
    const before = nameCells(renderRows(g28, valueOf(generated(28))))
    const after = nameCells(renderRows(g28, valueOf(setOverride(generated(28), 3, 'Zed', null))))
    expect(nameSpanText(after[3] as string)).toBe('Zed')
    expect(nameSpanText(before[3] as string)).not.toBe('Zed')
    expect(after[2]).toBe(before[2])
  })

  it('shows the canonical CCRU names unmarked under the base-10 preset naming (NAM-04)', () => {
    const value = valueOf(ccru10())
    const cells = nameCells(renderRows(g10, value))
    expect(cells).toHaveLength(45)
    for (let mesh = 0; mesh < 45; mesh++) {
      expect(nameSpanText(cells[mesh] as string)).toBe(CCRU_NAMING_PRESET.names[mesh])
      expect(cells[mesh]).not.toContain('data-name-overridden')
      expect(cells[mesh]).not.toContain('*')
    }
  })

  it('shows generated names at base 10 once the naming is generated, not the canonical ones', () => {
    const value = valueOf(generated(10))
    const cells = nameCells(renderRows(g10, value))
    for (let mesh = 0; mesh < 45; mesh++) {
      const [a, b] = g10.demons.netSpanOf(mesh)
      expect(nameSpanText(cells[mesh] as string)).toBe(value.resolver.nameOf(a, b))
    }
    expect(cells.map(nameSpanText)).not.toEqual(Array.from({ length: 45 }, (_, mesh) => CCRU_NAMING_PRESET.names[mesh]))
  })

  it('does not throw and falls back to the legacy cell when the naming belongs to another base (a switch in flight)', () => {
    const cells = nameCells(renderRows(g28, valueOf(ccru10())))
    expect(cells).toHaveLength(50)
    expect(cells.every(cell => cell === '')).toBe(true)
  })

  it('wires the cell through the one gridcell line and a single useNaming call (source)', () => {
    const source = readFileSync(ROW_LIST_SOURCE, 'utf8')
    expect(source.match(/role="gridcell" data-col="name">/g)).toHaveLength(1)
    expect(source.match(/useNaming\(\)/g)).toHaveLength(1)
    expect(source).not.toMatch(/dangerouslySetInnerHTML/)
  })
})

// ── the matrix text ─────────────────────────────────────────────────────────

describe('DemonMatrix text', () => {
  const zoneLabel = (z: number): string => formatZoneLabel(z, 28, DEFAULT_LABEL_SCHEME)
  const d = g28.demons.ref(12, 3)
  const netSpan = netSpanLabel(d.a, d.b, zoneLabel)
  const subtype = SUBTYPE_LABEL[d.subtype]

  it('keeps today\'s A::B, MESH, Subtype text when there is no name', () => {
    expect(demonText(d, zoneLabel, null)).toBe(`${netSpan} ${MIDDLE_DOT} ${d.mesh} ${MIDDLE_DOT} ${subtype}`)
  })

  it('puts the name between the net-span and the mesh, exactly as matrixTooltip assembles it', () => {
    const text = demonText(d, zoneLabel, 'Zed')
    expect(text).toBe(`${netSpan} ${MIDDLE_DOT} Zed ${MIDDLE_DOT} ${d.mesh} ${MIDDLE_DOT} ${subtype}`)
    expect(text).toBe(matrixTooltip(netSpan, 'Zed', d.mesh, subtype))
  })

  it('keeps a name of exactly the tooltip limit whole and cuts a longer one to limit minus one graphemes plus an ellipsis', () => {
    const whole = 'a'.repeat(NAME_TOOLTIP_GRAPHEMES)
    expect(demonText(d, zoneLabel, whole)).toBe(matrixTooltip(netSpan, whole, d.mesh, subtype))
    const cutFrom40 = demonText(d, zoneLabel, 'b'.repeat(40))
    expect(cutFrom40).toBe(matrixTooltip(netSpan, 'b'.repeat(NAME_TOOLTIP_GRAPHEMES - 1) + ELLIPSIS, d.mesh, subtype))
    const cutFrom33 = demonText(d, zoneLabel, 'c'.repeat(NAME_TOOLTIP_GRAPHEMES + 1))
    expect(cutFrom33).toBe(matrixTooltip(netSpan, 'c'.repeat(NAME_TOOLTIP_GRAPHEMES - 1) + ELLIPSIS, d.mesh, subtype))
  })

  it('counts graphemes, not code units, so a cut never splits a letter from its marks (T-07-03d)', () => {
    const cluster = 'a' + String.fromCodePoint(0x323) + String.fromCodePoint(0x308)
    const clusters = splitGraphemes(cluster.repeat(40))
    expect(clusters).toHaveLength(40)
    const text = demonText(d, zoneLabel, cluster.repeat(40))
    const expectedName = clusters.slice(0, NAME_TOOLTIP_GRAPHEMES - 1).join('') + ELLIPSIS
    expect(text).toBe(matrixTooltip(netSpan, expectedName, d.mesh, subtype))
    expect(splitGraphemes(expectedName)).toHaveLength(NAME_TOOLTIP_GRAPHEMES)
  })

  function liveText(g: Numogram, naming: NamingContextValue | null, selectedMesh: number | null): string {
    const markup = render(g, false, naming, createElement(DemonMatrix, { selectedMesh, onSelectDemon: noop }))
    const m = /data-matrix-live="" aria-live="polite" class="sr-only">([^<]*)<\/div>/.exec(markup)
    expect(m).not.toBeNull()
    return (m as RegExpExecArray)[1] as string
  }

  it('the keyboard live text carries the resolver name inside a provider and none without one', () => {
    const value = valueOf(generated(28))
    const pinned = g28.demons.ref(12, 3)
    const name = value.resolver.nameOf(12, 3)
    expect(liveText(g28, value, pinned.mesh)).toBe(
      `${netSpanLabel(12, 3, zoneLabel)} ${MIDDLE_DOT} ${name} ${MIDDLE_DOT} ${pinned.mesh} ${MIDDLE_DOT} ${SUBTYPE_LABEL[pinned.subtype]}`,
    )
    expect(liveText(g28, null, pinned.mesh)).toBe(
      `${netSpanLabel(12, 3, zoneLabel)} ${MIDDLE_DOT} ${pinned.mesh} ${MIDDLE_DOT} ${SUBTYPE_LABEL[pinned.subtype]}`,
    )
  })

  it('the live text follows an override and shows the canonical name at base 10 (NAM-04)', () => {
    const renamed = valueOf(setOverride(generated(28), g28.demons.ref(12, 3).mesh, 'Zed', null))
    expect(liveText(g28, renamed, g28.demons.ref(12, 3).mesh)).toContain(`${MIDDLE_DOT} Zed ${MIDDLE_DOT}`)
    const ref10 = g10.demons.ref(1, 0)
    const canon = liveText(g10, valueOf(ccru10()), ref10.mesh)
    expect(canon).toContain(`${MIDDLE_DOT} ${CCRU_NAMING_PRESET.names[ref10.mesh]} ${MIDDLE_DOT}`)
  })

  it('hands the resolver name to both call sites, the hover tooltip and the live text (source: the tooltip needs a pointer)', () => {
    const source = readFileSync(MATRIX_SOURCE, 'utf8')
    expect(source.match(/\bdemonText\(/g)).toHaveLength(3) // the definition and the two call sites
    expect(source.match(/\bdemonText\(\w+, zoneLabel, nameOf\(\w+\)\)/g)).toHaveLength(2)
  })

  it('omits the name segment when the naming belongs to another base', () => {
    const text = liveText(g28, valueOf(ccru10()), g28.demons.ref(12, 3).mesh)
    expect(text).toBe(`${netSpanLabel(12, 3, zoneLabel)} ${MIDDLE_DOT} ${g28.demons.ref(12, 3).mesh} ${MIDDLE_DOT} ${SUBTYPE_LABEL[g28.demons.ref(12, 3).subtype]}`)
  })
})

// ── the Selection demon detail, the selected title and the pinned background ───

function bakedInfo(g: Numogram, a: number, b: number): HoverInfo & { type: 'demon' } {
  return { type: 'demon', demon: legacyDemon(g.demons.ref(a, b), g.base) }
}

/** The detail heading: the first GlitchText span (bold, uppercase). */
function headingOf(markup: string): string {
  const m = /<span class="font-bold uppercase[^"]*" style="[^"]*">([^<]*)<\/span>/.exec(markup)
  expect(m, markup).not.toBeNull()
  return (m as RegExpExecArray)[1] as string
}

describe('DemonInfo heading', () => {
  it('without a provider shows the name baked into the info (non-lore and lore branches)', () => {
    const info28 = bakedInfo(g28, 12, 3)
    expect(info28.demon.name).toBe('c::3')
    expect(headingOf(render(g28, true, null, createElement(DemonInfo, { data: info28 })))).toBe('c::3')
    const info10 = bakedInfo(g10, 9, 8)
    expect(headingOf(render(g10, true, null, createElement(DemonInfo, { data: info10 })))).toBe(info10.demon.name)
  })

  it('inside a provider shows the resolver name, not the baked one (non-lore branch, base 28)', () => {
    const value = valueOf(setOverride(generated(28), g28.demons.ref(12, 3).mesh, 'Zed', null))
    const heading = headingOf(render(g28, true, value, createElement(DemonInfo, { data: bakedInfo(g28, 12, 3) })))
    expect(heading).toBe('Zed')
    const plain = valueOf(generated(28))
    expect(headingOf(render(g28, true, plain, createElement(DemonInfo, { data: bakedInfo(g28, 12, 3) })))).toBe(plain.resolver.nameOf(12, 3))
  })

  it('inside a provider shows the resolver name in the lore branch too (base 10), and the canonical name under the preset', () => {
    const info = bakedInfo(g10, 9, 8)
    const gen = valueOf(generated(10))
    const genHeading = headingOf(render(g10, true, gen, createElement(DemonInfo, { data: info })))
    expect(genHeading).toBe(gen.resolver.nameOf(9, 8))
    expect(genHeading).not.toBe(info.demon.name)
    const ccru = valueOf(ccru10())
    expect(headingOf(render(g10, true, ccru, createElement(DemonInfo, { data: info })))).toBe(info.demon.name)
  })

  it('keeps the baked name when the naming belongs to another base', () => {
    const heading = headingOf(render(g28, true, valueOf(ccru10()), createElement(DemonInfo, { data: bakedInfo(g28, 12, 3) })))
    expect(heading).toBe('c::3')
  })

  it('InfoDisplay for a pinned demon passes through the same provider-aware detail', () => {
    const value = valueOf(setOverride(generated(28), g28.demons.ref(12, 3).mesh, 'Zed', null))
    const markup = render(
      g28,
      true,
      value,
      createElement(InfoDisplay, { hoverInfo: null, pinnedInfo: bakedInfo(g28, 12, 3) }),
    )
    expect(headingOf(markup)).toBe('Zed')
  })
})

describe('selectedInfoMeta title', () => {
  const ctx28 = viewCtx(g28, true)

  it('is the resolver name for a demon when a naming is given and the baked name when it is null', () => {
    const info = bakedInfo(g28, 12, 3)
    const value = valueOf(setOverride(generated(28), g28.demons.ref(12, 3).mesh, 'Zed', null))
    expect(selectedInfoMeta(info, ctx28, value).title).toBe('Zed')
    expect(selectedInfoMeta(info, ctx28, null).title).toBe('c::3')
    expect(selectedInfoMeta(info, ctx28, valueOf(ccru10())).title).toBe('c::3')
  })

  it('leaves every other kind of selected item unchanged', () => {
    const value = valueOf(generated(28))
    const zone: HoverInfo = { type: 'zone', zone: 4 }
    expect(selectedInfoMeta(zone, ctx28, value)).toEqual(selectedInfoMeta(zone, ctx28, null))
    expect(selectedInfoMeta(zone, ctx28, null).title).toBe(`Zone ${ctx28.zoneLabel(4)}`)
  })

  it('is called with the naming read through useNaming (source)', () => {
    const source = readFileSync(INFO_SOURCE, 'utf8')
    expect(source.match(/selectedInfoMeta\(si, ctx, naming\)/g)).toHaveLength(1)
  })
})

describe('PinnedBackground demon line', () => {
  function pinnedMarkup(naming: NamingContextValue | null): string {
    return render(
      g28,
      true,
      naming,
      createElement(PinnedBackground, { pinnedInfo: bakedInfo(g28, 12, 3), hoverInfo: null }),
    )
  }
  const lineOf = (markup: string): string => {
    const m = /<div class="text-2xl tracking-\[0\.2em\] uppercase italic text-gray-400">([^<]*)<\/div>/.exec(markup)
    expect(m, markup).not.toBeNull()
    return (m as RegExpExecArray)[1] as string
  }

  it('shows the baked name without a provider and the resolved name inside one', () => {
    expect(lineOf(pinnedMarkup(null))).toBe('c::3')
    const value = valueOf(setOverride(generated(28), g28.demons.ref(12, 3).mesh, 'Zed', null))
    expect(lineOf(pinnedMarkup(value))).toBe('Zed')
    const plain = valueOf(generated(28))
    expect(lineOf(pinnedMarkup(plain))).toBe(plain.resolver.nameOf(12, 3))
  })
})

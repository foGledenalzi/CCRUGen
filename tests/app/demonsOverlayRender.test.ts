// Server-render smoke for the D-01 demons overlay and its shared primitives (DEM-01..DEM-05, T-05-30..T-05-32):
// CyberButton's new tab semantics render byte-identical default/active markup and the documented tab attributes;
// DemonInfo (now exported) works without a view model (base 666) and shows MESH/TYPE everywhere; the DemonsOverlay
// shell composes Browser/Focus/Matrix with a detail pane and modal keyboard isolation. No JSX (plain node test
// file), matching tests/app/demonRowListRender.test.ts's Provider helper pattern.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram } from '../../engine/index'
import { buildNumogramView, summarize } from '../../app/lib/numogramView'
import type { NumogramView } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { SVG_RICH_MAX_N, ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { CyberButton } from '../../app/components/ui/CyberButton'
import { DemonInfo } from '../../app/components/info/InfoDisplay'
import { legacyDemon } from '../../app/lib/demonBrowser'
import type { HoverInfo } from '../../app/data/types'
import { BASE10 } from '../../app/presets/base10/numogram'
import { DemonsOverlay, type DemonsOverlayProps } from '../../app/components/demons/DemonsOverlay'
import { zoneFocus } from '../../app/lib/demonState'

const noop = () => {}

function buildCtx(g: Numogram, view: NumogramView | null = null): NumogramViewContextValue {
  const base = g.base
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
  }
}

function renderWithView(g: Numogram, view: NumogramView | null, el: React.ReactElement): string {
  const ctx = buildCtx(g, view)
  return renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: ctx }, el))
}

// ── Task 1: CyberButton tab semantics ───────────────────────────────────────

describe('CyberButton: markup identity (T-05-31)', () => {
  // Pinned verbatim from the unmodified component (captured before this plan's edit) — every existing call site
  // (none of which pass role/selected/id/controls) must still render exactly this string.
  const DEFAULT_MARKUP =
    '<button type="button" class="relative uppercase transition-all px-2.5 py-2 text-[11px] tracking-[0.12em] bg-transparent hover:bg-white/[0.03]  ">A</button>'
  const ACTIVE_MARKUP =
    '<button type="button" class="relative uppercase transition-all px-2.5 py-2 text-[11px] tracking-[0.12em] bg-[#10ff50]/[0.08]  " style="box-shadow:inset 0 -1px 0 rgba(16,255,80,0.4)"><span class="pointer-events-none absolute right-1 top-0.5 text-[7px] leading-none" style="color:#10ff50">Z</span>A</button>'

  it('a default CyberButton renders byte-identical markup to before this plan', () => {
    const markup = renderToStaticMarkup(createElement(CyberButton, { children: 'A' }))
    expect(markup).toBe(DEFAULT_MARKUP)
  })

  it('an active CyberButton with a shortcut renders byte-identical markup to before this plan', () => {
    const markup = renderToStaticMarkup(createElement(CyberButton, { active: true, shortcut: 'z', children: 'A' }))
    expect(markup).toBe(ACTIVE_MARKUP)
  })
})

describe('CyberButton: new tab semantics', () => {
  it('role=tab, selected=true: role, aria-selected=true, id, aria-controls, tabindex=0', () => {
    const markup = renderToStaticMarkup(
      createElement(CyberButton, { role: 'tab', selected: true, id: 'x', controls: 'y', children: 'A' }),
    )
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('id="x"')
    expect(markup).toContain('aria-controls="y"')
    expect(markup).toContain('tabindex="0"')
  })

  it('role=tab, selected=false: tabindex=-1', () => {
    const markup = renderToStaticMarkup(
      createElement(CyberButton, { role: 'tab', selected: false, id: 'x', controls: 'y', children: 'A' }),
    )
    expect(markup).toContain('aria-selected="false"')
    expect(markup).toContain('tabindex="-1"')
  })
})

// ── Task 1: DemonInfo without a view (T-05-32) ──────────────────────────────

describe('DemonInfo: works at any base, with or without a view', () => {
  it('base 666 (view null): 15::3, MESH, 108, TYPE, Cross-Torque chrono', () => {
    const g = createNumogram(666)
    const demon = legacyDemon(g.demons.ref(15, 3), 666)
    const info: HoverInfo & { type: 'demon' } = { type: 'demon', demon }
    const markup = renderWithView(g, null, createElement(DemonInfo, { data: info }))
    expect(markup.length).toBeGreaterThan(0)
    expect(markup).toContain('15::3')
    expect(markup).toContain('MESH')
    expect(markup).toContain('108')
    expect(markup).toContain('TYPE')
    expect(markup).toContain('Cross-Torque chrono')
  })

  it('base 10 (view = buildNumogramView(BASE10)): Lurgo, MESH, >0<, Plex amphi', () => {
    const demon = legacyDemon(BASE10.demons.at(0), 10)
    const info: HoverInfo & { type: 'demon' } = { type: 'demon', demon }
    const view = buildNumogramView(BASE10)
    const markup = renderWithView(BASE10, view, createElement(DemonInfo, { data: info }))
    expect(markup).toContain('Lurgo')
    expect(markup).toContain('MESH')
    expect(markup).toContain('>0<')
    expect(markup).toContain('Plex amphi')
  })

  it('base 28 (view = buildNumogramView(g28)): c::3, 69, Cyclic chrono', () => {
    const g = createNumogram(28)
    const demon = legacyDemon(g.demons.ref(12, 3), 28)
    const info: HoverInfo & { type: 'demon' } = { type: 'demon', demon }
    const view = buildNumogramView(g)
    const markup = renderWithView(g, view, createElement(DemonInfo, { data: info }))
    expect(markup).toContain('c::3')
    expect(markup).toContain('69')
    expect(markup).toContain('Cyclic chrono')
  })
})

// ── Task 2: DemonsOverlay shell ─────────────────────────────────────────────

function renderOverlay(g: Numogram, overrides: Partial<DemonsOverlayProps> = {}): string {
  const props: DemonsOverlayProps = {
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
    ...overrides,
  }
  return renderWithView(g, null, createElement(DemonsOverlay, props))
}

describe('DemonsOverlay: base 28, tab browser, filter null', () => {
  const g = createNumogram(28)

  it('renders the overlay shell, total, tabs, browser panel and empty detail hint', () => {
    const markup = renderOverlay(g)
    expect(markup).toContain('data-demons-overlay')
    expect(markup).toContain('data-post-baseline')
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-label="Demons"')
    expect(markup).toContain('Demons')
    expect(markup).toContain('Total')
    expect(markup).toContain('data-demons-total="378"')
    expect(markup).toContain('378')

    const tabMatches = Array.from(markup.matchAll(/role="tab"[^>]*/g))
    expect(tabMatches.length).toBe(3)
    const selectedTrueCount = (markup.match(/role="tab"[^>]*aria-selected="true"/g) ?? []).length
    expect(selectedTrueCount).toBe(1)
    expect(markup).toContain('id="demons-tab-browser"')
    const browserTabTag = markup.match(/<button[^>]*id="demons-tab-browser"[^>]*>/)?.[0] ?? ''
    expect(browserTabTag).toContain('aria-selected="true"')

    expect(markup).toContain('role="tabpanel"')
    expect(markup).toContain('id="demons-panel-browser"')
    expect(markup).toContain('data-facet="all"')
    expect(markup).toContain('data-demon-detail')
    expect(markup).toContain('Hover or click a demon to inspect it.')
    expect(markup).toContain('close')
    expect(markup).toContain('aria-label="Close demons"')
  })
})

describe('DemonsOverlay: tab matrix', () => {
  const g = createNumogram(28)

  it('renders data-demon-matrix and not data-demon-browser', () => {
    const markup = renderOverlay(g, { tab: 'matrix' })
    expect(markup).toContain('data-demon-matrix')
    expect(markup).not.toContain('data-demon-browser')
  })
})

describe('DemonsOverlay: tab focus', () => {
  const g = createNumogram(28)

  it('with a zone focus renders data-demon-focus-view and data-focus-chords', () => {
    const markup = renderOverlay(g, { tab: 'focus', focus: zoneFocus(12) })
    expect(markup).toContain('data-demon-focus-view')
    expect(markup).toContain('data-focus-chords')
  })
})

describe('DemonsOverlay: base 666 (view null), pinned demon', () => {
  it('the detail pane shows 15::3 and Cross-Torque chrono; total is 221445', () => {
    const g = createNumogram(666)
    const demon = legacyDemon(g.demons.at(108), 666)
    const pinnedInfo: HoverInfo = { type: 'demon', demon }
    const markup = renderOverlay(g, { pinnedInfo })
    expect(markup).toContain('15::3')
    expect(markup).toContain('Cross-Torque chrono')
    expect(markup).toContain('data-demons-total="221445"')
  })
})

describe('DemonsOverlay: base 10, pinned Lurgo', () => {
  it('the detail pane contains Lurgo', () => {
    const demon = legacyDemon(BASE10.demons.at(0), 10)
    const pinnedInfo: HoverInfo = { type: 'demon', demon }
    const markup = renderOverlay(BASE10, { pinnedInfo })
    expect(markup).toContain('Lurgo')
  })
})

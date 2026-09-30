// Server-render smoke for DemonBrowser (DEM-02, D-02, D-05): facet chips, search field, sortable virtualized grid
// and empty/status states render correctly at any base. No JSX (plain node test file), matching
// tests/app/demonRowListRender.test.ts's Provider helper pattern.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram } from '../../engine/index'
import { summarize } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { SVG_RICH_MAX_N, ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { DemonBrowser, type DemonBrowserProps } from '../../app/components/demons/DemonBrowser'
import type { DemonFilter } from '../../app/lib/demonBrowser'

const noop = () => {}

function buildCtx(g: Numogram): NumogramViewContextValue {
  const base = g.base
  return {
    base,
    g,
    summary: summarize(g),
    view: null,
    zoneLabels: null,
    labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: 'off',
  }
}

function renderBrowser(g: Numogram, filter: DemonFilter | null, overrides: Partial<DemonBrowserProps> = {}): string {
  const ctx = buildCtx(g)
  const props: DemonBrowserProps = {
    filter,
    onFilterChange: noop,
    selectedMesh: null,
    onHoverDemon: noop,
    onSelectDemon: noop,
    ...overrides,
  }
  return renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: ctx }, createElement(DemonBrowser, props)),
  )
}

describe('DemonBrowser: server render (base 28, filter chrono)', () => {
  it('renders facet chips, the search field and the virtualized grid', () => {
    const g = createNumogram(28)
    const markup = renderBrowser(g, 'chrono')
    expect(markup).toContain('data-demon-browser')
    expect(markup).toContain('data-facet="all"')
    expect(markup).toContain('data-count="378"')
    expect(markup).toContain('data-facet="chrono"')
    expect(markup).toContain('data-count="276"')
    const chronoChip = markup.match(/data-facet="chrono"[^>]*aria-pressed="([a-z]+)"/)
    expect(chronoChip?.[1]).toBe('true')
    expect(markup).toContain('data-facet="cross-torque-chrono"')
    expect(markup).toContain('data-count="108"')
    expect(markup).toContain('data-facet="syzygetic-chrono"')
    expect(markup).toContain('data-count="12"')
    expect(markup).toContain('aria-label="Search demons"')
    // renderToStaticMarkup writes the JSX prop name literally (maxLength); only an actual browser's HTML
    // parser lowercases it to maxlength (the DOM-contract form checked by e2e specs against a live page).
    expect(markup).toContain('maxLength="64"')
    expect(markup).toContain('placeholder="mesh number or a::b"')
    expect(markup).toContain('role="grid"')
    expect(markup).toContain('aria-rowcount="277"')
  })
})

describe('DemonBrowser: server render (base 666, filter null)', () => {
  it('shows the All facet chip with the full closed-form count and no subtype group', () => {
    const g = createNumogram(666)
    const markup = renderBrowser(g, null)
    expect(markup).toContain('data-facet="all"')
    expect(markup).toContain('data-count="221445"')
    expect(markup).toContain('221,445')
    expect(markup).not.toMatch(/aria-label="[^"]+ subtypes"/)
  })
})

describe('DemonBrowser: server render (base 666, filter warp-amphi)', () => {
  it('shows the empty-filter state with the exact UI-SPEC copy and no grid', () => {
    const g = createNumogram(666)
    const markup = renderBrowser(g, 'warp-amphi')
    expect(markup).toContain('data-demon-empty')
    expect(markup).toContain('No demons match this filter')
    expect(markup).toContain('Clear the Warp amphi filter to see all 221,445 demons.')
    expect(markup).not.toContain('role="grid"')
  })
})

describe('DemonBrowser: server render (base 10, filter chrono)', () => {
  it('disables the cross-torque-chrono chip (single Torque cycle at base 10)', () => {
    const g = createNumogram(10)
    const markup = renderBrowser(g, 'chrono')
    const match = markup.match(/data-facet="cross-torque-chrono"[^>]*aria-disabled="true"/)
    expect(match).not.toBeNull()
  })
})

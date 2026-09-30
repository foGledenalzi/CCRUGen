// Server-render smoke for DemonRowList (DEM-02, D-02, T-05-17, T-05-18): the fixed four-column grid shape renders
// at any base with only the visible window materialized, sort headers behave per the DOM contract, and a source
// above BROWSER_WINDOW_ROWS shows a pager. No JSX (plain node test file), matching tests/app/projectionRender.test.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram } from '../../engine/index'
import { summarize } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { SVG_RICH_MAX_N, ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { DemonRowList, type DemonRowListProps } from '../../app/components/demons/DemonRowList'
import type { DemonRowSource } from '../../app/lib/demonBrowser'

const noop = () => {}
const EN_DASH = String.fromCodePoint(0x2013)

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

function renderRowList(g: Numogram, source: DemonRowSource, overrides: Partial<DemonRowListProps> = {}): string {
  const ctx = buildCtx(g)
  const props: DemonRowListProps = {
    listId: 'browser',
    source,
    ariaLabel: 'Demons',
    selectedMesh: null,
    revealIndex: null,
    revealNonce: 0,
    onHoverDemon: noop,
    onSelectDemon: noop,
    ...overrides,
  }
  return renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: ctx }, createElement(DemonRowList, props)),
  )
}

describe('DemonRowList: server render smoke (base 28, 378 demons)', () => {
  const g = createNumogram(28)

  it('renders the grid shell: role=grid, aria-rowcount, aria-colcount, data-demon-list, the rows spacer', () => {
    const markup = renderRowList(g, g.demons, { listId: 'browser' })
    expect(markup).toContain('role="grid"')
    expect(markup).toContain('aria-rowcount="379"')
    expect(markup).toContain('aria-colcount="4"')
    expect(markup).toContain('data-demon-list="browser"')
    expect(markup).toContain('data-demon-rows-spacer')
  })

  it('renders the header texts A::B, MESH, TYPE, NAME in that order', () => {
    const markup = renderRowList(g, g.demons)
    const abIndex = markup.indexOf('A::B')
    const meshIndex = markup.indexOf('MESH')
    const typeIndex = markup.indexOf('TYPE')
    const nameIndex = markup.indexOf('NAME')
    expect(abIndex).toBeGreaterThanOrEqual(0)
    expect(meshIndex).toBeGreaterThan(abIndex)
    expect(typeIndex).toBeGreaterThan(meshIndex)
    expect(nameIndex).toBeGreaterThan(typeIndex)
  })

  it('never materializes more than 40 data-demon-row occurrences (no full materialization on the server)', () => {
    const markup = renderRowList(g, g.demons)
    const rows = markup.match(/data-demon-row=/g) ?? []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(40)
  })
})

describe('DemonRowList: sort headers', () => {
  const g = createNumogram(28)

  it('with sort given: data-sort-col buttons exist and aria-sort="ascending" is on the MESH header', () => {
    const markup = renderRowList(g, g.demons, { sort: { key: 'mesh', direction: 'asc' } })
    expect(markup).toContain('data-sort-col="ab"')
    expect(markup).toContain('data-sort-col="mesh"')
    expect(markup).toContain('data-sort-col="type"')
    const meshHeader = markup.match(/data-col="mesh"[^>]*aria-sort="([a-z]+)"/)
    expect(meshHeader?.[1]).toBe('ascending')
  })

  it('without sort, no data-sort-col appears anywhere', () => {
    const markup = renderRowList(g, g.demons)
    expect(markup).not.toContain('data-sort-col')
  })
})

describe('DemonRowList: window pager', () => {
  it('base 1024 (523,776 rows): shows the pager with "Rows 1–250,000 of 523,776"', () => {
    const g = createNumogram(1024)
    expect(g.demons.count).toBe(523776)
    const markup = renderRowList(g, g.demons)
    expect(markup).toContain('data-demon-pager')
    const expectedText = `Rows ${(1).toLocaleString('en-US')}${EN_DASH}${(250000).toLocaleString('en-US')} of ${(523776).toLocaleString('en-US')}`
    expect(markup).toContain(expectedText)
  })

  it('base 666 (221,445 rows, one window): no pager', () => {
    const g = createNumogram(666)
    expect(g.demons.count).toBe(221445)
    const markup = renderRowList(g, g.demons)
    expect(markup).not.toContain('data-demon-pager')
  })
})

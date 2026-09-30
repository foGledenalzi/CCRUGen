// Server-render smoke for DemonMatrix (DEM-04, D-06): the container/canvas/legend contract renders at any base,
// including base 666 where `view` is null in the context (this component reads only `g`), and no hover-only
// surface (the tooltip) appears without a real pointer event. No JSX (plain node test file), matching
// tests/app/demonRowListRender.test.ts / tests/app/projectionRender.test.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram } from '../../engine/index'
import { summarize } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { SVG_RICH_MAX_N, ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { DemonMatrix, type DemonMatrixProps } from '../../app/components/demons/DemonMatrix'

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

function renderMatrix(g: Numogram, overrides: Partial<DemonMatrixProps> = {}): string {
  const ctx = buildCtx(g)
  const props: DemonMatrixProps = {
    selectedMesh: null,
    onSelectDemon: noop,
    ...overrides,
  }
  return renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: ctx }, createElement(DemonMatrix, props)),
  )
}

describe('DemonMatrix: server render smoke (base 28)', () => {
  const g = createNumogram(28)

  it('renders the container contract: data-demon-matrix, role, focus key, aria-label, raster state, live region', () => {
    const markup = renderMatrix(g)
    expect(markup).toContain('data-demon-matrix=""')
    expect(markup).toContain('role="application"')
    expect(markup).toContain('data-focus-key="demon-matrix"')
    expect(markup).toContain(
      'aria-label="Demon matrix: arrow keys move the cursor, Enter pins, plus and minus zoom, 0 fits"',
    )
    expect(markup).toContain('data-raster-state="drawing"')
    expect(markup).toContain('data-matrix-live')
  })

  it('renders the legend with Chrono, Amphi, Xeno, Syzygetic in that order', () => {
    const markup = renderMatrix(g)
    expect(markup).toContain('data-matrix-legend')
    const chronoIndex = markup.indexOf('Chrono')
    const amphiIndex = markup.indexOf('Amphi')
    const xenoIndex = markup.indexOf('Xeno')
    const syzygeticIndex = markup.indexOf('Syzygetic')
    expect(chronoIndex).toBeGreaterThanOrEqual(0)
    expect(amphiIndex).toBeGreaterThan(chronoIndex)
    expect(xenoIndex).toBeGreaterThan(amphiIndex)
    expect(syzygeticIndex).toBeGreaterThan(xenoIndex)
  })

  it('never contains a tooltip on the server (no hover without a real pointer event)', () => {
    const markup = renderMatrix(g)
    expect(markup).not.toContain('data-matrix-tooltip')
  })
})

describe('DemonMatrix: server render smoke (base 666, view is null in the context)', () => {
  const g = createNumogram(666)

  it('renders the same container contract without throwing', () => {
    expect(() => renderMatrix(g)).not.toThrow()
    const markup = renderMatrix(g)
    expect(markup).toContain('data-demon-matrix=""')
    expect(markup).toContain('role="application"')
    expect(markup).toContain('data-focus-key="demon-matrix"')
    expect(markup).toContain('data-raster-state="drawing"')
    expect(markup).toContain('data-matrix-legend')
    expect(markup).not.toContain('data-matrix-tooltip')
  })

  it('renders a pinned-demon cursor start without throwing when selectedMesh is a real mesh at this base', () => {
    const someMesh = g.demons.count - 1
    expect(() => renderMatrix(g, { selectedMesh: someMesh })).not.toThrow()
  })
})

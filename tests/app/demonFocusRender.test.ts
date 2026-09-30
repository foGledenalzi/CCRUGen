// Server-render smoke for DemonFocusView (DEM-03, D-03, T-05-28, T-05-29): the Focus tab draws and lists a zone's
// demons or one demon at any base, including bases with no diagram (base 666), with chord drawing bounded at
// FOCUS_CHORD_DRAW_MAX. No JSX (plain node test file), matching tests/app/demonRowListRender.test.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram } from '../../engine/index'
import { summarize } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../app/lib/labelScheme'
import { SVG_RICH_MAX_N, ALL_CHORDS_MAX_N } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { DemonFocusView, type DemonFocusViewProps } from '../../app/components/demons/DemonFocusView'
import { demonFocusOf, focusDrawPlan, zoneFocus } from '../../app/lib/demonState'

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

function renderFocusView(g: Numogram, overrides: Partial<DemonFocusViewProps> = {}): string {
  const ctx = buildCtx(g)
  const props: DemonFocusViewProps = {
    focus: null,
    onFocusChange: noop,
    selectedMesh: null,
    showDiagram: false,
    onHoverDemon: noop,
    onPickDemon: noop,
    ...overrides,
  }
  return renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: ctx }, createElement(DemonFocusView, props)),
  )
}

describe('DemonFocusView: base 666 (no diagram), zone focus', () => {
  const g = createNumogram(666)

  it('contains data-demon-focus-view, the chord canvas, the summary, clear focus and the demon list', () => {
    const markup = renderFocusView(g, { focus: zoneFocus(12) })
    expect(markup).toContain('data-demon-focus-view')
    expect(markup).toContain('data-focus-chords')
    expect(markup).toContain('data-chord-total="665"')
    expect(markup).toContain('data-chord-count="665"')
    expect(markup).toContain('data-chord-stride="1"')
    expect(markup).toContain('data-focus-summary')
    expect(markup).toContain('Zone 12')
    expect(markup).toContain('665 demons')
    expect(markup).toContain('data-clear-focus')
    expect(markup).toContain('clear focus')
    expect(markup).toContain('role="grid"')
    expect(markup).toContain('data-demon-list="focus"')
    expect(markup).toContain('aria-rowcount="666"')
  })
})

describe('DemonFocusView: base 666, no focus', () => {
  const g = createNumogram(666)

  it('shows the pick-a-zone message and the zone input, no canvas or list', () => {
    const markup = renderFocusView(g)
    expect(markup).toContain('Pick a zone to draw its 665 demons.')
    expect(markup).toContain('aria-label="Focus zone"')
    expect(markup).not.toContain('data-focus-chords')
    expect(markup).not.toContain('data-demon-list')
  })

  it('showDiagram true adds the toolbar hint; false omits it', () => {
    const withDiagram = renderFocusView(g, { showDiagram: true })
    const withoutDiagram = renderFocusView(g, { showDiagram: false })
    expect(withDiagram).toContain('Or turn on Demon focus in the diagram toolbar (bottom right) and click a zone.')
    expect(withoutDiagram).not.toContain('Or turn on Demon focus in the diagram toolbar (bottom right) and click a zone.')
  })
})

describe('DemonFocusView: base 28, demon focus', () => {
  const g = createNumogram(28)

  it('12::3 -> data-chord-count="1", summary "c::3 · mesh 69 · Cyclic chrono", aria-rowcount="2"', () => {
    const markup = renderFocusView(g, { focus: demonFocusOf({ a: 12, b: 3 }) })
    expect(markup).toContain('data-chord-count="1"')
    expect(markup).toContain(`c::3 ${String.fromCodePoint(0xb7)} mesh 69 ${String.fromCodePoint(0xb7)} Cyclic chrono`)
    expect(markup).toContain('aria-rowcount="2"')
  })
})

describe('DemonFocusView: base 1,048,576, bounded chord draw', () => {
  const g = createNumogram(1048576)

  it('zone focus 0: stride matches focusDrawPlan, chord count <= 4096, summary mentions striding', () => {
    const plan = focusDrawPlan(1048576, zoneFocus(0))
    expect(plan.stride).toBeGreaterThan(1)
    const markup = renderFocusView(g, { focus: zoneFocus(0) })
    expect(markup).toContain(`data-chord-stride="${plan.stride}"`)
    const countMatch = markup.match(/data-chord-count="(\d+)"/)
    expect(countMatch).not.toBeNull()
    expect(Number(countMatch?.[1])).toBeLessThanOrEqual(4096)
    expect(markup).toContain('Drawing 1 in')
  })
})

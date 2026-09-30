// Server-render smoke for the base-generic Projection (MIG-02, T-04-31): base 10 renders through the same props
// NumogramClient passes (frozen layout tables + base10 route geometry), and every even base 2..40 renders through
// a procedural ring layout with neither 'NaN' nor 'undefined' anywhere in the markup. No JSX (plain node test file).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { Projection } from '../../app/components/projection/Projection'
import { ViewControls } from '../../app/components/numogram/ViewControls'
import { buildNumogramView } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, zoneLabelsFor } from '../../app/lib/labelScheme'
import { gateMode } from '../../app/lib/tierBounds'
import { layoutTarget } from '../../app/lib/viewLayouts'
import { engineRenderData } from '../../app/lib/renderData'
import { BASE10 } from '../../app/presets/base10/numogram'
import { GATE_LIST } from '../../app/presets/base10/gates'
import { CURRENTS } from '../../app/presets/base10/currents'
import { SYZYGIES } from '../../app/presets/base10/syzygies'
import { CENTER, DRAW_ORDER, FRAME_WIDTH, LABEL_SIZE, NODE_RADIUS, REGION_LABELS } from '../../app/presets/base10/layout-tables'
import { P_ORIGINAL } from '../../app/presets/base10/layouts'
import { base10CurrentRender, base10GateRender } from '../../app/presets/base10/routes'
import { demonFocusOf, focusChordList, zoneFocus } from '../../app/lib/demonState'
import type { Layer } from '../../app/data/types'

const noop = () => {}

describe('Projection: base 10 original renders through the same props NumogramClient passes', () => {
  it('viewBox 0 0 800 940, 10 zone groups, WARP and PLEX region labels', () => {
    const view = buildNumogramView(BASE10)
    const zoneLabels = zoneLabelsFor(10, DEFAULT_LABEL_SCHEME)
    const zoneRadius = () => NODE_RADIUS
    const routeInput = {
      layout: 'original' as const,
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      g: BASE10,
      gates: GATE_LIST,
      currents: CURRENTS,
      syzygies: SYZYGIES,
      zoneRadius,
    }
    const gateRenderData = base10GateRender(routeInput)
    const currentRenderData = base10CurrentRender(routeInput, {})
    const layers = new Set<Layer>(['syzygies', 'currents', 'gates'])

    const markup = renderToStaticMarkup(createElement(Projection, {
      view,
      layoutId: 'original',
      routingStyle: 'default',
      presetRouting: true,
      width: FRAME_WIDTH,
      nodeRadius: NODE_RADIUS,
      labelSize: LABEL_SIZE,
      strokeScale: 1,
      regionLabels: REGION_LABELS.original,
      zoneLabels,
      labelsOn: true,
      gateMode: 'on',
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      svgHeight: 940,
      layers,
      hlZones: new Set<number>(),
      selZones: new Set<number>(),
      anyFocus: false,
      tcActive: false,
      showOrbits: false,
      planetaryPos: {},
      zoneOrder: [...DRAW_ORDER.original],
      zoneStates: null,
      gateRenderData,
      currentRenderData,
      gateCalcFocusName: null,
      labelVisibility: { numbers: true, xenotation: false, planets: true },
      particlesOn: false,
      reducedMotion: false,
      onHoverInfo: noop,
      onPinInfo: noop,
      onZoneNodeClick: noop,
    }))

    expect(markup).toContain('viewBox="0 0 800 940"')
    expect((markup.match(/data-zone=/g) ?? []).length).toBe(10)
    expect(markup).toContain('WARP')
    expect(markup).toContain('PLEX')
  })
})

describe('Projection: every even base 2..40 renders through a procedural ring layout', () => {
  for (let n = 2; n <= 40; n += 2) {
    it(`base ${n}: n zone groups, n gate groups, no NaN or undefined`, () => {
      const g = createNumogram(n)
      const view = buildNumogramView(g)
      const target = layoutTarget(g, 'ring', 'shelf', {})
      if (target.layout === null) throw new Error(`expected a procedural layout for base ${n}`)
      const rd = engineRenderData(view, target.layout)
      const zoneLabels = zoneLabelsFor(n, DEFAULT_LABEL_SCHEME)
      const mode = gateMode(n)
      const layers = new Set<Layer>(['syzygies', 'currents', 'gates', 'pandemonium'])

      const markup = renderToStaticMarkup(createElement(Projection, {
        view,
        layoutId: 'ring',
        routingStyle: target.routingStyle,
        presetRouting: false,
        width: target.width,
        nodeRadius: target.nodeRadius,
        labelSize: target.labelSize,
        strokeScale: target.strokeScale,
        regionLabels: target.regionLabels,
        zoneLabels,
        labelsOn: true,
        gateMode: mode,
        pos: target.pos,
        ctr: target.ctr,
        svgHeight: target.height,
        layers,
        hlZones: new Set<number>(),
        selZones: new Set<number>(),
        anyFocus: false,
        tcActive: false,
        showOrbits: false,
        planetaryPos: {},
        zoneOrder: target.drawOrder ? [...target.drawOrder] : [],
        zoneStates: null,
        gateRenderData: rd.gates,
        currentRenderData: rd.currents,
        gateCalcFocusName: null,
        labelVisibility: { numbers: true, xenotation: false, planets: true },
        particlesOn: true,
        reducedMotion: false,
        onHoverInfo: noop,
        onPinInfo: noop,
        onZoneNodeClick: noop,
      }))

      expect(markup).not.toContain('NaN')
      expect(markup).not.toContain('undefined')
      expect((markup.match(/data-zone=/g) ?? []).length).toBe(n)
      expect((markup.match(/data-gate=/g) ?? []).length).toBe(n)
    })
  }
})

// DEM-03, D-03, T-05-27: the optional focus-chord layer must add no DOM at all when unset, so the frozen base-10
// DOM goldens and behaviour baseline stay byte-identical, and must draw exactly the given chords when set.
describe('Projection: focus-chord layer (DEM-03, D-03)', () => {
  function base10Props() {
    const view = buildNumogramView(BASE10)
    const zoneLabels = zoneLabelsFor(10, DEFAULT_LABEL_SCHEME)
    const zoneRadius = () => NODE_RADIUS
    const routeInput = {
      layout: 'original' as const,
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      g: BASE10,
      gates: GATE_LIST,
      currents: CURRENTS,
      syzygies: SYZYGIES,
      zoneRadius,
    }
    const gateRenderData = base10GateRender(routeInput)
    const currentRenderData = base10CurrentRender(routeInput, {})
    const layers = new Set<Layer>(['syzygies', 'currents', 'gates'])
    return {
      view,
      layoutId: 'original' as const,
      routingStyle: 'default' as const,
      presetRouting: true,
      width: FRAME_WIDTH,
      nodeRadius: NODE_RADIUS,
      labelSize: LABEL_SIZE,
      strokeScale: 1,
      regionLabels: REGION_LABELS.original,
      zoneLabels,
      labelsOn: true,
      gateMode: 'on' as const,
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      svgHeight: 940,
      layers,
      hlZones: new Set<number>(),
      selZones: new Set<number>(),
      anyFocus: false,
      tcActive: false,
      showOrbits: false,
      planetaryPos: {},
      zoneOrder: [...DRAW_ORDER.original],
      zoneStates: null,
      gateRenderData,
      currentRenderData,
      gateCalcFocusName: null,
      labelVisibility: { numbers: true, xenotation: false, planets: true },
      particlesOn: false,
      reducedMotion: false,
      onHoverInfo: noop,
      onPinInfo: noop,
      onZoneNodeClick: noop,
    }
  }

  it('base 10 original: markup with focusChords: null equals the markup without it, no data-demon-focus', () => {
    const props = base10Props()
    const without = renderToStaticMarkup(createElement(Projection, props))
    const withNull = renderToStaticMarkup(createElement(Projection, { ...props, focusChords: null }))
    expect(withNull).toBe(without)
    expect(without).not.toContain('data-demon-focus')
  })

  function base28RingProps(focusChords?: ReturnType<typeof focusChordList>) {
    const g = createNumogram(28)
    const view = buildNumogramView(g)
    const target = layoutTarget(g, 'ring', 'shelf', {})
    if (target.layout === null) throw new Error('expected a procedural layout for base 28')
    const rd = engineRenderData(view, target.layout)
    const zoneLabels = zoneLabelsFor(28, DEFAULT_LABEL_SCHEME)
    const mode = gateMode(28)
    const layers = new Set<Layer>(['syzygies', 'currents', 'gates'])
    return {
      g,
      props: {
        view,
        layoutId: 'ring' as const,
        routingStyle: target.routingStyle,
        presetRouting: false,
        width: target.width,
        nodeRadius: target.nodeRadius,
        labelSize: target.labelSize,
        strokeScale: target.strokeScale,
        regionLabels: target.regionLabels,
        zoneLabels,
        labelsOn: true,
        gateMode: mode,
        pos: target.pos,
        ctr: target.ctr,
        svgHeight: target.height,
        layers,
        hlZones: new Set<number>(),
        selZones: new Set<number>(),
        anyFocus: false,
        tcActive: false,
        showOrbits: false,
        planetaryPos: {},
        zoneOrder: target.drawOrder ? [...target.drawOrder] : [],
        zoneStates: null,
        gateRenderData: rd.gates,
        currentRenderData: rd.currents,
        gateCalcFocusName: null,
        labelVisibility: { numbers: true, xenotation: false, planets: true },
        particlesOn: false,
        reducedMotion: false,
        focusChords,
        onHoverInfo: noop,
        onPinInfo: noop,
        onZoneNodeClick: noop,
      },
    }
  }

  it('base 28 ring, zone focus 12: exactly 27 chords and one data-demon-focus-layer', () => {
    const { g, props } = base28RingProps()
    const focusChords = focusChordList(g, zoneFocus(12))
    const markup = renderToStaticMarkup(createElement(Projection, { ...props, focusChords }))
    expect((markup.match(/data-demon-focus="/g) ?? []).length).toBe(27)
    expect((markup.match(/data-demon-focus-layer/g) ?? []).length).toBe(1)
  })

  it('base 28 ring, demon focus 12::3: exactly one data-demon-focus="12:3"', () => {
    const { g, props } = base28RingProps()
    const focusChords = focusChordList(g, demonFocusOf({ a: 12, b: 3 }))
    const markup = renderToStaticMarkup(createElement(Projection, { ...props, focusChords }))
    expect((markup.match(/data-demon-focus="/g) ?? []).length).toBe(1)
    expect(markup).toContain('data-demon-focus="12:3"')
  })
})

describe('ViewControls: Demon focus toggle', () => {
  it('without onToggleDemonFocus: renders no "Demon focus"', () => {
    const markup = renderToStaticMarkup(createElement(ViewControls, {
      zoom: 1, onZoomIn: noop, onZoomOut: noop, onFit: noop,
    }))
    expect(markup).not.toContain('Demon focus')
  })

  it('with onToggleDemonFocus and demonFocusMode true: aria-label="Demon focus" and aria-pressed="true"', () => {
    const markup = renderToStaticMarkup(createElement(ViewControls, {
      zoom: 1, onZoomIn: noop, onZoomOut: noop, onFit: noop,
      demonFocusMode: true, onToggleDemonFocus: noop,
    }))
    expect(markup).toContain('aria-label="Demon focus"')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('with onToggleDemonFocus and demonFocusMode false: aria-pressed="false"', () => {
    const markup = renderToStaticMarkup(createElement(ViewControls, {
      zoom: 1, onZoomIn: noop, onZoomOut: noop, onFit: noop,
      demonFocusMode: false, onToggleDemonFocus: noop,
    }))
    expect(markup).toContain('aria-pressed="false"')
  })
})

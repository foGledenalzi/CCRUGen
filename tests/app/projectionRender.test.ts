// Server-render smoke for the base-generic Projection (MIG-02, T-04-31): base 10 renders through the same props
// NumogramClient passes (frozen layout tables + base10 route geometry), and every even base 2..40 renders through
// a procedural ring layout with neither 'NaN' nor 'undefined' anywhere in the markup. No JSX (plain node test file).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { Projection } from '../../app/components/projection/Projection'
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
      gateRenderData,
      currentRenderData,
      gateCalcFocusName: null,
      labelVisibility: { numbers: true, xenotation: false, planets: true },
      particlesOn: false,
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
        gateRenderData: rd.gates,
        currentRenderData: rd.currents,
        gateCalcFocusName: null,
        labelVisibility: { numbers: true, xenotation: false, planets: true },
        particlesOn: true,
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

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
import {
  P_ORIGINAL,
  PLANETARY_CX,
  PLANETARY_CY,
  PLANETARY_DEFAULT_ANGLE,
  PLANETARY_RADIUS,
} from '../../app/presets/base10/layouts'
import { base10CurrentRender, base10GateRender } from '../../app/presets/base10/routes'
import { demonFocusOf, focusChordList, zoneFocus } from '../../app/lib/demonState'
import { regionLabel } from '../../app/lib/regions'
import { fitSoundLabel } from '../../app/lib/soundLabels'
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

// D-03 (plan 07-12): the `sounds` label mode swaps only the zone node label slot, only on the SVG tier and only on non-planetary
// layouts. With no sounds table (or no scale) every byte stays as it was, so the 60 frozen DOM goldens cannot move. The sounds are
// neutral letters with the grapheme counts of the UI-SPEC worked example (no canonical sound is quoted in a test).
describe('Projection: sounds label mode (plan 07-12, D-03)', () => {
  const PX_PER_UNIT = 0.725 // the base-10 original layout: 580 px column over an 800-unit frame
  const ELLIPSIS = String.fromCodePoint(0x2026)
  // zone 0 has 7 letters (shrinks), zone 9 has 16 (cut), zones 1 to 8 have two (full size)
  const SOUNDS: readonly string[] = ['abcdefg', 'ab', 'cd', 'ef', 'gh', 'ij', 'kl', 'mn', 'op', 'abcdefghijklmnop']

  function originalProps(overrides: Record<string, unknown> = {}) {
    const view = buildNumogramView(BASE10)
    const routeInput = {
      layout: 'original' as const,
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      g: BASE10,
      gates: GATE_LIST,
      currents: CURRENTS,
      syzygies: SYZYGIES,
      zoneRadius: () => NODE_RADIUS,
    }
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
      zoneLabels: zoneLabelsFor(10, DEFAULT_LABEL_SCHEME),
      labelsOn: true,
      gateMode: 'on' as const,
      pos: P_ORIGINAL,
      ctr: CENTER.original,
      svgHeight: 940,
      layers: new Set<Layer>(['syzygies', 'currents', 'gates']),
      hlZones: new Set<number>(),
      selZones: new Set<number>(),
      anyFocus: false,
      tcActive: false,
      showOrbits: false,
      planetaryPos: {},
      zoneOrder: [...DRAW_ORDER.original],
      zoneStates: null,
      gateRenderData: base10GateRender(routeInput),
      currentRenderData: base10CurrentRender(routeInput, {}),
      gateCalcFocusName: null,
      labelVisibility: { numbers: true, xenotation: false, planets: false },
      particlesOn: false,
      reducedMotion: false,
      onHoverInfo: noop,
      onPinInfo: noop,
      onZoneNodeClick: noop,
      ...overrides,
    }
  }

  const render = (overrides: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(Projection, originalProps(overrides) as Parameters<typeof Projection>[0]))

  /** Every zone node label that carries `data-sound-label`: its attribute string, the full sound it stands for and its text. */
  function soundLabels(markup: string): { attrs: string; sound: string; text: string }[] {
    const out: { attrs: string; sound: string; text: string }[] = []
    for (const m of markup.matchAll(/<text ([^>]*?data-sound-label="([^"]*)"[^>]*)>([^<]*)<\/text>/g)) {
      out.push({ attrs: m[1], sound: m[2], text: m[3] })
    }
    return out
  }

  const fontSizeOf = (attrs: string): string => /font-size="([^"]+)"/.exec(attrs)?.[1] ?? ''
  // the attributes that make a label a numeral label, with the two that may legitimately differ taken out
  const styleOnly = (attrs: string): string => attrs.replace(/ font-size="[^"]*"/, '').replace(/ data-[a-z-]+="[^"]*"/g, '')

  it('without zoneSounds, with a null table, or without a scale, the markup equals the default markup', () => {
    const plain = render()
    expect(render({ zoneSounds: null, labelPxPerUnit: PX_PER_UNIT })).toBe(plain)
    expect(render({ zoneSounds: SOUNDS })).toBe(plain)
    expect(render({ zoneSounds: SOUNDS, labelPxPerUnit: 0 })).toBe(plain)
    expect(plain).not.toContain('data-sound-label')
    expect(plain).not.toContain('data-truncated')
  })

  it('draws one fitted sound per zone node, with the full sound in data-sound-label', () => {
    const labels = soundLabels(render({ zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT }))
    expect(labels).toHaveLength(10)
    expect(labels.map(l => l.sound).sort()).toEqual([...SOUNDS].sort())
  })

  it('a short sound keeps the layout label size, a 7-letter sound shrinks, a 16-letter sound is cut at 6 px', () => {
    const labels = soundLabels(render({ zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT }))
    const rPx = NODE_RADIUS * PX_PER_UNIT
    const fullPx = LABEL_SIZE * PX_PER_UNIT

    const short = labels.find(l => l.sound === 'ab')
    expect(short?.text).toBe('ab')
    expect(fontSizeOf(short?.attrs ?? '')).toBe(String(LABEL_SIZE))
    expect(short?.attrs).not.toContain('data-truncated')

    const seven = labels.find(l => l.sound === 'abcdefg')
    const sevenFit = fitSoundLabel('abcdefg', rPx, fullPx)
    expect(seven?.text).toBe('abcdefg')
    expect(fontSizeOf(seven?.attrs ?? '')).toBe(String(sevenFit.fontPx / PX_PER_UNIT))
    expect(Math.abs(sevenFit.fontPx - 6.3)).toBeLessThan(0.5)
    expect(seven?.attrs).not.toContain('data-truncated')

    const long = labels.find(l => l.sound === 'abcdefghijklmnop')
    expect(long?.text).toBe('abcdef' + ELLIPSIS)
    expect(fontSizeOf(long?.attrs ?? '')).toBe(String(6 / PX_PER_UNIT))
    expect(long?.attrs).toContain('data-truncated="true"')
  })

  it('keeps the numeral label style: same anchor, weight, family, colour and position; only size, text and data-* differ', () => {
    const plain = render()
    const sounds = render({ zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT })
    const numeral = /<text ([^>]*)>0<\/text>/.exec(plain)
    expect(numeral).not.toBeNull()
    const label = soundLabels(sounds).find(l => l.sound === 'abcdefg')
    expect(label).toBeDefined()
    expect(styleOnly(label?.attrs ?? '')).toBe(styleOnly((numeral as RegExpExecArray)[1]))
    expect(styleOnly(label?.attrs ?? '')).toContain('font-weight="bold"')
    expect(styleOnly(label?.attrs ?? '')).toContain('font-family="monospace"')
  })

  it('the node accessible name carries the digits, the full sound and the region, and `, selected` when selected', () => {
    const markup = render({ zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT, selZones: new Set([9]) })
    const view = buildNumogramView(BASE10)
    expect(markup).toContain(`aria-label="Zone 0, sound abcdefg, ${regionLabel(view.zoneRegion[0])}"`)
    // the cut label's name still holds the whole sound
    expect(markup).toContain(`aria-label="Zone 9, sound abcdefghijklmnop, ${regionLabel(view.zoneRegion[9])}, selected"`)
    expect(markup).not.toContain('aria-label="Zone 0, ' + regionLabel(view.zoneRegion[0]))
  })

  it('the label toggle still hides the sound labels, while the accessible name keeps the sound', () => {
    const hidden = render({
      zoneSounds: SOUNDS,
      labelPxPerUnit: PX_PER_UNIT,
      labelVisibility: { numbers: false, xenotation: false, planets: false },
    })
    expect(soundLabels(hidden)).toHaveLength(0)
    expect(hidden).toContain('aria-label="Zone 0, sound abcdefg, ')
    const off = render({ zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT, labelsOn: false })
    expect(soundLabels(off)).toHaveLength(0)
  })

  it('a zone with no sound yet draws its numeral and its usual accessible name (never a placeholder)', () => {
    const sparse = SOUNDS.map((s, z) => (z === 3 ? '' : s))
    const markup = render({ zoneSounds: sparse, labelPxPerUnit: PX_PER_UNIT })
    expect(soundLabels(markup)).toHaveLength(9)
    const view = buildNumogramView(BASE10)
    expect(markup).toContain(`aria-label="Zone 3, ${regionLabel(view.zoneRegion[3])}"`)
    expect(markup).toContain('>3</text>')
  })

  it('a sound is escaped as text, never as markup', () => {
    const hostile = SOUNDS.map((s, z) => (z === 1 ? '<b>x' : s))
    const markup = render({ zoneSounds: hostile, labelPxPerUnit: PX_PER_UNIT })
    expect(markup).not.toContain('<b>x')
    expect(markup).toContain('data-sound-label="&lt;b&gt;x"')
  })

  it('on the planetary layout the numerals stay and no sound appears anywhere', () => {
    const planetaryPos: Record<number, { x: number; y: number }> = {}
    for (let z = 0; z < 10; z++) {
      const angle = (PLANETARY_DEFAULT_ANGLE[z] * Math.PI) / 180
      planetaryPos[z] = {
        x: PLANETARY_CX + PLANETARY_RADIUS[z] * Math.cos(angle),
        y: PLANETARY_CY + PLANETARY_RADIUS[z] * Math.sin(angle),
      }
    }
    const planetary = {
      layoutId: 'planetary' as const,
      routingStyle: 'planetary' as const,
      pos: planetaryPos,
      ctr: CENTER.planetary,
      zoneOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      planetaryPos,
    }
    const plain = render(planetary)
    const withSounds = render({ ...planetary, zoneSounds: SOUNDS, labelPxPerUnit: PX_PER_UNIT })
    expect(withSounds).toBe(plain)
    expect(withSounds).not.toContain('data-sound-label')
    expect(withSounds).not.toContain(', sound ')
    expect(withSounds).toContain('aria-label="Zone 0, ')
  })

  it('draws a sound in every node of a procedural ring layout (base 28) with no NaN or undefined', () => {
    const g = createNumogram(28)
    const view = buildNumogramView(g)
    const target = layoutTarget(g, 'ring', 'shelf', {})
    if (target.layout === null) throw new Error('expected a procedural layout for base 28')
    const rd = engineRenderData(view, target.layout)
    const sounds = Array.from({ length: 28 }, (_, z) => 'k'.repeat((z % 9) + 1))
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
      zoneLabels: zoneLabelsFor(28, DEFAULT_LABEL_SCHEME),
      labelsOn: true,
      gateMode: gateMode(28),
      pos: target.pos,
      ctr: target.ctr,
      svgHeight: target.height,
      layers: new Set<Layer>(['syzygies', 'currents', 'gates']),
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
      labelVisibility: { numbers: true, xenotation: false, planets: false },
      particlesOn: false,
      reducedMotion: false,
      zoneSounds: sounds,
      labelPxPerUnit: 0.5,
      onHoverInfo: noop,
      onPinInfo: noop,
      onZoneNodeClick: noop,
    }))
    expect(soundLabels(markup)).toHaveLength(28)
    expect(markup).not.toContain('NaN')
    expect(markup).not.toContain('undefined')
  })
})

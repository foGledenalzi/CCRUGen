// Server-render smoke for CanvasDiagram (REN-02, 06-10): the DOM contract of the Canvas tier's one component, rendered
// with renderToStaticMarkup (Vitest node environment, no jsdom, so effects never run). It asserts the tier wrapper
// attributes, the stacked layer canvases, the focusable role=application overlay with the UI-SPEC aria-label, the live
// region, the layer opacities that carry context dimming, the pending (computing) state, and that no callout exists
// before there is something to name. The interactive behaviour (gestures, picking, keys) is proven by the e2e specs of
// 06-12 and 06-13; its decisions are unit-tested in canvasDiagramModel.test.ts and the pure modules. No JSX (plain
// node test file), as in demonMatrixRender.test.ts.
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
} from '../../engine/index'
import type { CanvasScene, Numogram } from '../../engine/index'
import type { Layer } from '../../app/data/types'
import { CanvasDiagram, type CanvasDiagramProps } from '../../app/components/canvas/CanvasDiagram'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { frameOf } from '../../app/lib/canvas/diagramModel'
import { edgeLayerOpacity } from '../../app/lib/canvas/draw'
import { canvasFootprint } from '../../app/lib/canvas/viewTransform'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, zoneLabelsFor } from '../../app/lib/labelScheme'
import { buildNumogramView, summarize, type NumogramView } from '../../app/lib/numogramView'
import { regionLabel } from '../../app/lib/regions'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N } from '../../app/lib/tierBounds'

const noop = () => {}

interface Fx {
  readonly g: Numogram
  readonly view: NumogramView
  readonly scene: CanvasScene
  readonly labels: readonly string[]
}

function zoneFx(base: number): Fx {
  const g = createNumogram(base)
  const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
  return {
    g,
    view: buildNumogramView(g),
    scene: buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout)),
    labels: zoneLabelsFor(base, DEFAULT_LABEL_SCHEME),
  }
}

function pairFx(base: number): Fx {
  const g = createNumogram(base)
  const layout = pairGraphLayout(g, { packer: 'shelf' })
  return {
    g,
    view: buildNumogramView(g),
    scene: buildPairScene(g, layout, routePairGraph(g, layout)),
    labels: zoneLabelsFor(base, DEFAULT_LABEL_SCHEME),
  }
}

function buildCtx(fx: Fx): NumogramViewContextValue {
  const base = fx.g.base
  return {
    base,
    g: fx.g,
    summary: summarize(fx.g),
    view: fx.view,
    zoneLabels: fx.labels,
    labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: 'off',
    tier: 'canvas',
    interactiveMaxN: INTERACTIVE_MAX_N,
  }
}

const ALL_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['syzygies', 'currents', 'gates'])

function propsFor(fx: Fx, over: Partial<CanvasDiagramProps> = {}): CanvasDiagramProps {
  return {
    scene: fx.scene,
    view: fx.view,
    zoneLabels: fx.labels,
    layers: ALL_LAYERS,
    labelVisibility: { numbers: true, xenotation: false, planets: false },
    gateMode: 'off',
    hlZones: new Set<number>(),
    selZones: new Set<number>(),
    anyFocus: false,
    zoneStates: null,
    focusChords: null,
    tcActive: false,
    hoverInfo: null,
    pinnedInfo: null,
    demonFocusMode: false,
    pending: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    onHoverInfo: noop,
    onPinInfo: noop,
    onZoneNodeClick: noop,
    onTogglePair: noop,
    onClearFocus: noop,
    onRubberBandStart: noop,
    onZoomChange: noop,
    ...over,
  }
}

function render(fx: Fx, over: Partial<CanvasDiagramProps> = {}): string {
  return renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: buildCtx(fx) }, createElement(CanvasDiagram, propsFor(fx, over))),
  )
}

/** Markup attribute values are HTML-escaped; the aria-label has an apostrophe. */
const unescape = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')

/** Every `<canvas ...>` start tag in the markup. */
const canvasTags = (markup: string): string[] => markup.match(/<canvas\b[^>]*>/g) ?? []
const layerTag = (markup: string, layer: string): string => {
  const tag = canvasTags(markup).find(t => t.includes(`data-canvas-layer="${layer}"`))
  if (tag === undefined) throw new Error(`no layer canvas ${layer}`)
  return tag
}
const overlayTag = (markup: string): string => {
  const tag = canvasTags(markup).find(t => t.includes('role="application"'))
  if (tag === undefined) throw new Error('no overlay canvas')
  return tag
}
const rootTag = (markup: string): string => markup.match(/^<div\b[^>]*>/)?.[0] ?? ''

describe('CanvasDiagram: server render, zone layout (base 202 ring)', () => {
  const fx = zoneFx(202)
  const markup = render(fx)
  const { cssWidth, cssHeight } = canvasFootprint(frameOf(fx.scene), 1280, 800)

  it('the root is the Canvas tier wrapper: tier, state, base, baseline marker and the footprint size', () => {
    const root = rootTag(markup)
    expect(root).toContain('data-render-tier="canvas"')
    expect(root).toContain('data-canvas-state="pending"') // not painted yet: effects do not run on the server
    expect(root).toContain('data-base="202"')
    expect(root).toContain('data-post-baseline=""')
    expect(root).toContain(`width:${cssWidth}px`)
    expect(root).toContain(`height:${cssHeight}px`)
    expect(root).toContain('position:relative')
    expect(root).toContain('opacity:1')
  })

  it('four aria-hidden layer canvases (syzygy, current, gate, node) then one overlay, in paint order', () => {
    const tags = canvasTags(markup)
    expect(tags).toHaveLength(5)
    const layers = tags.slice(0, 4).map(t => /data-canvas-layer="(\w+)"/.exec(t)?.[1])
    expect(layers).toEqual(['syzygy', 'current', 'gate', 'node'])
    for (const t of tags.slice(0, 4)) expect(t).toContain('aria-hidden="true"')
    expect(tags[4]).toContain('role="application"')
    expect(tags[4]).not.toContain('data-canvas-layer')
  })

  it('every canvas has the backing-store size of a 1x display at the footprint', () => {
    for (const t of canvasTags(markup)) {
      expect(t).toContain(`width="${cssWidth}"`)
      expect(t).toContain(`height="${cssHeight}"`)
    }
  })

  it('the overlay is the one Tab stop: role, tabindex, label, focus key and view hooks', () => {
    const o = overlayTag(markup)
    expect(o).toContain('data-diagram="zones"')
    expect(o).toContain('role="application"')
    expect(o).toContain('tabindex="0"')
    expect(unescape(o)).toContain(
      'aria-label="Numogram, base 202, 202 zones. Arrow keys move between zones, Tab steps through a zone\'s syzygy, current and gate, Enter selects."',
    )
    expect(o).toContain('data-focus-key=""')
    expect(o).toContain('data-zoom="1"')
    expect(o).toContain('data-tx="0"')
    expect(o).toContain('data-ty="0"')
    expect(o).not.toContain('aria-busy')
  })

  it('touch-action is none and the focus outline is off on the overlay only', () => {
    expect(overlayTag(markup)).toContain('touch-action:none')
    expect(overlayTag(markup)).toContain('outline:none')
    for (const layer of ['syzygy', 'current', 'gate', 'node']) expect(layerTag(markup, layer)).not.toContain('touch-action')
  })

  it('has an aria-live polite sr-only region, and no callout without a pointer, a ring or a pinned element', () => {
    expect(markup).toMatch(/<div[^>]*data-canvas-live=""[^>]*>/)
    const live = markup.match(/<div[^>]*data-canvas-live=""[^>]*>/)?.[0] ?? ''
    expect(live).toContain('aria-live="polite"')
    expect(live).toContain('class="sr-only"')
    expect(markup).not.toContain('data-canvas-callout')
  })

  it('the edge layers carry the ambient opacities of the table (context dimming is a layer opacity)', () => {
    expect(layerTag(markup, 'syzygy')).toContain(`opacity:${edgeLayerOpacity('syzygy', false, 'off')}`)
    expect(layerTag(markup, 'current')).toContain(`opacity:${edgeLayerOpacity('current', false, 'off')}`)
    expect(edgeLayerOpacity('syzygy', false, 'off')).toBe(0.5)
    expect(edgeLayerOpacity('current', false, 'off')).toBe(0.6)
  })

  it('with a zone highlighted the edge layers drop to the context opacities', () => {
    const dim = render(fx, { anyFocus: true })
    expect(layerTag(dim, 'syzygy')).toContain('opacity:0.1')
    expect(layerTag(dim, 'current')).toContain('opacity:0.08')
    expect(layerTag(dim, 'gate')).toContain(`opacity:${edgeLayerOpacity('gate', true, 'off')}`)
  })

  it("the gate layer's thin mode halves its opacity", () => {
    const thin = render(fx, { gateMode: 'thin' })
    expect(layerTag(thin, 'gate')).toContain(`opacity:${edgeLayerOpacity('gate', false, 'thin')}`)
    expect(edgeLayerOpacity('gate', false, 'thin')).toBe(0.25)
  })

  it('the overlay report attributes exist on the root with their idle values', () => {
    const root = rootTag(markup)
    expect(root).toContain('data-overlay-edges="0"')
    expect(root).toContain('data-overlay-fidelity="full"')
    expect(root).toContain('data-overlay-chords="0"')
    expect(root).toContain('data-overlay-ms="0"')
  })
})

describe('CanvasDiagram: server render, pair graph (base 64)', () => {
  const fx = pairFx(64)
  const markup = render(fx)

  it('the overlay is the pairs diagram with the pair graph aria-label', () => {
    const o = overlayTag(markup)
    expect(o).toContain('data-diagram="pairs"')
    expect(unescape(o)).toContain(
      'aria-label="Numogram pair graph, base 64, 32 syzygies. Arrow keys move between pairs, Enter selects."',
    )
    expect(rootTag(markup)).toContain('data-base="64"')
    expect(canvasTags(markup)).toHaveLength(5)
  })

  it('the footprint follows the pair graph frame, not the zone ring', () => {
    const { cssWidth, cssHeight } = canvasFootprint(frameOf(fx.scene), 1280, 800)
    expect(rootTag(markup)).toContain(`width:${cssWidth}px`)
    expect(rootTag(markup)).toContain(`height:${cssHeight}px`)
  })
})

describe('CanvasDiagram: the pending (computing) state', () => {
  const fx = zoneFx(202)
  const markup = render(fx, { pending: true })

  it('dims the diagram to 0.5 and ignores pointer input', () => {
    const root = rootTag(markup)
    expect(root).toContain('opacity:0.5')
    expect(root).toContain('pointer-events:none')
    expect(root).toContain('data-canvas-state="pending"')
  })

  it('marks the overlay busy', () => {
    expect(overlayTag(markup)).toContain('aria-busy="true"')
  })

  it('the transition is the 0.15 s opacity one the app already uses', () => {
    expect(rootTag(markup)).toContain('transition:opacity 0.15s')
  })

  it('without pending the root is full opacity and takes pointer input', () => {
    const idle = rootTag(render(fx))
    expect(idle).toContain('opacity:1')
    expect(idle).not.toContain('pointer-events')
  })
})

describe('CanvasDiagram: the callout chip', () => {
  const fx = zoneFx(28)

  it('names a pinned zone with the SVG aria-label text, without the selected suffix', () => {
    const markup = render(fx, { pinnedInfo: { type: 'zone', zone: 5 }, selZones: new Set([5]) })
    const chip = markup.match(/<div[^>]*data-canvas-callout=""[^>]*>[^<]*<\/div>/)?.[0] ?? ''
    expect(chip).toContain('role="tooltip"')
    expect(chip).toContain('data-post-baseline=""')
    expect(chip).toContain('pointer-events-none')
    expect(chip).toContain('whitespace-nowrap')
    expect(chip).toContain(`>Zone ${fx.labels[5]}, ${regionLabel(fx.view.zoneRegion[5] as never)}</div>`)
    expect(chip).not.toContain('selected')
  })

  it('draws the border in the identity colour of the element at 53% alpha (the 88 suffix)', () => {
    const markup = render(fx, { pinnedInfo: { type: 'zone', zone: 5 } })
    const color = fx.view.zoneColors[5] as string
    expect(markup).toContain(`border:1px solid ${color}88`)
    expect(markup).toContain('background:rgba(8,8,15,0.95)')
  })

  it('names a hovered edge from the parent hover info when nothing is pinned', () => {
    const syz = fx.view.syzygies[0] as { a: number; b: number }
    const markup = render(fx, { hoverInfo: { type: 'syzygy', data: fx.view.syzygies[0]! } })
    expect(markup).toContain(`>Syzygy ${fx.labels[syz.a]}::${fx.labels[syz.b]}</div>`)
    expect(markup).toContain('border:1px solid #e8e8e888')
  })

  it('a pinned demon has no chip (the chip names zones and edges)', () => {
    const markup = render(fx, { pinnedInfo: { type: 'demon', demon: { a: 1, b: 2, name: 'x', kind: 'chrono' } } })
    expect(markup).not.toContain('data-canvas-callout')
  })
})

describe('CanvasDiagram: the callout chip in sounds mode (Phase 7, plan 07-14)', () => {
  const fx = zoneFx(28)
  // neutral sounds: no CCRU zone sound is copied into a test
  const sounds: readonly string[] = Array.from({ length: 28 }, (_, z) => `w${z}y`)
  const chipOf = (markup: string): string => markup.match(/<div[^>]*data-canvas-callout=""[^>]*>[^<]*<\/div>/)?.[0] ?? ''

  it('names a pinned zone "Zone {digits}, sound {sound}, {Region}", without the selected suffix', () => {
    const chip = chipOf(render(fx, { pinnedInfo: { type: 'zone', zone: 5 }, selZones: new Set([5]), zoneSounds: sounds }))
    expect(chip).toContain(`>Zone ${fx.labels[5]}, sound w5y, ${regionLabel(fx.view.zoneRegion[5] as never)}</div>`)
    expect(chip).not.toContain('selected')
  })

  it('a hovered zone is named the same way, and the full sound is named however long it is', () => {
    const long = 'abcdefghijklmnop'
    const table = sounds.map((s, z) => (z === 12 ? long : s))
    const chip = chipOf(render(fx, { hoverInfo: { type: 'zone', zone: 12 }, zoneSounds: table }))
    expect(chip).toContain(`>Zone ${fx.labels[12]}, sound ${long}, ${regionLabel(fx.view.zoneRegion[12] as never)}</div>`)
  })

  it('without zoneSounds (absent or null) the chip is the digits text it was', () => {
    for (const zoneSounds of [undefined, null]) {
      const chip = chipOf(render(fx, { pinnedInfo: { type: 'zone', zone: 5 }, zoneSounds }))
      expect(chip).toContain(`>Zone ${fx.labels[5]}, ${regionLabel(fx.view.zoneRegion[5] as never)}</div>`)
      expect(chip).not.toContain('sound')
    }
  })

  it('an edge chip keeps its numerals, and a sound is escaped as text, never markup', () => {
    const syz = fx.view.syzygies[0] as { a: number; b: number }
    const edge = chipOf(render(fx, { hoverInfo: { type: 'syzygy', data: fx.view.syzygies[0]! }, zoneSounds: sounds }))
    expect(edge).toContain(`>Syzygy ${fx.labels[syz.a]}::${fx.labels[syz.b]}</div>`)
    const markup = render(fx, { pinnedInfo: { type: 'zone', zone: 5 }, zoneSounds: sounds.map((s, z) => (z === 5 ? '<b>x' : s)) })
    expect(markup).toContain('sound &lt;b&gt;x')
    expect(markup).not.toContain('<b>x')
  })
})

describe('CanvasDiagram: source rules', () => {
  const source = readFileSync(new URL('../../app/components/canvas/CanvasDiagram.tsx', import.meta.url), 'utf8')

  it('uses no HTML injection, no blur glow and not the SVG tier zoom hook', () => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML|shadowBlur|useCanvasZoom/)
  })

  it('has the platform hooks the contract names', () => {
    expect(source).toContain('passive: false')
    expect(source).toContain('setPointerCapture')
    expect(source).toContain('pickAt(')
    expect(source).toContain('nextTarget(')
    expect(source).toContain('drawOverlay(')
  })

  it('runs no continuous animation loop (redraws happen on input and data change)', () => {
    expect(source).not.toMatch(/setInterval/)
  })
})

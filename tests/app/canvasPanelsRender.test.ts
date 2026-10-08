// Server-render smoke for the Canvas-tier panel chrome (REN-02, Phase 6 plan 06; threats T-06-20, T-06-01b,
// T-06-11). The shared view contract carries the rendered tier, and the four list panels must not build a
// thousand-row list at the Canvas tier (research P9): they show the UI-SPEC note instead, while the headless tier
// keeps today's "Available up to ..." line and the SVG tier keeps its rows. No JSX (plain node test file), matching
// tests/app/demonMatrixRender.test.ts's Provider helper pattern. Cutoffs are read from the tier table through
// app/lib/tierBounds, never typed.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import type { Numogram, RenderTier } from '../../engine/index'
import { buildNumogramView, summarize } from '../../app/lib/numogramView'
import type { NumogramView } from '../../app/lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, zoneLabelsFor } from '../../app/lib/labelScheme'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N, gateMode } from '../../app/lib/tierBounds'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { ZonesPanel } from '../../app/components/panels/ZonesPanel'
import { SyzygiesPanel } from '../../app/components/panels/SyzygiesPanel'
import { CurrentsPanel } from '../../app/components/panels/CurrentsPanel'
import { GatesPanel } from '../../app/components/panels/GatesPanel'
import { LayersPanel, gateInfoSuffix, particlesCanvasInfo } from '../../app/components/panels/LayersPanel'
import { RegionsPanel } from '../../app/components/panels/RegionsPanel'
import { ShortcutsModal } from '../../app/components/numogram/ShortcutsModal'
import { EMPTY_REGION_FILTER, regionRows } from '../../app/lib/regions'
import type { Layer } from '../../app/data/types'

const noop = () => {}

// The base that stands in for the Canvas tier (the first base above the SVG tier) and one SVG-tier base.
const CANVAS_BASE = SVG_RICH_MAX_N + 2
const SVG_BASE = 28

interface CtxFixture {
  readonly g: Numogram
  readonly view: NumogramView
}
const fixtures = new Map<number, CtxFixture>()
function fixtureFor(base: number): CtxFixture {
  let f = fixtures.get(base)
  if (!f) {
    const g = createNumogram(base)
    f = { g, view: buildNumogramView(g) }
    fixtures.set(base, f)
  }
  return f
}

/** A view context for `base` at `tier`. headless: view and zoneLabels are null (as above the interactive ceiling). */
function buildCtx(base: number, tier: RenderTier): NumogramViewContextValue {
  const { g, view } = fixtureFor(base)
  const drawn = tier !== 'headless'
  return {
    base,
    g,
    summary: summarize(g),
    view: drawn ? view : null,
    zoneLabels: drawn ? zoneLabelsFor(base, DEFAULT_LABEL_SCHEME) : null,
    labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: gateMode(g.zoneCount),
    tier,
    interactiveMaxN: INTERACTIVE_MAX_N,
  }
}

function renderIn(ctx: NumogramViewContextValue, el: React.ReactElement): string {
  return renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: ctx }, el))
}

const emptySet = new Set<number>()

const LIST_PANELS: readonly { name: string; render: (ctx: NumogramViewContextValue) => string; rows: (v: NumogramView) => number }[] = [
  {
    name: 'ZonesPanel',
    render: ctx => renderIn(ctx, createElement(ZonesPanel, {
      selZones: emptySet, hlZones: emptySet, onToggleZone: noop, onToggleAll: noop, onHoverInfo: noop,
    })),
    rows: v => v.zoneCount,
  },
  {
    name: 'SyzygiesPanel',
    render: ctx => renderIn(ctx, createElement(SyzygiesPanel, {
      selZones: emptySet, hlZones: emptySet, onToggleSyzygyPair: noop, onHoverInfo: noop,
    })),
    rows: v => v.syzygies.length,
  },
  {
    name: 'CurrentsPanel',
    render: ctx => renderIn(ctx, createElement(CurrentsPanel, {
      selZones: emptySet, hlZones: emptySet, onHoverInfo: noop, onSelectCurrent: noop,
    })),
    rows: v => v.currents.length,
  },
  {
    name: 'GatesPanel',
    render: ctx => renderIn(ctx, createElement(GatesPanel, {
      selZones: emptySet, hlZones: emptySet, onHoverInfo: noop, onSelectGate: noop, onToggleAll: noop,
    })),
    rows: v => v.gates.length,
  },
]

// One list row is a PanelRow: this class string is unique to it among the list panels' markup.
const ROW_MARKER = /flex items-center gap-2 py-0\.5 cursor-pointer/g
function rowCount(markup: string): number {
  return (markup.match(ROW_MARKER) ?? []).length
}

const CANVAS_NOTE = `<div data-post-baseline="" class="px-3 pb-2.5 text-[10px] text-gray-500">Listed up to ${SVG_RICH_MAX_N} zones. Pick elements on the diagram.</div>`
const HEADLESS_NOTE = `<div data-post-baseline="" class="px-3 pb-2.5 text-[9px] text-gray-500">Available up to ${SVG_RICH_MAX_N} zones.</div>`

describe('list panels at the Canvas tier (T-06-20, research P9)', () => {
  for (const panel of LIST_PANELS) {
    it(`${panel.name} shows the Canvas note, with no rows, in a post-baseline 10px element`, () => {
      const markup = panel.render(buildCtx(CANVAS_BASE, 'canvas'))
      expect(markup).toBe(CANVAS_NOTE)
      expect(markup).toContain('data-post-baseline')
      expect(markup).toContain('text-[10px]')
      expect(rowCount(markup)).toBe(0)
    })
  }

  it('the note names the cutoff from the table, not a literal', () => {
    expect(CANVAS_NOTE).toContain(`Listed up to ${SVG_RICH_MAX_N} zones.`)
    // A context carrying a different svgRichMaxN changes the note: the panel reads the context, nothing is baked in.
    const ctx: NumogramViewContextValue = { ...buildCtx(CANVAS_BASE, 'canvas'), svgRichMaxN: 7 }
    const markup = LIST_PANELS[0]!.render(ctx)
    expect(markup).toContain('Listed up to 7 zones. Pick elements on the diagram.')
  })
})

describe('list panels at the headless tier keep today\'s line', () => {
  for (const panel of LIST_PANELS) {
    it(`${panel.name} renders "Available up to {max} zones." (markup unchanged)`, () => {
      const markup = panel.render(buildCtx(CANVAS_BASE, 'headless'))
      expect(markup).toBe(HEADLESS_NOTE)
      expect(markup).not.toContain('Listed up to')
    })
  }
})

describe('list panels at the SVG tier keep their rows', () => {
  for (const panel of LIST_PANELS) {
    it(`${panel.name} at base ${SVG_BASE} renders one row per element and no Canvas note`, () => {
      const ctx = buildCtx(SVG_BASE, 'svg')
      const markup = panel.render(ctx)
      expect(markup).not.toContain('Listed up to')
      expect(markup).not.toContain('Available up to')
      expect(rowCount(markup)).toBe(panel.rows(ctx.view as NumogramView))
    })
  }

  it('ZonesPanel at base 28 has exactly 28 zone rows', () => {
    const markup = LIST_PANELS[0]!.render(buildCtx(SVG_BASE, 'svg'))
    expect(rowCount(markup)).toBe(SVG_BASE)
  })
})

// ── Task 3: Layers copy, Regions read order, Shortcuts lines ─────────────────────────────────────────────────────

describe('gateInfoSuffix (Layers panel, Gates info line)', () => {
  it('off at the canvas tier says the gate is drawn for the hovered or pinned zone only', () => {
    expect(gateInfoSuffix('off', 'canvas')).toBe(' Drawn for the hovered or pinned zone only at this base.')
  })
  it('off at the svg tier keeps the "too dense" line', () => {
    expect(gateInfoSuffix('off', 'svg')).toBe(' Hidden at this base: too dense to draw legibly.')
  })
  it('off at the headless tier keeps the "too dense" line (nothing is drawn there at all)', () => {
    expect(gateInfoSuffix('off', 'headless')).toBe(' Hidden at this base: too dense to draw legibly.')
  })
  it('thin reads the same at every tier', () => {
    for (const tier of ['svg', 'canvas', 'headless'] as const) {
      expect(gateInfoSuffix('thin', tier)).toBe(' Drawn thin at this base.')
    }
  })
  it('on adds nothing at any tier', () => {
    for (const tier of ['svg', 'canvas', 'headless'] as const) {
      expect(gateInfoSuffix('on', tier)).toBe('')
    }
  })
})

describe('particlesCanvasInfo', () => {
  it('names the cutoff it is given', () => {
    expect(particlesCanvasInfo(200)).toBe('Particles are drawn up to 200 zones.')
    expect(particlesCanvasInfo(SVG_RICH_MAX_N)).toBe(`Particles are drawn up to ${SVG_RICH_MAX_N} zones.`)
  })
})

/** The text of the `right` slot of the Layers row whose label is `label` (ON, OFF or N/A). */
function layersRightLabel(markup: string, label: string): string | null {
  const m = new RegExp(`${label}</span><span class="ml-auto"><span class="[^"]*">([^<]*)</span>`).exec(markup)
  return m ? (m[1] as string) : null
}

function renderLayers(ctx: NumogramViewContextValue, layers: readonly Layer[], particlesOn: boolean): string {
  return renderIn(ctx, createElement(LayersPanel, {
    layers: new Set<Layer>(layers), toggleLayer: noop, particlesOn, onToggleParticles: noop,
  }))
}

describe('LayersPanel at the Canvas tier', () => {
  it('Particles shows N/A whether or not particles are on, while syzygies and currents keep ON/OFF', () => {
    const ctx = buildCtx(CANVAS_BASE, 'canvas')
    for (const particlesOn of [false, true]) {
      const markup = renderLayers(ctx, ['syzygies'], particlesOn)
      expect(layersRightLabel(markup, 'Particles')).toBe('N/A')
      expect(layersRightLabel(markup, 'Syzygies')).toBe('ON')
      expect(layersRightLabel(markup, 'Currents')).toBe('OFF')
    }
  })

  it('at the SVG tier Particles shows ON or OFF as today', () => {
    const ctx = buildCtx(SVG_BASE, 'svg')
    expect(layersRightLabel(renderLayers(ctx, ['syzygies'], false), 'Particles')).toBe('OFF')
    expect(layersRightLabel(renderLayers(ctx, ['syzygies'], true), 'Particles')).toBe('ON')
  })

  it('at the headless tier the panel is the unavailable line', () => {
    expect(renderLayers(buildCtx(CANVAS_BASE, 'headless'), [], false)).toBe(HEADLESS_NOTE)
  })
})

// Props every RegionsPanel render needs.
function renderRegions(ctx: NumogramViewContextValue): string {
  return renderIn(ctx, createElement(RegionsPanel, {
    hlRegion: null, tcActive: false, filter: EMPTY_REGION_FILTER,
    onSelectRegion: noop, onToggleTC: noop, onToggleIsolate: noop, onToggleMute: noop,
  }))
}

describe('RegionsPanel read order (T-06-01b, research P6)', () => {
  it('does not read ctx.g before its early return: a throwing getter is never touched at the headless tier', () => {
    const ctx = buildCtx(CANVAS_BASE, 'headless')
    const guarded = { ...ctx } as { g?: Numogram } & Record<string, unknown>
    Object.defineProperty(guarded, 'g', { get() { throw new Error('g read') }, enumerable: true })
    expect(() => renderRegions(guarded as unknown as NumogramViewContextValue)).not.toThrow()
    expect(renderRegions(guarded as unknown as NumogramViewContextValue)).toBe(HEADLESS_NOTE)
  })

  it('at the Canvas tier (base 202) renders one row per region plus the Time Circuit row', () => {
    const ctx = buildCtx(CANVAS_BASE, 'canvas')
    const markup = renderRegions(ctx)
    const rows = regionRows(ctx.g)
    expect(rows.length).toBeGreaterThan(0)
    expect(rowCount(markup)).toBe(rows.length + 1)
    expect((markup.match(/aria-label="Isolate /g) ?? []).length).toBe(rows.length)
    expect((markup.match(/aria-label="Mute /g) ?? []).length).toBe(rows.length)
  })

  it('at the SVG tier (base 28) still renders its rows', () => {
    const ctx = buildCtx(SVG_BASE, 'svg')
    expect(rowCount(renderRegions(ctx))).toBe(regionRows(ctx.g).length + 1)
  })
})

/** What React writes for an apostrophe in text content. */
function escapeApostrophe(s: string): string {
  return s.replace(/'/g, '&#x27;')
}

function renderShortcuts(open: boolean): string {
  return renderIn(buildCtx(SVG_BASE, 'svg'), createElement(ShortcutsModal, { open, onClose: noop }))
}

describe('ShortcutsModal lines for both keyboard models', () => {
  const DIAGRAM_LINE =
    `<div><span style="color:#10ff50">Diagram:</span> Up to ${SVG_RICH_MAX_N} zones: Tab moves into the diagram, ` +
    'arrow keys step through zones, syzygies, currents and gates, Home/End jump, Enter or Space selects</div>'
  const CANVAS_LINE = escapeApostrophe(
    `<div class="text-gray-400">Above ${SVG_RICH_MAX_N} zones: arrow keys step between zones, Tab steps through a zone's ` +
    'syzygy, current and gate, Page Up and Page Down jump 10 zones, Enter or Space selects. ' +
    'Touch: drag pans, pinch zooms, tap selects.</div>',
  )

  it('qualifies the existing Diagram line with the SVG cutoff read from data', () => {
    expect(renderShortcuts(true)).toContain(DIAGRAM_LINE)
  })

  it('adds the Canvas keyboard and touch line, in plain gray text with no accent span', () => {
    const markup = renderShortcuts(true)
    expect(markup).toContain(CANVAS_LINE)
    expect(CANVAS_LINE).not.toContain('<span')
    expect(CANVAS_LINE).not.toContain('#10ff50')
  })

  it('keeps both lines inside the data-post-baseline block, after the Diagram line and before Gate keys', () => {
    const markup = renderShortcuts(true)
    const block = markup.indexOf('<div data-post-baseline=""')
    const diagram = markup.indexOf(DIAGRAM_LINE)
    const canvas = markup.indexOf(CANVAS_LINE)
    const gateKeys = markup.indexOf('Gate keys:')
    expect(block).toBeGreaterThanOrEqual(0)
    expect(diagram).toBeGreaterThan(block)
    expect(canvas).toBeGreaterThan(diagram)
    expect(gateKeys).toBeGreaterThan(canvas)
  })

  it('renders nothing when closed (the context hook is called before the early return)', () => {
    expect(renderShortcuts(false)).toBe('')
  })
})

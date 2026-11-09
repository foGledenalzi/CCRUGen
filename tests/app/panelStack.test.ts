// Live desktop panel stack (Phase 7 plan 07-03, D-01, closes todo 008). The identity oracle is a LITERAL copy of the one-shot
// effect that app/NumogramClient.tsx ran before this phase (desktopPanelLayoutInitRef, about lines 1220 to 1249): the derived
// stack must place every panel it covers exactly where that effect did, at the measured base-10 heights and on 20,000 random
// height sets, and must follow every height change afterwards (a collapsed panel pulls the ones below it up).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_COLUMNS,
  DESKTOP_PANEL_BASE_Y,
  DESKTOP_PANEL_GAP,
  DESKTOP_PANEL_LEFT_X,
  DESKTOP_PANEL_RIGHT_X,
  INFO_PANEL_WIDTH,
  INITIAL_INFO_X,
  NAMES_BODY_MAX,
  NAMES_BODY_MIN,
  NAMES_MIN_X,
  NAMES_PANEL_WIDTH,
  PANEL_BOTTOM_RESERVE,
  PANEL_EDGE_GAP,
  PANEL_HEADER_HEIGHT,
  PANEL_WIDTH,
  STACK_PANEL_IDS,
  STACK_REPORTERS,
  computeDesktopStack,
  namesBodyMax,
  namesX,
  type StackPanelId,
} from '../../app/lib/panelStack'

type Heights = Partial<Record<StackPanelId, number>>
type Point = { x: number; y: number }

/** Measured base-10 heights at 1280 x 800 (07-RESEARCH Pattern 9): Text is collapsed (30), Selection is 296.5 tall. */
const MEASURED: Required<Pick<Heights, 'layers' | 'labels' | 'zones' | 'regions' | 'syz' | 'currents' | 'gates' | 'text' | 'info'>> = {
  layers: 146,
  labels: 101,
  zones: 270,
  regions: 145,
  syz: 143,
  currents: 143,
  gates: 270,
  text: 30,
  info: 296.5,
}

/**
 * LITERAL copy of the pre-07-03 one-shot effect (NumogramClient.tsx, constants 64 / 18 / 12 / 216 written out). Do not tidy it:
 * the association `(a + b) + c` and the `Math.round` at the end are the point.
 */
function oldFormula(h: Heights): Record<'layers' | 'labels' | 'zones' | 'syz' | 'regions' | 'currents' | 'gates' | 'text', Point> | null {
  const layersH = h.layers
  const labelsH = h.labels
  const zonesH = h.zones
  const regionsH = h.regions
  const currentsH = h.currents
  if (!(layersH && labelsH && zonesH && regionsH && currentsH)) return null

  const labelsY = 64 + layersH + 18
  const zonesY = labelsY + labelsH + 18
  const syzY = zonesY + zonesH + 18
  const currentsY = 64 + regionsH + 18
  const gatesY = currentsY + currentsH + 18
  return {
    layers: { x: 12, y: 64 },
    labels: { x: 12, y: Math.round(labelsY) },
    zones: { x: 12, y: Math.round(zonesY) },
    syz: { x: 12, y: Math.round(syzY) },
    regions: { x: 216, y: 64 },
    currents: { x: 216, y: Math.round(currentsY) },
    gates: { x: 216, y: Math.round(gatesY) },
    text: { x: 216, y: Math.round(gatesY + (h.gates ?? 34) + 18) },
  }
}

const OLD_COVERED = ['layers', 'labels', 'zones', 'syz', 'regions', 'currents', 'gates', 'text'] as const

describe('constants', () => {
  it('keeps the six NumogramClient values and adds the Names geometry', () => {
    expect(DESKTOP_PANEL_BASE_Y).toBe(64)
    expect(DESKTOP_PANEL_GAP).toBe(18)
    expect(DESKTOP_PANEL_LEFT_X).toBe(12)
    expect(DESKTOP_PANEL_RIGHT_X).toBe(216)
    expect(PANEL_WIDTH).toBe(180)
    expect(INFO_PANEL_WIDTH).toBe(320)
    expect(NAMES_PANEL_WIDTH).toBe(240)
    expect(PANEL_HEADER_HEIGHT).toBe(34)
    expect(PANEL_EDGE_GAP).toBe(12)
    expect(NAMES_MIN_X).toBe(548)
    expect(PANEL_BOTTOM_RESERVE).toBe(96)
    expect(NAMES_BODY_MIN).toBe(80)
    expect(NAMES_BODY_MAX).toBe(560)
    expect(INITIAL_INFO_X).toBe(420)
  })

  it('NAMES_MIN_X clears the Text panel open box (216 + 320) plus the edge gap', () => {
    expect(NAMES_MIN_X).toBe(DESKTOP_PANEL_RIGHT_X + INFO_PANEL_WIDTH + PANEL_EDGE_GAP)
  })
})

describe('STACK_PANEL_IDS and DESKTOP_COLUMNS', () => {
  it('lists the ten panels once each', () => {
    expect([...STACK_PANEL_IDS]).toEqual(['layers', 'labels', 'zones', 'syz', 'regions', 'currents', 'gates', 'text', 'info', 'names'])
    expect(new Set(STACK_PANEL_IDS).size).toBe(STACK_PANEL_IDS.length)
  })

  it('has the three columns in the contract order', () => {
    expect(DESKTOP_COLUMNS.map(c => c.column)).toEqual(['left', 'right', 'selection'])
    expect(DESKTOP_COLUMNS[0]!.panels).toEqual(['layers', 'labels', 'zones', 'syz'])
    expect(DESKTOP_COLUMNS[1]!.panels).toEqual(['regions', 'currents', 'gates', 'text'])
    expect(DESKTOP_COLUMNS[2]!.panels).toEqual(['info', 'names'])
  })

  it('places every panel in exactly one column', () => {
    const flat = DESKTOP_COLUMNS.flatMap(c => [...c.panels])
    expect([...flat].sort()).toEqual([...STACK_PANEL_IDS].sort())
  })

  it('STACK_REPORTERS are the five panels the old effect waited for', () => {
    expect([...STACK_REPORTERS]).toEqual(['layers', 'labels', 'zones', 'regions', 'currents'])
  })
})

describe('computeDesktopStack at the measured base-10 heights', () => {
  const out = computeDesktopStack(MEASURED, { selectionX: 942, vw: 1280 })

  it('is not null', () => {
    expect(out).not.toBeNull()
  })

  it('equals the old formula for every panel it covers', () => {
    const old = oldFormula(MEASURED)!
    for (const id of OLD_COVERED) expect(out![id], id).toEqual(old[id])
  })

  it('gives the tops measured in the browser (Labels 228, Zones 347, Syzygies 635, Currents 227, Gates 388, Text 676)', () => {
    expect(out!.layers).toEqual({ x: 12, y: 64 })
    expect(out!.labels).toEqual({ x: 12, y: 228 })
    expect(out!.zones).toEqual({ x: 12, y: 347 })
    expect(out!.syz).toEqual({ x: 12, y: 635 })
    expect(out!.regions).toEqual({ x: 216, y: 64 })
    expect(out!.currents).toEqual({ x: 216, y: 227 })
    expect(out!.gates).toEqual({ x: 216, y: 388 })
    expect(out!.text).toEqual({ x: 216, y: 676 })
  })

  it('puts Selection at selectionX, y 64 and Names under it (64 + 296.5 + 18 = 378.5 rounds to 379)', () => {
    expect(out!.info).toEqual({ x: 942, y: 64 })
    expect(out!.names).toEqual({ x: 942, y: 379 })
  })

  it('rounds the .5 tie up (the unrounded chain, Math.round at the end)', () => {
    // Without the final Math.round Names would sit at 378.5.
    expect(Number.isInteger(out!.names.y)).toBe(true)
    expect(out!.names.y).toBe(Math.round(64 + 296.5 + 18))
  })
})

describe('computeDesktopStack guard', () => {
  const reporters = ['layers', 'labels', 'zones', 'regions', 'currents'] as const

  it('returns null while any reporting panel is missing', () => {
    for (const missing of reporters) {
      const h: Heights = { ...MEASURED }
      delete h[missing]
      expect(computeDesktopStack(h, { selectionX: 942, vw: 1280 }), `missing ${missing}`).toBeNull()
    }
  })

  it('returns null while any reporting panel is 0', () => {
    for (const zero of reporters) {
      const h: Heights = { ...MEASURED, [zero]: 0 }
      expect(computeDesktopStack(h, { selectionX: 942, vw: 1280 }), `zero ${zero}`).toBeNull()
    }
  })

  it('returns null for no heights at all', () => {
    expect(computeDesktopStack({}, { selectionX: 942, vw: 1280 })).toBeNull()
  })

  it('does not wait for the panels that never gated the old effect (syz, gates, text, info)', () => {
    const h: Heights = { layers: 146, labels: 101, zones: 270, regions: 145, currents: 143 }
    const out = computeDesktopStack(h, { selectionX: 942, vw: 1280 })
    expect(out).not.toBeNull()
    // An unreported panel contributes the 34px header, as `desktopPanelHeights.gates ?? 34` did.
    expect(out!.text.y).toBe(oldFormula(h)!.text.y)
    expect(out!.names.y).toBe(Math.round(64 + 34 + 18))
  })

  it('agrees with the old guard on a sample of partial height sets', () => {
    const base: Heights = { layers: 146, labels: 101, zones: 270, regions: 145, currents: 143 }
    for (const id of reporters) {
      const h: Heights = { ...base }
      delete h[id]
      expect(computeDesktopStack(h, { selectionX: 100, vw: 1280 }) === null).toBe(oldFormula(h) === null)
    }
  })
})

describe('computeDesktopStack follows every height change', () => {
  const o = { selectionX: 942, vw: 1280 }

  it('a collapsed panel (30) contributes 30: Layers at 30 moves Labels, Zones and Syzygies up by exactly 146 - 30', () => {
    const open = computeDesktopStack(MEASURED, o)!
    const collapsed = computeDesktopStack({ ...MEASURED, layers: 30 }, o)!
    for (const id of ['labels', 'zones', 'syz'] as const) {
      expect(open[id].y - collapsed[id].y, id).toBe(146 - 30)
    }
    expect(collapsed.layers.y).toBe(64)
  })

  it('leaves the other columns alone when a left-column panel changes', () => {
    const open = computeDesktopStack(MEASURED, o)!
    const collapsed = computeDesktopStack({ ...MEASURED, layers: 30 }, o)!
    for (const id of ['regions', 'currents', 'gates', 'text', 'info', 'names'] as const) {
      expect(collapsed[id], id).toEqual(open[id])
    }
  })

  it('a taller Regions panel (the todo 008 base-28 case) moves Currents, Gates and Text down and never overlaps', () => {
    const tall = { ...MEASURED, regions: 186, zones: 530, gates: 530, syz: 332 }
    const out = computeDesktopStack(tall, o)!
    // Every panel starts at least 18 below the bottom of the panel above it in its column (the no-overlap rule).
    for (const col of DESKTOP_COLUMNS) {
      for (let i = 1; i < col.panels.length; i++) {
        const above = col.panels[i - 1]!
        const here = col.panels[i]!
        const h = (tall as Heights)[above] ?? PANEL_HEADER_HEIGHT
        expect(out[here].y, `${here} under ${above}`).toBeGreaterThanOrEqual(out[above].y + h + DESKTOP_PANEL_GAP - 0.5)
      }
    }
    expect(out.currents.y).toBe(Math.round(64 + 186 + 18))
  })

  it('Selection growing moves only Names', () => {
    const a = computeDesktopStack(MEASURED, o)!
    const b = computeDesktopStack({ ...MEASURED, info: 520 }, o)!
    expect(b.names.y).toBe(Math.round(64 + 520 + 18))
    for (const id of OLD_COVERED) expect(b[id], id).toEqual(a[id])
    expect(b.info).toEqual(a.info)
  })

  it('x comes from the column: 12, 216, selectionX and the Names rule', () => {
    const out = computeDesktopStack(MEASURED, { selectionX: 692, vw: 1024 })!
    for (const id of ['layers', 'labels', 'zones', 'syz'] as const) expect(out[id].x).toBe(12)
    for (const id of ['regions', 'currents', 'gates', 'text'] as const) expect(out[id].x).toBe(216)
    expect(out.info.x).toBe(692)
    expect(out.names.x).toBe(692)
  })

  it('does not mutate its inputs and returns a fresh object each call', () => {
    const h: Heights = { ...MEASURED }
    const before = JSON.stringify(h)
    const first = computeDesktopStack(h, o)!
    const second = computeDesktopStack(h, o)!
    expect(JSON.stringify(h)).toBe(before)
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })
})

describe('computeDesktopStack identity with the old formula (property)', () => {
  /**
   * Heights: any double in [20, 700], plus the two grids where the (a + b) + c versus a + (b + c) association flips a
   * Math.round tie (tenths and halves of a pixel; Selection is 296.5). The pure-double arm alone almost never lands on a tie.
   */
  const height = fc.oneof(
    fc.double({ min: 20, max: 700, noNaN: true }),
    fc.integer({ min: 200, max: 7000 }).map(n => n / 10),
    fc.integer({ min: 40, max: 1400 }).map(n => n / 2),
  )
  const heights = fc.record({
    layers: height,
    labels: height,
    zones: height,
    syz: height,
    regions: height,
    currents: height,
    gates: height,
    text: height,
    info: height,
  })

  it('matches the old formula for every left-column and right-column y on 20,000 random height sets (no ulp drift)', () => {
    fc.assert(
      fc.property(heights, h => {
        const old = oldFormula(h)!
        const out = computeDesktopStack(h, { selectionX: 942, vw: 1280 })!
        return OLD_COVERED.every(id => out[id].x === old[id].x && out[id].y === old[id].y)
      }),
      { seed: 20261020, numRuns: 20000 },
    )
  })

  it('names sits at round(64 + info + 18) for any Selection height', () => {
    fc.assert(
      fc.property(heights, h => {
        const out = computeDesktopStack(h, { selectionX: 942, vw: 1280 })!
        return out.info.y === 64 && out.names.y === Math.round(64 + h.info + 18)
      }),
      { seed: 20261020, numRuns: 2000 },
    )
  })

  it('pins four tenth-pixel cases where `y += h + GAP` would round one pixel off the old `(y + h) + GAP`', () => {
    // Found by a deterministic search over one-decimal heights: [h0, h1, h2, expected Syzygies top, expected Text top].
    // The same triplet feeds both columns (layers/labels/zones and regions/currents/gates). The other association gives
    // 469, 1187, 849 and 833 for the four expected tops, i.e. one pixel off every time.
    const ties: readonly (readonly [number, number, number, number])[] = [
      [74.4, 253.4, 23.7, 470],
      [465.4, 506.8, 97.3, 1188],
      [353.2, 255.4, 122.9, 850],
      [25.4, 577.8, 111.3, 832],
    ]
    for (const [a, b, c, top] of ties) {
      const t: Heights = { layers: a, labels: b, zones: c, regions: a, currents: b, gates: c, text: 30, info: 296.5 }
      const old = oldFormula(t)!
      const out = computeDesktopStack(t, { selectionX: 942, vw: 1280 })!
      expect(out.syz.y, `syz ${a} ${b} ${c}`).toBe(top)
      expect(out.text.y, `text ${a} ${b} ${c}`).toBe(top)
      for (const id of OLD_COVERED) expect(out[id], `${a} ${b} ${c} ${id}`).toEqual(old[id])
    }
  })
})

describe('namesX', () => {
  it.each([
    [489, 821, 548],
    [568, 900, 568],
    [659, 991, 659],
    [692, 1024, 692],
    [942, 1280, 942],
    [1022, 1440, 1022],
    [1200, 1280, 1028],
  ])('namesX(%d, %d) = %d', (selectionX, vw, expected) => {
    expect(namesX(selectionX, vw)).toBe(expected)
  })

  it('never exceeds vw - 252 and never goes below 548 unless the window is narrower than 800', () => {
    fc.assert(
      fc.property(fc.integer({ min: 12, max: 2000 }), fc.integer({ min: 821, max: 2600 }), (selectionX, vw) => {
        const x = namesX(selectionX, vw)
        return x <= vw - 252 && x >= 548
      }),
      { seed: 20261020, numRuns: 2000 },
    )
  })

  it('keeps the whole 240px box inside the window at 821px', () => {
    expect(namesX(489, 821) + NAMES_PANEL_WIDTH).toBeLessThanOrEqual(821)
  })
})

describe('namesBodyMax', () => {
  it.each([
    [379, 800, 291],
    [379, 768, 259],
    [600, 768, 80],
    [64, 1400, 560],
    [64, 667, 473],
  ])('namesBodyMax(%d, %d) = %d', (y, vh, expected) => {
    expect(namesBodyMax(y, vh)).toBe(expected)
  })

  it('always lands in [80, 560]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 100, max: 3000 }), (y, vh) => {
        const body = namesBodyMax(y, vh)
        return body >= 80 && body <= 560
      }),
      { seed: 20261020, numRuns: 2000 },
    )
  })

  it('is exactly vh - (y + 34) - 96 inside the clamp', () => {
    expect(namesBodyMax(300, 900)).toBe(900 - (300 + 34) - 96)
  })
})

// The procedural ladder (D-04): two columns, low zone left and high zone right, one row per pair, the highest pair
// on top. Reduces EXACTLY to the authored base-10 ladder at the default parameters (frame 800 x 870, centre
// (400, 450)): no minimum-frame clamp is applied here (unlike ringLayout/spiralLayout), so the base-10 numbers
// documented in engine/test/fixtures/base10.golden.json fall straight out of the formula.

import type { Numogram } from '../core/types'
import { resolveParams } from './params'
import type { Layout, LayoutGroup, LayoutParams, RegionLabel } from './types'

export interface LadderParams {
  readonly xLeft: number
  readonly xRight: number
  readonly top: number
  readonly rowGap: number
  readonly bottom: number
  readonly width: number
}

/**
 * Default ladder geometry for `base`: the row gap shrinks as the pair count grows, clamped between `params.s` and
 * 175 world units. At base 10 (5 pairs) `round(1400 / 5)` is exactly 175, so the defaults reproduce the authored
 * ladder's row spacing precisely.
 */
export function ladderDefaults(base: number, params: LayoutParams = resolveParams()): LadderParams {
  return {
    xLeft: 260,
    xRight: 540,
    top: 100,
    rowGap: Math.max(params.s, Math.min(175, Math.round(1400 / (base / 2)))),
    bottom: 70,
    width: 800,
  }
}

/**
 * The procedural ladder layout: pair q (0 <= q < base/2) is drawn in row `base/2 - 1 - q` (pair 0 at the bottom, the
 * largest pair id on top); its lo zone (= q, by the engine's pair-id convention) sits at `xLeft`, its hi zone
 * (= base - 1 - q) at `xRight`, both at the row's y. The frame is `a.width` wide and exactly tall enough for every
 * row plus the top and bottom margins (no minimum-frame clamp), then shrunk uniformly if it exceeds the cap.
 */
export function ladderLayout(g: Numogram, ladder?: LadderParams, overrides: Partial<LayoutParams> = {}): Layout {
  const p = resolveParams(overrides)
  const a = ladder ?? ladderDefaults(g.base, p)
  const n = g.base
  const P = n / 2

  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let q = 0; q < P; q++) {
    const row = P - 1 - q
    const yy = a.top + row * a.rowGap
    const hi = n - 1 - q
    x[q] = a.xLeft
    y[q] = yy
    x[hi] = a.xRight
    y[hi] = yy
  }

  const W = a.width
  const H = a.top + (P - 1) * a.rowGap + a.bottom
  const big = Math.max(W, H)
  const k = big > p.cap ? p.cap / big : 1
  if (k !== 1) {
    for (let z = 0; z < n; z++) {
      x[z] = (x[z] ?? 0) * k
      y[z] = (y[z] ?? 0) * k
    }
  }

  const width = W * k
  const height = H * k
  const center = { x: (W / 2) * k, y: (a.top + ((P - 1) * a.rowGap) / 2) * k }
  const natural = { width: W, height: H }
  const nodeRadius = p.r * k
  const labelSize = p.labelRatio * nodeRadius
  const strokeScale = Math.max(1, width / p.strokeBaseWidth)
  const scale = k

  const zoneGroup = new Int32Array(n).fill(-1)
  for (let z = 0; z < n; z++) zoneGroup[z] = g.cycleOfZone(z).id
  const groups: LayoutGroup[] = g.cycles.map(c => ({
    kind: c.kind,
    glyph: 'none',
    cycle: c.id,
    torqueIndex: c.torqueIndex,
    cx: center.x,
    cy: center.y,
    radius: 0,
    boundRadius: 0,
    nodeCount: c.zoneCount,
  }))

  const regionLabels: RegionLabel[] = []
  const plexPairId = g.plex.pairAt(0)
  const plexRow = P - 1 - plexPairId
  const plexRowY = a.top + plexRow * a.rowGap
  regionLabels.push({
    kind: 'plex',
    text: 'PLEX',
    x: (a.xLeft - 85) * k,
    y: (plexRowY + 4) * k,
    size: 0.5 * labelSize,
    opacity: 0.35,
    anchor: 'end',
  })
  if (g.warp !== null) {
    const warpPairId = g.warp.pairAt(0)
    const warpRow = P - 1 - warpPairId
    const warpRowY = a.top + warpRow * a.rowGap
    regionLabels.push({
      kind: 'warp',
      text: 'WARP',
      x: (a.xLeft - 85) * k,
      y: (warpRowY + 4) * k,
      size: 0.5 * labelSize,
      opacity: 0.35,
      anchor: 'end',
    })
  }

  const drawOrder = new Int32Array(n)
  for (let i = 0; i < n; i++) drawOrder[i] = i

  return {
    id: 'ladder',
    base: n,
    x,
    y,
    width,
    height,
    center,
    nodeRadius,
    nodeRadii: null,
    labelSize,
    strokeScale,
    scale,
    natural,
    groups,
    zoneGroup,
    drawOrder,
    regionLabels,
    routingStyle: 'ladder',
  }
}

// The default procedural layout (D-03): every Torque cycle drawn as a regular ring glyph (a 2L-gon, L = lengthInPairs),
// up to 3 nested concentrically (largest outermost) or 4+ packed without overlap by the chosen packer, the Plex and
// Warp capsules placed at the bottom centre outside the Torque composition (D-02), and the whole thing fit to a frame
// that grows with n up to the cap (D-06). Flow is anticlockwise on screen (D-01): the walk order odd(P0), even(P0),
// odd(P1), ... from Cycle.zones() is laid out in increasing screen angle, y growing downward.
//
// Deterministic: no RNG calls, no wall-clock reads; every discrete decision (nesting radii, packer placement) is
// quantized to 1/8 (format.ts) before any comparison.

import type { Cycle, Numogram, RegionKind } from '../core/types'
import { torqueLabel } from '../core/numerals'
import { applyFit, fitFrame, fitPoint } from './frame'
import { ceilQ } from './format'
import { packShelf, packSpiral } from './pack'
import { resolveParams } from './params'
import type { Layout, LayoutGroup, LayoutParams, RegionLabel } from './types'

/** The chord radius of a regular m-gon whose neighbouring vertices are s world units apart. */
export function chordRadius(m: number, s: number): number {
  return s / (2 * Math.sin(Math.PI / m))
}

/**
 * Places m nodes evenly around a circle of radius R centred at (cx, cy), anticlockwise on screen (D-01: y grows
 * downward, so increasing phi is anticlockwise). `phase0` shifts the whole ring: 0.5 (the ring layout) puts the
 * smallest pair (walk index 0 and 1) straddling the top; 0 (the pair graph) starts flush at the top.
 * `zoneAt(j)` maps walk position j (0 <= j < m) to the zone drawn there; `xs`/`ys` are written in place by zone index.
 */
export function ringNodes(
  m: number,
  R: number,
  cx: number,
  cy: number,
  phase0: number,
  xs: Float64Array,
  ys: Float64Array,
  zoneAt: (j: number) => number,
): void {
  for (let j = 0; j < m; j++) {
    const phi = Math.PI / 2 + (j - phase0) * ((2 * Math.PI) / m)
    const z = zoneAt(j)
    xs[z] = cx + R * Math.cos(phi)
    ys[z] = cy - R * Math.sin(phi)
  }
}

/** One Torque cycle's ring glyph geometry before it is placed: node count, chord radius R and bounding radius Rb. */
export interface TorqueGlyph {
  readonly cycle: Cycle
  readonly m: number
  readonly R: number
  readonly Rb: number
}

/** The ring glyph of every Torque cycle, in canonical order (largest first): `m = lengthInPairs * unitsPerPair` nodes. */
export function torqueGlyphs(g: Numogram, unitsPerPair: number, s: number, nodeR: number): TorqueGlyph[] {
  const glyphs: TorqueGlyph[] = []
  for (const c of g.torques) {
    const m = c.lengthInPairs * unitsPerPair
    const R = ceilQ(chordRadius(Math.max(2, m), s))
    const Rb = ceilQ(R + nodeR)
    glyphs.push({ cycle: c, m, R, Rb })
  }
  return glyphs
}

interface ComposedTorques {
  readonly gx: Float64Array
  readonly gy: Float64Array
  readonly ringR: Float64Array
  readonly nested: boolean
}

/**
 * Places the Torque ring glyphs: up to 3 nest concentrically at (0, 0) (D-03), largest outermost, radii adjusted so
 * every ring keeps at least its own chord radius and at least `nestDelta * s` of gap from the ring inside it; 4 or
 * more are packed without overlap by `params.packer` (their own radii, unmodified).
 */
export function composeTorques(glyphs: readonly TorqueGlyph[], params: LayoutParams, s: number): ComposedTorques {
  const k = glyphs.length
  if (k === 0) return { gx: new Float64Array(0), gy: new Float64Array(0), ringR: new Float64Array(0), nested: false }

  if (k <= 3) {
    const delta = params.nestDelta * s
    const ringR = new Float64Array(k)
    if (params.nestMode === 'compact') {
      ringR[k - 1] = glyphs[k - 1]?.R ?? 0
      for (let j = k - 2; j >= 0; j--) {
        const glyphR = glyphs[j]?.R ?? 0
        const next = ringR[j + 1] ?? 0
        ringR[j] = Math.max(glyphR, next + delta)
      }
    } else {
      const outer = glyphs[0]?.R ?? 0
      const rin = glyphs[k - 1]?.R ?? 0
      ringR[0] = outer
      for (let j = 1; j <= k - 1; j++) {
        const glyphR = glyphs[j]?.R ?? 0
        const interp = ceilQ(rin + ((outer - rin) * (k - 1 - j)) / (k - 1))
        ringR[j] = Math.max(glyphR, interp)
      }
      for (let j = k - 2; j >= 0; j--) {
        const next = ringR[j + 1] ?? 0
        const cur = ringR[j] ?? 0
        ringR[j] = Math.max(cur, next + delta)
      }
    }
    return { gx: new Float64Array(k), gy: new Float64Array(k), ringR, nested: true }
  }

  const Rb = new Float64Array(k)
  const ringR = new Float64Array(k)
  for (let i = 0; i < k; i++) {
    Rb[i] = glyphs[i]?.Rb ?? 0
    ringR[i] = glyphs[i]?.R ?? 0
  }
  const packed = params.packer === 'shelf' ? packShelf(Rb, params.glyphGap) : packSpiral(Rb, params.glyphGap)
  return { gx: packed.x, gy: packed.y, ringR, nested: false }
}

/** Places one Plex/Warp capsule: two nodes `s` apart, odd member on the left (D-02: the flow at the bottom runs left to right). */
function placeCapsule(
  cycle: Cycle,
  kind: RegionKind,
  cx: number,
  cy: number,
  p: LayoutParams,
  x: Float64Array,
  y: Float64Array,
  groups: LayoutGroup[],
  zoneGroup: Int32Array,
): void {
  const zs = cycle.zones() // [odd, even]
  const oddZone = zs[0] ?? 0
  const evenZone = zs[1] ?? 0
  x[oddZone] = cx - p.s / 2
  y[oddZone] = cy
  x[evenZone] = cx + p.s / 2
  y[evenZone] = cy
  const idx = groups.length
  groups.push({
    kind,
    glyph: 'capsule',
    cycle: cycle.id,
    torqueIndex: -1,
    cx,
    cy,
    radius: p.s / 2,
    boundRadius: p.s / 2 + p.r,
    nodeCount: 2,
  })
  zoneGroup[oddZone] = idx
  zoneGroup[evenZone] = idx
}

/**
 * The default procedural layout (D-03, D-04 'ring'): every Torque cycle a ring glyph, nested (<= 3) or packed (>= 4),
 * the Plex and Warp capsules at the bottom (D-02), fit to a frame that grows with n up to the cap (D-06). Base 2 and
 * 4 have no Torque cycles, so the layout is capsules only.
 */
export function ringLayout(g: Numogram, overrides: Partial<LayoutParams> = {}): Layout {
  const p = resolveParams(overrides)
  const n = g.base
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const zoneGroup = new Int32Array(n).fill(-1)
  const groups: LayoutGroup[] = []

  // Torque rings: nested or packed, largest first (canonical order).
  const glyphs = torqueGlyphs(g, 2, p.s, p.r)
  const comp = composeTorques(glyphs, p, p.s)
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i]
    if (glyph === undefined) continue
    const c = glyph.cycle
    const m = glyph.m
    const zs = c.zones()
    const cx = comp.gx[i] ?? 0
    const cy = comp.gy[i] ?? 0
    const radius = comp.ringR[i] ?? 0
    ringNodes(m, radius, cx, cy, 0.5, x, y, j => zs[j] ?? 0)
    const idx = groups.length
    groups.push({
      kind: 'torque',
      glyph: 'ring',
      cycle: c.id,
      torqueIndex: c.torqueIndex,
      cx,
      cy,
      radius,
      boundRadius: radius + p.r,
      nodeCount: m,
    })
    for (let j = 0; j < m; j++) {
      const z = zs[j] ?? 0
      zoneGroup[z] = idx
    }
  }

  // Composition bounds over the ring groups (explicit initial values; all 0 when there is no ring).
  const ringGroupCount = glyphs.length
  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0
  if (ringGroupCount > 0) {
    minX = Infinity
    maxX = -Infinity
    minY = Infinity
    maxY = -Infinity
    for (let i = 0; i < ringGroupCount; i++) {
      const grp = groups[i]
      if (grp === undefined) continue
      const bx0 = grp.cx - grp.boundRadius
      const bx1 = grp.cx + grp.boundRadius
      const by0 = grp.cy - grp.boundRadius
      const by1 = grp.cy + grp.boundRadius
      if (bx0 < minX) minX = bx0
      if (bx1 > maxX) maxX = bx1
      if (by0 < minY) minY = by0
      if (by1 > maxY) maxY = by1
    }
  }
  const ccx = (minX + maxX) / 2

  // Capsules (D-02): Plex always at the bottom centre; Warp beside it (default) or above it.
  const rings = ringGroupCount > 0
  const capY = rings ? maxY + p.capsuleGap + p.r : 0
  const capW = p.s + 2 * p.r
  if (p.capsulePlacement === 'above' && g.warp !== null) {
    placeCapsule(g.warp, 'warp', ccx, capY, p, x, y, groups, zoneGroup)
    placeCapsule(g.plex, 'plex', ccx, capY + 2 * p.r + p.capsuleGap, p, x, y, groups, zoneGroup)
  } else {
    placeCapsule(g.plex, 'plex', ccx, capY, p, x, y, groups, zoneGroup)
    if (g.warp !== null) placeCapsule(g.warp, 'warp', ccx - (capW + p.capsuleGap), capY, p, x, y, groups, zoneGroup)
  }

  // Frame: margin, 800x600 minimum and the 4096 cap (D-06).
  const fit = fitFrame(x, y, p.r, p)
  const fitted = applyFit(fit, x, y)
  const scaledGroups: LayoutGroup[] = groups.map(grp => {
    const center = fitPoint(fit, grp.cx, grp.cy)
    return { ...grp, cx: center.x, cy: center.y, radius: grp.radius * fit.scale, boundRadius: grp.boundRadius * fit.scale }
  })
  const center = rings ? fitPoint(fit, ccx, (minY + maxY) / 2) : { x: fit.width / 2, y: fit.height / 2 }

  const k = fit.scale
  const nodeRadius = p.r * k
  const labelSize = p.labelRatio * nodeRadius
  const strokeScale = Math.max(1, fit.width / p.strokeBaseWidth)
  const scale = k
  const natural = { width: fit.naturalWidth, height: fit.naturalHeight }

  const regionLabels: RegionLabel[] = []
  for (const grp of scaledGroups) {
    if (grp.glyph === 'ring') {
      regionLabels.push({
        kind: grp.kind,
        text: 'TORQUE ' + torqueLabel(grp.torqueIndex),
        x: grp.cx,
        y: grp.cy - grp.radius - nodeRadius - 0.6 * labelSize,
        size: 0.6 * labelSize,
        opacity: 0.45,
        anchor: 'middle',
      })
    } else if (grp.glyph === 'capsule') {
      regionLabels.push({
        kind: grp.kind,
        text: grp.kind === 'plex' ? 'PLEX' : 'WARP',
        x: grp.cx,
        y: grp.cy + nodeRadius + 1.4 * labelSize,
        size: 0.6 * labelSize,
        opacity: 0.5,
        anchor: 'middle',
      })
    }
  }

  const drawOrder = new Int32Array(n)
  for (let i = 0; i < n; i++) drawOrder[i] = i

  return {
    id: 'ring',
    base: n,
    x: fitted.x,
    y: fitted.y,
    width: fit.width,
    height: fit.height,
    center,
    nodeRadius,
    nodeRadii: null,
    labelSize,
    strokeScale,
    scale,
    natural,
    groups: scaledGroups,
    zoneGroup,
    drawOrder,
    regionLabels,
    routingStyle: 'default',
  }
}

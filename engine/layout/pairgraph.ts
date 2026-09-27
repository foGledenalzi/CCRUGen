// The syzygy-collapsed pair-graph view (D-08, LAY-04): one pill per pair labelled hi::lo in the numogram's own base,
// every Torque cycle as a clean ring of pill nodes (reusing torqueGlyphs/composeTorques/ringNodes from ring.ts with
// one unit per pair instead of two per zone), and Plex/Warp as self-looping pills at the bottom. routePairGraph draws
// the anticlockwise current arcs around each ring and the self loops of the fixed pairs.

import { formatNetSpan, torqueLabel } from '../core/numerals'
import type { Cycle, Numogram, RegionKind } from '../core/types'
import { fmt } from './format'
import { applyFit, fitFrame, fitPoint } from './frame'
import { resolveParams } from './params'
import { composeTorques, ringNodes, torqueGlyphs } from './ring'
import type { LayoutGroup, LayoutParams, PairGraphLayout, PairGraphRoutes, RegionLabel } from './types'

export const PAIR_GRAPH_DEFAULTS = Object.freeze({
  fontRatio: 0.72,
  heightRatio: 1.6,
  charWidth: 0.6,
  padRatio: 0.9,
  spacingRatio: 0.8,
  loopRatio: 0.55,
} as const)

/** Places one Plex/Warp pill: a single pair node at (cx, cy), a capsule group of one node. */
function placePairCapsule(
  cycle: Cycle,
  kind: RegionKind,
  cx: number,
  cy: number,
  halfDiag: number,
  px: Float64Array,
  py: Float64Array,
  groups: LayoutGroup[],
  pairGroupIdx: Int32Array,
): void {
  const pairId = cycle.pairAt(0)
  px[pairId] = cx
  py[pairId] = cy
  const idx = groups.length
  groups.push({
    kind,
    glyph: 'capsule',
    cycle: cycle.id,
    torqueIndex: -1,
    cx,
    cy,
    radius: 0,
    boundRadius: halfDiag,
    nodeCount: 1,
  })
  pairGroupIdx[pairId] = idx
}

/**
 * The syzygy-collapsed pair-graph layout: every Torque cycle drawn as a clean ring of pair pills (base 64: six
 * rings), Plex and Warp as pills at the bottom (beside each other). Pill size comes from the widest own-base
 * hi::lo net-span label at this base, so labels never overflow their pill.
 */
export function pairGraphLayout(g: Numogram, overrides: Partial<LayoutParams> = {}): PairGraphLayout {
  const p = resolveParams(overrides)
  const n = g.base
  const P = n / 2

  let maxChars = 0
  for (let q = 0; q < P; q++) {
    const len = formatNetSpan(n - 1 - q, q, n).length
    if (len > maxChars) maxChars = len
  }

  const f = PAIR_GRAPH_DEFAULTS.fontRatio * p.r
  const nodeH = PAIR_GRAPH_DEFAULTS.heightRatio * p.r
  const nodeW = Math.max(nodeH, maxChars * PAIR_GRAPH_DEFAULTS.charWidth * f + PAIR_GRAPH_DEFAULTS.padRatio * f)
  const halfDiag = Math.hypot(nodeW, nodeH) / 2
  const sp = 2 * halfDiag + PAIR_GRAPH_DEFAULTS.spacingRatio * nodeH

  const px = new Float64Array(P)
  const py = new Float64Array(P)
  const pairGroupIdx = new Int32Array(P).fill(-1)
  const groups: LayoutGroup[] = []

  const glyphs = torqueGlyphs(g, 1, sp, halfDiag)
  const comp = composeTorques(glyphs, p, sp)
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i]
    if (glyph === undefined) continue
    const c = glyph.cycle
    const L = glyph.m
    const cx = comp.gx[i] ?? 0
    const cy = comp.gy[i] ?? 0
    const radius = comp.ringR[i] ?? 0
    ringNodes(L, radius, cx, cy, 0, px, py, j => c.pairAt(j))
    const idx = groups.length
    groups.push({
      kind: 'torque',
      glyph: 'ring',
      cycle: c.id,
      torqueIndex: c.torqueIndex,
      cx,
      cy,
      radius,
      boundRadius: radius + halfDiag,
      nodeCount: L,
    })
    for (let j = 0; j < L; j++) {
      const pairId = c.pairAt(j)
      pairGroupIdx[pairId] = idx
    }
  }

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
  const rings = ringGroupCount > 0
  const capY = rings ? maxY + p.capsuleGap + halfDiag + 2 * p.r : 0

  placePairCapsule(g.plex, 'plex', ccx, capY, halfDiag, px, py, groups, pairGroupIdx)
  if (g.warp !== null) {
    placePairCapsule(g.warp, 'warp', ccx - (nodeW + p.capsuleGap + 2 * p.r), capY, halfDiag, px, py, groups, pairGroupIdx)
  }

  const zx = new Float64Array(n)
  const zy = new Float64Array(n)
  const zoneGroup = new Int32Array(n).fill(-1)
  for (let z = 0; z < n; z++) {
    const pairId = g.pairOf(z)
    zx[z] = px[pairId] ?? 0
    zy[z] = py[pairId] ?? 0
    zoneGroup[z] = pairGroupIdx[pairId] ?? -1
  }

  const fit = fitFrame(zx, zy, halfDiag, p, 2 * p.r)
  const fitted = applyFit(fit, zx, zy)

  const scaledGroups: LayoutGroup[] = groups.map(grp => {
    const center = fitPoint(fit, grp.cx, grp.cy)
    return { ...grp, cx: center.x, cy: center.y, radius: grp.radius * fit.scale, boundRadius: grp.boundRadius * fit.scale }
  })

  const finalPx = new Float64Array(P)
  const finalPy = new Float64Array(P)
  for (let q = 0; q < P; q++) {
    const pt = fitPoint(fit, px[q] ?? 0, py[q] ?? 0)
    finalPx[q] = pt.x
    finalPy[q] = pt.y
  }

  const k = fit.scale
  const nodeRadius = halfDiag * k
  const labelSize = PAIR_GRAPH_DEFAULTS.fontRatio * p.r * k
  const nodeWidth = nodeW * k
  const nodeHeight = nodeH * k
  const strokeScale = Math.max(1, fit.width / p.strokeBaseWidth)
  const scale = k
  const natural = { width: fit.naturalWidth, height: fit.naturalHeight }
  const center = rings ? fitPoint(fit, ccx, (minY + maxY) / 2) : { x: fit.width / 2, y: fit.height / 2 }

  const drawOrder = new Int32Array(n)
  for (let i = 0; i < n; i++) drawOrder[i] = i

  const regionLabels: RegionLabel[] = []
  for (const grp of scaledGroups) {
    if (grp.glyph === 'ring') {
      regionLabels.push({
        kind: grp.kind,
        text: 'TORQUE ' + torqueLabel(grp.torqueIndex),
        x: grp.cx,
        y: grp.cy - grp.radius - nodeHeight,
        size: labelSize,
        opacity: 0.45,
        anchor: 'middle',
      })
    } else if (grp.glyph === 'capsule') {
      regionLabels.push({
        kind: grp.kind,
        text: grp.kind === 'plex' ? 'PLEX' : 'WARP',
        x: grp.cx,
        y: grp.cy - nodeHeight,
        size: 0.8 * labelSize,
        opacity: 0.6,
        anchor: 'middle',
      })
    }
  }

  return {
    id: 'pairGraph',
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
    px: finalPx,
    py: finalPy,
    nodeWidth,
    nodeHeight,
  }
}

/**
 * The pair graph's routes: an anticlockwise current arc around the pair's Torque ring from its node to
 * `g.nextPair(q)`'s node, or a self loop hanging below a fixed pair's pill (Plex, Warp).
 */
export function routePairGraph(g: Numogram, pg: PairGraphLayout): PairGraphRoutes {
  const P = pg.px.length
  const arc: (string | null)[] = new Array(P).fill(null)
  const loop: (string | null)[] = new Array(P).fill(null)

  for (let q = 0; q < P; q++) {
    const x = pg.px[q] ?? 0
    const y = pg.py[q] ?? 0

    if (g.nextPair(q) === q) {
      const rr = PAIR_GRAPH_DEFAULTS.loopRatio * pg.nodeHeight
      const my = fmt(y + pg.nodeHeight / 2)
      loop[q] = 'M' + fmt(x - 0.8 * rr) + ' ' + my + 'A' + fmt(rr) + ' ' + fmt(rr) + ' 0 1 0 ' + fmt(x + 0.8 * rr) + ' ' + my
      continue
    }

    const grIdx = pg.zoneGroup[q] ?? -1
    const gr = pg.groups[grIdx]
    if (gr === undefined) continue
    const nxt = g.nextPair(q)
    const x2 = pg.px[nxt] ?? 0
    const y2 = pg.py[nxt] ?? 0
    const a1 = Math.atan2(-(y - gr.cy), x - gr.cx)
    const a2 = Math.atan2(-(y2 - gr.cy), x2 - gr.cx)
    const delta = (0.9 * pg.nodeRadius) / (gr.radius || 1)
    const b1 = a1 + delta
    const b2 = a2 - delta
    const R = gr.radius
    const sx = gr.cx + R * Math.cos(b1)
    const sy = gr.cy - R * Math.sin(b1)
    const ex = gr.cx + R * Math.cos(b2)
    const ey = gr.cy - R * Math.sin(b2)
    arc[q] = 'M' + fmt(sx) + ' ' + fmt(sy) + 'A' + fmt(R) + ' ' + fmt(R) + ' 0 0 0 ' + fmt(ex) + ' ' + fmt(ey)
  }

  return { arc, loop }
}

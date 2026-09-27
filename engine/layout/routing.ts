// Pure gate and current routing for procedural layouts (research Pattern 6): numeric ids, no name checks, no refs,
// O(n). Generalises app/lib/geometry.ts and the viewer's memos, which stay in the base-10 viewer until Phase 4.

import type { Numogram } from '../core/types'
import { fmt } from './format'
import type { GateRoutes, Layout, LayoutGroup, RouteOptions } from './types'

/** A discrete sign of a dot product: near-collinear (|dot| <= 1e-9) resolves the same way on every engine (+1). */
function sideOf(dot: number): 1 | -1 {
  if (dot > 1e-9) return 1
  if (dot < -1e-9) return -1
  return 1
}

function pt(x: number, y: number): string {
  return fmt(x) + ' ' + fmt(y)
}

function groupOf(layout: Layout, z: number): LayoutGroup | undefined {
  const gi = layout.zoneGroup[z] ?? -1
  return gi >= 0 ? layout.groups[gi] : undefined
}

/** The routing centre for a node: its ring's centre if it belongs to a ring glyph, else the layout's own centre. */
function centreOf(layout: Layout, z: number): { readonly x: number; readonly y: number } {
  const grp = groupOf(layout, z)
  if (grp !== undefined && grp.glyph === 'ring') return { x: grp.cx, y: grp.cy }
  return layout.center
}

/**
 * Every zone's gate (Gt-00 included and drawn): a concave curve that bends away from the layout centre, with lanes
 * separating gates sharing a destination, and a deterministic self loop (radial on a ring node, straight down on a
 * capsule node). Pure function of (g, layout); an optional `opts.orientation` lets a tween reuse a prior bulge side.
 */
export function routeGates(g: Numogram, layout: Layout, opts: RouteOptions = {}): GateRoutes {
  const n = g.base
  const r = layout.nodeRadius
  const k = layout.scale

  const to = new Int32Array(n)
  for (let z = 0; z < n; z++) to[z] = g.gate(z).to

  const cnt = new Int32Array(n)
  for (let z = 0; z < n; z++) {
    const t = to[z] ?? 0
    if (t !== z) cnt[t] = (cnt[t] ?? 0) + 1
  }
  let maxInDegree = 0
  for (let z = 0; z < n; z++) {
    const c = cnt[z] ?? 0
    if (c > maxInDegree) maxInDegree = c
  }

  const seen = new Int32Array(n)
  const d = new Array<string>(n)
  const labelX = new Float64Array(n)
  const labelY = new Float64Array(n)
  const loop = new Uint8Array(n)
  const orientation = new Int8Array(n)

  for (let z = 0; z < n; z++) {
    const t = to[z] ?? 0
    const x = layout.x[z] ?? 0
    const y = layout.y[z] ?? 0

    if (t === z) {
      const grp = groupOf(layout, z)
      let ux: number
      let uy: number
      if (grp !== undefined && grp.glyph === 'capsule') {
        ux = 0
        uy = 1
      } else {
        const c = centreOf(layout, z)
        const dx0 = x - c.x
        const dy0 = y - c.y
        const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0)
        if (len0 < 1e-9) {
          ux = 0
          uy = 1
        } else {
          ux = dx0 / len0
          uy = dy0 / len0
        }
      }
      const a = Math.atan2(uy, ux)
      const reach = 3.1 * r
      const sp = Math.PI / 3
      const sx = x + r * Math.cos(a - sp)
      const sy = y + r * Math.sin(a - sp)
      const ex = x + r * Math.cos(a + sp)
      const ey = y + r * Math.sin(a + sp)
      const cx = x + reach * Math.cos(a)
      const cy = y + reach * Math.sin(a)
      d[z] = 'M' + pt(sx, sy) + 'Q' + pt(cx, cy) + ' ' + pt(ex, ey)
      labelX[z] = (sx + 2 * cx + ex) / 4 + 0.8 * r * Math.cos(a)
      labelY[z] = (sy + 2 * cy + ey) / 4 + 0.8 * r * Math.sin(a)
      loop[z] = 1
      orientation[z] = 1
      continue
    }

    const tx = layout.x[t] ?? 0
    const ty = layout.y[t] ?? 0
    const dx = tx - x
    const dy = ty - y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    let sx: number
    let sy: number
    let ex: number
    let ey: number
    if (len <= 2 * r + 2) {
      sx = x
      sy = y
      ex = tx
      ey = ty
    } else {
      sx = x + r * ux
      sy = y + r * uy
      ex = tx - r * ux
      ey = ty - r * uy
    }

    const total = cnt[t] ?? 0
    const laneIndex = seen[t] ?? 0
    seen[t] = laneIndex + 1
    const lane = laneIndex - (total - 1) / 2

    const ddx = ex - sx
    const ddy = ey - sy
    const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1
    const nx = -ddy / dd
    const ny = ddx / dd
    const mx = (sx + ex) / 2
    const my = (sy + ey) / 2
    const dot = nx * (layout.center.x - mx) + ny * (layout.center.y - my)
    let toward = sideOf(dot)
    const override = opts.orientation?.[z] ?? 0
    if (override === 1 || override === -1) toward = override
    const bulge = -toward * dd * 0.18 + lane * 10 * k

    const cx = mx + nx * bulge
    const cy = my + ny * bulge
    d[z] = 'M' + pt(sx, sy) + 'Q' + pt(cx, cy) + ' ' + pt(ex, ey)
    labelX[z] = (sx + 2 * cx + ex) / 4
    labelY[z] = (sy + 2 * cy + ey) / 4
    orientation[z] = toward
  }

  return { d, labelX, labelY, loop, to, orientation, maxInDegree }
}

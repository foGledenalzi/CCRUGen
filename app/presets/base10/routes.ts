// Upstream-derived base-10 route geometry. Not relicensed by this repository; see NOTICE section 2.
// Moved in plan 04-04 from app/NumogramClient.tsx (the gateRenderData and currentRenderData memos). Only the 10-zone
// literals became engine-derived loops; serves the four authored base-10 layouts, procedural layouts use
// engine/layout/routing.ts.
import type { Numogram } from '../../../engine/index'
import type { CurrentData, CurrentRender, GateData, GateRender, Layout, Pos, SyzygyData } from '../../data/types'
import { curveAway, loopPath, midpoint, quadPath, syzMidBiased } from '../../lib/geometry'

export interface Base10RouteInput {
  readonly layout: Layout
  readonly pos: Record<number, Pos>
  readonly ctr: Pos
  readonly g: Numogram
  readonly gates: readonly GateData[]
  readonly currents: readonly CurrentData[]
  readonly syzygies: readonly SyzygyData[]
  readonly zoneRadius: (zone: number) => number
}

export function base10GateRender(input: Base10RouteInput): Record<string, GateRender> {
  const { layout, pos, ctr, g, gates, currents, syzygies, zoneRadius } = input
  const data: Record<string, GateRender> = {}
  const isPlanetary = layout === 'planetary'
  const connectionVectors: Record<number, Pos> = {}
  for (let z = 0; z < g.zoneCount; z++) connectionVectors[z] = { x: 0, y: 0 }
  const clearanceSegments: Array<{ a: Pos; b: Pos }> = []
  const connectedByZone: Record<number, Set<number>> = {}
  for (let z = 0; z < g.zoneCount; z++) connectedByZone[z] = new Set()
  const gateLanes = new Map<string, { lane: number }>()
  const addConnected = (a: number, b: number) => {
    if (a === b) return
    connectedByZone[a].add(b)
    connectedByZone[b].add(a)
  }
  const addConnectionVector = (a: number, b: number, weight = 1) => {
    const pa = pos[a]
    const pb = pos[b]
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    connectionVectors[a].x += ux * weight
    connectionVectors[a].y += uy * weight
    connectionVectors[b].x -= ux * weight
    connectionVectors[b].y -= uy * weight
    clearanceSegments.push({ a: pa, b: pb })
    addConnected(a, b)
  }
  for (const g of gates) {
    if (g.from === g.to) continue
    addConnectionVector(g.from, g.to, 1.2)
  }
  for (const c of currents) {
    const partner = g.partner(c.from)
    const dest = (c.name === 'Warp' || c.name === 'Plex') ? Math.min(c.from, partner) : c.to
    addConnectionVector(c.from, dest, 1)
    addConnectionVector(partner, dest, 1)
  }
  for (let z = 0; z < g.pairCount; z++) {
    addConnectionVector(z, g.partner(z), 0.5)
  }
  syzygies.forEach(s => addConnectionVector(s.a, s.b, 0.4))
  const gateEndpoints = (fromZone: number, toZone: number): { start: Pos; end: Pos } => {
    const from = pos[fromZone]
    const to = pos[toZone]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const rFrom = zoneRadius(fromZone)
    const rTo = zoneRadius(toZone)
    if (len <= rFrom + rTo + 2) return { start: from, end: to }
    const ux = dx / len
    const uy = dy / len
    return {
      start: { x: from.x + ux * rFrom, y: from.y + uy * rFrom },
      end: { x: to.x - ux * rTo, y: to.y - uy * rTo },
    }
  }
  const selfChannelArc = (z: number): { path: string; mid: Pos } => {
    const c = pos[z]
    const r = zoneRadius(z)
    const crowdVec = connectionVectors[z]
    const crowdMag = Math.sqrt(crowdVec.x * crowdVec.x + crowdVec.y * crowdVec.y)
    const preferredOutward = crowdMag > 0.001
      ? Math.atan2(-crowdVec.y, -crowdVec.x)
      : Math.atan2(c.y - ctr.y, c.x - ctr.x)
    let nearest = Number.POSITIVE_INFINITY
    connectedByZone[z].forEach(other => {
      const p = pos[other]
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < nearest) nearest = d
    })
    const baseReach = r * (isPlanetary ? 3.4 : 3.1)
    const adaptiveReach = Number.isFinite(nearest)
      ? Math.min(r * (isPlanetary ? 6.0 : 5.0), nearest * 0.78)
      : baseReach
    const loopReach = Math.max(baseReach, adaptiveReach)
    const pointSegDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax
      const dy = by - ay
      const l2 = dx * dx + dy * dy
      if (l2 <= 1e-6) {
        const ddx = px - ax
        const ddy = py - ay
        return Math.sqrt(ddx * ddx + ddy * ddy)
      }
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
      const qx = ax + t * dx
      const qy = ay + t * dy
      const ddx = px - qx
      const ddy = py - qy
      return Math.sqrt(ddx * ddx + ddy * ddy)
    }
    let outward = preferredOutward
    let bestScore = -Infinity
    const radialOut = Math.atan2(c.y - ctr.y, c.x - ctr.x)
    for (let i = 0; i < 72; i++) {
      const a = -Math.PI + (i / 72) * Math.PI * 2
      const px = c.x + Math.cos(a) * loopReach
      const py = c.y + Math.sin(a) * loopReach
      let minClearance = Number.POSITIVE_INFINITY
      for (const seg of clearanceSegments) {
        const d = pointSegDist(px, py, seg.a.x, seg.a.y, seg.b.x, seg.b.y)
        if (d < minClearance) minClearance = d
      }
      const alignPreferred = Math.cos(a - preferredOutward)
      const alignRadial = Math.cos(a - radialOut)
      const score = minClearance + alignPreferred * 10 + alignRadial * 2
      if (score > bestScore) {
        bestScore = score
        outward = a
      }
    }
    const spread = Math.PI / 3 // 60° each side => 120° apart
    const startA = outward - spread
    const endA = outward + spread
    const sx = c.x + Math.cos(startA) * r
    const sy = c.y + Math.sin(startA) * r
    const ex = c.x + Math.cos(endA) * r
    const ey = c.y + Math.sin(endA) * r
    const cx = c.x + Math.cos(outward) * loopReach
    const cy = c.y + Math.sin(outward) * loopReach
    const baseMid: Pos = {
      x: (sx + 2 * cx + ex) / 4,
      y: (sy + 2 * cy + ey) / 4,
    }
    const mid: Pos = {
      x: baseMid.x + Math.cos(outward) * (isPlanetary ? r * 0.6 : r * 0.8),
      y: baseMid.y + Math.sin(outward) * (isPlanetary ? r * 0.6 : r * 0.8),
    }
    return { path: `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}`, mid }
  }
  const concaveGatePath = (start: Pos, end: Pos, lane: number): { path: string; mid: Pos } => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const mx = (start.x + end.x) / 2
    const my = (start.y + end.y) / 2
    const px = -dy / dist
    const py = dx / dist
    // Force a single concave family for gates: bend away from the diagram center.
    const dot = px * (ctr.x - mx) + py * (ctr.y - my)
    const towardCenter = dot >= 0 ? 1 : -1
    const baseBulge = -towardCenter * dist * (isPlanetary ? 0.14 : 0.18)
    const laneBulge = lane * (isPlanetary ? 7 : 10)
    const bulge = baseBulge + laneBulge
    const cx = mx + px * bulge
    const cy = my + py * bulge
    return {
      path: `M${start.x} ${start.y}Q${cx} ${cy} ${end.x} ${end.y}`,
      mid: { x: (start.x + 2 * cx + end.x) / 4, y: (start.y + 2 * cy + end.y) / 4 },
    }
  }

  if (layout !== 'ladder') {
    const byDestination = new Map<number, GateData[]>()
    for (const gate of gates) {
      if (gate.from === gate.to) continue
      const group = byDestination.get(gate.to)
      if (group) group.push(gate)
      else byDestination.set(gate.to, [gate])
    }
    byDestination.forEach(group => {
      const ordered = [...group].sort((a, b) => a.from - b.from)
      const mid = (ordered.length - 1) / 2
      ordered.forEach((gate, index) => {
        gateLanes.set(gate.name, { lane: index - mid })
      })
    })
  }

  for (const gate of gates) {
    if (gate.from === gate.to) {
      const selfArc = selfChannelArc(gate.from)
      data[gate.name] = { type: 'loop', loop: selfArc.path, mid: selfArc.mid }
    } else {
      const { start, end } = gateEndpoints(gate.from, gate.to)
      const lane = layout === 'ladder' ? 0 : (gateLanes.get(gate.name)?.lane ?? 0)
      const { path, mid } = concaveGatePath(start, end, lane)
      data[gate.name] = {
        type: 'single',
        path,
        mid,
      }
    }
  }
  return data
}

export function base10CurrentRender(input: Base10RouteInput, orientationCache: Record<string, 1 | -1>): Record<string, CurrentRender> {
  const { layout, pos, ctr, g, currents } = input
  const data: Record<string, CurrentRender> = {}
  const isPlanetary = layout === 'planetary'
  const resolveCurrentOrientation = (currentName: string, dot: number): 1 | -1 => {
    const key = `${layout}:${currentName}`
    const cached = orientationCache[key]
    if (cached) return cached
    const chosen = (dot >= 0 ? 1 : -1) as 1 | -1
    orientationCache[key] = chosen
    return chosen
  }
  const curveTowardCenter = (currentName: string, from: Pos, to: Pos, factor: number): string => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2
    const px = -dy / dist
    const py = dx / dist
    const dot = px * (ctr.x - mx) + py * (ctr.y - my)
    const sign = resolveCurrentOrientation(currentName, dot)
    return quadPath(from, to, sign * dist * factor)
  }
  const equilateralCentroid = (currentName: string, a: Pos, b: Pos, preferInside: boolean): Pos => {
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const px = -dy / dist
    const py = dx / dist
    const centerDot = px * (ctr.x - mx) + py * (ctr.y - my)
    const towardCenter = resolveCurrentOrientation(currentName, centerDot)
    const side = preferInside ? towardCenter : -towardCenter
    const centroidOffset = (Math.sqrt(3) / 6) * dist
    return { x: mx + px * side * centroidOffset, y: my + py * side * centroidOffset }
  }
  const splitPairRoute = (currentName: string, dest: Pos, junction: Pos, bulgeFactor: number) => {
    const dx = junction.x - dest.x
    const dy = junction.y - dest.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const mx = (dest.x + junction.x) / 2
    const my = (dest.y + junction.y) / 2
    const px = -dy / dist
    const py = dx / dist
    // For the shared destination/junction segment:
    // dest->junction bends inward (concave), junction->dest bends outward (convex).
    const centerDot = px * (ctr.x - mx) + py * (ctr.y - my)
    const towardCenter = resolveCurrentOrientation(currentName, centerDot)
    const bulge = towardCenter * dist * bulgeFactor
    return {
      legToJunction: quadPath(dest, junction, bulge),
      stemToDest: quadPath(junction, dest, bulge),
    }
  }

  for (const c of currents) {
    const partner = g.partner(c.from)
    const lowerSyzygyZone = Math.min(c.from, partner)
    const convergesToLower = c.name === 'Warp' || c.name === 'Plex'
    const toZone = convergesToLower ? lowerSyzygyZone : c.to
    if (layout === 'ladder') {
      if (convergesToLower) {
        const zA = pos[c.from]
        const zB = pos[partner]
        const dest = pos[toZone]
        const other = c.from === toZone ? zB : zA
        const junction = equilateralCentroid(c.name, dest, other, true)
        const destIsA = c.from === toZone
        const nonDestSource = destIsA ? zB : zA
        const nonDestLeg = c.name === 'Plex' && !destIsA
          ? curveTowardCenter(c.name, nonDestSource, junction, 0.12)
          : curveAway(nonDestSource, junction, ctr.x, ctr.y, 0.12)
        const split = splitPairRoute(c.name, dest, junction, 0.24)
        data[c.name] = {
          type: 'yshape',
          legA: destIsA ? split.legToJunction : nonDestLeg,
          legB: destIsA ? nonDestLeg : split.legToJunction,
          stem: split.stemToDest,
          junction,
        }
      } else {
        const start = pos[c.from]
        const end = pos[c.to]
        const mid = midpoint(start, end)
        data[c.name] = { type: 'single', path: curveAway(start, end, ctr.x, ctr.y, 0.15), mid }
      }
    } else {
      const zA = pos[c.from]
      const zB = pos[partner]
      const syzMid = midpoint(zA, zB)
      const dest = pos[toZone]
      const isSelfRef = !convergesToLower && (c.to === c.from || c.to === partner)
      if (isSelfRef) {
        const pt = syzMidBiased(c.from, pos)
        const junction: Pos = { x: pt.x, y: pt.y + (pt.y > ctr.y ? 20 : -20) }
        const legCurve = isPlanetary ? 0.3 : 0.12
        data[c.name] = {
          type: 'loop',
          legA: curveAway(zA, junction, ctr.x, ctr.y, legCurve),
          legB: curveAway(zB, junction, ctr.x, ctr.y, legCurve),
          loop: loopPath(pt, pt.y > ctr.y ? 'below' : 'above'),
          junction,
        }
      } else {
        if (convergesToLower) {
          const destIsA = c.from === toZone
          const other = destIsA ? zB : zA
          const junction = equilateralCentroid(c.name, dest, other, true)
          const legCurve = isPlanetary ? 0.3 : 0.14
          const nonDestLeg = c.name === 'Plex' && !destIsA
            ? curveTowardCenter(c.name, other, junction, legCurve)
            : curveAway(other, junction, ctr.x, ctr.y, legCurve)
          const split = splitPairRoute(c.name, dest, junction, isPlanetary ? 0.2 : 0.3)
          data[c.name] = {
            type: 'yshape',
            legA: destIsA ? split.legToJunction : nonDestLeg,
            legB: destIsA ? nonDestLeg : split.legToJunction,
            stem: split.stemToDest,
            junction,
          }
          continue
        }
        const jFrac = isPlanetary ? 0.55 : 0.35
        const dx = dest.x - syzMid.x
        const dy = dest.y - syzMid.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const px = -dy / len
        const py = dx / len
        const centerDot = px * (ctr.x - syzMid.x) + py * (ctr.y - syzMid.y)
        const towardCenter = resolveCurrentOrientation(c.name, centerDot)
        const classOffset = towardCenter * (isPlanetary ? 7 : 11) // currents inside by default
        const junction: Pos = {
          x: syzMid.x + dx * jFrac + px * classOffset,
          y: syzMid.y + dy * jFrac + py * classOffset,
        }
        const legCurve = isPlanetary ? 0.3 : 0.12
        data[c.name] = {
          type: 'yshape',
          legA: curveAway(zA, junction, ctr.x, ctr.y, legCurve),
          legB: curveAway(zB, junction, ctr.x, ctr.y, legCurve),
          stem: isPlanetary
            ? curveAway(junction, dest, ctr.x, ctr.y, 0.12)
            : `M${junction.x} ${junction.y}L${dest.x} ${dest.y}`,
          junction,
        }
      }
    }
  }
  return data
}

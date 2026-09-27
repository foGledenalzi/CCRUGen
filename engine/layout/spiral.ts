// The Barker spiral (D-04): every pair on one anticlockwise Archimedean spiral ordered by destination, innermost
// pair n/2 - 1 (base 10: 4::5) to outermost pair 0 (0::9), the odd member of each pair drawn before the even member.
// "Barker" per the lore already shown in the app: 4::5 is the innermost curve, 0::9 the outermost.

import type { Numogram } from '../core/types'
import { applyFit, fitFrame, fitPoint } from './frame'
import { resolveParams } from './params'
import type { Layout, LayoutGroup, LayoutParams } from './types'

export interface SpiralParams {
  readonly inner: number
  readonly turn: number
  readonly stepIn: number
  readonly stepOut: number
}

/** Default spiral geometry: `turn` is the radial growth per full turn (the spiral's pitch). */
export function spiralDefaults(params: LayoutParams = resolveParams()): SpiralParams {
  return {
    inner: 1.2 * params.s,
    turn: 1.7 * params.s,
    stepIn: params.s,
    stepOut: 1.5 * params.s,
  }
}

/**
 * The Barker spiral layout: walking pair `n/2 - 1` down to pair `0` (destination ascending), each pair's odd member
 * is placed then its even member, at strictly increasing radius `rho = inner + b * theta` and strictly increasing
 * screen angle `theta` (anticlockwise: y = -rho * sin(theta), y growing downward on screen). `theta` advances by an
 * arclength-normalized step so consecutive nodes stay roughly `stepIn`/`stepOut` world units apart regardless of rho.
 */
export function spiralLayout(g: Numogram, spiral?: SpiralParams, overrides: Partial<LayoutParams> = {}): Layout {
  const p = resolveParams(overrides)
  const a = spiral ?? spiralDefaults(p)
  const n = g.base
  const P = n / 2
  const b = a.turn / (2 * Math.PI)

  const x = new Float64Array(n)
  const y = new Float64Array(n)
  let theta = 0
  for (let i = 0; i < P; i++) {
    const q = P - 1 - i
    const info = g.pair(q)
    for (let side = 0; side < 2; side++) {
      const z = side === 0 ? info.odd : info.even
      const rho = a.inner + b * theta
      x[z] = rho * Math.cos(theta)
      y[z] = -rho * Math.sin(theta)
      const step = side === 0 ? a.stepIn : a.stepOut
      theta += step / Math.sqrt(rho * rho + b * b)
    }
  }

  const fit = fitFrame(x, y, p.r, p)
  const fitted = applyFit(fit, x, y)
  const center = fitPoint(fit, 0, 0)

  const k = fit.scale
  const nodeRadius = p.r * k
  const labelSize = p.labelRatio * nodeRadius
  const strokeScale = Math.max(1, fit.width / p.strokeBaseWidth)
  const scale = k
  const natural = { width: fit.naturalWidth, height: fit.naturalHeight }

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

  const drawOrder = new Int32Array(n)
  for (let i = 0; i < n; i++) drawOrder[i] = i

  return {
    id: 'spiral',
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
    groups,
    zoneGroup,
    drawOrder,
    regionLabels: [],
    routingStyle: 'default',
  }
}

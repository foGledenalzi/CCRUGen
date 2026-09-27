// D-09 straight interpolation: two layouts of the same base are two equal-length coordinate arrays, so a layout
// switch is a straight line between them. The switch is instant above `tweenAllowed(n, table)` (engine/scene/tiers.ts);
// below it, routes are recomputed per frame from the interpolated positions, reusing the destination layout's
// orientation arrays (GateRoutes.orientation, CurrentRoutes.orientation) so a bulge or a junction side never flips
// mid-tween (research Pitfall 6). This module only moves points: it never touches a route's own SVG path string.

import type { Layout } from './types'

/**
 * Writes the straight-line interpolation of `from` and `to` at `t` into the caller-owned `outX`/`outY` (reused per
 * frame, never allocated here): `t = 0` copies `from` exactly, `t = 1` copies `to` exactly (a plain `.set`, not the
 * lerp formula, since `fx + (tx - fx)` is not always bit-identical to `tx` under IEEE 754). RangeError if the two
 * layouts are not the same base, `t` is outside `[0, 1]` (including `NaN`, which fails every comparison), or an
 * output array's length is not the base.
 */
export function lerpPositions(from: Layout, to: Layout, t: number, outX: Float64Array, outY: Float64Array): void {
  if (from.base !== to.base) throw new RangeError(`lerpPositions: base mismatch (${from.base} vs ${to.base})`)
  if (!(t >= 0 && t <= 1)) throw new RangeError(`lerpPositions: t must be within [0, 1], got ${t}`)
  const n = from.base
  if (outX.length !== n) throw new RangeError(`lerpPositions: outX length ${outX.length} != base ${n}`)
  if (outY.length !== n) throw new RangeError(`lerpPositions: outY length ${outY.length} != base ${n}`)
  if (t === 0) {
    outX.set(from.x)
    outY.set(from.y)
    return
  }
  if (t === 1) {
    outX.set(to.x)
    outY.set(to.y)
    return
  }
  for (let z = 0; z < n; z++) {
    const fx = from.x[z] ?? 0
    const tx = to.x[z] ?? 0
    outX[z] = fx + (tx - fx) * t
    const fy = from.y[z] ?? 0
    const ty = to.y[z] ?? 0
    outY[z] = fy + (ty - fy) * t
  }
}

// Default LayoutParams (D-06) and the override resolver every layout builder uses. Frozen data: no behaviour beyond
// the merge (the NUMOGRAM_CACHE_LIMITS frozen-data idiom of engine/core/numogram.ts).

import type { LayoutParams } from './types'

// packer 'spiral' per D-03 (the user's locked wording: golden-angle spiral candidates); research measured 'shelf' as
// tighter and cheaper, so it stays selectable and is shown on the contact sheet (plan 03-08) for the user to choose.
// cap 4096 is a datum (research A1).
export const DEFAULT_LAYOUT_PARAMS: LayoutParams = Object.freeze({
  r: 21,
  s: 84,
  labelRatio: 0.8,
  glyphGap: 84,
  nestDelta: 1.5,
  nestMode: 'even',
  packer: 'spiral',
  capsuleGap: 84,
  capsulePlacement: 'beside',
  margin: 70,
  minWidth: 800,
  minHeight: 600,
  cap: 4096,
  strokeBaseWidth: 800,
} as const)

/** DEFAULT_LAYOUT_PARAMS with `overrides` merged over it; a caller never needs to spell out fields it does not change. */
export function resolveParams(overrides: Partial<LayoutParams> = {}): LayoutParams {
  return { ...DEFAULT_LAYOUT_PARAMS, ...overrides }
}

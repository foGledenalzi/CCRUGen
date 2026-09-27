// Default LayoutParams (D-06) and the override resolver every layout builder uses. Frozen data: no behaviour beyond
// the merge (the NUMOGRAM_CACHE_LIMITS frozen-data idiom of engine/core/numogram.ts).

import type { LayoutParams } from './types'

// packer 'shelf' (research's tidy rows, tighter and cheaper) per the user's sign-off at the 03-08 contact-sheet
// checkpoint: D-03's golden-angle 'spiral' stays selectable and is still shown as the alternative on the sheet for
// every base with 4 or more Torque cycles, but is no longer the shipped default. cap 4096 is a datum (research A1).
export const DEFAULT_LAYOUT_PARAMS: LayoutParams = Object.freeze({
  r: 21,
  s: 84,
  labelRatio: 0.8,
  glyphGap: 84,
  nestDelta: 1.5,
  nestMode: 'even',
  packer: 'shelf',
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

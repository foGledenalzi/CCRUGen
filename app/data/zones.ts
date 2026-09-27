// Base-10 data seam (MIG-01). Lore text lives in app/presets/base10/lore.ts (CCRU-derived, see NOTICE).
import type { Region } from './types'

export { ZONE_CLR, ZONE_PARTICLE, PLANET_SYMBOL, ZONE_META } from '../presets/base10/lore'
export { ZONE_REGION } from '../presets/base10/regions'

// Hand-authored table kept only until the deletion commit of plan 02-11 (D-08).
export const LEGACY_ZONE_REGION: Record<number, Region> = {
  0: 'plex', 1: 'torque', 2: 'torque', 3: 'warp', 4: 'torque',
  5: 'torque', 6: 'warp', 7: 'torque', 8: 'torque', 9: 'plex',
}

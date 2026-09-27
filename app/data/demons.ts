// Base-10 data seam (MIG-01). Lore text lives in app/presets/base10/lore.ts (CCRU-derived, see NOTICE).
import { DEMON_NAMES } from '../presets/base10/lore'
import { TC } from '../presets/base10/regions'
import type { Demon } from './types'

export { ALL_DEMONS } from '../presets/base10/demons'
export { TC } from '../presets/base10/regions'

// Temporary hand-built copy, kept only to prove the new source equal (D-02); it is deleted in the next commit (D-08).
export const LEGACY_ALL_DEMONS: Demon[] = []
for (let i = 1; i < 10; i++)
  for (let j = 0; j < i; j++) {
    const isSyz = i + j === 9
    const kind = isSyz ? 'syzygy'
      : (TC.has(i) && TC.has(j)) ? 'chrono'
      : (!TC.has(i) && !TC.has(j)) ? 'xeno' : 'amphi'
    LEGACY_ALL_DEMONS.push({ a: i, b: j, name: DEMON_NAMES[i * (i - 1) / 2 + j] || '?', kind })
  }

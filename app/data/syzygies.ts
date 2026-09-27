// Base-10 data seam (MIG-01). Lore text lives in app/presets/base10/lore.ts (CCRU-derived, see NOTICE).
import { SYZYGY_LORE } from '../presets/base10/lore'
import type { SyzygyData } from './types'

// Swap 1 (plan 02-08): SYZYGIES is now derived by the engine and joined with lore in app/presets/base10/syzygies.ts.
export { SYZYGIES } from '../presets/base10/syzygies'

// The hand-authored structure, kept only until plan 02-08 Task 2 deletes it (D-08); the adapter test compares against it.
export const LEGACY_SYZYGIES: SyzygyData[] = [
  { a: 4, b: 5, demon: SYZYGY_LORE[4].demon, desc: SYZYGY_LORE[4].desc },
  { a: 3, b: 6, demon: SYZYGY_LORE[3].demon, desc: SYZYGY_LORE[3].desc },
  { a: 2, b: 7, demon: SYZYGY_LORE[2].demon, desc: SYZYGY_LORE[2].desc },
  { a: 1, b: 8, demon: SYZYGY_LORE[1].demon, desc: SYZYGY_LORE[1].desc },
  { a: 0, b: 9, demon: SYZYGY_LORE[0].demon, desc: SYZYGY_LORE[0].desc },
]

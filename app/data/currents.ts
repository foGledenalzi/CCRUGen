// Base-10 data seam (MIG-01). Lore text lives in app/presets/base10/lore.ts (CCRU-derived, see NOTICE).
import { CURRENT_LORE } from '../presets/base10/lore'
import type { CurrentData } from './types'

export const CURRENTS: CurrentData[] = [
  { name: CURRENT_LORE[1].name, from: 8, to: 7, label: '8\u22121=7', desc: CURRENT_LORE[1].desc },
  { name: CURRENT_LORE[2].name, from: 2, to: 5, label: '7\u22122=5', desc: CURRENT_LORE[2].desc },
  { name: CURRENT_LORE[4].name, from: 4, to: 1, label: '5\u22124=1', desc: CURRENT_LORE[4].desc },
  { name: CURRENT_LORE[3].name, from: 6, to: 3, label: '6\u22123=3', desc: CURRENT_LORE[3].desc },
  { name: CURRENT_LORE[0].name, from: 9, to: 9, label: '9\u22120=9', desc: CURRENT_LORE[0].desc },
]

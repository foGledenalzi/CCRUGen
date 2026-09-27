// Base-10 data seam (MIG-01). Lore text lives in app/presets/base10/lore.ts (CCRU-derived, see NOTICE).
import { GATE_LORE } from '../presets/base10/lore'
import type { GateData } from './types'

export { GATE_LIST } from '../presets/base10/gates'

// The hand-authored list, kept only until the deletion commit (D-02, D-08); nothing imports it but the swap's equality test.
export const LEGACY_GATE_LIST: GateData[] = [
  { name: 'Gt-00', from: 0, to: 0, cum: 0, desc: GATE_LORE[0].desc, detail: GATE_LORE[0].detail },
  { name: 'Gt-01', from: 1, to: 1, cum: 1, desc: GATE_LORE[1].desc, detail: GATE_LORE[1].detail },
  { name: 'Gt-03', from: 2, to: 3, cum: 3, desc: GATE_LORE[2].desc, detail: GATE_LORE[2].detail },
  { name: 'Gt-06', from: 3, to: 6, cum: 6, desc: GATE_LORE[3].desc, detail: GATE_LORE[3].detail },
  { name: 'Gt-10', from: 4, to: 1, cum: 10, desc: GATE_LORE[4].desc, detail: GATE_LORE[4].detail },
  { name: 'Gt-15', from: 5, to: 6, cum: 15, desc: GATE_LORE[5].desc, detail: GATE_LORE[5].detail },
  { name: 'Gt-21', from: 6, to: 3, cum: 21, desc: GATE_LORE[6].desc, detail: GATE_LORE[6].detail },
  { name: 'Gt-28', from: 7, to: 1, cum: 28, desc: GATE_LORE[7].desc, detail: GATE_LORE[7].detail },
  { name: 'Gt-36', from: 8, to: 9, cum: 36, desc: GATE_LORE[8].desc, detail: GATE_LORE[8].detail },
  { name: 'Gt-45', from: 9, to: 9, cum: 45, desc: GATE_LORE[9].desc, detail: GATE_LORE[9].detail },
]

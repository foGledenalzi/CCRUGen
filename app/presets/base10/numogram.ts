// Base-10 engine instance for the preset adapter (MIG-01, D-01). Original CCRUG code (MIT, NOTICE section 1).
import { createNumogram } from '../../../engine/index'

export const BASE10 = createNumogram(10)

if (BASE10.torqueCount !== 1 || BASE10.warp === null) {
  throw new Error('base-10 preset: expected exactly one Torque cycle and a Warp')
}

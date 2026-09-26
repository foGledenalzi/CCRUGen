// @ccrug/engine: the pure numogram engine (Phase 2 fills this in).
// Boundary (FND-04), enforced by `tsc -p engine/tsconfig.json` and the engine override in .eslintrc.json:
// no DOM or Node types, relative imports only, no O(n^2) materialization, no Math.random / Date.now / new Date().
export { MAX_BASE, validateBase, assertBase } from './core/base'
export type { BaseCheck, BaseProblem } from './core/base'
export { triangular, digitalRoot } from './core/arith'
export {
  NUMERAL_DIGITS,
  NUMERAL_SEPARATOR,
  digitsOf,
  formatNumeral,
  parseNumeral,
  formatNetSpan,
  formatGateName,
  torqueLabel,
} from './core/numerals'
export { DEMON_TYPES, DEMON_SUBTYPES } from './core/types'
export type {
  RegionKind,
  Cycle,
  PairInfo,
  CurrentInfo,
  GateInfo,
  Numogram,
  DemonType,
  DemonSubtype,
  DemonRef,
  DemonSelection,
  DemonSpace,
} from './core/types'

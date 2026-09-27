// Scene barrel (03-07): svgString's pure emitters, tiers.ts's selection/derivation/validation helpers and schema
// types, and the committed TIER_TABLE data. Re-exported through engine/index.ts.

export { layoutToSvg, pairGraphToSvg, escapeXml, groupColour } from './svgString'
export type { SvgOptions } from './svgString'

export {
  RENDER_TIERS,
  DEVICE_PROFILES,
  MEASURED_SUITES,
  selectTier,
  parseTierOverride,
  tweenAllowed,
  labelsVisible,
  gateLayerMode,
  deriveBoundaries,
  validateTierTable,
} from './tiers'
export type {
  RenderTier,
  DeviceProfile,
  MeasuredSuite,
  Stat,
  EnvironmentMeta,
  TierMeasurement,
  ChordMeasurement,
  CanvasProbe,
  HeadlessMeasurement,
  TierBudgets,
  Boundary,
  TierBoundaries,
  MemoryModel,
  TierTable,
  DerivedBoundaries,
} from './tiers'

export { TIER_TABLE } from './tierTable'

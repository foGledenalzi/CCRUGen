// Layout barrel (03-07): every public name of engine/layout, re-exported through engine/index.ts. Values and types
// are listed separately (`export { ... }` vs `export type { ... }`) so a type-only importer (for example
// app/presets/base10/layouts.ts) never pulls layout runtime into its bundle.

export { LAYOUT_IDS, PACKERS, CAPSULE_PLACEMENTS } from './types'
export type {
  LayoutId,
  Packer,
  CapsulePlacement,
  RoutingStyle,
  GlyphKind,
  TextAnchor,
  Point,
  LayoutParams,
  LayoutGroup,
  RegionLabel,
  Layout,
  PairGraphLayout,
  LayoutSpec,
  GateRoutes,
  CurrentRoutes,
  PairGraphRoutes,
  RouteOptions,
} from './types'

export { DEFAULT_LAYOUT_PARAMS, resolveParams } from './params'

export { QUANTUM, ceilQ, roundQ, fmt } from './format'

export { packSpiral, packShelf } from './pack'
export type { PackResult } from './pack'

export { fitFrame, applyFit, fitPoint } from './frame'
export type { FrameFit } from './frame'

export { chordRadius, ringNodes, torqueGlyphs, composeTorques, ringLayout } from './ring'
export type { TorqueGlyph } from './ring'

export { ladderDefaults, ladderLayout } from './ladder'
export type { LadderParams } from './ladder'

export { spiralDefaults, spiralLayout } from './spiral'
export type { SpiralParams } from './spiral'

export { PAIR_GRAPH_DEFAULTS, pairGraphLayout, routePairGraph } from './pairgraph'

export { routeGates, routeCurrents } from './routing'

export { PROCEDURAL_LAYOUT_SPECS, resolveLayout, layoutIdsFor } from './registry'

export { lerpPositions } from './tween'

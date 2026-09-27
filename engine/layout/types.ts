// Public contracts of engine/layout: the Layout, LayoutGroup, RegionLabel, PairGraphLayout, LayoutSpec, LayoutParams,
// GateRoutes, CurrentRoutes, PairGraphRoutes and RouteOptions shapes every layout module builds against. Pure types
// plus three constant tuples: no behaviour lives here.
//
// Units are always stated: world units are the layout's own coordinates (viewBox units, y grows downward); screen
// pixels are the renderer's concern; a pair is a syzygy, a zone is one digit.

import type { Numogram, RegionKind } from '../core/types'

export const LAYOUT_IDS = ['ring', 'ladder', 'spiral'] as const          // procedural zone layouts offered for every even base (D-04)
export type LayoutId = (typeof LAYOUT_IDS)[number]
export const PACKERS = ['spiral', 'shelf'] as const                        // 'spiral' = golden-angle first fit (D-03, default); 'shelf' = rows
export type Packer = (typeof PACKERS)[number]
export const CAPSULE_PLACEMENTS = ['beside', 'above'] as const            // D-02: Warp capsule beside (left of) or above the Plex capsule
export type CapsulePlacement = (typeof CAPSULE_PLACEMENTS)[number]
export type RoutingStyle = 'default' | 'ladder' | 'planetary'              // replaces the viewer's layout-name checks in Phase 4
export type GlyphKind = 'ring' | 'capsule' | 'none'
export type TextAnchor = 'start' | 'middle' | 'end'
export interface Point { readonly x: number; readonly y: number }

export interface LayoutParams {
  readonly r: number                  // node radius, world units at scale 1 (base-10 viewer: 21)
  readonly s: number                  // minimum centre spacing of neighbouring ring nodes (4 r)
  readonly labelRatio: number         // zone label font size = labelRatio * node radius (viewer: 17 / 21)
  readonly glyphGap: number           // minimum gap between packed ring glyph bounding circles
  readonly nestDelta: number          // minimum radial gap between nested rings, in units of s
  readonly nestMode: 'even' | 'compact'
  readonly packer: Packer
  readonly capsuleGap: number         // gap between the Torque composition and the capsule row, and between capsules
  readonly capsulePlacement: CapsulePlacement
  readonly margin: number             // frame margin around all node discs
  readonly minWidth: number           // minimum frame (small bases keep the base-10 look)
  readonly minHeight: number
  readonly cap: number                // frame growth cap (world units); beyond it everything scales by cap / max(w, h)
  readonly strokeBaseWidth: number    // strokeScale = max(1, width / strokeBaseWidth)
}

export interface LayoutGroup {
  readonly kind: RegionKind
  readonly glyph: GlyphKind           // 'ring' = Torque ring, 'capsule' = Plex/Warp capsule or pill, 'none' = not drawn as a glyph
  readonly cycle: number              // Cycle.id
  readonly torqueIndex: number        // -1 for plex and warp
  readonly cx: number; readonly cy: number   // ring or capsule centre, world units (layout centre for 'none')
  readonly radius: number             // ring radius (ring), half the member spacing (capsule), 0 (none)
  readonly boundRadius: number        // radius + node radius (ring, capsule), 0 (none)
  readonly nodeCount: number          // nodes drawn in the glyph (ring: 2L zones, pair graph: L pairs, capsule: 2 or 1)
}

export interface RegionLabel {
  readonly kind: RegionKind
  readonly text: string
  readonly x: number; readonly y: number
  readonly size: number               // font size, world units
  readonly opacity: number
  readonly anchor: TextAnchor
}

export interface Layout {
  readonly id: string                 // LayoutId, 'pairGraph', or a preset id ('original', ...)
  readonly base: number
  readonly x: Float64Array            // world x by zone (length base)
  readonly y: Float64Array            // world y by zone
  readonly width: number              // frame: viewBox = 0 0 width height
  readonly height: number
  readonly center: Point              // routing centre: gates bend away from it
  readonly nodeRadius: number         // uniform node radius, world units
  readonly nodeRadii: Float64Array | null   // per-zone override (base-10 planetary), null = uniform
  readonly labelSize: number          // zone label font size, world units
  readonly strokeScale: number        // >= 1: multiplies hairline widths so they survive fit-to-panel zoom
  readonly scale: number              // (0, 1]: uniform shrink applied by the growth cap
  readonly natural: { readonly width: number; readonly height: number }   // content size before the cap and the minimum frame
  readonly groups: readonly LayoutGroup[]
  readonly zoneGroup: Int32Array      // index into groups by zone, -1 = in no group
  readonly drawOrder: Int32Array      // zones back to front
  readonly regionLabels: readonly RegionLabel[]
  readonly routingStyle: RoutingStyle
}

export interface PairGraphLayout extends Layout {
  readonly px: Float64Array           // pair node x by pair id (length base / 2); x/y by zone put both members on their pair node (D-09)
  readonly py: Float64Array
  readonly nodeWidth: number          // pill size, world units
  readonly nodeHeight: number
}

export interface LayoutSpec {
  readonly id: string
  readonly label: string
  supports(g: Numogram): boolean
  build(g: Numogram): Layout
}

export interface GateRoutes {
  readonly d: readonly string[]       // SVG path by origin zone; every zone has a gate (Gt-00 included, drawn)
  readonly labelX: Float64Array; readonly labelY: Float64Array
  readonly loop: Uint8Array           // 1 = self gate (to === from)
  readonly to: Int32Array
  readonly orientation: Int8Array     // bulge side used per gate (+1 / -1), reusable by a tween (D-09)
  readonly maxInDegree: number
}
export interface CurrentRoutes {
  readonly kind: Uint8Array           // by pair id: 0 = Y (destination outside the pair), 1 = fixed pair (destination is a member)
  readonly legA: readonly string[]    // from the odd member
  readonly legB: readonly string[]    // from the even member
  readonly stem: readonly string[]
  readonly junctionX: Float64Array; readonly junctionY: Float64Array
  readonly orientation: Int8Array
}
export interface PairGraphRoutes {
  readonly arc: readonly (string | null)[]    // by pair id: current arc along a Torque ring, null for fixed pairs
  readonly loop: readonly (string | null)[]   // by pair id: self loop of a fixed pair (Plex, Warp), null otherwise
}
export interface RouteOptions { readonly orientation?: Int8Array }   // 0 entries = use the geometric sign

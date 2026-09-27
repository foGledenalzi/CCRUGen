// Upstream-derived base-10 layout data. Not relicensed by this repository; see NOTICE section 2.
// Tables copied verbatim in plan 03-05 from app/data/positions.ts (coordinates), app/NumogramClient.tsx (draw orders,
// lines 1307-1315), app/hooks/useTween.ts (frame heights, line 42) and app/components/projection/Projection.tsx
// (region labels, lines 1022-1061); those files keep their own copies until Phase 4.
import type { Layout, Pos } from '../../data/types'
import type { RegionLabel } from '../../../engine/layout/types'

export const P_ORIGINAL: Record<number, Pos> = {
  6: { x: 250, y: 85 }, 3: { x: 420, y: 115 },
  2: { x: 560, y: 275 }, 7: { x: 580, y: 400 },
  5: { x: 250, y: 370 }, 4: { x: 178, y: 480 },
  1: { x: 400, y: 550 }, 8: { x: 400, y: 660 },
  9: { x: 400, y: 770 }, 0: { x: 400, y: 875 },
}

export const P_LABYRINTH: Record<number, Pos> = {
  6: { x: 305, y: 60 }, 3: { x: 495, y: 60 },
  2: { x: 400, y: 220 },
  5: { x: 200, y: 335 }, 7: { x: 600, y: 335 },
  4: { x: 200, y: 540 }, 8: { x: 600, y: 540 },
  1: { x: 400, y: 655 },
  9: { x: 305, y: 815 }, 0: { x: 495, y: 815 },
}

export const P_LADDER: Record<number, Pos> = {
  4: { x: 260, y: 100 }, 5: { x: 540, y: 100 },
  3: { x: 260, y: 275 }, 6: { x: 540, y: 275 },
  2: { x: 260, y: 450 }, 7: { x: 540, y: 450 },
  1: { x: 260, y: 625 }, 8: { x: 540, y: 625 },
  0: { x: 260, y: 800 }, 9: { x: 540, y: 800 },
}

export const PLANETARY_CX = 400
export const PLANETARY_CY = 400

export const PLANETARY_RADIUS: Record<number, number> = {
  0: 0, 1: 55, 2: 95, 3: 130, 4: 165, 5: 210, 6: 255, 7: 295, 8: 330, 9: 360,
}

export const PLANETARY_DEFAULT_ANGLE: Record<number, number> = {
  0: 0, 1: 250, 2: 210, 3: 170, 4: 130, 5: 310, 6: 350, 7: 30, 8: 70, 9: 0,
}

export const PLANETARY_SIZE: Record<number, number> = {
  0: 30, 1: 12, 2: 16, 3: 17, 4: 14, 5: 26, 6: 24, 7: 21, 8: 20, 9: 11,
}

export const CENTER: Record<Layout, Pos> = {
  labyrinth: { x: 400, y: 438 },
  ladder: { x: 400, y: 450 },
  original: { x: 400, y: 460 },
  planetary: { x: 400, y: 400 },
}

// Sizing shared by every base-10 preset (D-05); procedural layouts (in the engine) compute their own.
export const FRAME_WIDTH = 800
export const NODE_RADIUS = 21
export const LABEL_SIZE = 17

// Draw order (back to front), copied from app/NumogramClient.tsx's zoneOrder memo. Planetary's order is computed
// (zones sorted by y) rather than tabulated, since it depends on the planetary positions.
export const DRAW_ORDER: Readonly<Record<'original' | 'labyrinth' | 'ladder', readonly number[]>> = {
  original: [6, 3, 2, 7, 5, 4, 1, 8, 9, 0],
  labyrinth: [6, 3, 8, 7, 1, 2, 4, 5, 9, 0],
  ladder: [4, 5, 3, 6, 2, 7, 1, 8, 0, 9],
}

// Frame heights (viewBox = 0 0 800 height), copied from app/hooks/useTween.ts's targetHeight ternary.
export const FRAME_HEIGHT: Readonly<Record<Layout, number>> = {
  original: 940,
  labyrinth: 880,
  ladder: 870,
  planetary: 800,
}

// Region label text, position, size, opacity and anchor, copied from Projection.tsx's RegionLabels sub-component.
// Planetary draws no Plex/Warp/Torque labels (its caption and orbit rings are the viewer's, not generalized).
export const REGION_LABELS: Readonly<Record<Layout, readonly RegionLabel[]>> = {
  original: [
    { kind: 'warp', text: 'WARP', x: 335, y: 45, size: 8, opacity: 0.35, anchor: 'middle' },
    { kind: 'plex', text: 'PLEX', x: 400, y: 930, size: 8, opacity: 0.35, anchor: 'middle' },
  ],
  labyrinth: [
    { kind: 'warp', text: 'WARP', x: 400, y: 20, size: 9, opacity: 0.4, anchor: 'middle' },
    { kind: 'torque', text: 'TORQUE', x: 400, y: 438, size: 9, opacity: 0.25, anchor: 'middle' },
    { kind: 'plex', text: 'PLEX', x: 400, y: 865, size: 9, opacity: 0.4, anchor: 'middle' },
  ],
  ladder: [
    { kind: 'warp', text: 'WARP', x: 175, y: 280, size: 8, opacity: 0.35, anchor: 'end' },
    { kind: 'plex', text: 'PLEX', x: 175, y: 804, size: 8, opacity: 0.35, anchor: 'end' },
  ],
  planetary: [],
}

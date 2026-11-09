// Live desktop panel stack (Phase 7 D-01, closes todo 008): positions are DERIVED from measured heights on every change; only
// dragged panels keep stored positions (app/lib/panelDrag.ts). Original CCRUG code (MIT, NOTICE section 1).

// The six constants below moved here from app/NumogramClient.tsx (module-private there) with their values unchanged.
export const DESKTOP_PANEL_BASE_Y = 64
export const DESKTOP_PANEL_GAP = 18
export const DESKTOP_PANEL_LEFT_X = 12
export const DESKTOP_PANEL_RIGHT_X = 216
export const PANEL_WIDTH = 180
export const INFO_PANEL_WIDTH = 320

// Names panel geometry (07-UI-SPEC "Desktop Panel Stack Rule"). [default] values the UI-SPEC lists under "Decisions Made Here".
/** Names is wider than the 180px panels: a 16-character sound needs the room. */
export const NAMES_PANEL_WIDTH = 240
/** The collapsed-header height `CyberPanel` uses before it has measured itself (a measured collapsed header is about 30). */
export const PANEL_HEADER_HEIGHT = 34
/** The gap kept between a panel and the window edge. */
export const PANEL_EDGE_GAP = 12
/** Names never sits left of this x: 548 clears the Text panel's open box (216 + 320) plus the edge gap. */
export const NAMES_MIN_X = DESKTOP_PANEL_RIGHT_X + INFO_PANEL_WIDTH + PANEL_EDGE_GAP
/** Room kept below an open Names box for the zoom toolbar and the shortcuts button (both fixed at the bottom right, z 74). */
export const PANEL_BOTTOM_RESERVE = 96
/** The Names body is never forced above this: the sticky header plus two rows; it shrinks to it and scrolls. */
export const NAMES_BODY_MIN = 80
export const NAMES_BODY_MAX = 560
/** Where Selection sat before the viewer measured the diagram (usePanelDrag's initial value). */
export const INITIAL_INFO_X = 420

export const STACK_PANEL_IDS = ['layers', 'labels', 'zones', 'syz', 'regions', 'currents', 'gates', 'text', 'info', 'names'] as const
export type StackPanelId = (typeof STACK_PANEL_IDS)[number]

/** The three desktop columns, each listed top to bottom. Names sits directly under Selection. */
export const DESKTOP_COLUMNS: readonly { readonly column: 'left' | 'right' | 'selection'; readonly panels: readonly StackPanelId[] }[] = [
  { column: 'left', panels: ['layers', 'labels', 'zones', 'syz'] },
  { column: 'right', panels: ['regions', 'currents', 'gates', 'text'] },
  { column: 'selection', panels: ['info', 'names'] },
]

/** The panels the old one-shot effect waited on: the stack is not applied until every one of them has reported a height. */
export const STACK_REPORTERS = ['layers', 'labels', 'zones', 'regions', 'currents'] as const

/** Names x: under Selection, never left of 548 and never closer than 12px to the window's right edge. */
export function namesX(selectionX: number, vw: number): number {
  return Math.min(Math.max(selectionX, NAMES_MIN_X), vw - NAMES_PANEL_WIDTH - PANEL_EDGE_GAP)
}

/** The Names body room: clamp(80, vh - (namesY + 34) - 96, 560). */
export function namesBodyMax(namesY: number, vh: number): number {
  return Math.min(Math.max(vh - (namesY + PANEL_HEADER_HEIGHT) - PANEL_BOTTOM_RESERVE, NAMES_BODY_MIN), NAMES_BODY_MAX)
}

function columnX(column: 'left' | 'right' | 'selection', id: StackPanelId, selectionX: number, vw: number): number {
  if (column === 'left') return DESKTOP_PANEL_LEFT_X
  if (column === 'right') return DESKTOP_PANEL_RIGHT_X
  return id === 'names' ? namesX(selectionX, vw) : selectionX
}

/**
 * Every desktop panel's slot from the measured heights: the first panel of a column at y 64, every next one at
 * `y_prev + height_prev + 18` (a panel is never skipped, so a collapsed one contributes its header and an open one its full
 * height). The chain accumulates the UNROUNDED heights and `Math.round` is applied to each resulting y, exactly as the one-shot
 * effect in NumogramClient.tsx did, so at base 10 every panel lands where it always did. `null` until the five reporting panels
 * have a non-zero height (the old guard); an unreported panel contributes the 34px header height.
 *
 * The chain is written `y = y + h + gap`, left to right. `y += h + gap` adds `h + gap` first and differs in the last ulp, which
 * flips Math.round on exact .5 ties (Selection is 296.5 tall): 07-RESEARCH Pitfall 3.
 */
export function computeDesktopStack(
  heights: Partial<Record<StackPanelId, number>>,
  o: { readonly selectionX: number; readonly vw: number },
): Record<StackPanelId, { x: number; y: number }> | null {
  if (!STACK_REPORTERS.every(id => heights[id])) return null
  const out = {} as Record<StackPanelId, { x: number; y: number }>
  for (const { column, panels } of DESKTOP_COLUMNS) {
    let y = DESKTOP_PANEL_BASE_Y
    panels.forEach((id, i) => {
      out[id] = { x: columnX(column, id, o.selectionX, o.vw), y: i === 0 ? DESKTOP_PANEL_BASE_Y : Math.round(y) }
      y = y + (heights[id] ?? PANEL_HEADER_HEIGHT) + DESKTOP_PANEL_GAP
    })
  }
  return out
}

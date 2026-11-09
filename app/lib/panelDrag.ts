// Pure reducers behind usePanelDrag (Phase 7 plan 07-03): the hook has no jsdom test, so all drag and z-index logic lives here and
// the hook only holds one DragState and calls these. Original CCRUG code (MIT, NOTICE section 1).
//
// Three rules (07-RESEARCH Pitfall 4 and the z-cap decision, 07-UI-SPEC "Desktop Panel Stack Rule"):
//  - a drag is seeded from the DISPLAYED position of the panel (derived for an unmoved panel), not from the stored one, so a
//    panel never jumps on the first mouse move;
//  - a panel is `moved` on the first mouse move (not on mouse down) and from then on shows its stored position, while its slot
//    stays reserved (the derived stack takes no `moved` input, so the panels below it do not rise);
//  - the z counter never hands out more than Z_CAP, so no panel can cover the zoom toolbar and shortcuts button (74), the Demons
//    overlay (80) or the base picker dropdown (120).
import {
  DESKTOP_PANEL_BASE_Y,
  DESKTOP_PANEL_GAP,
  DESKTOP_PANEL_LEFT_X,
  DESKTOP_PANEL_RIGHT_X,
  INITIAL_INFO_X,
  NAMES_MIN_X,
  PANEL_HEADER_HEIGHT,
  STACK_PANEL_IDS,
  type StackPanelId,
} from './panelStack'

/** The lowest z a panel gets (what usePanelDrag starts Layers at). */
export const Z_BASE = 40
/** [default] The highest z a panel may hold (UI-SPEC decision 4): the toolbar sits at 74, so 69 leaves it room. */
export const Z_CAP = 69
/** Where the counter restarts after a re-rank: the ten panels sit on 40..49, so the next one is 50. */
export const Z_RERANK_START = 50

export type Point = { readonly x: number; readonly y: number }

export interface DragState {
  /** Stored positions: the pre-measure initial values until a panel is dragged; only `moved` panels use theirs once the stack is derived. */
  readonly stored: Readonly<Record<StackPanelId, Point>>
  /** Panels the user has dragged (set on the first mouse move). */
  readonly moved: ReadonlySet<StackPanelId>
  readonly z: Readonly<Record<StackPanelId, number>>
  /** The next z to hand out. */
  readonly counter: number
  /** The drag in progress: the panel, the mouse position at mouse down (mx, my) and the displayed position it was seeded from (ox, oy). */
  readonly drag: { readonly id: StackPanelId; readonly mx: number; readonly my: number; readonly ox: number; readonly oy: number } | null
}

/** Every panel's z at load: today's usePanelDrag values (Layers 40 ... Text 48) plus Names above Text at 49. */
function initialZ(): Record<StackPanelId, number> {
  return { layers: 40, labels: 41, regions: 42, zones: 43, currents: 44, syz: 45, gates: 46, info: 47, text: 48, names: 49 }
}

/** Today's usePanelDrag initial positions plus Names directly under the Selection header (the pre-measure slot). */
function initialStored(): Record<StackPanelId, Point> {
  return {
    layers: { x: DESKTOP_PANEL_LEFT_X, y: DESKTOP_PANEL_BASE_Y },
    labels: { x: DESKTOP_PANEL_LEFT_X, y: 206 },
    zones: { x: DESKTOP_PANEL_LEFT_X, y: 352 },
    syz: { x: DESKTOP_PANEL_LEFT_X, y: 916 },
    regions: { x: DESKTOP_PANEL_RIGHT_X, y: DESKTOP_PANEL_BASE_Y },
    currents: { x: DESKTOP_PANEL_RIGHT_X, y: 258 },
    gates: { x: DESKTOP_PANEL_RIGHT_X, y: 516 },
    text: { x: DESKTOP_PANEL_RIGHT_X, y: 760 },
    info: { x: INITIAL_INFO_X, y: DESKTOP_PANEL_BASE_Y },
    names: { x: NAMES_MIN_X, y: DESKTOP_PANEL_BASE_Y + PANEL_HEADER_HEIGHT + DESKTOP_PANEL_GAP },
  }
}

export function initialDragState(): DragState {
  return { stored: initialStored(), moved: new Set<StackPanelId>(), z: initialZ(), counter: Z_RERANK_START, drag: null }
}

/**
 * Raise `id` above every other panel. When the counter would pass Z_CAP, the ten panels are first re-ranked onto 40..49 in
 * their current z order (ties keep the STACK_PANEL_IDS order) and the counter restarts at 50, so the activated panel is always
 * the highest and no z ever exceeds Z_CAP. The relative order of the other panels is preserved.
 */
export function activate(s: DragState, id: StackPanelId): DragState {
  let z: Record<StackPanelId, number> = { ...s.z }
  let counter = s.counter
  if (counter > Z_CAP) {
    const ranked = [...STACK_PANEL_IDS].sort((a, b) => s.z[a] - s.z[b])
    z = {} as Record<StackPanelId, number>
    ranked.forEach((key, rank) => {
      z[key] = Z_BASE + rank
    })
    counter = Z_RERANK_START
  }
  z[id] = counter
  return { ...s, z, counter: counter + 1 }
}

/**
 * Mouse down on a panel header: raise the panel and seed the drag from the position it is DISPLAYED at (Pitfall 4: for a derived
 * panel the stored position is not where it is drawn, Labels' stored y is 206 while it is drawn at 228). Nothing is moved and
 * nothing is marked moved yet.
 */
export function dragStart(s: DragState, id: StackPanelId, mx: number, my: number, displayed: Point): DragState {
  const raised = activate(s, id)
  return { ...raised, drag: { id, mx, my, ox: displayed.x, oy: displayed.y } }
}

/**
 * Mouse move during a drag: the panel's stored position becomes the seed plus the mouse delta since mouse down, and the panel is
 * marked moved (this is the first move that does it). Returns the same state when no drag is in progress.
 */
export function dragMove(s: DragState, mx: number, my: number): DragState {
  const d = s.drag
  if (!d) return s
  const moved = new Set<StackPanelId>(s.moved)
  moved.add(d.id)
  // `ox + (mx - d.mx)` is the association the pre-07-03 hook used (`dx = clientX - startX; origX + dx`).
  return { ...s, stored: { ...s.stored, [d.id]: { x: d.ox + (mx - d.mx), y: d.oy + (my - d.my) } }, moved }
}

/** Mouse up: the drag is over. Returns the same state when no drag is in progress. */
export function dragEnd(s: DragState): DragState {
  return s.drag === null ? s : { ...s, drag: null }
}

/**
 * Where every panel is drawn: the derived slot for an unmoved panel, the stored position for a moved one, and the stored
 * position for every panel while the stack is not derived yet (`derived` is null until the five reporting panels have measured)
 * or for a panel the derived map does not cover.
 */
export function displayedPositions(
  s: DragState,
  derived: Readonly<Partial<Record<StackPanelId, Point>>> | null,
): Record<StackPanelId, Point> {
  const out = {} as Record<StackPanelId, Point>
  for (const id of STACK_PANEL_IDS) {
    out[id] = derived !== null && !s.moved.has(id) ? (derived[id] ?? s.stored[id]) : s.stored[id]
  }
  return out
}

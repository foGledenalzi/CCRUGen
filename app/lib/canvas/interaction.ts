// Canvas-tier pointer state machine (Phase 6 D-09): mouse, pen and touch reduced to plain actions. Pure; original CCRUG code (MIT, NOTICE section 1).
//
// The canvas component translates each DOM pointer event into a `PointerInput` (CSS px relative to the canvas, plus the
// result of its own pick at the press point) and applies the returned actions: `hover`, `click`, `tap`, `pan`, `zoom`,
// `rubberStart`, `capture`, and `gestureStart` / `gestureEnd` around any pan or pinch (the component commits the live
// transform at `gestureEnd`). Nothing here touches the DOM, so every rule is unit-tested with literal events.
//
// Rules (UI-SPEC "Mouse" and "Touch"):
// - Mouse and pen, primary button on a pick target: a release within CLICK_SLOP_PX of the press is a click at the release
//   point; a drag that began on a target is otherwise ignored.
// - Mouse and pen, primary button on empty space: `rubberStart` (Shift = additive); the component owns the rectangle.
//   A release within CLICK_SLOP_PX is also a click, so the component can clear the selection (the SVG tier's empty click).
// - Middle button, or Alt with the primary button: pan from the first pixel.
// - Touch: one finger pans once it is more than TOUCH_SLOP_PX from where it landed (the first pan carries the whole
//   distance since the press, so the content follows the finger), a release within TOUCH_SLOP_PX is a tap, two fingers
//   pinch about their midpoint and pan with it. A third finger, or a pointer of another kind, is ignored.
// - pointercancel drops the pointer: no click, no tap, `gestureEnd` if a gesture was open.
// - Non-finite coordinates are ignored (T-06-17); the state is immutable, so a bad event cannot corrupt later ones.

/** Mouse and pen: a release within this many CSS px of the press is a click (DemonMatrix's DRAG_THRESHOLD_PX). */
export const CLICK_SLOP_PX = 3
/** Touch: the pan threshold and the tap slop in CSS px (UI-SPEC default). */
export const TOUCH_SLOP_PX = 8

export type PointerKind = 'mouse' | 'pen' | 'touch'

export interface PointerInput {
  readonly type: 'down' | 'move' | 'up' | 'cancel' | 'leave'
  readonly pointerId: number
  readonly pointerType: PointerKind
  /** CSS px relative to the canvas. */
  readonly x: number
  readonly y: number
  readonly button: number
  readonly altKey: boolean
  readonly shiftKey: boolean
  /** The component's pick at this point hit something. Only read on 'down'. */
  readonly overTarget: boolean
}

export interface TrackedPointer {
  readonly x: number
  readonly y: number
  readonly startX: number
  readonly startY: number
  readonly kind: PointerKind
}

export interface PointerState {
  /**
   * idle: nothing pressed. press: one pointer down on a target (mouse or pen), or a touch not yet past the slop.
   * pan: one pointer panning. pinch: two touches. rubber: a mouse or pen press on empty space (the component draws it).
   */
  readonly mode: 'idle' | 'press' | 'pan' | 'pinch' | 'rubber'
  readonly pointers: ReadonlyMap<number, TrackedPointer>
  /** The distance between the two touches at the last pinch move; 0 until it is known. */
  readonly pinchDistance: number
  readonly pinchMidX: number
  readonly pinchMidY: number
  /** `gestureStart` was emitted and `gestureEnd` has not been yet. */
  readonly gesture: boolean
}

export type PointerAction =
  | { readonly kind: 'hover'; readonly x: number; readonly y: number }
  | { readonly kind: 'hoverEnd' }
  | { readonly kind: 'click'; readonly x: number; readonly y: number }
  | { readonly kind: 'tap'; readonly x: number; readonly y: number }
  /** Translate by this many CSS px. */
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  /** Multiply the scale by `factor` about (x, y). In a pinch (x, y) is the midpoint BEFORE the move and the pan that follows carries it to the new midpoint, so applying the actions in order anchors the content under the fingers. */
  | { readonly kind: 'zoom'; readonly factor: number; readonly x: number; readonly y: number }
  | { readonly kind: 'gestureStart' }
  | { readonly kind: 'gestureEnd' }
  | { readonly kind: 'rubberStart'; readonly x: number; readonly y: number; readonly additive: boolean }
  /** The component should call setPointerCapture(pointerId). */
  | { readonly kind: 'capture'; readonly pointerId: number }

export const INITIAL_POINTER_STATE: PointerState = {
  mode: 'idle',
  pointers: new Map<number, TrackedPointer>(),
  pinchDistance: 0,
  pinchMidX: 0,
  pinchMidY: 0,
  gesture: false,
}

export interface PointerReduction {
  readonly state: PointerState
  readonly actions: readonly PointerAction[]
}

const NO_ACTIONS: readonly PointerAction[] = Object.freeze([])
const PRIMARY_BUTTON = 0
const MIDDLE_BUTTON = 1

function unchanged(state: PointerState): PointerReduction {
  return { state, actions: NO_ACTIONS }
}

function onlyPointer(state: PointerState): readonly [number, TrackedPointer] | undefined {
  for (const entry of state.pointers) return entry
  return undefined
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

/** One finger is left after a pinch: it carries on as a press that still belongs to the open gesture, from where it is now. */
function afterPinch(rest: ReadonlyMap<number, TrackedPointer>): PointerReduction {
  const entry = rest.entries().next().value as [number, TrackedPointer]
  const [id, p] = entry
  const rebased: TrackedPointer = { ...p, startX: p.x, startY: p.y }
  return {
    state: { ...INITIAL_POINTER_STATE, mode: 'press', pointers: new Map([[id, rebased]]), gesture: true },
    actions: NO_ACTIONS,
  }
}

function onDown(state: PointerState, i: PointerInput): PointerReduction {
  if (state.pointers.has(i.pointerId)) {
    // A pointer that never ended (its release was lost): end it first, then start the new press.
    const ended = onCancel(state, i)
    const started = onDown(ended.state, i)
    return { state: started.state, actions: [...ended.actions, ...started.actions] }
  }
  const tracked: TrackedPointer = { x: i.x, y: i.y, startX: i.x, startY: i.y, kind: i.pointerType }

  if (state.pointers.size === 0) {
    const pointers = new Map<number, TrackedPointer>([[i.pointerId, tracked]])
    const capture: PointerAction = { kind: 'capture', pointerId: i.pointerId }
    if (i.pointerType === 'touch') {
      return { state: { ...INITIAL_POINTER_STATE, mode: 'press', pointers }, actions: [capture] }
    }
    // mouse and pen
    if (i.button === MIDDLE_BUTTON || (i.button === PRIMARY_BUTTON && i.altKey)) {
      return {
        state: { ...INITIAL_POINTER_STATE, mode: 'pan', pointers, gesture: true },
        actions: [capture, { kind: 'gestureStart' }],
      }
    }
    if (i.button !== PRIMARY_BUTTON) return unchanged(state)
    const actions: PointerAction[] = i.pointerType === 'pen' ? [capture] : []
    if (i.overTarget) return { state: { ...INITIAL_POINTER_STATE, mode: 'press', pointers }, actions }
    actions.push({ kind: 'rubberStart', x: i.x, y: i.y, additive: i.shiftKey })
    return { state: { ...INITIAL_POINTER_STATE, mode: 'rubber', pointers }, actions }
  }

  // A second pointer only joins a touch: two fingers pinch. Anything else (a third finger, a mouse during a touch) is ignored.
  const first = onlyPointer(state)
  if (state.pointers.size === 1 && first !== undefined && i.pointerType === 'touch' && first[1].kind === 'touch') {
    const [firstId, f] = first
    const pointers = new Map<number, TrackedPointer>([
      [firstId, f],
      [i.pointerId, tracked],
    ])
    const d = distance(f.x, f.y, i.x, i.y)
    const actions: PointerAction[] = [{ kind: 'capture', pointerId: i.pointerId }]
    if (!state.gesture) actions.push({ kind: 'gestureStart' })
    return {
      state: {
        mode: 'pinch',
        pointers,
        pinchDistance: Number.isFinite(d) && d > 0 ? d : 0,
        pinchMidX: (f.x + i.x) / 2,
        pinchMidY: (f.y + i.y) / 2,
        gesture: true,
      },
      actions,
    }
  }
  return unchanged(state)
}

function onMove(state: PointerState, i: PointerInput): PointerReduction {
  const tracked = state.pointers.get(i.pointerId)
  if (tracked === undefined) {
    // Hover only while nothing is pressed, and never for touch (there is no hover on touch).
    if (state.mode === 'idle' && i.pointerType !== 'touch') {
      return { state, actions: [{ kind: 'hover', x: i.x, y: i.y }] }
    }
    return unchanged(state)
  }
  const pointers = new Map(state.pointers)
  pointers.set(i.pointerId, { ...tracked, x: i.x, y: i.y })

  switch (state.mode) {
    case 'press': {
      if (tracked.kind === 'touch' && distance(i.x, i.y, tracked.startX, tracked.startY) > TOUCH_SLOP_PX) {
        const actions: PointerAction[] = []
        if (!state.gesture) actions.push({ kind: 'gestureStart' })
        actions.push({ kind: 'pan', dx: i.x - tracked.startX, dy: i.y - tracked.startY })
        return { state: { ...state, mode: 'pan', pointers, gesture: true }, actions }
      }
      return { state: { ...state, pointers }, actions: NO_ACTIONS }
    }
    case 'pan': {
      const dx = i.x - tracked.x
      const dy = i.y - tracked.y
      const actions: readonly PointerAction[] = dx === 0 && dy === 0 ? NO_ACTIONS : [{ kind: 'pan', dx, dy }]
      return { state: { ...state, pointers }, actions }
    }
    case 'pinch': {
      const [a, b] = Array.from(pointers.values())
      if (a === undefined || b === undefined) return { state: { ...state, pointers }, actions: NO_ACTIONS }
      const d = distance(a.x, a.y, b.x, b.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const actions: PointerAction[] = []
      let baseline = state.pinchDistance
      if (Number.isFinite(d) && d > 0) {
        if (baseline > 0) {
          const factor = d / baseline
          if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
            actions.push({ kind: 'zoom', factor, x: state.pinchMidX, y: state.pinchMidY })
          }
        }
        baseline = d
      }
      const dx = mx - state.pinchMidX
      const dy = my - state.pinchMidY
      if (dx !== 0 || dy !== 0) actions.push({ kind: 'pan', dx, dy })
      return { state: { ...state, pointers, pinchDistance: baseline, pinchMidX: mx, pinchMidY: my }, actions }
    }
    default:
      // 'rubber': the component owns the drag; 'idle' cannot hold a tracked pointer.
      return { state: { ...state, pointers }, actions: NO_ACTIONS }
  }
}

function onUp(state: PointerState, i: PointerInput): PointerReduction {
  const tracked = state.pointers.get(i.pointerId)
  if (tracked === undefined) return unchanged(state)
  switch (state.mode) {
    case 'press':
    case 'rubber': {
      // A press that follows a pinch belongs to the gesture: it closes the gesture and is never a tap.
      if (state.gesture) return { state: INITIAL_POINTER_STATE, actions: [{ kind: 'gestureEnd' }] }
      const moved = distance(i.x, i.y, tracked.startX, tracked.startY)
      if (tracked.kind === 'touch') {
        const tap: PointerAction = { kind: 'tap', x: i.x, y: i.y }
        return { state: INITIAL_POINTER_STATE, actions: moved <= TOUCH_SLOP_PX ? [tap] : NO_ACTIONS }
      }
      const click: PointerAction = { kind: 'click', x: i.x, y: i.y }
      return { state: INITIAL_POINTER_STATE, actions: moved <= CLICK_SLOP_PX ? [click] : NO_ACTIONS }
    }
    case 'pan':
      return { state: INITIAL_POINTER_STATE, actions: [{ kind: 'gestureEnd' }] }
    case 'pinch': {
      const rest = new Map(state.pointers)
      rest.delete(i.pointerId)
      return afterPinch(rest)
    }
    default:
      return unchanged(state)
  }
}

/** Drops the pointer without a click or a tap. Needs no coordinates, so a malformed cancel can never leave a pointer stuck. */
function onCancel(state: PointerState, i: PointerInput): PointerReduction {
  if (!state.pointers.has(i.pointerId)) return unchanged(state)
  const rest = new Map(state.pointers)
  rest.delete(i.pointerId)
  if (rest.size === 0) {
    return { state: INITIAL_POINTER_STATE, actions: state.gesture ? [{ kind: 'gestureEnd' }] : NO_ACTIONS }
  }
  return afterPinch(rest)
}

function onLeave(state: PointerState, i: PointerInput): PointerReduction {
  if (state.mode === 'idle') {
    return i.pointerType === 'touch' ? unchanged(state) : { state, actions: [{ kind: 'hoverEnd' }] }
  }
  const tracked = state.pointers.get(i.pointerId)
  if (tracked !== undefined && tracked.kind !== 'touch' && (state.mode === 'press' || state.mode === 'rubber')) {
    // An uncaptured press left the canvas: its release will never arrive here, so end the press (no click).
    return { state: INITIAL_POINTER_STATE, actions: [{ kind: 'hoverEnd' }] }
  }
  // A captured pan or pinch keeps going; a leave from some other pointer is not ours.
  return unchanged(state)
}

/**
 * The next state and the actions for one input. Returns new objects and never mutates `state` or its map. A down, move
 * or up with a non-finite coordinate, and any event with a non-finite pointer id, is ignored (state unchanged, no
 * actions); cancel and leave carry no coordinates the logic uses, so they are always processed.
 */
export function reducePointer(state: PointerState, input: PointerInput): PointerReduction {
  if (!Number.isFinite(input.pointerId)) return unchanged(state)
  switch (input.type) {
    case 'cancel':
      return onCancel(state, input)
    case 'leave':
      return onLeave(state, input)
    case 'down':
    case 'move':
    case 'up':
      if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return unchanged(state)
      if (input.type === 'down') return onDown(state, input)
      return input.type === 'move' ? onMove(state, input) : onUp(state, input)
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Wheel zoom
// ---------------------------------------------------------------------------------------------------------------------

const WHEEL_STEP_MAX = 100
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const WHEEL_LINE_PX = 16
const WHEEL_PAGE_PX = 120
const DELTA_MODE_LINE = 1
const DELTA_MODE_PAGE = 2

/**
 * The zoom factor of one wheel event: the viewer's existing exp(-step x 0.0015) with the step (in px) clamped to +-100,
 * after turning line and page deltas into px. Scrolling up (negative deltaY) zooms in. Never NaN or non-positive.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  if (Number.isNaN(deltaY)) return 1
  const px =
    deltaMode === DELTA_MODE_LINE ? deltaY * WHEEL_LINE_PX : deltaMode === DELTA_MODE_PAGE ? deltaY * WHEEL_PAGE_PX : deltaY
  const step = Math.min(WHEEL_STEP_MAX, Math.max(-WHEEL_STEP_MAX, px))
  return Math.exp(-step * WHEEL_ZOOM_SENSITIVITY)
}

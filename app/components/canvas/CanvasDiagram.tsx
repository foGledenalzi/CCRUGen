'use client'

// The Canvas tier (Phase 6 REN-02, D-04/D-05/D-08/D-09): stacked layer canvases drawn from a worker-built scene, one focusable overlay canvas, geometric picking. Original CCRUG code (MIT, NOTICE section 1).
//
// A thin DOM shell over the pure modules. Layers (bottom to top): the syzygy, current, gate and node canvases, drawn by
// the draw module at alpha 1 whenever the scene, the view or the committed transform changes (the edge canvases' CSS
// opacity carries ambient and context dimming, so a hover never repaints them), then one overlay canvas that is redrawn on
// every interaction change (hover, pin, selection, ring, demon focus) and is the single focusable element. Hover, click,
// tap, keyboard and rubber band all end in the SVG tier's own callbacks, so the Canvas tier adds no parallel state path.
//
// Gestures. The live view transform lives in a ref and is never React state: while a wheel burst, a drag or a pinch is in
// flight the whole layer stack is moved with a CSS transform (the cached bitmaps are stretched), and when the gesture ends
// (wheel idle, pointer up) the transform is clamped, committed, the layers are re-rastered and the CSS transform is
// cleared in the same frame. Discrete changes (toolbar, keys, Fit, resize, a DPR change) re-raster at once. Hover picking
// is one pick per animation frame and is suspended while a gesture is active. There is no animation loop: redraws happen
// on input and data change only.
//
// What this file decides is kept to wiring; every rule (pick filter, targets, text, placement) is a tested pure function
// in app/lib/canvas/diagramModel.ts and the sibling modules. Callout and live-region text are React text nodes.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CanvasScene } from '../../../engine/index'
import type { Demon, HoverInfo, LabelVisibility, Layer } from '../../data/types'
import {
  WHEEL_COMMIT_DELAY_MS,
  calloutColor,
  calloutPosition,
  canvasAriaLabel,
  frameOf,
  gestureMapping,
  hoverInfoOf,
  keyboardContextFor,
  liveText,
  pickFilterFor,
  ringInfo,
  targetAnchor,
  targetOfInfo,
  targetTextFor,
} from '../../lib/canvas/diagramModel'
import {
  buildSceneIndex,
  drawCurrentLayer,
  drawGateLayer,
  drawNodeLayer,
  drawOverlay,
  drawSyzygyLayer,
  edgeLayerOpacity,
  type DrawEnv,
  type DrawState,
  type OverlayState,
} from '../../lib/canvas/draw'
import {
  INITIAL_POINTER_STATE,
  reducePointer,
  wheelZoomFactor,
  type PointerAction,
  type PointerInput,
  type PointerState,
} from '../../lib/canvas/interaction'
import {
  activationAnnouncement,
  announcementFor,
  focusKeyOf,
  initialTarget,
  nextTarget,
  type RingTarget,
} from '../../lib/canvas/keyboardModel'
import { buildZoneGrid, flattenChords, pickAt, zonesInWorldRect, type PickHit } from '../../lib/canvas/pickIndex'
import {
  IDENTITY_TRANSFORM,
  ZOOM_STEP,
  backingStore,
  canvasFootprint,
  clampTransform,
  ensureVisible,
  fitZones,
  panBy,
  scaleOf,
  toScreen,
  toWorld,
  zoomAt,
  type CanvasTransform,
} from '../../lib/canvas/viewTransform'
import { KIND_COLOR } from '../../lib/demonBrowser'
import type { NumogramView } from '../../lib/numogramView'

export interface CanvasDiagramProps {
  scene: CanvasScene
  view: NumogramView
  zoneLabels: readonly string[]
  layers: ReadonlySet<Layer>
  labelVisibility: LabelVisibility
  gateMode: 'on' | 'thin' | 'off'
  hlZones: ReadonlySet<number>
  selZones: ReadonlySet<number>
  anyFocus: boolean
  zoneStates: Uint8Array | null
  focusChords: readonly Demon[] | null
  tcActive: boolean
  hoverInfo: HoverInfo | null
  pinnedInfo: HoverInfo | null
  demonFocusMode: boolean
  pending: boolean
  viewportWidth: number
  viewportHeight: number
  onHoverInfo(info: HoverInfo | null): void
  onPinInfo(info: HoverInfo): void
  onZoneNodeClick(zone: number): void
  onTogglePair(lo: number, hi: number): void
  onClearFocus(): void
  onRubberBandStart(clientX: number, clientY: number, additive: boolean): void
  onZoomChange(zoom: number): void
}

export interface CanvasDiagramHandle {
  zoomIn(): void
  zoomOut(): void
  fit(): void
  fitZones(zones: readonly number[]): void
  zonesInClientRect(left: number, top: number, right: number, bottom: number): number[]
  element(): HTMLElement | null
}

// An isomorphic layout effect: it must run before paint in the browser (the re-raster and the CSS transform clear share a
// frame) and must not warn when the component is rendered on the server.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const EMPTY_ZONES: ReadonlySet<number> = new Set<number>()
const NAV_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
const CURSOR_TARGET = 'pointer'
const CURSOR_IDLE = 'crosshair'
const CURSOR_PAN = 'grabbing'
const CHIP_CHAR_PX = 6.2 // a 10px monospace glyph advance: the chip width estimate before it is measured
const CHIP_PAD_PX = 14 // 2 x 6px padding plus the 1px borders
const CHIP_HEIGHT_PX = 18 // 10px text, 2 x 2px padding, borders
const OVERLAY_MS_DECIMALS = 10 // data-overlay-ms is rounded to a tenth of a millisecond
const LAYER_BASE_STYLE = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' } as const

const envOf = (ctx: CanvasRenderingContext2D): DrawEnv => ({
  ctx,
  makePath: () => new Path2D(),
  pathFromSvg: (d: string) => new Path2D(d),
})

interface PointerHover {
  readonly target: RingTarget | null
  readonly chord: Demon | null
  readonly x: number
  readonly y: number
}

interface Callout {
  readonly text: string
  readonly color: string
  readonly ax: number
  readonly ay: number
}

/** The functions the timers, animation frames and the native wheel listener call; reassigned each render so they never see stale props. */
interface Controller {
  onWheel(e: WheelEvent): void
  runHover(): void
  paintOverlay(): void
  commitLive(): void
  applyGestureCss(): void
  zoomBy(factor: number): void
  fitAll(): void
  fitTo(zones: readonly number[]): void
  zonesIn(left: number, top: number, right: number, bottom: number): number[]
}

export const CanvasDiagram = forwardRef<CanvasDiagramHandle, CanvasDiagramProps>(function CanvasDiagram(props, ref) {
  const {
    scene,
    view,
    zoneLabels,
    layers,
    labelVisibility,
    gateMode,
    hlZones,
    selZones,
    anyFocus,
    zoneStates,
    focusChords,
    tcActive,
    hoverInfo,
    pinnedInfo,
    demonFocusMode,
    pending,
    viewportWidth,
    viewportHeight,
  } = props

  // ── DOM refs ────────────────────────────────────────────────────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const syzygyRef = useRef<HTMLCanvasElement>(null)
  const currentRef = useRef<HTMLCanvasElement>(null)
  const gateRef = useRef<HTMLCanvasElement>(null)
  const nodeRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)

  // ── Runtime that is never React state (no setState per pointer move) ───────────────────────────────────────────────
  const liveRef = useRef<CanvasTransform>(IDENTITY_TRANSFORM) // the live view: what the user sees during a gesture
  const committedRef = useRef<CanvasTransform>(IDENTITY_TRANSFORM) // the view the layer bitmaps were drawn at
  const ringRef = useRef<RingTarget | null>(null)
  const pointerRef = useRef<PointerState>(INITIAL_POINTER_STATE)
  const gestureRef = useRef(false)
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastHitRef = useRef<string | null>(null)
  const pointerFocusRef = useRef(false)
  const pendingTextRef = useRef('')
  const hoverRafRef = useRef<number | null>(null)
  const commitRafRef = useRef<number | null>(null)
  const overlayRafRef = useRef<number | null>(null)
  const liveRafRef = useRef<number | null>(null)
  const wheelTimerRef = useRef<number | null>(null)
  const ctl = useRef<Controller | null>(null)
  const zoomReportRef = useRef(props.onZoomChange) // the latest report callback, so a new function identity is not an input
  zoomReportRef.current = props.onZoomChange

  // ── State ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  const [rawDpr, setRawDpr] = useState(1)
  const sceneKey = `${scene.kind}:${scene.layoutId}:${scene.base}`
  // The committed transform belongs to one scene key: a new base or layout is the identity at once (no stale frame).
  const [box, setBox] = useState<{ key: string; t: CanvasTransform }>({ key: sceneKey, t: IDENTITY_TRANSFORM })
  const committed = box.key === sceneKey ? box.t : IDENTITY_TRANSFORM
  committedRef.current = committed
  const [ring, setRing] = useState<RingTarget | null>(null)
  const [focused, setFocused] = useState(false)
  const [pointerHover, setPointerHover] = useState<PointerHover | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [paintedKey, setPaintedKey] = useState<string | null>(null)
  const [chipDims, setChipDims] = useState<{ text: string; w: number; h: number } | null>(null)

  // ── Derived, memoized per input ─────────────────────────────────────────────────────────────────────────────────────
  const frame = useMemo(() => frameOf(scene), [scene])
  const { cssWidth, cssHeight } = useMemo(
    () => canvasFootprint(frame, viewportWidth, viewportHeight),
    [frame, viewportWidth, viewportHeight],
  )
  const store = useMemo(() => backingStore(cssWidth, cssHeight, rawDpr), [cssWidth, cssHeight, rawDpr])
  const index = useMemo(() => buildSceneIndex(scene, view), [scene, view])
  const grid = useMemo(() => buildZoneGrid(scene.x, scene.y, scene.nodeRadius), [scene])
  const flatChords = useMemo(
    () => (focusChords === null || focusChords.length === 0 ? null : flattenChords(focusChords, scene.x, scene.y, scene.centerX, scene.centerY)),
    [focusChords, scene],
  )
  const kbContext = useMemo(
    () => keyboardContextFor({ scene, view, index, layers, zoneStates, tcActive, gateMode, hlZones: EMPTY_ZONES }),
    [scene, view, index, layers, zoneStates, tcActive, gateMode],
  )
  const orderSet = useMemo(() => new Set(kbContext.order), [kbContext])
  const textSel = useMemo(() => targetTextFor(view, zoneLabels, index, scene, selZones), [view, zoneLabels, index, scene, selZones])
  const textPlain = useMemo(() => targetTextFor(view, zoneLabels, index, scene, EMPTY_ZONES), [view, zoneLabels, index, scene])
  const filter = pickFilterFor({ scene, view, index, layers, zoneStates, tcActive, gateMode, hlZones })

  // The ring is valid only while its zone (or pair) is in the keyboard order: a mute or a new scene drops it.
  const ringUnit = ring === null ? null : kbContext.mode === 'pairs' ? (ring.kind === 'pair' ? ring.pair : null) : ring.kind === 'pair' ? null : ring.zone
  const ringEff = ring !== null && ringUnit !== null && orderSet.has(ringUnit) ? ring : null
  ringRef.current = ringEff

  const canvasState: 'ready' | 'pending' = !pending && paintedKey === sceneKey ? 'ready' : 'pending'

  // ── Live view, gesture CSS, commit ─────────────────────────────────────────────────────────────────────────────────

  function applyGestureCss(): void {
    const el = stackRef.current
    if (el === null) return
    const m = gestureMapping(committedRef.current, liveRef.current, cssWidth, cssHeight)
    el.style.transform = m.k === 1 && m.tx === 0 && m.ty === 0 ? '' : `translate(${m.tx}px, ${m.ty}px) scale(${m.k})`
  }

  function setLive(t: CanvasTransform): void {
    liveRef.current = t
    applyGestureCss()
  }

  /** Clamp, store, and let the layout effect re-raster and clear the CSS transform (or clear it now when nothing changed). */
  function commit(next: CanvasTransform): void {
    const t = clampTransform(next, frame, cssWidth, cssHeight)
    liveRef.current = t
    const c = committedRef.current
    if (t.zoom === c.zoom && t.tx === c.tx && t.ty === c.ty) {
      applyGestureCss()
      return
    }
    setBox({ key: sceneKey, t })
  }

  function commitLive(): void {
    commit(liveRef.current)
  }

  function scheduleCommit(): void {
    if (commitRafRef.current !== null) return
    commitRafRef.current = requestAnimationFrame(() => {
      commitRafRef.current = null
      ctl.current?.commitLive()
    })
  }

  function setCursor(cursor: string): void {
    if (overlayRef.current !== null) overlayRef.current.style.cursor = cursor
  }

  // ── Picking and hover ─────────────────────────────────────────────────────────────────────────────────────────────

  function pickAtPoint(x: number, y: number): PickHit | null {
    const t = liveRef.current
    const s = scaleOf(t, frame, cssWidth, cssHeight)
    const w = toWorld(t, frame, cssWidth, cssHeight, x, y)
    return pickAt(scene, grid, w.x, w.y, s, filter, flatChords)
  }

  function clearPointerHover(): void {
    hoverPosRef.current = null
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current)
      hoverRafRef.current = null
    }
    setPointerHover(null)
    setCursor(CURSOR_IDLE)
    if (lastHitRef.current !== null) {
      lastHitRef.current = null
      // keyboard focus counts as hover: put the ring's hover back when the pointer leaves
      const target = focused ? ringRef.current : null
      props.onHoverInfo(target === null ? null : ringInfo(target, index, scene))
    }
  }

  function runHover(): void {
    const pos = hoverPosRef.current
    if (pos === null || gestureRef.current || wheelTimerRef.current !== null) return
    const hit = pickAtPoint(pos.x, pos.y)
    const info = hit === null ? null : hoverInfoOf(hit, index, scene, focusChords)
    const key = hit === null || info === null ? null : `${hit.kind}:${hit.id}`
    if (key !== lastHitRef.current) {
      lastHitRef.current = key
      props.onHoverInfo(info)
    }
    setCursor(info === null ? CURSOR_IDLE : CURSOR_TARGET)
    if (info === null) {
      setPointerHover(null)
    } else {
      setPointerHover({
        target: targetOfInfo(info, index, scene),
        chord: info.type === 'demon' ? info.demon : null,
        x: pos.x,
        y: pos.y,
      })
    }
  }

  function queueHover(x: number, y: number): void {
    hoverPosRef.current = { x, y }
    if (hoverRafRef.current !== null) return
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null
      ctl.current?.runHover()
    })
  }

  // ── Pin, click and keyboard activation: exactly the SVG tier's calls ───────────────────────────────────────────────

  function pinTarget(target: RingTarget): void {
    if (target.kind === 'zone') {
      props.onPinInfo({ type: 'zone', zone: target.zone })
      props.onZoneNodeClick(target.zone)
    } else if (target.kind === 'pair') {
      const info = ringInfo(target, index, scene)
      if (info.type === 'syzygy') props.onPinInfo(info)
      const { lo, hi } = textSel.pairOf(target.pair)
      props.onTogglePair(lo, hi)
    } else {
      props.onPinInfo(ringInfo(target, index, scene))
    }
  }

  function activateHit(hit: PickHit | null): void {
    if (hit === null) {
      props.onClearFocus()
      return
    }
    if (hit.kind === 'zone') {
      pinTarget({ kind: 'zone', zone: hit.id })
    } else if (hit.kind === 'pair') {
      pinTarget({ kind: 'pair', pair: hit.id })
    } else {
      const info = hoverInfoOf(hit, index, scene, focusChords)
      if (info !== null) props.onPinInfo(info)
    }
  }

  // ── Announcements: one per animation frame, repeats toggled with a zero-width space ────────────────────────────────

  function announce(text: string): void {
    pendingTextRef.current = text
    if (liveRafRef.current !== null) return
    liveRafRef.current = requestAnimationFrame(() => {
      liveRafRef.current = null
      const next = pendingTextRef.current
      setLiveMessage(previous => liveText(previous, next))
    })
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────────────────────────────────────────

  function keepRingVisible(target: RingTarget): void {
    const a = targetAnchor(target, scene, index)
    if (a === null) return
    const t = liveRef.current
    const s = scaleOf(t, frame, cssWidth, cssHeight)
    const next = ensureVisible(t, a.x, a.y, a.radius * s, frame, cssWidth, cssHeight)
    if (next.zoom !== t.zoom || next.tx !== t.tx || next.ty !== t.ty) commit(next)
  }

  function moveRing(target: RingTarget): void {
    ringRef.current = target
    setRing(target)
    lastHitRef.current = null
    setPointerHover(null)
    props.onHoverInfo(ringInfo(target, index, scene))
    keepRingVisible(target)
    announce(announcementFor(target, textSel))
  }

  function activateRing(target: RingTarget): void {
    pinTarget(target)
    if (target.kind === 'zone') {
      // in Demon focus mode the click opens focus instead of toggling the selection, so there is no selection to report
      announce(
        demonFocusMode ? announcementFor(target, textPlain) : activationAnnouncement(target, textSel, !selZones.has(target.zone)),
      )
    } else {
      announce(activationAnnouncement(target, textSel, false))
    }
  }

  function zoomBy(factor: number): void {
    commit(zoomAt(committedRef.current, factor, cssWidth / 2, cssHeight / 2, frame, cssWidth, cssHeight))
  }

  function zoomAboutRing(factor: number): void {
    let sx = cssWidth / 2
    let sy = cssHeight / 2
    const target = ringRef.current
    const a = target === null ? null : targetAnchor(target, scene, index)
    if (a !== null) {
      const p = toScreen(liveRef.current, frame, cssWidth, cssHeight, a.x, a.y)
      sx = p.x
      sy = p.y
    }
    commit(zoomAt(liveRef.current, factor, sx, sy, frame, cssWidth, cssHeight))
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLCanvasElement>): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return // browser shortcuts (page zoom, history) are not ours
    pointerFocusRef.current = false
    if (pending) {
      // the computing state pauses every key but Tab; navigation keys must not scroll the page meanwhile
      if (NAV_KEYS.has(e.key)) e.preventDefault()
      return
    }
    const outcome = nextTarget(ringRef.current, e.key, e.shiftKey, kbContext)
    if (outcome.kind === 'move') {
      e.preventDefault()
      moveRing(outcome.target)
    } else if (outcome.kind === 'activate') {
      e.preventDefault()
      activateRing(outcome.target)
    } else if (outcome.kind === 'zoom') {
      e.preventDefault()
      if (outcome.action === 'fit') commit(IDENTITY_TRANSFORM)
      else zoomAboutRing(outcome.action === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP)
    }
    // 'leave': the browser moves focus on; 'ignore': not a key this model owns
  }

  function handleFocus(): void {
    setFocused(true)
    if (pointerFocusRef.current) {
      // focus that came from a press is not keyboard navigation: no ring, no hover until a key moves it
      pointerFocusRef.current = false
      return
    }
    let target = ringRef.current
    if (target === null) {
      target = initialTarget(kbContext)
      if (target !== null) {
        ringRef.current = target
        setRing(target)
      }
    }
    if (target !== null) props.onHoverInfo(ringInfo(target, index, scene))
  }

  function handleBlur(): void {
    setFocused(false)
    pointerFocusRef.current = false
    lastHitRef.current = null
    setPointerHover(null)
    props.onHoverInfo(null)
  }

  // ── Pointer ───────────────────────────────────────────────────────────────────────────────────────────────────────

  function applyActions(actions: readonly PointerAction[]): void {
    const root = rootRef.current
    for (const a of actions) {
      switch (a.kind) {
        case 'capture':
          try {
            overlayRef.current?.setPointerCapture(a.pointerId)
          } catch {
            // the pointer is already gone: nothing to capture
          }
          break
        case 'gestureStart':
          gestureRef.current = true
          clearPointerHover()
          setCursor(CURSOR_PAN)
          break
        case 'gestureEnd':
          gestureRef.current = false
          setCursor(CURSOR_IDLE)
          scheduleCommit()
          break
        case 'pan':
          setLive(panBy(liveRef.current, a.dx, a.dy, frame, cssWidth, cssHeight))
          break
        case 'zoom':
          setLive(zoomAt(liveRef.current, a.factor, a.x, a.y, frame, cssWidth, cssHeight))
          break
        case 'hover':
          queueHover(a.x, a.y)
          break
        case 'hoverEnd':
          clearPointerHover()
          break
        case 'click':
        case 'tap':
          activateHit(pickAtPoint(a.x, a.y))
          break
        case 'rubberStart': {
          const rect = root?.getBoundingClientRect()
          if (rect !== undefined) props.onRubberBandStart(rect.left + a.x, rect.top + a.y, a.additive)
          break
        }
      }
    }
  }

  function handlePointer(type: PointerInput['type'], e: ReactPointerEvent<HTMLCanvasElement>): void {
    const root = rootRef.current
    if (root === null) return
    if (type === 'down') {
      pointerFocusRef.current = true
      if (e.button === 1) e.preventDefault() // middle-button pan, not the browser's autoscroll
    }
    // Coordinates are read from the root, not the overlay: the overlay moves with the CSS gesture transform.
    const rect = root.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const input: PointerInput = {
      type,
      pointerId: e.pointerId,
      pointerType: e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse',
      x,
      y,
      button: e.button,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      overTarget: type === 'down' && pickAtPoint(x, y) !== null,
    }
    const reduced = reducePointer(pointerRef.current, input)
    pointerRef.current = reduced.state
    applyActions(reduced.actions)
  }

  function onWheel(e: WheelEvent): void {
    const root = rootRef.current
    if (root === null) return
    e.preventDefault()
    if (pending) return
    const rect = root.getBoundingClientRect()
    if (wheelTimerRef.current === null) clearPointerHover()
    setLive(zoomAt(liveRef.current, wheelZoomFactor(e.deltaY, e.deltaMode), e.clientX - rect.left, e.clientY - rect.top, frame, cssWidth, cssHeight))
    if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current)
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null
      scheduleCommit()
    }, WHEEL_COMMIT_DELAY_MS)
  }

  // ── Overlay ───────────────────────────────────────────────────────────────────────────────────────────────────────

  function paintOverlay(): void {
    const canvas = overlayRef.current
    const root = rootRef.current
    if (canvas === null || root === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const t0 = performance.now()
    const st: OverlayState = {
      scene,
      view,
      zoneLabels,
      transform: committed,
      cssWidth,
      cssHeight,
      dpr: store.dpr,
      layers,
      labelVisibility,
      gateMode,
      zoneStates,
      tcActive,
      hlZones,
      selZones,
      anyFocus,
      focusChords,
      ring: focused ? ringEff : null,
    }
    const report = drawOverlay(envOf(ctx), st, index)
    root.setAttribute('data-overlay-edges', String(report.highlightedEdges))
    root.setAttribute('data-overlay-fidelity', report.fidelity)
    root.setAttribute('data-overlay-chords', String(report.chords))
    root.setAttribute('data-overlay-ms', String(Math.round((performance.now() - t0) * OVERLAY_MS_DECIMALS) / OVERLAY_MS_DECIMALS))
  }

  // ── Handle and controller ───────────────────────────────────────────────────────────────────────────────────────────

  function fitTo(zones: readonly number[]): void {
    commit(fitZones(scene.x, scene.y, zones, frame, cssWidth, cssHeight))
  }

  function zonesIn(left: number, top: number, right: number, bottom: number): number[] {
    const root = rootRef.current
    if (root === null) return []
    const rect = root.getBoundingClientRect()
    const t = liveRef.current
    const a = toWorld(t, frame, cssWidth, cssHeight, left - rect.left, top - rect.top)
    const b = toWorld(t, frame, cssWidth, cssHeight, right - rect.left, bottom - rect.top)
    return zonesInWorldRect(scene, a.x, a.y, b.x, b.y, filter)
  }

  ctl.current = {
    onWheel,
    runHover,
    paintOverlay,
    commitLive,
    applyGestureCss,
    zoomBy,
    fitAll: () => commit(IDENTITY_TRANSFORM),
    fitTo,
    zonesIn,
  }

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => ctl.current?.zoomBy(ZOOM_STEP),
      zoomOut: () => ctl.current?.zoomBy(1 / ZOOM_STEP),
      fit: () => ctl.current?.fitAll(),
      fitZones: (zones: readonly number[]) => ctl.current?.fitTo(zones),
      zonesInClientRect: (left: number, top: number, right: number, bottom: number) => ctl.current?.zonesIn(left, top, right, bottom) ?? [],
      element: () => rootRef.current,
    }),
    [],
  )

  // ── Effects ───────────────────────────────────────────────────────────────────────────────────────────────────────

  // A new scene key starts at the identity view.
  useIsoLayoutEffect(() => {
    liveRef.current = IDENTITY_TRANSFORM
  }, [sceneKey])

  // Static raster: all four layers, then the overlay, then the CSS gesture transform is cleared, in one frame.
  useIsoLayoutEffect(() => {
    const cs = syzygyRef.current?.getContext('2d') ?? null
    const cc = currentRef.current?.getContext('2d') ?? null
    const cg = gateRef.current?.getContext('2d') ?? null
    const cn = nodeRef.current?.getContext('2d') ?? null
    if (cs === null || cc === null || cg === null || cn === null) return
    const st: DrawState = {
      scene,
      view,
      zoneLabels,
      transform: committed,
      cssWidth,
      cssHeight,
      dpr: store.dpr,
      layers,
      labelVisibility,
      gateMode,
      zoneStates,
      tcActive,
    }
    drawSyzygyLayer(envOf(cs), st, index)
    drawCurrentLayer(envOf(cc), st, index)
    drawGateLayer(envOf(cg), st, index)
    drawNodeLayer(envOf(cn), st, index)
    ctl.current?.paintOverlay()
    ctl.current?.applyGestureCss()
    setPaintedKey(sceneKey)
  }, [
    scene,
    view,
    zoneLabels,
    layers,
    labelVisibility,
    gateMode,
    zoneStates,
    tcActive,
    committed,
    cssWidth,
    cssHeight,
    store.dpr,
    store.pixelWidth,
    store.pixelHeight,
    index,
    sceneKey,
  ])

  // Overlay redraw on interaction changes, coalesced to one per animation frame.
  useEffect(() => {
    if (overlayRafRef.current !== null) return
    overlayRafRef.current = requestAnimationFrame(() => {
      overlayRafRef.current = null
      ctl.current?.paintOverlay()
    })
  }, [hlZones, selZones, anyFocus, focusChords, tcActive, ringEff, focused])

  // The committed zoom is the one the toolbar's percentage shows.
  useEffect(() => {
    zoomReportRef.current(committed.zoom)
  }, [committed.zoom])

  // The device pixel ratio: re-measured on a resolution media query change (a monitor move or browser zoom), re-armed for
  // the new value after each change. A window resize (which browser zoom also fires) re-measures and re-arms the same way,
  // so an engine that does not report the media query change still re-rasters at the right density.
  useEffect(() => {
    let mql: MediaQueryList | null = null
    let disposed = false
    function onChange(): void {
      if (disposed) return
      setRawDpr(window.devicePixelRatio)
      arm()
    }
    function arm(): void {
      mql?.removeEventListener('change', onChange)
      mql = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`) : null
      mql?.addEventListener('change', onChange)
    }
    setRawDpr(window.devicePixelRatio)
    arm()
    window.addEventListener('resize', onChange)
    return () => {
      disposed = true
      mql?.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  // A native, non-passive wheel listener (React's onWheel is passive and could not prevent the page scroll). It sits on the
  // root, which never moves, so it keeps receiving events while the gesture transform shrinks the overlay.
  useEffect(() => {
    const el = rootRef.current
    if (el === null) return
    const handler = (e: WheelEvent): void => ctl.current?.onWheel(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Nothing scheduled outlives the component (also the StrictMode simulated unmount).
  useEffect(() => {
    return () => {
      for (const raf of [hoverRafRef, commitRafRef, overlayRafRef, liveRafRef]) {
        if (raf.current !== null) cancelAnimationFrame(raf.current)
        raf.current = null
      }
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = null
    }
  }, [])

  // ── Callout: pointer hover, else the keyboard ring, else the hovered or pinned element ────────────────────────────────

  const named = (target: RingTarget, ax: number, ay: number): Callout => ({
    text: announcementFor(target, textPlain),
    color: calloutColor(target, view),
    ax,
    ay,
  })
  let callout: Callout | null = null
  if (pointerHover !== null && pointerHover.chord !== null) {
    callout = {
      text: pointerHover.chord.name,
      color: KIND_COLOR[pointerHover.chord.kind as keyof typeof KIND_COLOR] ?? KIND_COLOR.syzygy,
      ax: pointerHover.x,
      ay: pointerHover.y,
    }
  } else if (pointerHover !== null && pointerHover.target !== null) {
    callout = named(pointerHover.target, pointerHover.x, pointerHover.y)
  } else {
    const target =
      (focused ? ringEff : null) ??
      (hoverInfo === null ? null : targetOfInfo(hoverInfo, index, scene)) ??
      (pinnedInfo === null ? null : targetOfInfo(pinnedInfo, index, scene))
    const a = target === null ? null : targetAnchor(target, scene, index)
    if (target !== null && a !== null) {
      const s = scaleOf(committed, frame, cssWidth, cssHeight)
      const p = toScreen(committed, frame, cssWidth, cssHeight, a.x, a.y)
      // a target panned out of the window has no chip to point from
      if (p.x >= 0 && p.x <= cssWidth && p.y >= 0 && p.y <= cssHeight) callout = named(target, p.x + a.radius * s, p.y)
    }
  }
  const calloutText = callout === null ? null : callout.text
  const chipSize =
    callout !== null && chipDims !== null && chipDims.text === callout.text
      ? chipDims
      : { w: (calloutText?.length ?? 0) * CHIP_CHAR_PX + CHIP_PAD_PX, h: CHIP_HEIGHT_PX }
  const chipAt = callout === null ? null : calloutPosition(callout.ax, callout.ay, chipSize.w, chipSize.h, cssWidth, cssHeight)

  // The chip is measured once per text, before paint, so its flip at the window edge uses its real size.
  useIsoLayoutEffect(() => {
    const el = chipRef.current
    if (el === null || calloutText === null) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setChipDims(previous => (previous !== null && previous.text === calloutText && previous.w === w && previous.h === h ? previous : { text: calloutText, w, h }))
  }, [calloutText])

  const focusKey = ringEff === null ? '' : focusKeyOf(ringEff, textSel)
  const sized = { width: cssWidth, height: cssHeight }

  return (
    <div
      ref={rootRef}
      data-render-tier="canvas"
      data-canvas-state={canvasState}
      data-base={scene.base}
      data-post-baseline=""
      data-overlay-edges="0"
      data-overlay-fidelity="full"
      data-overlay-chords="0"
      data-overlay-ms="0"
      style={{
        position: 'relative',
        width: cssWidth,
        height: cssHeight,
        overflow: 'hidden',
        opacity: pending ? 0.5 : 1,
        pointerEvents: pending ? 'none' : undefined,
        transition: 'opacity 0.15s',
      }}
    >
      <div ref={stackRef} style={{ position: 'absolute', left: 0, top: 0, ...sized, transformOrigin: '0 0' }}>
        <canvas
          ref={syzygyRef}
          data-canvas-layer="syzygy"
          aria-hidden="true"
          width={store.pixelWidth}
          height={store.pixelHeight}
          style={{ ...LAYER_BASE_STYLE, ...sized, opacity: edgeLayerOpacity('syzygy', anyFocus, gateMode) }}
        />
        <canvas
          ref={currentRef}
          data-canvas-layer="current"
          aria-hidden="true"
          width={store.pixelWidth}
          height={store.pixelHeight}
          style={{ ...LAYER_BASE_STYLE, ...sized, opacity: edgeLayerOpacity('current', anyFocus, gateMode) }}
        />
        <canvas
          ref={gateRef}
          data-canvas-layer="gate"
          aria-hidden="true"
          width={store.pixelWidth}
          height={store.pixelHeight}
          style={{ ...LAYER_BASE_STYLE, ...sized, opacity: edgeLayerOpacity('gate', anyFocus, gateMode) }}
        />
        <canvas
          ref={nodeRef}
          data-canvas-layer="node"
          aria-hidden="true"
          width={store.pixelWidth}
          height={store.pixelHeight}
          style={{ ...LAYER_BASE_STYLE, ...sized }}
        />
        <canvas
          ref={overlayRef}
          role="application"
          tabIndex={0}
          aria-label={canvasAriaLabel(scene)}
          aria-busy={pending || undefined}
          data-diagram={scene.kind}
          data-focus-key={focusKey}
          data-zoom={String(committed.zoom)}
          data-tx={String(committed.tx)}
          data-ty={String(committed.ty)}
          width={store.pixelWidth}
          height={store.pixelHeight}
          style={{ position: 'absolute', left: 0, top: 0, ...sized, touchAction: 'none', outline: 'none', cursor: CURSOR_IDLE }}
          onPointerDown={e => handlePointer('down', e)}
          onPointerMove={e => handlePointer('move', e)}
          onPointerUp={e => handlePointer('up', e)}
          onPointerCancel={e => handlePointer('cancel', e)}
          onPointerLeave={e => handlePointer('leave', e)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
      {callout !== null && chipAt !== null && (
        <div
          ref={chipRef}
          data-canvas-callout=""
          data-post-baseline=""
          role="tooltip"
          className="pointer-events-none absolute whitespace-nowrap px-1.5 py-[2px] text-[10px]"
          style={{ left: chipAt.x, top: chipAt.y, background: 'rgba(8,8,15,0.95)', border: `1px solid ${callout.color}88`, color: '#e5e7eb' }}
        >
          {callout.text}
        </div>
      )}
      <div data-canvas-live="" data-post-baseline="" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </div>
  )
})

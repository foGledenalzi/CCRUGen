'use client'

// Triangular demon matrix (DEM-04, D-06): progressive canvas raster, exact picking. Original CCRUG code (MIT, NOTICE section 1).
import { useEffect, useRef, useState } from 'react'
import type { DemonRef } from '../../../engine/index'
import { useNumogramView } from '../numogram/ViewContext'
import { Pill } from '../ui/Pill'
import { legacyKind } from '../../presets/base10/demons'
import { KIND_COLOR, KIND_LABEL, LEGACY_KINDS, SUBTYPE_LABEL, netSpanLabel } from '../../lib/demonBrowser'
import {
  buildPalette,
  cellAtPixel,
  cellCenter,
  cellRect,
  clampTransform,
  ensureCellVisible,
  fitTransform,
  MATRIX_BG,
  MATRIX_EMPTY,
  numodemonLine,
  panBy,
  rasterizeRows,
  rasterSize,
  stepCursor,
  syzygyLine,
  zoomAt,
  type Cell,
  type MatrixTransform,
  type RasterJob,
} from '../../lib/demonMatrix'

export interface DemonMatrixProps {
  readonly selectedMesh: number | null
  readonly onSelectDemon: (d: DemonRef) => void
}

// Module-level (computed once): the raster's 6-entry palette and the classify() lookup from the 4-bucket legacy
// kind palette to a palette index. Order MUST match demonMatrix.ts's PALETTE_BG=4 / PALETTE_EMPTY=5.
const PALETTE = buildPalette([KIND_COLOR.chrono, KIND_COLOR.amphi, KIND_COLOR.xeno, KIND_COLOR.syzygy, MATRIX_BG, MATRIX_EMPTY])
const KIND_INDEX = { chrono: 0, amphi: 1, xeno: 2, syzygy: 3 } as const

const MIDDLE_DOT = String.fromCodePoint(0xb7)
const SEP = ` ${MIDDLE_DOT} `
const HINT = `drag to pan ${MIDDLE_DOT} scroll to zoom ${MIDDLE_DOT} click to pin`
const WHEEL_COMMIT_DELAY_MS = 150
const DRAG_THRESHOLD_PX = 3
const DEFAULT_CURSOR: Cell = [1, 0]

interface Size {
  readonly w: number
  readonly h: number
}

interface DragState {
  readonly pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  moved: number
}

interface PinchState {
  distance: number
}

interface Tooltip {
  readonly x: number
  readonly y: number
  readonly text: string
  readonly color: string
}

/** `A::B · MESH · SubtypeLabel`, the one text format shared by the hover tooltip and the keyboard live region. */
function demonText(d: DemonRef, zoneLabel: (z: number) => string): string {
  return `${netSpanLabel(d.a, d.b, zoneLabel)}${SEP}${d.mesh}${SEP}${SUBTYPE_LABEL[d.subtype]}`
}

/** Math.min(100, Math.max(-100, v)): the same wheel-delta clamp useCanvasZoom uses before the exponential factor. */
function clampWheelStep(v: number): number {
  return Math.min(100, Math.max(-100, v))
}

export function DemonMatrix({ selectedMesh, onSelectDemon }: DemonMatrixProps): JSX.Element {
  const { g, zoneLabel } = useNumogramView()
  const base = g.base

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const genRef = useRef(0)
  const wheelCommitTimerRef = useRef<number | null>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragRef = useRef<DragState | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const initRef = useRef<{ base: number; inited: boolean }>({ base, inited: false })

  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [live, setLive] = useState<MatrixTransform>(() => fitTransform(base, 0, 0))
  const [committed, setCommitted] = useState<MatrixTransform>(() => fitTransform(base, 0, 0))
  const [rasterState, setRasterState] = useState<'drawing' | 'done'>('drawing')
  const [rasterMs, setRasterMs] = useState(0)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [focused, setFocused] = useState(false)
  const [cursor, setCursor] = useState<Cell>(() => {
    if (selectedMesh === null) return DEFAULT_CURSOR
    try {
      const [a, b] = g.demons.netSpanOf(selectedMesh)
      return [a, b]
    } catch {
      return DEFAULT_CURSOR
    }
  })

  // Guards every read of `cursor` against a base change that left a now out-of-range value behind: a > b < base.
  const cursorValid = cursor[1] >= 0 && cursor[1] < cursor[0] && cursor[0] < base
  const activeCursor: Cell = cursorValid ? cursor : DEFAULT_CURSOR
  useEffect(() => {
    if (!cursorValid) setCursor(DEFAULT_CURSOR)
  }, [cursorValid])

  // "Latest ref" (not an effect): always the current live transform, for async callbacks (the wheel-commit timer)
  // that run outside the render cycle and would otherwise close over a stale value.
  const liveRef = useRef(live)
  liveRef.current = live

  // ResizeObserver on the container (CSS px). When the size first becomes non-zero, or the base changes, both
  // transforms snap to fitTransform; on later resizes both are re-clamped into the (possibly new) viewport.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry === undefined) return
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return
    if (!initRef.current.inited || initRef.current.base !== base) {
      const t = fitTransform(base, size.w, size.h)
      setLive(t)
      setCommitted(t)
      initRef.current = { base, inited: true }
    } else {
      setLive(t => clampTransform(t, base, size.w, size.h))
      setCommitted(t => clampTransform(t, base, size.w, size.h))
    }
  }, [size, base])

  // Progressive raster: fills `committed`'s transform in <= 8 ms slices per animation frame (T-05-23), cancellable
  // via genRef so a stale job never keeps painting after a newer commit/resize/base-change supersedes it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null || size.w === 0 || size.h === 0) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    const dpr = window.devicePixelRatio
    const { width, height, ratio } = rasterSize(size.w, size.h, dpr)
    if (width === 0 || height === 0) return

    canvas.width = width
    canvas.height = height
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`

    const img = ctx.createImageData(width, height)
    const job: RasterJob = {
      t: committed,
      base,
      width,
      height,
      ratio,
      classify: (a, b) => KIND_INDEX[legacyKind(g.demons.ref(a, b).subtype)],
      palette: PALETTE,
      out: img.data,
    }

    const gen = ++genRef.current
    setRasterState('drawing')
    const t0 = performance.now()
    let row = 0

    function slice(): void {
      if (genRef.current !== gen) return
      const start = performance.now()
      const from = row
      while (row < height && performance.now() - start < 8) {
        const next = Math.min(height, row + 16)
        rasterizeRows(job, row, next)
        row = next
      }
      ctx!.putImageData(img, 0, 0, 0, from, width, row - from)
      if (row < height) {
        requestAnimationFrame(slice)
      } else {
        setRasterMs(Math.round(performance.now() - t0))
        setRasterState('done')
      }
    }
    requestAnimationFrame(slice)

    return () => {
      genRef.current++
    }
  }, [committed, size, g, base])

  // During an active gesture the canvas is CSS-transformed from `committed` to `live` (cheap, no re-raster); the
  // transform is the identity right after a commit (committed === live).
  const k = live.scale / committed.scale
  const gestureTransform = `translate(${live.tx - committed.tx * k}px, ${live.ty - committed.ty * k}px) scale(${k})`

  // Native, non-passive wheel listener (T-05-24): preventDefault only inside this container, so page scroll
  // elsewhere is untouched. The live transform updates on every wheel tick; the raster recomputes 150 ms after
  // the last one (commit), matching the main diagram's panMs/oneTimePaintMs budget split.
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return

    function handleWheel(e: WheelEvent): void {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const deltaPx = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 120 : e.deltaY
      const factor = Math.exp(-clampWheelStep(deltaPx) * 0.0015)
      setLive(t => zoomAt(t, factor, px, py, base, size.w, size.h))

      if (wheelCommitTimerRef.current !== null) window.clearTimeout(wheelCommitTimerRef.current)
      wheelCommitTimerRef.current = window.setTimeout(() => {
        setCommitted(liveRef.current)
        wheelCommitTimerRef.current = null
      }, WHEEL_COMMIT_DELAY_MS)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current)
        wheelCommitTimerRef.current = null
      }
    }
  }, [base, size.w, size.h])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const rect = containerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    containerRef.current?.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x, y })
    if (pointersRef.current.size === 1) {
      dragRef.current = { pointerId: e.pointerId, startX: x, startY: y, lastX: x, lastY: y, moved: 0 }
      pinchRef.current = null
    } else if (pointersRef.current.size === 2) {
      dragRef.current = null
      const pts = Array.from(pointersRef.current.values())
      pinchRef.current = { distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const rect = containerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x, y })
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values())
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mx = (pts[0].x + pts[1].x) / 2
      const my = (pts[0].y + pts[1].y) / 2
      const factor = distance / pinchRef.current.distance
      if (Number.isFinite(factor) && factor > 0) {
        setLive(t => zoomAt(t, factor, mx, my, base, size.w, size.h))
      }
      pinchRef.current = { distance }
      return
    }

    if (pointersRef.current.size === 1 && dragRef.current) {
      const drag = dragRef.current
      const dx = x - drag.lastX
      const dy = y - drag.lastY
      drag.moved += Math.hypot(dx, dy)
      drag.lastX = x
      drag.lastY = y
      if (drag.moved > DRAG_THRESHOLD_PX) {
        setLive(t => panBy(t, dx, dy, base, size.w, size.h))
      }
      return
    }

    // Hover: no pointer is being tracked (no button held) -> resolve exactly from the live transform (T-05-25),
    // never from the raster (the raster is a display cache; it can lag the live transform mid-gesture).
    const cell = cellAtPixel(x, y, live, base)
    if (cell === null) {
      setTooltip(null)
      return
    }
    const d = g.demons.ref(cell[0], cell[1])
    setTooltip({ x: x + 12, y: y + 12, text: demonText(d, zoneLabel), color: KIND_COLOR[legacyKind(d.subtype)] })
  }

  function handlePointerLeave(): void {
    setTooltip(null)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const wasPinching = pointersRef.current.size >= 2
    const drag = dragRef.current
    pointersRef.current.delete(e.pointerId)

    if (wasPinching) {
      setCommitted(liveRef.current)
      if (pointersRef.current.size === 1) {
        const [[pid, pt]] = Array.from(pointersRef.current.entries())
        dragRef.current = { pointerId: pid, startX: pt.x, startY: pt.y, lastX: pt.x, lastY: pt.y, moved: 0 }
      } else {
        dragRef.current = null
      }
      pinchRef.current = null
      return
    }

    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null
      if (drag.moved > DRAG_THRESHOLD_PX) {
        setCommitted(liveRef.current)
        return
      }
      // A release with <= 3px of total movement is a click: resolve exactly from the live transform (T-05-25).
      const rect = containerRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cell = cellAtPixel(x, y, liveRef.current, base)
      if (cell !== null) {
        setCursor(cell)
        onSelectDemon(g.demons.ref(cell[0], cell[1]))
      }
    }
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLDivElement>): void {
    pointersRef.current.delete(e.pointerId)
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
    pinchRef.current = null
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const w = size.w
    const h = size.h
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = stepCursor(activeCursor, e.key, base)
      setCursor(next)
      const t = ensureCellVisible(live, next[0], next[1], base, w, h)
      setLive(t)
      setCommitted(t)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelectDemon(g.demons.ref(activeCursor[0], activeCursor[1]))
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      const center = cellCenter(activeCursor[0], activeCursor[1], live)
      const t = zoomAt(live, 2, center.x, center.y, base, w, h)
      setLive(t)
      setCommitted(t)
      return
    }
    if (e.key === '-') {
      e.preventDefault()
      const center = cellCenter(activeCursor[0], activeCursor[1], live)
      const t = zoomAt(live, 0.5, center.x, center.y, base, w, h)
      setLive(t)
      setCommitted(t)
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      const t = fitTransform(base, w, h)
      setLive(t)
      setCommitted(t)
    }
  }

  const cursorText = demonText(g.demons.ref(activeCursor[0], activeCursor[1]), zoneLabel)

  const syz = syzygyLine(live, base)
  const numo = numodemonLine(live, base)
  const cursorRect = cellRect(activeCursor[0], activeCursor[1], live)

  let pinnedRect: { readonly x: number; readonly y: number; readonly size: number } | null = null
  if (selectedMesh !== null) {
    try {
      const [pa, pb] = g.demons.netSpanOf(selectedMesh)
      pinnedRect = cellRect(pa, pb, live)
    } catch {
      pinnedRect = null
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div
        ref={containerRef}
        data-demon-matrix=""
        role="application"
        tabIndex={0}
        data-focus-key="demon-matrix"
        aria-label="Demon matrix: arrow keys move the cursor, Enter pins, plus and minus zoom, 0 fits"
        data-raster-state={rasterState}
        data-raster-ms={rasterMs}
        data-scale={String(live.scale)}
        data-tx={String(live.tx)}
        data-ty={String(live.ty)}
        className="relative flex-1 min-h-[400px] overflow-hidden select-none"
        style={{ touchAction: 'none', background: MATRIX_BG, outline: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute left-0 top-0"
          style={{ transform: gestureTransform, transformOrigin: '0 0' }}
        />
        <svg className="pointer-events-none absolute left-0 top-0" aria-hidden="true" width={size.w} height={size.h}>
          <line
            data-matrix-line="syzygy"
            x1={syz.x1}
            y1={syz.y1}
            x2={syz.x2}
            y2={syz.y2}
            stroke="#e8e8e8"
            strokeOpacity={0.55}
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          {numo !== null && (
            <line
              data-matrix-line="numodemon"
              x1={numo.x1}
              y1={numo.y1}
              x2={numo.x2}
              y2={numo.y2}
              stroke="#6b7280"
              strokeOpacity={0.5}
              strokeDasharray="1 3"
              strokeWidth={1}
            />
          )}
          {pinnedRect !== null && (
            <rect
              data-matrix-pinned=""
              x={pinnedRect.x}
              y={pinnedRect.y}
              width={Math.max(pinnedRect.size, 3)}
              height={Math.max(pinnedRect.size, 3)}
              stroke="#10ff50"
              fill="none"
            />
          )}
          {focused && (
            <rect
              data-matrix-cursor=""
              x={cursorRect.x}
              y={cursorRect.y}
              width={Math.max(cursorRect.size, 3)}
              height={Math.max(cursorRect.size, 3)}
              stroke="#10ff50"
              strokeDasharray="2 2"
              fill="none"
            />
          )}
        </svg>
        {tooltip !== null && (
          <div
            data-matrix-tooltip=""
            role="tooltip"
            className="pointer-events-none absolute whitespace-nowrap px-1.5 py-[2px] text-[10px]"
            style={{ left: tooltip.x, top: tooltip.y, background: 'rgba(8,8,15,0.95)', border: `1px solid ${tooltip.color}88`, color: '#e5e7eb' }}
          >
            {tooltip.text}
          </div>
        )}
        <div data-matrix-live="" aria-live="polite" className="sr-only">
          {cursorText}
        </div>
      </div>
      <div data-matrix-legend="" className="flex flex-wrap gap-2">
        {LEGACY_KINDS.map(k => (
          <Pill key={k} accent={KIND_COLOR[k]}>
            {KIND_LABEL[k]}
          </Pill>
        ))}
        <span className="text-[8px] uppercase tracking-[0.12em] text-gray-500">{HINT}</span>
      </div>
    </div>
  )
}

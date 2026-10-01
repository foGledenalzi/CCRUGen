// Focus tab (DEM-03, D-03): one zone's demons or one demon, with or without a diagram. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { DemonRef } from '../../../engine/index'
import { clipEcho } from '../../../engine/core/base'
import { useNumogramView } from '../numogram/ViewContext'
import { curveAway } from '../../lib/geometry'
import { parseZoneNumeral } from '../../lib/demonSearch'
import {
  incidentSource,
  kindColor,
  netSpanLabel,
  singleSource,
  SUBTYPE_LABEL,
  type DemonRowSource,
} from '../../lib/demonBrowser'
import { focusDemonRef, focusDrawPlan, formatDemonFocus, zoneFocus, type DemonFocus } from '../../lib/demonState'
import { DemonRowList } from './DemonRowList'

export interface DemonFocusViewProps {
  readonly focus: DemonFocus | null
  readonly onFocusChange: (next: DemonFocus | null) => void
  readonly selectedMesh: number | null
  // Only decides whether the toolbar hint is shown; the view itself never needs the diagram (base 666 has none).
  readonly showDiagram: boolean
  readonly onHoverDemon: (d: DemonRef | null) => void
  // List click: pin only (a zone focus stays a zone focus).
  readonly onPickDemon: (d: DemonRef) => void
}

const EN_DASH = String.fromCodePoint(0x2013)
const MIDDLE_DOT = String.fromCodePoint(0xb7)
// Built as data (String.fromCodePoint), never as typed escapes in source (STATE Phase 2 P07 gotcha).
const LQ = String.fromCodePoint(0x201c) // "
const RQ = String.fromCodePoint(0x201d) // "
const DASH = String.fromCodePoint(0x2014) // em dash

const MAX_CANVAS_SIZE = 420
const RING_MAX_DOTS_BASE = 1024
const RING_INNER_RATIO = 0.6
const RING_OUTER_RATIO = 1.25

interface RingPoint {
  readonly x: number
  readonly y: number
}

function ringPosFactory(center: number, radius: number, base: number): (zone: number) => RingPoint {
  return (zone: number): RingPoint => ({
    x: center + radius * Math.sin((2 * Math.PI * zone) / base),
    y: center - radius * Math.cos((2 * Math.PI * zone) / base),
  })
}

export function DemonFocusView({
  focus,
  onFocusChange,
  selectedMesh,
  showDiagram,
  onHoverDemon,
  onPickDemon,
}: DemonFocusViewProps): JSX.Element {
  const { g, base, zoneLabel } = useNumogramView()

  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(0)

  // A square canvas box (T-05-29: bounded chord drawing on a compact canvas, not one DOM element per demon).
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry === undefined) return
      setSize(Math.min(MAX_CANVAS_SIZE, entry.contentRect.width, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const zone = focus !== null && focus.kind === 'zone' ? focus.zone : null
  const demonRef = focusDemonRef(g, focus)
  const plan = focus !== null ? focusDrawPlan(base, focus) : null
  const source: DemonRowSource | null =
    focus === null ? null : zone !== null ? incidentSource(g, zone) : singleSource(demonRef!)

  let summary = ''
  if (focus !== null && plan !== null) {
    if (zone !== null) {
      summary = `Zone ${zoneLabel(zone)} ${MIDDLE_DOT} ${(base - 1).toLocaleString('en-US')} demons`
    } else if (demonRef !== null) {
      summary = `${netSpanLabel(demonRef.a, demonRef.b, zoneLabel)} ${MIDDLE_DOT} mesh ${demonRef.mesh} ${MIDDLE_DOT} ${SUBTYPE_LABEL[demonRef.subtype]}`
    }
    if (plan.stride > 1) {
      summary += ` ${MIDDLE_DOT} Drawing 1 in ${plan.stride} of ${plan.total.toLocaleString('en-US')} chords; the list shows all of them.`
    }
  }

  // Draw the ring + chords (T-05-29): never more than plan.drawn (<= 4096) chords, one canvas, no per-demon DOM.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null || focus === null || plan === null || source === null || size === 0) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = 'rgba(8,8,15,1)'
    ctx.fillRect(0, 0, size, size)

    const c = size / 2
    const r = 0.42 * size
    const ringPos = ringPosFactory(c, r, base)

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(c, c, r, 0, 2 * Math.PI)
    ctx.stroke()

    if (base <= RING_MAX_DOTS_BASE) {
      ctx.fillStyle = '#6b7280'
      ctx.globalAlpha = 0.6
      for (let z = 0; z < base; z++) {
        const p = ringPos(z)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.5, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (zone !== null) {
      for (let k = 0; k < source.count; k += plan.stride) {
        const d = source.at(k)
        const path = new Path2D(curveAway(ringPos(d.a), ringPos(d.b), c, c, 0.25))
        ctx.strokeStyle = kindColor(d.subtype)
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 1
        ctx.stroke(path)
      }
    } else if (demonRef !== null) {
      const path = new Path2D(curveAway(ringPos(demonRef.a), ringPos(demonRef.b), c, c, 0.25))
      ctx.strokeStyle = kindColor(demonRef.subtype)
      ctx.globalAlpha = 1
      ctx.lineWidth = 2
      ctx.stroke(path)
    }

    if (selectedMesh !== null) {
      try {
        const sel = g.demons.at(selectedMesh)
        const path = new Path2D(curveAway(ringPos(sel.a), ringPos(sel.b), c, c, 0.25))
        ctx.strokeStyle = kindColor(sel.subtype)
        ctx.globalAlpha = 1
        ctx.lineWidth = 2.5
        ctx.stroke(path)
      } catch {
        // selectedMesh outside this base's demon count: nothing to re-stroke.
      }
    }

    ctx.globalAlpha = 1
    const focusedZones = zone !== null ? [zone] : demonRef !== null ? [demonRef.a, demonRef.b] : []
    ctx.fillStyle = '#10ff50'
    for (const z of focusedZones) {
      const p = ringPos(z)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI)
      ctx.fill()
    }
    ctx.fillStyle = '#e5e7eb'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const z of focusedZones) {
      const p = ringPos(z)
      ctx.fillText(zoneLabel(z), p.x, p.y - 8)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, plan, source, size, base, g, selectedMesh, zoneLabel])

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (size === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const c = size / 2
    const r = 0.42 * size
    const dx = x - c
    const dy = y - c
    const dist = Math.hypot(dx, dy)
    if (dist < RING_INNER_RATIO * r || dist > RING_OUTER_RATIO * r) return
    const theta = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
    const z = Math.round((theta / (2 * Math.PI)) * base) % base
    onFocusChange(zoneFocus(z))
  }

  function handleZoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Enter') return
    const z = parseZoneNumeral(text, base)
    if (z === null) {
      setError(
        `Couldn't parse ${LQ}${clipEcho(text.trim())}${RQ} ${DASH} enter a zone from ${zoneLabel(0)} to ${zoneLabel(base - 1)}.`,
      )
      return
    }
    setError(null)
    onFocusChange(zoneFocus(z))
  }

  const focusKey = focus === null ? 'none' : `focus|${base}|${formatDemonFocus(focus)}`

  return (
    <div data-demon-focus-view="" className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="block">
          <span className="ui-terminal-field">
            <input
              aria-label="Focus zone"
              maxLength={24}
              value={text}
              placeholder={`zone ${zoneLabel(0)}${EN_DASH}${zoneLabel(base - 1)}`}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleZoneKeyDown}
              className="ui-terminal-input px-0 py-2 text-[10px] text-gray-100"
            />
          </span>
        </label>
        {focus !== null && (
          <>
            <span data-focus-summary="" className="text-[10px] text-gray-300">
              {summary}
            </span>
            <button
              type="button"
              data-clear-focus=""
              onClick={() => onFocusChange(null)}
              className="text-[8px] uppercase tracking-[0.14em] px-2 py-1"
              style={{ color: '#6b7280', border: '1px solid rgba(107,114,128,0.35)' }}
            >
              clear focus
            </button>
          </>
        )}
      </div>
      {error !== null && (
        <div data-focus-error="" className="text-[11px] text-[#f87171]">
          {error}
        </div>
      )}
      {focus === null ? (
        <div>
          <p className="text-[10px] text-gray-400">Pick a zone to draw its {(base - 1).toLocaleString('en-US')} demons.</p>
          {showDiagram && (
            <p className="text-[10px] text-gray-500">Or turn on Demon focus in the diagram toolbar (bottom right) and click a zone.</p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 max-[820px]:flex-col">
          <div ref={boxRef} className="flex flex-1 items-center justify-center min-h-0">
            <canvas
              ref={canvasRef}
              data-focus-chords=""
              data-chord-count={plan!.drawn}
              data-chord-total={plan!.total}
              data-chord-stride={plan!.stride}
              aria-label={summary}
              style={{ width: size || undefined, height: size || undefined }}
              onClick={handleCanvasClick}
            />
          </div>
          <div className="min-h-0 flex-1">
            <DemonRowList
              key={focusKey}
              listId="focus"
              source={source!}
              ariaLabel="Focused demons"
              selectedMesh={selectedMesh}
              revealIndex={null}
              revealNonce={0}
              onHoverDemon={onHoverDemon}
              onSelectDemon={onPickDemon}
            />
          </div>
        </div>
      )}
    </div>
  )
}

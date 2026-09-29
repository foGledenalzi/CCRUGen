// Interactive pair graph (LAY-04 view in the live viewer): one pill per syzygy hi::lo, current arcs around each
// Torque ring and the Plex/Warp self loops. Mirrors engine/scene/svgString.ts pairGraphToSvg and adds hover/pin.
// Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useMemo, useRef, useState } from 'react'
import type { Numogram, PairGraphLayout, PairGraphRoutes } from '../../../engine/index'
import type { HoverInfo, SyzygyData } from '../../data/types'
import { zoneColorFor, type NumogramView } from '../../lib/numogramView'

export interface PairGraphProjectionProps {
  g: Numogram
  view: NumogramView
  layout: PairGraphLayout
  routes: PairGraphRoutes
  zoneLabels: readonly string[]
  selZones: Set<number>
  hlZones: Set<number>
  anyFocus: boolean
  labelsOn: boolean
  pairStates: Uint8Array | null // by pair id: 0 hidden, 1 dimmed, 2 normal; null = no region filter (04-13 fills it)
  onHoverInfo: (info: HoverInfo | null) => void
  onPinInfo: (info: HoverInfo) => void
  onTogglePair: (lo: number, hi: number) => void
}

export const PairGraphProjection = React.memo(function PairGraphProjection({
  g,
  view,
  layout,
  routes,
  zoneLabels,
  selZones,
  hlZones,
  anyFocus,
  labelsOn,
  pairStates,
  onHoverInfo,
  onPinInfo,
  onTogglePair,
}: PairGraphProjectionProps) {
  const ss = layout.strokeScale
  const P = g.pairCount

  const [focusKey, setFocusKey] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const syzygyByLo = useMemo(() => {
    const map = new Map<number, SyzygyData>()
    for (const s of view.syzygies) map.set(s.a, s)
    return map
  }, [view.syzygies])

  const pairIds = useMemo(() => Array.from({ length: P }, (_, q) => q), [P])
  const visiblePairIds = useMemo(() => pairIds.filter(q => pairStates?.[q] !== 0), [pairIds, pairStates])

  // Roving-tabindex keyboard model (UI-07): one pill per visible pair, in pair-id order; hidden (muted) pairs are
  // excluded from the sequence entirely (same rule as Projection.tsx's zones/syzygies/currents/gates).
  const focusOrder = useMemo(() => visiblePairIds.map(q => `pair:${q}`), [visiblePairIds])
  const activeKey = focusKey !== null && focusOrder.includes(focusKey) ? focusKey : (focusOrder[0] ?? null)

  const activatePair = (q: number) => {
    const { lo, hi } = g.pair(q)
    const syz = syzygyByLo.get(lo) ?? null
    if (syz) onPinInfo({ type: 'syzygy', data: syz })
    onTogglePair(lo, hi)
  }

  const onDiagramKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const currentKey = (e.target as Element).getAttribute?.('data-focus-key')
    if (!currentKey) return
    const idx = focusOrder.indexOf(currentKey)
    if (idx === -1) return
    const moveFocus = (nextKey: string) => {
      setFocusKey(nextKey)
      const el = svgRef.current?.querySelector(`[data-focus-key="${CSS.escape(nextKey)}"]`)
      ;(el as SVGElement | null)?.focus()
    }
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(focusOrder[(idx + 1) % focusOrder.length]!)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(focusOrder[(idx - 1 + focusOrder.length) % focusOrder.length]!)
        break
      case 'Home':
        e.preventDefault()
        moveFocus(focusOrder[0]!)
        break
      case 'End':
        e.preventDefault()
        moveFocus(focusOrder[focusOrder.length - 1]!)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        activatePair(Number(currentKey.slice('pair:'.length)))
        break
      default:
        break
    }
  }

  return (
    <svg
      ref={svgRef}
      data-diagram="pairs"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-[580px] flex-shrink-0"
      style={{ overflow: 'visible' }}
      role="group"
      aria-label={`Numogram pair graph, base ${g.base}, ${g.pairCount} syzygies. Arrow keys move between pairs, Enter selects.`}
      onKeyDown={onDiagramKeyDown}
    >
      <defs>
        <marker id="arr-pg" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="9" markerHeight="7" orient="auto">
          <path d="M0,0.5 L7,3 L0,5.5" fill="#22ee66" />
        </marker>
      </defs>

      {layout.regionLabels.map((r, i) => (
        <text
          key={`rl-${i}`}
          x={r.x}
          y={r.y}
          textAnchor={r.anchor}
          fill={zoneColorFor(r.kind)}
          fontSize={r.size}
          opacity={r.opacity}
          fontFamily="monospace"
        >
          {r.text}
        </text>
      ))}

      <g>
        {visiblePairIds.map(q => {
          const { lo, hi } = g.pair(q)
          const hl = hlZones.has(lo) || hlZones.has(hi)
          const arc = routes.arc[q] ?? null
          const loop = routes.loop[q] ?? null
          const opacity = hl ? 0.85 : anyFocus || pairStates?.[q] === 1 ? 0.08 : 0.6
          return (
            <React.Fragment key={`cur-${q}`}>
              {arc !== null && (
                <path
                  d={arc}
                  fill="none"
                  stroke="#22ee66"
                  strokeWidth={1.4 * ss}
                  markerEnd="url(#arr-pg)"
                  opacity={opacity}
                  style={{ transition: 'opacity 0.15s', pointerEvents: 'none' }}
                />
              )}
              {loop !== null && (
                <path
                  d={loop}
                  fill="none"
                  stroke="#22ee66"
                  strokeWidth={1.4 * ss}
                  markerEnd="url(#arr-pg)"
                  opacity={opacity}
                  style={{ transition: 'opacity 0.15s', pointerEvents: 'none' }}
                />
              )}
            </React.Fragment>
          )
        })}
      </g>

      {visiblePairIds.map(q => {
        const { lo, hi } = g.pair(q)
        const syz = syzygyByLo.get(lo) ?? null
        const clr = zoneColorFor(g.cycleOfPair(q).kind)
        const sel = selZones.has(lo) && selZones.has(hi)
        const hl = hlZones.has(lo) || hlZones.has(hi)
        const px = layout.px[q] ?? 0
        const py = layout.py[q] ?? 0
        const W = layout.nodeWidth
        const H = layout.nodeHeight
        const pairFocusKey = `pair:${q}`
        return (
          <g
            key={`pg-${q}`}
            data-pair={q}
            data-focus-key={pairFocusKey}
            data-post-baseline=""
            role="button"
            tabIndex={pairFocusKey === activeKey ? 0 : -1}
            aria-label={`Syzygy ${zoneLabels[hi]}::${zoneLabels[lo]}`}
            aria-pressed={sel}
            style={{ cursor: 'pointer' }}
            opacity={pairStates?.[q] === 1 ? 0.2 : undefined}
            onMouseEnter={() => syz && onHoverInfo({ type: 'syzygy', data: syz })}
            onMouseLeave={() => onHoverInfo(null)}
            onFocus={() => { setFocusKey(pairFocusKey); if (syz) onHoverInfo({ type: 'syzygy', data: syz }) }}
            onBlur={() => onHoverInfo(null)}
            onClick={() => {
              if (syz) onPinInfo({ type: 'syzygy', data: syz })
              onTogglePair(lo, hi)
            }}
          >
            <rect
              x={px - W / 2}
              y={py - H / 2}
              width={W}
              height={H}
              rx={H / 2}
              fill={clr}
              fillOpacity={sel ? 0.3 : 0.12}
              stroke={clr}
              strokeOpacity={sel || hl ? 1 : 0.6}
              strokeWidth={(sel ? 1.6 : 0.9) * ss}
            />
            {labelsOn && (
              <text
                x={px}
                y={py + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={layout.labelSize}
                fontWeight="bold"
                fill={clr}
                fontFamily="monospace"
                style={{ pointerEvents: 'none' }}
              >{`${zoneLabels[hi]}::${zoneLabels[lo]}`}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
})

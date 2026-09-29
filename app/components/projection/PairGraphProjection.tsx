// Interactive pair graph (LAY-04 view in the live viewer): one pill per syzygy hi::lo, current arcs around each
// Torque ring and the Plex/Warp self loops. Mirrors engine/scene/svgString.ts pairGraphToSvg and adds hover/pin.
// Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useMemo } from 'react'
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

  const syzygyByLo = useMemo(() => {
    const map = new Map<number, SyzygyData>()
    for (const s of view.syzygies) map.set(s.a, s)
    return map
  }, [view.syzygies])

  const pairIds = useMemo(() => Array.from({ length: P }, (_, q) => q), [P])
  const visiblePairIds = useMemo(() => pairIds.filter(q => pairStates?.[q] !== 0), [pairIds, pairStates])

  return (
    <svg
      data-diagram="pairs"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-[580px] flex-shrink-0"
      style={{ overflow: 'visible' }}
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
        return (
          <g
            key={`pg-${q}`}
            data-pair={q}
            style={{ cursor: 'pointer' }}
            opacity={pairStates?.[q] === 1 ? 0.2 : undefined}
            onMouseEnter={() => syz && onHoverInfo({ type: 'syzygy', data: syz })}
            onMouseLeave={() => onHoverInfo(null)}
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

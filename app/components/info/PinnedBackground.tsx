'use client'

import React from 'react'
import type { HoverInfo } from '../../data/types'
import { useNumogramView } from '../numogram/ViewContext'

interface PinnedBackgroundProps {
  pinnedInfo: HoverInfo | null
  hoverInfo: HoverInfo | null
}

export function PinnedBackground({ pinnedInfo, hoverInfo }: PinnedBackgroundProps) {
  const { view, zoneLabel } = useNumogramView()
  if (!pinnedInfo || !view) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[1] font-mono"
      style={{ opacity: hoverInfo ? 0.03 : 0.06, transition: 'opacity 0.5s ease' }}
    >
      <div className="max-w-[600px] px-12 text-center space-y-3">
        {pinnedInfo.type === 'zone' && (() => {
          const z = pinnedInfo.zone
          const clr = view.zoneColors[z]
          if (view.lore) {
            const meta = view.lore.zoneMeta[z]
            return (
              <>
                <div className="text-2xl tracking-[0.2em] uppercase" style={{ color: clr }}>Zone {zoneLabel(z)}</div>
                <div className="text-sm text-gray-600">{meta?.planetFull}</div>
                <p className="text-xs text-gray-700 leading-relaxed italic">{meta?.desc}</p>
                <p className="text-[10px] text-gray-800 leading-relaxed">{meta?.lemurian}</p>
              </>
            )
          }
          return (
            <>
              <div className="text-2xl tracking-[0.2em] uppercase" style={{ color: clr }}>Zone {zoneLabel(z)}</div>
              <div className="text-sm text-gray-600 uppercase tracking-[0.15em]">{view.zoneKind[z]}</div>
            </>
          )
        })()}
        {pinnedInfo.type === 'syzygy' && (() => {
          const s = pinnedInfo.data
          return (
            <>
              <div className="text-2xl tracking-[0.2em] uppercase text-white">Syzygy {zoneLabel(s.a)}::{zoneLabel(s.b)}</div>
              <div className="text-sm text-gray-600 italic">{s.demon}</div>
              {view.lore && <p className="text-xs text-gray-700 leading-relaxed italic">{s.desc}</p>}
            </>
          )
        })()}
        {pinnedInfo.type === 'current' && (() => {
          const c = pinnedInfo.data
          return (
            <>
              <div className="text-2xl tracking-[0.2em] uppercase" style={{ color: '#22ee66' }}>{c.name}</div>
              <div className="text-sm text-gray-600">{c.label}</div>
              {view.lore && <p className="text-xs text-gray-700 leading-relaxed italic">{c.desc}</p>}
            </>
          )
        })()}
        {pinnedInfo.type === 'gate' && (() => {
          const g = pinnedInfo.gate
          if (view.lore) {
            return (
              <>
                <div className="text-2xl tracking-[0.2em] uppercase" style={{ color: '#cc44ff' }}>{g.name}</div>
                <div className="text-sm text-gray-600">{g.desc}</div>
                <p className="text-xs text-gray-700 leading-relaxed italic">{g.detail}</p>
              </>
            )
          }
          return (
            <>
              <div className="text-2xl tracking-[0.2em] uppercase" style={{ color: '#cc44ff' }}>{g.name}</div>
              <div className="text-sm text-gray-600">Zone {zoneLabel(g.from)} {'→'} Zone {zoneLabel(g.to)}</div>
            </>
          )
        })()}
        {pinnedInfo.type === 'demon' && (() => {
          const d = pinnedInfo.demon
          return (
            <>
              <div className="text-2xl tracking-[0.2em] uppercase italic text-gray-400">{d.name}</div>
              <div className="text-sm text-gray-600">{zoneLabel(d.a)}::{zoneLabel(d.b)}</div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

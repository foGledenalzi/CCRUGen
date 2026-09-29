'use client'

import React from 'react'
import type { Layer } from '../../data/types'
import { formatNumeral } from '../../../engine/index'
import { useNumogramView } from '../numogram/ViewContext'
import { HoverInfoList, type HoverInfoListItem } from './HoverInfoList'
import { PanelUnavailable } from './shared'

interface LayersPanelProps {
  layers: Set<Layer>
  toggleLayer: (l: Layer) => void
  particlesOn: boolean
  onToggleParticles: () => void
}

const LAYER_DEFS: { id: Layer; label: string; clr: string; info: string }[] = [
  { id: 'syzygies', label: 'Syzygies', clr: '#e8e8e8',
    info: 'Five nine-sum twinnings (0+9, 1+8, 2+7, 3+6, 4+5). Each zone pairs with its complement to 9, generating the Barker spiral’s fundamental architecture.' },
  { id: 'currents', label: 'Currents', clr: '#22ee66',
    info: 'Five directed flows from syzygy differences. Surge, Hold, and Sink drive the anticlockwise Time Circuit hydrocycle. Warp and Plex are autonomous self-referential loops of Outer-Time.' },
  { id: 'gates', label: 'Gates', clr: '#cc44ff',
    info: 'Ten channels of digital cumulation (0, 1, 3, 6, 10, 15, 21, 28, 36, 45). Each gate routes from a syzygy midpoint to a destination zone, mapping the numogram’s navigational pathways.' },
  { id: 'pandemonium', label: 'Pandemonium', clr: '#cc3333',
    info: '45 demons of the Nma demonomy. Chronodemons link Time Circuit zones, xenodemons connect outer zones, amphidemons span both. Five syzygetic demons carry the nine-sum twinnings.' },
]

const LAYER_META = LAYER_DEFS.map(({ id, label, clr }) => ({ id, label, clr }))

const PARTICLE_INFO = 'Animated carriers for currents and gates. Useful for flow tracing and directional reading of active channels.'

export function LayersPanel({ layers, toggleLayer, particlesOn, onToggleParticles }: LayersPanelProps) {
  const { view, gateMode, allChordsMaxN, svgRichMaxN } = useNumogramView()
  if (!view) return <PanelUnavailable max={svgRichMaxN} />

  const n = view.zoneCount
  const pandemoniumUnavailable = !view.lore && view.demons === null

  const infoFor = (id: Layer): string => {
    if (view.lore) return (LAYER_DEFS.find(l => l.id === id) as (typeof LAYER_DEFS)[number]).info
    if (id === 'syzygies') return `${n / 2} syzygies: each zone pairs with its complement; the pair sums to ${formatNumeral(n - 1, n)}.`
    if (id === 'currents') return `${n / 2} currents, one per syzygy: the larger zone minus the smaller gives the destination zone.`
    if (id === 'gates') {
      const suffix = gateMode === 'thin'
        ? ' Drawn thin at this base.'
        : gateMode === 'off'
        ? ' Hidden at this base: too dense to draw legibly.'
        : ''
      return `${n} gates: zone k channels to the in-base digital root of its triangular cumulation T(k).${suffix}`
    }
    return pandemoniumUnavailable
      ? `Demon chords are drawn up to ${allChordsMaxN} zones (legibility limit).`
      : `${(n * (n - 1)) / 2} demons: every pair of distinct zones.`
  }

  const items: HoverInfoListItem[] = [
    ...LAYER_META.map(l => {
      const locked = l.id === 'pandemonium' && pandemoniumUnavailable
      return {
        id: l.id,
        color: l.clr,
        active: layers.has(l.id),
        info: infoFor(l.id),
        onClick: locked ? () => {} : () => toggleLayer(l.id),
        inactiveColor: '#333',
        label: <span className="text-gray-400 text-[10px]">{l.label}</span>,
        right: <span className="text-[8px] text-gray-700">{locked ? 'N/A' : (layers.has(l.id) ? 'ON' : 'OFF')}</span>,
      }
    }),
    {
      id: 'particles',
      color: '#00ccff',
      active: particlesOn,
      info: PARTICLE_INFO,
      onClick: onToggleParticles,
      inactiveColor: '#333',
      className: 'mt-1 pt-1',
      style: { borderTop: '1px solid rgba(255,255,255,0.04)' },
      label: <span className="text-gray-400 text-[10px]">Particles</span>,
      right: <span className="text-[8px] text-gray-700">{particlesOn ? 'ON' : 'OFF'}</span>,
    },
  ]

  return <HoverInfoList items={items} />
}

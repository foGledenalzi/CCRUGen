'use client'

import React, { useState } from 'react'
import type { HoverInfo } from '../../data/types'
import { REGION_CLR } from '../../lib/constants'
import { formatXenotationForDisplay } from '../../lib/xenotation'
import { useNumogramView } from '../numogram/ViewContext'
import {
  PanelColorBar,
  PanelCountToggleButton,
  PanelUnavailable,
  SelectableListPanel,
  SidePopover,
} from './shared'

interface ZonesPanelProps {
  selZones: Set<number>
  hlZones: Set<number>
  onToggleZone: (z: number) => void
  onToggleAll: () => void
  onHoverInfo: (info: HoverInfo | null) => void
}

export function ZonesPanel({ selZones, hlZones, onToggleZone, onToggleAll, onHoverInfo }: ZonesPanelProps) {
  const { view, zoneLabels, svgRichMaxN } = useNumogramView()
  const [hoverCard, setHoverCard] = useState<{ text: string; color: string; x: number; y: number } | null>(null)

  const showNAOverlay = (e: React.MouseEvent<HTMLSpanElement>, color: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverCard({
      text: "one isn't real",
      color,
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    })
  }

  if (!view || !zoneLabels) return <PanelUnavailable max={svgRichMaxN} />

  type ZoneItem = { zone: number; color: string; label: string; xenotation: string; isSelected: boolean; isHighlighted: boolean }
  const zoneItems: ZoneItem[] = Array.from({ length: view.zoneCount }, (_, zone) => ({
    zone,
    color: view.zoneColors[zone] as string,
    label: zoneLabels[zone] as string,
    xenotation: formatXenotationForDisplay(zone),
    isSelected: selZones.has(zone),
    isHighlighted: hlZones.has(zone),
  }))

  return (
    <SelectableListPanel
      items={zoneItems}
      getKey={item => item.zone}
      header={<PanelCountToggleButton selectedCount={selZones.size} total={view.zoneCount} onClick={onToggleAll} />}
      footer={<SidePopover card={hoverCard} />}
      onItemSelect={item => onToggleZone(item.zone)}
      onItemMouseEnter={item => onHoverInfo({ type: 'zone', zone: item.zone })}
      onItemMouseLeave={() => {
        onHoverInfo(null)
        setHoverCard(null)
      }}
      getItemOpacity={item => (item.isSelected || item.isHighlighted ? 1 : 0.5)}
      itemDisplay={({ item }) => (
        <>
          <PanelColorBar color={item.color} active={item.isSelected} />
          <span style={{ color: item.color, fontSize: '10px' }}>{item.label}</span>
          {view.lore && <span className="text-gray-600 text-[9px]">{view.lore.zoneMeta[item.zone]?.planet}</span>}
          <span
            className="text-[8px] tracking-[0.08em] text-gray-500"
            onMouseEnter={item.zone === 1 && item.xenotation === 'n/a' ? e => showNAOverlay(e, item.color) : undefined}
            onMouseLeave={item.zone === 1 && item.xenotation === 'n/a' ? () => setHoverCard(null) : undefined}
          >
            {item.xenotation}
          </span>
          <span className="text-[8px] ml-auto" style={{ color: REGION_CLR[view.zoneKind[item.zone] as keyof typeof REGION_CLR], opacity: 0.5 }}>
            {view.zoneKind[item.zone]}
          </span>
        </>
      )}
    />
  )
}

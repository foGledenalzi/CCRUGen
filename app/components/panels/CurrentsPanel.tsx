'use client'

import React from 'react'
import type { HoverInfo } from '../../data/types'
import { useNumogramView } from '../numogram/ViewContext'
import { PanelColorBar, PanelUnavailable, SelectableListPanel } from './shared'

interface CurrentsPanelProps {
  selZones: Set<number>
  hlZones: Set<number>
  onHoverInfo: (info: HoverInfo | null) => void
  onSelectCurrent: (from: number, to: number) => void
}

export function CurrentsPanel({ selZones, hlZones, onHoverInfo, onSelectCurrent }: CurrentsPanelProps) {
  const { view, zoneLabels, svgRichMaxN } = useNumogramView()
  if (!view || !zoneLabels) return <PanelUnavailable max={svgRichMaxN} />

  type CurrentItem = {
    name: string
    from: number
    to: number
    label: string
    desc: string
    isSemiSelected: boolean
    isSelected: boolean
    isHighlighted: boolean
  }
  const items: CurrentItem[] = view.currents.map(c => {
    const terminals = Array.from(new Set([c.from, c.to, view.partner(c.from)]))
    const selectedCount = terminals.reduce((count, zone) => count + (selZones.has(zone) ? 1 : 0), 0)
    const isSelected = selectedCount === terminals.length
    const isSemiSelected = selectedCount > 0 && !isSelected
    return {
      ...c,
      isSemiSelected,
      isSelected,
      isHighlighted: isSelected || isSemiSelected || terminals.some(zone => hlZones.has(zone)),
    }
  })

  return (
    <SelectableListPanel
      items={items}
      getKey={item => item.name}
      onItemSelect={item => onSelectCurrent(item.from, item.to)}
      onItemMouseEnter={item => onHoverInfo({ type: 'current', data: item })}
      onItemMouseLeave={() => onHoverInfo(null)}
      getItemOpacity={item => (item.isSelected ? 1 : item.isSemiSelected ? 0.8 : item.isHighlighted ? 0.65 : 0.5)}
      itemDisplay={({ item }) => (
        <>
          <PanelColorBar color="#22ee66" active={item.isSelected || item.isSemiSelected || item.isHighlighted} />
          <span style={{ color: '#22ee66', fontSize: '10px' }}>{item.name}</span>
          <div className="flex items-center gap-0.5 text-[8px]">
            <span style={{ color: view.zoneColors[item.from] }}>{zoneLabels[item.from]}</span>
            <span className="text-gray-700">{'→'}</span>
            <span style={{ color: view.zoneColors[item.to] }}>{zoneLabels[item.to]}</span>
          </div>
          <span className="text-[8px] text-gray-700 ml-auto italic">{item.label}</span>
        </>
      )}
    />
  )
}

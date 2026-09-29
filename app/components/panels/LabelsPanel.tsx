'use client'

import React from 'react'
import type { LabelVisibility } from '../../data/types'
import { useNumogramView } from '../numogram/ViewContext'
import { HoverInfoList, type HoverInfoListItem } from './HoverInfoList'
import { PanelUnavailable } from './shared'

interface LabelsPanelProps {
  labels: LabelVisibility
  onToggleLabel: (key: keyof LabelVisibility) => void
}

const LABEL_META: { id: keyof LabelVisibility; label: string; clr: string }[] = [
  { id: 'numbers', label: 'Numbers', clr: '#44a3ff' },
  { id: 'xenotation', label: 'Tic Xenotation', clr: '#cc88ff' },
  { id: 'planets', label: 'Planets', clr: '#e8e8e8' },
]

const XENOTATION_INFO = 'Show or hide tic xenotation strings for each zone.'
const PLANETS_INFO = 'Show or hide planetary labels/symbols on zone nodes.'

export function LabelsPanel({ labels, onToggleLabel }: LabelsPanelProps) {
  const { view, zoneLabel, svgRichMaxN } = useNumogramView()
  if (!view) return <PanelUnavailable max={svgRichMaxN} />

  const n = view.zoneCount
  const numbersInfo = view.lore
    ? 'Show or hide numeric zone ids (0-9) on the diagram.'
    : `Show or hide zone labels (${zoneLabel(0)}-${zoneLabel(n - 1)}).`

  const defs = LABEL_META.filter(def => def.id !== 'planets' || view.lore !== null)

  const items: HoverInfoListItem[] = defs.map(def => ({
    id: def.id,
    color: def.clr,
    active: labels[def.id],
    info: def.id === 'numbers' ? numbersInfo : def.id === 'xenotation' ? XENOTATION_INFO : PLANETS_INFO,
    onClick: () => onToggleLabel(def.id),
    inactiveColor: '#333',
    label: <span className="text-gray-400 text-[10px]">{def.label}</span>,
    right: <span className="text-[8px] text-gray-700">{labels[def.id] ? 'ON' : 'OFF'}</span>,
  }))

  return <HoverInfoList items={items} />
}

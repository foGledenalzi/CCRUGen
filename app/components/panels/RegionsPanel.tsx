'use client'

// The region legend for any base (UI-05, D-19..D-24): one row per Torque cycle in the engine's canonical order,
// then Warp, then Plex, each with an independent Isolate (spotlight) and Mute (hard hide) toggle. Base 10's row
// text and hover lore are pinned to the frozen pre-refactor strings (view.lore !== null); every other base gets a
// generic, structural info line built from the engine's own row/walk data. Original CCRUG code (MIT, NOTICE
// section 1).
import React from 'react'
import type { Region } from '../../data/types'
import { REGION_CLR } from '../../lib/constants'
import { regionRows, type RegionFilter, type RegionId } from '../../lib/regions'
import { useNumogramView } from '../numogram/ViewContext'
import { IsolateIcon, MuteIcon } from '../numogram/NumogramIcons'
import { HoverInfoList, type HoverInfoListItem } from './HoverInfoList'
import { PanelUnavailable } from './shared'

interface RegionsPanelProps {
  hlRegion: RegionId | null
  tcActive: boolean
  filter: RegionFilter
  onSelectRegion: (r: RegionId | null) => void
  onToggleTC: () => void
  onToggleIsolate: (id: RegionId) => void
  onToggleMute: (id: RegionId) => void
}

// Frozen base-10 hover texts (unchanged since Phase 1), keyed by region kind since every Torque row shares one
// kind. Shown only when the active base carries lore (view.lore !== null, base 10's own preset).
const REGION_INFO: Record<Region, string> = {
  torque: 'The six-zone Time Circuit — inner time. Cyclical recursion through Surge, Hold, and Sink currents drives the anticlockwise hydrocycle: precipitation, evaporation, and cataclysmic return.',
  warp: 'Zones 3 and 6 — Outer-Time. A self-referential vortical loop, intrinsically cryptic. The 3+6 syzygy difference folds back into itself, constituting autonomous temporality.',
  plex: 'Zones 0 and 9 — the absolute outer. The Plex envelops the entire system. The 0+9 syzygy constitutes the outermost curve of the Barker spiral, where existence and nonexistence converge.',
}

const TC_INFO = '1→8→7→2→5→4→1 — the anticlockwise hydrocycle driven by Surge, Hold, and Sink currents.'

const ZONE_LIST_MAX = 12
const ZONE_LIST_HEAD = 6
const TC_INFO_MAX = 200
// D-20: one continuous scrollable list even at 6+ rows (base 64+); never true at base 10 (4 items).
const SCROLL_ITEM_THRESHOLD = 8

function zoneListText(zones: readonly number[], zoneLabels: readonly string[]): string {
  if (zones.length <= ZONE_LIST_MAX) return zones.map(z => zoneLabels[z]).join(' ')
  return `${zones.slice(0, ZONE_LIST_HEAD).map(z => zoneLabels[z]).join(' ')} … (${zones.length})`
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export function RegionsPanel({
  hlRegion, tcActive, filter, onSelectRegion, onToggleTC, onToggleIsolate, onToggleMute,
}: RegionsPanelProps) {
  const { g, view, zoneLabels, svgRichMaxN } = useNumogramView()
  if (!view || !zoneLabels) return <PanelUnavailable max={svgRichMaxN} />

  const rows = regionRows(g)
  const items: HoverInfoListItem[] = [
    ...rows.map(row => {
      const muted = filter.mute.has(row.id)
      const isolated = filter.isolate.has(row.id)
      const color = REGION_CLR[row.kind]
      const active = hlRegion === row.id
      const info = view.lore !== null
        ? REGION_INFO[row.kind]
        : `${row.label}: ${row.lengthInPairs} ${row.lengthInPairs === 1 ? 'pair' : 'pairs'}, ${row.zones.length} zones.`
      return {
        id: row.id,
        color,
        active,
        info,
        onClick: () => onSelectRegion(active ? null : row.id),
        opacity: 1,
        inactiveColor: muted ? `${color}44` : undefined,
        label: (
          <span style={{ color, opacity: active ? 1 : 0.6, textDecoration: muted ? 'line-through' : undefined }}>
            {row.label}
          </span>
        ),
        right: (
          <span className="flex items-center gap-1">
            <span className="text-gray-700 text-[9px] font-mono">{zoneListText(row.zones, zoneLabels)}</span>
            <button
              type="button"
              data-post-baseline=""
              aria-pressed={isolated}
              aria-label={`Isolate ${row.label}`}
              title="Isolate this region"
              className="-my-1 inline-flex h-6 w-6 items-center justify-center"
              style={isolated ? { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } : undefined}
              onClick={e => { e.stopPropagation(); onToggleIsolate(row.id) }}
            >
              <IsolateIcon clr={isolated ? '#10ff50' : '#6b7280'} />
            </button>
            <button
              type="button"
              data-post-baseline=""
              aria-pressed={muted}
              aria-label={`Mute ${row.label}`}
              title="Mute this region"
              className="-my-1 inline-flex h-6 w-6 items-center justify-center"
              style={muted ? { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } : undefined}
              onClick={e => { e.stopPropagation(); onToggleMute(row.id) }}
            >
              <MuteIcon clr={muted ? '#10ff50' : '#6b7280'} />
            </button>
          </span>
        ),
      }
    }),
    {
      id: 'time-circuit',
      color: '#00ccff',
      active: tcActive,
      info: view.lore !== null
        ? TC_INFO
        : clip(view.torqueWalks.map(walk => walk.map(z => zoneLabels[z]).join('→')).join(' · '), TC_INFO_MAX),
      onClick: onToggleTC,
      opacity: 1,
      className: 'mt-1 pt-1',
      style: { borderTop: '1px solid rgba(255,255,255,0.04)' },
      label: (
        <span style={{
          color: '#00ccff',
          opacity: tcActive ? 1 : 0.6,
        }}
        >Time Circuit</span>
      ),
    },
  ]

  const list = <HoverInfoList items={items} className="space-y-1" />
  return items.length > SCROLL_ITEM_THRESHOLD
    ? <div className="max-h-[240px] overflow-y-auto">{list}</div>
    : list
}

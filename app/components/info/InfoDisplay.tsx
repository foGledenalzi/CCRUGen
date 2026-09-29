'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { HoverInfo } from '../../data/types'
import { REGION_CLR } from '../../lib/constants'
import { plexExpr } from '../../lib/numogram'
import { formatNumeral } from '../../../engine/index'
import { PanelGroup } from '../panels/PanelGroup'
import type { PanelGroupItem } from '../panels/PanelGroup'
import { GlitchText } from '../ui/GlitchText'
import { StatusDot } from '../ui/StatusDot'
import { DataRow } from '../ui/DataRow'
import { SectionFrame } from '../ui/SectionFrame'
import { useNumogramView, type NumogramViewContextValue } from '../numogram/ViewContext'

// ── Zone Info ──────────────────────────────────────────────────

function ZoneInfo({ zone }: { zone: number }) {
  const { base, view, zoneLabel } = useNumogramView()
  if (!view) return null
  const clr = view.zoneColors[zone] as string
  const kind = view.zoneKind[zone]
  const gate = view.gates[zone]
  const syz = view.syzygies.find(s => s.a === zone || s.b === zone)

  if (view.lore) {
    const meta = view.lore.zoneMeta[zone]
    const demons = (view.demons ?? []).filter(d => d.a === zone || d.b === zone)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <GlitchText text={`Zone ${zoneLabel(zone)}`} color={clr} />
          <StatusDot color={clr} />
          <span className="text-[8px] tracking-[0.15em] uppercase ml-auto" style={{ color: REGION_CLR[kind] }}>
            {kind}
          </span>
        </div>

        <div className="text-[9px] font-mono" style={{ color: `${clr}88` }}>{meta.planetFull}</div>
        <p className="text-[8px] text-gray-500 leading-relaxed italic">{meta.desc}</p>

        <SectionFrame color={clr}>
          {syz && <DataRow label="SYZ" value={`${zoneLabel(syz.a)}+${zoneLabel(syz.b)}=${formatNumeral(base - 1, base)} (${syz.demon})`} color={clr} />}
          <DataRow label="PARTICLE" value={view.lore.zoneParticle[zone] as string} color={clr} />
          {meta.spinal && <DataRow label="MU_TANTRA" value={`${meta.spinal} spine`} color={clr} />}
          <DataRow label="MESH_TAG" value={meta.meshTag} color={clr} />
          <DataRow label="PHASE_CT" value={String(meta.phaseCount)} color={clr} />
        </SectionFrame>

        {meta.door && (
          <SectionFrame title="DOOR" color={clr}>
            <div className="text-[8px] text-gray-400 italic">{meta.door}</div>
          </SectionFrame>
        )}

        {gate && (
          <SectionFrame title="GATE" color="#cc44ff">
            <div className="text-[9px]">
              <span style={{ color: '#cc44ff' }}>{gate.name}</span>
              <span className="text-gray-600"> {'→'} Zone {zoneLabel(gate.to)}</span>
            </div>
            <div className="text-[8px] text-gray-500 italic">{gate.desc}</div>
          </SectionFrame>
        )}

        <SectionFrame title="LEMURIAN ETHNOGRAPHY" color={clr}>
          <p className="text-[8px] text-gray-600 leading-relaxed">{meta.lemurian}</p>
        </SectionFrame>

        {meta.lemurs.length > 0 && (
          <SectionFrame title={`PHASE-${zone} LEMURS (${meta.phaseCount})`} color={clr}>
            <div className="space-y-0.5">
              {meta.lemurs.map(l => (
                <div key={l} className="text-[8px] italic" style={{ color: `${clr}77` }}>{l}</div>
              ))}
            </div>
          </SectionFrame>
        )}

        <div className="text-[7px] text-gray-700 pt-1 tracking-[0.1em]">
          {demons.length} DEMONS IN PANDEMONIUM
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GlitchText text={`Zone ${zoneLabel(zone)}`} color={clr} />
        <StatusDot color={clr} />
        <span className="text-[8px] tracking-[0.15em] uppercase ml-auto" style={{ color: REGION_CLR[kind] }}>
          {kind}
        </span>
      </div>
      <SectionFrame color={clr}>
        {syz && <DataRow label="SYZ" value={`${zoneLabel(syz.a)}+${zoneLabel(syz.b)}=${formatNumeral(base - 1, base)} (${syz.demon})`} color={clr} />}
        {gate && <DataRow label="GATE" value={`${gate.name} → Zone ${zoneLabel(gate.to)}`} color={clr} />}
      </SectionFrame>
      <div className="text-[7px] text-gray-700 pt-1 tracking-[0.1em]">
        {base - 1} DEMONS IN PANDEMONIUM
      </div>
    </div>
  )
}

// ── Syzygy Info ────────────────────────────────────────────────

function SyzygyInfo({ data }: { data: HoverInfo & { type: 'syzygy' } }) {
  const s = data.data
  const { base, view, zoneLabel } = useNumogramView()
  if (!view) return null
  const diff = s.b - s.a

  if (view.lore) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <GlitchText text={`Syzygy ${zoneLabel(s.a)}::${zoneLabel(s.b)}`} color="#e8e8e8" />
          <StatusDot color="#e8e8e8" />
        </div>
        <DataRow label="TWINNING" value={`${zoneLabel(s.a)} + ${zoneLabel(s.b)} = ${formatNumeral(base - 1, base)}`} color="#e8e8e8" />
        <DataRow label="DEMON" value={s.demon} color="#e8e8e8" />
        <p className="text-[8px] text-gray-500 leading-relaxed italic">{s.desc}</p>
        <SectionFrame color="#e8e8e8">
          <div className="text-[9px]">
            <span style={{ color: view.zoneColors[s.a] }}>Zone {zoneLabel(s.a)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[s.a]?.planet}) {'↔'} </span>
            <span style={{ color: view.zoneColors[s.b] }}>Zone {zoneLabel(s.b)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[s.b]?.planet})</span>
          </div>
          <DataRow
            label="CURRENT_DIFF"
            value={`${zoneLabel(s.b)}−${zoneLabel(s.a)}=${formatNumeral(diff, base)}${diff === s.a ? ' (self-ref)' : ` → Z${zoneLabel(diff)}`}`}
            color="#e8e8e8"
          />
        </SectionFrame>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GlitchText text={`Syzygy ${zoneLabel(s.a)}::${zoneLabel(s.b)}`} color="#e8e8e8" />
        <StatusDot color="#e8e8e8" />
      </div>
      <DataRow label="TWINNING" value={`${zoneLabel(s.a)} + ${zoneLabel(s.b)} = ${formatNumeral(base - 1, base)}`} color="#e8e8e8" />
      <DataRow label="DEMON" value={s.demon} color="#e8e8e8" />
      <SectionFrame color="#e8e8e8">
        <div className="text-[9px]">
          <span style={{ color: view.zoneColors[s.a] }}>Zone {zoneLabel(s.a)}</span>
          <span className="text-gray-700"> {'↔'} </span>
          <span style={{ color: view.zoneColors[s.b] }}>Zone {zoneLabel(s.b)}</span>
        </div>
        <DataRow
          label="CURRENT_DIFF"
          value={`${zoneLabel(s.b)}−${zoneLabel(s.a)}=${formatNumeral(diff, base)}${diff === s.a ? ' (self-ref)' : ` → Z${zoneLabel(diff)}`}`}
          color="#e8e8e8"
        />
      </SectionFrame>
    </div>
  )
}

// ── Current Info ───────────────────────────────────────────────

function CurrentInfo({ data }: { data: HoverInfo & { type: 'current' } }) {
  const c = data.data
  const { view, zoneLabel } = useNumogramView()
  if (!view) return null

  if (view.lore) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <GlitchText text={`${c.name} Current`} color="#22ee66" />
          <StatusDot color="#22ee66" />
        </div>
        <DataRow label="FORMULA" value={c.label} color="#22ee66" />
        <p className="text-[8px] text-gray-500 leading-relaxed italic">{c.desc}</p>
        <SectionFrame color="#22ee66">
          <div className="text-[9px]">
            <span className="text-gray-600">FROM: </span>
            <span style={{ color: view.zoneColors[c.from] }}>Zone {zoneLabel(c.from)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[c.from]?.planet})</span>
          </div>
          <div className="text-[9px]">
            <span className="text-gray-600">TO: </span>
            <span style={{ color: view.zoneColors[c.to] }}>Zone {zoneLabel(c.to)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[c.to]?.planet})</span>
          </div>
        </SectionFrame>
        <div className="text-[7px] text-gray-700 tracking-[0.1em]">
          TIME CIRCUIT FLOW (ANTICLOCKWISE)
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GlitchText text={`${c.name} Current`} color="#22ee66" />
        <StatusDot color="#22ee66" />
      </div>
      <DataRow label="FORMULA" value={c.label} color="#22ee66" />
      <SectionFrame color="#22ee66">
        <div className="text-[9px]">
          <span className="text-gray-600">FROM: </span>
          <span style={{ color: view.zoneColors[c.from] }}>Zone {zoneLabel(c.from)}</span>
        </div>
        <div className="text-[9px]">
          <span className="text-gray-600">TO: </span>
          <span style={{ color: view.zoneColors[c.to] }}>Zone {zoneLabel(c.to)}</span>
        </div>
      </SectionFrame>
    </div>
  )
}

// ── Gate Info ──────────────────────────────────────────────────

function GateInfo({ data }: { data: HoverInfo & { type: 'gate' } }) {
  const g = data.gate
  const { base, view, zoneLabel } = useNumogramView()
  const plex = plexExpr(g.cum, base)
  if (!view) return null

  if (view.lore) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <GlitchText text={g.name} color="#cc44ff" />
          <StatusDot color="#cc44ff" />
          <span className="text-[8px] text-gray-600 ml-auto">{g.desc}</span>
        </div>
        <DataRow label="CUMULATION" value={formatNumeral(g.cum, base)} color="#cc44ff" />
        {plex && (
          <DataRow label="PLEX" value={plex} color="#cc44ff" />
        )}
        <DataRow
          label="CHANNEL"
          value={g.from === g.to ? `Z${zoneLabel(g.from)} → self` : `Z${zoneLabel(g.from)} → Z${zoneLabel(g.to)}`}
          color="#cc44ff"
        />
        <p className="text-[8px] text-gray-500 leading-relaxed italic">{g.detail}</p>
        <SectionFrame color="#cc44ff">
          <div className="text-[9px]">
            <span className="text-gray-600">FLOW: </span>
            <span style={{ color: view.zoneColors[g.from] }}>Zone {zoneLabel(g.from)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[g.from]?.planet}) {'→'} </span>
            <span style={{ color: view.zoneColors[g.to] }}>Zone {zoneLabel(g.to)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[g.to]?.planet})</span>
          </div>
        </SectionFrame>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GlitchText text={g.name} color="#cc44ff" />
        <StatusDot color="#cc44ff" />
      </div>
      <DataRow label="CUMULATION" value={formatNumeral(g.cum, base)} color="#cc44ff" />
      {plex && <DataRow label="PLEX" value={plex} color="#cc44ff" />}
      <DataRow
        label="CHANNEL"
        value={g.from === g.to ? `Z${zoneLabel(g.from)} → self` : `Z${zoneLabel(g.from)} → Z${zoneLabel(g.to)}`}
        color="#cc44ff"
      />
      <SectionFrame color="#cc44ff">
        <div className="text-[9px]">
          <span className="text-gray-600">FLOW: </span>
          <span style={{ color: view.zoneColors[g.from] }}>Zone {zoneLabel(g.from)}</span>
          <span className="text-gray-700"> {'→'} </span>
          <span style={{ color: view.zoneColors[g.to] }}>Zone {zoneLabel(g.to)}</span>
        </div>
      </SectionFrame>
    </div>
  )
}

// ── Demon Info ─────────────────────────────────────────────────

function DemonInfo({ data }: { data: HoverInfo & { type: 'demon' } }) {
  const d = data.demon
  const { base, view, zoneLabel } = useNumogramView()
  if (!view) return null
  const kindClr = d.kind === 'chrono' ? '#00ccff'
    : d.kind === 'xeno' ? '#cc3333'
    : d.kind === 'amphi' ? '#cc8833' : '#e8e8e8'

  if (view.lore) {
    const kindDesc = d.kind === 'chrono'
      ? 'CHRONODEMON — both zones within Time Circuit'
      : d.kind === 'xeno'
      ? 'XENODEMON — both zones outside Time Circuit'
      : d.kind === 'amphi'
      ? 'AMPHIDEMON — spans TC and outer regions'
      : 'SYZYGETIC — carries a nine-sum twinning'
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <GlitchText text={d.name} color={kindClr} />
          <StatusDot color={kindClr} />
          <span className="text-[8px] text-gray-600 ml-auto">{zoneLabel(d.a)}::{zoneLabel(d.b)}</span>
        </div>
        <div className="text-[7px] tracking-[0.12em]" style={{ color: `${kindClr}bb` }}>{kindDesc}</div>
        <SectionFrame color={kindClr}>
          <div className="text-[9px]">
            <span style={{ color: view.zoneColors[d.a] }}>Zone {zoneLabel(d.a)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[d.a]?.planet}) {'—'} </span>
            <span style={{ color: view.zoneColors[d.b] }}>Zone {zoneLabel(d.b)}</span>
            <span className="text-gray-700"> ({view.lore.zoneMeta[d.b]?.planet})</span>
          </div>
        </SectionFrame>
      </div>
    )
  }

  const kindDesc = d.kind === 'chrono'
    ? 'CHRONODEMON — both zones in Torque cycles'
    : d.kind === 'xeno'
    ? 'XENODEMON — both zones outside the Torque cycles'
    : d.kind === 'amphi'
    ? 'AMPHIDEMON — spans a Torque cycle and Plex or Warp'
    : `SYZYGETIC — its zones sum to ${formatNumeral(base - 1, base)}`

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GlitchText text={d.name} color={kindClr} />
        <StatusDot color={kindClr} />
        <span className="text-[8px] text-gray-600 ml-auto">{zoneLabel(d.a)}::{zoneLabel(d.b)}</span>
      </div>
      <div className="text-[7px] tracking-[0.12em]" style={{ color: `${kindClr}bb` }}>{kindDesc}</div>
      <SectionFrame color={kindClr}>
        <div className="text-[9px]">
          <span style={{ color: view.zoneColors[d.a] }}>Zone {zoneLabel(d.a)}</span>
          <span className="text-gray-700"> {'—'} </span>
          <span style={{ color: view.zoneColors[d.b] }}>Zone {zoneLabel(d.b)}</span>
        </div>
      </SectionFrame>
    </div>
  )
}

// ── Main InfoDisplay ───────────────────────────────────────────

interface InfoDisplayProps {
  hoverInfo: HoverInfo | null
  pinnedInfo: HoverInfo | null
  selectedInfos?: HoverInfo[]
  onRemoveSelectedInfo?: (info: HoverInfo) => void
  onHoverSelectedInfo?: (info: HoverInfo | null) => void
}

function selectedInfoKey(info: HoverInfo): string {
  switch (info.type) {
    case 'zone': return `zone:${info.zone}`
    case 'syzygy': return `syzygy:${info.data.a}:${info.data.b}`
    case 'current': return `current:${info.data.name}`
    case 'gate': return `gate:${info.gate.name}`
    case 'demon': return `demon:${info.demon.a}:${info.demon.b}:${info.demon.kind}`
  }
}

function selectedInfoMeta(info: HoverInfo, ctx: NumogramViewContextValue): { title: string; color: string } {
  const { view, zoneLabel } = ctx
  switch (info.type) {
    case 'zone':
      return { title: `Zone ${zoneLabel(info.zone)}`, color: view ? (view.zoneColors[info.zone] as string) : '#e8e8e8' }
    case 'syzygy':
      return { title: `Syzygy ${zoneLabel(info.data.a)}::${zoneLabel(info.data.b)}`, color: '#e8e8e8' }
    case 'current':
      return { title: `${info.data.name} Current`, color: '#22ee66' }
    case 'gate':
      return { title: info.gate.name, color: '#cc44ff' }
    case 'demon':
      return {
        title: info.demon.name,
        color: info.demon.kind === 'chrono' ? '#00ccff'
          : info.demon.kind === 'xeno' ? '#cc3333'
          : info.demon.kind === 'amphi' ? '#cc8833' : '#e8e8e8',
      }
  }
}

function renderInfoContent(info: HoverInfo) {
  if (info.type === 'zone') return <ZoneInfo zone={info.zone} />
  if (info.type === 'syzygy') return <SyzygyInfo data={info as HoverInfo & { type: 'syzygy' }} />
  if (info.type === 'current') return <CurrentInfo data={info as HoverInfo & { type: 'current' }} />
  if (info.type === 'gate') return <GateInfo data={info as HoverInfo & { type: 'gate' }} />
  return <DemonInfo data={info as HoverInfo & { type: 'demon' }} />
}

function NumogramIntro() {
  const { base, view, summary, zoneLabel } = useNumogramView()

  if (view?.lore) {
    return (
      <div className="space-y-2">
        <SectionFrame color="#10ff50">
          <p className="text-[8px] text-gray-400 leading-relaxed italic">
            The Numogram is a decimal labyrinth: ten zones (0-9), paired syzygies that sum to nine,
            and pathways that map transitions through the system.
          </p>
          <p className="text-[8px] text-gray-500 leading-relaxed mt-1.5">
            Currents track differential flows across syzygetic pairs. Gates track culminations
            (triangular sums), then reduce multi-digit values by summation to determine the
            connecting source.
          </p>
          <p className="text-[8px] text-gray-600 leading-relaxed mt-1.5">
            Use hover and selection to inspect zones, currents, gates, and demons as a navigational
            map of recursive time and drift between torque, warp, and plex.
          </p>
          <p className="text-[8px] text-gray-500 leading-relaxed mt-1.5">
            Controls: click + drag to select, alt + drag to move, scroll to zoom, digits to toggle
            gates, ASDF to change view.
          </p>
        </SectionFrame>
        <div className="text-[7px] text-gray-700 tracking-[0.1em] uppercase">
          Click empty space to return here.
        </div>
      </div>
    )
  }

  if (view) {
    const n = view.zoneCount
    return (
      <div className="space-y-2">
        <SectionFrame color="#10ff50">
          <p className="text-[8px] text-gray-400 leading-relaxed italic">
            {`This numogram has ${n} zones (${zoneLabel(0)} to ${zoneLabel(n - 1)}); each syzygy pairs zones that sum to ${formatNumeral(n - 1, n)}. Currents flow from each syzygy's difference, gates from each zone's triangular cumulation reduced by the in-base digital root.`}
          </p>
          <p className="text-[8px] text-gray-500 leading-relaxed mt-1.5">
            Controls: click + drag to select, alt + drag to move, scroll to zoom, ASDF to change view.
          </p>
        </SectionFrame>
        <div className="text-[7px] text-gray-700 tracking-[0.1em] uppercase">
          Click empty space to return here.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <SectionFrame color="#10ff50">
        <p className="text-[8px] text-gray-400 leading-relaxed italic">
          {`Base ${base}: ${summary.zoneCount} zones, ${summary.torqueCount} Torque cycle${summary.torqueCount === 1 ? '' : 's'}${summary.hasWarp ? ', a Warp,' : ','} ${summary.demonCount} demons.`}
        </p>
      </SectionFrame>
    </div>
  )
}

export function InfoDisplay({
  hoverInfo,
  pinnedInfo,
  selectedInfos = [],
  onRemoveSelectedInfo,
  onHoverSelectedInfo,
}: InfoDisplayProps) {
  const ctx = useNumogramView()
  const info = hoverInfo || pinnedInfo
  const selectedByKey = new Map(selectedInfos.map(si => [selectedInfoKey(si), si]))
  const selectedKeys = useMemo(() => selectedInfos.map(selectedInfoKey), [selectedInfos])
  const [orderedKeys, setOrderedKeys] = useState<string[]>([])

  useEffect(() => {
    if (selectedInfos.length === 0) {
      setOrderedKeys([])
      return
    }
    const valid = new Set(selectedKeys)
    setOrderedKeys(prev => {
      const kept = prev.filter(k => valid.has(k))
      const appended = selectedKeys.filter(k => !kept.includes(k))
      const next = [...kept, ...appended]
      if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev
      return next
    })
  }, [selectedInfos.length, selectedKeys])

  if (selectedInfos.length > 0) {
    const groupItems = orderedKeys.reduce<PanelGroupItem[]>((acc, key) => {
        const si = selectedByKey.get(key)
        if (!si) return acc
        const meta = selectedInfoMeta(si, ctx)
        acc.push({
          id: key,
          title: meta.title,
          color: meta.color,
          content: renderInfoContent(si),
          onRemove: onRemoveSelectedInfo ? () => onRemoveSelectedInfo(si) : undefined,
          onHoverStart: onHoverSelectedInfo ? () => onHoverSelectedInfo(si) : undefined,
          onHoverEnd: onHoverSelectedInfo ? () => onHoverSelectedInfo(null) : undefined,
        })
        return acc
      }, [])
    groupItems.unshift({
      id: 'base:numogram',
      title: 'Numogram',
      color: '#10ff50',
      content: <NumogramIntro />,
    })

    return (
      <div className="px-2 pb-2">
        <PanelGroup
          items={groupItems}
          openLastOnItemsChange
        />
      </div>
    )
  }

  if (!info) {
    return (
      <div className="px-2 pb-2">
        <PanelGroup
          items={[{
            id: 'base:numogram',
            title: 'Numogram',
            color: '#10ff50',
            content: <NumogramIntro />,
          }]}
        />
      </div>
    )
  }

  return (
    <div className="px-3 pb-3">
      {renderInfoContent(info)}
    </div>
  )
}

// The big-base degradation fallback (D-14..D-18): replaces the entire interactive Projection.tsx tree the moment a
// committed base exceeds the measured svgRichMaxN — a factual refusal message, a numeric summary card, and the
// accessible text view. No "show anyway" control exists (D-18); the cutoff always arrives as a prop from the tier
// table, never a literal. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React from 'react'
import { bigBaseMessage } from '../../lib/numogramText'
import type { NumogramSummary } from '../../lib/numogramView'
import { TextView } from './TextView'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.3em] text-gray-400">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none text-gray-100">{value}</div>
    </div>
  )
}

export function BigBaseSummary({
  summary,
  svgRichMaxN,
  text,
}: {
  summary: NumogramSummary
  svgRichMaxN: number
  text: string
}) {
  const lengths = summary.torqueLengths.join(',')
  const moreLengths = summary.torqueCount > summary.torqueLengths.length ? ',…' : ''

  return (
    <section data-post-baseline="" aria-label="Numogram summary" className="w-[580px] max-w-[92vw] space-y-2 font-mono">
      <p role="status" className="text-[11px] text-[#f87171]">
        {bigBaseMessage(summary.base, summary.zoneCount, svgRichMaxN)}
      </p>
      <div className="border border-[#334155] bg-[#0a1018] px-3 py-3 grid grid-cols-2 gap-3">
        <Metric label="Zones" value={String(summary.zoneCount)} />
        <Metric label="Warp" value={summary.hasWarp ? 'yes' : 'no'} />
        <Metric label="Torque cycles" value={`${summary.torqueCount} [${lengths}${moreLengths}]`} />
        <Metric label="Demons" value={summary.demonCount.toLocaleString('en-US')} />
      </div>
      <TextView text={text} />
    </section>
  )
}

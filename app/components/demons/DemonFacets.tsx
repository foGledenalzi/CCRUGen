// Demon type facets: the count display and the filter are one control (DEM-01, D-05). Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useMemo } from 'react'
import { useNumogramView } from '../numogram/ViewContext'
import { facetModel, parentType, TYPE_LABEL, type DemonFilter, type FacetChip } from '../../lib/demonBrowser'
import { Pill } from '../ui/Pill'

export interface DemonFacetsProps {
  readonly filter: DemonFilter | null
  readonly onFilterChange: (next: DemonFilter | null) => void
}

export function DemonFacets({ filter, onFilterChange }: DemonFacetsProps): JSX.Element {
  const { g } = useNumogramView()
  const model = useMemo(() => facetModel(g, filter), [g, filter])

  // T-05-19: filters come only from facetModel chips (engine tuples), never free text; a disabled (zero-count)
  // chip is inert. An already-active type or subtype chip clears back to its parent (All, or the type itself).
  function onChip(chip: FacetChip): void {
    if (chip.disabled) return
    if (chip.id === 'all') {
      onFilterChange(null)
      return
    }
    if (chip.active && chip.level === 'type') {
      onFilterChange(null)
      return
    }
    if (chip.active && chip.level === 'subtype') {
      onFilterChange(parentType(chip.filter as DemonFilter))
      return
    }
    onFilterChange(chip.filter)
  }

  function renderChip(chip: FacetChip): JSX.Element {
    return (
      <button
        type="button"
        key={chip.id}
        data-facet={chip.id}
        data-count={chip.count}
        aria-pressed={chip.active}
        aria-disabled={chip.disabled ? 'true' : undefined}
        className={`rounded-full ${chip.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        style={
          chip.active ? { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } : undefined
        }
        onClick={() => onChip(chip)}
      >
        <Pill accent={chip.color}>
          {chip.label} {chip.count.toLocaleString('en-US')}
        </Pill>
      </button>
    )
  }

  return (
    <div data-demon-facets="" className="flex flex-col gap-2">
      <div role="group" aria-label="Demon type filter" className="flex flex-wrap gap-2">
        {model.top.map(renderChip)}
      </div>
      {model.sub.length > 0 && (
        <div role="group" aria-label={`${TYPE_LABEL[parentType(filter!)]} subtypes`} className="flex flex-wrap gap-2 pl-4">
          {model.sub.map(renderChip)}
        </div>
      )}
    </div>
  )
}

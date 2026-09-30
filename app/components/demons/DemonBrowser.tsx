// Demon browser tab (DEM-02, D-02, D-05). Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { DemonRef } from '../../../engine/index'
import { useNumogramView } from '../numogram/ViewContext'
import { DemonFacets } from './DemonFacets'
import { DemonRowList } from './DemonRowList'
import {
  DEFAULT_DEMON_SORT,
  orderedSource,
  rowSourceFor,
  type DemonFilter,
  type DemonSort,
  type DemonSortKey,
} from '../../lib/demonBrowser'
import { SEARCH_MAX_LENGTH, clampQuery, emptyFilterMessage, resolveDemonSearch, searchMessage } from '../../lib/demonSearch'

export interface DemonBrowserProps {
  readonly filter: DemonFilter | null
  readonly onFilterChange: (next: DemonFilter | null) => void
  readonly selectedMesh: number | null
  readonly onHoverDemon: (d: DemonRef | null) => void
  readonly onSelectDemon: (d: DemonRef) => void
}

export function DemonBrowser(props: DemonBrowserProps): JSX.Element {
  const { filter, onFilterChange, selectedMesh, onHoverDemon, onSelectDemon } = props
  const { g } = useNumogramView()

  const [sort, setSort] = useState<DemonSort>(DEFAULT_DEMON_SORT)
  const [query, setQuery] = useState('')
  const [reveal, setReveal] = useState<{ index: number | null; nonce: number }>({ index: null, nonce: 0 })

  const source = useMemo(() => orderedSource(rowSourceFor(g, filter, sort.key), sort.direction), [g, filter, sort])
  const outcome = useMemo(() => resolveDemonSearch(query, g, filter, sort), [query, g, filter, sort])

  // A fresh search hit reveals (scrolls to + marks) its row. Enter re-reveals the current hit via bumpReveal below.
  useEffect(() => {
    if (outcome.kind === 'found') {
      setReveal(r => ({ index: outcome.index, nonce: r.nonce + 1 }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome])

  // Filter/sort changes remount DemonRowList (key below) and reset any stale reveal target.
  useEffect(() => {
    setReveal({ index: null, nonce: 0 })
  }, [filter, sort])

  function onSortChange(key: DemonSortKey): void {
    setSort(prev => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
  }

  function bumpReveal(): void {
    if (outcome.kind === 'found') setReveal(r => ({ index: outcome.index, nonce: r.nonce + 1 }))
  }

  const message = searchMessage(outcome, filter, g.demons.count)
  const empty = emptyFilterMessage(filter, g.demons.count)

  return (
    <div data-demon-browser="" className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4">
        <DemonFacets filter={filter} onFilterChange={onFilterChange} />
        <label className="block w-full max-w-[220px] shrink-0">
          <span className="ui-terminal-field">
            <input
              aria-label="Search demons"
              maxLength={SEARCH_MAX_LENGTH}
              value={query}
              placeholder="mesh number or a::b"
              onChange={e => setQuery(clampQuery(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter') bumpReveal()
              }}
              className="ui-terminal-input w-full px-0 py-2 text-[10px] text-gray-100"
            />
          </span>
        </label>
      </div>
      {message && (
        <div role="status" data-demon-search-status="" className="mt-2 text-[11px] text-[#f87171]">
          <div>{message.heading}</div>
          {message.body && <div className="text-gray-500">{message.body}</div>}
        </div>
      )}
      <div className="mt-4 flex-1 min-h-0">
        {source.count === 0 ? (
          <div data-demon-empty="" className="text-[11px] text-[#f87171]">
            <div>{empty.heading}</div>
            <div className="text-gray-500">{empty.body}</div>
          </div>
        ) : (
          <DemonRowList
            key={`${g.base}|${filter ?? 'all'}|${sort.key}|${sort.direction}`}
            listId="browser"
            source={source}
            ariaLabel="Demons"
            selectedMesh={selectedMesh}
            revealIndex={reveal.index}
            revealNonce={reveal.nonce}
            sort={sort}
            onSortChange={onSortChange}
            onHoverDemon={onHoverDemon}
            onSelectDemon={onSelectDemon}
          />
        )}
      </div>
    </div>
  )
}

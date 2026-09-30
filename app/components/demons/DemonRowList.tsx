// Virtualized, windowed demon row list (DEM-02, D-02). Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DemonRef } from '../../../engine/index'
import { useNumogramView } from '../numogram/ViewContext'
import { CyberButton } from '../ui/CyberButton'
import type { DemonRowSource, DemonSort, DemonSortKey } from '../../lib/demonBrowser'
import {
  BROWSER_WINDOW_ROWS,
  ROW_HEIGHT_PX,
  demonName,
  kindColor,
  netSpanLabel,
  SUBTYPE_LABEL,
  windowAt,
  windowCount,
} from '../../lib/demonBrowser'

// UI-SPEC "Browser tab": four columns, sized so MESH/TYPE stay compact and A::B/NAME get the extra room.
const COLUMNS = 'minmax(88px,1.1fr) minmax(72px,0.9fr) minmax(136px,1.5fr) minmax(88px,1fr)'
const EN_DASH = String.fromCodePoint(0x2013)
const UP_GLYPH = String.fromCodePoint(0x25b2)
const DOWN_GLYPH = String.fromCodePoint(0x25bc)

export interface DemonRowListProps {
  readonly listId: 'browser' | 'focus'
  // Already filtered + ordered by the parent; the parent remounts this list (React key) when the source changes.
  readonly source: DemonRowSource
  readonly ariaLabel: string
  // Pinned/focused demon: gets the UI-SPEC selected token and aria-selected="true".
  readonly selectedMesh: number | null
  // Absolute index to scroll to (align 'center') and mark data-active; bump revealNonce to reveal it again.
  readonly revealIndex: number | null
  readonly revealNonce: number
  // Present -> A::B / MESH / TYPE headers become sort buttons.
  readonly sort?: DemonSort
  readonly onSortChange?: (key: DemonSortKey) => void
  readonly onHoverDemon: (d: DemonRef | null) => void
  readonly onSelectDemon: (d: DemonRef) => void
}

type ColumnId = 'ab' | 'mesh' | 'type' | 'name'

/** aria-sort for a sortable column header: key match -> direction, else 'none'; undefined when `sort` is absent. */
function sortAriaFor(sort: DemonSort | undefined, key: DemonSortKey): 'ascending' | 'descending' | 'none' | undefined {
  if (!sort) return undefined
  if (sort.key !== key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

export function DemonRowList({
  listId,
  source,
  ariaLabel,
  selectedMesh,
  revealIndex,
  revealNonce,
  sort,
  onSortChange,
  onHoverDemon,
  onSelectDemon,
}: DemonRowListProps) {
  const { base, zoneLabel } = useNumogramView()

  // Window paging (T-05-17): only one <= BROWSER_WINDOW_ROWS-row window is ever mounted in the virtualizer.
  const [page, setPage] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const [gridFocused, setGridFocused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const revealTargetRef = useRef<number | null>(null)

  const win = windowAt(source.count, page)
  const pages = windowCount(source.count)

  const virtualizer = useVirtualizer({
    count: win.size,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
    scrollMargin: ROW_HEIGHT_PX,
  })

  // Reveal a specific absolute row (e.g. from a diagram click or a search hit): cross a window boundary first if
  // needed, the follow-up effect below finishes the scroll once `page` has actually switched.
  useEffect(() => {
    if (revealIndex === null) return
    const targetPage = Math.floor(revealIndex / BROWSER_WINDOW_ROWS)
    if (targetPage !== page) {
      revealTargetRef.current = revealIndex
      setPage(targetPage)
    } else {
      virtualizer.scrollToIndex(revealIndex - win.start, { align: 'center' })
    }
    setActive(revealIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealIndex, revealNonce])

  useEffect(() => {
    const target = revealTargetRef.current
    if (target === null) return
    if (Math.floor(target / BROWSER_WINDOW_ROWS) !== page) return
    virtualizer.scrollToIndex(target - win.start, { align: 'center' })
    revealTargetRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function goToPage(next: number): void {
    setPage(next)
    setActive(null)
    virtualizer.scrollToOffset(0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (win.size === 0) return
    const current = active ?? win.start
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelectDemon(source.at(current))
      return
    }
    let next: number | null = null
    if (e.key === 'ArrowDown') next = Math.min(current + 1, win.start + win.size - 1)
    else if (e.key === 'ArrowUp') next = Math.max(current - 1, win.start)
    else if (e.key === 'PageDown') next = Math.min(current + 20, win.start + win.size - 1)
    else if (e.key === 'PageUp') next = Math.max(current - 20, win.start)
    else if (e.key === 'Home') next = win.start
    else if (e.key === 'End') next = win.start + win.size - 1
    else return
    e.preventDefault()
    setActive(next)
    virtualizer.scrollToIndex(next - win.start, { align: 'auto' })
  }

  const activeId = active !== null ? `demon-${listId}-row-${active}` : undefined

  function headerCell(col: ColumnId, label: string): React.ReactNode {
    if (col === 'name' || !sort) {
      return (
        <div key={col} role="columnheader" data-col={col}>
          {label}
        </div>
      )
    }
    const key: DemonSortKey = col === 'type' ? 'type' : 'mesh'
    return (
      <div key={col} role="columnheader" data-col={col} aria-sort={sortAriaFor(sort, key)}>
        <button type="button" data-sort-col={col} onClick={() => onSortChange?.(key)}>
          {label}
          {sort.key === key && <span aria-hidden="true"> {sort.direction === 'asc' ? UP_GLYPH : DOWN_GLYPH}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={source.count + 1}
        aria-colcount={4}
        data-demon-list={listId}
        data-focus-key={`demon-list-${listId}`}
        tabIndex={0}
        aria-activedescendant={activeId}
        className="h-full min-h-0 overflow-auto"
        style={{ outline: 'none' }}
        onKeyDown={handleKeyDown}
        onFocus={() => setGridFocused(true)}
        onBlur={() => setGridFocused(false)}
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-[1] grid px-2 text-[8px] uppercase tracking-[0.12em] text-gray-500"
          style={{
            height: ROW_HEIGHT_PX,
            gridTemplateColumns: COLUMNS,
            alignItems: 'center',
            background: 'rgba(8,8,15,0.97)',
          }}
        >
          {headerCell('ab', 'A::B')}
          {headerCell('mesh', 'MESH')}
          {headerCell('type', 'TYPE')}
          {headerCell('name', 'NAME')}
        </div>
        <div
          data-demon-rows-spacer=""
          style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
        >
          {virtualizer.getVirtualItems().map(item => {
            const index = win.start + item.index
            const d = source.at(index)
            const selected = d.mesh === selectedMesh
            const isActive = active === index
            return (
              <div
                key={item.key}
                role="row"
                id={`demon-${listId}-row-${index}`}
                data-demon-row={d.mesh}
                aria-rowindex={index + 2}
                aria-selected={selected}
                data-active={isActive ? 'true' : undefined}
                className={`px-2 text-[10px] leading-[1.4] cursor-pointer ${selected ? '' : 'hover:bg-white/[0.03]'}`}
                style={{
                  position: 'absolute',
                  top: item.start - ROW_HEIGHT_PX,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT_PX,
                  display: 'grid',
                  gridTemplateColumns: COLUMNS,
                  alignItems: 'center',
                  ...(selected
                    ? { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' }
                    : {}),
                  ...(isActive && gridFocused
                    ? { outline: '1px solid rgba(16,255,80,0.6)', outlineOffset: -1 }
                    : {}),
                }}
                onMouseEnter={() => onHoverDemon(d)}
                onMouseLeave={() => onHoverDemon(null)}
                onClick={() => {
                  setActive(index)
                  onSelectDemon(d)
                }}
              >
                <div role="gridcell" data-col="ab">
                  {netSpanLabel(d.a, d.b, zoneLabel)}
                </div>
                <div role="gridcell" data-col="mesh">
                  {String(d.mesh)}
                </div>
                <div role="gridcell" data-col="type" style={{ color: kindColor(d.subtype) }}>
                  {SUBTYPE_LABEL[d.subtype]}
                </div>
                <div role="gridcell" data-col="name">
                  {demonName(base, d.mesh) ?? ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {pages > 1 && (
        <div data-demon-pager="" className="flex items-center gap-2 pt-2 text-[10px] text-gray-400">
          <span>
            {`Rows ${(win.start + 1).toLocaleString('en-US')}${EN_DASH}${(win.start + win.size).toLocaleString('en-US')} of ${source.count.toLocaleString('en-US')}`}
          </span>
          <CyberButton size="sm" disabled={page === 0} onClick={() => goToPage(page - 1)}>
            prev
          </CyberButton>
          <CyberButton size="sm" disabled={page >= pages - 1} onClick={() => goToPage(page + 1)}>
            next
          </CyberButton>
        </div>
      )}
    </div>
  )
}

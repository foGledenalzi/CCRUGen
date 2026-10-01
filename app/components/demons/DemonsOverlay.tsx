// Demons overlay (D-01): Browser / Focus / Matrix tabs with a shared detail pane. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useEffect, useRef } from 'react'
import type { DemonRef } from '../../../engine/index'
import type { HoverInfo } from '../../data/types'
import { useNumogramView } from '../numogram/ViewContext'
import { CyberButton } from '../ui/CyberButton'
import { CyberButtonGroup } from '../ui/CyberButtonGroup'
import { Metric } from '../numogram/BigBaseSummary'
import { DemonInfo } from '../info/InfoDisplay'
import { DemonBrowser } from './DemonBrowser'
import { DemonFocusView } from './DemonFocusView'
import { DemonMatrix } from './DemonMatrix'
import { legacyDemon, type DemonFilter } from '../../lib/demonBrowser'
import { DEMON_TABS, DEMON_TAB_LABEL, demonFocusOf, type DemonFocus, type DemonTab } from '../../lib/demonState'

export interface DemonsOverlayProps {
  readonly isMobile: boolean
  readonly tab: DemonTab
  readonly onTabChange: (tab: DemonTab) => void
  readonly filter: DemonFilter | null
  readonly onFilterChange: (next: DemonFilter | null) => void
  readonly focus: DemonFocus | null
  readonly onFocusChange: (next: DemonFocus | null) => void
  readonly showDiagram: boolean
  readonly hoverInfo: HoverInfo | null
  readonly pinnedInfo: HoverInfo | null
  readonly onHoverInfo: (info: HoverInfo | null) => void
  readonly onPinInfo: (info: HoverInfo) => void
  readonly onClose: () => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function DemonsOverlay({
  isMobile,
  tab,
  onTabChange,
  filter,
  onFilterChange,
  focus,
  onFocusChange,
  showDiagram,
  hoverInfo,
  pinnedInfo,
  onHoverInfo,
  onPinInfo,
  onClose,
}: DemonsOverlayProps): JSX.Element {
  // Never `view`: the overlay must work at every base, including base 666 where no diagram exists at all.
  const { g, base, summary } = useNumogramView()
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  // Boundary adapters (DemonRef -> legacy Demon, PATTERNS "DemonRef -> Demon adapter"): every entry point into the
  // shared hover/pin state crosses here, never passing a raw DemonRef into onHoverInfo/onPinInfo.
  const hoverDemon = (d: DemonRef | null): void =>
    onHoverInfo(d ? { type: 'demon', demon: legacyDemon(d, base) } : null)
  const selectDemon = (d: DemonRef): void => {
    onPinInfo({ type: 'demon', demon: legacyDemon(d, base) })
    onFocusChange(demonFocusOf(d))
  }
  const pickDemon = (d: DemonRef): void => {
    onPinInfo({ type: 'demon', demon: legacyDemon(d, base) })
  }

  const selectedMesh = pinnedInfo?.type === 'demon' ? g.demons.meshOf(pinnedInfo.demon.a, pinnedInfo.demon.b) : null
  const shown = hoverInfo?.type === 'demon' ? hoverInfo : pinnedInfo?.type === 'demon' ? pinnedInfo : null

  // Focus management (T-05-30): on mount, remember the opener and move focus into the active tab; on unmount, clear
  // any stale hover (a row hovered at close would otherwise keep highlighting zones) and restore the opener's focus.
  useEffect(() => {
    returnFocusRef.current = document.activeElement
    const activeTab = document.getElementById(`demons-tab-${tab}`)
    activeTab?.focus()
    return () => {
      onHoverInfo(null)
      const el = returnFocusRef.current
      if (el instanceof HTMLElement && el.isConnected) el.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) return
      const first = focusables[0] as HTMLElement
      const last = focusables[focusables.length - 1] as HTMLElement
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }

    const target = e.target as HTMLElement
    const isTypingTarget = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
    if (!isTypingTarget) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1 && e.key !== ' ') {
        e.preventDefault()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
      }
    }
  }

  function onTablistKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const index = DEMON_TABS.indexOf(tab)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const next = DEMON_TABS[(index + delta + DEMON_TABS.length) % DEMON_TABS.length] as DemonTab
    onTabChange(next)
    document.getElementById(`demons-tab-${next}`)?.focus()
  }

  return (
    <div data-post-baseline="" data-demons-overlay="" className="fixed inset-0 z-[80] flex items-center justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close demons"
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.62)' }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Demons"
        onKeyDown={onDialogKeyDown}
        className="relative flex flex-col p-4 min-[1400px]:p-8 font-mono"
        style={{
          width: isMobile ? '100vw' : 'min(94vw, 1100px)',
          height: isMobile ? '100vh' : 'min(88vh, 860px)',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(8,8,15,0.97)',
        }}
      >
        <div className="flex items-center gap-6 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-[10px] tracking-[0.22em] uppercase" style={{ color: '#10ff50' }}>Demons</span>
          <div data-demons-total={summary.demonCount}>
            <Metric label="Total" value={summary.demonCount.toLocaleString('en-US')} />
          </div>
          <button
            type="button"
            className="ml-auto text-[8px] uppercase tracking-[0.14em] px-2 py-1"
            style={{ color: '#6b7280', border: '1px solid rgba(107,114,128,0.35)' }}
            onClick={onClose}
          >
            close
          </button>
        </div>

        <div role="tablist" aria-label="Demon views" className="mt-6" onKeyDown={onTablistKeyDown}>
          <CyberButtonGroup>
            {DEMON_TABS.map(t => (
              <CyberButton
                key={t}
                size="sm"
                active={tab === t}
                role="tab"
                selected={tab === t}
                id={`demons-tab-${t}`}
                controls={`demons-panel-${t}`}
                onClick={() => onTabChange(t)}
              >
                {DEMON_TAB_LABEL[t]}
              </CyberButton>
            ))}
          </CyberButtonGroup>
        </div>

        <div className={`mt-2 flex min-h-0 flex-1 gap-4 ${isMobile ? 'flex-col' : 'flex-row'}`}>
          <div
            role="tabpanel"
            id={`demons-panel-${tab}`}
            aria-labelledby={`demons-tab-${tab}`}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            {tab === 'browser' && (
              <DemonBrowser
                filter={filter}
                onFilterChange={onFilterChange}
                selectedMesh={selectedMesh}
                onHoverDemon={hoverDemon}
                onSelectDemon={selectDemon}
              />
            )}
            {tab === 'focus' && (
              <DemonFocusView
                focus={focus}
                onFocusChange={onFocusChange}
                selectedMesh={selectedMesh}
                showDiagram={showDiagram}
                onHoverDemon={hoverDemon}
                onPickDemon={pickDemon}
              />
            )}
            {tab === 'matrix' && <DemonMatrix selectedMesh={selectedMesh} onSelectDemon={selectDemon} />}
          </div>

          <aside
            data-demon-detail=""
            aria-label="Demon detail"
            className={isMobile ? 'max-h-[30vh] overflow-y-auto pt-2' : 'w-[280px] shrink-0 overflow-y-auto pl-4'}
            style={isMobile ? { borderTop: '1px solid rgba(255,255,255,0.08)' } : { borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="mb-2 text-[8px] uppercase tracking-[0.3em] text-gray-400">Detail</div>
            {shown ? (
              <DemonInfo data={shown as HoverInfo & { type: 'demon' }} />
            ) : (
              <p className="text-[10px] text-gray-500">Hover or click a demon to inspect it.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

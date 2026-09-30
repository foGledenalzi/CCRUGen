// Zoom in / zoom out / fit toolbar (UI-06): keyboard-focusable buttons for the diagram's zoom state, mirroring the
// mouse-wheel and alt-drag interactions that already exist. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React from 'react'
import { DemonsIcon, FitIcon, ZoomInIcon, ZoomOutIcon } from './NumogramIcons'

const BTN_CLR = '#6b7280'
const ACTIVE_CLR = '#10ff50'

function ViewButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void
  label: string
  pressed?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="flex items-center justify-center px-1.5 py-1"
      style={{
        color: pressed === true ? ACTIVE_CLR : BTN_CLR,
        border: `1px solid ${pressed === true ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
        background: pressed === true ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
        minWidth: 24,
        minHeight: 24,
      }}
    >
      {children}
    </button>
  )
}

export function ViewControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  demonFocusMode,
  onToggleDemonFocus,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  // Demon focus toggle (DEM-03, D-03): optional so every existing caller/test keeps rendering unchanged.
  demonFocusMode?: boolean
  onToggleDemonFocus?: () => void
}) {
  return (
    <div
      data-post-baseline=""
      role="toolbar"
      aria-label="Diagram view"
      className="fixed bottom-12 right-3 z-[74] flex items-center gap-1 font-mono"
    >
      <ViewButton onClick={onZoomOut} label="Zoom out">
        <ZoomOutIcon clr={BTN_CLR} />
      </ViewButton>
      <ViewButton onClick={onZoomIn} label="Zoom in">
        <ZoomInIcon clr={BTN_CLR} />
      </ViewButton>
      <ViewButton onClick={onFit} label="Fit diagram to view">
        <FitIcon clr={BTN_CLR} />
      </ViewButton>
      {onToggleDemonFocus && (
        <ViewButton onClick={onToggleDemonFocus} label="Demon focus" pressed={demonFocusMode === true}>
          <DemonsIcon clr={demonFocusMode ? ACTIVE_CLR : BTN_CLR} />
        </ViewButton>
      )}
      <span aria-live="polite" className="text-[8px] text-gray-500">{Math.round(zoom * 100)}%</span>
    </div>
  )
}

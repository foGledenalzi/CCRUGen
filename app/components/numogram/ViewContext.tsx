'use client'

// The base-generic view the rest of the tree reads from (MIG-02, UI-03). Original CCRUG code (MIT, NOTICE section 1).
import { createContext, useContext } from 'react'
import type { Numogram, RenderTier } from '../../../engine/index'
import type { LabelScheme } from '../../lib/labelScheme'
import type { NumogramSummary, NumogramView } from '../../lib/numogramView'

export interface NumogramViewContextValue {
  readonly base: number
  readonly g: Numogram
  readonly summary: NumogramSummary
  // null at the headless tier (above the interactive ceiling): panels then show an availability note instead of
  // reading a view model too large to build.
  readonly view: NumogramView | null
  readonly zoneLabels: readonly string[] | null
  readonly labelScheme: LabelScheme
  zoneLabel(zone: number): string
  readonly svgRichMaxN: number
  readonly allChordsMaxN: number
  readonly gateMode: 'on' | 'thin' | 'off'
  // The tier actually drawn for the displayed base (Phase 6 REN-02): 'svg' (Projection), 'canvas' (CanvasDiagram) or
  // 'headless' (summary and text only). Panels branch on it; `view` is non-null at svg and canvas, null at headless.
  readonly tier: RenderTier
  // The shipped interactive ceiling (D-01), read from the tier table; never a literal.
  readonly interactiveMaxN: number
}

export const NumogramViewContext = createContext<NumogramViewContextValue | null>(null)

/** The current NumogramViewContextValue. Throws outside a NumogramViewContext.Provider. */
export function useNumogramView(): NumogramViewContextValue {
  const value = useContext(NumogramViewContext)
  if (value === null) throw new Error('useNumogramView outside NumogramViewContext.Provider')
  return value
}

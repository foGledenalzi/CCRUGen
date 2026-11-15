'use client'

// The naming the Names panel and the name displays read (Phase 7, plan 13; 07-RESEARCH Pattern 8 "Name consumers"). A separate
// context with a null default, not a field of NumogramViewContextValue: provider-less renders (the seven view-context render tests
// and the headless path) stay valid, and useNaming returns null outside a provider instead of raising like useNumogramView does.
// NumogramClient provides the value (plan 07-18). Original CCRUG code (MIT, NOTICE section 1).
import { createContext, useContext } from 'react'
import type { NameResolver, Naming, NamingPreset } from '../../../engine/index'
import type { NamesPanelState, NamingAction } from '../../lib/namingSession'

export interface NamingContextValue {
  readonly base: number
  /** The working naming (while previewing, the previewed one). */
  readonly naming: Naming
  /** Its history key; changes with every committed change and every restore. */
  readonly rev: number
  readonly resolver: NameResolver
  readonly preset: NamingPreset | null
  readonly state: NamesPanelState
  /** The base a worker switch is moving to while the state is pending, else null. */
  readonly pendingBase: number | null
  /** The quiet save line: none before the first edit, saved or failed after it, preview and seed-only in those states. */
  readonly saved: 'none' | 'saved' | 'failed' | 'preview' | 'seed-only'
  /** True when the naming holds edits a link cannot carry (the "edits not in links" note). */
  readonly uncarried: boolean
  readonly interactiveMaxN: number
  /** The text the persistent sr-only carrier of the panel currently says. */
  readonly announcement: string
  /** Bumped by an undo or redo that restored a naming; `zone` is the single changed zone to scroll into view, else null. */
  readonly restored: { readonly tick: number; readonly zone: number | null }
  /** Applies a naming action; false when it was refused (previewing, invalid, nothing to change). */
  apply(action: NamingAction): boolean
  keep(): void
  revert(): void
  /**
   * The inline `Undo this change`: undoes the newest history entry only when it is a naming change and returns true; returns false
   * (touching nothing) when the newest entry is anything else, or there is none (review WR-05).
   */
  undo(): boolean
  announce(text: string): void
}

export const NamingContext = createContext<NamingContextValue | null>(null)

/** The current NamingContextValue, or null outside a NamingContext.Provider. */
export function useNaming(): NamingContextValue | null {
  return useContext(NamingContext)
}

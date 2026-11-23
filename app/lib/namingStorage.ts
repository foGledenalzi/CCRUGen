// The per-base browser slot for naming work (Phase 7, plan 13; D-09, D-11, 07-RESEARCH Pattern 8 and Pitfall 17). The slot holds the
// export text, so one serializer writes it and the one validator reads it back, exactly as it reads an imported file. A slot is
// untrusted input (another tab, an older build or a manual edit can leave anything in it) and the storage itself can fail on access
// (a blocked or a full store), so every access is guarded: any failure reads as "no slot" or "failed" and the page never crashes on
// its storage. The storage is injected (StorageLike), so tests need no browser. Original CCRUG code (MIT, NOTICE section 1).
import { serializeNaming, validateNamingJson, type Naming } from '../../engine/index'
import { NAMING_STORAGE_PREFIX } from './namingLimits'
import type { NamingEnv } from './namingSession'

/** The part of the Web Storage interface the slot needs. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The browser's local storage, or null on the server and wherever it is blocked (reading the property itself can fail). */
export function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/** The storage key of the slot of `base`. */
export function slotKey(base: number): string {
  return `${NAMING_STORAGE_PREFIX}${base}`
}

/**
 * The naming saved for `base`, or null: no storage, a failing read, no slot, a slot that is not a valid names file of this base
 * (garbage, a foreign or newer format, another base, over the size cap), and every base above the interactive ceiling, which never
 * has a slot (D-11). Never fails.
 */
export function readSlot(storage: StorageLike | null, base: number, env: NamingEnv): Naming | null {
  if (storage === null || base > env.interactiveMaxN) return null
  let text: string | null
  try {
    text = storage.getItem(slotKey(base))
  } catch {
    return null
  }
  if (text === null) return null
  const read = validateNamingJson(text, { base, interactiveMaxN: env.interactiveMaxN, preset: env.preset })
  return read.ok ? read.naming : null
}

/**
 * Writes the compact export text of `naming` to its base's slot. 'failed' when there is no storage, the write fails (a full or blocked
 * store) or the naming is seed-only (no table: nothing is saved above the ceiling, D-11, which the session's autosave test already
 * guarantees; this is the second guard). Never fails.
 */
export function writeSlot(storage: StorageLike | null, naming: Naming): 'saved' | 'failed' {
  if (storage === null || naming.sounds === null) return 'failed'
  try {
    storage.setItem(slotKey(naming.base), serializeNaming(naming))
    return 'saved'
  } catch {
    return 'failed'
  }
}

/**
 * Writes the naming whose debounced write is still pending, at once (a base switch and the page being hidden do this so an edit made
 * just before them is not lost). 'none' when nothing was pending, else what writeSlot said: the caller must not drop a 'failed' (a full
 * or blocked store), because it is the one place a lost edit could go unnoticed (review IN-04). Never fails.
 */
export function flushSlot(pending: Naming | null, storage: StorageLike | null): 'none' | 'saved' | 'failed' {
  return pending === null ? 'none' : writeSlot(storage, pending)
}

/**
 * Whether a change of the page's visibility state asks for the pending write at once: when the page is hidden (review IN-21). A mobile
 * browser often backgrounds a page and later kills it without ever sending pagehide, so an edit made inside the debounce would be lost.
 */
export function flushOnVisibility(state: string): boolean {
  return state === 'hidden'
}

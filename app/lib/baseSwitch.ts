// Base-switch sanitation rules (UI-08, research Pattern 4): nothing base-shaped survives a base change. Pure —
// NumogramClient.tsx's commitBase applies sessionAfterBaseSwitch's result in one batched state update alongside its
// own non-session resets (history stacks, pending share fit, orientation cache, zoom/pan, jumpToTarget).
// Original CCRUG code (MIT, NOTICE section 1).
import { defaultLayoutFor, isLayoutIdFor, type ViewLayoutId } from './layoutIds'
import type { RegionId } from './regions'

/**
 * The layout to keep after switching to `base` (UI-08): the current layout only if it is still offered at the new
 * base (`isLayoutIdFor`), else that base's own default (`defaultLayoutFor`). Never a tween across bases (T-04-26) —
 * this is a same-render substitution, not an animated transition.
 */
export function nextLayoutForBase(layout: ViewLayoutId, base: number): ViewLayoutId {
  return isLayoutIdFor(layout, base) ? layout : defaultLayoutFor(base)
}

/** Everything base-shaped that UI-08 requires to be reset (or re-derived) on every committed base change. */
export interface SessionResetState {
  readonly layout: ViewLayoutId
  readonly selected: readonly number[]
  readonly hlRegion: RegionId | null
  readonly tcActive: boolean
  readonly orbiting: boolean
  readonly pinned: boolean
  readonly isolate: readonly RegionId[]
  readonly mute: readonly RegionId[]
}

/**
 * The session state after switching to `base` (UI-08): selection, region highlight, Time Circuit, orbiting and the
 * region legend's isolate/mute filter all clear unconditionally (a selected zone, a `torque:`/`plex:` region id or
 * an orbiting Torque loop from the old base may not even exist at the new one), and the layout is kept only if
 * `nextLayoutForBase` says it still applies.
 */
export function sessionAfterBaseSwitch(prev: SessionResetState, base: number): SessionResetState {
  return {
    layout: nextLayoutForBase(prev.layout, base),
    selected: [],
    hlRegion: null,
    tcActive: false,
    orbiting: false,
    pinned: false,
    isolate: [],
    mute: [],
  }
}

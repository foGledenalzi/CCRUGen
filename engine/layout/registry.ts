// The layout registry (D-05, LAY-02): resolves the layout for a base from three tiers, in order — an exact preset
// match, then the procedural layout of the requested id, then the base default (the first supporting preset, else
// 'ring'). No caching here: layouts are cheap to build; only the numogram itself is cached (engine/core/numogram.ts).
//
// Trust boundary (T-03-19): `id` may eventually come from a URL. It is only ever compared against known preset ids
// and LAYOUT_IDS values, never evaluated or used to construct a property path, so an unrecognised string can only
// ever fall through to the base default.

import type { Numogram } from '../core/types'
import { ladderLayout } from './ladder'
import { ringLayout } from './ring'
import { spiralLayout } from './spiral'
import { LAYOUT_IDS } from './types'
import type { Layout, LayoutId, LayoutParams, LayoutSpec } from './types'

/** The three procedural layouts as `LayoutSpec`s, every one supporting every base: the fallback of last resort. */
export const PROCEDURAL_LAYOUT_SPECS: readonly LayoutSpec[] = [
  { id: 'ring', label: 'Rings', supports: () => true, build: g => ringLayout(g) },
  { id: 'ladder', label: 'Ladder', supports: () => true, build: g => ladderLayout(g) },
  { id: 'spiral', label: 'Barker spiral', supports: () => true, build: g => spiralLayout(g) },
]

function isLayoutId(id: string): id is LayoutId {
  return (LAYOUT_IDS as readonly string[]).includes(id)
}

function buildProcedural(id: LayoutId, g: Numogram, params: Partial<LayoutParams>): Layout {
  if (id === 'ring') return ringLayout(g, params)
  if (id === 'ladder') return ladderLayout(g, undefined, params)
  return spiralLayout(g, undefined, params)
}

/**
 * Resolves the layout for `g`: (1) if `id` is given and one of `presets` has that id AND supports `g`, that preset's
 * `build(g)`; (2) else if `id` is one of `LAYOUT_IDS`, the matching procedural builder with `params`; (3) otherwise
 * (no id, an unknown id, or a preset id that does not support `g`) the first of `presets` whose `supports(g)` is
 * true, else the procedural `ring` layout with `params`. `resolveLayout(g).id` tells the caller which layout won.
 */
export function resolveLayout(
  g: Numogram,
  id?: string,
  presets: readonly LayoutSpec[] = [],
  params: Partial<LayoutParams> = {},
): Layout {
  if (id !== undefined) {
    const preset = presets.find(p => p.id === id)
    if (preset !== undefined && preset.supports(g)) return preset.build(g)
    if (isLayoutId(id)) return buildProcedural(id, g, params)
  }
  const fallback = presets.find(p => p.supports(g))
  if (fallback !== undefined) return fallback.build(g)
  return ringLayout(g, params)
}

/** The layout ids offered for `g`: every supporting preset's id (in `presets` order), then every `LAYOUT_IDS` id not already listed. */
export function layoutIdsFor(g: Numogram, presets: readonly LayoutSpec[] = []): string[] {
  const ids: string[] = []
  for (const preset of presets) {
    if (preset.supports(g)) ids.push(preset.id)
  }
  for (const id of LAYOUT_IDS) {
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

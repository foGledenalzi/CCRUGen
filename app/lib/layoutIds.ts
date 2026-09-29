// View layout ids per base (LAY-02 presets at base 10, procedural layouts and the pair graph everywhere). Ids are
// compared, never evaluated (T-03-19).

/** The four upstream-authored base-10 presets (LAY-02), in the order they are offered. */
export const BASE10_PRESET_LAYOUT_IDS = ['original', 'labyrinth', 'ladder', 'planetary'] as const

/** Every view layout id this app offers, at any base: the base-10 presets, the procedural layouts, then pairGraph. */
export const VIEW_LAYOUT_IDS = ['original', 'labyrinth', 'ladder', 'planetary', 'ring', 'spiral', 'pairGraph'] as const

export type ViewLayoutId = (typeof VIEW_LAYOUT_IDS)[number]

// The engine's procedural zone layouts (engine/layout/types.ts LAYOUT_IDS), every one supporting every base.
const PROCEDURAL_VIEW_IDS = ['ring', 'ladder', 'spiral'] as const

/**
 * The layout ids offered at `base`: the base-10 presets (only at base 10), then every procedural id not already
 * listed (so 'ladder' is not duplicated at base 10, where the preset wins), then 'pairGraph' last.
 */
export function layoutIdsForBase(base: number): ViewLayoutId[] {
  const ids: ViewLayoutId[] = []
  if (base === 10) {
    for (const id of BASE10_PRESET_LAYOUT_IDS) ids.push(id)
  }
  for (const id of PROCEDURAL_VIEW_IDS) {
    if (!ids.includes(id)) ids.push(id)
  }
  ids.push('pairGraph')
  return ids
}

/** The default layout at `base`: the authored 'original' preset at base 10, else the procedural 'ring'. */
export function defaultLayoutFor(base: number): ViewLayoutId {
  return base === 10 ? 'original' : 'ring'
}

/** Whether `id` is one of the layout ids offered at `base` (never evaluated, only ever compared, T-03-19). */
export function isLayoutIdFor(id: string, base: number): id is ViewLayoutId {
  return (layoutIdsForBase(base) as readonly string[]).includes(id)
}

/** Whether `id` names a base-10 preset (as opposed to a procedural layout or the pair graph) at `base`. */
export function isPresetLayoutId(id: string, base: number): boolean {
  return base === 10 && (BASE10_PRESET_LAYOUT_IDS as readonly string[]).includes(id)
}

export const LAYOUT_LABELS: Record<ViewLayoutId, string> = {
  original: 'original',
  labyrinth: 'labyrinth',
  ladder: 'ladder',
  planetary: 'planetary',
  ring: 'rings',
  spiral: 'spiral',
  pairGraph: 'pair graph',
}

const SHORTCUT_KEYS = ['a', 's', 'd', 'f'] as const

/** The A/S/D/F shortcut for `id` at `base` (the first four ids offered there), or null past the fourth. */
export function layoutShortcut(id: string, base: number): string | null {
  const ids = layoutIdsForBase(base) as readonly string[]
  const index = ids.indexOf(id)
  if (index < 0 || index >= SHORTCUT_KEYS.length) return null
  return SHORTCUT_KEYS[index] ?? null
}

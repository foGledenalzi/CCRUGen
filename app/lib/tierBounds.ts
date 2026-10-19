// The app's only reader of the measured tier table (REN-01 data, D-14..D-18 of Phase 4). Property access on
// boundaries and tierOverrideParam only, never the whole JSON, so the measurement rows stay out of the viewer bundle
// (checked in 04-16).
import tierTableJson from '../../engine/scene/tier-table.json'
import {
  gateLayerMode,
  interactiveCeiling,
  labelsVisible,
  parseTierOverride,
  selectTier,
  tweenAllowed,
  type RenderTier,
  type TierTable,
} from '../../engine/index'

export const TIER_VIEW: Pick<TierTable, 'boundaries' | 'tierOverrideParam'> = {
  boundaries: tierTableJson.boundaries as unknown as TierTable['boundaries'],
  tierOverrideParam: tierTableJson.tierOverrideParam as unknown as TierTable['tierOverrideParam'],
}

export const SVG_RICH_MAX_N: number = TIER_VIEW.boundaries.svgRichMaxN.n
export const ALL_CHORDS_MAX_N: number = TIER_VIEW.boundaries.allChordsMaxN.n
/** The shipped interactive ceiling (D-01): canvas up to here, headless above. Read from the table, never a literal. */
export const INTERACTIVE_MAX_N: number = interactiveCeiling(TIER_VIEW)
/** On-screen node radius (CSS px) from which zone labels are painted (level of detail, Phase 3 D-07). */
export const LABEL_MIN_RADIUS_PX: number = TIER_VIEW.boundaries.labelVisibleMinRadiusPx
/** The largest canvas backing-store area (device px) the spike found allocatable. */
export const CANVAS_AREA_LIMIT_PX: number = TIER_VIEW.boundaries.canvasAreaLimitPx

/**
 * The render tier for `n` zones: an explicit override wins, else svg -> canvas -> headless. The one exception is an 'svg'
 * override above the interactive ceiling (Phase 6 review WR-01): the SVG tier builds the numogram, the view and the whole
 * diagram on the main thread, so `?tier=svg` (or a persisted override) must never lift the ceiling. Above it the natural
 * tier (headless) wins; `tier=svg` stays a diagnostic between svgRichMaxN and the ceiling, and `tier=canvas|headless`
 * keep working everywhere because both are worker-routed and cheap on the main thread. Every app caller goes through
 * here (never `selectTier` directly), so link hydration, the base picker and `needsWorkerFor` all get the clamp.
 */
export function tierFor(n: number, override?: RenderTier | null): RenderTier {
  const effective = override === 'svg' && n > INTERACTIVE_MAX_N ? undefined : (override ?? undefined)
  return selectTier(n, TIER_VIEW, effective)
}

/** A `tier=` URL value as a RenderTier, or null when the diagnostic override is off or the value is not allowed. */
export function tierOverrideFrom(raw: string | null | undefined): RenderTier | null {
  return parseTierOverride(raw, TIER_VIEW)
}

/** Whether a layout switch of `n` zones may animate rather than cut instantly. */
export function mayTween(n: number): boolean {
  return tweenAllowed(n, TIER_VIEW)
}

/** Whether a zone label may be drawn, given its on-screen node radius in pixels. */
export function labelsShown(onScreenRadiusPx: number): boolean {
  return labelsVisible(onScreenRadiusPx, TIER_VIEW)
}

/** How densely the gate layer draws at `n` zones: full, thinned, or off. */
export function gateMode(n: number): 'on' | 'thin' | 'off' {
  return gateLayerMode(n, TIER_VIEW)
}

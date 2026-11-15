'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// Data
import type { Layout, Layer, Pos, HoverInfo, LabelVisibility } from './data/types'

// Engine (base-generic layout plumbing, 04-11)
import { createNameResolver, createNumogram, meshOf, routePairGraph } from '../engine/index'
import type { Naming, Numogram, Packer, PairGraphLayout, RenderTier } from '../engine/index'

// Lib
import { getAnglesForDate, computePlanetaryPositions } from './lib/planetary'
import { buildNumogramTitle } from './lib/shareTitle'
import { withBasePath } from './lib/basePath'
import { buildNumogramView, summarize } from './lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, labelSchemeKey, zoneLabelsFor } from './lib/labelScheme'
import type { LabelScheme } from './lib/labelScheme'
import { ALL_CHORDS_MAX_N, INTERACTIVE_MAX_N, SVG_RICH_MAX_N, gateMode, labelsShown, mayTween, tierFor } from './lib/tierBounds'
import { DIAGRAM_CSS_WIDTH, layoutTarget } from './lib/viewLayouts'
import { engineRenderData, frameLayout } from './lib/renderData'
import { isLayoutIdFor, isPresetLayoutId, LAYOUT_LABELS, layoutIdsForBase, layoutShortcut } from './lib/layoutIds'
import type { ViewLayoutId } from './lib/layoutIds'
import { EMPTY_REGION_FILTER, isRegionId, regionFilterActive, sanitizeRegionFilter, toggleIsolate, toggleMute, zonesOfRegion, zoneStates as computeZoneStates } from './lib/regions'
import type { RegionFilter, RegionId } from './lib/regions'
import { buildShareParams, DEFAULT_LAYERS, parseShareParams } from './lib/shareParams'
import type { ShareState } from './lib/shareParams'
import { refusalFromUrl } from './lib/basePicker'
import { numogramText } from './lib/numogramText'
import { computeFailedMessage, noWorkerMessage, resultKey } from './lib/worker/protocol'
import type { WorkerBuilt, WorkerResponse } from './lib/worker/protocol'
import { useNumogramWorker } from './lib/worker/useNumogramWorker'
import { PENDING_GRACE_MS } from './lib/canvas/diagramModel'
import { sessionAfterBaseSwitch } from './lib/baseSwitch'
import {
  computeDesktopStack, DESKTOP_PANEL_LEFT_X, DESKTOP_PANEL_RIGHT_X, INFO_PANEL_WIDTH, INITIAL_INFO_X, NAMES_PANEL_WIDTH, namesBodyMax, PANEL_WIDTH,
} from './lib/panelStack'
import {
  applyNamingAction, autosaveWanted, hasUncarriedEdits, keepPreview, linkFormOf, namesPanelState, restoreNaming, revertPreview,
  sessionForBase, snapshotNaming,
  type NamingAction, type NamingEnv, type NamingSession,
} from './lib/namingSession'
import { browserStorage, readSlot, writeSlot } from './lib/namingStorage'
import { NAMING_AUTOSAVE_DEBOUNCE_MS, NAMING_UNDO_HEAVY_DEPTH, NAMING_UNDO_OVERRIDE_LIMIT } from './lib/namingLimits'
import { NAMES_COPY } from './lib/namingCopy'
import { historySnapshotKey, singleChangedZone, withHydratedNaming } from './lib/historyHydration'
import { NAMES_PARAM } from './lib/namesLink'
import type { DemonFilter } from './lib/demonBrowser'
import { legacyDemon } from './lib/demonBrowser'
import {
  demonsAfterBaseSwitch, demonsAfterSwitchFromCounts, focusChordList, focusZones, initialDemonTab, zoneFocus, sameFocus,
  type DemonFocus, type DemonSessionState, type DemonTab,
} from './lib/demonState'

// Presets
import { BASE10 } from './presets/base10/numogram'
import { base10CurrentRender, base10GateRender } from './presets/base10/routes'
import { PLANETARY_DEFAULT_ANGLE, PLANETARY_SIZE } from './presets/base10/layouts'
import { CCRU_NAMING_PRESET } from './presets/base10/naming'

// Hooks
import { useOrbitalAnimation } from './hooks/useOrbitalAnimation'
import { useLayoutTween } from './hooks/useLayoutTween'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useParallax } from './hooks/useParallax'
import { usePanelDrag } from './hooks/usePanelDrag'
import { useCanvasZoom } from './hooks/useCanvasPan'
import { usePanelGroupLayout } from './hooks/usePanelGroupLayout'

// Components
import { CyberButton as Button } from './components/ui/CyberButton'
import { CyberButtonGroup as ButtonSet } from './components/ui/CyberButtonGroup'
import { CyberPanel as Panel } from './components/ui/CyberPanel'
import { Projection } from './components/projection/Projection'
import { PairGraphProjection } from './components/projection/PairGraphProjection'
import { CanvasDiagram, type CanvasDiagramHandle as CanvasHandle } from './components/canvas/CanvasDiagram'
import { BasePicker } from './components/numogram/BasePicker'
import { BigBaseSummary } from './components/numogram/BigBaseSummary'
import { TextView } from './components/numogram/TextView'
import { ViewControls } from './components/numogram/ViewControls'
import { InfoDisplay } from './components/info/InfoDisplay'
import { PinnedBackground } from './components/info/PinnedBackground'
import { LayersPanel } from './components/panels/LayersPanel'
import { LabelsPanel } from './components/panels/LabelsPanel'
import { RegionsPanel } from './components/panels/RegionsPanel'
import { ZonesPanel } from './components/panels/ZonesPanel'
import { SyzygiesPanel } from './components/panels/SyzygiesPanel'
import { CurrentsPanel } from './components/panels/CurrentsPanel'
import { GatesPanel } from './components/panels/GatesPanel'
import {
  OriginalIcon, LabyrinthIcon, LadderIcon, PlanetaryIcon, RingIcon, SpiralIcon, PairGraphIcon,
  OrbitIcon, TodayIcon, ResetIcon, OrbitsIcon,
  UndoIcon, RedoIcon, ShareIcon, DemonsIcon,
} from './components/numogram/NumogramIcons'
import { ShortcutsModal } from './components/numogram/ShortcutsModal'
import { DemonsOverlay } from './components/demons/DemonsOverlay'
import { CyberPageHeader } from './components/ui/CyberPageHeader'
import { NumogramViewContext } from './components/numogram/ViewContext'
import type { NumogramViewContextValue } from './components/numogram/ViewContext'
import { NamingContext, type NamingContextValue } from './components/names/NamingContext'
import { NamesHeaderTag, NamesPanel } from './components/names/NamesPanel'

/* ═══════════════════════════════════════════════════════════════
   THE NUMOGRAM — The Decimal Labyrinth (CCRU)
   ═══════════════════════════════════════════════════════════════ */

const MOBILE_SELECTOR_BREAKPOINT = 820
// `names` is first: the mobile stack lists the Names header at y 64 with no precondition (07-UI-SPEC "Mobile stack"); the desktop stack
// takes its slot under Selection from computeDesktopStack and reads the same height reports.
const PANEL_GROUP_ORDER = ['names', 'layers', 'labels', 'zones', 'regions', 'syz', 'currents', 'gates', 'text', 'info'] as const
type PanelId = (typeof PANEL_GROUP_ORDER)[number]
const PANEL_GROUP_DEFAULT_HEIGHTS: Record<PanelId, number> = {
  names: 34,
  layers: 34,
  labels: 34,
  zones: 34,
  regions: 34,
  syz: 34,
  currents: 34,
  gates: 34,
  text: 34,
  info: 34,
}
const MAX_HISTORY_ENTRIES = 80

// The naming session's environment (Phase 7): the interactive ceiling comes from the tier table and the CCRU preset from the base-10
// preset data, so no ceiling or preset base is typed here.
const NAMING_ENV: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }

// `naming` rides along so an undo can restore it; the history KEY never reads it (Pitfall 7: stringifying a naming of thousands of
// sounds on every render would be costly), only `namingRev` does.
type HistorySnapshot = {
  base: number
  layout: ViewLayoutId
  layers: Layer[]
  selZones: number[]
  hlRegion: RegionId | null
  tcActive: boolean
  particlesOn: boolean
  showOrbits: boolean
  planetDate: string
  orbiting: boolean
  labelVisibility: LabelVisibility
  labels: LabelScheme
  packer: Packer
  isolate: string[]
  mute: string[]
  naming: Naming
  namingRev: number
}


function toggleTerminalSelection(prev: Set<number>, terminals: Iterable<number>): Set<number> {
  const terminalList = Array.from(new Set(terminals))
  const next = new Set(prev)
  const hasAnySelected = terminalList.some(zone => next.has(zone))

  if (hasAnySelected) {
    terminalList.forEach(zone => next.delete(zone))
  } else {
    terminalList.forEach(zone => next.add(zone))
  }

  return next
}

// useLayoutTween always needs a target to interpolate (rules of hooks forbid skipping the call); above the SVG tier
// the diagram is never shown, so its output is simply unused. Built once at module scope (D-16): base 10's cheap
// authored 'original' preset, never the current (possibly huge) base.
const FALLBACK_TARGET = layoutTarget(BASE10, 'original', 'shelf', {})

// Whether a base and layout are computed by the worker (Phase 6 D-06): every base above svgRichMaxN (or any base under a
// tier=canvas|headless diagnostic override), except the authored base-10 presets, which always render synchronously as SVG
// (UI-SPEC decision 6). Base 10 and every SVG-tier base never become asynchronous.
function needsWorkerFor(base: number, layout: ViewLayoutId, override: RenderTier | null): boolean {
  return tierFor(base, override) !== 'svg' && !isPresetLayoutId(layout, base)
}

export default function NumogramPage() {
  // ── State ──────────────────────────────────────────────────
  const [layout, setLayout] = useState<ViewLayoutId>('original')
  const [packer, setPacker] = useState<Packer>('shelf')
  const [base, setBase] = useState(10)
  const [labelScheme, setLabelScheme] = useState<LabelScheme>(DEFAULT_LABEL_SCHEME)
  const [tierOverride, setTierOverride] = useState<RenderTier | null>(null)
  const [baseRefusal, setBaseRefusal] = useState<string | null>(null)
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(['syzygies', 'currents', 'gates']))
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [selZones, setSelZones] = useState<Set<number>>(new Set())
  const [hlRegion, setHlRegion] = useState<RegionId | null>(null)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>(EMPTY_REGION_FILTER)
  const [tcActive, setTcActive] = useState(false)
  const [hoveredLayout, setHoveredLayout] = useState<ViewLayoutId | null>(null)
  const [particlesOn, setParticlesOn] = useState(false)
  const [showOrbits, setShowOrbits] = useState(true)
  const [planetDate, setPlanetDate] = useState('')
  const [pinnedInfo, setPinnedInfo] = useState<HoverInfo | null>(null)
  const [selectionStart, setSelectionStart] = useState<Pos | null>(null)
  const [selectionNow, setSelectionNow] = useState<Pos | null>(null)
  const [layersOpen, setLayersOpen] = useState(true)
  const [labelsOpen, setLabelsOpen] = useState(true)
  const [regionsOpen, setRegionsOpen] = useState(true)
  const [zonesOpen, setZonesOpen] = useState(true)
  const [syzOpen, setSyzOpen] = useState(true)
  const [currentsOpen, setCurrentsOpen] = useState(true)
  const [gatesOpen, setGatesOpen] = useState(true)
  const [textOpen, setTextOpen] = useState(false)
  const [demonsOpen, setDemonsOpen] = useState(false)
  const [demonTab, setDemonTab] = useState<DemonTab>('browser')
  const [demonFilter, setDemonFilter] = useState<DemonFilter | null>(null)
  const [demonFocus, setDemonFocus] = useState<DemonFocus | null>(null)
  const [demonFocusMode, setDemonFocusMode] = useState(false)
  // Worker path (Phase 6): the last result applied by the swap, the base (and its layout) being computed, whether the
  // previous diagram is dimmed (only after the grace period) and the picker's announcement.
  const [shown, setShown] = useState<WorkerBuilt | null>(null)
  const [pendingBase, setPendingBase] = useState<number | null>(null)
  const [pendingLayout, setPendingLayout] = useState<ViewLayoutId | null>(null)
  const [pendingVisible, setPendingVisible] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  // The Canvas zoom (relative to fit) the toolbar's percentage shows; CanvasDiagram reports its committed zoom through onZoomChange.
  const [canvasZoom, setCanvasZoom] = useState(1)
  // The naming session of the displayed base (Phase 7, D-03): one per base, switched with the base in the same batched reset.
  // `revRef` is the monotonic revision counter the session rules take (a history entry's key never reuses a value); the session
  // starts as base 10's default and no storage is read during the server render (hydration and base switches read the slot).
  const revRef = useRef(0)
  const nextRev = useCallback(() => ++revRef.current, [])
  const [namingSession, setNamingSession] = useState<NamingSession>(() => sessionForBase(10, null, null, NAMING_ENV, () => ++revRef.current))
  // The latest session, updated synchronously by commitSession, so an action reads the session it is applied to and never a flag
  // set inside a state updater (React may run an updater lazily or twice).
  const sessionRef = useRef(namingSession)
  sessionRef.current = namingSession
  // Whether the Names panel is open (collapsed on first load at every width; a link preview opens it once, below). Not persisted.
  const [namesOpen, setNamesOpen] = useState(false)
  const [namesSaved, setNamesSaved] = useState<'none' | 'saved' | 'failed'>('none')
  const [namesAnnouncement, setNamesAnnouncement] = useState('')
  const [namesRestored, setNamesRestored] = useState<{ tick: number; zone: number | null }>({ tick: 0, zone: null })
  // Every naming state change goes through here: the ref moves first (synchronously), then the state follows.
  const commitSession = useCallback((next: NamingSession) => {
    sessionRef.current = next
    setNamingSession(next)
  }, [])
  // The naming whose debounced slot write is still waiting. A base switch and the page being hidden write it at once, so an edit made
  // less than the debounce before either is not lost (the slot is read back right after a switch, so the write must come first).
  const pendingSaveRef = useRef<Naming | null>(null)
  const flushPendingSave = useCallback(() => {
    const pending = pendingSaveRef.current
    if (pending === null) return
    pendingSaveRef.current = null
    writeSlot(browserStorage(), pending)
  }, [])

  const svgWrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const selectionAdditiveRef = useRef(false)
  const suppressNextCanvasClickRef = useRef(false)
  const infoPanelInitRef = useRef(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  // Where the Selection column sits (right of the diagram): measured once, null until then (the stack falls back to INITIAL_INFO_X).
  const [selectionX, setSelectionX] = useState<number | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [urlSyncReady, setUrlSyncReady] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([])
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([])
  const [desktopPanelHeights, setDesktopPanelHeights] = useState<Partial<Record<PanelId, number>>>({})
  const [labelVisibility, setLabelVisibility] = useState<LabelVisibility>({
    numbers: true,
    xenotation: false,
    planets: true,
  })

  // ── Engine-derived state (UI-02, D-14..D-18): follows the chosen base ─────
  const tier = tierFor(base, tierOverride)
  const shownForBase = shown !== null && shown.base === base ? shown : null
  // The tier actually drawn: base-10 presets always SVG (UI-SPEC decision 6); a worker tier draws only once its result for
  // this base has landed, until then the previous SVG stays as "the last result" (D-07, P7). A scene-less result above the
  // ceiling (for example tier=canvas at 2^26) is headless: the main thread must never build g or the view for it.
  const renderTier: RenderTier =
    tier === 'svg' || isPresetLayoutId(layout, base) || shownForBase === null ? 'svg'
    : tier === 'headless' ? 'headless'
    : shownForBase.scene !== null ? 'canvas'
    : base > INTERACTIVE_MAX_N ? 'headless' : 'svg'
  const hasDiagram = renderTier !== 'headless'
  // Main-thread numogram: svg and canvas only (cheap up to the ceiling, 0.26 ms at 4000: D-06 deviation recorded in the
  // 06-11 summary, the worker builds the layout, routes and scene). Headless never builds it here (P6).
  const g = useMemo(() => (renderTier === 'headless' ? null : createNumogram(base)), [base, renderTier])
  const summary = useMemo(
    () => (renderTier === 'svg' || shownForBase === null ? summarize(g as Numogram) : shownForBase.summary),
    [renderTier, shownForBase, g],
  )
  // Above the Canvas ceiling no view/layout/render structure is ever built (D-16, T-04-08): only the summary and the text
  // view the worker built.
  const view = useMemo(() => (g !== null ? buildNumogramView(g) : null), [g])
  const zoneLabels = useMemo(() => (view ? zoneLabelsFor(base, labelScheme) : null), [view, base, labelScheme])

  // ── Hooks ──────────────────────────────────────────────────
  const reducedMotion = useReducedMotion()
  const { planetaryAngles, setPlanetaryAngles, orbiting, setOrbiting, onDateUpdateRef } = useOrbitalAnimation(layout, PLANETARY_DEFAULT_ANGLE, reducedMotion)
  const planetaryPos = useMemo(() => computePlanetaryPositions(planetaryAngles), [planetaryAngles])
  const target = useMemo(
    () => (renderTier === 'svg' && view && g ? layoutTarget(g, layout, packer, planetaryPos) : null),
    [renderTier, view, g, layout, packer, planetaryPos],
  )
  // useLayoutTween must be called every render (rules of hooks); above the SVG tier target is null and the hook
  // runs on the cheap module-level FALLBACK_TARGET instead, its output unused.
  const { pos, ctr, svgWidth, svgHeight, tweening, switchLayout, jumpToTarget } = useLayoutTween(target ?? FALLBACK_TARGET, mayTween(base) && !reducedMotion)
  const parallax = useParallax()
  // The desktop panel stack follows every measured panel height (todo 008); null on mobile and until the panels have measured.
  const derivedStack = useMemo(
    () => (viewport.w > MOBILE_SELECTOR_BREAKPOINT
      ? computeDesktopStack(desktopPanelHeights, { selectionX: selectionX ?? INITIAL_INFO_X, vw: viewport.w })
      : null),
    [viewport.w, desktopPanelHeights, selectionX],
  )
  const {
    positions: panelPositions,
    zIndexes: panelZ,
    activatePanel,
    startDrag,
    canvasPan,
    setCanvasPan,
    startCanvasDrag,
  } = usePanelDrag(derivedStack)
  const { positions: mobilePanelPositions, onItemHeight: onMobilePanelHeight } = usePanelGroupLayout<PanelId>({
    order: PANEL_GROUP_ORDER,
    defaultHeights: PANEL_GROUP_DEFAULT_HEIGHTS,
    baseX: 8,
    baseY: 64,
    gap: 6,
  })
  // The wheel listener sits on the SVG wrapper, which exists only while the SVG branch below renders (`view && target`). The
  // Canvas and headless tiers unmount it and a return mounts a new element, so the flag makes the hook rebind (WR-03).
  const { zoom, zoomOrigin, setZoom, setZoomOrigin } = useCanvasZoom(svgWrapRef, !!(view && target))
  const orbitStartDateRef = useRef<Date | null>(null)
  const urlHydratedRef = useRef(false)
  const pendingShareSelectionRef = useRef<number[] | null>(null)
  const skipFirstUrlSyncRef = useRef(true)
  const lastSyncedQueryRef = useRef('')
  const historyReadyRef = useRef(false)
  // Set by a load that commits a saved or linked naming (the mount-time hydration): the history effect then rewrites the naming of its
  // previous snapshot once, so the load is never an undo entry for the naming (D-09). A base switch needs no flag: it nulls the current
  // snapshot instead.
  const historyNamingAdoptRef = useRef(false)
  const historyCurrentRef = useRef<HistorySnapshot | null>(null)
  const historyApplyingRef = useRef(false)
  const currentOrientationRef = useRef<Record<string, 1 | -1>>({})
  const planetaryDateInputRef = useRef<HTMLInputElement | null>(null)
  const dateFieldWasVisibleRef = useRef(false)

  // ── Worker client (Phase 6 REN-03, D-06, D-07) ───────────────
  // Above svgRichMaxN every recomputation is one whole-desired-record request to the latest-wins client; base 10 and every
  // SVG-tier base never touch it, except that a synchronous commit supersedes anything in flight (P2).
  const worker = useNumogramWorker()
  // The URL state of a worker-path base, held until its result lands (the base-10 SVG stays as "the last result" meanwhile).
  const pendingHydrationRef = useRef<ShareState | null>(null)
  // Latest-value mirrors, written during render, so the worker callback never reads a stale closure: shown (failure
  // rollback), pendingVisible (the "ready" announcement) and the swap function itself.
  const shownRef = useRef<WorkerBuilt | null>(null)
  const pendingVisibleRef = useRef(false)
  const applyWorkerResponseRef = useRef<(resp: WorkerResponse) => void>(() => {})
  shownRef.current = shown
  pendingVisibleRef.current = pendingVisible

  // ── View context (MIG-02, UI-03) ─────────────────────────────
  const zoneGateMode: 'on' | 'thin' | 'off' = renderTier === 'canvas' ? gateMode(base) : target ? (target.preset ? 'on' : gateMode(base)) : 'off'
  const viewCtx = useMemo<NumogramViewContextValue>(() => {
    const common = {
      base,
      summary,
      view,
      zoneLabels,
      labelScheme,
      zoneLabel: (z: number) => formatZoneLabel(z, base, labelScheme),
      svgRichMaxN: SVG_RICH_MAX_N,
      allChordsMaxN: ALL_CHORDS_MAX_N,
      gateMode: zoneGateMode,
      tier: renderTier,
      interactiveMaxN: INTERACTIVE_MAX_N,
    }
    if (g !== null) return { ...common, g }
    // Headless (orchestrator decision 5): g is built lazily on first read (Demons overlay, demon info); createNumogram
    // caches by base. Never spread this object: a spread would read the getter and build the numogram.
    return { ...common, get g() { return createNumogram(base) } }
  }, [base, g, summary, view, zoneLabels, labelScheme, zoneGateMode, renderTier])

  // The single URL codec's ShareState for the session's current values (UI-02): the replaceState sync effect and
  // the share button both build a query from this, so a URL never drifts from what the two writers would produce.
  const currentShareState = useCallback((): ShareState => ({
    base,
    layout,
    layers: Array.from(layers),
    selected: Array.from(selZones),
    region: hlRegion,
    tc: tcActive,
    particles: particlesOn,
    date: planetDate,
    orbits: showOrbits,
    labels: labelScheme,
    isolate: [...regionFilter.isolate],
    mute: [...regionFilter.mute],
    packer,
    tier: tierOverride,
    demonFilter,
    demonFocus,
    demonsOpen,
    // D-13: the displayed naming's link form (null for the default naming of the base, so a default view writes no names=)
    names: linkFormOf(namingSession.working, NAMING_ENV),
  }), [
    base, layout, layers, selZones, hlRegion, tcActive, particlesOn, planetDate, showOrbits, labelScheme, regionFilter,
    packer, tierOverride, demonFilter, demonFocus, demonsOpen, namingSession.working,
  ])

  const snapshotState = useCallback((): HistorySnapshot => {
    // while previewing a shared link the history records the SAVED naming (snapshotNaming), so Keep is one undoable entry and Back none
    const { naming, rev } = snapshotNaming(namingSession)
    return {
      base,
      layout,
      layers: Array.from(layers).sort((a, b) => a.localeCompare(b)),
      selZones: Array.from(selZones).sort((a, b) => a - b),
      hlRegion,
      tcActive,
      particlesOn,
      showOrbits,
      planetDate,
      orbiting,
      labelVisibility: {
        numbers: labelVisibility.numbers,
        xenotation: labelVisibility.xenotation,
        planets: labelVisibility.planets,
      },
      labels: labelScheme,
      packer,
      isolate: Array.from(regionFilter.isolate).sort(),
      mute: Array.from(regionFilter.mute).sort(),
      naming,
      namingRev: rev,
    }
  }, [base, layout, layers, selZones, hlRegion, tcActive, particlesOn, showOrbits, planetDate, orbiting, labelVisibility, labelScheme, packer, regionFilter, namingSession])

  // Pitfall 7: the key never stringifies the naming (a table of thousands of sounds), only its revision number (historySnapshotKey).
  const snapshotKey = useCallback((snapshot: HistorySnapshot): string => historySnapshotKey(snapshot), [])

  // Returns whether the snapshot was applied: false for a refused one, so onUndo and onRedo can leave the history exactly as it was
  // (a refusal renders nothing, so nothing would ever clear the apply flag they set for the history effect).
  const applySnapshot = useCallback((snapshot: HistorySnapshot): boolean => {
    // UI-08: a snapshot from a different base can never be restored (its zone/region ids don't exist at the current
    // base) — commitBase always clears both history stacks on a switch, so this is a defensive guard, not the
    // primary mechanism. (A `?base=` load does leave one such entry: the base-10 snapshot of its post-load render.)
    if (snapshot.base !== base) return false
    // The naming returns with the rest of the state (NAM-03). Only a differing revision restores; the single changed zone (when
    // exactly one sound or lock differs) lets the zone list scroll to it.
    const currentNaming = snapshotNaming(sessionRef.current)
    if (snapshot.namingRev !== currentNaming.rev) {
      const zone = singleChangedZone(sessionRef.current.working, snapshot.naming)
      commitSession(restoreNaming(sessionRef.current, snapshot.naming, snapshot.namingRev))
      setNamesRestored(r => ({ tick: r.tick + 1, zone }))
      setNamesAnnouncement(NAMES_COPY.restored)
    }
    if (layout !== snapshot.layout) {
      if (layout === 'pairGraph' || snapshot.layout === 'pairGraph') jumpToTarget()
      else switchLayout()
    }
    setLayout(snapshot.layout)
    setLayers(new Set(snapshot.layers))
    setSelZones(new Set(snapshot.selZones))
    setHlRegion(snapshot.hlRegion)
    setTcActive(snapshot.tcActive)
    setParticlesOn(snapshot.particlesOn)
    setShowOrbits(snapshot.showOrbits)
    setPlanetDate(snapshot.planetDate)
    setOrbiting(snapshot.orbiting)
    setLabelVisibility({
      numbers: snapshot.labelVisibility.numbers,
      xenotation: snapshot.labelVisibility.xenotation,
      planets: snapshot.labelVisibility.planets,
    })
    setLabelScheme(snapshot.labels)
    setPacker(snapshot.packer)
    setRegionFilter(g ? sanitizeRegionFilter({
      isolate: new Set(snapshot.isolate as RegionId[]),
      mute: new Set(snapshot.mute as RegionId[]),
    }, g) : EMPTY_REGION_FILTER)

    if (snapshot.layout === 'planetary') {
      if (snapshot.planetDate) {
        setPlanetaryAngles(getAnglesForDate(new Date(`${snapshot.planetDate}T12:00:00`)))
      } else if (!snapshot.orbiting) {
        setPlanetaryAngles(PLANETARY_DEFAULT_ANGLE)
      }
    }
    return true
  }, [base, layout, switchLayout, jumpToTarget, setPlanetaryAngles, setOrbiting, g, commitSession])

  // UI-08: everything base-shaped resets in a single batched call (React batches all these setters into one render with
  // the new base) so no intermediate render ever shows a selection, region highlight or history entry belonging to the
  // previous base. Shared by the synchronous commit below and the worker swap; the caller sets the base and the layout.
  // The naming joins the same batch (D-10): the new base's saved slot, or its fresh default, replaces the old base's session.
  const resetForBaseSwitch = useCallback((nextDemons: DemonSessionState, nextBase: number) => {
    jumpToTarget()
    flushPendingSave()
    commitSession(sessionForBase(nextBase, readSlot(browserStorage(), nextBase, NAMING_ENV), null, NAMING_ENV, nextRev))
    setNamesSaved('none')
    setNamesAnnouncement('')
    historyCurrentRef.current = null
    setUndoStack([])
    setRedoStack([])
    pendingShareSelectionRef.current = null
    currentOrientationRef.current = {}
    setHoverInfo(null)
    setPinnedInfo(null)
    setSelZones(new Set())
    setHlRegion(null)
    setRegionFilter(EMPTY_REGION_FILTER)
    setTcActive(false)
    setOrbiting(false)
    setBaseRefusal(null)
    setCanvasPan({ x: 0, y: 0 })
    setZoom(1)
    setZoomOrigin({ x: 50, y: 50 })
    setDemonFilter(nextDemons.filter)
    setDemonFocus(null)
    setDemonFocusMode(false)
  }, [jumpToTarget, setCanvasPan, setZoom, setZoomOrigin, setOrbiting, commitSession, nextRev, flushPendingSave])

  // A URL state waiting for its worker result is void the moment anything else commits: drop it and let the URL sync start.
  const dropPendingHydration = useCallback(() => {
    if (pendingHydrationRef.current === null) return
    pendingHydrationRef.current = null
    setUrlSyncReady(true)
  }, [])

  // UI-08: the base picker's one commit path. A worker-tier base (Canvas or headless) only records the desired base and
  // layout: the displayed state keeps belonging to the displayed base until the result lands, and the swap does the reset.
  // An SVG-tier base commits synchronously, exactly as before, and supersedes anything still in flight (P2).
  const commitBase = useCallback((n: number) => {
    const next = sessionAfterBaseSwitch(
      {
        // while a switch is pending the user's latest layout choice is the pending one (P3)
        layout: pendingBase !== null ? (pendingLayout ?? layout) : layout,
        selected: [...selZones], hlRegion, tcActive, orbiting, pinned: pinnedInfo !== null,
        isolate: [...regionFilter.isolate], mute: [...regionFilter.mute],
      },
      n,
    )
    if (needsWorkerFor(n, next.layout, tierOverride)) {
      dropPendingHydration()
      if (n === base) {
        // back to the displayed base: the desired record equals the displayed one again, the effect supersedes the request
        setPendingBase(null)
        setPendingLayout(null)
        return
      }
      setBaseRefusal(null)
      setPendingBase(n)
      setPendingLayout(next.layout)
      return
    }
    worker.supersede()
    dropPendingHydration()
    setPendingBase(null)
    setPendingLayout(null)
    setPendingVisible(false)
    setAnnouncement('')
    if (n === base) return
    const nextDemons = demonsAfterBaseSwitch({ filter: demonFilter, focus: demonFocus }, createNumogram(n))
    resetForBaseSwitch(nextDemons, n)
    setLayout(next.layout)
    setBase(n)
  }, [
    base, layout, pendingBase, pendingLayout, selZones, hlRegion, tcActive, orbiting, pinnedInfo, regionFilter,
    tierOverride, worker, dropPendingHydration, resetForBaseSwitch, demonFilter, demonFocus,
  ])

  // Packer changes tween the diagram when the tier allows it (todo 005): capture the current positions as the
  // tween's start before the packer itself changes, the same call order handleSwitchLayout already uses.
  const onPackerChange = useCallback((next: Packer) => {
    switchLayout()
    setPacker(next)
  }, [switchLayout])

  // Keep orbit start date in sync
  useEffect(() => {
    if (orbiting && planetDate && !orbitStartDateRef.current) {
      orbitStartDateRef.current = new Date(planetDate + 'T12:00:00')
    }
    if (!orbiting) {
      orbitStartDateRef.current = null
    }
  }, [orbiting, planetDate])

  // Wire up the date update callback for orbital animation
  useEffect(() => {
    onDateUpdateRef.current = (elapsedYears: number) => {
      const start = orbitStartDateRef.current
      if (!start) return
      const ms = start.getTime() + elapsedYears * 365.25 * 24 * 3600 * 1000
      const d = new Date(ms)
      setPlanetDate(d.toISOString().slice(0, 10))
    }
    return () => { onDateUpdateRef.current = null }
  }, [onDateUpdateRef])

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Panels start open at every width (as shipped); the chevrons collapse them (todo 003).

  useEffect(() => {
    if (infoPanelInitRef.current) return
    if (viewport.w <= 0) return
    if (viewport.w <= MOBILE_SELECTOR_BREAKPOINT) return

    const margin = 12
    const gap = 12
    const viewW = viewport.w
    const maxLeft = Math.max(margin, viewW - INFO_PANEL_WIDTH - margin)
    // The diagram element whichever tier draws it: the Canvas root, else the SVG tier's own [data-diagram] svg.
    const diagramEl = canvasRef.current?.element() ?? svgWrapRef.current?.querySelector('[data-diagram]')
    const diagramRect = diagramEl?.getBoundingClientRect()
    const rightOfDiagram = diagramRect ? Math.round(diagramRect.right + gap) : maxLeft
    const left = Math.max(margin, Math.min(rightOfDiagram, maxLeft))

    setSelectionX(left)
    infoPanelInitRef.current = true
  }, [viewport.w])

  // ── Callbacks ──────────────────────────────────────────────
  const toggleLayer = useCallback((l: Layer) => {
    setLayers(prev => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }, [])

  const toggleLabelVisibility = useCallback((key: keyof LabelVisibility) => {
    setLabelVisibility(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSwitchLayout = useCallback((newLayout: ViewLayoutId) => {
    // While a base switch is pending the layout belongs to the pending base (P3): update the pending record, never the
    // displayed layout, so the request is re-issued for the whole desired record instead of orphaning the base switch.
    if (pendingBase !== null) {
      if (isLayoutIdFor(newLayout, pendingBase)) setPendingLayout(newLayout)
      return
    }
    if (newLayout === layout) return
    if (newLayout === 'pairGraph' || layout === 'pairGraph') jumpToTarget()
    else switchLayout()
    setLayout(newLayout)
  }, [layout, pendingBase, switchLayout, jumpToTarget])

  const onHoverInfo = useCallback((info: HoverInfo | null) => {
    setHoverInfo(info)
  }, [])
  const onPinInfo = useCallback((info: HoverInfo) => {
    setPinnedInfo(info)
    if (info.type === 'gate') {
      setSelZones(new Set<number>([info.gate.from, info.gate.to]))
    }
  }, [])
  const clearInfoFocus = useCallback(() => {
    setHoverInfo(null)
    setPinnedInfo(null)
  }, [])

  // Demon focus (DEM-03, D-03): shared between the diagram's zone clicks and the overlay's Browser/Focus/Matrix tabs.
  const onDemonFocusChange = useCallback((next: DemonFocus | null) => {
    setDemonFocus(next)
    if (next !== null) setDemonFocusMode(true)
  }, [])
  const onToggleDemonFocus = useCallback(() => {
    if (demonFocusMode) {
      setDemonFocusMode(false)
      setDemonFocus(null)
    } else {
      setDemonFocusMode(true)
    }
  }, [demonFocusMode])
  const onCloseDemons = useCallback(() => setDemonsOpen(false), [])

  const fitSelectionToView = useCallback((zones: number[]) => {
    if (renderTier === 'canvas') {
      // The Canvas fit uses the canvas transform, never getScreenCTM. A pair-graph scene is indexed by pair id (pair id =
      // min(zone, base - 1 - zone)), so a selected zone fits its pair there.
      const handle = canvasRef.current
      if (!handle || !g) return
      const pairs = shownForBase?.scene?.kind === 'pairs'
      handle.fitZones(pairs ? Array.from(new Set(zones.map(z => g.pairOf(z)))) : zones)
      return
    }
    if (renderTier !== 'svg') return
    if (zones.length === 0) return
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
    const xs = zones.map(z => pos[z].x)
    const ys = zones.map(z => pos[z].y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const boundsW = Math.max(90, (maxX - minX) + 120)
    const boundsH = Math.max(90, (maxY - minY) + 120)
    const zoomX = svgWidth / boundsW
    const zoomY = svgHeight / boundsH
    const targetZoom = clamp(Math.min(zoomX, zoomY) * 0.86, 0.7, 3.8)

    setCanvasPan({ x: 0, y: 0 })
    setZoomOrigin({ x: (cx / svgWidth) * 100, y: (cy / svgHeight) * 100 })
    setZoom(targetZoom)

    window.requestAnimationFrame(() => {
      const svgEl = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null
      const ctm = svgEl?.getScreenCTM()
      if (!svgEl || !ctm) return
      const pt = svgEl.createSVGPoint()
      pt.x = cx
      pt.y = cy
      const sp = pt.matrixTransform(ctm)
      const targetX = viewport.w <= MOBILE_SELECTOR_BREAKPOINT ? viewport.w * 0.5 : viewport.w * 0.54
      const targetY = viewport.h * 0.52
      const dx = targetX - sp.x
      const dy = targetY - sp.y
      setCanvasPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    })
  }, [renderTier, g, shownForBase, pos, svgWidth, svgHeight, setCanvasPan, setZoomOrigin, setZoom, viewport.w, viewport.h])
  const finalizeSelection = useCallback((end: Pos) => {
    if (!selectionStart) return
    const left = Math.min(selectionStart.x, end.x)
    const right = Math.max(selectionStart.x, end.x)
    const top = Math.min(selectionStart.y, end.y)
    const bottom = Math.max(selectionStart.y, end.y)
    const w = right - left
    const h = bottom - top
    const dragLike = w >= 4 || h >= 4
    if (!dragLike) {
      setSelectionStart(null)
      setSelectionNow(null)
      return
    }

    let selected: Set<number>
    if (renderTier === 'canvas') {
      // The Canvas tier resolves the rectangle itself, with its live transform and the mute filter applied.
      const handle = canvasRef.current
      if (!handle) {
        setSelectionStart(null)
        setSelectionNow(null)
        return
      }
      selected = new Set(handle.zonesInClientRect(left, top, right, bottom))
    } else {
      const svgEl = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null
      const ctm = svgEl?.getScreenCTM()
      if (!svgEl || !ctm) {
        setSelectionStart(null)
        setSelectionNow(null)
        return
      }

      selected = new Set<number>()
      for (let z = 0; z < base; z++) {
        const pt = svgEl.createSVGPoint()
        pt.x = pos[z].x
        pt.y = pos[z].y
        const sp = pt.matrixTransform(ctm)
        if (sp.x >= left && sp.x <= right && sp.y >= top && sp.y <= bottom) {
          selected.add(z)
        }
      }
    }
    setSelZones(prev => {
      if (selectionAdditiveRef.current) {
        const next = new Set(prev)
        selected.forEach(z => next.add(z))
        return next
      }
      return selected
    })
    // Only the SVG wrapper's onClick consumes this flag; the Canvas tier ends a drag on its own pointer events, so arming it
    // there would leave it set and swallow the first background click of the next SVG-tier base (IN-02).
    if (renderTier !== 'canvas') suppressNextCanvasClickRef.current = true
    setSelectionStart(null)
    setSelectionNow(null)
  }, [selectionStart, pos, base, renderTier])

  useEffect(() => {
    if (!selectionStart) return
    const onMove = (e: MouseEvent) => {
      setSelectionNow({ x: e.clientX, y: e.clientY })
    }
    const onUp = (e: MouseEvent) => {
      finalizeSelection({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [selectionStart, finalizeSelection])

  useEffect(() => {
    if (urlHydratedRef.current) return
    if (typeof window === 'undefined') return
    urlHydratedRef.current = true

    if (!window.location.search.replace(/^\?/, '')) {
      // D-09: a bare URL still restores the base-10 slot (the page opens on the initial base, whose session is the current one);
      // with no slot nothing is committed and no adopt flag is left pending, so the first real edit keeps its undo entry.
      const savedSlot = readSlot(browserStorage(), sessionRef.current.base, NAMING_ENV)
      if (savedSlot !== null) {
        commitSession(sessionForBase(sessionRef.current.base, savedSlot, null, NAMING_ENV, nextRev))
        historyNamingAdoptRef.current = true
      }
      setUrlSyncReady(true)
      return
    }

    const { state, baseRefusal: refusal } = parseShareParams(window.location.search)
    if (refusal) setBaseRefusal(refusalFromUrl(refusal.raw, refusal.check, 10))

    // A worker-tier base (Phase 6): nothing base-shaped is built here, no numogram on the main thread. The base-10 SVG
    // stays as "the last result" (P7), the base-independent settings apply now, and the base-shaped URL state (selection,
    // regions, demons) is stashed and applied by the swap. The URL sync stays off until then, so `?base=` is kept.
    if (needsWorkerFor(state.base, state.layout, state.tier)) {
      setTierOverride(state.tier)
      setLayers(new Set(state.layers))
      setParticlesOn(state.particles)
      setShowOrbits(state.orbits)
      if (state.date) {
        setPlanetDate(state.date)
        setOrbiting(false)
        setPlanetaryAngles(getAnglesForDate(new Date(`${state.date}T12:00:00`)))
      }
      setLabelScheme(state.labels)
      setPacker(state.packer)
      pendingHydrationRef.current = state
      setPendingBase(state.base)
      setPendingLayout(state.layout)
      return
    }

    setBase(state.base)
    setLayout(state.layout)
    setLayers(new Set(state.layers))
    setHlRegion(state.region)
    setRegionFilter({ isolate: new Set(state.isolate), mute: new Set(state.mute) })
    setTcActive(state.tc)
    setParticlesOn(state.particles)
    setShowOrbits(state.orbits)
    if (state.date) {
      setPlanetDate(state.date)
      setOrbiting(false)
      setPlanetaryAngles(getAnglesForDate(new Date(`${state.date}T12:00:00`)))
    }
    if (state.selected.length > 0) setSelZones(new Set(state.selected))
    setLabelScheme(state.labels)
    setPacker(state.packer)
    setTierOverride(state.tier)
    // D-09, D-13: the naming of the linked base is its saved slot, or the link's naming (an unsaved preview, and the Names panel
    // opens once, when the link differs from the slot). The commit always yields a new revision, so the adopt flag is always consumed.
    const hydratedNaming = sessionForBase(state.base, readSlot(browserStorage(), state.base, NAMING_ENV), state.names, NAMING_ENV, nextRev)
    commitSession(hydratedNaming)
    historyNamingAdoptRef.current = true
    if (hydratedNaming.preview) setNamesOpen(true)
    setDemonFilter(state.demonFilter)
    setDemonFocus(state.demonFocus)
    setDemonFocusMode(state.demonFocus !== null)
    setDemonsOpen(state.demonsOpen)
    setDemonTab(initialDemonTab(state.demonFocus))
    if (state.demonFocus?.kind === 'demon') {
      const gForDemonFocus = createNumogram(state.base)
      setPinnedInfo({
        type: 'demon',
        demon: legacyDemon(gForDemonFocus.demons.ref(state.demonFocus.a, state.demonFocus.b), state.base),
      })
    }

    // Pending fit zones (only within the SVG tier: D-16, never build region zones for a huge base).
    let pendingZones: number[] | null = null
    if (state.selected.length > 0) {
      pendingZones = [...state.selected]
    } else if ((state.region !== null || state.tc) && tierFor(state.base, state.tier) === 'svg') {
      const gForBase = createNumogram(state.base)
      if (state.region !== null) pendingZones = zonesOfRegion(gForBase, state.region)
      else if (state.tc) pendingZones = zonesOfRegion(gForBase, 'torque')
    }

    if (pendingZones && pendingZones.length > 0) {
      pendingShareSelectionRef.current = pendingZones
    }
    setUrlSyncReady(true)
  }, [setPlanetaryAngles, setOrbiting, commitSession, nextRev])

  useEffect(() => {
    const zones = pendingShareSelectionRef.current
    if (!zones || zones.length === 0) return
    if (viewport.w <= 0 || viewport.h <= 0) return
    const timer = window.setTimeout(() => {
      fitSelectionToView(zones)
      pendingShareSelectionRef.current = null
    }, 80)
    return () => window.clearTimeout(timer)
  }, [layout, viewport.w, viewport.h, fitSelectionToView])

  useEffect(() => {
    if (!urlSyncReady) return
    if (typeof window === 'undefined') return

    const shareState = currentShareState()
    const query = buildShareParams(shareState, { includeLayoutAlways: false }).toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`
    if (skipFirstUrlSyncRef.current) {
      skipFirstUrlSyncRef.current = false
      lastSyncedQueryRef.current = query
      // D-13: the address always names the displayed naming. A slot restored at load can carry a link form the opening URL did not
      // name; only then is the first sync written. Every other first sync stays a record only, so merely loading never rewrites a URL.
      if (shareState.names !== null && !new URLSearchParams(window.location.search).has(NAMES_PARAM)) {
        window.history.replaceState(window.history.state, '', url)
      }
      return
    }
    if (query === lastSyncedQueryRef.current) return

    window.history.replaceState(window.history.state, '', url)
    lastSyncedQueryRef.current = query
  }, [urlSyncReady, currentShareState])

  // ── Naming autosave (D-09, D-11) ─────────────────────────────
  // The slot is written after the debounce time that follows the last committed change, and only when the rules want it: after a first
  // edit (never at load), never while previewing a link and never above the interactive ceiling. The pending naming is kept in a ref
  // so a base switch or the page being hidden can write it at once; a failed write turns the quiet save line to failed.
  useEffect(() => {
    if (!autosaveWanted(namingSession, NAMING_ENV)) return
    const naming = namingSession.working
    pendingSaveRef.current = naming
    const timer = window.setTimeout(() => {
      // flushed or superseded in the meantime: nothing left to write
      if (pendingSaveRef.current !== naming) return
      pendingSaveRef.current = null
      setNamesSaved(writeSlot(browserStorage(), naming))
    }, NAMING_AUTOSAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [namingSession])

  useEffect(() => {
    window.addEventListener('pagehide', flushPendingSave)
    return () => window.removeEventListener('pagehide', flushPendingSave)
  }, [flushPendingSave])

  // ── Worker results (Phase 6 REN-03, D-07) ───────────────────
  // The URL state of a worker-path base, applied by the swap that lands its result (everything base-shaped was reset first).
  const applyHydratedState = (state: ShareState, resp: WorkerBuilt) => {
    // The same naming rule as the synchronous hydration (D-09, D-13), applied after the swap's reset in the same batch. No adopt flag:
    // the reset has already nulled the current history snapshot, so the history effect takes the swap render as its new start.
    const hydratedNaming = sessionForBase(resp.base, readSlot(browserStorage(), resp.base, NAMING_ENV), state.names, NAMING_ENV, nextRev)
    commitSession(hydratedNaming)
    if (hydratedNaming.preview) setNamesOpen(true)
    setHlRegion(state.region)
    setRegionFilter({ isolate: new Set(state.isolate), mute: new Set(state.mute) })
    setTcActive(state.tc)
    setSelZones(new Set(state.selected))
    setDemonFilter(state.demonFilter)
    setDemonFocus(state.demonFocus)
    setDemonFocusMode(state.demonFocus !== null)
    setDemonsOpen(state.demonsOpen)
    setDemonTab(initialDemonTab(state.demonFocus))
    if (state.demonFocus?.kind === 'demon') {
      // The one place a headless base builds its numogram on the main thread for a URL: a pinned demon needs its name
      // (one-time, accepted: about 0.6 s at 2^26; createNumogram is cached by the engine).
      setPinnedInfo({
        type: 'demon',
        demon: legacyDemon(createNumogram(resp.base).demons.ref(state.demonFocus.a, state.demonFocus.b), resp.base),
      })
    }
    if (state.selected.length > 0 && resp.scene !== null) pendingShareSelectionRef.current = [...state.selected]
  }

  // The latest-wins swap: the client only calls this for the newest request, and every setter below runs in this one
  // callback so React batches them into a single render: the new result, the new base and the UI-08 reset land together
  // and no frame shows a mix of old and new.
  const applyWorkerResponse = (resp: WorkerResponse) => {
    if (resp.type === 'error') {
      setPendingVisible(false)
      setAnnouncement('')
      setBaseRefusal(resp.reason === 'no-worker' ? noWorkerMessage(resp.base, base) : computeFailedMessage(resp.base, base))
      setPendingBase(null)
      setPendingLayout(null)
      // The displayed result stays, undimmed; layout, packer and labels revert to what it was built with.
      const current = shownRef.current
      if (current !== null && current.base === base) {
        setLayout(current.layout)
        setPacker(current.packer)
        if (labelSchemeKey(current.labels) !== labelSchemeKey(labelScheme)) setLabelScheme(current.labels)
      }
      dropPendingHydration()
      return
    }
    const hydration = pendingHydrationRef.current
    pendingHydrationRef.current = null
    if (hydration !== null || resp.base !== base) {
      // A new base (or a URL's whole state): the UI-08 reset first, then the URL's own values on top of it.
      resetForBaseSwitch(demonsAfterSwitchFromCounts({ filter: demonFilter, focus: demonFocus }, resp.facetCounts), resp.base)
      if (hydration !== null) applyHydratedState(hydration, resp)
    }
    setBase(resp.base)
    setLayout(resp.layout)
    setPacker(resp.packer)
    // A structured-cloned but equal scheme must not change identity: that would force a re-raster of the same picture.
    if (labelSchemeKey(resp.labels) !== labelSchemeKey(labelScheme)) setLabelScheme(resp.labels)
    setShown(resp)
    setPendingBase(null)
    setPendingLayout(null)
    setPendingVisible(false)
    setAnnouncement(pendingVisibleRef.current ? `Base ${resp.base} ready.` : '')
    if (hydration !== null) setUrlSyncReady(true)
  }
  applyWorkerResponseRef.current = applyWorkerResponse

  // The desired record: the pending base (or the displayed one) with the layout, packer and labels chosen for it. Whatever
  // is not the displayed result, and needs the worker, goes out as ONE request carrying all four (P3).
  const desiredBase = pendingBase ?? base
  const desiredLayout = pendingBase !== null ? (pendingLayout ?? layout) : layout
  const desiredKey = needsWorkerFor(desiredBase, desiredLayout, tierOverride)
    ? resultKey(desiredBase, desiredLayout, packer, labelScheme)
    : null
  useEffect(() => {
    if (desiredKey === null || (pendingBase === null && shownRef.current?.key === desiredKey)) {
      // The SVG path, or the displayed result already is the desired one: nothing may arrive late and overwrite it (P2).
      worker.supersede()
      setPendingVisible(false)
      setAnnouncement('')
      return
    }
    const timer = window.setTimeout(() => {
      setPendingVisible(true)
      setAnnouncement(`Computing base ${desiredBase}...`)
    }, PENDING_GRACE_MS)
    worker.request(
      {
        base: desiredBase,
        layout: desiredLayout,
        packer,
        labels: labelScheme,
        wantScene: tierFor(desiredBase, tierOverride) !== 'headless',
      },
      resp => {
        window.clearTimeout(timer)
        applyWorkerResponseRef.current(resp)
      },
    )
    return () => window.clearTimeout(timer)
    // desiredKey encodes the desired base, layout, packer and labels (the only inputs); the other values read here are
    // the same render's, and the swap reaches the latest closure through applyWorkerResponseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desiredKey])

  const onToggleZone = useCallback((z: number) => {
    setSelZones(prev => {
      const next = new Set(prev)
      if (next.has(z)) next.delete(z)
      else next.add(z)
      return next
    })
  }, [])

  const onToggleSyzygyPair = useCallback((a: number, b: number) => {
    setSelZones(prev => toggleTerminalSelection(prev, [a, b]))
  }, [])

  const onSelectRegion = useCallback((r: RegionId | null) => {
    setHlRegion(r)
    setTcActive(false)
  }, [])

  // Isolate/mute (D-19, D-22): independent per-region toggles, never clearing another row's state.
  const onToggleIsolate = useCallback((id: RegionId) => {
    setRegionFilter(f => toggleIsolate(f, id))
  }, [])
  const onToggleMute = useCallback((id: RegionId) => {
    setRegionFilter(f => toggleMute(f, id))
  }, [])

  const onToggleAllZones = useCallback(() => {
    setSelZones(prev => {
      if (!view) return prev // headless: no selection exists
      if (prev.size === base) return new Set()
      const all = new Set<number>()
      for (let z = 0; z < base; z++) all.add(z)
      return all
    })
    setHlRegion(null)
  }, [view, base])

  const onToggleTC = useCallback(() => {
    setTcActive(prev => !prev)
    setHlRegion(null)
  }, [])

  const onSelectCurrent = useCallback((from: number, to: number) => {
    if (!view) return
    setSelZones(prev => toggleTerminalSelection(prev, [from, view.partner(from), to]))
  }, [view])

  const onSelectGate = useCallback((from: number, to: number) => {
    setSelZones(prev => toggleTerminalSelection(prev, [from, to]))
  }, [])

  const onClearSelection = useCallback(() => {
    setSelZones(new Set())
  }, [])

  const onRemoveSelectedInfo = useCallback((info: HoverInfo) => {
    setSelZones(prev => {
      const next = new Set(prev)
      if (info.type === 'zone') {
        next.delete(info.zone)
        return next
      }
      if (info.type === 'syzygy') {
        next.delete(info.data.a)
        next.delete(info.data.b)
        return next
      }
      if (info.type === 'current') {
        next.delete(info.data.from)
        if (view) next.delete(view.partner(info.data.from))
        next.delete(info.data.to)
        return next
      }
      if (info.type === 'gate') {
        next.delete(info.gate.from)
        next.delete(info.gate.to)
        return next
      }
      next.delete(info.demon.a)
      next.delete(info.demon.b)
      return next
    })
  }, [view])

  const onZoneNodeClick = useCallback((zone: number) => {
    if (demonFocusMode) {
      setDemonFocus(prev => (sameFocus(prev, zoneFocus(zone)) ? null : zoneFocus(zone)))
      setDemonTab('focus')
      return
    }
    setSelZones(prev => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
  }, [demonFocusMode])

  // The Canvas tier reports where a rubber-band press began; the rectangle and its window listeners stay here (the same
  // ones the SVG wrapper uses) and finalizeSelection resolves the zones through the canvas handle.
  const onCanvasRubberBand = useCallback((x: number, y: number, additive: boolean) => {
    selectionAdditiveRef.current = additive
    setSelectionStart({ x, y })
    setSelectionNow({ x, y })
  }, [])

  useEffect(() => {
    const currentSnapshot = snapshotState()

    if (!historyReadyRef.current) {
      historyReadyRef.current = true
      historyCurrentRef.current = currentSnapshot
      return
    }

    let previousSnapshot = historyCurrentRef.current
    if (!previousSnapshot) {
      historyCurrentRef.current = currentSnapshot
      return
    }

    // A naming that was LOADED (a saved slot or a shared link, D-09) is not an edit: on the render where it arrives the previous
    // snapshot takes over its naming and revision. The rewritten snapshot is stored back, because the bare return below does not
    // touch the ref and the next change of any kind would otherwise push the pre-load naming (Undo would restore it and autosave
    // would write it over the slot). The rest of the previous snapshot is kept, so a load that also changes the layout still pushes
    // its one post-load entry exactly as before (the frozen behaviour baseline records Undo enabled after such a load), now carrying
    // the loaded naming.
    if (historyNamingAdoptRef.current && previousSnapshot.namingRev !== currentSnapshot.namingRev) {
      historyNamingAdoptRef.current = false
      previousSnapshot = withHydratedNaming(previousSnapshot, currentSnapshot)
      historyCurrentRef.current = previousSnapshot
    }

    // The render that carries an Undo or Redo: onUndo and onRedo set the flag and the ref to their target, then applied it. The flag is
    // cleared here whether or not the state that arrived matches the target; checked after the key-equality return it was never
    // cleared when it did match (the usual case), so the next real change of any kind was swallowed instead of pushed.
    if (historyApplyingRef.current) {
      historyApplyingRef.current = false
      historyCurrentRef.current = currentSnapshot
      return
    }

    if (snapshotKey(previousSnapshot) === snapshotKey(currentSnapshot)) return

    if (orbiting) {
      historyCurrentRef.current = currentSnapshot
      return
    }

    // A naming with a huge override map keeps a short undo depth (Pitfall 18): each entry shares its unchanged parts, but the
    // map is costly to copy when it changes.
    const depth = currentSnapshot.naming.overrides.size > NAMING_UNDO_OVERRIDE_LIMIT ? NAMING_UNDO_HEAVY_DEPTH : MAX_HISTORY_ENTRIES
    setUndoStack(prev => {
      const next = [...prev, previousSnapshot]
      return next.length > depth
        ? next.slice(next.length - depth)
        : next
    })
    setRedoStack([])
    historyCurrentRef.current = currentSnapshot
  }, [snapshotState, snapshotKey, orbiting])

  const onUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const target = undoStack[undoStack.length - 1]
    const remaining = undoStack.slice(0, -1)
    const current = historyCurrentRef.current
    // The apply comes first. A refused snapshot (another base's: the post-load entry of a `?base=` load) only drops its dead entry: the
    // flag, the current-snapshot ref and the Redo stack stay exactly as they were, because a refusal renders nothing and so nothing
    // would ever clear a flag set for it (the next real edit was swallowed).
    const applied = applySnapshot(target)
    setUndoStack(remaining)
    if (!applied) return
    if (current) {
      setRedoStack(next => [current, ...next].slice(0, MAX_HISTORY_ENTRIES))
    }
    historyApplyingRef.current = true
    historyCurrentRef.current = target
  }, [undoStack, applySnapshot])

  const onRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const [target, ...remaining] = redoStack
    const current = historyCurrentRef.current
    // As in onUndo: a refused snapshot only drops its dead entry and leaves the flag, the ref and the Undo stack alone.
    const applied = applySnapshot(target)
    setRedoStack(remaining)
    if (!applied) return
    if (current) {
      setUndoStack(next => {
        const appended = [...next, current]
        return appended.length > MAX_HISTORY_ENTRIES
          ? appended.slice(appended.length - MAX_HISTORY_ENTRIES)
          : appended
      })
    }
    historyApplyingRef.current = true
    historyCurrentRef.current = target
  }, [redoStack, applySnapshot])

  // ── Naming session actions and the NamingContext value (Phase 7, D-03) ──
  // An action is computed from sessionRef (the latest committed session) and reports whether it changed anything by comparing the
  // two session objects: the rules return the SAME object for every refusal and every no-op, so a refusal records no history
  // entry and writes no slot. Never read a flag set inside a state updater: React may run an updater lazily or twice.
  const applyNaming = useCallback((action: NamingAction): boolean => {
    const next = applyNamingAction(sessionRef.current, action, NAMING_ENV, nextRev)
    if (next === sessionRef.current) return false
    commitSession(next)
    return true
  }, [nextRev, commitSession])
  const keepNaming = useCallback(() => commitSession(keepPreview(sessionRef.current, nextRev)), [nextRev, commitSession])
  const revertNaming = useCallback(() => commitSession(revertPreview(sessionRef.current)), [commitSession])
  const announceNaming = useCallback((text: string) => setNamesAnnouncement(text), [])
  // The panel's inline Undo goes through the app's own undo; the ref keeps the context value from changing with every history entry.
  const onUndoRef = useRef(onUndo)
  onUndoRef.current = onUndo
  const undoNaming = useCallback(() => onUndoRef.current(), [])
  // Memoised on the naming itself: a context change that is not a naming change (a pending flag, a status line) leaves the resolver
  // and the uncarried check alone, so the displays that search or list names do not recompute.
  const namingResolver = useMemo(() => createNameResolver(namingSession.working, NAMING_ENV.preset), [namingSession.working])
  const namingUncarried = useMemo(() => hasUncarriedEdits(namingSession.working, NAMING_ENV), [namingSession.working])
  // Declared above onShareExplanation (plan 07-21 reads it there); every render tier provides it (no hasDiagram guard).
  const namingCtx = useMemo<NamingContextValue>(() => ({
    base,
    naming: namingSession.working,
    rev: namingSession.rev,
    resolver: namingResolver,
    preset: NAMING_ENV.preset,
    state: namesPanelState(base, namingSession, NAMING_ENV, pendingVisible && pendingBase !== null),
    pendingBase,
    saved: namingSession.preview ? 'preview' : base > INTERACTIVE_MAX_N ? 'seed-only' : namesSaved,
    uncarried: namingUncarried,
    interactiveMaxN: NAMING_ENV.interactiveMaxN,
    announcement: namesAnnouncement,
    restored: namesRestored,
    apply: applyNaming,
    keep: keepNaming,
    revert: revertNaming,
    undo: undoNaming,
    announce: announceNaming,
  }), [
    base, namingSession, namingResolver, namingUncarried, pendingVisible, pendingBase, namesSaved, namesAnnouncement, namesRestored,
    applyNaming, keepNaming, revertNaming, undoNaming, announceNaming,
  ])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null
      if (!el) return false
      if (el.isContentEditable) return true
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      const hasUndoModifier = (e.metaKey || e.ctrlKey) && !e.altKey

      if (hasUndoModifier && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }
      if (hasUndoModifier && key === 'y') {
        e.preventDefault()
        onRedo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if ((key === '?' || key === '/') && e.shiftKey) {
        e.preventDefault()
        setShortcutsOpen(open => !open)
        return
      }

      if (key === 'escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false)
          return
        }
        if (demonsOpen) { setDemonsOpen(false); return }
        setSelZones(new Set()); setDemonFocus(null)
        return
      }

      const dateFieldVisible = layout === 'planetary' && !!planetDate
      if (dateFieldVisible && /^[0-9]$/.test(key)) return

      // Digit-shortcut gate lookup is base 10 only (research Pitfall 4, A4): every other base uses the picker
      // and panels, never a 0-9 keyboard shortcut that would collide with its own in-base numerals.
      if (base === 10 && /^[0-9]$/.test(key)) {
        const zone = Number(key)
        const gate = view?.gates.find(gt => gt.from === zone)
        if (!gate) return
        e.preventDefault()
        onSelectGate(gate.from, gate.to)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [layout, planetDate, base, view, onSelectGate, onUndo, onRedo, shortcutsOpen, demonsOpen])

  useEffect(() => {
    const dateFieldVisible = layout === 'planetary' && !!planetDate
    if (dateFieldVisible && !dateFieldWasVisibleRef.current) {
      requestAnimationFrame(() => {
        const input = planetaryDateInputRef.current
        if (!input) return
        input.focus({ preventScroll: true })
        input.select()
      })
    }
    dateFieldWasVisibleRef.current = dateFieldVisible
  }, [layout, planetDate])

  // ── Computed values ────────────────────────────────────────
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const isMobile = viewport.w > 0 && viewport.w <= MOBILE_SELECTOR_BREAKPOINT
  const isDesktop = viewport.w > MOBILE_SELECTOR_BREAKPOINT
  const mobilePanelWidth = useMemo(() => {
    if (!isMobile) return PANEL_WIDTH
    return Math.max(170, Math.min(240, viewport.w - 16))
  }, [isMobile, viewport.w])
  const panelHeaderLeft = isMobile ? 8 : DESKTOP_PANEL_LEFT_X
  const panelHeaderWidth = isMobile
    // The header spans the window (8 px gutters) rather than the 240 px panel column: brand + base picker + four buttons cannot fit in
    // 240 px, so the Undo, Redo, Share and Filter buttons used to be pushed off the right edge of a phone.
    ? Math.max(mobilePanelWidth, viewport.w - 16)
    // +96 (04-12): room for the header base picker (UI-01) beside Undo/Redo/Share without covering the layout
    // switcher's fixed ButtonSet at 1280px (384 -> 480px desktop).
    : (DESKTOP_PANEL_RIGHT_X + PANEL_WIDTH - DESKTOP_PANEL_LEFT_X + 96)

  const onPanelHeight = useCallback((panelId: string, height: number) => {
    if (!isMobile && !isDesktop) return
    if (isMobile) {
      onMobilePanelHeight(panelId, height)
      return
    }
    if (!(panelId in PANEL_GROUP_DEFAULT_HEIGHTS)) return
    const id = panelId as PanelId
    setDesktopPanelHeights(prev => {
      if (Math.abs((prev[id] ?? 0) - height) < 0.5) return prev
      return { ...prev, [id]: height }
    })
  }, [isDesktop, isMobile, onMobilePanelHeight])

  // Isolate/mute render filter (UI-05, D-19..D-24): built only when the filter is non-empty and there is a view to
  // filter (SVG tier, D-16); null means "render exactly as before" to both diagrams.
  const zoneStateArr = useMemo(
    () => (view && g && regionFilterActive(regionFilter) ? computeZoneStates(g, regionFilter) : null),
    [view, g, regionFilter],
  )

  // Demon focus chords (DEM-03, D-03): drawn into the diagram only when one exists and a diagram is mounted (bounded
  // at FOCUS_CHORD_DRAW_MAX via focusChordList); null renders nothing (Projection's focusChords prop is additive-only).
  const focusChords = useMemo(
    () => (view && g && demonFocus ? focusChordList(g, demonFocus) : null),
    [view, demonFocus, g],
  )

  // UI-06: fit every visible (non-muted) zone into view, keyboard-reachable via the ViewControls toolbar.
  // At the Canvas tier the canvas transform does the framing (a pair-graph scene is indexed by pair id, whose state is that of
  // its low zone, exactly as the SVG pair graph's pairStates are built).
  const canvasUnits = shownForBase?.scene?.kind === 'pairs' ? base / 2 : base
  const fitAll = useCallback(() => {
    if (renderTier === 'canvas') {
      if (zoneStateArr === null) {
        canvasRef.current?.fit()
        return
      }
      const visible: number[] = []
      for (let z = 0; z < canvasUnits; z++) if (zoneStateArr[z] !== 0) visible.push(z)
      canvasRef.current?.fitZones(visible)
      return
    }
    const zones = Array.from({ length: base }, (_, z) => z).filter(z => !zoneStateArr || zoneStateArr[z] !== 0)
    fitSelectionToView(zones)
  }, [renderTier, base, canvasUnits, zoneStateArr, fitSelectionToView])

  const hlZones = useMemo(() => {
    if (tcActive) return new Set(view ? view.torqueZones : [])
    if (hlRegion && g && isRegionId(hlRegion, g)) {
      return new Set(zonesOfRegion(g, hlRegion))
    }
    if (hoverInfo?.type === 'gate') {
      return new Set<number>([hoverInfo.gate.from, hoverInfo.gate.to])
    }
    const s = new Set<number>(selZones)
    for (const z of focusZones(demonFocus)) s.add(z)
    if (hoverInfo) {
      switch (hoverInfo.type) {
        case 'zone': s.add(hoverInfo.zone); break
        case 'syzygy': s.add(hoverInfo.data.a); s.add(hoverInfo.data.b); break
        case 'current': {
          const c = hoverInfo.data
          s.add(c.from); if (view) s.add(view.partner(c.from)); s.add(c.to); break
        }
        case 'demon': s.add(hoverInfo.demon.a); s.add(hoverInfo.demon.b); break
      }
    }
    return s
  }, [hoverInfo, selZones, hlRegion, tcActive, view, g, demonFocus])

  const selectedInfos = useMemo<HoverInfo[]>(() => {
    if (selZones.size === 0 || !view) return []
    const infos: HoverInfo[] = []
    const seen = new Set<string>()
    const pushUnique = (key: string, info: HoverInfo) => {
      if (seen.has(key)) return
      seen.add(key)
      infos.push(info)
    }

    if (layers.has('gates')) {
      for (const gt of view.gates) {
        if (selZones.has(gt.from) && selZones.has(gt.to)) {
          pushUnique(`gate:${gt.name}`, { type: 'gate', gate: gt })
        }
      }
    }
    if (layers.has('currents')) {
      for (const c of view.currents) {
        const partner = view.partner(c.from)
        if (selZones.has(c.from) && selZones.has(partner) && selZones.has(c.to)) {
          pushUnique(`current:${c.name}`, { type: 'current', data: c })
        }
      }
    }
    if (layers.has('syzygies')) {
      for (const s of view.syzygies) {
        if (selZones.has(s.a) && selZones.has(s.b)) {
          pushUnique(`syzygy:${s.a}:${s.b}`, { type: 'syzygy', data: s })
        }
      }
    }
    Array.from(selZones).sort((a, b) => a - b).forEach(z => {
      pushUnique(`zone:${z}`, { type: 'zone', zone: z })
    })

    return infos
  }, [selZones, layers, view])

  const onShareExplanation = useCallback(async () => {
    // Honest sharing (D-13): a link cannot carry edited sounds or renamed demons, so pressing Share says so (the button's title says the
    // same sentence; its label and the sharing itself are unchanged). `namingUncarried` and `announceNaming` are declared above.
    if (namingUncarried) announceNaming(NAMES_COPY.shareTitleUncarried)
    const selectedIds = Array.from(selZones).sort((a, b) => a - b)
    const layerIds = Array.from(layers).sort()
    const defaultLayerIds = [...DEFAULT_LAYERS].sort()
    const shareTitle = buildNumogramTitle({
      layout,
      selectedIds,
      layers: layerIds.join(',') !== defaultLayerIds.join(',') ? layerIds.join(',') : undefined,
      particles: particlesOn,
      date: layout === 'planetary' ? (planetDate || undefined) : undefined,
      orbits: layout === 'planetary' && !showOrbits ? '0' : undefined,
      base: base !== 10 ? base : undefined,
    })
    const summaryBits: string[] = selectedIds.length > 0
      ? [
          `${selectedIds.length} selected ${selectedIds.length === 1 ? 'zone' : 'zones'}`,
          `${layout} layout`,
        ]
      : [
          'whole numogram',
          `${layout} layout`,
        ]
    if (hlRegion) summaryBits.push(`${hlRegion} region`)
    if (tcActive) summaryBits.push('tc enabled')
    if (particlesOn) summaryBits.push('particles enabled')
    if (layout === 'planetary' && planetDate) summaryBits.push(`date ${planetDate}`)
    if (layout === 'planetary' && !showOrbits) summaryBits.push('orbits hidden')
    const shareSubtitle = summaryBits.join(' · ')

    const query = buildShareParams(currentShareState(), { includeLayoutAlways: true }).toString()
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareSubtitle, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1200)
    } catch {
      // User-cancelled share or unavailable clipboard permissions.
    }
  }, [layout, selZones, layers, hlRegion, tcActive, particlesOn, planetDate, showOrbits, base, currentShareState, namingUncarried, announceNaming])

  const anyFocus = hlZones.size > 0

  const zoneRadius = useCallback((z: number) => (layout === 'planetary' ? PLANETARY_SIZE[z] : 21), [layout])

  // Base-10 presets render through the authored path (byte-identical to the frozen goldens); every procedural
  // layout and the pair graph render through the engine's own routing (LAY-01..04, UI-06). All of these run only
  // when view/target are non-null (i.e. within the SVG tier, D-16): above it nothing here is ever built.
  const presetGates = useMemo(
    () => (view && g && target && target.preset
      ? base10GateRender({ layout: layout as Layout, pos, ctr, g, gates: view.gates, currents: view.currents, syzygies: view.syzygies, zoneRadius })
      : null),
    [view, target, layout, pos, ctr, g, zoneRadius],
  )
  const presetCurrents = useMemo(
    () => (view && g && target && target.preset
      ? base10CurrentRender(
          { layout: layout as Layout, pos, ctr, g, gates: view.gates, currents: view.currents, syzygies: view.syzygies, zoneRadius },
          currentOrientationRef.current,
        )
      : null),
    [view, target, layout, pos, ctr, g, zoneRadius],
  )
  const finalRoutes = useMemo(
    () => (view && target && target.layout && !target.pairGraph ? engineRenderData(view, target.layout) : null),
    [view, target],
  )
  const frameRoutes = useMemo(
    () => (view && target && finalRoutes && tweening && target.layout
      ? engineRenderData(view, frameLayout(target.layout, pos), {
          gateOrientation: finalRoutes.gateRoutes.orientation,
          currentOrientation: finalRoutes.currentRoutes.orientation,
        })
      : finalRoutes),
    [view, target, finalRoutes, tweening, pos],
  )
  const gateRenderData = presetGates ?? frameRoutes?.gates ?? {}
  const currentRenderData = presetCurrents ?? frameRoutes?.currents ?? {}
  const pairRoutes = useMemo(
    () => (g && target && target.pairGraph && target.layout ? routePairGraph(g, target.layout as PairGraphLayout) : null),
    [g, target],
  )

  const zoneOrder = useMemo(() => {
    if (!target) return []
    return target.drawOrder ? [...target.drawOrder] : Array.from({ length: base }, (_, z) => z).sort((a, b) => pos[a].y - pos[b].y)
  }, [target, base, pos])
  const labelsOn = !!target && (target.preset || labelsShown(target.nodeRadius * (DIAGRAM_CSS_WIDTH / svgWidth) * zoom))

  const gateCalcFocusName = hoverInfo?.type === 'gate'
    ? hoverInfo.gate.name
    : pinnedInfo?.type === 'gate'
      ? pinnedInfo.gate.name
      : null
  const selectionRect = useMemo(() => {
    if (!selectionStart || !selectionNow) return null
    const left = Math.min(selectionStart.x, selectionNow.x)
    const top = Math.min(selectionStart.y, selectionNow.y)
    return {
      left,
      top,
      width: Math.abs(selectionNow.x - selectionStart.x),
      height: Math.abs(selectionNow.y - selectionStart.y),
    }
  }, [selectionStart, selectionNow])

  const infoPanelWidth = useMemo(() => {
    if (!isMobile) return INFO_PANEL_WIDTH
    return Math.max(240, Math.min(360, viewport.w - 16))
  }, [isMobile, viewport.w])

  const canvasCursor = useMemo(() => {
    if (selectionStart) return 'crosshair'
    return hoverInfo ? 'grab' : 'crosshair'
  }, [selectionStart, hoverInfo])

  // The over-limit view's text view (D-14/D-16): built by the worker for the displayed base (bounded internally, so it
  // stays cheap at any base); empty until a result for this base has landed, and unused while a diagram is shown.
  const bigBaseText = shownForBase?.text ?? ''

  // The Text panel's copy (UI-07): the SVG tier builds it here (cheap up to svgRichMaxN); the Canvas tier takes the
  // worker's full text (D-08's non-visual fallback), and headless has no panel (BigBaseSummary carries the text).
  const panelText = useMemo(
    () => (renderTier === 'svg' ? numogramText(g as Numogram, z => formatZoneLabel(z, base, labelScheme)) : (shownForBase?.text ?? '')),
    [renderTier, shownForBase, g, base, labelScheme],
  )

  // The naming's sounds for the zone node labels (D-03): only in labels=sounds mode and only within the interactive ceiling (above it a
  // naming has no sound table and the labels stay digits). Null in every other mode, so every diagram renders exactly as before.
  const zoneSounds = labelScheme.mode === 'sounds' && base <= INTERACTIVE_MAX_N ? namingSession.working.sounds : null

  // The Names panel's slot and body room: the same recipe on both stacks (on mobile the panel is first, so its y is always the stack's top).
  const namesPos = isMobile ? mobilePanelPositions.names : panelPositions.names
  const namesBodyRoom = namesBodyMax(namesPos.y, viewport.h)
  // What the panel highlights for the pinned element: the pinned zone's row, or the pinned demon's row in the preview table.
  const pinnedZone = pinnedInfo?.type === 'zone' ? pinnedInfo.zone : null
  const pinnedDemonMesh = pinnedInfo?.type === 'demon' ? meshOf(pinnedInfo.demon.a, pinnedInfo.demon.b) : null

  // ── Render ─────────────────────────────────────────────────
  return (
    <NumogramViewContext.Provider value={viewCtx}>
    <NamingContext.Provider value={namingCtx}>
    <div className="h-screen overflow-hidden bg-[#060609] text-gray-300 flex flex-col items-center justify-center px-4 py-8 font-mono select-none relative">
      {/* === Fixed top bar === */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-3 pb-1 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, #060609 60%, transparent 100%)' }}
      >
        <div className="pointer-events-auto flex flex-col items-center">
          <ButtonSet>
            {layoutIdsForBase(base).map(id => {
              const active = layout === id
              const clr = active ? '#10ff50' : '#444'
              const icon = id === 'original' ? <OriginalIcon clr={clr} />
                : id === 'labyrinth' ? <LabyrinthIcon clr={clr} />
                : id === 'ladder' ? <LadderIcon clr={clr} />
                : id === 'planetary' ? <PlanetaryIcon clr={clr} />
                : id === 'ring' ? <RingIcon clr={clr} />
                : id === 'spiral' ? <SpiralIcon clr={clr} />
                : <PairGraphIcon clr={clr} />
              return (
                <Button key={id} active={active}
                  shortcut={layoutShortcut(id, base) ?? undefined}
                  postBaseline={!(base === 10 && isPresetLayoutId(id, 10))}
                  onClick={() => handleSwitchLayout(id)}
                  onMouseEnter={() => setHoveredLayout(id)}
                  onMouseLeave={() => setHoveredLayout(null)}
                >{icon}</Button>
              )
            })}
          </ButtonSet>
          <div className="h-4 flex items-center">
            {hoveredLayout && (
              <span className="text-[8px] tracking-[0.25em] uppercase font-mono"
                style={{ color: '#10ff50' }}
              >{LAYOUT_LABELS[hoveredLayout]}</span>
            )}
          </div>
        </div>

        {/* Planetary controls */}
        {layout === 'planetary' && (
          <div className="pointer-events-auto flex items-start gap-1.5">
            <ButtonSet>
              <Button active={orbiting} indicator shortcut="z" disabled={reducedMotion} onClick={() => setOrbiting(o => !o)} className="py-1.5">
                <OrbitIcon clr={orbiting ? '#10ff50' : '#555'} />
              </Button>
            </ButtonSet>
            <div className="flex flex-col items-stretch gap-1">
              <ButtonSet>
                <Button shortcut="x" active={!!planetDate} onClick={() => {
                  setOrbiting(false)
                  const d = planetDate ? new Date(planetDate + 'T12:00:00') : new Date()
                  if (!planetDate) setPlanetDate(new Date().toISOString().slice(0, 10))
                  setPlanetaryAngles(getAnglesForDate(d))
                  requestAnimationFrame(() => {
                    const input = planetaryDateInputRef.current
                    if (!input) return
                    input.focus({ preventScroll: true })
                    input.select()
                  })
                }} className="py-1.5">
                  <TodayIcon />
                </Button>
                <Button shortcut="c" onClick={() => { setOrbiting(false); setPlanetaryAngles(PLANETARY_DEFAULT_ANGLE); setPlanetDate('') }} className="py-1.5">
                  <ResetIcon />
                </Button>
                <Button shortcut="v" active={showOrbits} indicator onClick={() => setShowOrbits(o => !o)} className="py-1.5">
                  <OrbitsIcon clr={showOrbits ? '#10ff50' : '#555'} />
                </Button>
              </ButtonSet>
              {planetDate && (
                <input
                  ref={planetaryDateInputRef}
                  type="date"
                  value={planetDate}
                  onChange={e => {
                    const val = e.target.value
                    setPlanetDate(val)
                    if (val) {
                      setOrbiting(false)
                      setPlanetaryAngles(getAnglesForDate(new Date(val + 'T12:00:00')))
                    }
                  }}
                  className="bg-transparent text-[10px] tracking-wider font-mono px-2 py-1 outline-none"
                  style={{
                    border: '1px solid rgba(16,255,80,0.12)',
                    color: '#10ff50',
                    caretColor: '#10ff50',
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pinned background */}
      <PinnedBackground pinnedInfo={pinnedInfo} hoverInfo={hoverInfo} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full">
        <div style={{ height: layout === 'planetary' ? 72 : 48 }} />

        {view && target ? (
          <div className="flex justify-center w-full" data-render-tier="svg" style={{
            transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
            ...(pendingVisible ? { opacity: 0.5, pointerEvents: 'none', transition: 'opacity 0.15s' } : {}),
          }}>
            <div ref={svgWrapRef} style={{
              transform: `translate(${parallax.x}px, ${parallax.y}px) scale(${zoom})`,
              transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
              cursor: canvasCursor,
            }}
            onMouseDown={e => {
              if (e.button === 1 || e.altKey) {
                startCanvasDrag(e)
                return
              }
              if (((e.target as HTMLElement).tagName === 'DIV' || (e.target as SVGElement).tagName === 'svg') && e.button === 0) {
                selectionAdditiveRef.current = e.shiftKey
                const start = { x: e.clientX, y: e.clientY }
                setSelectionStart(start)
                setSelectionNow(start)
              }
            }}
            onClick={e => {
              if ((e.target as HTMLElement).tagName === 'DIV' || (e.target as SVGElement).tagName === 'svg') {
                if (suppressNextCanvasClickRef.current) {
                  suppressNextCanvasClickRef.current = false
                  return
                }
                clearInfoFocus()
              }
            }}>
              {target.pairGraph ? (
                <PairGraphProjection
                  g={g as Numogram}
                  view={view}
                  layout={target.layout as PairGraphLayout}
                  routes={pairRoutes!}
                  zoneLabels={zoneLabels!}
                  selZones={selZones}
                  hlZones={hlZones}
                  anyFocus={anyFocus}
                  labelsOn={labelsOn}
                  pairStates={zoneStateArr ? Uint8Array.from({ length: base / 2 }, (_, q) => zoneStateArr[q]) : null}
                  onHoverInfo={onHoverInfo}
                  onPinInfo={onPinInfo}
                  onTogglePair={onToggleSyzygyPair}
                />
              ) : (
                <Projection
                  view={view}
                  layoutId={layout}
                  routingStyle={target.routingStyle}
                  presetRouting={target.preset}
                  width={svgWidth}
                  nodeRadius={target.nodeRadius}
                  labelSize={target.labelSize}
                  strokeScale={target.strokeScale}
                  regionLabels={target.regionLabels}
                  zoneLabels={zoneLabels!}
                  labelsOn={labelsOn}
                  gateMode={zoneGateMode}
                  pos={pos}
                  ctr={ctr}
                  svgHeight={svgHeight}
                  layers={layers}
                  hlZones={hlZones}
                  selZones={selZones}
                  anyFocus={anyFocus}
                  tcActive={tcActive}
                  showOrbits={showOrbits}
                  planetaryPos={planetaryPos}
                  zoneOrder={zoneOrder}
                  zoneStates={zoneStateArr}
                  gateRenderData={gateRenderData}
                  currentRenderData={currentRenderData}
                  gateCalcFocusName={gateCalcFocusName}
                  labelVisibility={labelVisibility}
                  particlesOn={particlesOn}
                  reducedMotion={reducedMotion}
                  focusChords={focusChords}
                  zoneSounds={zoneSounds}
                  labelPxPerUnit={zoneSounds !== null ? (DIAGRAM_CSS_WIDTH / svgWidth) * zoom : undefined}
                  onHoverInfo={onHoverInfo}
                  onPinInfo={onPinInfo}
                  onZoneNodeClick={onZoneNodeClick}
                />
              )}
            </div>
          </div>
        ) : renderTier === 'canvas' && view && zoneLabels && shownForBase?.scene ? (
          <div className="flex justify-center w-full">
            <CanvasDiagram
              ref={canvasRef}
              scene={shownForBase.scene}
              view={view}
              zoneLabels={zoneLabels}
              zoneSounds={zoneSounds}
              layers={layers}
              labelVisibility={labelVisibility}
              gateMode={zoneGateMode}
              hlZones={hlZones}
              selZones={selZones}
              anyFocus={anyFocus}
              zoneStates={zoneStateArr}
              focusChords={focusChords}
              tcActive={tcActive}
              hoverInfo={hoverInfo}
              pinnedInfo={pinnedInfo}
              demonFocusMode={demonFocusMode}
              pending={pendingVisible}
              viewportWidth={viewport.w}
              viewportHeight={viewport.h}
              onHoverInfo={onHoverInfo}
              onPinInfo={onPinInfo}
              onZoneNodeClick={onZoneNodeClick}
              onTogglePair={onToggleSyzygyPair}
              onClearFocus={clearInfoFocus}
              onRubberBandStart={onCanvasRubberBand}
              onZoomChange={setCanvasZoom}
            />
          </div>
        ) : (
          <div
            data-render-tier="headless"
            className="select-text"
            style={pendingVisible ? { opacity: 0.5, pointerEvents: 'none', transition: 'opacity 0.15s' } : undefined}
          >
            <BigBaseSummary summary={summary} interactiveMaxN={INTERACTIVE_MAX_N} overridden={tierFor(base) !== 'headless'} text={bigBaseText} />
          </div>
        )}
      </div>

      {selectionRect && (
        <div
          className="fixed pointer-events-none z-[55]"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            border: '1px solid rgba(16,255,80,0.85)',
            background: 'rgba(16,255,80,0.12)',
          }}
        />
      )}

      <div
        className="fixed z-[46] font-mono pointer-events-auto"
        style={{ left: panelHeaderLeft, top: 14, width: panelHeaderWidth }}
      >
        <CyberPageHeader
          icon={withBasePath('/ccrug-mark.svg')}
          showHomeLink={false}
          title="CCRUG"
          titleHref="/numogram"
          description={base === 10 ? 'Decimal Labyrinth' : `Base ${base}`}
          actions={(
            // One row that never wraps or overflows: the picker takes the room the four buttons leave and truncates its summary
            // (the full line is its tooltip and stays the Base input's accessible description).
            <div className="flex min-w-0 flex-nowrap items-center gap-1">
              <div className="min-w-0 flex-1">
                <BasePicker
                  base={base}
                  summary={summary}
                  externalRefusal={baseRefusal}
                  onCommitBase={commitBase}
                  labelScheme={labelScheme}
                  onLabelSchemeChange={setLabelScheme}
                  numeralsLayout={layout === 'pairGraph' || layout === 'planetary'}
                  packer={packer}
                  onPackerChange={onPackerChange}
                  packerVisible={layout === 'ring' || layout === 'pairGraph'}
                  requestedBase={pendingBase ?? base}
                  computing={pendingVisible}
                  announcement={announcement}
                />
              </div>
              <button
                className="px-1.5 py-1"
                style={{
                  color: canUndo ? '#6b7280' : '#4b5563',
                  border: `1px solid ${canUndo ? 'rgba(107,114,128,0.35)' : 'rgba(75,85,99,0.25)'}`,
                  background: canUndo ? 'rgba(107,114,128,0.06)' : 'rgba(55,65,81,0.08)',
                  opacity: canUndo ? 1 : 0.45,
                }}
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                aria-label="Undo"
              >
                <UndoIcon clr={canUndo ? '#6b7280' : '#4b5563'} />
              </button>
              <button
                className="px-1.5 py-1"
                style={{
                  color: canRedo ? '#6b7280' : '#4b5563',
                  border: `1px solid ${canRedo ? 'rgba(107,114,128,0.35)' : 'rgba(75,85,99,0.25)'}`,
                  background: canRedo ? 'rgba(107,114,128,0.06)' : 'rgba(55,65,81,0.08)',
                  opacity: canRedo ? 1 : 0.45,
                }}
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Shift+Cmd/Ctrl+Z)"
                aria-label="Redo"
              >
                <RedoIcon clr={canRedo ? '#6b7280' : '#4b5563'} />
              </button>
              <button
                className="px-1.5 py-1"
                style={{
                  color: shareCopied ? '#10ff50' : '#6b7280',
                  border: `1px solid ${shareCopied ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
                  background: shareCopied ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
                  opacity: 1,
                }}
                onClick={onShareExplanation}
                title={namingUncarried ? NAMES_COPY.shareTitleUncarried : NAMES_COPY.shareTitle}
                aria-label="Share current state"
              >
                <ShareIcon clr={shareCopied ? '#10ff50' : '#6b7280'} />
              </button>
              <button
                type="button"
                data-post-baseline=""
                className="px-1.5 py-1"
                style={{
                  color: demonsOpen ? '#10ff50' : '#6b7280',
                  border: `1px solid ${demonsOpen ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
                  background: demonsOpen ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
                }}
                onClick={() => setDemonsOpen(o => !o)}
                title="Browse demons"
                aria-label="Browse demons"
                aria-pressed={demonsOpen}
              >
                <DemonsIcon clr={demonsOpen ? '#10ff50' : '#6b7280'} />
              </button>
            </div>
          )}
        />
      </div>

      {/* === Panels === */}
      <Panel id="layers" title="Layers"
        position={isMobile ? mobilePanelPositions.layers : panelPositions.layers}
        width={mobilePanelWidth}
        zIndex={panelZ.layers}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={layersOpen} onToggle={() => setLayersOpen(o => !o)} onDragStart={startDrag}>
        <LayersPanel layers={layers} toggleLayer={toggleLayer}
          particlesOn={particlesOn} onToggleParticles={() => setParticlesOn(p => !p)} />
      </Panel>

      <Panel id="labels" title="Labels"
        position={isMobile ? mobilePanelPositions.labels : panelPositions.labels}
        width={mobilePanelWidth}
        zIndex={panelZ.labels}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={labelsOpen} onToggle={() => setLabelsOpen(o => !o)} onDragStart={startDrag}>
        <LabelsPanel labels={labelVisibility} onToggleLabel={toggleLabelVisibility} />
      </Panel>

      <Panel id="zones" title="Zones"
        position={isMobile ? mobilePanelPositions.zones : panelPositions.zones}
        width={mobilePanelWidth}
        zIndex={panelZ.zones}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={zonesOpen} onToggle={() => setZonesOpen(o => !o)} onDragStart={startDrag}>
        <ZonesPanel selZones={selZones} hlZones={hlZones}
          onToggleZone={onToggleZone} onToggleAll={onToggleAllZones} onHoverInfo={onHoverInfo} />
      </Panel>

      <Panel id="regions" title="Regions"
        position={isMobile ? mobilePanelPositions.regions : panelPositions.regions}
        width={mobilePanelWidth}
        zIndex={panelZ.regions}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={regionsOpen} onToggle={() => setRegionsOpen(o => !o)} onDragStart={startDrag}>
        <RegionsPanel hlRegion={hlRegion} tcActive={tcActive} filter={regionFilter}
          onSelectRegion={onSelectRegion} onToggleTC={onToggleTC}
          onToggleIsolate={onToggleIsolate} onToggleMute={onToggleMute} />
      </Panel>

      <Panel id="syz" title="Syzygies"
        position={isMobile ? mobilePanelPositions.syz : panelPositions.syz}
        width={mobilePanelWidth}
        zIndex={panelZ.syz}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={syzOpen} onToggle={() => setSyzOpen(o => !o)} onDragStart={startDrag}>
        <SyzygiesPanel selZones={selZones} hlZones={hlZones}
          onToggleSyzygyPair={onToggleSyzygyPair} onHoverInfo={onHoverInfo} />
      </Panel>

      <Panel id="currents" title="Currents"
        position={isMobile ? mobilePanelPositions.currents : panelPositions.currents}
        width={mobilePanelWidth}
        zIndex={panelZ.currents}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={currentsOpen} onToggle={() => setCurrentsOpen(o => !o)} onDragStart={startDrag}>
        <CurrentsPanel selZones={selZones} hlZones={hlZones} onHoverInfo={onHoverInfo}
          onSelectCurrent={onSelectCurrent} />
      </Panel>

      <Panel id="gates" title="Gates"
        position={isMobile ? mobilePanelPositions.gates : panelPositions.gates}
        width={mobilePanelWidth}
        zIndex={panelZ.gates}
        draggable={!isMobile}
        collapseDirection="vertical"
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={gatesOpen} onToggle={() => setGatesOpen(o => !o)} onDragStart={startDrag}>
        <GatesPanel hlZones={hlZones} selZones={selZones} onHoverInfo={onHoverInfo}
          onSelectGate={onSelectGate} onToggleAll={onToggleAllZones} />
      </Panel>

      {hasDiagram && (
        <Panel id="text" title="Text"
          postBaseline
          position={isMobile ? mobilePanelPositions.text : panelPositions.text}
          width={isMobile ? mobilePanelWidth : INFO_PANEL_WIDTH}
          zIndex={panelZ.text}
          draggable={!isMobile}
          collapseDirection="vertical"
          onHeightChange={onPanelHeight}
          onActivate={activatePanel}
          open={textOpen} onToggle={() => setTextOpen(o => !o)} onDragStart={startDrag}>
          <div className="px-3 pb-2.5 select-text">
            <TextView text={panelText} />
          </div>
        </Panel>
      )}

      {/* === Selection Panel === */}
      <Panel
        id="info"
        title="Selection"
        position={isMobile ? mobilePanelPositions.info : panelPositions.info}
        width={infoPanelWidth}
        zIndex={panelZ.info}
        draggable={!isMobile}
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        onDragStart={startDrag}
        showToggle={false}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span
            className="text-[8px] tracking-[0.25em] uppercase"
            style={{ color: '#10ff50' }}
          >
            {`Selected Elements${selectedInfos.length > 0 ? ` (${selectedInfos.length})` : ''}`}
          </span>
          <button
            className="ml-auto text-[8px] uppercase tracking-[0.15em] px-2 py-1"
            style={{
              color: selZones.size > 0 ? '#6b7280' : '#4b5563',
              border: `1px solid ${selZones.size > 0 ? 'rgba(107,114,128,0.35)' : 'rgba(75,85,99,0.25)'}`,
              background: selZones.size > 0 ? 'rgba(107,114,128,0.06)' : 'rgba(55,65,81,0.08)',
              opacity: selZones.size > 0 ? 1 : 0.45,
            }}
            onClick={onClearSelection}
            disabled={selZones.size === 0}
          >
            clear
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '52vh' }}>
          <InfoDisplay
            hoverInfo={null}
            pinnedInfo={pinnedInfo}
            selectedInfos={selectedInfos}
            onRemoveSelectedInfo={onRemoveSelectedInfo}
            onHoverSelectedInfo={onHoverInfo}
          />
        </div>
      </Panel>

      {/* === Names Panel (Phase 7, D-01) ===
          Mounted at EVERY tier and base (no hasDiagram guard): the naming state always exists, and the panel depends on the base only.
          Directly under Selection on desktop, first in the mobile stack; collapsed on first load. Its height reaches both stacks through
          onPanelHeight, and its body room keeps an open box above the zoom toolbar and the shortcuts button. */}
      <Panel id="names" title="Names"
        postBaseline
        position={namesPos}
        width={isMobile ? mobilePanelWidth : NAMES_PANEL_WIDTH}
        zIndex={panelZ.names}
        draggable={!isMobile}
        collapseDirection="vertical"
        maxBodyHeight={namesBodyRoom}
        headerRight={<NamesHeaderTag />}
        onHeightChange={onPanelHeight}
        onActivate={activatePanel}
        open={namesOpen} onToggle={() => setNamesOpen(o => !o)} onDragStart={startDrag}>
        <NamesPanel open={namesOpen} bodyMax={namesBodyRoom} pinnedMesh={pinnedDemonMesh} pinnedZone={pinnedZone} />
      </Panel>

      {hasDiagram && (
        <ViewControls
          zoom={renderTier === 'canvas' ? canvasZoom : zoom}
          onZoomIn={renderTier === 'canvas' ? () => canvasRef.current?.zoomIn() : () => setZoom(zoom * 1.25)}
          onZoomOut={renderTier === 'canvas' ? () => canvasRef.current?.zoomOut() : () => setZoom(zoom / 1.25)}
          onFit={fitAll}
          demonFocusMode={demonFocusMode}
          onToggleDemonFocus={onToggleDemonFocus}
        />
      )}

      <button
        className="fixed bottom-3 right-3 z-[74] px-2.5 py-1 text-[8px] uppercase tracking-[0.17em]"
        style={{
          color: shortcutsOpen ? '#10ff50' : '#6b7280',
          border: `1px solid ${shortcutsOpen ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
          background: shortcutsOpen ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
        }}
        onClick={() => setShortcutsOpen(open => !open)}
      >
        shortcuts
      </button>

      {demonsOpen && (
        <DemonsOverlay
          isMobile={isMobile}
          tab={demonTab}
          onTabChange={setDemonTab}
          filter={demonFilter}
          onFilterChange={setDemonFilter}
          focus={demonFocus}
          onFocusChange={onDemonFocusChange}
          showDiagram={hasDiagram}
          hoverInfo={hoverInfo}
          pinnedInfo={pinnedInfo}
          onHoverInfo={onHoverInfo}
          onPinInfo={onPinInfo}
          onClose={onCloseDemons}
        />
      )}

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
    </NamingContext.Provider>
    </NumogramViewContext.Provider>
  )
}

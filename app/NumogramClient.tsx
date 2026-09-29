'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// Data
import type { Layout, Layer, Pos, HoverInfo, LabelVisibility } from './data/types'
import { PLANETARY_DEFAULT_ANGLE, PLANETARY_SIZE } from './data/positions'

// Engine (base-generic layout plumbing, 04-11)
import { createNumogram, routePairGraph } from '../engine/index'
import type { Packer, PairGraphLayout, RenderTier } from '../engine/index'

// Lib
import { getAnglesForDate, computePlanetaryPositions } from './lib/planetary'
import { buildNumogramTitle } from './lib/shareTitle'
import { withBasePath } from './lib/basePath'
import { buildNumogramView, summarize } from './lib/numogramView'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel, zoneLabelsFor } from './lib/labelScheme'
import type { LabelScheme } from './lib/labelScheme'
import { ALL_CHORDS_MAX_N, SVG_RICH_MAX_N, gateMode, labelsShown, mayTween, tierFor } from './lib/tierBounds'
import { DIAGRAM_CSS_WIDTH, layoutTarget } from './lib/viewLayouts'
import { engineRenderData, frameLayout } from './lib/renderData'
import { isPresetLayoutId, LAYOUT_LABELS, layoutIdsForBase, layoutShortcut } from './lib/layoutIds'
import type { ViewLayoutId } from './lib/layoutIds'
import { EMPTY_REGION_FILTER, isRegionId, regionFilterActive, sanitizeRegionFilter, toggleIsolate, toggleMute, zonesOfRegion, zoneStates as computeZoneStates } from './lib/regions'
import type { RegionFilter, RegionId } from './lib/regions'
import { buildShareParams, DEFAULT_LAYERS, parseShareParams } from './lib/shareParams'
import type { ShareState } from './lib/shareParams'
import { refusalFromUrl } from './lib/basePicker'
import { numogramText } from './lib/numogramText'
import { sessionAfterBaseSwitch } from './lib/baseSwitch'

// Presets
import { BASE10 } from './presets/base10/numogram'
import { base10CurrentRender, base10GateRender } from './presets/base10/routes'

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
import { BasePicker } from './components/numogram/BasePicker'
import { BigBaseSummary } from './components/numogram/BigBaseSummary'
import { TextView } from './components/numogram/TextView'
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
  UndoIcon, RedoIcon, ShareIcon,
} from './components/numogram/NumogramIcons'
import { ShortcutsModal } from './components/numogram/ShortcutsModal'
import { SourcesFooter } from './components/numogram/SourcesFooter'
import { CyberPageHeader } from './components/ui/CyberPageHeader'
import { NumogramViewContext } from './components/numogram/ViewContext'
import type { NumogramViewContextValue } from './components/numogram/ViewContext'

/* ═══════════════════════════════════════════════════════════════
   THE NUMOGRAM — The Decimal Labyrinth (CCRU)
   ═══════════════════════════════════════════════════════════════ */

const MOBILE_SELECTOR_BREAKPOINT = 820
const PANEL_GROUP_ORDER = ['layers', 'labels', 'zones', 'regions', 'syz', 'currents', 'gates', 'text'] as const
type PanelId = (typeof PANEL_GROUP_ORDER)[number]
const PANEL_GROUP_DEFAULT_HEIGHTS: Record<PanelId, number> = {
  layers: 34,
  labels: 34,
  zones: 34,
  regions: 34,
  syz: 34,
  currents: 34,
  gates: 34,
  text: 34,
}
const DESKTOP_PANEL_BASE_Y = 64
const DESKTOP_PANEL_GAP = 18
const DESKTOP_PANEL_LEFT_X = 12
const DESKTOP_PANEL_RIGHT_X = 216
const PANEL_WIDTH = 180
const INFO_PANEL_WIDTH = 320
const MAX_HISTORY_ENTRIES = 80

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

  const svgWrapRef = useRef<HTMLDivElement>(null)
  const selectionAdditiveRef = useRef(false)
  const suppressNextCanvasClickRef = useRef(false)
  const desktopPanelLayoutInitRef = useRef(false)
  const infoPanelInitRef = useRef(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
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
  const g = useMemo(() => createNumogram(base), [base])
  const summary = useMemo(() => summarize(g), [g])
  // Above the measured SVG tier, no view/layout/render structure is ever built (D-16, T-04-08): only the O(1)
  // summary and the bounded text view.
  const showDiagram = tierFor(base, tierOverride) === 'svg'
  const view = useMemo(() => (showDiagram ? buildNumogramView(g) : null), [g, showDiagram])
  const zoneLabels = useMemo(() => (view ? zoneLabelsFor(base, labelScheme) : null), [view, base, labelScheme])

  // ── Hooks ──────────────────────────────────────────────────
  const reducedMotion = useReducedMotion()
  const { planetaryAngles, setPlanetaryAngles, orbiting, setOrbiting, onDateUpdateRef } = useOrbitalAnimation(layout, PLANETARY_DEFAULT_ANGLE, reducedMotion)
  const planetaryPos = useMemo(() => computePlanetaryPositions(planetaryAngles), [planetaryAngles])
  const target = useMemo(
    () => (view ? layoutTarget(g, layout, packer, planetaryPos) : null),
    [view, g, layout, packer, planetaryPos],
  )
  // useLayoutTween must be called every render (rules of hooks); above the SVG tier target is null and the hook
  // runs on the cheap module-level FALLBACK_TARGET instead, its output unused.
  const { pos, ctr, svgWidth, svgHeight, tweening, switchLayout, jumpToTarget } = useLayoutTween(target ?? FALLBACK_TARGET, mayTween(g.zoneCount) && !reducedMotion)
  const parallax = useParallax()
  const {
    positions: panelPositions,
    zIndexes: panelZ,
    activatePanel,
    startDrag,
    canvasPan,
    setCanvasPan,
    setPanelPositions,
    startCanvasDrag,
  } = usePanelDrag()
  const { positions: mobilePanelPositions, onItemHeight: onMobilePanelHeight } = usePanelGroupLayout<PanelId>({
    order: PANEL_GROUP_ORDER,
    defaultHeights: PANEL_GROUP_DEFAULT_HEIGHTS,
    baseX: 8,
    baseY: 64,
    gap: 6,
  })
  const { zoom, zoomOrigin, setZoom, setZoomOrigin } = useCanvasZoom(svgWrapRef)
  const orbitStartDateRef = useRef<Date | null>(null)
  const urlHydratedRef = useRef(false)
  const pendingShareSelectionRef = useRef<number[] | null>(null)
  const skipFirstUrlSyncRef = useRef(true)
  const lastSyncedQueryRef = useRef('')
  const historyReadyRef = useRef(false)
  const historyCurrentRef = useRef<HistorySnapshot | null>(null)
  const historyApplyingRef = useRef(false)
  const currentOrientationRef = useRef<Record<string, 1 | -1>>({})
  const planetaryDateInputRef = useRef<HTMLInputElement | null>(null)
  const dateFieldWasVisibleRef = useRef(false)

  // ── View context (MIG-02, UI-03) ─────────────────────────────
  const zoneGateMode: 'on' | 'thin' | 'off' = target ? (target.preset ? 'on' : gateMode(g.zoneCount)) : 'off'
  const viewCtx = useMemo<NumogramViewContextValue>(() => ({
    base,
    g,
    summary,
    view,
    zoneLabels,
    labelScheme,
    zoneLabel: z => formatZoneLabel(z, base, labelScheme),
    svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N,
    gateMode: zoneGateMode,
  }), [base, g, summary, view, zoneLabels, labelScheme, zoneGateMode])

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
  }), [base, layout, layers, selZones, hlRegion, tcActive, particlesOn, planetDate, showOrbits, labelScheme, regionFilter, packer, tierOverride])

  const snapshotState = useCallback((): HistorySnapshot => ({
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
  }), [base, layout, layers, selZones, hlRegion, tcActive, particlesOn, showOrbits, planetDate, orbiting, labelVisibility, labelScheme, packer, regionFilter])

  const snapshotKey = useCallback((snapshot: HistorySnapshot): string => {
    return JSON.stringify(snapshot)
  }, [])

  const applySnapshot = useCallback((snapshot: HistorySnapshot) => {
    // UI-08: a snapshot from a different base can never be restored (its zone/region ids don't exist at the current
    // base) — commitBase always clears both history stacks on a switch, so this is a defensive guard, not the
    // primary mechanism.
    if (snapshot.base !== base) return
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
    setRegionFilter(sanitizeRegionFilter({
      isolate: new Set(snapshot.isolate as RegionId[]),
      mute: new Set(snapshot.mute as RegionId[]),
    }, g))

    if (snapshot.layout === 'planetary') {
      if (snapshot.planetDate) {
        setPlanetaryAngles(getAnglesForDate(new Date(`${snapshot.planetDate}T12:00:00`)))
      } else if (!snapshot.orbiting) {
        setPlanetaryAngles(PLANETARY_DEFAULT_ANGLE)
      }
    }
  }, [base, layout, switchLayout, jumpToTarget, setPlanetaryAngles, setOrbiting, g])

  // UI-08: the base picker's one commit path. Everything base-shaped resets in a single batched event-handler call
  // (React batches all these setters into one render with the new base) so no intermediate render ever shows a
  // selection, region highlight or history entry belonging to the previous base.
  const commitBase = useCallback((n: number) => {
    if (n === base) return
    const next = sessionAfterBaseSwitch(
      {
        layout, selected: [...selZones], hlRegion, tcActive, orbiting, pinned: pinnedInfo !== null,
        isolate: [...regionFilter.isolate], mute: [...regionFilter.mute],
      },
      n,
    )
    jumpToTarget()
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
    setLayout(next.layout)
    setBaseRefusal(null)
    setCanvasPan({ x: 0, y: 0 })
    setZoom(1)
    setZoomOrigin({ x: 50, y: 50 })
    setBase(n)
  }, [
    base, layout, selZones, hlRegion, tcActive, orbiting, pinnedInfo, regionFilter, jumpToTarget,
    setCanvasPan, setZoom, setZoomOrigin, setOrbiting,
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
    const svgEl = svgWrapRef.current?.querySelector('svg')
    const svgRect = svgEl?.getBoundingClientRect()
    const rightOfDiagram = svgRect ? Math.round(svgRect.right + gap) : maxLeft
    const left = Math.max(margin, Math.min(rightOfDiagram, maxLeft))

    setPanelPositions(prev => ({
      ...prev,
      info: { x: left, y: DESKTOP_PANEL_BASE_Y },
    }))
    infoPanelInitRef.current = true
  }, [viewport.w, setPanelPositions])

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
    if (newLayout === layout) return
    if (newLayout === 'pairGraph' || layout === 'pairGraph') jumpToTarget()
    else switchLayout()
    setLayout(newLayout)
  }, [layout, switchLayout, jumpToTarget])

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

  const fitSelectionToView = useCallback((zones: number[]) => {
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
  }, [pos, svgWidth, svgHeight, setCanvasPan, setZoomOrigin, setZoom, viewport.w, viewport.h])
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

    const svgEl = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null
    const ctm = svgEl?.getScreenCTM()
    if (!svgEl || !ctm) {
      setSelectionStart(null)
      setSelectionNow(null)
      return
    }

    const selected = new Set<number>()
    for (let z = 0; z < g.zoneCount; z++) {
      const pt = svgEl.createSVGPoint()
      pt.x = pos[z].x
      pt.y = pos[z].y
      const sp = pt.matrixTransform(ctm)
      if (sp.x >= left && sp.x <= right && sp.y >= top && sp.y <= bottom) {
        selected.add(z)
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
    suppressNextCanvasClickRef.current = true
    setSelectionStart(null)
    setSelectionNow(null)
  }, [selectionStart, pos, g])

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
      setUrlSyncReady(true)
      return
    }

    const { state, baseRefusal: refusal } = parseShareParams(window.location.search)
    if (refusal) setBaseRefusal(refusalFromUrl(refusal.raw, refusal.check, 10))

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
  }, [setPlanetaryAngles, setOrbiting])

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

    const query = buildShareParams(currentShareState(), { includeLayoutAlways: false }).toString()
    if (skipFirstUrlSyncRef.current) {
      skipFirstUrlSyncRef.current = false
      lastSyncedQueryRef.current = query
      return
    }
    if (query === lastSyncedQueryRef.current) return

    const url = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState(window.history.state, '', url)
    lastSyncedQueryRef.current = query
  }, [urlSyncReady, currentShareState])

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
      if (prev.size === g.zoneCount) return new Set()
      const all = new Set<number>()
      for (let z = 0; z < g.zoneCount; z++) all.add(z)
      return all
    })
    setHlRegion(null)
  }, [g])

  const onToggleTC = useCallback(() => {
    setTcActive(prev => !prev)
    setHlRegion(null)
  }, [])

  const onSelectCurrent = useCallback((from: number, to: number) => {
    setSelZones(prev => toggleTerminalSelection(prev, [from, g.partner(from), to]))
  }, [g])

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
        next.delete(g.partner(info.data.from))
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
  }, [g])

  const onZoneNodeClick = useCallback((zone: number) => {
    setSelZones(prev => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
  }, [])

  useEffect(() => {
    const currentSnapshot = snapshotState()

    if (!historyReadyRef.current) {
      historyReadyRef.current = true
      historyCurrentRef.current = currentSnapshot
      return
    }

    const previousSnapshot = historyCurrentRef.current
    if (!previousSnapshot) {
      historyCurrentRef.current = currentSnapshot
      return
    }

    if (snapshotKey(previousSnapshot) === snapshotKey(currentSnapshot)) return

    if (historyApplyingRef.current) {
      historyApplyingRef.current = false
      historyCurrentRef.current = currentSnapshot
      return
    }

    if (orbiting) {
      historyCurrentRef.current = currentSnapshot
      return
    }

    setUndoStack(prev => {
      const next = [...prev, previousSnapshot]
      return next.length > MAX_HISTORY_ENTRIES
        ? next.slice(next.length - MAX_HISTORY_ENTRIES)
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
    setUndoStack(remaining)
    if (current) {
      setRedoStack(next => [current, ...next].slice(0, MAX_HISTORY_ENTRIES))
    }
    historyApplyingRef.current = true
    historyCurrentRef.current = target
    applySnapshot(target)
  }, [undoStack, applySnapshot])

  const onRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const [target, ...remaining] = redoStack
    const current = historyCurrentRef.current
    setRedoStack(remaining)
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
    applySnapshot(target)
  }, [redoStack, applySnapshot])

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
        setSelZones(new Set())
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
  }, [layout, planetDate, base, view, onSelectGate, onUndo, onRedo, shortcutsOpen])

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
    ? mobilePanelWidth
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

  useEffect(() => {
    if (desktopPanelLayoutInitRef.current) return
    if (!isDesktop) return

    const layersH = desktopPanelHeights.layers
    const labelsH = desktopPanelHeights.labels
    const zonesH = desktopPanelHeights.zones
    const regionsH = desktopPanelHeights.regions
    const currentsH = desktopPanelHeights.currents
    if (!(layersH && labelsH && zonesH && regionsH && currentsH)) return

    const labelsY = DESKTOP_PANEL_BASE_Y + layersH + DESKTOP_PANEL_GAP
    const zonesY = labelsY + labelsH + DESKTOP_PANEL_GAP
    const syzY = zonesY + zonesH + DESKTOP_PANEL_GAP
    const currentsY = DESKTOP_PANEL_BASE_Y + regionsH + DESKTOP_PANEL_GAP
    const gatesY = currentsY + currentsH + DESKTOP_PANEL_GAP

    setPanelPositions(prev => ({
      ...prev,
      layers: { x: DESKTOP_PANEL_LEFT_X, y: DESKTOP_PANEL_BASE_Y },
      labels: { x: DESKTOP_PANEL_LEFT_X, y: Math.round(labelsY) },
      zones: { x: DESKTOP_PANEL_LEFT_X, y: Math.round(zonesY) },
      syz: { x: DESKTOP_PANEL_LEFT_X, y: Math.round(syzY) },
      regions: { x: DESKTOP_PANEL_RIGHT_X, y: DESKTOP_PANEL_BASE_Y },
      currents: { x: DESKTOP_PANEL_RIGHT_X, y: Math.round(currentsY) },
      gates: { x: DESKTOP_PANEL_RIGHT_X, y: Math.round(gatesY) },
      text: { x: DESKTOP_PANEL_RIGHT_X, y: Math.round(gatesY + (desktopPanelHeights.gates ?? 34) + DESKTOP_PANEL_GAP) },
    }))
    desktopPanelLayoutInitRef.current = true
  }, [desktopPanelHeights, isDesktop, setPanelPositions])

  // Isolate/mute render filter (UI-05, D-19..D-24): built only when the filter is non-empty and there is a view to
  // filter (SVG tier, D-16); null means "render exactly as before" to both diagrams.
  const zoneStateArr = useMemo(
    () => (view && regionFilterActive(regionFilter) ? computeZoneStates(g, regionFilter) : null),
    [view, g, regionFilter],
  )

  const hlZones = useMemo(() => {
    if (tcActive) return new Set(view ? view.torqueZones : [])
    if (hlRegion && isRegionId(hlRegion, g)) {
      return new Set(zonesOfRegion(g, hlRegion))
    }
    if (hoverInfo?.type === 'gate') {
      return new Set<number>([hoverInfo.gate.from, hoverInfo.gate.to])
    }
    const s = new Set<number>(selZones)
    if (hoverInfo) {
      switch (hoverInfo.type) {
        case 'zone': s.add(hoverInfo.zone); break
        case 'syzygy': s.add(hoverInfo.data.a); s.add(hoverInfo.data.b); break
        case 'current': {
          const c = hoverInfo.data
          s.add(c.from); s.add(g.partner(c.from)); s.add(c.to); break
        }
        case 'demon': s.add(hoverInfo.demon.a); s.add(hoverInfo.demon.b); break
      }
    }
    return s
  }, [hoverInfo, selZones, hlRegion, tcActive, view, g])

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
        const partner = g.partner(c.from)
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
  }, [selZones, layers, view, g])

  const onShareExplanation = useCallback(async () => {
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
  }, [layout, selZones, layers, hlRegion, tcActive, particlesOn, planetDate, showOrbits, base, currentShareState])

  const anyFocus = hlZones.size > 0

  const zoneRadius = useCallback((z: number) => (layout === 'planetary' ? PLANETARY_SIZE[z] : 21), [layout])

  // Base-10 presets render through the authored path (byte-identical to the frozen goldens); every procedural
  // layout and the pair graph render through the engine's own routing (LAY-01..04, UI-06). All of these run only
  // when view/target are non-null (i.e. within the SVG tier, D-16): above it nothing here is ever built.
  const presetGates = useMemo(
    () => (view && target && target.preset
      ? base10GateRender({ layout: layout as Layout, pos, ctr, g, gates: view.gates, currents: view.currents, syzygies: view.syzygies, zoneRadius })
      : null),
    [view, target, layout, pos, ctr, g, zoneRadius],
  )
  const presetCurrents = useMemo(
    () => (view && target && target.preset
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
    () => (target && target.pairGraph && target.layout ? routePairGraph(g, target.layout as PairGraphLayout) : null),
    [g, target],
  )

  const zoneOrder = useMemo(() => {
    if (!target) return []
    return target.drawOrder ? [...target.drawOrder] : Array.from({ length: g.zoneCount }, (_, z) => z).sort((a, b) => pos[a].y - pos[b].y)
  }, [target, g, pos])
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

  // D-14/D-16: the big-base fallback's text view, bounded internally (TEXT_VIEW_ZONE_LIMIT) so it stays cheap at
  // any base; empty (and unused) while the diagram is shown.
  const bigBaseText = useMemo(
    () => (showDiagram ? '' : numogramText(g, z => formatZoneLabel(z, base, labelScheme))),
    [showDiagram, g, base, labelScheme],
  )

  // The Text panel's copy (UI-07): only built at the SVG tier, since above it BigBaseSummary already carries the
  // text view (bigBaseText, above) and the panel itself is hidden.
  const panelText = useMemo(
    () => (showDiagram ? numogramText(g, z => formatZoneLabel(z, base, labelScheme)) : ''),
    [showDiagram, g, base, labelScheme],
  )

  // ── Render ─────────────────────────────────────────────────
  return (
    <NumogramViewContext.Provider value={viewCtx}>
    <div className="h-screen overflow-hidden bg-[#060609] text-gray-300 flex flex-col items-center justify-center px-4 py-8 font-mono select-none relative">
      {/* === Fixed top bar === */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-3 pb-1 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, #060609 60%, transparent 100%)' }}
      >
        <div className="pointer-events-auto flex flex-col items-center">
          <ButtonSet>
            {layoutIdsForBase(g.base).map(id => {
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
                  shortcut={layoutShortcut(id, g.base) ?? undefined}
                  postBaseline={!(g.base === 10 && isPresetLayoutId(id, 10))}
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
          <div className="flex justify-center w-full" style={{
            transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
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
                  g={g}
                  view={view}
                  layout={target.layout as PairGraphLayout}
                  routes={pairRoutes!}
                  zoneLabels={zoneLabels!}
                  selZones={selZones}
                  hlZones={hlZones}
                  anyFocus={anyFocus}
                  labelsOn={labelsOn}
                  pairStates={zoneStateArr ? Uint8Array.from({ length: g.pairCount }, (_, q) => zoneStateArr[q]) : null}
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
                  onHoverInfo={onHoverInfo}
                  onPinInfo={onPinInfo}
                  onZoneNodeClick={onZoneNodeClick}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="select-text">
            <BigBaseSummary summary={summary} svgRichMaxN={SVG_RICH_MAX_N} text={bigBaseText} />
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
            <div className="flex flex-wrap items-center gap-1">
              <BasePicker
                base={base}
                summary={summary}
                externalRefusal={baseRefusal}
                onCommitBase={commitBase}
                labelScheme={labelScheme}
                onLabelSchemeChange={setLabelScheme}
                packer={packer}
                onPackerChange={onPackerChange}
                packerVisible={layout === 'ring' || layout === 'pairGraph'}
              />
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
                title="Share current state"
                aria-label="Share current state"
              >
                <ShareIcon clr={shareCopied ? '#10ff50' : '#6b7280'} />
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

      {showDiagram && (
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
        position={isMobile
          ? { x: 8, y: viewport.h > 0 ? Math.max(64, viewport.h - 320) : 64 }
          : panelPositions.info}
        width={infoPanelWidth}
        zIndex={panelZ.info}
        draggable={!isMobile}
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

      <SourcesFooter />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
    </NumogramViewContext.Provider>
  )
}

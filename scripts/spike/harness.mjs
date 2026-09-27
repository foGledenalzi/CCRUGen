// Ceiling spike harness (REN-01): runs the committed engine in the page; loaded by scripts/spike/driver.ts.
// Plain browser ES module (never type-checked, never linted; scripts/spike/driver.ts serves it as-is).

import { createNumogram } from '/engine/core/numogram'
import { lerpPositions, ringLayout, routeCurrents, routeGates, spiralLayout } from '/engine/layout/index'

const h = React.createElement

// -----------------------------------------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------------------------------------

/** One requestAnimationFrame, as a promise (uncapped: the driver launches Chromium with --disable-frame-rate-limit
 *  --disable-gpu-vsync, so this reflects real frame cost rather than the display's vsync interval). */
function raf() {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

function round3(v) {
  return Math.round(v * 1000) / 1000
}

/** Median and p95 of a sample array, rounded to 3 decimals; null for an empty/missing sample list. */
function stats(samples) {
  if (!samples || samples.length === 0) return null
  const sorted = samples.slice().sort((a, b) => a - b)
  const len = sorted.length
  const median = sorted[Math.floor(0.5 * len)]
  const p95 = sorted[Math.min(len - 1, Math.floor(0.95 * len))]
  return { median: round3(median), p95: round3(p95) }
}

/** n-independent palette per cycle kind (Plex/Warp fixed, Torque cycles a golden-angle hue rotation). */
function paletteOf(kind, torqueIndex) {
  if (kind === 'plex') return '#cc8844'
  if (kind === 'warp') return '#44cc77'
  const hue = Math.round((190 + torqueIndex * 137.508) % 360)
  return `hsl(${hue} 75% 62%)`
}

// -----------------------------------------------------------------------------------------------------------
// Task 1: environment probes
// -----------------------------------------------------------------------------------------------------------

/** The spike's CPU calibration probe: a 3e7-iteration Math.sqrt loop (research: 4.14x measured at CDP rate 4,
 *  6.35x at rate 6). */
function calib() {
  const t0 = performance.now()
  let x = 0
  for (let i = 0; i < 3e7; i++) x += Math.sqrt(i)
  const t1 = performance.now()
  if (x < 0) console.log(x) // keeps the loop live under any optimizer; Math.sqrt of a non-negative i is never < 0
  return round3(t1 - t0)
}

/** The WEBGL_debug_renderer_info UNMASKED_RENDERER_WEBGL string of a throwaway context, or null. */
function rendererInfo() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return null
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
  } catch {
    return null
  }
}

/** Canvas width/height/area probes: per [w, h], can the corner pixel actually be written and read back. */
function probeCanvas(list) {
  return list.map(([w, h]) => {
    let ok = false
    const canvas = document.createElement('canvas')
    try {
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(w - 1, h - 1, 1, 1)
      const data = ctx.getImageData(w - 1, h - 1, 1, 1).data
      ok = canvas.width === w && canvas.height === h && data[3] === 255
    } catch {
      ok = false
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
    return { width: w, height: h, ok }
  })
}

/** Precise DOM/JS memory (Chrome 89+, resolves only on a cross-origin-isolated page); null otherwise. */
async function memory() {
  if (!self.crossOriginIsolated || typeof performance.measureUserAgentSpecificMemory !== 'function') return null
  const result = await performance.measureUserAgentSpecificMemory()
  let dom = 0
  for (const b of result.breakdown) {
    if (b.types.includes('DOM')) dom += b.bytes
  }
  return { total: result.bytes, dom }
}

// -----------------------------------------------------------------------------------------------------------
// Task 2: the real scene (ring + spiral + their routes), built once per n and kept in module state
// -----------------------------------------------------------------------------------------------------------

/** @type {{ g: any, n: number, ring: any, ringGates: any, ringCurrents: any, spiral: any, spiralGates: any,
 *           spiralCurrents: any, computeMs: number } | null} */
let scene = null

/** Times createNumogram + ringLayout + its routes (computeMs); also builds the spiral layout and its own routes
 *  so a tween frame can reuse the destination (spiral) orientation (Pitfall 6). */
function build(n) {
  const t0 = performance.now()
  const g = createNumogram(n)
  const ring = ringLayout(g)
  const ringGates = routeGates(g, ring)
  const ringCurrents = routeCurrents(g, ring)
  const t1 = performance.now()
  const spiral = spiralLayout(g)
  const spiralGates = routeGates(g, spiral)
  const spiralCurrents = routeCurrents(g, spiral)
  scene = { g, n, ring, ringGates, ringCurrents, spiral, spiralGates, spiralCurrents, computeMs: round3(t1 - t0) }
  return { computeMs: scene.computeMs }
}

// -----------------------------------------------------------------------------------------------------------
// SVG tiers (React 18, matching Projection.tsx's element density for 'rich'; a stripped 'lean' variant)
// -----------------------------------------------------------------------------------------------------------

const host = document.getElementById('host')
host.style.cssText = 'width:1000px;height:800px;overflow:hidden;position:relative;transform-origin:50% 50%'
let root = null
function ensureRoot() {
  if (!root) root = ReactDOM.createRoot(host)
  return root
}

function NOOP() {}

function svgDefs() {
  return h(
    'defs',
    { key: 'defs' },
    h('filter', { id: 'gl', key: 'f' }, h('feGaussianBlur', { stdDeviation: 3 })),
    h(
      'marker',
      { id: 'ac', key: 'mac', viewBox: '0 0 8 6', refX: 7, refY: 3, markerWidth: 9, markerHeight: 7, orient: 'auto' },
      h('path', { d: 'M0,.5L7,3L0,5.5', fill: '#22ee66' }),
    ),
    h(
      'marker',
      { id: 'ag', key: 'mag', viewBox: '0 0 8 6', refX: 7, refY: 3, markerWidth: 8, markerHeight: 6, orient: 'auto' },
      h('path', { d: 'M0,.5L7,3L0,5.5', fill: '#cc44ff' }),
    ),
  )
}

function gateGroup(detail, g, layout, gateRoutes, hl) {
  const n = layout.base
  const sw = layout.strokeScale
  const items = []
  for (let z = 0; z < n; z++) {
    const d = gateRoutes.d[z] ?? ''
    if (detail === 'rich') {
      const highlighted = hl === z || hl === gateRoutes.to[z]
      items.push(
        h(
          'g',
          { key: `gt${z}` },
          h('path', {
            d,
            fill: 'none',
            stroke: '#cc44ff',
            strokeWidth: 0.7 * sw,
            strokeDasharray: `${5 * sw} ${3 * sw}`,
            markerEnd: 'url(#ag)',
            opacity: highlighted ? 1 : 0.45,
            filter: highlighted ? 'url(#gl)' : undefined,
          }),
          h('path', {
            d,
            stroke: 'transparent',
            strokeWidth: 12 * sw,
            fill: 'none',
            onMouseEnter: NOOP,
            onMouseLeave: NOOP,
          }),
        ),
      )
    } else {
      items.push(
        h('path', { key: `gt${z}`, d, fill: 'none', stroke: '#cc44ff', strokeWidth: 0.7 * sw, strokeDasharray: `${5 * sw} ${3 * sw}`, opacity: 0.45 }),
      )
    }
  }
  return h('g', { key: 'gates' }, ...items)
}

function currentGroup(detail, g, layout, currentRoutes) {
  const P = g.pairCount
  const sw = layout.strokeScale
  const items = []
  for (let q = 0; q < P; q++) {
    const legA = currentRoutes.legA[q] ?? ''
    const legB = currentRoutes.legB[q] ?? ''
    const stem = currentRoutes.stem[q] ?? ''
    if (detail === 'rich') {
      const jx = currentRoutes.junctionX[q] ?? 0
      const jy = currentRoutes.junctionY[q] ?? 0
      items.push(
        h(
          'g',
          { key: `cu${q}` },
          h('path', { d: legA, fill: 'none', stroke: '#22ee66', strokeWidth: 0.85 * sw }),
          h('path', { d: legB, fill: 'none', stroke: '#22ee66', strokeWidth: 0.85 * sw }),
          h('circle', { cx: jx, cy: jy, r: 3.2 * sw, fill: '#fff', strokeWidth: 0.6 * sw }),
          h('path', { d: stem, fill: 'none', stroke: '#22ee66', strokeWidth: 1.2 * sw, markerEnd: 'url(#ac)' }),
          h('path', { d: legA, stroke: 'transparent', strokeWidth: 14 * sw, fill: 'none', onMouseEnter: NOOP, onMouseLeave: NOOP }),
          h('path', { d: legB, stroke: 'transparent', strokeWidth: 14 * sw, fill: 'none', onMouseEnter: NOOP, onMouseLeave: NOOP }),
          h('path', { d: stem, stroke: 'transparent', strokeWidth: 14 * sw, fill: 'none', onMouseEnter: NOOP, onMouseLeave: NOOP }),
          h(
            'g',
            { key: 'lbl' },
            h('text', { x: jx, y: jy - 6, fontSize: layout.labelSize * 0.4, fill: '#22ee66', textAnchor: 'middle' }, `c${q}`),
            h('text', { x: jx, y: jy + 10, fontSize: layout.labelSize * 0.3, fill: '#22ee66', textAnchor: 'middle', opacity: 0.7 }, String(q)),
          ),
        ),
      )
    } else {
      items.push(
        h(
          'g',
          { key: `cu${q}` },
          h('path', { d: legA, fill: 'none', stroke: '#22ee66', strokeWidth: 0.85 * sw }),
          h('path', { d: legB, fill: 'none', stroke: '#22ee66', strokeWidth: 0.85 * sw }),
          h('path', { d: stem, fill: 'none', stroke: '#22ee66', strokeWidth: 1.2 * sw }),
        ),
      )
    }
  }
  return h('g', { key: 'currents' }, ...items)
}

function syzygyGroup(detail, g, layout) {
  const P = g.pairCount
  const items = []
  for (let q = 0; q < P; q++) {
    const info = g.pair(q)
    const x1 = layout.x[info.lo] ?? 0
    const y1 = layout.y[info.lo] ?? 0
    const x2 = layout.x[info.hi] ?? 0
    const y2 = layout.y[info.hi] ?? 0
    if (detail === 'rich') {
      const dist = Math.hypot(x2 - x1, y2 - y1)
      const dots = Math.max(3, Math.min(10, Math.round(dist / 30)))
      const children = [h('line', { key: 'hit', x1, y1, x2, y2, stroke: 'transparent', strokeWidth: 10, onMouseEnter: NOOP, onMouseLeave: NOOP })]
      for (let i = 0; i < dots; i++) {
        const t = (i + 0.5) / dots
        children.push(h('circle', { key: `d${i}`, cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: 1.4, fill: '#e8e8e8' }))
      }
      items.push(h('g', { key: `sy${q}` }, ...children))
    } else {
      items.push(h('line', { key: `sy${q}`, x1, y1, x2, y2, stroke: '#e8e8e8', strokeWidth: 2, strokeDasharray: '0.1 10', opacity: 0.55 }))
    }
  }
  return h('g', { key: 'syzygies' }, ...items)
}

function gateLabelGroup(g, layout, gateRoutes) {
  const n = layout.base
  const items = []
  for (let z = 0; z < n; z++) {
    const x = gateRoutes.labelX[z] ?? 0
    const y = gateRoutes.labelY[z] ?? 0
    items.push(
      h(
        'g',
        { key: `gl${z}` },
        h('circle', { cx: x, cy: y, r: layout.labelSize * 0.5, fill: '#060609', opacity: 0.6 }),
        h(
          'text',
          { x, y, fontSize: layout.labelSize * 0.4, fontStyle: 'italic', fill: '#cc44ff', textAnchor: 'middle', dominantBaseline: 'central' },
          String(z),
        ),
        h('circle', { cx: x, cy: y, r: layout.labelSize, fill: 'transparent', onMouseEnter: NOOP, onMouseLeave: NOOP }),
      ),
    )
  }
  return h('g', { key: 'gate-labels' }, ...items)
}

function zoneGroup(detail, g, layout, hl) {
  const items = []
  for (const z of layout.drawOrder) {
    const cycle = g.cycleOfZone(z)
    const clr = paletteOf(cycle.kind, cycle.torqueIndex)
    const cx = layout.x[z] ?? 0
    const cy = layout.y[z] ?? 0
    const r = layout.nodeRadii ? (layout.nodeRadii[z] ?? layout.nodeRadius) : layout.nodeRadius
    const highlighted = hl === z
    const children = [
      h('circle', {
        key: 'c',
        cx,
        cy,
        r,
        fill: clr,
        fillOpacity: highlighted ? 0.35 : 0.12,
        stroke: clr,
        strokeOpacity: 0.6,
        strokeWidth: 0.9 * layout.strokeScale,
      }),
      h(
        'text',
        { key: 'lbl', x: cx, y: cy + 1, fontSize: layout.labelSize, fontWeight: 'bold', fill: clr, textAnchor: 'middle', dominantBaseline: 'central' },
        String(z),
      ),
    ]
    if (detail === 'rich') {
      const tw = 0.35 * r
      const th = 0.3 * r
      const ty = cy - r - 0.2 * layout.labelSize
      children.push(h('polygon', { key: 't', points: `${cx - tw},${ty} ${cx + tw},${ty} ${cx},${ty - th}`, fill: clr }))
      children.push(h('circle', { key: 'dot', cx, cy: cy + r + 0.3 * layout.labelSize, r: 0.12 * r, fill: clr }))
    }
    items.push(h('g', { key: `z${z}` }, ...children))
  }
  return h('g', { key: 'zones' }, ...items)
}

/** The full SVG element tree for one frame: defs, gates, currents, syzygies, zones and (rich only) gate labels. */
function svgTree(detail, g, layout, gateRoutes, currentRoutes, hl) {
  const children = [
    svgDefs(),
    gateGroup(detail, g, layout, gateRoutes, hl),
    currentGroup(detail, g, layout, currentRoutes),
    syzygyGroup(detail, g, layout),
    zoneGroup(detail, g, layout, hl),
  ]
  if (detail === 'rich') children.push(gateLabelGroup(g, layout, gateRoutes))
  return h('svg', { viewBox: `0 0 ${layout.width} ${layout.height}`, width: '100%', height: '100%' }, ...children)
}

/** flushSync render, then two rAF (first paint settled). */
async function mountSvg(detail) {
  const { g, ring, ringGates, ringCurrents } = scene
  ensureRoot()
  const t0 = performance.now()
  ReactDOM.flushSync(() => {
    root.render(svgTree(detail, g, ring, ringGates, ringCurrents, -1))
  })
  const t1 = performance.now()
  await raf()
  await raf()
  const t2 = performance.now()
  return { commitMs: round3(t1 - t0), toSecondFrameMs: round3(t2 - t0), domNodes: document.getElementsByTagName('*').length }
}

/** Toggles one zone's highlight `count` times: median of commit (React work only) and toFrame (commit + presented). */
async function hoverSvg(detail, count) {
  const { g, ring, ringGates, ringCurrents } = scene
  const n = ring.base
  const commitSamples = []
  const frameSamples = []
  for (let i = 0; i < count; i++) {
    const z = (i * 7919) % n
    const t0 = performance.now()
    ReactDOM.flushSync(() => {
      root.render(svgTree(detail, g, ring, ringGates, ringCurrents, z))
    })
    const t1 = performance.now()
    await raf()
    const t2 = performance.now()
    commitSamples.push(t1 - t0)
    frameSamples.push(t2 - t0)
    ReactDOM.flushSync(() => {
      root.render(svgTree(detail, g, ring, ringGates, ringCurrents, -1))
    })
    await raf()
  }
  return { commit: stats(commitSamples), toFrame: stats(frameSamples) }
}

/** `frames` frames of a CSS transform: translate + scale on the host, uncapped rAF. */
async function panCss(frames) {
  const samples = []
  for (let i = 0; i < frames; i++) {
    const a = i / frames
    const t0 = performance.now()
    host.style.transform = `translate(${Math.sin(a * 2 * Math.PI) * 120}px, ${Math.cos(a * 2 * Math.PI) * 80}px) scale(${1 + 1.5 * Math.sin(a * Math.PI)})`
    await raf()
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  host.style.transform = ''
  return stats(samples)
}

/** One layout-switch frame per iteration: lerp ring -> spiral at an oscillating t, recompute routes with the
 *  spiral (destination) orientation, flushSync render, uncapped rAF. */
async function tweenSvg(detail, frames) {
  const { g, ring, spiral, spiralGates, spiralCurrents } = scene
  const n = ring.base
  const X = new Float64Array(n)
  const Y = new Float64Array(n)
  const samples = []
  for (let i = 0; i < frames; i++) {
    const cyclePos = i % 10
    const forward = Math.floor(i / 10) % 2 === 0
    const t = forward ? (cyclePos + 1) / 11 : 1 - (cyclePos + 1) / 11
    const t0 = performance.now()
    lerpPositions(ring, spiral, t, X, Y)
    const frameLayout = { ...ring, x: X, y: Y }
    const gateRoutes = routeGates(g, frameLayout, { orientation: spiralGates.orientation })
    const currentRoutes = routeCurrents(g, frameLayout, { orientation: spiralCurrents.orientation })
    ReactDOM.flushSync(() => {
      root.render(svgTree(detail, g, frameLayout, gateRoutes, currentRoutes, -1))
    })
    await raf()
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  return stats(samples)
}

// -----------------------------------------------------------------------------------------------------------
// Canvas tier: static layer cached to an offscreen bitmap, Path2D per route, cached-blit pan/zoom
// -----------------------------------------------------------------------------------------------------------

const CANVAS_W = 1000
const CANVAS_H = 800

/** @type {{ visible: HTMLCanvasElement, offscreen: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null,
 *           paths: unknown } | null} */
let canvasState = null

function ensureCanvas() {
  if (canvasState) return canvasState
  const visible = document.createElement('canvas')
  visible.width = CANVAS_W
  visible.height = CANVAS_H
  host.appendChild(visible)
  canvasState = { visible, offscreen: null, overlay: null, paths: null }
  return canvasState
}

/** One batched Path2D per layer (gates, currents, syzygies, zones), built once from the current route strings. */
function buildPaths(g, layout, gateRoutes, currentRoutes) {
  const n = layout.base
  const P = g.pairCount
  const gatesPath = new Path2D()
  for (let z = 0; z < n; z++) gatesPath.addPath(new Path2D(gateRoutes.d[z] ?? ''))
  const currentsPath = new Path2D()
  for (let q = 0; q < P; q++) {
    currentsPath.addPath(new Path2D(currentRoutes.legA[q] ?? ''))
    currentsPath.addPath(new Path2D(currentRoutes.legB[q] ?? ''))
    currentsPath.addPath(new Path2D(currentRoutes.stem[q] ?? ''))
  }
  const syzygyPath = new Path2D()
  for (let q = 0; q < P; q++) {
    const info = g.pair(q)
    syzygyPath.moveTo(layout.x[info.lo] ?? 0, layout.y[info.lo] ?? 0)
    syzygyPath.lineTo(layout.x[info.hi] ?? 0, layout.y[info.hi] ?? 0)
  }
  const zonesPath = new Path2D()
  for (let z = 0; z < n; z++) {
    const cx = layout.x[z] ?? 0
    const cy = layout.y[z] ?? 0
    const r = layout.nodeRadii ? (layout.nodeRadii[z] ?? layout.nodeRadius) : layout.nodeRadius
    zonesPath.moveTo(cx + r, cy)
    zonesPath.arc(cx, cy, r, 0, Math.PI * 2)
  }
  return { gatesPath, currentsPath, syzygyPath, zonesPath }
}

function paintStatic(ctx, layout, paths) {
  const fit = Math.min(CANVAS_W / layout.width, CANVAS_H / layout.height)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#060609'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2)
  ctx.scale(fit, fit)
  ctx.translate(-layout.width / 2, -layout.height / 2)
  ctx.strokeStyle = '#cc44ff'
  ctx.lineWidth = 0.7 * layout.strokeScale
  ctx.stroke(paths.gatesPath)
  ctx.strokeStyle = '#22ee66'
  ctx.lineWidth = 0.85 * layout.strokeScale
  ctx.stroke(paths.currentsPath)
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = '#e8e8e8'
  ctx.lineWidth = 2 * layout.strokeScale
  ctx.stroke(paths.syzygyPath)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#59c1ff'
  ctx.fill(paths.zonesPath)
  ctx.restore()
}

/** Paints the static layer into an offscreen canvas, flushes with getImageData; median of 3 runs. */
function canvasStatic() {
  const { g, ring, ringGates, ringCurrents } = scene
  const state = ensureCanvas()
  const offscreen = document.createElement('canvas')
  offscreen.width = CANVAS_W
  offscreen.height = CANVAS_H
  const octx = offscreen.getContext('2d')
  const paths = buildPaths(g, ring, ringGates, ringCurrents)
  const samples = []
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now()
    paintStatic(octx, ring, paths)
    octx.getImageData(0, 0, 1, 1)
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  state.offscreen = offscreen
  state.paths = paths
  state.visible.getContext('2d').drawImage(offscreen, 0, 0)
  return stats(samples)
}

/** `frames` frames of blitting the cached bitmap under a pan/zoom transform (the finding that matters: flat cost). */
async function canvasPan(frames) {
  const { visible, offscreen } = canvasState
  const vctx = visible.getContext('2d')
  const samples = []
  for (let i = 0; i < frames; i++) {
    const a = i / frames
    const t0 = performance.now()
    vctx.save()
    vctx.setTransform(1, 0, 0, 1, 0, 0)
    vctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    vctx.translate(CANVAS_W / 2 + Math.sin(a * 2 * Math.PI) * 120, CANVAS_H / 2 + Math.cos(a * 2 * Math.PI) * 80)
    const s = 1 + 1.5 * Math.sin(a * Math.PI)
    vctx.scale(s, s)
    vctx.translate(-CANVAS_W / 2, -CANVAS_H / 2)
    vctx.drawImage(offscreen, 0, 0)
    vctx.restore()
    vctx.getImageData(0, 0, 1, 1)
    await raf()
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  vctx.setTransform(1, 0, 0, 1, 0, 0)
  vctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  vctx.drawImage(offscreen, 0, 0)
  return stats(samples)
}

/** Redraws an overlay canvas with one highlighted zone plus its gate and current paths, `count` times. */
function canvasHover(count) {
  const { g, ring, ringGates, ringCurrents } = scene
  const state = ensureCanvas()
  if (!state.overlay) {
    const overlay = document.createElement('canvas')
    overlay.width = CANVAS_W
    overlay.height = CANVAS_H
    state.overlay = overlay
  }
  const octx = state.overlay.getContext('2d')
  const n = ring.base
  const fit = Math.min(CANVAS_W / ring.width, CANVAS_H / ring.height)
  const samples = []
  for (let i = 0; i < count; i++) {
    const z = (i * 7919) % n
    const t0 = performance.now()
    octx.save()
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    octx.translate(CANVAS_W / 2, CANVAS_H / 2)
    octx.scale(fit, fit)
    octx.translate(-ring.width / 2, -ring.height / 2)
    const cx = ring.x[z] ?? 0
    const cy = ring.y[z] ?? 0
    octx.beginPath()
    octx.arc(cx, cy, ring.nodeRadius * 1.3, 0, Math.PI * 2)
    octx.strokeStyle = '#fff'
    octx.lineWidth = 2
    octx.stroke()
    octx.strokeStyle = '#cc44ff'
    octx.lineWidth = 1.4
    octx.stroke(new Path2D(ringGates.d[z] ?? ''))
    const q = g.pairOf(z)
    octx.strokeStyle = '#22ee66'
    octx.lineWidth = 1.7
    octx.stroke(new Path2D(ringCurrents.stem[q] ?? ''))
    octx.restore()
    octx.getImageData(0, 0, 1, 1)
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  return stats(samples)
}

/** Per frame: lerp + routes (as tweenSvg) + rebuild Path2D + full repaint of the visible canvas + flush. */
async function canvasTween(frames) {
  const { g, ring, spiral, spiralGates, spiralCurrents } = scene
  const { visible } = canvasState
  const vctx = visible.getContext('2d')
  const n = ring.base
  const X = new Float64Array(n)
  const Y = new Float64Array(n)
  const samples = []
  for (let i = 0; i < frames; i++) {
    const cyclePos = i % 10
    const forward = Math.floor(i / 10) % 2 === 0
    const t = forward ? (cyclePos + 1) / 11 : 1 - (cyclePos + 1) / 11
    const t0 = performance.now()
    lerpPositions(ring, spiral, t, X, Y)
    const frameLayout = { ...ring, x: X, y: Y }
    const gateRoutes = routeGates(g, frameLayout, { orientation: spiralGates.orientation })
    const currentRoutes = routeCurrents(g, frameLayout, { orientation: spiralCurrents.orientation })
    const paths = buildPaths(g, frameLayout, gateRoutes, currentRoutes)
    paintStatic(vctx, frameLayout, paths)
    vctx.getImageData(0, 0, 1, 1)
    await raf()
    const t1 = performance.now()
    samples.push(t1 - t0)
  }
  return stats(samples)
}

// -----------------------------------------------------------------------------------------------------------
// All-chords density (a synthetic n-point circle, independent of the numogram's own gate/current routes)
// -----------------------------------------------------------------------------------------------------------

/** n points on a circle, every chord painted once (batched, alpha scaled down as items grow) for paint cost, and
 *  once more on a 'lighter'-composited overlap canvas to measure the legibility-limiting overlap share. */
function chords(n) {
  const size = 1000
  const R = 460
  const cx = 500
  const cy = 500
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    px[i] = cx + R * Math.cos(a)
    py[i] = cy + R * Math.sin(a)
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#060609'
  ctx.fillRect(0, 0, size, size)
  const path = new Path2D()
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      path.moveTo(px[i], py[i])
      path.lineTo(px[j], py[j])
    }
  }
  const t0 = performance.now()
  ctx.globalAlpha = Math.min(0.6, Math.max(0.02, 30 / n))
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.stroke(path)
  ctx.getImageData(0, 0, 1, 1)
  const t1 = performance.now()
  const paintMs = round3(t1 - t0)

  const overlapCanvas = document.createElement('canvas')
  overlapCanvas.width = size
  overlapCanvas.height = size
  const octx = overlapCanvas.getContext('2d')
  octx.fillStyle = '#000'
  octx.fillRect(0, 0, size, size)
  octx.globalCompositeOperation = 'lighter'
  octx.strokeStyle = 'rgb(1,1,1)'
  octx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      octx.beginPath()
      octx.moveTo(px[i], py[i])
      octx.lineTo(px[j], py[j])
      octx.stroke()
    }
  }
  const data = octx.getImageData(0, 0, size, size).data
  let atLeast1 = 0
  let atLeast4 = 0
  const rr = R * R
  for (let y = 0; y < size; y++) {
    const dy = y - cy
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      if (dx * dx + dy * dy > rr) continue
      const v = data[(y * size + x) * 4]
      if (v >= 1) atLeast1++
      if (v >= 4) atLeast4++
    }
  }
  const overlapShare = atLeast1 > 0 ? atLeast4 / atLeast1 : 0
  return { chords: (n * (n - 1)) / 2, paintMs, overlapShare: round3(overlapShare) }
}

// -----------------------------------------------------------------------------------------------------------

window.__spike = {
  ready: true,
  crossOriginIsolated: self.crossOriginIsolated,
  calib,
  rendererInfo,
  probeCanvas,
  memory,
  build,
  mountSvg,
  hoverSvg,
  panCss,
  tweenSvg,
  canvasStatic,
  canvasPan,
  canvasHover,
  canvasTween,
  chords,
}

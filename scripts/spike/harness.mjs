// Ceiling spike harness (REN-01): runs the committed engine in the page; loaded by scripts/spike/driver.ts.
// Plain browser ES module (never type-checked, never linted; scripts/spike/driver.ts serves it as-is).

import { createNumogram } from '/engine/core/numogram'
import { lerpPositions, ringLayout, routeCurrents, routeGates, spiralLayout } from '/engine/layout/index'

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

window.__spike = {
  ready: true,
  crossOriginIsolated: self.crossOriginIsolated,
  calib,
  rendererInfo,
  probeCanvas,
  memory,
}

// Referenced by 03-09 Task 2 (svg-rich/svg-lean/canvas/chords suites): imported here already so the harness always
// loads the real engine modules the driver compiles, even before those suites exist.
void createNumogram
void ringLayout
void spiralLayout
void routeGates
void routeCurrents
void lerpPositions
void raf
void stats

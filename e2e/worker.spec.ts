import { test, expect, type Page } from '@playwright/test'
import tierTable from '../engine/scene/tier-table.json'
import { createNumogram } from '../engine/index'
import { CANVAS_READY, DIAGRAM, HEADLESS, SUMMARY, openCanvas, openHeadless, openViewer } from './viewer-helpers'
import { openDemons } from './demons-helpers'

// REN-03 / D-06 / D-07: the numogram worker in a real browser. Bases up to svgRichMaxN never create a worker, a Canvas base
// creates exactly one, a superseded base never paints, the computing state shows after the grace period, 2^26 never freezes
// the page, the ceiling is read from the table, and both fallbacks (no Worker, a Worker that fails to start) still draw.
// Staleness is made deterministic by a TEST-ONLY wrapper around Worker.prototype.postMessage (research Pattern 3, installed
// with addInitScript; nothing of it exists in production code): messages for chosen bases are held until the test releases
// them, so a late reply is a fact of the scenario and not a race against this machine's speed. The single timing assertion
// of the whole phase is the 2^26 heartbeat bound below.

test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 6 UI specs run once (UTC context)'))

// the shipped interactive ceiling, always read from the table (never a literal)
const CEIL = tierTable.boundaries.interactiveMaxN.n
const HUGE = 67108864 // 2^26, the largest base the picker accepts
const BASE_INPUT = 'input[aria-label="Base"]'
const OVERLAY = 'canvas[data-diagram]'
// [default] about a third below the measured 625 ms main-thread 2^26 build this guards against, and far above normal frame
// jitter: the only timing assertion in the phase (research P1; plan 06-14).
const HEARTBEAT_MAX_GAP_MS = 450

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  return errors
}

/** The URLs of every dedicated worker the page creates, in order. */
function trackWorkers(page: Page): string[] {
  const urls: string[] = []
  page.on('worker', w => urls.push(w.url()))
  return urls
}

/** Types a base into the picker and presses Enter: the one commit path a visitor uses. */
async function commitBase(page: Page, base: number): Promise<void> {
  const input = page.locator(BASE_INPUT)
  await input.fill(String(base))
  await input.press('Enter')
}

const overLimit = (base: number) =>
  `Base ${base} is above the interactive limit of ${CEIL}. Showing the summary and text view. To draw it, use headless export.`

/** Two animation frames: whatever React was going to commit for the last event has been committed and painted. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

interface WorkerHook {
  held: Set<number>
  queue: Array<() => void>
  posted: number[] // the base of every message that really reached a worker, in order
  arrived: number[] // the base of every reply that really reached the page, in order
}

/**
 * Test-only (research Pattern 3): wrap Worker.prototype.postMessage so a message for one of `holdBases` waits until
 * `releaseWorker` is called, and record which messages reached the worker and which replies came back. The worker is FIFO
 * and the client keeps one job in flight, so a held message is exactly a slow worker.
 */
async function holdWorker(page: Page, holdBases: number[]): Promise<void> {
  await page.addInitScript((bases: number[]) => {
    const hook: WorkerHook = { held: new Set(bases), queue: [], posted: [], arrived: [] }
    ;(window as unknown as { __workerHook: WorkerHook }).__workerHook = hook
    const proto = Worker.prototype
    const post = proto.postMessage as unknown as (this: Worker, ...args: unknown[]) => void
    proto.postMessage = function (this: Worker, ...args: unknown[]) {
      const msg = args[0] as { base?: number; id?: number }
      const base = msg.base
      if (base === undefined) {
        post.apply(this, args)
        return
      }
      this.addEventListener('message', ev => {
        if ((ev.data as { id?: number }).id === msg.id) hook.arrived.push(base)
      })
      const send = () => {
        hook.posted.push(base)
        post.apply(this, args)
      }
      if (hook.held.has(base)) hook.queue.push(send)
      else send()
    } as unknown as typeof proto.postMessage
  }, holdBases)
}

/** Lets every held message through (the worker then answers them, late). */
async function releaseWorker(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as unknown as { __workerHook: WorkerHook }).__workerHook
    hook.held.clear()
    for (const send of hook.queue.splice(0)) send()
  })
}

const hookState = (page: Page) =>
  page.evaluate(() => {
    const { posted, arrived } = (window as unknown as { __workerHook: WorkerHook }).__workerHook
    return { posted: [...posted], arrived: [...arrived] }
  })

/** A requestAnimationFrame heartbeat that records the largest gap between frames; serialised into the page, so self-contained. */
function installHeartbeat(): void {
  const hb = { last: performance.now(), max: 0, frames: 0, on: true }
  ;(window as unknown as { __hb: typeof hb }).__hb = hb
  const tick = () => {
    if (!hb.on) return
    const now = performance.now()
    hb.max = Math.max(hb.max, now - hb.last)
    hb.last = now
    hb.frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** Stops the heartbeat; the trailing gap (the last frame to now) counts too, so a stalled page cannot read as a clean one. */
async function readHeartbeat(page: Page): Promise<{ maxGapMs: number; frames: number }> {
  return page.evaluate(() => {
    const hb = (window as unknown as { __hb: { last: number; max: number; frames: number; on: boolean } }).__hb
    hb.on = false
    return { maxGapMs: Math.max(hb.max, performance.now() - hb.last), frames: hb.frames }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SVG-tier bases never create a worker', async ({ page }) => {
  const errors = trackErrors(page)
  const workers = trackWorkers(page)
  await openViewer(page, '')
  await commitBase(page, 28)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(28)
  await commitBase(page, 100)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(100)
  await settle(page)
  expect(workers).toEqual([])
  expect(errors).toEqual([])
})

test('a Canvas base computes in the one worker', async ({ page }) => {
  const errors = trackErrors(page)
  const workers = trackWorkers(page)
  await openCanvas(page, 'base=1024')
  expect(workers).toHaveLength(1)
  await commitBase(page, 2048)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '2048')
  expect(workers).toHaveLength(1)
  expect(errors).toEqual([])
})

test('a typed 2^26 followed by an SVG chip never shows the summary', async ({ page }) => {
  const errors = trackErrors(page)
  await holdWorker(page, [HUGE])
  // the over-limit summary may never appear, not even for a frame (a MutationObserver records any sighting)
  await page.addInitScript(() => {
    const w = window as unknown as { __summarySeen: boolean }
    w.__summarySeen = false
    const look = () => {
      if (document.querySelector('section[aria-label="Numogram summary"]')) w.__summarySeen = true
    }
    new MutationObserver(look).observe(document, { childList: true, subtree: true })
    look()
  })
  await openViewer(page, '')
  await commitBase(page, HUGE)
  await commitBase(page, 100)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(100)
  await expect(page).toHaveURL(/base=100/)

  // let the 2^26 request reach the worker and its reply come back to the page: the superseded result is really late
  await releaseWorker(page)
  await page.waitForFunction(
    () => (window as unknown as { __workerHook: WorkerHook }).__workerHook.arrived.length > 0,
    undefined,
    { timeout: 60_000 },
  )
  expect((await hookState(page)).arrived).toEqual([HUGE])
  await page.waitForTimeout(500) // React had every chance to (wrongly) paint it

  expect(await page.evaluate(() => (window as unknown as { __summarySeen: boolean }).__summarySeen)).toBe(false)
  await expect(page.locator('[data-diagram="zones"] [data-zone]')).toHaveCount(100)
  await expect(page.locator(SUMMARY)).toHaveCount(0)
  await expect(page).toHaveURL(/base=100/)
  expect(errors).toEqual([])
})

test('rapid Canvas bases end on the last request', async ({ page }) => {
  const errors = trackErrors(page)
  await holdWorker(page, [2048])
  // every base the canvas wrapper ever carries, in order of first appearance
  await page.addInitScript(() => {
    const w = window as unknown as { __basesSeen: string[] }
    w.__basesSeen = []
    const scan = () => {
      for (const el of Array.from(document.querySelectorAll('[data-render-tier="canvas"]'))) {
        const b = el.getAttribute('data-base')
        if (b !== null && !w.__basesSeen.includes(b)) w.__basesSeen.push(b)
      }
    }
    new MutationObserver(scan).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-base'] })
    scan()
  })
  await openCanvas(page, 'base=666')
  await commitBase(page, 2048) // posted but held: the slow worker
  await commitBase(page, 1024) // replaces the pending slot; 2048 is superseded
  await releaseWorker(page)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '1024', { timeout: 30_000 })
  await page.waitForTimeout(1000) // anything late would have landed by now

  const seen = await page.evaluate(() => (window as unknown as { __basesSeen: string[] }).__basesSeen)
  expect(seen).toEqual(['666', '1024'])
  // 2048 really was computed and answered (it was in flight), and 1024 was posted only after it: the latest request won
  expect(await hookState(page)).toEqual({ posted: [666, 2048, 1024], arrived: [666, 2048, 1024] })
  await expect(page.locator('[data-render-tier="canvas"]')).toHaveAttribute('data-base', '1024')
  expect(errors).toEqual([])
})

test('the computing state after the grace period, then the ready announcement', async ({ page }) => {
  const errors = trackErrors(page)
  await holdWorker(page, [1024])
  await openCanvas(page, 'base=666')
  const root = page.locator('[data-render-tier="canvas"]')
  const overlay = page.locator(OVERLAY)

  // control: with nothing pending an arrow key moves the focus ring, so "unchanged" below means the keys are paused
  await overlay.focus()
  const before = (await overlay.getAttribute('data-focus-key')) ?? ''
  expect(before).not.toBe('')
  await page.keyboard.press('ArrowRight')
  await settle(page)
  const moved = await overlay.getAttribute('data-focus-key')
  expect(moved).not.toBe(before)

  await commitBase(page, 1024) // held in the worker queue until the test releases it
  await overlay.focus() // pointer events are off while pending, so the canvas is focused programmatically
  const during = await overlay.getAttribute('data-focus-key')

  const computing = page.locator('span[data-computing="true"]')
  await expect(computing).toBeVisible()
  await expect(computing).toHaveText('Computing base 1024...')
  await expect(page.locator('[data-picker-status]')).toHaveText('Computing base 1024...')
  await expect(root).toHaveAttribute('data-canvas-state', 'pending')
  await expect(root).toHaveAttribute('style', /opacity: 0\.5/)
  await expect(overlay).toHaveAttribute('aria-busy', 'true')
  await expect(root).toHaveAttribute('data-base', '666') // the last result stays on screen

  await page.keyboard.press('ArrowRight')
  await settle(page)
  await expect(overlay).toHaveAttribute('data-focus-key', during ?? '')

  await releaseWorker(page)
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '1024', { timeout: 30_000 })
  await expect(page.locator('[data-picker-status]')).toHaveText('Base 1024 ready.')
  await expect(page.locator('[data-computing]')).toHaveCount(0)
  await expect(root).not.toHaveAttribute('style', /opacity: 0\.5/)
  await expect(overlay).not.toHaveAttribute('aria-busy', 'true')
  expect(errors).toEqual([])
})

test('2^26 keeps the page responsive and ends on the over-limit summary', async ({ page }) => {
  const errors = trackErrors(page)
  await openViewer(page, '')
  await page.evaluate(installHeartbeat)
  await commitBase(page, HUGE)
  await expect(page.locator(`[data-render-tier="headless"] ${SUMMARY}`)).toContainText(overLimit(HUGE), { timeout: 60_000 })
  await settle(page)
  const { maxGapMs, frames } = await readHeartbeat(page)
  console.log(`heartbeat max-gap-ms=${maxGapMs} frames=${frames}`)
  expect(frames).toBeGreaterThan(5) // the heartbeat really ticked while the worker was computing
  expect(maxGapMs).toBeLessThan(HEARTBEAT_MAX_GAP_MS)
  expect(errors).toEqual([])
})

test('the ceiling is data, and the over-limit view offers nothing but the pointer to headless export', async ({ page }) => {
  const errors = trackErrors(page)

  await openCanvas(page, `base=${CEIL}`) // the ceiling itself still draws

  await openHeadless(page, `base=${CEIL + 2}`)
  const summary = page.locator(HEADLESS)
  await expect(summary).toContainText(overLimit(CEIL + 2))
  await expect(summary.locator('a')).toHaveCount(0)
  await expect(summary.locator('button').filter({ hasText: /anyway|export/i })).toHaveCount(0)
  await expect(page.locator(DIAGRAM)).toHaveCount(0)

  // the diagnostic override inside the limit never claims the base is over it
  await openHeadless(page, 'base=28&tier=headless')
  await expect(page.locator(HEADLESS)).toContainText('Tier override active. Showing the summary and text view for base 28.')
  await expect(page.locator(HEADLESS)).not.toContainText('interactive limit')
  expect(errors).toEqual([])
})

test('a scene-less 2^26 result under tier=canvas renders headless, never SVG, and stays responsive', async ({ page }) => {
  const errors = trackErrors(page)
  // installed before navigation so the heartbeat records from the first frame: a hydration-time compute would show in it
  await page.addInitScript(installHeartbeat)
  await openHeadless(page, `base=${HUGE}&tier=canvas`)
  await expect(page.locator(HEADLESS)).toContainText(overLimit(HUGE))
  await expect(page.locator(DIAGRAM)).toHaveCount(0)
  await settle(page)
  const { maxGapMs, frames } = await readHeartbeat(page)
  console.log(`heartbeat (hydration at 2^26) max-gap-ms=${maxGapMs} frames=${frames}`)
  expect(frames).toBeGreaterThan(5)
  expect(maxGapMs).toBeLessThan(HEARTBEAT_MAX_GAP_MS)
  expect(errors).toEqual([])
})

test('no Worker: the main thread computes up to the ceiling and refuses above it', async ({ page }) => {
  const errors = trackErrors(page)
  const workers = trackWorkers(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', { value: undefined, configurable: true })
  })
  await openCanvas(page, 'base=1024')
  expect(workers).toEqual([])

  const above = CEIL + 2
  await commitBase(page, above)
  const refusal = page.locator('span[role="status"]', { hasText: `Base ${above} needs a background worker, which this browser can't start. Showing base 1024.` })
  await expect(refusal).toBeVisible()
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '1024')
  await expect(page.locator(SUMMARY)).toHaveCount(0)
  expect(workers).toEqual([])
  expect(errors).toEqual([])
})

test('a worker that fails to start falls back to the main thread', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    // A Worker that exists but never starts: the failure is an asynchronous error event (research P18).
    class FailingWorker {
      onmessage: ((e: MessageEvent) => void) | null = null
      onerror: ((e: Event) => void) | null = null
      constructor() {
        setTimeout(() => this.onerror?.(new Event('error')), 0)
      }
      postMessage(): void {}
      terminate(): void {}
      addEventListener(): void {}
    }
    Object.defineProperty(window, 'Worker', { value: FailingWorker, configurable: true, writable: true })
  })
  await openCanvas(page, 'base=1024')
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '1024')
  await commitBase(page, 2048) // the fallback keeps answering after the failure
  await expect(page.locator(CANVAS_READY)).toHaveAttribute('data-base', '2048')
  expect(errors).toEqual([])
})

test('the over-limit summary opens the Demons overlay lazily', async ({ page }) => {
  const errors = trackErrors(page)
  const above = CEIL + 2
  await openHeadless(page, `base=${above}`)
  const dialog = await openDemons(page)
  await expect(dialog.locator(`[data-demons-total="${createNumogram(above).demons.count}"]`)).toBeVisible()
  expect(errors).toEqual([])
})

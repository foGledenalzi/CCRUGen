// Ceiling spike driver (REN-01, D-11, D-14b). Dev-only: never part of npm run verify. Writes raw records to
// .spike/raw; plan 03-10 shapes them into engine/scene/tier-table.json.
//
// CommonJS-safe (tsx runs .ts scripts as CommonJS because the root package.json has no "type" field): no top-level
// await, no import.meta. Every browser this driver launches is closed in `finally` (T-03-26).
//
// Trust boundary (T-03-25): the page is served from a fake `https://spike.test/` origin fulfilled entirely by
// Playwright route interception (no real network access); only a fixed whitelist of local paths is served (the page,
// the two React UMD builds, the harness module and the compiled engine under .spike/engine-js), everything else 404s.

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { chromium } from '@playwright/test'
import type { Browser, BrowserContext, CDPSession, Page, Route } from '@playwright/test'

// The headless suite runs the real, committed engine directly in Node (no browser, no compiled copy needed).
import { clearNumogramCache, createNumogram, layoutToSvg, ringLayout, routeCurrents, routeGates } from '../../engine/index'

if (!existsSync(path.resolve('engine/index.ts'))) {
  console.error('spike: run from the repository root')
  process.exit(2)
}

// -------------------------------------------------------------------------------------------------------------
// CLI
// -------------------------------------------------------------------------------------------------------------

type Profile = 'gpu' | 'sw' | 'sw-4x' | 'sw-6x'
type Suite = 'calib' | 'limits' | 'chords' | 'svg-rich' | 'svg-lean' | 'canvas' | 'headless' | 'all'

const PROFILE_NAMES: readonly Profile[] = ['gpu', 'sw', 'sw-4x', 'sw-6x']
const SUITE_NAMES: readonly Suite[] = ['calib', 'limits', 'chords', 'svg-rich', 'svg-lean', 'canvas', 'headless', 'all']

interface Args {
  readonly profile: Profile
  readonly suite: Suite
  readonly ns: number[] | null
  readonly quick: boolean
  readonly fresh: boolean
  readonly compile: boolean
}

function parseArgs(argv: readonly string[]): Args {
  let profile: Profile = 'gpu'
  let suite: Suite = 'all'
  let ns: number[] | null = null
  let quick = false
  let fresh = false
  let compile = true
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--profile') {
      const v = argv[++i] ?? ''
      if (!(PROFILE_NAMES as readonly string[]).includes(v)) throw new Error(`spike: unknown --profile ${v}`)
      profile = v as Profile
    } else if (a === '--suite') {
      const v = argv[++i] ?? ''
      if (!(SUITE_NAMES as readonly string[]).includes(v)) throw new Error(`spike: unknown --suite ${v}`)
      suite = v as Suite
    } else if (a === '--ns') {
      const v = argv[++i] ?? ''
      ns = v
        .split(',')
        .map(s => Number(s.trim()))
        .filter(n => Number.isFinite(n) && n > 0)
    } else if (a === '--quick') {
      quick = true
    } else if (a === '--fresh') {
      fresh = true
    } else if (a === '--no-compile') {
      compile = false
    }
  }
  return { profile, suite, ns, quick, fresh, compile }
}

const QUICK_NS: readonly number[] = [10, 28]

type SizedSuite = 'svg-rich' | 'svg-lean' | 'canvas' | 'chords' | 'headless'

const DEFAULT_NS: Record<SizedSuite, readonly number[]> = {
  'svg-rich': [10, 28, 64, 100, 150, 200, 300, 500, 800, 1000, 2000, 4000],
  'svg-lean': [10, 28, 64, 100, 150, 200, 300, 500, 800, 1000, 2000, 4000],
  canvas: [10, 28, 64, 100, 150, 200, 300, 500, 800, 1000, 2000, 4000],
  chords: [10, 20, 30, 40, 50, 60, 80, 100, 120, 200, 300, 500, 800, 1000],
  headless: [100, 1000, 10000, 100000],
}

function nsFor(key: SizedSuite, args: Args): number[] {
  if (args.ns) return args.ns
  if (args.quick) return [...QUICK_NS]
  return [...DEFAULT_NS[key]]
}

// -------------------------------------------------------------------------------------------------------------
// Device profiles (D-11, D-14; 03-RESEARCH.md "Ceiling spike")
// -------------------------------------------------------------------------------------------------------------

const FLAGS: readonly string[] = ['--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-precise-memory-info']

interface ProfileConfig {
  readonly args: readonly string[]
  readonly throttle: number
  readonly raster: 'gpu' | 'software'
}

const PROFILES: Record<Profile, ProfileConfig> = {
  gpu: { args: FLAGS, throttle: 1, raster: 'gpu' },
  sw: { args: [...FLAGS, '--disable-gpu'], throttle: 1, raster: 'software' },
  'sw-4x': { args: [...FLAGS, '--disable-gpu'], throttle: 4, raster: 'software' },
  'sw-6x': { args: [...FLAGS, '--disable-gpu'], throttle: 6, raster: 'software' },
}

// -------------------------------------------------------------------------------------------------------------
// Paths, raw output
// -------------------------------------------------------------------------------------------------------------

const ENGINE_JS_DIR = path.resolve('.spike/engine-js')
const RAW_DIR = path.resolve('.spike/raw')
const HARNESS_PATH = path.resolve('scripts/spike/harness.mjs')
const REACT_UMD = path.resolve('node_modules/react/umd/react.production.min.js')
const REACT_DOM_UMD = path.resolve('node_modules/react-dom/umd/react-dom.production.min.js')

function rawFile(profile: Profile, suite: Suite): string {
  return path.join(RAW_DIR, suite === 'headless' ? 'headless.jsonl' : `${profile}.jsonl`)
}

function envFile(profile: Profile): string {
  return path.join(RAW_DIR, `env-${profile}.json`)
}

function appendRecord(file: string, record: unknown): void {
  mkdirSync(RAW_DIR, { recursive: true })
  const line = JSON.stringify(record)
  appendFileSync(file, `${line}\n`)
  console.log(`spike: ${line.length > 240 ? `${line.slice(0, 240)}...` : line}`)
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

// -------------------------------------------------------------------------------------------------------------
// Compiling the engine so the page can import it as real ES modules
// -------------------------------------------------------------------------------------------------------------

function compileEngine(): void {
  console.log('spike: compiling engine/ to .spike/engine-js ...')
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '-p',
      'engine/tsconfig.json',
      '--noEmit',
      'false',
      '--outDir',
      '.spike/engine-js',
      '--incremental',
      'false',
      '--declaration',
      'false',
      '--sourceMap',
      'false',
    ],
    { stdio: 'inherit' },
  )
}

// -------------------------------------------------------------------------------------------------------------
// Serving the page, React UMD, the harness and the compiled engine on a fake, cross-origin-isolated origin
// -------------------------------------------------------------------------------------------------------------

const ISOLATION_HEADERS: Record<string, string> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

const PAGE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#060609}</style></head>' +
  '<body><div id="host"></div><script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script>' +
  '<script type="module" src="/harness.mjs"></script></body></html>'

async function fulfillFile(route: Route, file: string, contentType: string): Promise<void> {
  if (!existsSync(file)) {
    await route.fulfill({ status: 404, contentType: 'text/plain', headers: ISOLATION_HEADERS, body: 'not found' })
    return
  }
  await route.fulfill({ status: 200, contentType, headers: ISOLATION_HEADERS, body: readFileSync(file) })
}

async function setupRouting(context: BrowserContext): Promise<void> {
  await context.route('https://spike.test/**', async route => {
    const url = new URL(route.request().url())
    const p = url.pathname

    if (p === '/') {
      await route.fulfill({ status: 200, contentType: 'text/html', headers: ISOLATION_HEADERS, body: PAGE_HTML })
      return
    }
    if (p === '/vendor/react.js') {
      await fulfillFile(route, REACT_UMD, 'text/javascript')
      return
    }
    if (p === '/vendor/react-dom.js') {
      await fulfillFile(route, REACT_DOM_UMD, 'text/javascript')
      return
    }
    if (p === '/harness.mjs') {
      await fulfillFile(route, HARNESS_PATH, 'text/javascript')
      return
    }
    if (p.startsWith('/engine/')) {
      const rel = p.slice('/engine/'.length)
      if (rel.endsWith('.json')) {
        const file = path.join(ENGINE_JS_DIR, rel)
        if (!existsSync(file)) {
          await route.fulfill({ status: 404, contentType: 'text/plain', headers: ISOLATION_HEADERS, body: 'not found' })
          return
        }
        const json = readFileSync(file, 'utf8')
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          headers: ISOLATION_HEADERS,
          body: `export default ${json};`,
        })
        return
      }
      const hasExt = path.extname(rel) !== ''
      const file = path.join(ENGINE_JS_DIR, hasExt ? rel : `${rel}.js`)
      await fulfillFile(route, file, 'text/javascript')
      return
    }
    await route.fulfill({ status: 404, contentType: 'text/plain', headers: ISOLATION_HEADERS, body: 'not found' })
  })
}

// -------------------------------------------------------------------------------------------------------------
// Pages, CDP and metrics
// -------------------------------------------------------------------------------------------------------------

interface StatPair {
  readonly median: number
  readonly p95: number
}
type Detail = 'rich' | 'lean'

/** The shape of `window.__spike`. */
interface SpikeApi {
  ready: boolean
  calib(): number
  rendererInfo(): string | null
  probeCanvas(list: readonly (readonly [number, number])[]): ReadonlyArray<{ width: number; height: number; ok: boolean }>
  memory(): Promise<{ total: number; dom: number } | null>
  build(n: number): { computeMs: number }
  mountSvg(detail: Detail): Promise<{ commitMs: number; toSecondFrameMs: number; domNodes: number }>
  hoverSvg(detail: Detail, count: number): Promise<{ commit: StatPair | null; toFrame: StatPair | null }>
  panCss(frames: number): Promise<StatPair | null>
  tweenSvg(detail: Detail, frames: number): Promise<StatPair | null>
  canvasStatic(): StatPair | null
  canvasPan(frames: number): Promise<StatPair | null>
  canvasHover(count: number): StatPair | null
  canvasTween(frames: number): Promise<StatPair | null>
  chords(n: number): { chords: number; paintMs: number; overlapShare: number }
}
type SpikeWindow = typeof globalThis & { __spike: SpikeApi }

interface SpikePage {
  readonly context: BrowserContext
  readonly page: Page
  readonly cdp: CDPSession
}

async function freshPage(browser: Browser, cfg: ProfileConfig): Promise<SpikePage> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  await setupRouting(context)
  const page = await context.newPage()
  page.setDefaultTimeout(240_000)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  if (cfg.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle })
  await page.goto('https://spike.test/')
  await page.waitForFunction(() => (window as unknown as SpikeWindow).__spike?.ready === true)
  return { context, page, cdp }
}

/** `HeapProfiler.collectGarbage` then `Performance.getMetrics` as a name -> value map (research method). */
async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics: list } = await cdp.send('Performance.getMetrics')
  const map: Record<string, number> = {}
  for (const m of list) map[m.name] = m.value
  return map
}

// -------------------------------------------------------------------------------------------------------------
// Environment metadata (D-14a), written on every browser run
// -------------------------------------------------------------------------------------------------------------

function physicalCoresWin32(): number | null {
  if (process.platform !== 'win32') return null
  try {
    const out = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', '(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum'],
      { encoding: 'utf8' },
    )
    const n = parseInt(out.trim(), 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function writeEnv(profile: Profile, cfg: ProfileConfig, browser: Browser): Promise<void> {
  const { context, page } = await freshPage(browser, cfg)
  try {
    const gpu = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.rendererInfo())
    const crossOriginIsolated = await page.evaluate(() => (self as unknown as { crossOriginIsolated: boolean }).crossOriginIsolated === true)
    const pwPkg = JSON.parse(readFileSync(path.resolve('node_modules/playwright-core/package.json'), 'utf8')) as { version: string }
    const cpu = os.cpus()[0]
    const env = {
      profile,
      cpu: (cpu?.model ?? '').trim(),
      physicalCores: physicalCoresWin32(),
      logicalThreads: os.cpus().length,
      ramBytes: os.totalmem(),
      os: `${os.version()} ${os.release()}`,
      browser: `Chromium ${browser.version()} (Playwright ${pwPkg.version})`,
      raster: cfg.raster,
      gpu,
      cpuThrottleNominal: cfg.throttle,
      crossOriginIsolated,
      date: new Date().toISOString().slice(0, 10),
    }
    mkdirSync(RAW_DIR, { recursive: true })
    writeFileSync(envFile(profile), `${JSON.stringify(env, null, 2)}\n`)
    console.log(`spike: wrote ${path.relative(process.cwd(), envFile(profile))}`)
  } finally {
    await context.close()
  }
}

// -------------------------------------------------------------------------------------------------------------
// Suites: calib, limits (browser); headless (Node, no browser)
// -------------------------------------------------------------------------------------------------------------

async function runCalib(browser: Browser, cfg: ProfileConfig, profile: Profile): Promise<void> {
  const file = rawFile(profile, 'calib')
  const { context, page } = await freshPage(browser, cfg)
  try {
    const jsLoopMs = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.calib())
    appendRecord(file, { suite: 'calib', profile, n: null, jsLoopMs })
  } catch (e) {
    appendRecord(file, { suite: 'calib', profile, n: null, error: String(e).slice(0, 200) })
  } finally {
    await context.close()
  }
}

const LIMIT_PROBES: ReadonlyArray<readonly [number, number]> = [
  [4096, 4096],
  [8192, 8192],
  [16384, 8192],
  [16384, 16384],
  [16385, 16384],
  [16385, 16385],
  [32767, 1],
  [32768, 1],
  [32767, 8192],
  [32767, 8193],
  [11585, 23170],
  [23170, 11585],
  [23171, 11586],
  [32767, 32767],
  [65535, 1],
]

async function runLimits(browser: Browser, cfg: ProfileConfig, profile: Profile): Promise<void> {
  const file = rawFile(profile, 'limits')
  const { context, page } = await freshPage(browser, cfg)
  try {
    const probes = await page.evaluate(
      list => (window as unknown as SpikeWindow).__spike.probeCanvas(list),
      LIMIT_PROBES,
    )
    appendRecord(file, { suite: 'limits', profile, n: null, probes })
  } catch (e) {
    appendRecord(file, { suite: 'limits', profile, n: null, error: String(e).slice(0, 200) })
  } finally {
    await context.close()
  }
}

async function runHeadless(profile: Profile, ns: readonly number[]): Promise<void> {
  const file = rawFile(profile, 'headless')
  for (const n of ns) {
    try {
      clearNumogramCache()
      const rssBefore = process.memoryUsage().rss
      const t0 = performance.now()
      const g = createNumogram(n)
      const layout = ringLayout(g)
      const t1 = performance.now()
      const gateRoutes = routeGates(g, layout)
      const currentRoutes = routeCurrents(g, layout)
      const t2 = performance.now()
      const svg = layoutToSvg(g, layout, { gates: 'on', gateRoutes, currentRoutes })
      const t3 = performance.now()
      appendRecord(file, {
        suite: 'headless',
        profile,
        n,
        layoutMs: round3(t1 - t0),
        routeMs: round3(t2 - t1),
        emitMs: round3(t3 - t2),
        svgBytes: Buffer.byteLength(svg),
        rssDeltaBytes: process.memoryUsage().rss - rssBefore,
      })
    } catch (e) {
      appendRecord(file, { suite: 'headless', profile, n, error: String(e).slice(0, 200) })
    }
  }
}

// -------------------------------------------------------------------------------------------------------------
// Suites added in plan 03-09 Task 2: svg-rich, svg-lean, canvas, chords (real engine layouts and routes,
// research-derived adaptive frame/hover/tween counts, early stop above 20 s mount or 3 s hover-to-frame median)
// -------------------------------------------------------------------------------------------------------------

const MOUNT_STOP_MS = 20_000
const HOVER_STOP_MS = 3_000

function panFramesFor(mountMs: number): number {
  if (mountMs < 250) return 90
  if (mountMs < 1000) return 30
  if (mountMs < 4000) return 16
  return 8
}
function tweenFramesForSvg(mountMs: number): number {
  if (mountMs < 250) return 30
  if (mountMs < 1000) return 12
  if (mountMs < 4000) return 6
  return 3
}
function tweenFramesForCanvas(paintMs: number): number {
  if (paintMs < 250) return 30
  if (paintMs < 1000) return 12
  return 6
}

async function runSvgTier(
  browser: Browser,
  cfg: ProfileConfig,
  profile: Profile,
  suite: 'svg-rich' | 'svg-lean',
  ns: readonly number[],
): Promise<void> {
  const detail: Detail = suite === 'svg-rich' ? 'rich' : 'lean'
  const file = rawFile(profile, suite)
  let stop = false
  for (const n of ns) {
    if (stop) {
      appendRecord(file, { suite, profile, n, skipped: 'previous n too slow' })
      continue
    }
    const { context, page, cdp } = await freshPage(browser, cfg)
    try {
      const built = await page.evaluate(nn => (window as unknown as SpikeWindow).__spike.build(nn), n)
      const memBefore = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.memory())
      const heapBefore = (await metrics(cdp)).JSHeapUsedSize ?? 0
      const mount = await page.evaluate(d => (window as unknown as SpikeWindow).__spike.mountSvg(d), detail)
      const memAfter = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.memory())
      const heapAfter = (await metrics(cdp)).JSHeapUsedSize ?? 0

      const m = mount.toSecondFrameMs
      const hoverCount = m > 6000 ? 6 : 20
      const hover = await page.evaluate(
        ([d, c]) => (window as unknown as SpikeWindow).__spike.hoverSvg(d, c),
        [detail, hoverCount] as const,
      )
      const pan = await page.evaluate(f => (window as unknown as SpikeWindow).__spike.panCss(f), panFramesFor(m))
      const tween =
        m > 8000
          ? null
          : await page.evaluate(
              ([d, f]) => (window as unknown as SpikeWindow).__spike.tweenSvg(d, f),
              [detail, tweenFramesForSvg(m)] as const,
            )

      appendRecord(file, {
        suite,
        profile,
        n,
        computeMs: { median: built.computeMs, p95: null },
        mountMs: { median: m, p95: null },
        interactionMs: hover.toFrame,
        panMs: pan,
        tweenMs: tween,
        domNodes: mount.domNodes,
        domBytes: memAfter && memBefore ? round3(memAfter.dom - memBefore.dom) : null,
        jsHeapBytes: heapAfter - heapBefore,
      })

      if (m > MOUNT_STOP_MS || (hover.toFrame && hover.toFrame.median > HOVER_STOP_MS)) stop = true
    } catch (e) {
      appendRecord(file, { suite, profile, n, error: String(e).slice(0, 200) })
    } finally {
      await context.close()
    }
  }
}

async function runCanvas(browser: Browser, cfg: ProfileConfig, profile: Profile, ns: readonly number[]): Promise<void> {
  const file = rawFile(profile, 'canvas')
  let stop = false
  for (const n of ns) {
    if (stop) {
      appendRecord(file, { suite: 'canvas', profile, n, skipped: 'previous n too slow' })
      continue
    }
    const { context, page, cdp } = await freshPage(browser, cfg)
    try {
      const built = await page.evaluate(nn => (window as unknown as SpikeWindow).__spike.build(nn), n)
      const memBefore = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.memory())
      const heapBefore = (await metrics(cdp)).JSHeapUsedSize ?? 0
      const mount = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.canvasStatic())
      const memAfter = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.memory())
      const heapAfter = (await metrics(cdp)).JSHeapUsedSize ?? 0

      const paintMs = mount?.median ?? 0
      const hover = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.canvasHover(20))
      const pan = await page.evaluate(() => (window as unknown as SpikeWindow).__spike.canvasPan(60))
      const tween =
        paintMs > 8000
          ? null
          : await page.evaluate(f => (window as unknown as SpikeWindow).__spike.canvasTween(f), tweenFramesForCanvas(paintMs))

      appendRecord(file, {
        suite: 'canvas',
        profile,
        n,
        computeMs: { median: built.computeMs, p95: null },
        mountMs: mount,
        interactionMs: hover,
        panMs: pan,
        tweenMs: tween,
        domNodes: null,
        domBytes: memAfter && memBefore ? round3(memAfter.dom - memBefore.dom) : null,
        jsHeapBytes: heapAfter - heapBefore,
      })

      if (paintMs > MOUNT_STOP_MS || (hover && hover.median > HOVER_STOP_MS)) stop = true
    } catch (e) {
      appendRecord(file, { suite: 'canvas', profile, n, error: String(e).slice(0, 200) })
    } finally {
      await context.close()
    }
  }
}

async function runChords(browser: Browser, cfg: ProfileConfig, profile: Profile, ns: readonly number[]): Promise<void> {
  const file = rawFile(profile, 'chords')
  for (const n of ns) {
    const { context, page } = await freshPage(browser, cfg)
    try {
      const result = await page.evaluate(nn => (window as unknown as SpikeWindow).__spike.chords(nn), n)
      appendRecord(file, { suite: 'chords', profile, n, ...result })
    } catch (e) {
      appendRecord(file, { suite: 'chords', profile, n, error: String(e).slice(0, 200) })
    } finally {
      await context.close()
    }
  }
}

// -------------------------------------------------------------------------------------------------------------
// Suite dispatch
// -------------------------------------------------------------------------------------------------------------

function suitesFor(suite: Suite, profile: Profile): Suite[] {
  if (suite !== 'all') return [suite]
  const list: Suite[] = ['calib', 'svg-rich', 'svg-lean', 'canvas']
  if (profile === 'gpu') list.push('chords', 'limits')
  else if (profile === 'sw') list.push('limits')
  return list
}

async function runBrowserSuite(suite: Suite, browser: Browser, cfg: ProfileConfig, profile: Profile, args: Args): Promise<void> {
  if (suite === 'calib') return runCalib(browser, cfg, profile)
  if (suite === 'limits') return runLimits(browser, cfg, profile)
  if (suite === 'svg-rich' || suite === 'svg-lean') return runSvgTier(browser, cfg, profile, suite, nsFor(suite, args))
  if (suite === 'canvas') return runCanvas(browser, cfg, profile, nsFor('canvas', args))
  if (suite === 'chords') return runChords(browser, cfg, profile, nsFor('chords', args))
  throw new Error(`spike: cannot run suite "${suite}" in the browser loop`)
}

// -------------------------------------------------------------------------------------------------------------
// Entry point
// -------------------------------------------------------------------------------------------------------------

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  mkdirSync(RAW_DIR, { recursive: true })

  if (args.suite === 'headless') {
    if (args.fresh) rmSync(rawFile(args.profile, 'headless'), { force: true })
    await runHeadless(args.profile, nsFor('headless', args))
    return 0
  }

  if (args.compile) compileEngine()

  const cfg = PROFILES[args.profile]
  if (args.fresh) rmSync(rawFile(args.profile, args.suite), { force: true })

  const browser = await chromium.launch({ channel: 'chromium', args: [...cfg.args] })
  try {
    await writeEnv(args.profile, cfg, browser)
    for (const suite of suitesFor(args.suite, args.profile)) {
      await runBrowserSuite(suite, browser, cfg, args.profile, args)
    }
  } finally {
    await browser.close()
  }
  return 0
}

main().then(
  code => {
    process.exitCode = code
  },
  e => {
    console.error(e)
    process.exitCode = 1
  },
)

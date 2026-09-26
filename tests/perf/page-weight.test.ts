import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_TOLERANCE,
  ROOT,
  compare,
  countElements,
  limitFor,
  measureDomNodes,
  measureRoutes,
  nextBaseline,
} from '../../scripts/page-weight.mjs'

// Page-weight budget tool (FND-02 / D-17). Unit tests run on temp directories (mkdtemp under the OS temp
// dir, removed afterwards); no real out/ or golden file is read or written. The only CLI test is a
// refusal path that never writes.

const scratch: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'ccrug-pw-'))
  scratch.push(d)
  return d
}
afterAll(() => {
  for (const d of scratch) rmSync(d, { recursive: true, force: true })
})

const gz = (s: string) => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length

const route = (over: Record<string, number> = {}) => ({
  htmlBytes: 5000,
  htmlGzip: 1000,
  jsBytes: 300000,
  jsGzip: 100000,
  cssBytes: 20000,
  cssGzip: 5000,
  ...over,
})

const measurement = (routeOver: Record<string, number> = {}, nodes = 258) => ({
  routes: { '/': route(), '/numogram/': route(routeOver) },
  domNodes: { 'original--default': nodes, 'ladder--default': 226 },
})

const baseline = () => ({
  version: 1,
  tolerance: { ...DEFAULT_TOLERANCE },
  ...measurement(),
  history: [],
})

describe('limitFor', () => {
  it('adds the larger of the absolute minimum and the percentage', () => {
    expect(limitFor(1000, 5, 1024)).toBe(2024)
    expect(limitFor(100000, 5, 1024)).toBe(105000)
  })

  it('rounds the percentage up so a fractional allowance is never truncated', () => {
    expect(limitFor(258, 2, 2)).toBe(264)
    expect(limitFor(50, 2, 2)).toBe(52)
  })
})

describe('compare: byte metrics', () => {
  it('reports nothing for an identical measurement', () => {
    expect(compare(baseline(), measurement())).toEqual([])
  })

  it('flags a 6% jsGzip growth on a 100000 base and names the metric', () => {
    const problems = compare(baseline(), measurement({ jsGzip: 106000 }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('jsGzip')
    expect(problems[0]).toContain('/numogram/')
  })

  it('accepts 4% growth and any shrinkage', () => {
    expect(compare(baseline(), measurement({ jsGzip: 104000 }))).toEqual([])
    expect(compare(baseline(), measurement({ jsGzip: 50000, htmlBytes: 100 }))).toEqual([])
  })

  it('flags a route that has no baseline and a baseline route missing from the measurement', () => {
    const extra = measurement()
    ;(extra.routes as Record<string, unknown>)['/new/'] = route()
    const added = compare(baseline(), extra)
    expect(added).toHaveLength(1)
    expect(added[0]).toContain('/new/')

    const missing = measurement()
    delete (missing.routes as Record<string, unknown>)['/numogram/']
    const removed = compare(baseline(), missing)
    expect(removed).toHaveLength(1)
    expect(removed[0]).toContain('/numogram/')
  })

  it('honors a tolerance stored in the baseline', () => {
    const b = { ...baseline(), tolerance: { bytesPct: 0, bytesMin: 0, nodesPct: 0, nodesMin: 0 } }
    expect(compare(b, measurement({ jsGzip: 100001 }))).toHaveLength(1)
  })
})

describe('compare: DOM node counts', () => {
  it('allows baseline 258 up to 264 and rejects 265', () => {
    expect(compare(baseline(), measurement({}, 264))).toEqual([])
    const problems = compare(baseline(), measurement({}, 265))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('original--default')
  })

  it('flags a golden state that is missing from the baseline and one missing from the measurement', () => {
    const extra = measurement()
    ;(extra.domNodes as Record<string, number>)['labyrinth--default'] = 272
    const added = compare(baseline(), extra)
    expect(added).toHaveLength(1)
    expect(added[0]).toContain('labyrinth--default')

    const missing = measurement()
    delete (missing.domNodes as Record<string, number>)['ladder--default']
    const removed = compare(baseline(), missing)
    expect(removed).toHaveLength(1)
    expect(removed[0]).toContain('ladder--default')
  })
})

describe('nextBaseline', () => {
  it('refuses an empty or whitespace-only reason', () => {
    expect(() => nextBaseline(null, measurement(), '   ', '2026-09-25')).toThrow(/requires --reason/)
    expect(() => nextBaseline(baseline(), measurement(), '', '2026-09-25')).toThrow(/requires --reason/)
  })

  it('starts the history with a null before on the first baseline', () => {
    const next = nextBaseline(null, measurement(), '  first  ', '2026-09-25')
    expect(next.version).toBe(1)
    expect(next.tolerance).toEqual(DEFAULT_TOLERANCE)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].before).toBeNull()
    expect(next.history[0].reason).toBe('first')
    expect(next.history[0].date).toBe('2026-09-25')
    expect(next.history[0].after.domNodesTotal).toBe(258 + 226)
    expect(next.history[0].after.routes['/numogram/']).toEqual({ htmlGzip: 1000, jsGzip: 100000, cssGzip: 5000 })
  })

  it('appends one history entry with a non-null before when a baseline already exists', () => {
    const first = nextBaseline(null, measurement(), 'first', '2026-09-25')
    const second = nextBaseline(first, measurement({ jsGzip: 120000 }), 'grew on purpose', '2026-10-01')
    expect(second.history).toHaveLength(2)
    expect(second.history[1].before).not.toBeNull()
    expect(second.history[1].before.routes['/numogram/'].jsGzip).toBe(100000)
    expect(second.history[1].after.routes['/numogram/'].jsGzip).toBe(120000)
    expect(second.routes['/numogram/'].jsGzip).toBe(120000)
    expect(second.history[0]).toEqual(first.history[0])
  })
})

describe('countElements', () => {
  it('counts element lines and not #text lines', () => {
    const text = ['<svg viewBox="0 0 1 1">', '  <g>', '    #text hello', '    <text x="1">', '      #text < 5', ''].join('\n')
    expect(countElements(text)).toBe(3)
  })

  it('returns 0 for text without elements', () => {
    expect(countElements('')).toBe(0)
    expect(countElements('#text only')).toBe(0)
  })
})

describe('measureRoutes', () => {
  it('sums the assets referenced by each index.html, keys routes by path and skips the 404 pages', () => {
    const out = tmp()
    mkdirSync(join(out, '_next', 'static', 'chunks'), { recursive: true })
    mkdirSync(join(out, '_next', 'static', 'css'), { recursive: true })
    mkdirSync(join(out, 'numogram'))
    mkdirSync(join(out, '404'))
    const js = 'console.log("a")'.repeat(50)
    const css = 'body{color:red}'.repeat(40)
    writeFileSync(join(out, '_next', 'static', 'chunks', 'a.js'), js)
    writeFileSync(join(out, '_next', 'static', 'css', 'b.css'), css)
    // the asset is referenced twice (script tag and flight payload): it must be counted once
    const html =
      '<html><script src="/_next/static/chunks/a.js"></script>' +
      '<link href="/_next/static/css/b.css">' +
      '<script>self.__next_f.push(["/_next/static/chunks/a.js"])</script></html>'
    writeFileSync(join(out, 'index.html'), html)
    writeFileSync(join(out, 'numogram', 'index.html'), '<html>no assets</html>')
    writeFileSync(join(out, '404.html'), html)
    writeFileSync(join(out, '404', 'index.html'), html)

    const routes = measureRoutes(out)
    expect(Object.keys(routes)).toEqual(['/', '/numogram/'])
    expect(routes['/']).toEqual({
      htmlBytes: Buffer.byteLength(html),
      htmlGzip: gz(html),
      jsBytes: Buffer.byteLength(js),
      jsGzip: gz(js),
      cssBytes: Buffer.byteLength(css),
      cssGzip: gz(css),
    })
    expect(routes['/numogram/'].jsBytes).toBe(0)
    expect(routes['/numogram/'].cssGzip).toBe(0)
  })

  it('ignores referenced assets that do not exist on disk', () => {
    const out = tmp()
    writeFileSync(join(out, 'index.html'), '<script src="/_next/static/chunks/missing.js"></script>')
    expect(measureRoutes(out)['/'].jsBytes).toBe(0)
  })
})

describe('measureDomNodes', () => {
  it('counts element lines of every .txt golden, keyed by file name, sorted', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'b--two.txt'), '<svg>\n  <g>\n    #text x\n')
    writeFileSync(join(dir, 'a--one.txt'), '<svg>\n')
    writeFileSync(join(dir, 'ignored.json'), '<not counted>')
    const nodes = measureDomNodes(dir)
    expect(nodes).toEqual({ 'a--one': 1, 'b--two': 2 })
    expect(Object.keys(nodes)).toEqual(['a--one', 'b--two'])
  })
})

describe('CLI', () => {
  it('update refuses to run without --reason and exits 1', () => {
    const r = spawnSync(process.execPath, ['scripts/page-weight.mjs', 'update'], { cwd: ROOT, encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain('requires --reason')
  })
})

// REN-03 (Phase 6 D-06, T-06-01, T-06-08, T-06-13, T-06-14): the pure worker core and its message contract. One function
// (buildResult / handleRequest) turns a build request into the summary, the text view, the demon facet counts and, up
// to the shipped ceiling, the Canvas scene; the worker shell and the no-Worker fallback both run it. Everything here
// is checked against the independent pure functions the viewer already trusts (summarize, numogramText, resolveLayout,
// the engine scene builders), never against a copy of the core's own output. Thresholds come from the tier table.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PACKERS,
  buildPairScene,
  buildZoneScene,
  createNumogram,
  pairGraphLayout,
  resolveLayout,
  routeCurrents,
  routeGates,
  routePairGraph,
  type CanvasScene,
} from '../../engine/index'
import { formatZoneLabel, labelSchemeKey, type LabelScheme } from '../../app/lib/labelScheme'
import { VIEW_LAYOUT_IDS } from '../../app/lib/layoutIds'
import { numogramText, TEXT_VIEW_ZONE_LIMIT } from '../../app/lib/numogramText'
import { summarize } from '../../app/lib/summary'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import {
  WORKER_PROTOCOL,
  computeFailedMessage,
  isWorkerRequest,
  isWorkerResponse,
  noWorkerMessage,
  resultKey,
  type WorkerRequest,
} from '../../app/lib/worker/protocol'
import {
  buildResult,
  handleRequest,
  sceneWanted,
  transferListFor,
  type BuildOutput,
} from '../../app/lib/worker/buildResult'

const DIGITS: LabelScheme = { mode: 'digits' }
const MAX_BASE_2_26 = 67108864 // 2 ** 26, the engine's ceiling; the 2^26 build is about 0.6 s and +271 MiB (Phase 2 D-11)

function request(over: Partial<Omit<WorkerRequest, 'protocol' | 'type'>> = {}): WorkerRequest {
  return {
    protocol: WORKER_PROTOCOL,
    type: 'build',
    id: 7,
    base: 28,
    layout: 'ring',
    packer: 'shelf',
    labels: DIGITS,
    wantScene: true,
    ...over,
  }
}

function built(out: BuildOutput) {
  if (out.response.type !== 'built') throw new Error(`expected a built response, got ${JSON.stringify(out.response)}`)
  return out.response
}

function failed(out: BuildOutput) {
  if (out.response.type !== 'error') throw new Error('expected an error response')
  return out.response
}

function typedArrays(scene: CanvasScene): ArrayBufferView[] {
  return Object.values(scene).filter((v): v is ArrayBufferView => ArrayBuffer.isView(v))
}

describe('protocol: resultKey', () => {
  it('is base:layout:packer:labelSchemeKey', () => {
    expect(resultKey(28, 'ring', 'shelf', DIGITS)).toBe(`28:ring:shelf:${labelSchemeKey(DIGITS)}`)
    expect(resultKey(202, 'pairGraph', 'spiral', { mode: 'xeno' })).toBe(`202:pairGraph:spiral:${labelSchemeKey({ mode: 'xeno' })}`)
  })

  it('differs when any one part differs', () => {
    const base = resultKey(28, 'ring', 'shelf', DIGITS)
    expect(resultKey(30, 'ring', 'shelf', DIGITS)).not.toBe(base)
    expect(resultKey(28, 'ladder', 'shelf', DIGITS)).not.toBe(base)
    expect(resultKey(28, 'ring', 'spiral', DIGITS)).not.toBe(base)
    expect(resultKey(28, 'ring', 'shelf', { mode: 'xeno' })).not.toBe(base)
  })

  // NAM-03 (D-03): sounds is a real fourth label mode. Its key must differ from digits (the echoed request labels re-set the
  // scheme, so normalising it away would revert the visitor's choice); the cost is one cheap worker rebuild on a toggle.
  it('differs between digits and sounds for the same base, layout and packer', () => {
    const SOUNDS: LabelScheme = { mode: 'sounds' }
    expect(resultKey(28, 'ring', 'shelf', SOUNDS)).toBe('28:ring:shelf:sounds')
    expect(resultKey(28, 'ring', 'shelf', SOUNDS)).not.toBe(resultKey(28, 'ring', 'shelf', DIGITS))
    expect(resultKey(202, 'ring', 'spiral', SOUNDS)).not.toBe(resultKey(202, 'ring', 'spiral', DIGITS))
  })
})

describe('protocol: isWorkerRequest', () => {
  it('accepts a well-formed request for every layout id, packer and label scheme', () => {
    for (const layout of VIEW_LAYOUT_IDS) expect(isWorkerRequest(request({ layout }))).toBe(true)
    for (const packer of PACKERS) expect(isWorkerRequest(request({ packer }))).toBe(true)
    const schemes: LabelScheme[] = [
      { mode: 'digits' },
      { mode: 'xeno' },
      { mode: 'sounds' },
      { mode: 'preset', preset: 'base62' },
      { mode: 'custom', chars: ['a', 'b', 'c'] },
    ]
    for (const labels of schemes) expect(isWorkerRequest(request({ labels }))).toBe(true)
    expect(isWorkerRequest(request({ wantScene: false }))).toBe(true)
  })

  it('accepts a base that is a number even when it is not admissible (the core answers invalid-base)', () => {
    expect(isWorkerRequest(request({ base: 27 }))).toBe(true)
  })

  const bad: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'build'],
    ['an array', [request()]],
    ['a number', 7],
    ['a wrong protocol', { ...request(), protocol: 'ccrug-numogram-worker/0' }],
    ['a missing protocol', { ...request(), protocol: undefined }],
    ['a wrong type', { ...request(), type: 'cancel' }],
    ['id 0', { ...request(), id: 0 }],
    ['a negative id', { ...request(), id: -3 }],
    ['id 1.5', { ...request(), id: 1.5 }],
    ['id NaN', { ...request(), id: Number.NaN }],
    ['id Infinity', { ...request(), id: Number.POSITIVE_INFINITY }],
    ['a string id', { ...request(), id: '7' }],
    ['a string base', { ...request(), base: '28' }],
    ['a missing base', { ...request(), base: undefined }],
    ['an unknown layout', { ...request(), layout: 'evil' }],
    ['a non-string layout', { ...request(), layout: 3 }],
    ['an inherited-key layout', { ...request(), layout: 'constructor' }],
    ['an unknown packer', { ...request(), packer: 'grid' }],
    ['null labels', { ...request(), labels: null }],
    ['string labels', { ...request(), labels: 'digits' }],
    ['array labels', { ...request(), labels: [] }],
    ['labels with no mode', { ...request(), labels: {} }],
    ['labels with an unknown mode', { ...request(), labels: { mode: 'weird' } }],
    ['labels with a near-miss mode (the check is exact)', { ...request(), labels: { mode: 'Sounds' } }],
    ['labels with the plural-less mode', { ...request(), labels: { mode: 'sound' } }],
    ['a preset label scheme with an unknown preset', { ...request(), labels: { mode: 'preset', preset: 'nope' } }],
    ['a custom label scheme without chars', { ...request(), labels: { mode: 'custom' } }],
    ['a custom label scheme with a non-string char', { ...request(), labels: { mode: 'custom', chars: ['a', 2] } }],
    ['a missing wantScene', { ...request(), wantScene: undefined }],
    ['a non-boolean wantScene', { ...request(), wantScene: 1 }],
  ]
  for (const [name, value] of bad) {
    it(`rejects ${name}`, () => {
      expect(isWorkerRequest(value)).toBe(false)
    })
  }
})

describe('protocol: isWorkerResponse and the outcome copy', () => {
  it('accepts built and error responses and rejects other shapes', () => {
    const ok = built(handleRequest(request({ base: 10, layout: 'ring' })))
    expect(isWorkerResponse(ok)).toBe(true)
    expect(isWorkerResponse(failed(handleRequest('junk')))).toBe(true)
    expect(isWorkerResponse(null)).toBe(false)
    expect(isWorkerResponse('built')).toBe(false)
    expect(isWorkerResponse({ ...ok, protocol: 'other' })).toBe(false)
    expect(isWorkerResponse({ ...ok, type: 'progress' })).toBe(false)
    expect(isWorkerResponse({ ...ok, id: 1.5 })).toBe(false)
    expect(isWorkerResponse({ ...ok, id: Number.NaN })).toBe(false)
    expect(isWorkerResponse({ ...ok, base: '28' })).toBe(false)
  })

  it('words the failures exactly as the UI-SPEC does, with no dash or exclamation mark', () => {
    expect(computeFailedMessage(4002, 28)).toBe("Couldn't compute base 4002. Showing base 28.")
    expect(noWorkerMessage(4002, 28)).toBe("Base 4002 needs a background worker, which this browser can't start. Showing base 28.")
    for (const text of [computeFailedMessage(4002, 28), noWorkerMessage(4002, 28)]) {
      expect(text).not.toContain(String.fromCodePoint(0x2014))
      expect(text).not.toContain('!')
    }
  })
})

describe('buildResult: base 28, ring, shelf, digits', () => {
  const g = createNumogram(28)
  const res = built(handleRequest(request({ id: 7 })))

  it('echoes the request and builds the same key the client uses', () => {
    expect(res.protocol).toBe(WORKER_PROTOCOL)
    expect(res.id).toBe(7)
    expect(res.base).toBe(28)
    expect(res.layout).toBe('ring')
    expect(res.packer).toBe('shelf')
    expect(res.labels).toEqual(DIGITS)
    expect(res.key).toBe(resultKey(28, 'ring', 'shelf', DIGITS))
  })

  it('has the summary the viewer computes on the main thread', () => {
    expect(res.summary).toEqual(summarize(g))
    expect(res.summary.demonCount).toBe(378)
  })

  it('has the text view the viewer computes on the main thread', () => {
    expect(res.text).toBe(numogramText(g, z => formatZoneLabel(z, 28, DIGITS)))
  })

  it('applies the requested label scheme to the text', () => {
    const xeno = built(handleRequest(request({ labels: { mode: 'xeno' } })))
    expect(xeno.text).toBe(numogramText(g, z => formatZoneLabel(z, 28, { mode: 'xeno' })))
    expect(xeno.text).not.toBe(res.text)
    expect(xeno.labels).toEqual({ mode: 'xeno' })
    expect(xeno.key).toBe(resultKey(28, 'ring', 'shelf', { mode: 'xeno' }))
    expect(xeno.key).not.toBe(res.key)
  })

  // NAM-03 (D-03): the worker accepts the sounds scheme (no build-failed revert at a Canvas base) and every zone label it
  // renders stays a digit, because the node label slot reads the naming's sounds separately (plan 07-12).
  it('accepts the sounds scheme, echoing it, with digit zone labels in the text', () => {
    const sounds: LabelScheme = { mode: 'sounds' }
    const res2 = built(handleRequest(request({ labels: sounds })))
    expect(res2.labels).toEqual(sounds)
    expect(res2.key).toBe(resultKey(28, 'ring', 'shelf', sounds))
    expect(res2.key).not.toBe(res.key)
    expect(res2.text).toBe(res.text)
    expect(res2.text).toBe(numogramText(g, z => formatZoneLabel(z, 28, sounds)))
  })

  it('accepts the sounds scheme at a Canvas base too (no build-failed revert)', () => {
    const sounds: LabelScheme = { mode: 'sounds' }
    for (const base of [202, INTERACTIVE_MAX_N]) {
      const out = handleRequest(request({ base, labels: sounds, wantScene: false }))
      expect(built(out).labels).toEqual(sounds)
    }
  })

  it('has closed-form facet counts as plain objects', () => {
    expect(res.facetCounts.total).toBe(378)
    expect(res.facetCounts.types).toEqual(g.demons.typeCounts())
    expect(res.facetCounts.subtypes).toEqual(g.demons.counts())
    expect(Object.getPrototypeOf(res.facetCounts.types)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(res.facetCounts.subtypes)).toBe(Object.prototype)
    expect(Object.isFrozen(res.facetCounts.types)).toBe(false)
    expect(JSON.parse(JSON.stringify(res.facetCounts))).toEqual(res.facetCounts)
  })

  it('has a zone scene whose coordinates are the engine layout the viewer would draw', () => {
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const scene = res.scene
    expect(scene).not.toBeNull()
    expect(scene?.kind).toBe('zones')
    expect(scene?.layoutId).toBe('ring')
    expect(scene?.x).toEqual(layout.x)
    expect(scene?.y).toEqual(layout.y)
  })

  it('has exactly the scene the engine builder makes from the same layout and routes', () => {
    const layout = resolveLayout(g, 'ring', [], { packer: 'shelf' })
    const expected = buildZoneScene(g, layout, routeGates(g, layout), routeCurrents(g, layout))
    expect(res.scene).toEqual(expected)
  })

  it('honours the packer (base 66 is the smallest base where the packer moves the ring and the pair graph)', () => {
    const g66 = createNumogram(66)
    const shelfRing = resolveLayout(g66, 'ring', [], { packer: 'shelf' })
    const spiralRing = resolveLayout(g66, 'ring', [], { packer: 'spiral' })
    expect(spiralRing.x).not.toEqual(shelfRing.x) // the two packers really differ here, so the next lines can tell them apart
    const ring = built(handleRequest(request({ base: 66, packer: 'spiral' })))
    expect(ring.packer).toBe('spiral')
    expect(ring.scene?.x).toEqual(spiralRing.x)
    expect(built(handleRequest(request({ base: 66, packer: 'shelf' }))).scene?.x).toEqual(shelfRing.x)

    const shelfPg = pairGraphLayout(g66, { packer: 'shelf' })
    const spiralPg = pairGraphLayout(g66, { packer: 'spiral' })
    expect(spiralPg.px).not.toEqual(shelfPg.px)
    expect(built(handleRequest(request({ base: 66, layout: 'pairGraph', packer: 'spiral' }))).scene?.px).toEqual(spiralPg.px)
    expect(built(handleRequest(request({ base: 66, layout: 'pairGraph', packer: 'shelf' }))).scene?.px).toEqual(shelfPg.px)
  })
})

describe('buildResult: layouts', () => {
  it('builds a pairs scene for the pair graph, equal to the engine builder', () => {
    const g = createNumogram(28)
    const pg = pairGraphLayout(g, { packer: 'shelf' })
    const res = built(handleRequest(request({ layout: 'pairGraph' })))
    expect(res.scene?.kind).toBe('pairs')
    expect(res.scene).toEqual(buildPairScene(g, pg, routePairGraph(g, pg)))
  })

  it('builds zone scenes for the ladder and the spiral at a procedural base', () => {
    for (const layout of ['ladder', 'spiral'] as const) {
      const res = built(handleRequest(request({ layout })))
      expect(res.scene?.kind).toBe('zones')
      expect(res.scene?.layoutId).toBe(layout)
    }
  })

  it('draws the procedural ring at base 10 but never a base-10 preset (presets stay SVG)', () => {
    expect(built(handleRequest(request({ base: 10, layout: 'ring' }))).scene?.kind).toBe('zones')
    for (const layout of ['original', 'labyrinth', 'ladder', 'planetary'] as const) {
      const res = built(handleRequest(request({ base: 10, layout })))
      expect(res.scene).toBeNull()
      expect(res.summary.demonCount).toBe(45)
    }
  })

  it('builds no scene when none is wanted, at any base', () => {
    expect(built(handleRequest(request({ wantScene: false }))).scene).toBeNull()
    expect(built(handleRequest(request({ base: INTERACTIVE_MAX_N, wantScene: false }))).scene).toBeNull()
  })

  it('refuses a layout that is not offered at the base, naming it', () => {
    expect(() => buildResult(request({ layout: 'labyrinth' }))).toThrow(RangeError)
    const err = failed(handleRequest(request({ layout: 'labyrinth' })))
    expect(err.reason).toBe('build-failed')
    expect(err.message).toContain('labyrinth')
    expect(err.id).toBe(7)
    expect(err.base).toBe(28)
  })
})

describe('buildResult: the scene guard (T-06-01)', () => {
  it('builds the scene at the ceiling itself', () => {
    const res = built(handleRequest(request({ base: INTERACTIVE_MAX_N })))
    expect(res.scene?.kind).toBe('zones')
    expect(res.scene?.base).toBe(INTERACTIVE_MAX_N)
    expect(res.text).toContain(`CCRUG numogram, base ${INTERACTIVE_MAX_N}`)
    expect(res.text).not.toContain('listings are shown up to')
  })

  it('builds no scene one step above the ceiling, for any layout, but still the summary and the limit line', () => {
    const above = INTERACTIVE_MAX_N + 2
    for (const layout of ['ring', 'ladder', 'spiral', 'pairGraph'] as const) {
      const res = built(handleRequest(request({ base: above, layout, wantScene: true })))
      expect(res.scene).toBeNull()
      expect(res.summary.base).toBe(above)
      expect(res.text).toContain(`Zone, syzygy and gate listings are shown up to ${TEXT_VIEW_ZONE_LIMIT} zones.`)
    }
  })

  it('answers base 2^26 with the bounded summary and text only', () => {
    const res = built(handleRequest(request({ base: MAX_BASE_2_26, layout: 'ring', wantScene: true })))
    expect(res.scene).toBeNull()
    expect(res.summary.base).toBe(MAX_BASE_2_26)
    expect(res.summary.zoneCount).toBe(MAX_BASE_2_26)
    expect(res.text.length).toBeLessThan(4000)
    expect(res.facetCounts.total).toBe(res.summary.demonCount)
  })

  it('sceneWanted follows the ceiling, the preset rule and wantScene', () => {
    expect(sceneWanted({ base: INTERACTIVE_MAX_N, layout: 'ring', wantScene: true })).toBe(true)
    expect(sceneWanted({ base: INTERACTIVE_MAX_N + 2, layout: 'ring', wantScene: true })).toBe(false)
    expect(sceneWanted({ base: 28, layout: 'ring', wantScene: false })).toBe(false)
    expect(sceneWanted({ base: 10, layout: 'original', wantScene: true })).toBe(false)
    expect(sceneWanted({ base: 10, layout: 'ring', wantScene: true })).toBe(true)
    expect(sceneWanted({ base: 28, layout: 'ladder', wantScene: true })).toBe(true)
  })
})

describe('handleRequest never throws (T-06-08)', () => {
  it('turns a malformed request into a build-failed response, with id -1 when there is no usable id', () => {
    for (const junk of ['junk', null, undefined, 42, [], {}]) {
      const out = handleRequest(junk)
      const err = failed(out)
      expect(err.protocol).toBe(WORKER_PROTOCOL)
      expect(err.reason).toBe('build-failed')
      expect(err.message).toBe('malformed worker request')
      expect(err.id).toBe(-1)
      expect(err.base).toBe(-1)
      expect(out.transfer).toEqual([])
    }
  })

  it('keeps the id and base of a malformed request when they are usable', () => {
    const err = failed(handleRequest({ ...request(), packer: 'grid', id: 12, base: 44 }))
    expect(err.reason).toBe('build-failed')
    expect(err.id).toBe(12)
    expect(err.base).toBe(44)
    const noId = failed(handleRequest({ ...request(), layout: 'evil', id: 1.5, base: 'x' }))
    expect(noId.id).toBe(-1)
    expect(noId.base).toBe(-1)
  })

  it('reports an odd base and an absurd base as invalid-base with the engine message', () => {
    const odd = handleRequest({ ...request(), base: 27 })
    expect(failed(odd).reason).toBe('invalid-base')
    expect(failed(odd).message).toContain('27')
    expect(failed(odd).id).toBe(7)
    expect(odd.transfer).toEqual([])
    const huge = handleRequest({ ...request(), base: 99999999999 })
    expect(failed(huge).reason).toBe('invalid-base')
    expect(failed(huge).base).toBe(99999999999)
    const nan = handleRequest({ ...request(), base: Number.NaN })
    expect(failed(nan).reason).toBe('invalid-base')
  })

  it('survives hostile objects whose fields throw', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('boom')
        },
        has() {
          throw new Error('boom')
        },
      },
    )
    expect(isWorkerRequest(hostile)).toBe(false)
    const out = handleRequest(hostile)
    expect(failed(out).reason).toBe('build-failed')
    expect(failed(out).message).toBe('malformed worker request')
    expect(failed(out).id).toBe(-1)
    expect(failed(out).base).toBe(-1)
  })
})

describe('transferListFor (T-06-13, P15)', () => {
  it('is empty without a scene', () => {
    expect(transferListFor(null)).toEqual([])
  })

  it('lists every typed-array buffer of a zone scene exactly once', () => {
    const scene = built(handleRequest(request())).scene
    expect(scene).not.toBeNull()
    if (scene === null) return
    const list = transferListFor(scene)
    expect(new Set(list).size).toBe(list.length)
    expect(list.length).toBe(typedArrays(scene).length)
    for (const view of typedArrays(scene)) expect(list).toContain(view.buffer)
  })

  it('lists every typed-array buffer of a pair scene exactly once, the empty arrays included', () => {
    const scene = built(handleRequest(request({ layout: 'pairGraph' }))).scene
    expect(scene).not.toBeNull()
    if (scene === null) return
    const list = transferListFor(scene)
    expect(new Set(list).size).toBe(list.length)
    expect(list.length).toBe(typedArrays(scene).length)
    // a pair scene carries the two pill-centre arrays (px, py) on top of every array a zone scene has
    const zoneScene = built(handleRequest(request())).scene as CanvasScene
    expect(typedArrays(scene).length).toBe(typedArrays(zoneScene).length + 2)
  })

  it('is what handleRequest returns, and a real structured-clone transfer accepts it and detaches the buffers', () => {
    const out = handleRequest(request())
    const res = built(out)
    const scene = res.scene as CanvasScene
    expect(out.transfer.length).toBe(typedArrays(scene).length)
    const xBefore = Array.from(scene.x)
    const clone = structuredClone(res, { transfer: out.transfer }) as typeof res
    expect(Array.from(clone.scene?.x ?? [])).toEqual(xBefore)
    expect(scene.x.buffer.byteLength).toBe(0)
    expect(clone.summary).toEqual(res.summary)
  })

  it('returns no transfer list when no scene was built', () => {
    expect(handleRequest(request({ wantScene: false })).transfer).toEqual([])
    expect(handleRequest(request({ base: INTERACTIVE_MAX_N + 2 })).transfer).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------
// T-06-14: the worker bundle must carry no base-10 lore. Walk the relative imports from the core, statically.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FORBIDDEN_DIRS = ['app/presets/', 'app/data/']
const FORBIDDEN_FILES = ['app/lib/numogramView.ts', 'app/lib/demonBrowser.ts', 'app/lib/demonState.ts']
const IMPORT_RES = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
  for (const c of candidates) if (existsSync(c) && /\.(tsx?|json)$/.test(c)) return c
  return null
}

/** Every repo-relative file reachable through relative imports from `entry`, plus the bare (package) imports met. */
function importGraph(entry: string): { files: string[]; bare: string[]; unresolved: string[] } {
  const seen = new Set<string>()
  const bare = new Set<string>()
  const unresolved: string[] = []
  const stack = [path.resolve(REPO, entry)]
  while (stack.length > 0) {
    const file = stack.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (file.endsWith('.json')) continue
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const re of IMPORT_RES) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        const spec = m[1] as string
        if (!spec.startsWith('.')) {
          bare.add(spec)
          continue
        }
        const resolved = resolveImport(file, spec)
        if (resolved === null) unresolved.push(`${path.relative(REPO, file)} -> ${spec}`)
        else stack.push(resolved)
      }
    }
  }
  return {
    files: [...seen].map(f => path.relative(REPO, f).split(path.sep).join('/')).sort(),
    bare: [...bare].sort(),
    unresolved,
  }
}

function forbiddenIn(files: readonly string[]): string[] {
  return files.filter(f => FORBIDDEN_DIRS.some(d => f.startsWith(d)) || FORBIDDEN_FILES.includes(f))
}

describe('the worker core import graph is lore-free (T-06-14)', () => {
  it('the walker sees base-10 lore from the viewer model, so a clean result below means something', () => {
    const viewGraph = importGraph('app/lib/numogramView.ts')
    expect(viewGraph.unresolved).toEqual([])
    expect(forbiddenIn(viewGraph.files)).toContain('app/presets/base10/lore.ts')
  })

  it('reaches no preset, no app/data file, and none of the lore-carrying lib files', () => {
    const graph = importGraph('app/lib/worker/buildResult.ts')
    expect(graph.unresolved).toEqual([])
    expect(graph.files).toContain('app/lib/worker/buildResult.ts')
    expect(graph.files).toContain('app/lib/summary.ts')
    expect(graph.files).toContain('app/lib/numogramText.ts')
    expect(graph.files).toContain('engine/index.ts')
    expect(forbiddenIn(graph.files)).toEqual([])
  })

  it('reaches no package at all (engine and first-party modules only)', () => {
    expect(importGraph('app/lib/worker/buildResult.ts').bare).toEqual([])
  })

  it('the protocol module alone is lore-free as well', () => {
    expect(forbiddenIn(importGraph('app/lib/worker/protocol.ts').files)).toEqual([])
  })
})

// Tests for app/lib/shareParams.ts, the viewer's single URL codec (UI-02, D-13, D-21, todo 005). base is strict and
// user-visible when refused (D-06); every other field is lenient per field so a hand-edited or stale link still
// loads. The legacy-corpus and clipboard-url tests below only ever *read* the frozen behaviour baseline under
// e2e/__behaviour__ (node:fs, no write, no -u) — the same never-regenerate rule as every other frozen fixture.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createNumogram, PACKERS, type RenderTier } from '../../engine/index'
import { ALPHABET_PRESET_IDS } from '../../app/lib/customAlphabet'
import type { LabelScheme } from '../../app/lib/labelScheme'
import { layoutIdsForBase } from '../../app/lib/layoutIds'
import { regionRows } from '../../app/lib/regions'
import {
  DEFAULT_LAYERS,
  buildShareParams,
  defaultShareState,
  parseShareParams,
  type ParsedShare,
  type ShareState,
} from '../../app/lib/shareParams'

function assertRefusalReason(baseRefusal: ParsedShare['baseRefusal'], reason: string): void {
  expect(baseRefusal).not.toBeNull()
  const check = baseRefusal?.check ?? null
  expect(check).not.toBeNull()
  if (check && !check.ok) {
    expect(check.reason).toBe(reason)
  } else {
    throw new Error('expected a refused (ok: false) base check')
  }
}

describe('parseShareParams', () => {
  it('empty input defaults to base 10 with no refusal', () => {
    for (const input of ['', '?']) {
      const { state, baseRefusal } = parseShareParams(input)
      expect(state).toEqual(defaultShareState(10))
      expect(baseRefusal).toBeNull()
    }
  })

  it('defaultShareState(10) matches the upstream viewer defaults', () => {
    expect(defaultShareState(10)).toEqual({
      base: 10,
      layout: 'original',
      layers: ['syzygies', 'currents', 'gates'],
      selected: [],
      region: null,
      tc: false,
      particles: false,
      date: '',
      orbits: true,
      labels: { mode: 'digits' },
      isolate: [],
      mute: [],
      packer: 'shelf',
      tier: null,
    })
  })

  it('defaultShareState(28) uses the procedural ring layout', () => {
    expect(defaultShareState(28).layout).toBe('ring')
  })

  it('base=28 selects base 28 and its default layout, with no refusal', () => {
    const { state, baseRefusal } = parseShareParams('?base=28')
    expect(state.base).toBe(28)
    expect(state.layout).toBe('ring')
    expect(baseRefusal).toBeNull()
  })

  it('base=10 stays base 10', () => {
    expect(parseShareParams('?base=10').state.base).toBe(10)
  })

  it('URL-decoded whitespace around a base value is trimmed before validation', () => {
    const { state, baseRefusal } = parseShareParams('?base=%2028%20')
    expect(state.base).toBe(28)
    expect(baseRefusal).toBeNull()
  })

  it('refuses an odd base, keeping base 10 and reporting why', () => {
    const { state, baseRefusal } = parseShareParams('?base=27')
    expect(state.base).toBe(10)
    expect(baseRefusal?.raw).toBe('27')
    assertRefusalReason(baseRefusal, 'odd')
  })

  it('refuses a base above the safe ceiling', () => {
    const { state, baseRefusal } = parseShareParams('?base=99999999998')
    expect(state.base).toBe(10)
    assertRefusalReason(baseRefusal, 'too-large')
  })

  it('refuses base 0', () => {
    const { state, baseRefusal } = parseShareParams('?base=0')
    expect(state.base).toBe(10)
    assertRefusalReason(baseRefusal, 'zero')
  })

  it('refuses malformed base text (not a plain decimal integer) with a null check', () => {
    for (const raw of ['1e3', '0x10', '28abc', '1'.repeat(17)]) {
      const { state, baseRefusal } = parseShareParams(`?base=${raw}`)
      expect(state.base).toBe(10)
      expect(baseRefusal).not.toBeNull()
      expect(baseRefusal?.check).toBeNull()
    }
  })

  it('layout falls back to the base default when the requested layout is not offered at that base', () => {
    expect(parseShareParams('?base=28&layout=planetary').state.layout).toBe('ring')
  })

  it('a base-10 layout id is kept as-is', () => {
    expect(parseShareParams('?layout=labyrinth').state.layout).toBe('labyrinth')
  })

  it('an unknown layout falls back to the base default', () => {
    expect(parseShareParams('?layout=bogus').state.layout).toBe('original')
  })

  it('layers= present but empty yields no layers', () => {
    expect(parseShareParams('?layers=').state.layers).toEqual([])
  })

  it('layers= drops unknown tokens, keeping the known ones', () => {
    expect(parseShareParams('?layers=gates,bogus').state.layers).toEqual(['gates'])
  })

  it('selected drops out-of-range, non-integer and duplicate tokens, sorted ascending', () => {
    expect(parseShareParams('?base=28&selected=0,27,28,-1,1.5,x,27').state.selected).toEqual([0, 27])
  })

  it('selected accepts a percent-encoded comma list', () => {
    expect(parseShareParams('?selected=5%2C6').state.selected).toEqual([5, 6])
  })

  it('region is validated against the parsed base', () => {
    expect(parseShareParams('?region=torque').state.region).toBe('torque')
    expect(parseShareParams('?base=28&region=torque:1').state.region).toBe('torque:1')
  })

  it('region rejects a value that is never a valid region id, without using it as a property key', () => {
    expect(parseShareParams('?region=__proto__').state.region).toBeNull()
  })

  it('isolate/mute drop stale or out-of-range ids and allow the same region in both lists', () => {
    const { state } = parseShareParams('?base=12&isolate=torque:5,warp,plex&mute=plex')
    expect(state.isolate).toEqual(['plex'])
    expect(state.mute).toEqual(['plex'])
  })

  it('labels reads a valid scheme and falls back to digits on an invalid one', () => {
    expect(parseShareParams('?labels=xeno').state.labels).toEqual({ mode: 'xeno' })
    expect(parseShareParams('?labels=custom:abca').state.labels).toEqual({ mode: 'digits' })
  })

  it('packer accepts a known value and falls back to shelf otherwise', () => {
    expect(parseShareParams('?packer=spiral').state.packer).toBe('spiral')
    expect(parseShareParams('?packer=zig').state.packer).toBe('shelf')
  })

  it('tier accepts an allowed override and rejects anything else', () => {
    expect(parseShareParams('?tier=svg').state.tier).toBe('svg')
    expect(parseShareParams('?tier=gpu').state.tier).toBeNull()
  })

  it('date is kept on any layout when it is a real calendar date', () => {
    expect(parseShareParams('?date=2000-01-01').state.date).toBe('2000-01-01')
    expect(parseShareParams('?layout=labyrinth&date=2000-01-01').state.date).toBe('2000-01-01')
  })

  it('date is dropped when it is not a real calendar date', () => {
    expect(parseShareParams('?date=2000-13-45').state.date).toBe('')
  })

  it('orbits, tc and particles read their boolean flags', () => {
    expect(parseShareParams('?orbits=0').state.orbits).toBe(false)
    expect(parseShareParams('').state.orbits).toBe(true)
    expect(parseShareParams('?tc=1').state.tc).toBe(true)
    expect(parseShareParams('?particles=1').state.particles).toBe(true)
  })

  it('ignores unknown keys entirely', () => {
    const { state } = parseShareParams('?bogus=1&base=28')
    expect(state.base).toBe(28)
  })

  it('never throws on any hostile input', () => {
    const hostiles = [
      '?base=' + '9'.repeat(10000),
      '?region=' + encodeURIComponent('constructor'),
      '?isolate=' + encodeURIComponent('__proto__,constructor'),
      '?labels=' + encodeURIComponent('custom:' + String.fromCodePoint(0x202e).repeat(50)),
      '?selected=' + Array.from({ length: 500 }, (_, i) => i).join(','),
    ]
    for (const input of hostiles) {
      expect(() => parseShareParams(input)).not.toThrow()
    }
  })
})

describe('buildShareParams', () => {
  it('the base-10 default state builds an empty query, or just layout= with includeLayoutAlways', () => {
    expect(buildShareParams(defaultShareState(10)).toString()).toBe('')
    expect(buildShareParams(defaultShareState(10), { includeLayoutAlways: true }).toString()).toBe('layout=original')
  })

  it('a non-10 default state writes base= only (its layout already matches the base default)', () => {
    expect(buildShareParams(defaultShareState(28)).toString()).toBe('base=28')
  })

  it('base 10 never writes base=, even with includeLayoutAlways', () => {
    const state = { ...defaultShareState(10), selected: [5] }
    expect(buildShareParams(state).toString()).not.toMatch(/(^|&)base=/)
  })

  it('new-this-phase keys are omitted at their default and comma-joined+sorted otherwise', () => {
    const g = createNumogram(10)
    const base = defaultShareState(10)
    expect(buildShareParams(base).toString()).toBe('')

    const withLabels = { ...base, labels: { mode: 'xeno' } as LabelScheme }
    expect(buildShareParams(withLabels).toString()).toBe('labels=xeno')

    const withIsolateMute = { ...base, isolate: regionRows(g).map((r) => r.id), mute: ['plex'] as const }
    const q = buildShareParams(withIsolateMute).toString()
    expect(q).toContain('isolate=')
    expect(q).toContain('mute=plex')

    const withPacker = { ...base, packer: 'spiral' as const }
    expect(buildShareParams(withPacker).toString()).toBe('packer=spiral')

    const withTier = { ...base, tier: 'canvas' as RenderTier }
    expect(buildShareParams(withTier).toString()).toBe('tier=canvas')
  })

  it('keys are always sorted with localeCompare regardless of set() order', () => {
    const state: ShareState = { ...defaultShareState(28), tc: true, particles: true, region: 'plex' }
    const q = buildShareParams(state).toString()
    const keys = Array.from(new URLSearchParams(q).keys())
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)))
  })
})

// ---- frozen-baseline legacy corpus (read-only; e2e/__behaviour__ is never written by this file) ----

interface BehaviourEntry {
  readonly name: string
  readonly value: unknown
}
interface BehaviourFile {
  readonly schema: unknown
  readonly layout: string
  readonly stages: unknown
  readonly behaviours: readonly BehaviourEntry[]
}

const BEHAVIOUR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../e2e/__behaviour__')
const LEGACY_BEHAVIOUR_FILES = ['original.json', 'labyrinth.json', 'ladder.json', 'planetary.json']
const MASKED_CAPTURE_DATE = '2000-01-01'

function loadBehaviours(file: string): readonly BehaviourEntry[] {
  const raw = readFileSync(path.join(BEHAVIOUR_DIR, file), 'utf8')
  return (JSON.parse(raw) as BehaviourFile).behaviours
}

function urlSearchFromValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') throw new Error('expected a string url value in the behaviour corpus')
  return raw.replace('DATE', MASKED_CAPTURE_DATE)
}

function loadLegacyCorpus(): readonly string[] {
  const corpus: string[] = []
  for (const file of LEGACY_BEHAVIOUR_FILES) {
    for (const behaviour of loadBehaviours(file)) {
      if (!/url/i.test(behaviour.name)) continue
      corpus.push(urlSearchFromValue(behaviour.value))
    }
  }
  return corpus
}

describe('legacy corpus', () => {
  const corpus = loadLegacyCorpus()

  it('has at least 30 recorded URLs from the frozen behaviour baseline', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(30)
  })

  it('every recorded URL round-trips byte for byte through parse then build', () => {
    for (const search of corpus) {
      const { state } = parseShareParams(search)
      expect(`?${buildShareParams(state).toString()}`).toBe(search)
    }
  })

  it('the recorded share clipboard URL rebuilds with includeLayoutAlways', () => {
    const clipboard = loadBehaviours('original.json').find((b) => b.name === 'share button: clipboard text')
    if (clipboard === undefined) throw new Error('missing "share button: clipboard text" behaviour in original.json')
    const raw = clipboard.value
    if (typeof raw !== 'string') throw new Error('expected a string clipboard url')
    const query = raw.slice(raw.indexOf('?') + 1)
    const { state } = parseShareParams(query)
    expect(buildShareParams(state, { includeLayoutAlways: true }).toString()).toBe(query)
  })
})

// ---- e2e/golden.spec.ts's STATES + PIN, mirrored here (not imported: that file is a Playwright spec) ----

const GOLDEN_PIN = 'date=2000-01-01&orbits=0&particles=0'
const GOLDEN_STATES: Record<string, string> = {
  default: '',
  'layer-syzygies': 'layers=syzygies',
  'layer-currents': 'layers=currents',
  'layer-gates': 'layers=gates',
  'layer-pandemonium': 'layers=pandemonium',
  'region-plex': 'region=plex',
  'region-warp': 'region=warp',
  'region-torque': 'region=torque',
  'zone-5': 'selected=5',
  'time-circuit': 'tc=1',
}
const GOLDEN_EXPECTATIONS: Record<string, Partial<ShareState>> = {
  'layer-syzygies': { layers: ['syzygies'] },
  'layer-currents': { layers: ['currents'] },
  'layer-gates': { layers: ['gates'] },
  'layer-pandemonium': { layers: ['pandemonium'] },
  'region-plex': { region: 'plex' },
  'region-warp': { region: 'warp' },
  'region-torque': { region: 'torque' },
  'zone-5': { selected: [5] },
  'time-circuit': { tc: true },
}

describe('golden states', () => {
  for (const [name, qs] of Object.entries(GOLDEN_STATES)) {
    it(`${name} parses to the expected layout/layers/region/selected/tc`, () => {
      const query = [qs, GOLDEN_PIN].filter(Boolean).join('&')
      const { state } = parseShareParams(`?${query}`)
      const expected = GOLDEN_EXPECTATIONS[name] ?? {}
      expect(state.layout).toBe('original')
      expect(state.layers).toEqual(expected.layers ?? DEFAULT_LAYERS)
      expect(state.region).toEqual(expected.region ?? null)
      expect(state.selected).toEqual(expected.selected ?? [])
      expect(state.tc).toBe(expected.tc ?? false)
    })
  }
})

// ---- property round trip over arbitrary Phase 4 states ----

describe('round trip', () => {
  const BASES = [2, 10, 12, 28, 64] as const
  const TIERS: readonly (RenderTier | null)[] = [null, 'svg', 'canvas', 'headless']
  const LABEL_SCHEMES: readonly LabelScheme[] = [
    { mode: 'digits' },
    { mode: 'xeno' },
    ...ALPHABET_PRESET_IDS.map((preset) => ({ mode: 'preset', preset }) as LabelScheme),
  ]

  function arbitraryState(base: number): fc.Arbitrary<ShareState> {
    const g = createNumogram(base)
    const regionIds = regionRows(g).map((r) => r.id)
    const regionIdArb = fc.constantFrom(...regionIds)
    return fc
      .record({
        layout: fc.constantFrom(...layoutIdsForBase(base)),
        selected: fc.uniqueArray(fc.integer({ min: 0, max: base - 1 }), { maxLength: Math.min(base, 6) }),
        region: fc.option(regionIdArb, { nil: null }),
        tc: fc.boolean(),
        particles: fc.boolean(),
        date: fc.constantFrom('', MASKED_CAPTURE_DATE),
        orbits: fc.boolean(),
        labels: fc.constantFrom(...LABEL_SCHEMES),
        isolate: fc.uniqueArray(regionIdArb, { maxLength: regionIds.length }),
        mute: fc.uniqueArray(regionIdArb, { maxLength: regionIds.length }),
        packer: fc.constantFrom(...PACKERS),
        tier: fc.constantFrom(...TIERS),
      })
      .map(
        (partial): ShareState => ({
          base,
          layout: partial.layout,
          layers: DEFAULT_LAYERS,
          selected: [...partial.selected].sort((a, b) => a - b),
          region: partial.region,
          tc: partial.tc,
          particles: partial.particles,
          date: partial.date,
          orbits: partial.orbits,
          labels: partial.labels,
          isolate: [...partial.isolate].sort((a, b) => a.localeCompare(b)),
          mute: [...partial.mute].sort((a, b) => a.localeCompare(b)),
          packer: partial.packer,
          tier: partial.tier,
        }),
      )
  }

  for (const base of BASES) {
    it(`round-trips arbitrary states at base ${base}`, () => {
      fc.assert(
        fc.property(arbitraryState(base), (state) => {
          const url = buildShareParams(state)
          const parsed = parseShareParams(url).state
          expect(parsed.base).toBe(state.base)
          expect(parsed.layout).toBe(state.layout)
          expect(parsed.selected).toEqual(state.selected)
          expect(parsed.region).toEqual(state.region)
          expect(parsed.tc).toBe(state.tc)
          expect(parsed.particles).toBe(state.particles)
          expect(parsed.labels).toEqual(state.labels)
          expect(parsed.isolate).toEqual(state.isolate)
          expect(parsed.mute).toEqual(state.mute)
          expect(parsed.packer).toBe(state.packer)
          expect(parsed.tier).toBe(state.tier)
          if (state.layout === 'planetary') {
            expect(parsed.date).toBe(state.date)
            expect(parsed.orbits).toBe(state.orbits)
          }
        }),
        { seed: 20260928, numRuns: 50 },
      )
    })
  }
})

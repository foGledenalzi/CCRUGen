// Tests for app/lib/shareParams.ts, the viewer's single URL codec (UI-02, D-13, D-21, todo 005). base is strict and
// user-visible when refused (D-06); every other field is lenient per field so a hand-edited or stale link still
// loads. Never reads/writes anything under e2e/__behaviour__ except as a read-only corpus (see the buildShareParams
// describe blocks below).
import { describe, expect, it } from 'vitest'
import {
  defaultShareState,
  parseShareParams,
  type ParsedShare,
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
      '?labels=' + encodeURIComponent('custom:' + '‮'.repeat(50)),
      '?selected=' + Array.from({ length: 500 }, (_, i) => i).join(','),
    ]
    for (const input of hostiles) {
      expect(() => parseShareParams(input)).not.toThrow()
    }
  })
})

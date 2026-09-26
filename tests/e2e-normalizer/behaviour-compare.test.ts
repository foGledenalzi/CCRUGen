import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { baselineAction, diffBaseline, normalizeDeep } from '../../e2e/behaviour-compare'
import { ROOT } from '../../scripts/golden-manifest.mjs'

// Unit tests for the pure helpers of the behaviour baseline (D-15). They replace a mutation run against
// app/data (editing tracked app files is not allowed while other plans run): they show that the comparison
// the Playwright spec relies on reports a single changed lore string, and that capture never overwrites.
// Hand-made inputs use placeholder strings; the real-baseline case only reads e2e/__behaviour__/original.json.

const handMade = () => ({
  schema: 1,
  layout: 'original',
  stages: { initial: { url: '/numogram/', texts: { Gates: 'lore A', Zones: 'lore B' }, open: { Layers: true } } },
  behaviours: [
    { name: 'first', value: 'lore C' },
    { name: 'second', value: [1, 2, 3] },
  ],
})

describe('diffBaseline', () => {
  it('is empty for a deep-equal copy', () => {
    const x = handMade()
    expect(diffBaseline(x, structuredClone(x))).toEqual([])
  })

  it('ignores key order', () => {
    expect(diffBaseline({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toEqual([])
  })

  it('reports one changed lore-like string as exactly one entry naming its path', () => {
    const x = handMade()
    const y = structuredClone(x)
    y.stages.initial.texts.Gates = 'lore A2'
    const diffs = diffBaseline(x, y)
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toContain('stages.initial.texts.Gates')
    expect(diffs[0]).toContain('"lore A"')
    expect(diffs[0]).toContain('"lore A2"')
  })

  it('reports a removed key, an added key and a changed array length, one entry each', () => {
    const removed = handMade()
    delete (removed.stages.initial.texts as Record<string, string>).Zones
    const removedDiffs = diffBaseline(handMade(), removed)
    expect(removedDiffs).toHaveLength(1)
    expect(removedDiffs[0]).toContain('stages.initial.texts.Zones')
    expect(removedDiffs[0]).toContain('missing in actual')

    const added = handMade() as ReturnType<typeof handMade> & { extra?: number }
    added.extra = 7
    const addedDiffs = diffBaseline(handMade(), added)
    expect(addedDiffs).toHaveLength(1)
    expect(addedDiffs[0]).toContain('$.extra')
    expect(addedDiffs[0]).toContain('unexpected in actual')

    const longer = handMade()
    ;(longer.behaviours[1]!.value as number[]).push(4)
    const lengthDiffs = diffBaseline(handMade(), longer)
    expect(lengthDiffs).toHaveLength(1)
    expect(lengthDiffs[0]).toContain('behaviours[1].value')
    expect(lengthDiffs[0]).toContain('length 3 != 4')

    const shorter = handMade()
    shorter.behaviours.pop()
    expect(diffBaseline(handMade(), shorter)).toHaveLength(1)
  })

  it('reports a type change and a changed array element', () => {
    const x = handMade()
    const y = structuredClone(x)
    ;(y.behaviours[0] as { value: unknown }).value = 5
    ;(y.behaviours[1]!.value as number[])[2] = 9
    const diffs = diffBaseline(x, y)
    expect(diffs).toHaveLength(2)
    expect(diffs.some(d => d.includes('behaviours[0].value'))).toBe(true)
    expect(diffs.some(d => d.includes('behaviours[1].value[2]'))).toBe(true)
  })

  it('names keys that are not plain identifiers with brackets, and bounds the size of a message', () => {
    const x = { stages: { 'zone5+syzygies-layer-toggled': { note: 'x'.repeat(5000) } } }
    const y = { stages: { 'zone5+syzygies-layer-toggled': { note: 'y'.repeat(5000) } } }
    const diffs = diffBaseline(x, y)
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toContain('$.stages["zone5+syzygies-layer-toggled"].note')
    expect(diffs[0]!.length).toBeLessThan(500)
  })

  it('treats null, arrays and objects as different kinds', () => {
    expect(diffBaseline({ v: null }, { v: {} })).toHaveLength(1)
    expect(diffBaseline({ v: [] }, { v: {} })).toHaveLength(1)
    expect(diffBaseline({ v: 0 }, { v: false })).toHaveLength(1)
  })
})

describe('the frozen original.json is not vacuous', () => {
  const file = path.join(ROOT, 'e2e', '__behaviour__', 'original.json')
  const text = readFileSync(file, 'utf8')

  it('is deep-equal to a copy of itself', () => {
    expect(diffBaseline(JSON.parse(text), JSON.parse(text))).toEqual([])
  })

  it('changing one character of one recorded lore-sweep string makes diffBaseline report it', () => {
    const expected = JSON.parse(text) as { behaviours: { name: string; value: { Selection: string } }[] }
    const actual = structuredClone(expected)
    const index = actual.behaviours.findIndex(b => b.name === 'lore sweep Gates row 2')
    expect(index).toBeGreaterThanOrEqual(0)
    const original = actual.behaviours[index]!.value.Selection
    expect(original.length).toBeGreaterThan(200)
    const at = Math.floor(original.length / 2)
    const swapped = original[at] === 'x' ? 'y' : 'x'
    actual.behaviours[index]!.value.Selection = original.slice(0, at) + swapped + original.slice(at + 1)
    expect(actual.behaviours[index]!.value.Selection).not.toBe(original)

    const diffs = diffBaseline(expected, actual)
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toContain(`behaviours[${index}].value.Selection`)
  })

  it('all five frozen baselines carry the schema, a layout, stages and behaviours', () => {
    for (const name of ['original', 'labyrinth', 'ladder', 'planetary', 'mobile']) {
      const j = JSON.parse(readFileSync(path.join(ROOT, 'e2e', '__behaviour__', `${name}.json`), 'utf8')) as Record<string, unknown>
      expect(j.schema, name).toBe(1)
      expect(typeof j.layout, name).toBe('string')
      expect(Object.keys(j.stages as object).length, name).toBeGreaterThan(0)
      expect(Array.isArray(j.behaviours), name).toBe(true)
    }
  })
})

describe('normalizeDeep', () => {
  it('masks dates and the origin in nested strings and leaves numbers, booleans and null alone', () => {
    const input = {
      url: '/numogram/?date=2000-01-01&layers=currents',
      share: 'http://127.0.0.1:3111/numogram/?date=2024-12-31',
      nested: [{ a: ['on 2000-01-01 and 2001-02-03', 'http://127.0.0.1:3111'] }],
      n: 42,
      f: 1.5,
      t: true,
      z: null,
    }
    const out = normalizeDeep(input, 'http://127.0.0.1:3111')
    expect(out).toEqual({
      url: '/numogram/?date=DATE&layers=currents',
      share: 'ORIGIN/numogram/?date=DATE',
      nested: [{ a: ['on DATE and DATE', 'ORIGIN'] }],
      n: 42,
      f: 1.5,
      t: true,
      z: null,
    })
    expect(input.url).toBe('/numogram/?date=2000-01-01&layers=currents') // the input is not mutated
  })

  it('masks every occurrence, leaves object keys alone and does nothing to unrelated text', () => {
    const origin = 'http://127.0.0.1:3111'
    const out = normalizeDeep({ '2000-01-01': `${origin} ${origin}`, plain: 'Gt-15 → 6', short: '2000-1-1' }, origin)
    expect(out).toEqual({ '2000-01-01': 'ORIGIN ORIGIN', plain: 'Gt-15 → 6', short: '2000-1-1' })
  })

  it('makes two runs that differ only in date and port identical', () => {
    const a = normalizeDeep({ u: 'http://127.0.0.1:3111/x?date=2000-01-01' }, 'http://127.0.0.1:3111')
    const b = normalizeDeep({ u: 'http://127.0.0.1:4222/x?date=2031-07-09' }, 'http://127.0.0.1:4222')
    expect(diffBaseline(a, b)).toEqual([])
  })
})

describe('baselineAction', () => {
  it('never captures over an existing file', () => {
    expect(baselineAction(true, '1')).toBe('compare')
    expect(baselineAction(true, undefined)).toBe('compare')
    expect(baselineAction(true, '0')).toBe('compare')
  })

  it('captures a missing file only when BEHAVIOUR_CAPTURE is exactly 1', () => {
    expect(baselineAction(false, '1')).toBe('capture')
    expect(baselineAction(false, undefined)).toBe('fail-missing')
  })

  for (const env of ['', '0', 'true', 'yes', '11', ' 1', 'a']) {
    it(`fails a missing file for BEHAVIOUR_CAPTURE=${JSON.stringify(env)}`, () => {
      expect(baselineAction(false, env)).toBe('fail-missing')
    })
  }
})

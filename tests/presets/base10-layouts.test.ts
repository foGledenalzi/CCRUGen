// Base-10 layout presets test (LAY-02, D-05, plan 03-05): proves BASE10_LAYOUT_SPECS in app/presets/base10/layouts.ts
// reproduce the frozen numeric oracle (engine/test/fixtures/base10.golden.json) and the frozen DOM/behaviour goldens
// exactly, and that the upstream-authored layout data is correctly licensed. Never regenerates a frozen file.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import {
  CENTER,
  P_LABYRINTH,
  P_LADDER,
  P_ORIGINAL,
  PLANETARY_CX,
  PLANETARY_CY,
  PLANETARY_DEFAULT_ANGLE,
  PLANETARY_RADIUS,
  PLANETARY_SIZE,
} from '../../app/presets/base10/layout-tables'
import { BASE10_LAYOUT_SPECS } from '../../app/presets/base10/layouts'

const ROOT = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))

interface GoldenOracle {
  layouts: Record<'original' | 'labyrinth' | 'ladder', Record<string, { x: number; y: number }>>
  center: Record<string, { x: number; y: number }>
  planetary: {
    positionsAtDefaultAngle: Record<string, { x: number; y: number }>
    size: Record<string, number>
  }
}

const golden = JSON.parse(readFileSync(ROOT('../../engine/test/fixtures/base10.golden.json'), 'utf8')) as GoldenOracle

const LAYOUT_IDS = ['original', 'labyrinth', 'ladder', 'planetary'] as const
const GOLDEN_DOM_IDS = ['original', 'labyrinth', 'ladder'] as const

function specOf(id: (typeof LAYOUT_IDS)[number]) {
  const spec = BASE10_LAYOUT_SPECS.find((s) => s.id === id)
  if (spec === undefined) throw new Error(`no base-10 layout preset "${id}"`)
  return spec
}

// -- Golden DOM parsing (read-only; the goldens are never regenerated) -------------------------------------------

interface ParsedZoneLabel {
  readonly zone: number
  readonly x: number
  readonly y: number
}
interface ParsedRegionLabel {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly size: number
  readonly opacity: number
  readonly anchor: string
}
interface ParsedGolden {
  readonly viewBoxHeight: number
  readonly zoneLabels: readonly ParsedZoneLabel[]
  readonly zoneCircles: readonly { readonly cx: number; readonly cy: number }[]
  readonly regionLabels: readonly ParsedRegionLabel[]
}

function parseAttrs(attrText: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w-]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrText)) !== null) {
    const key = m[1]
    const value = m[2]
    if (key !== undefined && value !== undefined) out[key] = value
  }
  return out
}

/** Zone labels are font-size 17 (region labels are 8 or 9, the demon/pandemonium layer's numbers are font-size 7). */
const ZONE_LABEL_FONT_SIZE = '17'

function parseGolden(text: string): ParsedGolden {
  const lines = text.split(/\r?\n/)
  const viewBoxMatch = text.match(/viewBox="0 0 \d+ (\d+)"/)
  if (viewBoxMatch?.[1] === undefined) throw new Error('golden: no viewBox found')
  const viewBoxHeight = Number(viewBoxMatch[1])

  const zoneLabels: ParsedZoneLabel[] = []
  const regionLabels: ParsedRegionLabel[] = []
  const zoneCircles: { cx: number; cy: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue

    const textMatch = line.match(/^\s*<text ([^>]*)>\s*$/)
    if (textMatch?.[1] !== undefined) {
      const next = lines[i + 1]
      const contentMatch = next?.match(/^\s*#text "([^"]*)"\s*$/)
      const content = contentMatch?.[1]
      if (content !== undefined) {
        const attrs = parseAttrs(textMatch[1])
        if (attrs['font-size'] === ZONE_LABEL_FONT_SIZE && /^\d$/.test(content)) {
          if (attrs.x === undefined || attrs.y === undefined) throw new Error('golden: zone label missing x/y')
          zoneLabels.push({ zone: Number(content), x: Number(attrs.x), y: Number(attrs.y) })
        } else if (content === 'WARP' || content === 'PLEX' || content === 'TORQUE') {
          const size = attrs['font-size']
          const opacity = attrs.opacity
          const anchor = attrs['text-anchor']
          if (size === undefined || opacity === undefined || anchor === undefined || attrs.x === undefined || attrs.y === undefined) {
            throw new Error('golden: region label missing attributes')
          }
          regionLabels.push({ text: content, x: Number(attrs.x), y: Number(attrs.y), size: Number(size), opacity: Number(opacity), anchor })
        }
      }
    }

    const circleMatch = line.match(/^\s*<circle ([^>]*)>\s*$/)
    if (circleMatch?.[1] !== undefined) {
      const attrs = parseAttrs(circleMatch[1])
      if (attrs.r === '21' && attrs.cx !== undefined && attrs.cy !== undefined) {
        zoneCircles.push({ cx: Number(attrs.cx), cy: Number(attrs.cy) })
      }
    }
  }

  return { viewBoxHeight, zoneLabels, zoneCircles, regionLabels }
}

function readGolden(id: (typeof GOLDEN_DOM_IDS)[number]): ParsedGolden {
  return parseGolden(readFileSync(ROOT(`../../e2e/__golden__/golden.spec.ts/${id}--default.txt`), 'utf8'))
}

// -- Tests ----------------------------------------------------------------------------------------------------

describe('numeric oracle', () => {
  for (const id of GOLDEN_DOM_IDS) {
    it(`${id}: built x/y equal the frozen oracle exactly`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const goldenLayout = golden.layouts[id]
      for (let z = 0; z < 10; z++) {
        const want = goldenLayout[String(z)]
        if (want === undefined) throw new Error(`golden: layout ${id} missing zone ${z}`)
        expect(layout.x[z]).toBe(want.x)
        expect(layout.y[z]).toBe(want.y)
      }
    })

    it(`${id}: built center equals the frozen oracle`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const want = golden.center[id]
      if (want === undefined) throw new Error(`golden: center missing for ${id}`)
      expect(layout.center).toEqual(want)
    })
  }

  it('planetary: built x/y match the frozen oracle within 1e-9 and nodeRadii equal the frozen sizes', () => {
    const layout = specOf('planetary').build(createNumogram(10))
    for (let z = 0; z < 10; z++) {
      const want = golden.planetary.positionsAtDefaultAngle[String(z)]
      const size = golden.planetary.size[String(z)]
      if (want === undefined || size === undefined) throw new Error(`golden: planetary missing zone ${z}`)
      expect(layout.x[z]).toBeCloseTo(want.x, 9)
      expect(layout.y[z]).toBeCloseTo(want.y, 9)
      expect(layout.nodeRadii?.[z]).toBe(size)
    }
  })

  it('the old app/data positions seam no longer exists (MIG-02, plan 04-16): consumers read layouts.ts/layout-tables.ts directly', () => {
    const DATA_DIR = '../../app/data/'
    expect(existsSync(ROOT(DATA_DIR + 'positions.ts'))).toBe(false)
  })
})

describe('DOM golden parity', () => {
  for (const id of GOLDEN_DOM_IDS) {
    it(`${id}: viewBox height equals the spec height`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const dom = readGolden(id)
      expect(dom.viewBoxHeight).toBe(layout.height)
    })

    it(`${id}: the zone-label sequence equals the spec drawOrder, each at (x, y - 1)`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const dom = readGolden(id)
      expect(dom.zoneLabels.map((l) => l.zone)).toEqual(Array.from(layout.drawOrder))
      for (const label of dom.zoneLabels) {
        expect(label.x).toBe(layout.x[label.zone])
        expect(label.y - 1).toBe(layout.y[label.zone])
      }
    })

    it(`${id}: a circle with r=21 exists at every zone's (x, y)`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const dom = readGolden(id)
      for (let z = 0; z < 10; z++) {
        const found = dom.zoneCircles.some((c) => c.cx === layout.x[z] && c.cy === layout.y[z])
        expect(found, `zone ${z} at (${String(layout.x[z])}, ${String(layout.y[z])})`).toBe(true)
      }
    })

    it(`${id}: region labels equal the spec regionLabels in order`, () => {
      const layout = specOf(id).build(createNumogram(10))
      const dom = readGolden(id)
      expect(dom.regionLabels).toEqual(
        layout.regionLabels.map((r) => ({ text: r.text, x: r.x, y: r.y, size: r.size, opacity: r.opacity, anchor: r.anchor })),
      )
    })
  }

  it('planetary: height 800 equals the behaviour baseline viewBox, and drawOrder equals zones sorted by y', () => {
    const layout = specOf('planetary').build(createNumogram(10))
    const behaviourText = readFileSync(ROOT('../../e2e/__behaviour__/planetary.json'), 'utf8')
    const viewBoxMatch = behaviourText.match(/"viewBox":\s*"0 0 \d+ (\d+)"/)
    if (viewBoxMatch?.[1] === undefined) throw new Error('behaviour baseline: no viewBox found')
    expect(Number(viewBoxMatch[1])).toBe(layout.height)

    const zones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const wantOrder = [...zones].sort((a, b) => {
      const ay = golden.planetary.positionsAtDefaultAngle[String(a)]?.y
      const by = golden.planetary.positionsAtDefaultAngle[String(b)]?.y
      if (ay === undefined || by === undefined) throw new Error('golden: planetary position missing')
      return ay - by
    })
    expect(Array.from(layout.drawOrder)).toEqual(wantOrder)
  })
})

describe('specs', () => {
  it('ids are original, labyrinth, ladder, planetary in that order', () => {
    expect(BASE10_LAYOUT_SPECS.map((s) => s.id)).toEqual(['original', 'labyrinth', 'ladder', 'planetary'])
  })

  for (const id of LAYOUT_IDS) {
    it(`${id}: supports base 10 only`, () => {
      const spec = specOf(id)
      expect(spec.supports(createNumogram(10))).toBe(true)
      expect(spec.supports(createNumogram(12))).toBe(false)
    })

    it(`${id}: build throws RangeError for base 12`, () => {
      const spec = specOf(id)
      expect(() => spec.build(createNumogram(12))).toThrow(RangeError)
    })

    it(`${id}: built layout has the shared base-10 sizing`, () => {
      const layout = specOf(id).build(createNumogram(10))
      expect(layout.width).toBe(800)
      expect(layout.scale).toBe(1)
      expect(layout.strokeScale).toBe(1)
      expect(layout.nodeRadius).toBe(21)
      expect(layout.labelSize).toBe(17)
      expect(layout.base).toBe(10)
    })
  }
})

describe('licensing', () => {
  it('layout-tables.ts starts with the not-relicensed header', () => {
    const text = readFileSync(ROOT('../../app/presets/base10/layout-tables.ts'), 'utf8')
    const firstLine = text.split(/\r?\n/)[0]
    expect(firstLine).toBe('// Upstream-derived base-10 layout data. Not relicensed by this repository; see NOTICE section 2.')
  })

  it('NOTICE names app/presets/base10/layout-tables.ts', () => {
    const notice = readFileSync(ROOT('../../NOTICE'), 'utf8')
    expect(notice).toContain('app/presets/base10/layout-tables.ts')
  })

  it('every engine/-mentioning line of layouts.ts and layout-tables.ts is a type-only import', () => {
    for (const rel of ['../../app/presets/base10/layouts.ts', '../../app/presets/base10/layout-tables.ts']) {
      const lines = readFileSync(ROOT(rel), 'utf8').split(/\r?\n/)
      for (const line of lines) {
        if (line.includes('engine/')) expect(line.trim().startsWith('import type')).toBe(true)
      }
    }
  })
})

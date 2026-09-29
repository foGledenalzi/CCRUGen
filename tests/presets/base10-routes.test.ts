// Golden parity of the moved base-10 route geometry (plan 04-04): reads the frozen DOM goldens read-only.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canonAttr } from '../../e2e/visual-dom'
import { findHardcodedBaseTen } from '../../scripts/check-repo.mjs'
import { BASE10 } from '../../app/presets/base10/numogram'
import { GATE_LIST } from '../../app/presets/base10/gates'
import { CURRENTS } from '../../app/presets/base10/currents'
import { SYZYGIES } from '../../app/presets/base10/syzygies'
import { CENTER, P_LABYRINTH, P_LADDER, P_ORIGINAL } from '../../app/presets/base10/layouts'
import { base10CurrentRender, base10GateRender } from '../../app/presets/base10/routes'
import type { Base10RouteInput } from '../../app/presets/base10/routes'
import type { Pos } from '../../app/data/types'

const ROOT = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))

const LAYOUTS = ['original', 'labyrinth', 'ladder'] as const
type GoldenLayoutId = (typeof LAYOUTS)[number]

const POS: Record<GoldenLayoutId, Record<number, Pos>> = {
  original: P_ORIGINAL,
  labyrinth: P_LABYRINTH,
  ladder: P_LADDER,
}

/** Every `d="..."` attribute value in a frozen DOM golden, un-escaped (the golden HTML-escapes quotes inside attrs). */
function readGoldenPaths(layout: GoldenLayoutId): Set<string> {
  const text = readFileSync(ROOT(`../../e2e/__golden__/golden.spec.ts/${layout}--default.txt`), 'utf8')
  const set = new Set<string>()
  const re = /\sd="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]
    if (raw !== undefined) set.add(raw.replace(/&quot;/g, '"'))
  }
  return set
}

describe.each(LAYOUTS)('%s: moved route geometry matches the frozen golden', (layout) => {
  const zoneRadius = () => 21
  const input: Base10RouteInput = {
    layout,
    pos: POS[layout],
    ctr: CENTER[layout],
    g: BASE10,
    gates: GATE_LIST,
    currents: CURRENTS,
    syzygies: SYZYGIES,
    zoneRadius,
  }
  const gateRender = base10GateRender(input)
  const currentRender = base10CurrentRender(input, {})
  const golden = readGoldenPaths(layout)

  it('has exactly 10 gate entries keyed by GATE_LIST names', () => {
    expect(Object.keys(gateRender)).toHaveLength(10)
    expect(Object.keys(gateRender).sort()).toEqual(GATE_LIST.map((g) => g.name).sort())
  })

  it('self gates (from === to, zones 0/1/9) are loop, the other seven are single', () => {
    for (const gate of GATE_LIST) {
      const render = gateRender[gate.name]
      if (render === undefined) throw new Error(`missing gate render for ${gate.name}`)
      expect(render.type).toBe(gate.from === gate.to ? 'loop' : 'single')
    }
  })

  it('every gate loop/path string is a member of the frozen golden and contains no NaN', () => {
    for (const gate of GATE_LIST) {
      const render = gateRender[gate.name]
      if (render === undefined) throw new Error(`missing gate render for ${gate.name}`)
      const d = render.type === 'loop' ? render.loop : render.type === 'single' ? render.path : undefined
      if (d === undefined) throw new Error(`unexpected gate render type for ${gate.name}: ${render.type}`)
      expect(d).not.toContain('NaN')
      expect(golden.has(canonAttr('d', d)), `${gate.name}: ${d}`).toBe(true)
    }
  })

  it('every current path/legA/legB/stem/loop string is a member of the frozen golden and contains no NaN', () => {
    for (const current of CURRENTS) {
      const render = currentRender[current.name]
      if (render === undefined) throw new Error(`missing current render for ${current.name}`)
      const fields: readonly string[] =
        render.type === 'single' ? [render.path]
          : render.type === 'yshape' ? [render.legA, render.legB, render.stem]
            : [render.legA, render.legB, render.loop]
      for (const d of fields) {
        expect(d).not.toContain('NaN')
        expect(golden.has(canonAttr('d', d)), `${current.name}: ${d}`).toBe(true)
      }
    }
  })
})

describe('MIG-02 cleanliness', () => {
  it('routes.ts has no hard-coded base-10 literals (checked under a path that bypasses the real exemption)', () => {
    const text = readFileSync(ROOT('../../app/presets/base10/routes.ts'), 'utf8')
    expect(findHardcodedBaseTen([{ path: 'app/check/routes.ts', text }])).toEqual([])
  })
})

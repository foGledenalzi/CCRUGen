// Tests for app/lib/renderData.ts (UI-06, T-04-26): engine routes adapted into the viewer's GateRender/CurrentRender
// records, keyed by the view's own names, with no NaN/undefined anywhere for any even base 2..40 and any procedural
// layout.
import { describe, expect, it } from 'vitest'
import { createNumogram, resolveLayout } from '../../engine/index'
import type { Layout as EngineLayout } from '../../engine/index'
import { GATE_LIST } from '../../app/presets/base10/gates'
import { CURRENTS } from '../../app/presets/base10/currents'
import { buildNumogramView } from '../../app/lib/numogramView'
import { layoutTarget } from '../../app/lib/viewLayouts'
import { engineRenderData, frameLayout } from '../../app/lib/renderData'

function hasBadNumber(s: string): boolean {
  return s.includes('NaN') || s.includes('undefined')
}

const LAYOUT_IDS = ['ring', 'ladder', 'spiral'] as const

describe('engineRenderData: sweep every even base 2..40 and every procedural layout', () => {
  it('n gate entries, pairCount current entries, loop flag matches from===to, no bad numbers, finite junctions', () => {
    for (let n = 2; n <= 40; n += 2) {
      const g = createNumogram(n)
      const view = buildNumogramView(g)
      for (const id of LAYOUT_IDS) {
        const layout = resolveLayout(g, id, [], { packer: 'shelf' })
        const rd = engineRenderData(view, layout)

        expect(Object.keys(rd.gates)).toHaveLength(g.zoneCount)
        expect(Object.keys(rd.currents)).toHaveLength(g.pairCount)

        for (let z = 0; z < view.gates.length; z++) {
          const gate = view.gates[z]
          if (gate === undefined) continue
          const render = rd.gates[gate.name]
          expect(render).toBeDefined()
          if (render === undefined) continue
          const isLoop = render.type === 'loop'
          expect(isLoop).toBe(gate.from === gate.to)
          const d = render.type === 'loop' ? render.loop : render.type === 'single' ? render.path : ''
          expect(hasBadNumber(d)).toBe(false)
        }

        for (const c of view.currents) {
          const render = rd.currents[c.name]
          expect(render).toBeDefined()
          if (render === undefined || render.type !== 'yshape') continue
          expect(hasBadNumber(render.legA)).toBe(false)
          expect(hasBadNumber(render.legB)).toBe(false)
          expect(hasBadNumber(render.stem)).toBe(false)
          expect(Number.isFinite(render.junction.x)).toBe(true)
          expect(Number.isFinite(render.junction.y)).toBe(true)
        }
      }
    }
  })
})

describe('engineRenderData: base 10 ring keys match the preset names', () => {
  it('gate keys equal GATE_LIST names, current keys equal CURRENTS names', () => {
    const g = createNumogram(10)
    const view = buildNumogramView(g)
    const target = layoutTarget(g, 'ring', 'shelf', {})
    const layout = target.layout as EngineLayout
    const rd = engineRenderData(view, layout)
    expect(Object.keys(rd.gates).sort()).toEqual(GATE_LIST.map(gate => gate.name).sort())
    expect(Object.keys(rd.currents).sort()).toEqual(CURRENTS.map(c => c.name).sort())
  })
})

describe('frameLayout', () => {
  it('x/y equal pos, groups/zoneGroup/center are the same references as the input layout', () => {
    const g = createNumogram(10)
    const target = layoutTarget(g, 'ring', 'shelf', {})
    const layout = target.layout as EngineLayout
    const pos: Record<number, { x: number; y: number }> = {}
    for (let z = 0; z < 10; z++) pos[z] = { x: z * 2, y: z * 3 }
    const framed = frameLayout(layout, pos)
    for (let z = 0; z < 10; z++) {
      expect(framed.x[z]).toBe(pos[z]?.x)
      expect(framed.y[z]).toBe(pos[z]?.y)
    }
    expect(framed.groups).toBe(layout.groups)
    expect(framed.zoneGroup).toBe(layout.zoneGroup)
    expect(framed.center).toBe(layout.center)
  })
})

// LAY-01/LAY-03/LAY-04, T-03-16/T-03-17/T-03-18: layoutToSvg and pairGraphToSvg turn a layout (or the pair-graph
// layout) into a deterministic, self-contained, escaped SVG string. This file's "escapes" tests are the phase's XSS
// control (security requirement): every free-text value interpolated into the string must survive a markup payload
// as inert text, never as a tag.
import { describe, expect, it } from 'vitest'
import { clearNumogramCache, createNumogram } from '../index'
import { formatNetSpan } from '../core/numerals'
import { pairGraphLayout, routePairGraph } from '../layout/pairgraph'
import { ringLayout } from '../layout/ring'
import type { Layout } from '../layout/types'
import { escapeXml, groupColour, layoutToSvg, pairGraphToSvg } from '../scene/svgString'

function hasBadNumber(s: string): boolean {
  return s.includes('NaN') || s.includes('Infinity') || s.includes('undefined')
}

describe('escapes', () => {
  it('escapeXml replaces &, <, >, ", \' in that order', () => {
    expect(escapeXml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  })

  it('a hostile title cannot break out of its <title> element', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const svg = layoutToSvg(g, layout, { title: '</title><script>alert(1)</script>' })
    expect(svg).toContain('&lt;/title&gt;&lt;script&gt;')
    expect(svg).not.toContain('<script')
  })

  it('a region label containing markup is escaped, not interpreted', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const original = layout.regionLabels[0]
    if (original === undefined) throw new Error('expected at least one region label at base 28')
    const edited: Layout = {
      ...layout,
      regionLabels: [{ ...original, text: '<b>' }, ...layout.regionLabels.slice(1)],
    }
    const svg = layoutToSvg(g, edited)
    expect(svg).toContain('&lt;b&gt;')
    expect(svg).not.toContain('<b>')
  })
})

describe('layoutToSvg: background validation (T-03-17)', () => {
  it('accepts #123456 and #abc, null omits the background rect, an unsafe string throws', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    expect(layoutToSvg(g, layout, { background: '#123456' })).toContain('fill="#123456"')
    expect(layoutToSvg(g, layout, { background: '#abc' })).toContain('fill="#abc"')
    expect(layoutToSvg(g, layout, { background: null })).not.toMatch(/<rect\b/)
    expect(() => layoutToSvg(g, layout, { background: 'red" onload="x' })).toThrow(RangeError)
  })
})

describe('layoutToSvg: structure and viewBox', () => {
  it('starts with <svg and ends with </svg>; embed toggles xmlns/width/height', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)

    const framed = layoutToSvg(g, layout)
    expect(framed.startsWith('<svg')).toBe(true)
    expect(framed.trim().endsWith('</svg>')).toBe(true)
    expect(framed).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(framed).toMatch(/width="[\d.]+"/)
    expect(framed).toMatch(/height="[\d.]+"/)
    expect(framed).toMatch(/viewBox="0 0 [\d.]+ [\d.]+"/)

    const embedded = layoutToSvg(g, layout, { embed: true })
    expect(embedded.startsWith('<svg')).toBe(true)
    expect(embedded.trim().endsWith('</svg>')).toBe(true)
    const rootTag = embedded.slice(0, embedded.indexOf('>') + 1)
    expect(rootTag).not.toContain('xmlns')
    expect(rootTag).not.toContain('width=')
  })
})

describe('layoutToSvg: element counts at base 28 (ring, detail lean)', () => {
  it('labels all: exactly 28 class="zl" text nodes and 14 current junction circles', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const svg = layoutToSvg(g, layout, { labels: 'all' })
    expect((svg.match(/class="zl"/g) ?? []).length).toBe(28)
    expect((svg.match(/<circle[^>]*fill="#fff"/g) ?? []).length).toBe(14)
  })

  it('labels none: zero class="zl"', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const svg = layoutToSvg(g, layout, { labels: 'none' })
    expect(svg).not.toContain('class="zl"')
  })

  it('gates off: no element with stroke="#cc44ff"', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const svg = layoutToSvg(g, layout, { gates: 'off', gateLabels: true })
    expect(svg).not.toContain('stroke="#cc44ff"')
  })

  it('gates thin: gate group opacity is half of on, and no class="gl" even with gateLabels true', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const on = layoutToSvg(g, layout, { gates: 'on', gateLabels: true })
    const thin = layoutToSvg(g, layout, { gates: 'thin', gateLabels: true })

    const onMatch = /class="gates"[^>]*opacity="([\d.]+)"/.exec(on)
    const thinMatch = /class="gates"[^>]*opacity="([\d.]+)"/.exec(thin)
    expect(onMatch).not.toBeNull()
    expect(thinMatch).not.toBeNull()
    const onOpacity = Number(onMatch?.[1])
    const thinOpacity = Number(thinMatch?.[1])
    expect(thinOpacity).toBeCloseTo(onOpacity / 2, 9)

    expect(on).toContain('class="gl"')
    expect(thin).not.toContain('class="gl"')
  })
})

describe('layoutToSvg: detail rich does not crash and stays clean', () => {
  it('base 28, all layers, rich detail', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const svg = layoutToSvg(g, layout, { detail: 'rich', gateLabels: true })
    expect(hasBadNumber(svg)).toBe(false)
    expect(svg.startsWith('<svg')).toBe(true)
  })
})

describe('pairGraphToSvg', () => {
  it('contains every pair\'s hi::lo net-span label and one path per pair (arc or loop)', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const pg = pairGraphLayout(g)
    const svg = pairGraphToSvg(g, pg)

    for (let q = 0; q < 14; q++) {
      expect(svg).toContain(escapeXml(formatNetSpan(27 - q, q, 28)))
    }

    const routes = routePairGraph(g, pg)
    const arcCount = routes.arc.filter(d => d !== null).length
    const loopCount = routes.loop.filter(d => d !== null).length
    expect(arcCount).toBeGreaterThan(0)
    expect(arcCount + loopCount).toBe(14)
    const markerCount = (svg.match(/marker-end="url\(#ac\)"/g) ?? []).length
    expect(markerCount).toBe(14)
  })
})

describe('layoutToSvg / pairGraphToSvg: determinism and no bad numbers', () => {
  it('identical output on a second call and after clearNumogramCache()', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const first = layoutToSvg(g, layout, { gateLabels: true })
    const second = layoutToSvg(g, layout, { gateLabels: true })
    expect(second).toBe(first)
    clearNumogramCache()
    const third = layoutToSvg(g, layout, { gateLabels: true })
    expect(third).toBe(first)
    expect(hasBadNumber(first)).toBe(false)

    const pg = pairGraphLayout(g)
    const pgFirst = pairGraphToSvg(g, pg)
    const pgSecond = pairGraphToSvg(g, pg)
    expect(pgSecond).toBe(pgFirst)
    expect(hasBadNumber(pgFirst)).toBe(false)
  })

  it('never reads the numogram\'s virtual demon space', () => {
    clearNumogramCache()
    const g = createNumogram(28)
    const layout = ringLayout(g)
    const pg = pairGraphLayout(g)
    // Bind every forwarded method to `target` (never `receiver`): the real Numogram implementation carries a private
    // class field, and calling one of its methods with the Proxy itself as `this` throws unrelated to this guard.
    const guarded = new Proxy(g, {
      get(target, prop) {
        if (prop === 'demons') throw new Error('svgString must not read the demon space')
        const value = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    expect(() => layoutToSvg(guarded, layout, { gateLabels: true, detail: 'rich' })).not.toThrow()
    expect(() => pairGraphToSvg(guarded, pg)).not.toThrow()
  })
})

describe('groupColour', () => {
  it('gives fixed colours for plex/warp and a golden-angle hsl rotation for torque', () => {
    expect(groupColour('plex', -1)).toBe('#cc8844')
    expect(groupColour('warp', -1)).toBe('#44cc77')
    expect(groupColour('torque', 0)).toBe('hsl(190 75% 62%)')
    expect(groupColour('torque', 1)).toMatch(/^hsl\(\d+ 75% 62%\)$/)
  })
})

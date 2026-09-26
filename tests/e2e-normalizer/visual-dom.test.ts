import { describe, expect, it } from 'vitest'
import { canonAttr, countElements, isIgnoredAttr, normalizeTree, type RawNode } from '../../e2e/visual-dom'

// Unit tests for the visual-DOM normalizer (D-15): geometry, paint and text only; aria-*, data-*, role
// and tabindex are ignored so later accessibility work never trips the DOM oracle, while any visual
// change still does. Trees are built by hand: extractTree runs only inside the browser (Pitfall 15).

const node = (t: string, a: [string, string][], c: (RawNode | string)[] = []): RawNode => ({ t, a, c })

const base = () =>
  node('svg', [['viewBox', '0 0 800 940'], ['width', '100']], [
    node('circle', [['cx', '10'], ['cy', '20'], ['r', '5'], ['fill', '#0044cc']]),
    node('text', [['x', '1'], ['y', '2']], ['hello']),
  ])

describe('isIgnoredAttr', () => {
  it('ignores aria-*, data-*, role and tabindex', () => {
    expect(isIgnoredAttr('aria-label')).toBe(true)
    expect(isIgnoredAttr('aria-hidden')).toBe(true)
    expect(isIgnoredAttr('data-x')).toBe(true)
    expect(isIgnoredAttr('role')).toBe(true)
    expect(isIgnoredAttr('tabindex')).toBe(true)
  })

  it('keeps geometry and paint attributes', () => {
    expect(isIgnoredAttr('fill')).toBe(false)
    expect(isIgnoredAttr('d')).toBe(false)
    expect(isIgnoredAttr('transform')).toBe(false)
  })
})

describe('normalizeTree ignores accessibility attributes', () => {
  it('adding aria-*, data-*, role and tabindex does not change the output', () => {
    const plain = normalizeTree(base())
    const decorated = base()
    decorated.a.push(['aria-label', 'numogram'], ['role', 'img'], ['data-layout', 'original'])
    const circle = decorated.c[0] as RawNode
    circle.a.push(['tabindex', '0'], ['aria-hidden', 'true'], ['data-zone', '5'], ['role', 'button'])
    expect(normalizeTree(decorated)).toBe(plain)
  })
})

describe('normalizeTree is order and format insensitive', () => {
  it('attribute order does not change the output', () => {
    const a = node('circle', [['cx', '1'], ['cy', '2'], ['fill', 'red']])
    const b = node('circle', [['fill', 'red'], ['cy', '2'], ['cx', '1']])
    expect(normalizeTree(a)).toBe(normalizeTree(b))
  })

  it('style declaration order and formatting do not change the output', () => {
    const ssr = node('g', [['style', 'pointer-events:none;transition:opacity 0.15s']])
    const cssom = node('g', [['style', 'transition: opacity 0.15s; pointer-events: none;']])
    expect(normalizeTree(ssr)).toBe(normalizeTree(cssom))
  })

  it('style property names are case-insensitive', () => {
    const lower = node('g', [['style', 'opacity:0.5']])
    const upper = node('g', [['style', 'Opacity: 0.5']])
    expect(normalizeTree(lower)).toBe(normalizeTree(upper))
  })
})

describe('canonAttr', () => {
  it('rounds numbers to 3 decimals so float noise is invisible', () => {
    expect(canonAttr('cx', '141.42135623730951')).toBe('141.421')
    expect(canonAttr('cx', '141.4213562373095')).toBe('141.421')
  })

  it('turns a tiny negative into 0, not -0', () => {
    expect(canonAttr('x', '-0.0001')).toBe('0')
  })

  it('rounds every number inside path data', () => {
    expect(canonAttr('d', 'M0,0.5L7,3.14159')).toBe('M0,0.5L7,3.142')
  })

  it('leaves colours, ids and url references untouched', () => {
    expect(canonAttr('fill', '#0044cc')).toBe('#0044cc')
    expect(canonAttr('id', 'sphere-05')).toBe('sphere-05')
    expect(canonAttr('fill', 'url(#grad-1-2)')).toBe('url(#grad-1-2)')
  })

  it('does not round numbers inside style hex colours or identifiers', () => {
    expect(canonAttr('style', 'fill:#0044cc;stroke:url(#grad-1-2)')).toBe('fill:#0044cc;stroke:url(#grad-1-2)')
  })
})

describe('normalizeTree detects real visual changes', () => {
  const golden = normalizeTree(base())

  it('a 0.01 coordinate change is detected', () => {
    const t = base()
    ;(t.c[0] as RawNode).a[0] = ['cx', '10.01']
    expect(normalizeTree(t)).not.toBe(golden)
  })

  it('a colour change is detected', () => {
    const t = base()
    ;(t.c[0] as RawNode).a[3] = ['fill', '#0044cd']
    expect(normalizeTree(t)).not.toBe(golden)
  })

  it('a text change is detected', () => {
    const t = base()
    ;(t.c[1] as RawNode).c[0] = 'hellp'
    expect(normalizeTree(t)).not.toBe(golden)
  })

  it('an added element is detected', () => {
    const t = base()
    t.c.push(node('line', [['x1', '0'], ['x2', '1']]))
    expect(normalizeTree(t)).not.toBe(golden)
  })

  it('a removed attribute is detected', () => {
    const t = base()
    ;(t.c[0] as RawNode).a.splice(2, 1)
    expect(normalizeTree(t)).not.toBe(golden)
  })

  it('a changed viewBox is detected', () => {
    const t = base()
    t.a[0] = ['viewBox', '0 0 800 880']
    expect(normalizeTree(t)).not.toBe(golden)
  })
})

describe('output shape', () => {
  it('ends with a newline and never contains a carriage return', () => {
    const out = normalizeTree(base())
    expect(out.endsWith('\n')).toBe(true)
    expect(out.includes('\r')).toBe(false)
  })

  it('prints one element per line, indented by depth, attributes sorted, quotes escaped', () => {
    const t = node('g', [['b', '2'], ['a', 'say "hi"']], [node('path', [['d', 'M1,2']])])
    expect(normalizeTree(t)).toBe('<g a="say &quot;hi&quot;" b="2">\n  <path d="M1,2">\n')
  })

  it('merges nothing and prints text children as #text lines with JSON quoting', () => {
    const t = node('text', [], ['a "b"'])
    expect(normalizeTree(t)).toBe('<text>\n  #text "a \\"b\\""\n')
  })
})

describe('countElements', () => {
  it('counts element lines only, not #text lines', () => {
    const out = normalizeTree(base())
    expect(out.split('\n').filter(l => l.includes('#text')).length).toBe(1)
    expect(countElements(out)).toBe(3)
  })

  it('counts a text-only element as one', () => {
    expect(countElements(normalizeTree(node('text', [], ['x'])))).toBe(1)
  })
})

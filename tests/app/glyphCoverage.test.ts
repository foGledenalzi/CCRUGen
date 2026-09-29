// Tests for app/lib/glyphCoverage.ts (D-12, research Priority 1 / A2): the canvas glyph-coverage heuristic, exercised
// entirely through the injectable GlyphCanvas interface (no real DOM/canvas needed under vitest's node environment).
import { describe, expect, it } from 'vitest'
import { GLYPH_FONT, createCanvasGlyphCanvas, glyphRisks, makeGlyphProbe } from '../../app/lib/glyphCoverage'
import type { GlyphCanvas } from '../../app/lib/glyphCoverage'

const REFERENCE = String.fromCodePoint(0xe000)

function fakeCanvas(opts: {
  widths: Record<string, number>
  pixelsByChar?: Record<string, Uint8ClampedArray>
  defaultWidth?: number
}): { canvas: GlyphCanvas; measureCalls: string[] } {
  const measureCalls: string[] = []
  const canvas: GlyphCanvas = {
    measureWidth(text) {
      measureCalls.push(text)
      return opts.widths[text] ?? opts.defaultWidth ?? 10
    },
    pixels(text) {
      return opts.pixelsByChar?.[text] ?? new Uint8ClampedArray([1, 2, 3, 4])
    },
  }
  return { canvas, measureCalls }
}

describe('makeGlyphProbe', () => {
  it('flags risk when width and pixels both match the reference', () => {
    const identical = new Uint8ClampedArray([9, 9, 9, 9])
    const { canvas } = fakeCanvas({
      widths: { [REFERENCE]: 12, x: 12 },
      pixelsByChar: { [REFERENCE]: identical, x: new Uint8ClampedArray(identical) },
    })
    expect(makeGlyphProbe(canvas)('x')).toBe('risk')
  })

  it('flags ok when the measured width differs from the reference', () => {
    const { canvas } = fakeCanvas({ widths: { [REFERENCE]: 12, x: 20 } })
    expect(makeGlyphProbe(canvas)('x')).toBe('ok')
  })

  it('flags ok when width matches the reference but pixels differ', () => {
    const { canvas } = fakeCanvas({
      widths: { [REFERENCE]: 12, x: 12 },
      pixelsByChar: {
        [REFERENCE]: new Uint8ClampedArray([1, 1, 1, 1]),
        x: new Uint8ClampedArray([2, 2, 2, 2]),
      },
    })
    expect(makeGlyphProbe(canvas)('x')).toBe('ok')
  })

  it('flags risk for zero width', () => {
    const { canvas } = fakeCanvas({ widths: { [REFERENCE]: 12, x: 0 } })
    expect(makeGlyphProbe(canvas)('x')).toBe('risk')
  })

  it('always flags ok for a null canvas', () => {
    const probe = makeGlyphProbe(null)
    expect(probe('x')).toBe('ok')
    expect(probe(REFERENCE)).toBe('ok')
  })

  it('memoizes verdicts: measureWidth is called once per distinct character', () => {
    const { canvas, measureCalls } = fakeCanvas({ widths: { [REFERENCE]: 12, x: 12 } })
    const probe = makeGlyphProbe(canvas)
    probe('x')
    probe('x')
    probe('x')
    expect(measureCalls.filter((c) => c === 'x')).toHaveLength(1)
  })
})

describe('glyphRisks', () => {
  it('returns the risky characters, in input order', () => {
    const verdicts: Record<string, 'ok' | 'risk'> = { a: 'ok', b: 'risk', c: 'risk', d: 'ok' }
    const probe = (ch: string) => verdicts[ch] ?? 'ok'
    expect(glyphRisks(['a', 'b', 'c', 'd'], probe)).toEqual(['b', 'c'])
  })

  it('returns an empty array when nothing is risky', () => {
    expect(glyphRisks(['a', 'b'], () => 'ok')).toEqual([])
  })
})

describe('createCanvasGlyphCanvas', () => {
  it('returns null when a 2D context is unavailable', () => {
    const fakeDoc = { createElement: () => ({ getContext: () => null }) } as unknown as Document
    expect(createCanvasGlyphCanvas(fakeDoc)).toBeNull()
  })

  it('sets the given font and wires measureWidth/pixels to the 2D context', () => {
    const calls: string[] = []
    const ctx = {
      font: '',
      fillStyle: '',
      measureText: (text: string) => {
        calls.push(`measure:${text}`)
        return { width: 7 }
      },
      clearRect: (x: number, y: number, w: number, h: number) => calls.push(`clear:${x},${y},${w},${h}`),
      fillText: (text: string, x: number, y: number) => calls.push(`fillText:${text}:${x}:${y}`),
      getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 4]) }),
    }
    const fakeCanvasEl = { width: 0, height: 0, getContext: () => ctx }
    const fakeDoc = { createElement: () => fakeCanvasEl } as unknown as Document

    const glyphCanvas = createCanvasGlyphCanvas(fakeDoc, GLYPH_FONT)

    expect(glyphCanvas).not.toBeNull()
    expect(ctx.font).toBe(GLYPH_FONT)
    expect(glyphCanvas?.measureWidth('x')).toBe(7)
    expect(calls).toContain('measure:x')

    const pixels = glyphCanvas?.pixels('x')
    expect(pixels).toEqual(new Uint8ClampedArray([1, 2, 3, 4]))
    expect(calls.some((c) => c.startsWith('clear:'))).toBe(true)
    expect(calls.some((c) => c.startsWith('fillText:x:'))).toBe(true)
  })

  it('sizes the offscreen canvas to 32x32', () => {
    const fakeCanvasEl = {
      width: 0,
      height: 0,
      getContext: () => ({
        font: '',
        fillStyle: '',
        measureText: () => ({ width: 0 }),
        clearRect: () => {},
        fillText: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(0) }),
      }),
    }
    const fakeDoc = { createElement: () => fakeCanvasEl } as unknown as Document
    createCanvasGlyphCanvas(fakeDoc)
    expect(fakeCanvasEl.width).toBe(32)
    expect(fakeCanvasEl.height).toBe(32)
  })
})

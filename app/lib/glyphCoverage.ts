// Glyph-coverage heuristic for custom alphabets (D-12, research Priority 1 / A2): compares a character's canvas
// rendering with a Private Use Area reference; a match means the visitor's font stack probably shows a placeholder
// box. A heuristic warning, never a hard block.

export const GLYPH_FONT =
  '16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

/** A canvas-rendering probe, injectable so this heuristic is testable without a real DOM/canvas. */
export interface GlyphCanvas {
  measureWidth(text: string): number
  pixels(text: string): Uint8ClampedArray | null
}

const PROBE_SIZE = 32
const REFERENCE_CODE_POINT = 0xe000 // guaranteed unassigned in any conformant font (a Private Use Area codepoint).

/** A GlyphCanvas backed by a real offscreen <canvas>, or null when a 2D context isn't available. */
export function createCanvasGlyphCanvas(doc: Document, font: string = GLYPH_FONT): GlyphCanvas | null {
  const el = doc.createElement('canvas')
  el.width = PROBE_SIZE
  el.height = PROBE_SIZE
  const ctx = el.getContext('2d')
  if (!ctx) return null
  ctx.font = font
  return {
    measureWidth(text) {
      return ctx.measureText(text).width
    },
    pixels(text) {
      ctx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE)
      ctx.fillStyle = '#000'
      ctx.fillText(text, 4, 24)
      return new Uint8ClampedArray(ctx.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data)
    },
  }
}

export type GlyphVerdict = 'ok' | 'risk'

function samePixels(a: Uint8ClampedArray | null, b: Uint8ClampedArray | null): boolean {
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * A memoized (ch: string) => GlyphVerdict probe against canvas, or a probe that always answers 'ok' when canvas is
 * null (no coverage information available, so no warning is shown). Zero measured width, or a width and pixel match
 * against the Private Use Area reference, both flag 'risk'; anything else is 'ok'.
 */
export function makeGlyphProbe(canvas: GlyphCanvas | null): (ch: string) => GlyphVerdict {
  const cache = new Map<string, GlyphVerdict>()
  if (!canvas) return () => 'ok'
  const reference = String.fromCodePoint(REFERENCE_CODE_POINT)
  let referenceWidth: number | null = null
  let referencePixels: Uint8ClampedArray | null = null

  return (ch: string): GlyphVerdict => {
    const cached = cache.get(ch)
    if (cached) return cached
    if (referenceWidth === null) {
      referenceWidth = canvas.measureWidth(reference)
      referencePixels = canvas.pixels(reference)
    }
    const width = canvas.measureWidth(ch)
    let verdict: GlyphVerdict
    if (width === 0) {
      verdict = 'risk'
    } else if (width !== referenceWidth) {
      verdict = 'ok'
    } else {
      verdict = samePixels(canvas.pixels(ch), referencePixels) ? 'risk' : 'ok'
    }
    cache.set(ch, verdict)
    return verdict
  }
}

/** The characters of chars that probe flags as possibly not rendering, in input order. */
export function glyphRisks(chars: readonly string[], probe: (ch: string) => GlyphVerdict): string[] {
  return chars.filter((ch) => probe(ch) === 'risk')
}

// Contact-sheet smoke test (D-10, T-03-22, T-03-23): buildReviewSheet is pure, deterministic, self-contained, free
// of upstream branding and structurally sound, ahead of the human sign-off in plan 03-08 Task 2. Imports the builder
// directly (no file I/O here; the CLI wrapper scripts/review-sheet.ts is exercised manually and by npm scripts).
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createNumogram, fmt, ladderLayout, pairGraphLayout } from '../../engine/index'
import { buildReviewSheet, REVIEW_BASES } from '../../scripts/review-sheet/build'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Splits the document into per-base section bodies, keyed by the base parsed out of `id="b{n}"`. */
function sectionsByBase(html: string): Map<number, string> {
  const map = new Map<number, string>()
  const parts = html.split('<section id="b')
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part === undefined) continue
    const m = /^(\d+)"/.exec(part)
    if (m === null) continue
    const n = Number(m[1])
    const end = part.indexOf('</section>')
    map.set(n, end === -1 ? part : part.slice(0, end))
  }
  return map
}

describe('buildReviewSheet', () => {
  it('is deterministic: two calls produce byte-identical output', () => {
    const a = buildReviewSheet()
    const b = buildReviewSheet()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('is a large, self-contained, well-formed HTML document', () => {
    const html = buildReviewSheet()
    expect(html.length).toBeGreaterThan(100000)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    const sectionMatches = html.match(/<section id="b/g) ?? []
    expect(sectionMatches).toHaveLength(REVIEW_BASES.length)
    const scriptMatches = html.match(/<script>/g) ?? []
    expect(scriptMatches).toHaveLength(1)
  })

  it('contains no bad numbers, no network reference and no upstream branding', () => {
    const html = buildReviewSheet()
    expect(html).not.toMatch(/NaN/)
    expect(html).not.toMatch(/Infinity/)
    expect(html).not.toMatch(/undefined/)
    expect(html).not.toContain('http://')
    expect(html).not.toContain('https://')
    expect(html).not.toMatch(/qliphoth|delight nexus/i)
  })

  it('every review base (2, 4, 6, 8, 12, 16, 28, 64, 82, 100) has a section', () => {
    const html = buildReviewSheet()
    expect(REVIEW_BASES).toEqual([2, 4, 6, 8, 12, 16, 28, 64, 82, 100])
    for (const n of REVIEW_BASES) {
      expect(html).toContain(`<section id="b${n}">`)
    }
  })

  it('bases 64 and 100 show both packers; base 28 shows the Warp-above variant', () => {
    const html = buildReviewSheet()
    const sections = sectionsByBase(html)
    for (const n of [64, 100]) {
      const section = sections.get(n)
      expect(section).toBeDefined()
      expect(section).toContain('shelf packer')
      expect(section).toContain('spiral packer')
    }
    const s28 = sections.get(28)
    expect(s28).toBeDefined()
    expect(s28).toContain('Warp above')
  })

  it("every figure's viewport data-r matches the layout's own node radius (pair graph: half the pill height)", () => {
    const html = buildReviewSheet()
    const sections = sectionsByBase(html)
    const s28 = sections.get(28) ?? ''
    const g28 = createNumogram(28)
    const ladder = ladderLayout(g28)
    expect(s28).toContain(`data-r="${fmt(ladder.nodeRadius)}"`)
    const pg = pairGraphLayout(g28)
    expect(s28).toContain(`data-r="${fmt(pg.nodeHeight / 2)}"`)
  })
})

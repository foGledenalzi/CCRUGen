// Naming contact-sheet smoke test (plan 07-06, T-07-12b): buildNamingSheet is pure, deterministic, self-contained, free of
// scripts and network references, small enough to open in a browser, and shows every style x seed x base the sign-off needs.
// Imports the builder directly (no file I/O here; the CLI scripts/naming-sheet.ts is run by hand and writes under /.review/).
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DEMON_NAMES } from '../../app/presets/base10/lore'
import { STYLE_IDS } from '../../engine/naming/banks'
import { createGenerator } from '../../engine/naming/generate'
import {
  buildNamingSheet,
  LAZY_SAMPLE_ZONES,
  NAMING_SHEET_BASES,
  NAMING_SHEET_SEEDS,
} from '../../scripts/naming-sheet/build'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** The section bodies keyed by the section id (`{style}-{seed}`). */
function sectionsById(html: string): Map<string, string> {
  const map = new Map<string, string>()
  const parts = html.split('<section id="')
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part === undefined) continue
    const quote = part.indexOf('"')
    const end = part.indexOf('</section>')
    map.set(part.slice(0, quote), end === -1 ? part : part.slice(0, end))
  }
  return map
}

describe('buildNamingSheet', () => {
  it('is deterministic: two calls produce byte-identical output', () => {
    expect(sha256(buildNamingSheet())).toBe(sha256(buildNamingSheet()))
  })

  it('shows the five bases and the two seeds the plan names', () => {
    expect(NAMING_SHEET_BASES).toEqual([10, 28, 64, 666, 4000])
    expect(NAMING_SHEET_SEEDS).toEqual(['ccrug', 'hollow-vector'])
    expect(LAZY_SAMPLE_ZONES).toEqual([65535, 1048576, 67108863])
  })

  it('has one section per style and seed (6), each with the five base headings', () => {
    const html = buildNamingSheet()
    const sections = sectionsById(html)
    expect(html.match(/<section id="/g) ?? []).toHaveLength(STYLE_IDS.length * NAMING_SHEET_SEEDS.length)
    expect(sections.size).toBe(6)
    for (const style of STYLE_IDS) {
      for (const seed of NAMING_SHEET_SEEDS) {
        const section = sections.get(`${style}-${seed}`)
        expect(section, `${style}-${seed}`).toBeDefined()
        for (const base of NAMING_SHEET_BASES) {
          expect(section, `${style}-${seed} base ${base}`).toContain(`<h3>Base ${base}: ${base} zones</h3>`)
        }
      }
    }
  })

  it('shows every name raw and smoothed side by side, with statistics and lazy samples', () => {
    const html = buildNamingSheet()
    for (const section of sectionsById(html).values()) {
      expect(section.match(/<h3>Base \d+: /g) ?? []).toHaveLength(NAMING_SHEET_BASES.length)
      expect(section.match(/<th>raw \(hi-lo\)<\/th><th>smoothed<\/th>/g) ?? []).toHaveLength(NAMING_SHEET_BASES.length)
      expect(section.match(/<table class="stats">/g) ?? []).toHaveLength(NAMING_SHEET_BASES.length)
      expect(section.match(/smoothing inert for this table/g) ?? []).toHaveLength(NAMING_SHEET_BASES.length)
      expect(section).toContain('Lazy samples (soundAt)')
    }
  })

  it('renders each lazy sample from the generator itself', () => {
    const html = buildNamingSheet()
    for (const style of STYLE_IDS) {
      for (const seed of NAMING_SHEET_SEEDS) {
        const section = sectionsById(html).get(`${style}-${seed}`) ?? ''
        const gen = createGenerator(seed, style)
        for (const z of LAZY_SAMPLE_ZONES) {
          expect(section).toContain(`<span class="z"><i>${z}</i>${gen.soundAt(z)}</span>`)
        }
      }
    }
  })

  it('shows 24 demon names per base: the 12 lowest mesh numbers then 12 spread out', () => {
    const html = buildNamingSheet()
    const section = sectionsById(html).get('harsh-ccrug') ?? ''
    const tables = section.split('<table class="names">').slice(1)
    expect(tables).toHaveLength(NAMING_SHEET_BASES.length)
    for (const table of tables) {
      const body = table.slice(0, table.indexOf('</table>'))
      expect(body.match(/<tr><td class="dim">/g) ?? []).toHaveLength(24)
      for (let m = 0; m < 12; m++) expect(body).toContain(`<tr><td class="dim">${m}</td>`)
    }
  })

  it('has the draft-bank note and the zone grids (64 leading zones at base 64, 16 spaced and the last 4 above it)', () => {
    const html = buildNamingSheet()
    expect(html).toContain('Draft banks (07-RESEARCH Appendix A)')
    expect(html).toContain('it no longer contains the verbatim CCRU zone sounds')
    expect(html).toContain("This is the generator's inventory, not the CCRU zone table.")
    const section = sectionsById(html).get('soft-ccrug') ?? ''
    expect(section).toContain('<h4>zones 0 to 9</h4>')
    expect(section).toContain('<h4>zones 0 to 63</h4>')
    expect(section.match(/<h4>16 evenly spaced zones<\/h4>/g) ?? []).toHaveLength(2) // bases 666 and 4000
    expect(section.match(/<h4>the last 4 zones<\/h4>/g) ?? []).toHaveLength(2)
  })

  it('has no script, no network reference, no bad numbers and stays below 2,000,000 bytes', () => {
    const html = buildNamingSheet()
    expect(html).not.toContain('<script')
    expect(html).not.toContain('http')
    expect(html).not.toMatch(/NaN/)
    expect(html).not.toMatch(/Infinity/)
    expect(html).not.toMatch(/undefined/)
    expect(html).not.toMatch(/qliphoth|delight nexus/i)
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(2_000_000)
  })

  it('shows no canonical demon name in any table cell (T-07-12b)', () => {
    const cells = new Set<string>()
    for (const m of buildNamingSheet().matchAll(/<td>(.*?)<\/td>/g)) cells.add((m[1] ?? '').replace(/<\/?b>/g, '').toLowerCase())
    expect(cells.size).toBeGreaterThan(100)
    for (const name of Object.values(DEMON_NAMES)) {
      expect(cells.has(name.toLowerCase()), 'a canonical name appears as a table cell').toBe(false)
    }
  })
})

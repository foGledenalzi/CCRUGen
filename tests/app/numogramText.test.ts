// Tests for app/lib/numogramText.ts (UI-07 text view, D-14 big-base fallback). Bounded above
// TEXT_VIEW_ZONE_LIMIT zones so a huge base can never freeze the tab through the text view.
import { describe, expect, it } from 'vitest'
import { createNumogram, formatGateName } from '../../engine/index'
import { formatZoneLabel } from '../../app/lib/labelScheme'
import { bigBaseMessage, numogramText, TEXT_VIEW_ZONE_LIMIT } from '../../app/lib/numogramText'

const MINUS = String.fromCodePoint(0x2212)

describe('numogramText: base 10 (identity labels)', () => {
  const text = numogramText(createNumogram(10), z => String(z))

  it('contains the header block', () => {
    expect(text).toContain('CCRUG numogram, base 10')
    expect(text).toContain('Zones: 10 (0 to 9)')
    expect(text).toContain('Syzygies: 5, each pair sums to 9')
    expect(text).toContain('Warp: yes')
    expect(text).toContain('Torque cycles: 1 (lengths in pairs: 3)')
    expect(text).toContain('Demons: 45 (chrono 15, amphi 24, xeno 6)')
  })

  it('lists each region walk', () => {
    expect(text).toContain('Torque, 3 pairs: 1 8 7 2 5 4')
    expect(text).toContain('Warp, 1 pair: 3 6')
    expect(text).toContain('Plex, 1 pair: 9 0')
  })

  it('lists a syzygy line with the true minus sign', () => {
    expect(text).toContain(`8::1  current 8${MINUS}1=7, flows to zone 7`)
  })

  it('lists a gate line', () => {
    expect(text).toContain('Gt-45  zone 9 -> zone 9  (cumulation 45)')
  })
})

describe('numogramText: base 28', () => {
  const text = numogramText(createNumogram(28), z => String(z))

  it('reports two Torque cycles of 9 and 3 pairs', () => {
    expect(text).toContain('Torque cycles: 2 (lengths in pairs: 9, 3)')
  })

  it('names them Torque A (18 labels) and Torque B', () => {
    const lines = text.split('\n')
    const torqueA = lines.find(l => l.startsWith('Torque A, 9 pairs:'))
    expect(torqueA).toBeDefined()
    expect(torqueA?.split(':')[1]?.trim().split(' ')).toHaveLength(18)
    expect(lines.some(l => l.startsWith('Torque B, 3 pairs:'))).toBe(true)
  })

  it('has 28 gate lines and 14 syzygy lines', () => {
    const lines = text.split('\n')
    expect(lines.filter(l => /^Gt-/.test(l))).toHaveLength(28)
    expect(lines.filter(l => l.includes('::') && l.includes('current'))).toHaveLength(14)
  })
})

describe('numogramText: base 16', () => {
  const g = createNumogram(16)
  const text = numogramText(g, z => String(z))

  it('sums to f and formats gate names in base 16', () => {
    expect(text).toContain('Syzygies: 8, each pair sums to f')
    const cum = g.gate(15).cumulation
    expect(text).toContain(formatGateName(cum, 16))
  })
})

describe('numogramText: xeno labels at base 10', () => {
  it('renders the Torque line in xenotation', () => {
    const text = numogramText(createNumogram(10), z => formatZoneLabel(z, 10, { mode: 'xeno' }))
    expect(text).toContain('Torque, 3 pairs: n/a ::: (::) : ((:)) ::')
  })
})

describe('numogramText: base 4096 (above TEXT_VIEW_ZONE_LIMIT)', () => {
  const text = numogramText(createNumogram(4096), z => String(z))

  it('is bounded and carries the truncation message', () => {
    expect(text).toContain('Zone, syzygy and gate listings are shown up to 1024 zones.')
    expect(text).not.toContain('Gt-')
    expect(text.length).toBeLessThan(4000)
  })

  it('truncates Torque lengths past 12 with a "more" suffix', () => {
    expect(text).toMatch(/, … \+\d+ more/)
    expect(text.split('\n').find(l => l.startsWith('Torque cycles:'))?.split(',')).toHaveLength(13)
  })
})

describe('numogramText: base 1024 (exactly TEXT_VIEW_ZONE_LIMIT)', () => {
  it('lists exactly 1024 gate lines', () => {
    const text = numogramText(createNumogram(1024), z => String(z))
    expect(text.split('\n').filter(l => /^Gt-/.test(l))).toHaveLength(1024)
  })
})

describe('bigBaseMessage', () => {
  it('matches the UI-SPEC copy verbatim, with svgRichMaxN passed in (never a literal)', () => {
    expect(bigBaseMessage(1024, 1024, 200)).toBe(
      'Base 1024 has 1024 zones — more than the interactive diagram supports live (over 200). Showing the summary and text view.',
    )
  })
})

describe('TEXT_VIEW_ZONE_LIMIT', () => {
  it('is 1024', () => {
    expect(TEXT_VIEW_ZONE_LIMIT).toBe(1024)
  })
})

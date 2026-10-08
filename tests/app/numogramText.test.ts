// Tests for app/lib/numogramText.ts (UI-07 text view, D-14 big-base fallback; Phase 6: the text limit follows the
// shipped interactive ceiling and the over-limit copy exists as pure functions). Bounded above TEXT_VIEW_ZONE_LIMIT
// zones so a huge base can never freeze the tab through the text view. Every threshold comes from the tier table.
import { describe, expect, it } from 'vitest'
import { TIER_TABLE, createNumogram, formatGateName } from '../../engine/index'
import { formatZoneLabel } from '../../app/lib/labelScheme'
import { SUMMARY_TORQUE_LIMIT, summarize as summarizeFromSummary } from '../../app/lib/summary'
import { summarize as summarizeFromView } from '../../app/lib/numogramView'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import {
  bigBaseMessage,
  numogramText,
  overLimitMessage,
  TEXT_VIEW_ZONE_LIMIT,
  tierOverrideMessage,
} from '../../app/lib/numogramText'

const MINUS = String.fromCodePoint(0x2212)
const EM_DASH = String.fromCodePoint(0x2014)

const gateLines = (text: string): string[] => text.split('\n').filter(l => /^Gt-/.test(l))

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

describe('numogramText: the first even base above the interactive ceiling', () => {
  const above = INTERACTIVE_MAX_N + 2
  const text = numogramText(createNumogram(above), z => String(z))

  it('is bounded and carries the truncation message built from TEXT_VIEW_ZONE_LIMIT', () => {
    expect(text).toContain(`Zone, syzygy and gate listings are shown up to ${TEXT_VIEW_ZONE_LIMIT} zones.`)
    expect(text).not.toContain('Gt-')
    expect(text.length).toBeLessThan(4000)
  })

  it('names the base in its header block', () => {
    expect(text).toContain(`CCRUG numogram, base ${above}`)
  })
})

describe('numogramText: a base above the ceiling with more Torque cycles than the summary lists', () => {
  // Found from data (createNumogram is cheap): the first even base past the ceiling whose Torque count exceeds the
  // summary's own display limit, so this stays valid if the shipped ceiling moves.
  const base = (() => {
    for (let n = INTERACTIVE_MAX_N + 2; n < INTERACTIVE_MAX_N + 2000; n += 2) {
      if (createNumogram(n).torqueCount > SUMMARY_TORQUE_LIMIT) return n
    }
    throw new Error('no base with enough Torque cycles found above the ceiling')
  })()
  const text = numogramText(createNumogram(base), z => String(z))

  it('truncates Torque lengths past the summary limit with a "more" suffix', () => {
    expect(text).toMatch(/, … \+\d+ more/)
    expect(text.split('\n').find(l => l.startsWith('Torque cycles:'))?.split(',')).toHaveLength(SUMMARY_TORQUE_LIMIT + 1)
  })
})

describe('numogramText: the limit sits exactly at the ceiling', () => {
  it('lists exactly 1024 gate lines at base 1024', () => {
    const text = numogramText(createNumogram(1024), z => String(z))
    expect(gateLines(text)).toHaveLength(1024)
  })

  it('lists exactly INTERACTIVE_MAX_N gate lines at the ceiling base itself', () => {
    const text = numogramText(createNumogram(INTERACTIVE_MAX_N), z => String(z))
    expect(gateLines(text)).toHaveLength(INTERACTIVE_MAX_N)
    expect(text).not.toContain('listings are shown up to')
  })
})

describe('summarize after the move to a lore-free module', () => {
  it('is the same function from summary.ts and from numogramView.ts', () => {
    expect(summarizeFromSummary).toBe(summarizeFromView)
  })

  it('still reports the base-28 summary the viewer showed before the move', () => {
    const s = summarizeFromSummary(createNumogram(28))
    expect(s.base).toBe(28)
    expect(s.zoneCount).toBe(28)
    expect(s.hasWarp).toBe(true)
    expect(s.torqueCount).toBe(2)
    expect(s.torqueLengths).toEqual([9, 3])
    expect(s.demonCount).toBe(378)
    expect(s.typeCounts.chrono + s.typeCounts.amphi + s.typeCounts.xeno).toBe(378)
  })
})

describe('bigBaseMessage', () => {
  it('matches the UI-SPEC copy verbatim, with svgRichMaxN passed in (never a literal)', () => {
    expect(bigBaseMessage(1024, 1024, 200)).toBe(
      'Base 1024 has 1024 zones — more than the interactive diagram supports live (over 200). Showing the summary and text view.',
    )
  })
})

describe('overLimitMessage (D-01, D-02)', () => {
  it('matches the UI-SPEC copy verbatim', () => {
    expect(overLimitMessage(4002, 4000)).toBe(
      'Base 4002 is above the interactive limit of 4000. Showing the summary and text view. To draw it, use headless export.',
    )
  })

  it('takes the cutoff as a parameter', () => {
    expect(overLimitMessage(9000, 1234)).toContain('interactive limit of 1234')
  })

  it('reads the cutoff from the shipped ceiling when the caller passes it', () => {
    expect(overLimitMessage(INTERACTIVE_MAX_N + 2, INTERACTIVE_MAX_N)).toContain(
      `interactive limit of ${INTERACTIVE_MAX_N}.`,
    )
  })

  it('writes the base as a plain integer, with no dash, exclamation mark or separator', () => {
    const text = overLimitMessage(67108864, INTERACTIVE_MAX_N)
    expect(text).toContain('Base 67108864 is above')
    expect(text).not.toContain(EM_DASH)
    expect(text).not.toContain('!')
    expect(text).not.toMatch(/\d[,.\s]\d{3}\b/)
  })
})

describe('tierOverrideMessage (diagnostic tier=headless within the limit)', () => {
  it('matches the UI-SPEC copy verbatim', () => {
    expect(tierOverrideMessage(28)).toBe('Tier override active. Showing the summary and text view for base 28.')
  })

  it('never claims the base is over the limit and has no dash or exclamation mark', () => {
    const text = tierOverrideMessage(28)
    expect(text).not.toContain('above')
    expect(text).not.toContain('limit')
    expect(text).not.toContain(EM_DASH)
    expect(text).not.toContain('!')
  })
})

describe('TEXT_VIEW_ZONE_LIMIT', () => {
  it("equals the table's interactive ceiling", () => {
    expect(TEXT_VIEW_ZONE_LIMIT).toBe(INTERACTIVE_MAX_N)
    expect(TEXT_VIEW_ZONE_LIMIT).toBe(TIER_TABLE.boundaries.interactiveMaxN?.n)
  })
})

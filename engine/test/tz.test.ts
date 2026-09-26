import { describe, expect, it } from 'vitest'

// Canary for the TZ pin in vitest.config.mts. Offsets are for 2000-01-01 12:00 local time (no DST).
const EXPECTED_OFFSET: Record<string, number> = { UTC: 0, 'America/New_York': 300 }

describe('timezone pin canary', () => {
  it('runs in the zone named by CCRUG_TZ (default UTC)', () => {
    const zone = process.env.CCRUG_TZ ?? 'UTC'
    const expected = EXPECTED_OFFSET[zone]
    expect(expected, `add ${zone} to EXPECTED_OFFSET`).toBeDefined()
    expect(new Date(2000, 0, 1, 12).getTimezoneOffset()).toBe(expected)
  })

  it('keeps ISO output independent of the zone', () => {
    expect(new Date(Date.UTC(2000, 0, 1, 12)).toISOString()).toBe('2000-01-01T12:00:00.000Z')
  })
})

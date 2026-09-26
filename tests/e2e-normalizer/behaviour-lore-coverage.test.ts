import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENTS } from '../../app/data/currents'
import { GATE_LIST } from '../../app/data/gates'
import { SYZYGIES } from '../../app/data/syzygies'
import { ZONE_META } from '../../app/data/zones'
import { ROOT } from '../../scripts/golden-manifest.mjs'

// The behaviour baseline (D-15) exists to catch a wrong lore key after the lore move. That only works if the
// frozen original.json really contains every lore string the viewer can show, so this test proves it: each gate
// desc and detail, each current desc and label, each syzygy desc and each non-empty zone desc and lemurian must
// occur as a substring of some recorded string. It reads the lore through the same names the viewer imports
// (app/data/* stay exported through Phase 2) and the baseline file read-only.

const BASELINE = path.join(ROOT, 'e2e', '__behaviour__', 'original.json')

const strings: string[] = []
const gather = (v: unknown): void => {
  if (typeof v === 'string') strings.push(v)
  else if (Array.isArray(v)) v.forEach(gather)
  else if (v !== null && typeof v === 'object') Object.values(v).forEach(gather)
}
gather(JSON.parse(readFileSync(BASELINE, 'utf8')))

// the collector's own normalisation, then the baseline's date mask
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')

interface LoreItem { id: string; text: string }
const lore: LoreItem[] = []
for (const g of GATE_LIST) {
  lore.push({ id: `gate ${g.name} desc`, text: g.desc }, { id: `gate ${g.name} detail`, text: g.detail })
}
for (const c of CURRENTS) {
  lore.push({ id: `current ${c.name} desc`, text: c.desc }, { id: `current ${c.name} label`, text: c.label })
}
for (const s of SYZYGIES) lore.push({ id: `syzygy ${s.a}::${s.b} desc`, text: s.desc })
for (const [zone, meta] of Object.entries(ZONE_META)) {
  if (meta.desc) lore.push({ id: `zone ${zone} desc`, text: meta.desc })
  if (meta.lemurian) lore.push({ id: `zone ${zone} lemurian`, text: meta.lemurian })
}

describe('behaviour baseline lore coverage (D-15)', () => {
  it('lists every lore field it has to guard (10 gates x2, 5 currents x2, 5 syzygies, 10 zones x2)', () => {
    expect(lore).toHaveLength(10 * 2 + 5 * 2 + 5 + 10 * 2)
    for (const item of lore) expect(norm(item.text).length, item.id).toBeGreaterThan(0)
  })

  it('original.json holds a substantial recording', () => {
    expect(strings.length).toBeGreaterThan(1000)
  })

  it('every gate, current, syzygy and zone lore string occurs in a recorded string', () => {
    const missing = lore.filter(item => {
      const needle = norm(item.text)
      return !strings.some(s => s.includes(needle))
    }).map(item => item.id)
    expect(missing).toEqual([])
  })
})

// The pure history helpers of the viewer (plan 07-18, D-09, Pitfall 7): the snapshot key that never reads the naming, the rewrite that
// lets a hydrated naming join the history without an undo entry, and the single changed zone of an undo or redo. Neutral data only:
// the namings are generated ones, no preset table is read.
import { describe, expect, it } from 'vitest'
import { createNaming, editSound, setSeed, toggleLock, type Naming } from '../../engine/index'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { historySnapshotKey, singleChangedZone, withHydratedNaming } from '../../app/lib/historyHydration'

const naming28 = (): Naming => createNaming({ base: 28, interactiveMaxN: INTERACTIVE_MAX_N })

// A snapshot of the shape the viewer records: plain state fields plus the naming and its revision.
interface Snap {
  base: number
  layout: string
  layers: string[]
  naming: Naming
  namingRev: number
}
const snap = (over: Partial<Snap> = {}): Snap => ({
  base: 28,
  layout: 'original',
  layers: ['currents', 'gates'],
  naming: naming28(),
  namingRev: 1,
  ...over,
})

describe('historySnapshotKey', () => {
  it('ignores the naming and reads only its revision', () => {
    const a = snap({ naming: naming28(), namingRev: 4 })
    const b = snap({ naming: editSound(naming28(), 3, 'zed'), namingRev: 4 })
    expect(historySnapshotKey(a)).toBe(historySnapshotKey(b))
    expect(historySnapshotKey(snap({ namingRev: 5 }))).not.toBe(historySnapshotKey(snap({ namingRev: 4 })))
  })

  it('never visits the naming: a naming whose fields throw when read does not break the key', () => {
    const hostile = {
      get sounds(): never {
        throw new Error('the key read the naming')
      },
    }
    const s = { ...snap(), naming: hostile as unknown as Naming }
    expect(() => historySnapshotKey(s)).not.toThrow()
  })

  it('still tells every other field apart', () => {
    const base = historySnapshotKey(snap())
    expect(historySnapshotKey(snap({ layout: 'ladder' }))).not.toBe(base)
    expect(historySnapshotKey(snap({ base: 30 }))).not.toBe(base)
    expect(historySnapshotKey(snap({ layers: ['gates'] }))).not.toBe(base)
  })

  it('matches the plain JSON text with only the naming left out', () => {
    const s = snap({ namingRev: 9 })
    expect(historySnapshotKey(s)).toBe(JSON.stringify({ base: 28, layout: 'original', layers: ['currents', 'gates'], namingRev: 9 }))
  })
})

describe('withHydratedNaming', () => {
  it('takes only the naming and its revision from the current snapshot', () => {
    const prev = snap({ namingRev: 1 })
    const cur = snap({ naming: editSound(naming28(), 2, 'qa'), namingRev: 7 })
    const out = withHydratedNaming(prev, cur)
    expect(out.naming).toBe(cur.naming)
    expect(out.namingRev).toBe(7)
    expect(out.layout).toBe(prev.layout)
    expect(out.layers).toBe(prev.layers)
  })

  it('makes the keys equal when the two snapshots differ only in naming and revision', () => {
    const prev = snap({ namingRev: 1 })
    const cur = snap({ naming: editSound(naming28(), 2, 'qa'), namingRev: 7 })
    expect(historySnapshotKey(prev)).not.toBe(historySnapshotKey(cur))
    expect(historySnapshotKey(withHydratedNaming(prev, cur))).toBe(historySnapshotKey(cur))
  })

  it('keeps the previous layout, so a real change still differs from the current snapshot', () => {
    const prev = snap({ namingRev: 1, layout: 'original' })
    const cur = snap({ naming: editSound(naming28(), 2, 'qa'), namingRev: 7, layout: 'labyrinth' })
    const out = withHydratedNaming(prev, cur)
    expect(out.layout).toBe('original')
    expect(historySnapshotKey(out)).not.toBe(historySnapshotKey(cur))
  })

  it('does not mutate either input', () => {
    const prev = snap({ namingRev: 1 })
    const cur = snap({ naming: editSound(naming28(), 2, 'qa'), namingRev: 7 })
    const prevNaming = prev.naming
    const out = withHydratedNaming(prev, cur)
    expect(out).not.toBe(prev)
    expect(prev.naming).toBe(prevNaming)
    expect(prev.namingRev).toBe(1)
    expect(cur.namingRev).toBe(7)
  })
})

describe('singleChangedZone', () => {
  it('names the one zone whose sound differs', () => {
    const a = naming28()
    expect(singleChangedZone(a, editSound(a, 5, 'zed'))).toBe(5)
  })

  it('names the one zone whose lock differs', () => {
    const a = naming28()
    expect(singleChangedZone(a, toggleLock(a, 9))).toBe(9)
  })

  it('names a zone whose sound and lock both differ (a typed sound locks its zone)', () => {
    const a = naming28()
    const b = editSound(a, 0, 'zed')
    expect(b.locks.has(0)).toBe(true)
    expect(singleChangedZone(a, b)).toBe(0)
  })

  it('is null when nothing differs', () => {
    const a = naming28()
    expect(singleChangedZone(a, a)).toBeNull()
    expect(singleChangedZone(a, naming28())).toBeNull()
  })

  it('is null when two or more zones differ', () => {
    const a = naming28()
    expect(singleChangedZone(a, editSound(editSound(a, 1, 'zed'), 2, 'zed'))).toBeNull()
    expect(singleChangedZone(a, setSeed(a, 'another seed'))).toBeNull()
  })

  it('is null for a seed-only naming and for tables of different length', () => {
    const seedOnly = createNaming({ base: 4096, interactiveMaxN: INTERACTIVE_MAX_N })
    expect(seedOnly.sounds).toBeNull()
    expect(singleChangedZone(seedOnly, seedOnly)).toBeNull()
    expect(singleChangedZone(naming28(), seedOnly)).toBeNull()
    expect(singleChangedZone(naming28(), createNaming({ base: 30, interactiveMaxN: INTERACTIVE_MAX_N }))).toBeNull()
  })

  it('does not depend on the argument order', () => {
    const a = naming28()
    const b = editSound(a, 11, 'zed')
    expect(singleChangedZone(b, a)).toBe(11)
  })
})

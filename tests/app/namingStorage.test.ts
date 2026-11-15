// The per-base browser slot and the naming context (plan 07-13, D-09, D-11, Pitfall 17, T-07-08b, T-07-09). The slot is untrusted
// input: another tab, an older build or a manual edit can leave anything in it, and the storage itself can throw. Every case here
// injects a fake storage (or stubs `window`), so no real browser is involved. The CCRU preset is read by reference.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NAMING_IMPORT_MAX_BYTES,
  createNameResolver,
  createNaming,
  editSound,
  serializeNaming,
  setJoin,
  setOverride,
  setSeed,
  setSmoothing,
  setStyle,
  toggleLock,
  validateNamingJson,
  type Naming,
} from '../../engine/index'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { NAMING_STORAGE_PREFIX } from '../../app/lib/namingLimits'
import { browserStorage, flushSlot, readSlot, slotKey, writeSlot, type StorageLike } from '../../app/lib/namingStorage'
import { defaultNamingFor, type NamingEnv } from '../../app/lib/namingSession'
import { NamingContext, useNaming, type NamingContextValue } from '../../app/components/names/NamingContext'

const STORAGE_SOURCE = fileURLToPath(new URL('../../app/lib/namingStorage.ts', import.meta.url))
const CONTEXT_SOURCE = fileURLToPath(new URL('../../app/components/names/NamingContext.tsx', import.meta.url))

const env: NamingEnv = { interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET }
const smallEnv: NamingEnv = { interactiveMaxN: 28, preset: null }
const CCRU_BASE = CCRU_NAMING_PRESET.base
const DENSE = 28

interface MemoryStorage extends StorageLike {
  readonly data: Map<string, string>
  setCalls: number
}

function memoryStorage(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const data = new Map<string, string>(Object.entries(initial))
  const storage: MemoryStorage = {
    data,
    setCalls: 0,
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key, value) => {
      storage.setCalls++
      data.set(key, value)
    },
  }
  return storage
}

function quotaError(): Error {
  return Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' })
}

/** A base-28 naming with typed sounds, a lock, an override and every generator setting off its default. */
function workedNaming(): Naming {
  let n = defaultNamingFor(DENSE, env)
  n = setSmoothing(setJoin(setStyle(setSeed(n, 'abc'), 'soft'), 'lo-hi'), 1)
  n = editSound(n, 3, 'zed')
  n = toggleLock(n, 7)
  n = setOverride(n, 5, 'Zed', null)
  return n
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('slotKey', () => {
  it('is the storage prefix followed by the base', () => {
    expect(slotKey(DENSE)).toBe('ccrug.naming.v1.28')
    expect(slotKey(DENSE)).toBe(`${NAMING_STORAGE_PREFIX}${DENSE}`)
    expect(slotKey(CCRU_BASE)).toBe(`${NAMING_STORAGE_PREFIX}${CCRU_BASE}`)
  })
})

describe('writeSlot and readSlot', () => {
  it('round-trips a base-28 naming with typed sounds, locks and overrides', () => {
    const storage = memoryStorage()
    const n = workedNaming()
    expect(writeSlot(storage, n)).toBe('saved')
    const back = readSlot(storage, DENSE, env)
    expect(back).not.toBeNull()
    expect(serializeNaming(back as Naming)).toBe(serializeNaming(n))
    expect((back as Naming).sounds).toEqual(n.sounds)
    expect([...(back as Naming).locks]).toEqual([...n.locks])
    expect([...(back as Naming).overrides]).toEqual([...n.overrides])
    expect(back).toMatchObject({ base: DENSE, source: 'generated', seed: 'abc', style: 'soft', join: 'lo-hi', smoothing: 1 })
  })

  it('round-trips the CCRU naming at the preset base with an override of its own', () => {
    const storage = memoryStorage()
    const n = setOverride(defaultNamingFor(CCRU_BASE, env), 0, 'Zed', CCRU_NAMING_PRESET)
    expect(writeSlot(storage, n)).toBe('saved')
    const back = readSlot(storage, CCRU_BASE, env) as Naming
    expect(back.source).toBe('ccru')
    expect(serializeNaming(back)).toBe(serializeNaming(n))
    expect(createNameResolver(back, CCRU_NAMING_PRESET).nameOf(1, 0)).toBe('Zed')
  })

  it('writes the compact export text under the slot key of the naming base', () => {
    const storage = memoryStorage()
    const n = workedNaming()
    writeSlot(storage, n)
    expect([...storage.data.keys()]).toEqual([slotKey(DENSE)])
    const text = storage.data.get(slotKey(DENSE)) as string
    expect(text).toBe(serializeNaming(n))
    expect(text).not.toBe(serializeNaming(n, { pretty: true }))
    expect(text).not.toContain('\n')
  })

  it('reads the slot through the same validator as an import', () => {
    const storage = memoryStorage()
    const n = workedNaming()
    writeSlot(storage, n)
    const text = storage.data.get(slotKey(DENSE)) as string
    const viaImport = validateNamingJson(text, { base: DENSE, interactiveMaxN: env.interactiveMaxN, preset: env.preset })
    expect(viaImport.ok).toBe(true)
    expect(serializeNaming((viaImport as { naming: Naming }).naming)).toBe(serializeNaming(readSlot(storage, DENSE, env) as Naming))
  })

  it('keeps one slot per base', () => {
    const storage = memoryStorage()
    const a = workedNaming()
    const b = setSeed(defaultNamingFor(DENSE + 2, env), 'other')
    writeSlot(storage, a)
    writeSlot(storage, b)
    expect(storage.data.size).toBe(2)
    expect((readSlot(storage, DENSE, env) as Naming).seed).toBe('abc')
    expect((readSlot(storage, DENSE + 2, env) as Naming).seed).toBe('other')
    expect(readSlot(storage, DENSE + 4, env)).toBeNull()
  })

  it('reads nothing without a storage', () => {
    expect(readSlot(null, DENSE, env)).toBeNull()
  })

  it('reads nothing when getItem throws, and never throws itself', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => undefined,
    }
    expect(() => readSlot(throwing, DENSE, env)).not.toThrow()
    expect(readSlot(throwing, DENSE, env)).toBeNull()
  })

  it('reads nothing from a missing slot, garbage, a foreign format or a wrong schema version', () => {
    expect(readSlot(memoryStorage(), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: 'garbage' }), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: '' }), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: '{"hello":"world"}' }), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: '[1,2,3]' }), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: '{"schema":"ccrug.naming/99","base":28}' }), DENSE, env)).toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: 'null' }), DENSE, env)).toBeNull()
  })

  it('reads nothing from a slot that holds a non-text value', () => {
    const odd = { getItem: () => 42, setItem: () => undefined } as unknown as StorageLike
    expect(readSlot(odd, DENSE, env)).toBeNull()
  })

  it('reads nothing from a valid file of another base stored under this base key', () => {
    const other = serializeNaming(setSeed(defaultNamingFor(DENSE + 2, env), 'other'))
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: other }), DENSE, env)).toBeNull()
  })

  it('reads nothing from a slot above the import size cap', () => {
    const huge = ' '.repeat(NAMING_IMPORT_MAX_BYTES + 1)
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: huge }), DENSE, env)).toBeNull()
  })

  it('reads nothing from a slot with one bad sound, so nothing is half applied', () => {
    const doc = JSON.parse(serializeNaming(workedNaming())) as { zones: string[] }
    doc.zones[2] = 'b4d'
    expect(readSlot(memoryStorage({ [slotKey(DENSE)]: JSON.stringify(doc) }), DENSE, env)).toBeNull()
  })

  it('reads nothing from a ccru slot where the environment has no preset for the base', () => {
    const ccruText = serializeNaming(defaultNamingFor(CCRU_BASE, env))
    expect(readSlot(memoryStorage({ [slotKey(CCRU_BASE)]: ccruText }), CCRU_BASE, env)).not.toBeNull()
    expect(readSlot(memoryStorage({ [slotKey(CCRU_BASE)]: ccruText }), CCRU_BASE, smallEnv)).toBeNull()
  })

  it('never reads a seed-only base, even when a valid slot is stored for it', () => {
    const seedOnly = createNaming({ base: smallEnv.interactiveMaxN + 2, interactiveMaxN: smallEnv.interactiveMaxN, seed: 'abc' })
    expect(seedOnly.sounds).toBeNull()
    const storage = memoryStorage({ [slotKey(seedOnly.base)]: serializeNaming(seedOnly) })
    expect(readSlot(storage, seedOnly.base, smallEnv)).toBeNull()
    // the same text is a fine slot where the ceiling is higher, so the null above is the ceiling's doing
    expect(readSlot(storage, seedOnly.base, { interactiveMaxN: seedOnly.base + 10, preset: null })).not.toBeNull()
  })

  it('reads a slot at the ceiling itself', () => {
    const atCeiling = editSound(defaultNamingFor(smallEnv.interactiveMaxN, smallEnv), 3, 'zed')
    const storage = memoryStorage()
    expect(writeSlot(storage, atCeiling)).toBe('saved')
    expect(readSlot(storage, smallEnv.interactiveMaxN, smallEnv)).not.toBeNull()
  })

  it('asks the storage for the slot key of the base and nothing else', () => {
    const asked: string[] = []
    const spy: StorageLike = {
      getItem: (key) => {
        asked.push(key)
        return null
      },
      setItem: () => undefined,
    }
    readSlot(spy, DENSE, env)
    expect(asked).toEqual([slotKey(DENSE)])
  })

  it('reports failed, never throws, without a storage', () => {
    expect(writeSlot(null, workedNaming())).toBe('failed')
  })

  it('reports failed, never throws, when the storage is full', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw quotaError()
      },
    }
    expect(() => writeSlot(full, workedNaming())).not.toThrow()
    expect(writeSlot(full, workedNaming())).toBe('failed')
  })

  it('writes nothing for a seed-only naming: nothing is saved above the ceiling', () => {
    const storage = memoryStorage()
    const seedOnly = defaultNamingFor(INTERACTIVE_MAX_N + 2, env)
    expect(seedOnly.sounds).toBeNull()
    expect(writeSlot(storage, seedOnly)).toBe('failed')
    expect(storage.setCalls).toBe(0)
    expect(storage.data.size).toBe(0)
  })
})

// Review IN-04: a pending debounced write is flushed at a base switch, and its result must reach the caller: the 'failed' of a full or
// blocked store used to be dropped, so an edit that could not be saved was lost without a word.
describe('flushSlot', () => {
  it('is none, and writes nothing, when no write is pending', () => {
    const storage = memoryStorage()
    expect(flushSlot(null, storage)).toBe('none')
    expect(storage.setCalls).toBe(0)
  })

  it('writes the pending naming to its own slot and says saved', () => {
    const storage = memoryStorage()
    const n = workedNaming()
    expect(flushSlot(n, storage)).toBe('saved')
    expect(storage.data.get(slotKey(DENSE))).toBeDefined()
    expect(readSlot(storage, DENSE, env)).toEqual(n)
  })

  it('says failed for a full store, a missing store and a seed-only naming, and never throws', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw quotaError()
      },
    }
    expect(flushSlot(workedNaming(), full)).toBe('failed')
    expect(flushSlot(workedNaming(), null)).toBe('failed')
    expect(flushSlot(defaultNamingFor(INTERACTIVE_MAX_N + 2, env), memoryStorage())).toBe('failed')
  })
})

describe('browserStorage', () => {
  it('is null where there is no window (a server render)', () => {
    expect(typeof window).toBe('undefined')
    expect(browserStorage()).toBeNull()
  })

  it('is null when reading window.localStorage throws', () => {
    const win = {}
    Object.defineProperty(win, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    vi.stubGlobal('window', win)
    expect(() => browserStorage()).not.toThrow()
    expect(browserStorage()).toBeNull()
  })

  it('is null when the browser gives no storage', () => {
    vi.stubGlobal('window', { localStorage: null })
    expect(browserStorage()).toBeNull()
  })

  it('is the browser storage when there is one', () => {
    const storage = memoryStorage()
    vi.stubGlobal('window', { localStorage: storage })
    expect(browserStorage()).toBe(storage)
  })
})

describe('the storage module source', () => {
  const source = readFileSync(STORAGE_SOURCE, 'utf8')

  it('reads through the one validator, and raises nothing itself', () => {
    expect(source.match(/validateNamingJson\(/g)?.length).toBe(1)
    expect(source).not.toMatch(/throw/)
  })

  it('types no ceiling and no key prefix', () => {
    expect(source).not.toMatch(/4000/)
    expect(source).not.toMatch(/ccrug\.naming/)
    expect(source).toMatch(/NAMING_STORAGE_PREFIX/)
  })
})

function contextValue(): NamingContextValue {
  const naming = defaultNamingFor(DENSE, env)
  return {
    base: DENSE,
    naming,
    rev: 1,
    resolver: createNameResolver(naming, null),
    preset: null,
    state: 'ready',
    pendingBase: null,
    saved: 'none',
    uncarried: false,
    interactiveMaxN: env.interactiveMaxN,
    announcement: '',
    announcementNonce: 0,
    restored: { tick: 0, zone: null },
    apply: () => false,
    keep: () => undefined,
    revert: () => undefined,
    undo: () => false,
    announce: () => undefined,
  }
}

function Probe(): ReturnType<typeof createElement> {
  const value = useNaming()
  return createElement('span', null, value === null ? 'no-naming' : `base-${value.base}-${value.state}-${value.resolver.nameOf(1, 0).length > 0}`)
}

describe('NamingContext', () => {
  it('gives a component outside a provider null instead of throwing, so provider-less renders keep working', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>no-naming</span>')
  })

  it('gives a component inside a provider the value', () => {
    const html = renderToStaticMarkup(createElement(NamingContext.Provider, { value: contextValue() }, createElement(Probe)))
    expect(html).toBe('<span>base-28-ready-true</span>')
  })

  it('has a null default and a client-component marker', () => {
    const source = readFileSync(CONTEXT_SOURCE, 'utf8')
    expect(source.match(/createContext<NamingContextValue \| null>\(null\)/g)?.length).toBe(1)
    expect(source.startsWith("'use client'")).toBe(true)
    expect(source).not.toMatch(/throw/)
  })
})

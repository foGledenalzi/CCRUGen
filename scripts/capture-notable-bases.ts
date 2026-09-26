// One-time capture of the frozen notable-bases fixture (Phase 2, D-09, D-10).
// The numbers come from the independent, definitions-only reference in tests/bruteforce and from nothing else:
// never from the engine, never from the local gitignored reference sources. Refuses to overwrite: derived fixtures
// are frozen and never regenerated. Run once from the repository root with `npx tsx scripts/capture-notable-bases.ts`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  REF_SUBTYPES,
  type RefStructure,
  type RefSubtype,
  refDemons,
  refStructure,
  refSubtypeCounts,
} from '../tests/bruteforce/numogramReference'

const OUT = resolve('engine/test/fixtures/derived/notable-bases.golden.json')
if (!existsSync(resolve('tests/bruteforce/numogramReference.ts'))) {
  console.error('capture-notable-bases: run from the repository root')
  process.exit(2)
}
if (existsSync(OUT)) {
  console.error('capture-notable-bases: engine/test/fixtures/derived/notable-bases.golden.json exists; derived fixtures are frozen and never regenerated')
  process.exit(1)
}

const FULL_BASES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 28, 32, 36, 64, 80, 82, 100]
const DIGEST_BASES = [256, 666, 1000, 1024]

const torqueLengths = (s: RefStructure): number[] => s.cycles.filter((c) => c.kind === 'torque').map((c) => c.pairs.length)
const hasWarp = (s: RefStructure): boolean => s.cycles.some((c) => c.kind === 'warp')
const total = (counts: Record<RefSubtype, number>): number => REF_SUBTYPES.reduce((sum, name) => sum + counts[name], 0)

// Numodemons by the definition (a + b = n), as a plain counting loop over the demon enumeration order.
function countNumodemons(n: number): number {
  let count = 0
  for (let a = 1; a < n; a++) for (let b = 0; b < a; b++) if (a + b === n) count++
  return count
}

function fullEntry(base: number) {
  const s = refStructure(base)
  const demons = refDemons(s)
  const subtypeCounts = refSubtypeCounts(s)
  // Abort before writing anything if the reference disagrees with itself.
  const tally: Record<string, number> = {}
  for (const name of REF_SUBTYPES) tally[name] = 0
  for (const d of demons) tally[d.subtype] = (tally[d.subtype] ?? 0) + 1
  for (const name of REF_SUBTYPES) {
    if (tally[name] !== subtypeCounts[name]) {
      console.error(`capture-notable-bases: the reference disagrees with itself at base ${base}, ${name}`)
      process.exit(3)
    }
  }
  return {
    base,
    pairCount: s.pairLo.length,
    warp: hasWarp(s),
    cycles: s.cycles.map((c) => ({ kind: c.kind, pairs: [...c.pairs] })),
    torqueLengths: torqueLengths(s),
    gates: [...s.gates],
    demonCount: demons.length,
    numodemonCount: demons.filter((d) => d.numodemon).length,
    subtypeCounts,
  }
}

function digest(base: number) {
  const s = refStructure(base)
  const subtypeCounts = refSubtypeCounts(s)
  return {
    base,
    warp: hasWarp(s),
    torqueLengths: torqueLengths(s),
    demonCount: total(subtypeCounts),
    numodemonCount: countNumodemons(base),
    subtypeCounts,
  }
}

const data = {
  schema: 1,
  source:
    'tests/bruteforce/numogramReference.ts (definitions only: syzygy sum n-1, current hi-lo, iterated in-base digit sums, walked cycles, enumerated demons); never engine/, never the gitignored root reference/ sources',
  bases: FULL_BASES.map(fullEntry),
  digests: DIGEST_BASES.map(digest),
}

mkdirSync(dirname(OUT), { recursive: true })
const text = JSON.stringify(data, null, 2) + '\n'
writeFileSync(OUT, text, 'utf8')
console.log(`capture-notable-bases: wrote ${Buffer.byteLength(text)} bytes`)

// One-time capture of the frozen base-10 numeric oracle (FND-02, D-13).
// Refuses to overwrite: the oracle is never regenerated (CLAUDE.md, D-15). Run from the repo root.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { deriveBase10Oracle } from '../tests/oracle/deriveBase10'

const OUT = resolve('engine/test/fixtures/base10.golden.json')
if (!existsSync(resolve('app/data/zones.ts'))) {
  console.error('capture-base10-oracle: run from the repository root')
  process.exit(2)
}
if (existsSync(OUT)) {
  console.error('capture-base10-oracle: engine/test/fixtures/base10.golden.json exists; the base-10 oracle is frozen and is never regenerated')
  process.exit(1)
}
mkdirSync(dirname(OUT), { recursive: true })
const text = JSON.stringify(deriveBase10Oracle(), null, 2) + '\n'
writeFileSync(OUT, text, 'utf8')
console.log(`capture-base10-oracle: wrote ${Buffer.byteLength(text)} bytes`)

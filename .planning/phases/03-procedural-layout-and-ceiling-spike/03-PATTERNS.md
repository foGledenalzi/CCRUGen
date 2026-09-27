# Phase 3: Procedural Layout and Ceiling Spike - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 24 (new: 20, modified: 2, dev-only/untracked-output not counted)
**Analogs found:** 24 / 24 (one dev-only harness group has only a partial/structural analog, flagged below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/layout/types.ts` | model (types) | transform | `engine/core/types.ts` | exact (same role: pure public-contract types, no behaviour) |
| `engine/layout/params.ts` | config | transform | `engine/core/numogram.ts` (`NUMOGRAM_CACHE_LIMITS`) + `engine/core/types.ts` (`DEMON_TYPES`/`DEMON_SUBTYPES`) | role-match (frozen data-as-const) |
| `engine/layout/format.ts` | utility | transform | `engine/core/numerals.ts` (`formatNumeral`, `formatNetSpan`) | exact (pure formatter, no locale, no `Date`) |
| `engine/layout/ring.ts` | service (core algorithm) | transform | `engine/core/numogram.ts` (`build()`, `CycleView`) | exact (O(n) typed-array construction over `Cycle[]`) |
| `engine/layout/pack.ts` | service (algorithm) | batch | `engine/core/numogram.ts` (`build()`'s counting sort) | role-match (deterministic sort/placement over typed arrays, no comparison sort) |
| `engine/layout/ladder.ts` | service (algorithm) | transform | `engine/core/numogram.ts` (pure per-index geometry) + `app/data/positions.ts` (`P_LADDER` shape it must reduce to) | role-match |
| `engine/layout/spiral.ts` | service (algorithm) | transform | `engine/core/numogram.ts` (pure per-index geometry) | role-match |
| `engine/layout/routing.ts` | service (algorithm) | transform | `app/lib/geometry.ts` (`quadPath`, `curveAway`, `loopPath`) + `app/NumogramClient.tsx` (`gateRenderData`/`currentRenderData` memos, lines 958-1306) | role-match (same curve math, generalized to numeric ids) |
| `engine/layout/registry.ts` | service (factory) | request-response | `engine/core/numogram.ts` (`createNumogram` cached factory, lines 326-345) | role-match (assert-then-resolve, single entry point) |
| `engine/layout/index.ts` | config (barrel) | transform | `engine/index.ts` | exact |
| `engine/scene/svgString.ts` | service (emitter) | transform | `engine/core/numerals.ts` (pure string building) + `app/lib/geometry.ts` (SVG path templates) | role-match |
| `engine/scene/tiers.ts` | model + service (data + validator) | request-response | `engine/core/base.ts` (`BaseCheck` union, `validateBase`) | exact (discriminated result + "report problems, never throw for data" shape) |
| `engine/scene/index.ts` | config (barrel) | transform | `engine/index.ts` | exact |
| `engine/index.ts` (MODIFIED) | config (barrel) | transform | itself (existing file, extend export list) | exact |
| `engine/test/layout.ring.test.ts` | test | batch (sweep) | `engine/test/structure.sweep.test.ts` | exact |
| `engine/test/layout.determinism.test.ts` | test | batch | `engine/test/tz.test.ts` + `engine/test/demons.sweep.test.ts` (fixed-seed sampling) | role-match |
| `engine/test/layout.degenerate.test.ts` | test | batch | `engine/test/structure.sweep.test.ts` (small-n edge handling) | role-match |
| `engine/test/layout.sizing.test.ts` | test | batch | `engine/test/structure.sweep.test.ts` | role-match |
| `engine/test/layout.pairgraph.test.ts` | test | batch (sweep) | `engine/test/structure.sweep.test.ts` | exact |
| `engine/test/tiers.schema.test.ts` | test | request-response | `engine/core/base.ts` validate-contract (tested the same shape in `engine/test/base.test.ts`) | role-match |
| `engine/test/tiers.select.test.ts` | test | request-response | `engine/test/base.test.ts`-style unit assertions on a pure function | role-match |
| `app/presets/base10/layouts.ts` | provider (adapter/seam) | transform | `app/presets/base10/currents.ts` + `app/presets/base10/gates.ts` | exact |
| `app/data/positions.ts` (MODIFIED) | provider (pass-through seam) | transform | `app/data/gates.ts` | exact (identical seam shape already in the repo) |
| `tests/presets/base10-layouts.test.ts` | test (oracle) | request-response | `tests/oracle/base10.oracle.test.ts` + `tests/oracle/deriveBase10.ts` | exact |
| `tests/presets/review-sheet.smoke.test.ts` | test (smoke) | file-I/O | `tests/oracle/base10.oracle.test.ts` (fixture-file assertions: LF-only, stable hash) | role-match |
| `scripts/review-sheet.ts` | script (dev-only) | file-I/O | `scripts/capture-base10-oracle.ts` | exact |
| `scripts/spike/*.ts` | script (dev-only, browser-driven) | event-driven / batch | `scripts/page-weight.mjs` (CLI-script shape: pure `measure`/`compare` functions, `isMain` guard, subcommands) | partial (no existing Playwright-driving script in `scripts/`; e2e/ uses the Playwright *test* runner, not a standalone driver) |
| `.gitignore` (MODIFIED) | config | n/a | itself | n/a (two line additions: `/.review/`, `/.spike/`) |

## Pattern Assignments

### `engine/layout/types.ts` (model, transform)

**Analog:** `engine/core/types.ts`

**File-header convention** (lines 1-5 of the analog):
```typescript
// Public contracts of the engine. Later Phase 2 plans (...) implement against these shapes. Pure types plus two
// constant tuples: no behaviour lives here.
//
// Units are always stated: a "pair" is a syzygy {z, base - 1 - z} (base / 2 of them), a "zone" is one of the base
// digits 0..base-1. A Cycle has lengthInPairs pairs and 2 * lengthInPairs zones.
```
Copy this convention: a short header stating what the module is, followed by a "units are always stated" reminder (world units, screen units, pairs vs zones) since Phase 3's own research repeatedly distinguishes world coordinates from on-screen pixels.

**Interface style** (lines 10-21, 32-53): every field has an inline comment stating its unit or invariant, not a separate doc block; string-literal unions (`RegionKind`) are declared once and reused everywhere (mirror this for `LayoutId = 'ring' | 'ladder' | 'spiral' | 'pairGraph'` and the base-10 preset ids). Frozen constant tuples sit at the bottom of the types file (`DEMON_TYPES`, `DEMON_SUBTYPES`, lines 55-67) — put `LAYOUT_IDS`-shaped tuples here too, or in `registry.ts` per D-discretion, but keep the tuple-and-derived-union idiom:
```typescript
export const DEMON_TYPES = ['chrono', 'amphi', 'xeno'] as const
export type DemonType = (typeof DEMON_TYPES)[number]
```

---

### `engine/layout/ring.ts` (service, transform) — the central algorithm file

**Analog:** `engine/core/numogram.ts`

**Imports** (lines 12-16): relative imports only, one import per concern, types imported with `import type`:
```typescript
import { digitalRoot, triangular } from './arith'
import { assertBase, MAX_BASE } from './base'
import { createDemonSpace } from './demons'
import { checkIndex } from './index-check'
import type { Cycle, CurrentInfo, DemonSpace, GateInfo, Numogram, PairInfo, RegionKind } from './types'
```
`ring.ts` should import `Cycle`, `Numogram`, `PairInfo` etc. as types from `../core/types` (or via `../index`) the same way, plus `createNumogram` from `../core/numogram` — never re-derive pair/cycle structure (Don't-Hand-Roll table in RESEARCH.md).

**Typed-array construction over `noUncheckedIndexedAccess`** (lines 117-137, the discovery loop in `build()`): every indexed read is guarded with `?? 0` because `noUncheckedIndexedAccess` is on project-wide:
```typescript
const seen = new Uint8Array(pairCount)
const flow = new Int32Array(pairCount)
...
for (let p = 0; p < pairCount; p++) {
  if (seen[p] !== 0) continue
  let q = p
  let len = 0
  while (seen[q] === 0) {
    seen[q] = 1
    len++
    const d = n1 - 2 * q
    q = d < pairCount ? d : n1 - d
  }
  ...
}
```
Copy this discipline verbatim in `ringLayout`: `Float64Array` x/y by zone (never `Record<number, Pos>`), explicit-initial-value loops (Pitfall 3 — no `Math.min(...arr)`), and index reads via a small `at()`-style helper when a value must exist (see `checkIndex` below) or `?? 0` when a numeric default is safe.

**Range-checked accessors, not silent clamping** (from `CycleView`, lines 84-93):
```typescript
pairAt(i: number): number {
  const at = checkIndex('pair position', i, this.lengthInPairs)
  return this.#flow[this.#offset + at] ?? 0
}
zoneAt(i: number): number {
  const at = checkIndex('zone position', i, this.zoneCount)
  const pair = this.#flow[this.#offset + Math.floor(at / 2)] ?? 0
  return memberOf(pair, this.#n1, at % 2)
}
```
`ring.ts`'s `ringNodes`/`composeTorques` should use the same `checkIndex` helper (`../core/index-check`) for any caller-supplied index (e.g. a glyph index into `Cycle[]`), and never index past a typed array's declared length without a check.

**Deterministic stable-sort-by-counting, never a comparison sort on floats** (lines 139-159, the counting sort in `build()`):
```typescript
const start = new Int32Array(maxLen + 1)
for (let i = 0; i < found; i++) {
  const len = pairCycle[i] ?? 0
  start[len] = (start[len] ?? 0) + 1
}
let position = 0
for (let len = maxLen; len >= 1; len--) {
  const count = start[len] ?? 0
  start[len] = position
  position += count
}
```
This is the direct analog for `packShelf`'s row assignment and for "ties broken by cycle id, never by float equality" (Pitfall 2 in RESEARCH.md, D-03). Reuse the same idiom: integer bucket, then a scan, never `Array.sort((a, b) => a - b)` on a value derived from `Math.sin`/`Math.cos`.

**Frozen, private-field value objects for read-only views** (lines 58-108, `CycleView`): private fields (`#flow`, `#offset`, `#n1`) hold shared typed arrays, the constructor computes derived fields once and calls `Object.freeze(this)`. If `ring.ts` exposes a `Layout` object with lazy-computed pieces (e.g. `routing`), follow `NumogramImpl`'s lazy-getter idiom (lines 201, 248-251):
```typescript
#torques: readonly Cycle[] | null = null
get torques(): readonly Cycle[] {
  let list = this.#torques
  if (list === null) { /* compute once */ this.#torques = list }
  return list
}
```

---

### `engine/layout/routing.ts` (service, transform)

**Analogs:** `app/lib/geometry.ts` (generic curve math, to be generalized) and `app/NumogramClient.tsx` lines 958-1306 (today's name-keyed routing memos, which D-directions explicitly ask to replace with pure numeric-id functions — read-only reference, never edit this file).

**Curve geometry to copy almost verbatim** (`app/lib/geometry.ts`, full file, 52 lines):
```typescript
export function quadPath(from: Pos, to: Pos, bulge: number): string {
  if (Math.abs(bulge) < 0.5) return `M${from.x} ${from.y}L${to.x} ${to.y}`
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
  const dx = to.x - from.x, dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const px = -dy / len, py = dx / len
  return `M${from.x} ${from.y}Q${mx + px * bulge} ${my + py * bulge} ${to.x} ${to.y}`
}

export function curveAway(from: Pos, to: Pos, cx: number, cy: number, factor = 0.2): string {
  const dx = to.x - from.x, dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
  const px = -dy / dist, py = dx / dist
  const dot = px * (cx - mx) + py * (cy - my)
  const sign = dot > 0 ? -1 : 1
  return quadPath(from, to, sign * dist * factor)
}
```
Note the `|| 1` guard against a zero-length division (two nodes at the same point) — carry this into `engine/layout/routing.ts`; it is exactly the kind of degenerate-base guard Pitfall 3 calls out. `curveAway`'s `towardCentre`-by-dot-product pattern is the direct analog for RESEARCH.md's gate-bulge and Y-junction formulas — same sign-of-dot-product idea, generalized from a hard-coded `(cx, cy)` to `layout.center`.

**What must change, not just be copied** (`app/NumogramClient.tsx`, read-only reference): the existing memos are keyed by cycle **name** (`c.name === 'Warp'`) and cache orientation in a `useRef` written inside `useMemo` — this is exactly the anti-pattern RESEARCH.md's "Anti-Patterns to Avoid" section calls out ("Name-keyed routing"). `engine/layout/routing.ts` must take `(g: Numogram, layout: Layout)` and use `cycle.kind` / "is this zone a member of the pair" (numeric/id checks from `engine/core/types.ts`'s `Cycle`/`PairInfo`) instead, and accept an optional `orientation: Int8Array` parameter rather than a ref (Pitfall 6/Pattern 6 in RESEARCH.md). Do not import from or edit `NumogramClient.tsx`; it is frozen-adjacent (DOM goldens depend on its current behaviour).

---

### `engine/scene/tiers.ts` (model + service, request-response)

**Analog:** `engine/core/base.ts` (55 lines, read in full)

**The discriminated-result + "report why, never throw for pure data" pattern** (lines 7-12, 31-48) is the direct template for `TierTable`/`validateTierTable`:
```typescript
export type BaseProblem = 'not-a-number' | 'infinite' | 'not-integer' | 'zero' | 'negative' | 'odd' | 'too-large'

export type BaseCheck =
  | { readonly ok: true; readonly base: number }
  | { readonly ok: false; readonly reason: BaseProblem; readonly message: string }

function problem(reason: BaseProblem, message: string): BaseCheck {
  return { ok: false, reason, message }
}

export function validateBase(n: unknown): BaseCheck {
  if (typeof n !== 'number' || Number.isNaN(n)) {
    return problem('not-a-number', `Invalid base ${describeValue(n)}: the base must be a number`)
  }
  ...
  return { ok: true, base: n }
}

export function assertBase(n: unknown): asserts n is number {
  const check = validateBase(n)
  if (!check.ok) throw new RangeError(check.message)
}
```
`validateTierTable(t: TierTable): string[]` in RESEARCH.md's proposed schema is the same shape, simplified to "list of problem strings" (closer to `structure.sweep.test.ts`'s `mismatches: string[]` collector than to a single `BaseCheck`, since the table can have many independent problems at once). Follow `validateBase`'s style of one `if` block per rule, each producing one specific, named problem — never a generic "invalid" message.

**Frozen constant-data-as-typed-object** (`engine/core/numogram.ts` lines 18-22):
```typescript
export const NUMOGRAM_CACHE_LIMITS: Readonly<{ entries: 4; zones: 67108864 }> = Object.freeze({
  entries: 4,
  zones: MAX_BASE,
} as const)
```
`TIER_TABLE` itself (the committed measured data) should be declared and frozen the same way — a `const` object literal with an explicit type annotation and `as const`/`Object.freeze`, not a class instance, so it stays trivially serializable and diffable in review.

**Testing analog:** `engine/test/base.test.ts` unit-tests `validateBase`/`assertBase` by asserting the exact `reason` and `message` for every invalid input class, and `assertBase` by `expect(() => ...).toThrow(RangeError)`; `engine/test/tiers.schema.test.ts` should assert `validateTierTable`'s returned problem list is empty for a valid table and contains a specific string for each broken invariant (monotonic n, `basedOn` references a declared environment, etc.) — never assert a *value* is below a wall-clock threshold (Pitfall 10 in RESEARCH.md, CLAUDE.md's "no timing assertions").

---

### `engine/scene/svgString.ts` (service, transform)

**Analog:** `engine/core/numerals.ts` (string-building discipline) + `app/lib/geometry.ts` (path-string templates, above).

**Deterministic string building, no locale, no built-in radix conversion** (`engine/core/numerals.ts` lines 66-77):
```typescript
export function formatNumeral(value: number, base: number, minDigits = 1): string {
  if (!Number.isSafeInteger(minDigits) || minDigits < 1 || minDigits > MAX_MIN_DIGITS) {
    throw new RangeError(`Invalid minDigits ${show(minDigits)}: must be a whole number from 1 to ${MAX_MIN_DIGITS}`)
  }
  const digits = digitsOf(value, base)
  const padded = digits.length >= minDigits ? digits : new Array<number>(minDigits - digits.length).fill(0).concat(digits)
  if (base > LETTER_BASE_LIMIT) return padded.join(NUMERAL_SEPARATOR)
  let text = ''
  for (const digit of padded) text += NUMERAL_DIGITS.charAt(digit)
  return text
}
```
`fmt(v)` in `engine/scene/svgString.ts` (RESEARCH.md Pattern 8: "2 decimals, never `-0`") should follow the same shape: one small pure function, explicit range/edge handling before any string work, `+=`/`join` concatenation (never `toLocaleString`, never `Intl`, never `Date`). `formatNetSpan` (numerals.ts line 149-151, `` `${formatNumeral(a, base)}::${formatNumeral(b, base)}` ``) is the exact function the pair-graph emitter's `hi::lo` node labels must call — do not reimplement net-span formatting in `engine/scene`.

**XSS-safe interpolation:** RESEARCH.md's Security Domain section requires an `esc()` helper for the `title` option (`&`, `<`, `"`, and `>` for safety) before any free text is interpolated into the emitted SVG string; no existing engine file needs this (numerals never touch free text), so write it fresh in `svgString.ts`, next to `fmt`.

---

### `app/presets/base10/layouts.ts` (provider/adapter, transform)

**Analogs:** `app/presets/base10/currents.ts` and `app/presets/base10/gates.ts` (both read in full) — this is the exact seam shape D-05 asks for.

**Header convention and "structure from the engine, literal text from lore" split** (`currents.ts` lines 1-11):
```typescript
// Base-10 currents for the viewer (MIG-01, plan 02-09). Original CCRUG code (MIT, NOTICE section 1); the text is in lore.ts.
// Structure comes from the engine pairs and currents of createNumogram(10): the order of the cycles, `to` (= hi - lo) and
// the in-base label `hi−lo=to`; name and description are joined by pair id from the lore module.
import { formatNumeral } from '../../../engine/index'
import type { CurrentData } from '../../data/types'
import { CURRENT_LORE } from './lore'
import { BASE10 } from './numogram'
```
`layouts.ts`'s header should say the analogous thing: literal coordinate tables (`P_ORIGINAL` etc., moved here from `app/data/positions.ts`) are art (frozen, never derived), while draw order, frame height and region-label positions must be provable against `createNumogram(10)` and the frozen DOM goldens. **Critically, per Pitfall 1 (bundle weight) in RESEARCH.md, this file must import `engine/layout` TYPES ONLY** (`import type { Layout, LayoutSpec } from '../../../engine/layout'`), unlike `currents.ts`/`gates.ts` above which import and call real engine *functions* (`formatNumeral`, `createNumogram`) — that is fine for those two small formatters, but `engine/layout`'s runtime is ~19.8 KB minified and must not be pulled into the viewer bundle. Build the preset arrays from the literal tables directly, not by calling any `engine/layout` function.

**Build-once-at-module-load function pattern** (`currents.ts` lines 31-42, `gates.ts` lines 12-31): a private `buildX()` function assembles the list once, guarding on lore completeness with an explicit `throw` (never a silent `?? {}`), and the module exports the already-built constant:
```typescript
function buildCurrents(): CurrentData[] {
  const base = BASE10.base
  return currentPairIds().map((pairId) => {
    const lore = CURRENT_LORE[pairId]
    if (lore === undefined) throw new Error('base-10 lore missing for current ' + pairId)
    ...
  })
}
export const CURRENTS: CurrentData[] = buildCurrents()
```
`layouts.ts` should build its four `LayoutSpec`s the same way: one `build...()` function per layout (`buildOriginal`, `buildLabyrinth`, `buildLadder`, `buildPlanetary`), each returning the literal `Float64Array`s, frame, centre, `drawOrder` and region-label positions from the tables already in `app/data/positions.ts`, exported as already-built constants.

---

### `app/data/positions.ts` (MODIFIED, provider seam, transform)

**Analog:** `app/data/gates.ts` (3 lines, the exact pattern already in the repo — read in full):
```typescript
// Base-10 data seam (MIG-01): gates derived by the engine and joined with lore in app/presets/base10/gates.ts.
export { GATE_LIST } from '../presets/base10/gates'
```
This is the literal target shape for `positions.ts` after this phase, generalized to rebuild `Record<number, Pos>` objects from the new preset's typed arrays rather than a bare re-export, because `positions.ts` must keep its **exact current export names** (`P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER`, `PLANETARY_CX`, `PLANETARY_CY`, `PLANETARY_RADIUS`, `PLANETARY_DEFAULT_ANGLE`, `PLANETARY_SIZE`, `CENTER`) so that `app/hooks/useTween.ts` (imports `P_ORIGINAL, P_LABYRINTH, P_LADDER, CENTER`, line 3) and `app/lib/planetary.ts` (imports `PLANETARY_CX, PLANETARY_CY, PLANETARY_RADIUS`, line 2) keep working unmodified. Comment-header style: one line naming which plan/phase introduced the seam and which file now derives the data, exactly like the line above.

---

### `tests/presets/base10-layouts.test.ts` (test/oracle, request-response)

**Analogs:** `tests/oracle/base10.oracle.test.ts` (frozen-fixture equality pattern, read in full) + `tests/oracle/deriveBase10.ts` (the derivation helper it compares against).

**Frozen-fixture-never-regenerated guard plus deep-equal against derived data** (`base10.oracle.test.ts` lines 13-20, 85-98):
```typescript
const FIXTURE = fileURLToPath(new URL('../../engine/test/fixtures/base10.golden.json', import.meta.url))
const raw = readFileSync(FIXTURE)
const golden = JSON.parse(raw.toString('utf8')) as Base10Oracle
...
describe('fixture file', () => {
  it('is LF only and ends with a newline', () => {
    expect(raw.includes(13)).toBe(false)
    expect(raw[raw.length - 1]).toBe(10)
  })
})

describe('oracle equality', () => {
  const { planetary: gp, ...gRest } = golden
  const { planetary: dp, ...dRest } = deriveBase10Oracle()
  it('the untouched app data derives exactly the frozen JSON (everything but planetary positions)', () => {
    expect(dRest).toEqual(gRest)
  })
  ...
})
```
`tests/presets/base10-layouts.test.ts` should read `engine/test/fixtures/base10.golden.json`'s `layouts`, `center` and `planetary` fields the same way and deep-equal them against the new preset module's built arrays (converted back to `Record<number, Pos>` for the comparison, matching `deriveBase10Oracle`'s `layouts.original/labyrinth/ladder` and `planetary.positionsAtDefaultAngle` shapes, lines 181-199 of `deriveBase10.ts`). **Never** regenerate the fixture to make this test pass (CLAUDE.md, D-15).

**DOM-golden parity (new capability, no direct test analog, but the fixture format is already read above):** the frozen golden files under `e2e/__golden__/golden.spec.ts/{original,labyrinth,ladder}--default.txt` are plain indented pseudo-DOM text (one element per line, e.g. `<svg class="w-[580px] flex-shrink-0" style="overflow:visible" viewBox="0 0 800 940">` as line 1 of `original--default.txt`). Write a small, local (not shared/exported) text parser inside the new test file that extracts: the `viewBox` `H` from line 1, the ordered sequence of zone-label `<text ... x="..." y="...">` nodes (their order is the draw order; RESEARCH.md verified `x`, `y - 1` recovers each preset's coordinates), and the `WARP`/`PLEX`/`TORQUE` label lines. This mirrors `page-weight.mjs`'s `countElements`/`measureDomNodes` (`scripts/page-weight.mjs` lines 34-37, 71-78) which already parses these exact golden files by line-matching `^ *<` — reuse that same "the golden file is the oracle, read it, don't re-render" idea, but pull out attribute values instead of just counting lines.

---

### `scripts/review-sheet.ts` and `scripts/spike/*.ts` (dev-only scripts, file-I/O / event-driven)

**Analog for `review-sheet.ts`:** `scripts/capture-base10-oracle.ts` (19 lines, read in full):
```typescript
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
...
mkdirSync(dirname(OUT), { recursive: true })
const text = JSON.stringify(deriveBase10Oracle(), null, 2) + '\n'
writeFileSync(OUT, text, 'utf8')
console.log(`capture-base10-oracle: wrote ${Buffer.byteLength(text)} bytes`)
```
`scripts/review-sheet.ts` (run via `tsx`, same as this file) should follow the same shape: a repo-root sanity check, `mkdirSync(..., { recursive: true })` before writing, a final `console.log` reporting bytes written — but unlike this analog it writes to a **gitignored** path (`.review/layout-review.html`) and should NOT refuse to overwrite (it is regenerated every review cycle, unlike the frozen oracle).

**Analog for the CLI-shape of `scripts/spike/*.ts`:** `scripts/page-weight.mjs` (full file read) — closest structural analog for "a script with subcommands that separates pure measurement/comparison functions (exported, unit-testable) from a thin `main(argv)`/`isMain` guard":
```javascript
export function measure(outDir = OUT_DIR, goldenDir = GOLDEN_DIR) { ... }
export function compare(baseline, current, tolerance = ...) { ... }
function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'print') { ... }
  if (cmd === 'check') { ... }
  if (cmd === 'update') { ... }
  throw new Error('page-weight: usage: check | update --reason "<why>" | print')
}
if (isMain(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)) }
  catch (e) { console.error(...); process.exitCode = 1 }
}
```
Match this: keep the Playwright-driving parts (`scripts/spike/driver.ts`) thin and imperative, but export pure functions for anything that transforms already-collected measurements into the `TierTable` shape (so `engine/test/tiers.schema.test.ts` can exercise the shaping logic without launching a browser). Use `scripts/is-main.mjs`'s `isMain(import.meta.url)` guard so the driver can be imported by a test without executing. **No existing script in this repo launches Playwright outside the `playwright test` runner** — `e2e/*.spec.ts` files all run under `npx playwright test`, not as standalone Node scripts — so this is a genuinely new shape; see "No Analog Found" below.

## Shared Patterns

### Engine purity (applies to every file under `engine/layout/` and `engine/scene/`)
**Source:** `engine/test/guard.test.ts` (enforced by `tsc -p engine/tsconfig.json` + the ESLint override, lines 1-4, 50-100)
**Apply to:** every new `engine/layout/*.ts` and `engine/scene/*.ts` file.
- Relative imports only (no bare `'react'`, no path aliases like `'@/app/...'`, no reaching into `tests/`, `scripts/`, `component-library/`).
- No DOM globals (`document`), no Node globals (`process`), no `node:*` imports.
- No `Math.random()`, no `new Date()`, no `Date.now()` anywhere in `engine/` non-test code (determinism, Pitfall 15/D-locked-earlier).
- The guard test itself (`engine/test/guard.test.ts`) is not modified by this phase; a new violation would already be caught by it and by `npm run typecheck` (`tsc -p engine/tsconfig.json --noEmit`) — run that command after writing each new engine file.

### `noUncheckedIndexedAccess` discipline
**Source:** `engine/core/numogram.ts` (`?? 0` on every typed-array read, e.g. lines 75, 78-79, 86, 91, 103-104) and `engine/core/arith.ts`/`engine/core/base.ts` (`checkIndex`, explicit range checks before any arithmetic).
**Apply to:** every typed-array read in `engine/layout/*.ts` (`Float64Array` x/y by zone, `Int32Array`/`Uint8Array` scratch arrays in the packers). Use `?? 0` for a safe numeric default, or the shared `checkIndex('description', i, length)` helper (`engine/core/index-check.ts`) when the index must exist and an out-of-range value is a caller bug, not routine data.

### Cached, assert-first factory
**Source:** `engine/core/numogram.ts` `createNumogram` (lines 326-345): `assertBase(base)` runs before any allocation; a bounded LRU `Map` (insertion order = recency) evicts oldest entries by both an entry count and a total-size budget.
**Apply to:** `engine/layout/registry.ts`'s `resolveLayout(id, g, presets?)` if it caches anything per `(id, base)` — validate the layout id and base before doing any work, and if a cache is added, bound it the same way (do not let a pathological sequence of distinct large bases grow memory unbounded).

### Sweep-and-collect-mismatches testing
**Source:** `engine/test/structure.sweep.test.ts` (lines 9, 17-19, 117-152) — one `expect` per range, mismatches collected as short strings capped at `MAX_MISMATCHES`, so a failure names the exact base and field without 1000s of separate assertions:
```typescript
const MAX_MISMATCHES = 200
const check = (what: string, got: unknown, expected: unknown): void => {
  if (got !== expected && mismatches.length < MAX_MISMATCHES) mismatches.push(`n=${n} ${what}: ${String(got)} != ${String(expected)}`)
}
...
it('n in [2, 500]', () => {
  const { covered, mismatches } = sweep(2, 500)
  expect(covered).toBe(250)
  expect(mismatches.slice(0, 20)).toEqual([])
})
```
**Apply to:** `engine/test/layout.ring.test.ts`, `layout.pairgraph.test.ts`, `layout.degenerate.test.ts` — every "for every even n in 2..400 (plus notable large bases), check adjacency/alternation/anticlockwise/no-overlap" test RESEARCH.md's Phase Requirements table calls for. Sample large bases (666, 1024, 4096, 65536, 2^20) the way `engine/test/demons.sweep.test.ts` samples "twelve larger even bases... from a fixed seed" with `fast-check` — write the seed and run count directly in the test file (existing project convention, not a `fast-check` global config).

### Timezone-independent determinism canary
**Source:** `engine/test/tz.test.ts` (full file, 17 lines): a tiny, fast test that fails loudly if `CCRUG_TZ`/the pinned timezone stopped applying, run in both `npm run test` (UTC) and `npm run test:tz` (America/New_York).
**Apply to:** `engine/test/layout.determinism.test.ts` (LAY-01's "identical typed arrays under `CCRUG_TZ=America/New_York`" requirement) — structure it as "compute the same layout twice, in the same process and compare digests" plus rely on the existing `npm run test:tz` command to catch any accidental `Date`/locale dependency, rather than re-implementing the timezone check itself.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/spike/*.ts` (the Playwright browser-launch/CDP-session part specifically, not the measurement-shaping part) | script | event-driven | No existing script in this repo launches a Playwright `Browser`/`CDPSession` outside the `playwright test` runner; `e2e/*.spec.ts` all run under `npx playwright test`. `scripts/page-weight.mjs` is the closest *shape* analog (pure functions + thin CLI) but has no browser-driving precedent to copy from. Build this from RESEARCH.md's "Measurement harness essentials" code block (already verified in this session) rather than from repo precedent. |

## Metadata

**Analog search scope:** `engine/core/`, `engine/test/`, `app/presets/base10/`, `app/data/`, `app/lib/`, `app/hooks/`, `app/NumogramClient.tsx` (read-only reference), `tests/bruteforce/`, `tests/oracle/`, `scripts/`, `e2e/__golden__/golden.spec.ts/` (one fixture file).
**Files scanned (read in full or by targeted excerpt):** `engine/core/{numogram,types,base,arith,numerals}.ts`, `engine/test/{structure.sweep,guard,tz,demons.sweep}.test.ts`, `engine/index.ts`, `app/presets/base10/{numogram,gates,currents,syzygies}.ts`, `app/data/{positions,types,gates}.ts`, `app/lib/{geometry,planetary}.ts`, `app/hooks/useTween.ts`, `app/NumogramClient.tsx` (targeted grep + surrounding context), `tests/bruteforce/numogramReference.ts`, `tests/oracle/{base10.oracle.test,deriveBase10}.ts`, `scripts/{check-repo.mjs,capture-base10-oracle.ts,page-weight.mjs}`, `e2e/__golden__/golden.spec.ts/original--default.txt` (header lines), `package.json` (scripts).
**Pattern extraction date:** 2026-09-27

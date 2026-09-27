---
phase: 02-engine-core-and-base-10-migration
reviewed: 2026-09-27T03:27:30Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - engine/core/arith.ts
  - engine/core/base.ts
  - engine/core/demons.ts
  - engine/core/numerals.ts
  - engine/core/numogram.ts
  - engine/core/types.ts
  - engine/core/unrank.ts
  - engine/index.ts
  - app/presets/base10/currents.ts
  - app/presets/base10/demons.ts
  - app/presets/base10/gates.ts
  - app/presets/base10/numogram.ts
  - app/presets/base10/regions.ts
  - app/presets/base10/syzygies.ts
  - app/data/currents.ts
  - app/data/demons.ts
  - app/data/gates.ts
  - app/data/syzygies.ts
  - app/data/zones.ts
  - app/lib/constants.ts
  - e2e/behaviour-collect.ts
  - e2e/behaviour-compare.ts
  - e2e/behaviour.spec.ts
  - scripts/check-repo.mjs
  - scripts/capture-notable-bases.ts
  - package.json
  - tests/bruteforce/numogramReference.ts
  - tests/bruteforce/numogramReference.test.ts
  - tests/bruteforce/notable-bases.fixture.test.ts
  - tests/e2e-normalizer/behaviour-compare.test.ts
  - tests/e2e-normalizer/behaviour-lore-coverage.test.ts
  - tests/presets/base10-adapter.test.ts
  - tests/presets/base10-lore.test.ts
  - tests/repo/check-repo.test.ts
  - engine/test/arith.test.ts
  - engine/test/base.test.ts
  - engine/test/base10.engine.test.ts
  - engine/test/ceiling.test.ts
  - engine/test/demons.sweep.test.ts
  - engine/test/demons.test.ts
  - engine/test/demons.unrank.test.ts
  - engine/test/notable-bases.test.ts
  - engine/test/numerals.test.ts
  - engine/test/numogram.test.ts
  - engine/test/structure.sweep.test.ts
findings:
  critical: 0
  warning: 1
  info: 10
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-27T03:27:30Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

Reviewed the engine core (`engine/core/*`, `engine/index.ts`), the base-10 adapters and data seams, the behaviour-baseline
helpers, the repo guard and capture scripts, the package.json change and the engine, oracle and repo tests. The math is
right: every claim in the review brief was re-derived or executed and held (closed-form counts, Warp iff n = 3o + 1,
demon classification, mesh arithmetic to 2^26, exact-integer correction after the float square root, in-base digital root,
LRU cache accounting, static-export adapters).

Evidence gathered while reviewing (all read-only; scratch scripts lived in the OS temp dir):

- `npx vitest run --project engine` (486 tests) and `--project oracle` (472 tests) pass; `tsc -p engine/tsconfig.json`,
  `tsc -p engine/tsconfig.test.json` and ESLint on `engine/core`, `app/presets`, `app/data` are clean; `node scripts/check-repo.mjs` is OK.
- Extra fuzz outside the shipped tests: 41 additional even bases (302..1200), every one of the 3 types and 7 subtypes, counts
  compared with a full mesh scan and 300 ranks per selector each (104,100 rank checks): 0 mismatches.
- 2^26 spot checks with the cyclic and cross-Torque selectors (which the ceiling test deliberately avoids): results ascend and
  classify correctly (see IN-02 for the cost).
- Base-2^26 build is 0.8 to 1.0 s and +271 MiB of array buffers; the one-huge-cycle base 67108860 is 1.1 s. Both far under the
  20 s / 768 MiB ceilings, so the 7 GB runner memory and timing thresholds are not a concern.

No critical issues. One contract defect in the numeral formatter/parser pair (WR-01) and ten low-severity items
(inconsistent `-0` handling, latency of two unrank subtypes at the cap, view identity, unbounded error echo, one silent-skip
path in the behaviour spec, and weakened lore guard coverage among them).

## Warnings

### WR-01: `parseNumeral` refuses text that `formatNumeral` can write (dotted bases, larger minDigits)

**File:** `engine/core/numerals.ts:17-18`, `:65-75`, `:101` (contract stated at `:10` and `:88`); test gap at `engine/test/numerals.test.ts:141-151`
**Issue:** The header promises "parseNumeral accepts exactly what formatNumeral can write (plus extra leading zero digits where
the grammar allows)". That does not hold for bases above 36. `formatNumeral` allows `minDigits` up to 64 (`MAX_MIN_DIGITS`),
but `parseNumeral` rejects any text longer than 64 characters (`MAX_TEXT_LENGTH`), and a dotted numeral spends one character
per zero digit plus one per separator. Executed against the real code:

```
formatNumeral(0, 60, 33)                 -> 65 chars -> parseNumeral throws RangeError "longer than 64 characters"
formatNumeral(5, 37, 64)                 -> 127 chars -> throws
formatNumeral(MAX_SAFE, 37, 32)          -> 72 chars -> throws
formatNumeral(MAX_SAFE, 2**26, 32)       -> 77 chars -> throws
```

The zero-only case fails from `minDigits` 33 on, large values already from about 24 (base 2^26 uses up to 8 characters per
digit). Letter bases (<= 36) are fine because a digit is one character and 64 digits fit in 64 characters. Today the only
production caller pads to 2 digits, so nothing user-visible breaks, but Phase 4 is documented as consuming this scheme and any
label round-trip (read a padded zone label back from an input box, URL or share link) would throw. The round-trip property test
only pads 1..4, which is why it never sees this; `numerals.test.ts:212-213` then pins the 67-character rejection as intended
behaviour, which is exactly the writable output `formatNumeral(0, 60, 34)`.
**Fix:** Bound the grammar by digit groups, not characters. In the dotted branch count groups and reject above
`MAX_MIN_DIGITS`, and raise the character cap so the longest writable numeral fits (64 groups of up to 8 characters plus 63
dots is 575):

```ts
const MAX_TEXT_LENGTH = MAX_MIN_DIGITS * 8 + (MAX_MIN_DIGITS - 1) // 575: the longest text formatNumeral can write
...
// dotted branch, next to `groupLength = 0`
groups++
if (groups > MAX_MIN_DIGITS) throw numeralError(text, base, `more than ${MAX_MIN_DIGITS} digit groups`)
```

(keep the 64-character cap for `base <= LETTER_BASE_LIMIT`), update the two rejection rows at `numerals.test.ts:212-213`
(65 zeros in base 10 stays rejected via the per-base cap, `'0.'.repeat(33) + '0'` in base 60 becomes accepted), and add a
round-trip property over `minDigits` 1..64, bases up to `MAX_BASE` and values up to `MAX_SAFE_INTEGER`.

## Info

### IN-01: `-0` leaks through the numogram accessors although `demons.ts` guarantees it never does

**File:** `engine/core/numogram.ts:55-60`, `:280-308`, `:264-273`; `engine/core/arith.ts:13-18`; contrast `engine/core/demons.ts:32-37`
**Issue:** `demons.ts` normalizes `-0` ("so no returned field is ever -0") and its test pins that. The identical helper in
`numogram.ts` returns `value` untouched, and `triangular(-0)` computes `(-0 * 1) / 2 = -0`. Verified by execution on base 10:
`g.pair(-0).id`, `g.pair(-0).lo`, `g.current(-0).pair/.lo`, `g.gate(-0).from` and `.cumulation`, `g.cycleAt(-0).id` and
`g.pairOf(-0)` are all `-0` (`Object.is(x, -0) === true`), whereas `demons.ref(-0, 1).b` is `+0`. Harmless for `===`, Map keys,
`String()` and `JSON.stringify`, but it breaks `Object.is`/vitest `toEqual` comparisons and is a copy-paste divergence
(`checkIndex`, `show` and `choose2` exist in five engine files).
**Fix:** Keep one shared `checkIndex` (e.g. `engine/core/check.ts`) that returns `value === 0 ? 0 : value`, use it in
`numogram.ts`, `demons.ts` and `unrank.ts`, return `0` early in `triangular` for `k === 0`, and extend the "never returns a
negative zero" test to `pair`, `current`, `gate`, `cycleAt`, `pairOf`, `triangular`.

### IN-02: `cyclic-chrono` and `cross-torque-chrono` unranking costs 2 to 3 seconds per `at(k)` at the cap and is untested there

**File:** `engine/core/unrank.ts:75-87`, `:131-139`; docs at `engine/core/types.ts:102-107`; test avoidance at `engine/test/ceiling.test.ts:229-232`
**Issue:** As documented, these two selectors cost `O(K log n)` per binary-search step with K Torque cycles. At `n = 2^26`,
K = 1,290,870, and measured on this machine one `at(k)` takes 2.6 to 3.1 s (cyclic) and 2.0 to 2.5 s (cross-Torque); at 2^22
it is about 0.17 s. Any Phase 4/5 demon browser that walks ranks (paging a list, 20 rows) on a large base blocks the main thread
for a minute. The first call also allocates a 128 MiB sorted copy (`sortedTorquePairs`) that is counted neither in
`storageBytes` nor in `NUMOGRAM_CACHE_LIMITS.zones`, so the real per-numogram footprint at the cap is about 400 MiB, not the
271 MiB the ceiling test measures. No test exercises these two selectors above n = 4096.
**Fix:** At minimum add a ceiling test that calls `at(0)` and `at(count - 1)` of both selectors at 2^26 with a generous time bound
and an `arrayBuffers` bound that includes the sorted copy, and state the per-call latency in the `DemonSpace.subtype` doc.
Longer term, precompute per-cycle prefix counts or group equal-length cycles so the per-step cost stops scaling with K, or have
the UI page from a cursor instead of calling `at(k)` per row.

### IN-03: `cycleAt(id)` identity depends on whether `cycles` has been read

**File:** `engine/core/numogram.ts:232-236`, `:264-273`
**Issue:** Before `g.cycles` is first read, `cycleAt(id)` returns a new frozen `CycleView` on every call for Torque cycles
(only Plex and Warp are shared); afterwards it returns the cached list entry. `g.cycleAt(0) === g.cycleAt(0)` is therefore
false early and true later. The docs say "compare views by id", and one test pins the behaviour, but a consumer that keys a
`Map`, `WeakMap` or a React dependency array by view object gets results that change with call history.
**Fix:** Memoize views lazily in one store (e.g. a `Map<number, Cycle>` filled by `#viewOf`, with `cycles` built from the same
store) so identity is stable per id, or freeze the documented contract in the `Numogram.cycleAt` JSDoc.

### IN-04: error messages echo an unbounded caller string

**File:** `engine/core/base.ts:14-20`; `engine/core/demons.ts:175-177`
**Issue:** `numerals.ts` bounds the echoed text to 40 characters (`MAX_ECHO`), but `describeValue` (base.ts) and `showName`
(demons.ts) put the whole `JSON.stringify(string)` into the message. `validateBase('x'.repeat(5e7))` or
`space.group('x'.repeat(5e7))` builds a 50 MB message that then lands in the UI or a log. Linear, not amplifying, so only a
robustness nit.
**Fix:** Truncate to a fixed length in both helpers (same idea as `MAX_ECHO`) and add one test per helper.

### IN-05: `numogramInternals` and its WeakMap are only used by a test

**File:** `engine/core/numogram.ts:41-48`, `:227`
**Issue:** Production code passes `NumogramInternals` explicitly (`createDemonSpace(this, this.#s)`); `internalsOf`, the
WeakMap write in the constructor and `numogramInternals()` exist solely for `engine/test/numogram.test.ts:238-253`. Not a bug,
but it is a second global registry and a way to reach the shared mutable typed arrays from any module that imports
`engine/core/numogram` directly (the barrel does not export it).
**Fix:** Either keep it under a clearly test-only name/doc comment, or have the test read the arrays through a documented
test hook instead of a production export.

### IN-06: empty selections report an impossible range

**File:** `engine/core/unrank.ts:253-256`
**Issue:** For a selection with `count === 0` (for example `cross-torque-chrono` in base 10, `chrono` in base 4) the error is
`Invalid demon rank 0 for cross-torque-chrono: expected a whole number from 0 to -1`.
**Fix:** `if (q.total === 0) throw new RangeError(\`${q.selector} has no demons in base ${q.space.base}\`)` before the range
message, and assert the wording in `demons.unrank.test.ts:116-120`.

### IN-07: the behaviour spec is silently skipped if the Playwright project is renamed

**File:** `e2e/behaviour.spec.ts:366`
**Issue:** `test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', ...))` couples the safety net for the
lore move to a string in `playwright.config.ts`. Renaming that project (or running only the `chromium-ny` project) makes all
five behaviour tests report "skipped" and `npm run test:e2e` still exits 0, so the baseline stops guarding anything without any
signal.
**Fix:** Export the project name from one shared module used by both the config and the spec, and add a check that fails when the
spec finds no project with that name (for example a `test.beforeAll` that throws if `!test.info().config.projects.some(p => p.name === UTC_PROJECT)`).

### IN-08: lore guard coverage narrowed from five files to one

**File:** `scripts/check-repo.mjs:19`; `tests/presets/base10-adapter.test.ts:446-483`
**Issue:** Before this phase every `app/data/*.ts` file had to carry the CCRU licence header. Now only `lore.ts` does, and the
"adapter files hold no CCRU lore text" test scans `app/presets/base10/` only. If CCRU text is pasted back into an
`app/data/*.ts` seam or `app/lib/constants.ts` (no header required any more), no guard or test notices, and NOTICE would then be
wrong about which files are MIT.
**Fix:** Extend that test's file list to `app/data/*.ts` and `app/lib/constants.ts` (the lore strings are already in scope), which
is a two-line change.

### IN-09: overwrite refusal in the capture script is check-then-write

**File:** `scripts/capture-notable-bases.ts:21-24`, `:88-90`
**Issue:** The frozen fixture is protected by `existsSync(OUT)` followed much later by `writeFileSync(OUT, ...)`. Two runs
started together, or a file appearing in between, would overwrite a frozen oracle (the sha256 manifest would catch it later, but
only if someone runs the guard).
**Fix:** `writeFileSync(OUT, text, { encoding: 'utf8', flag: 'wx' })`, which fails atomically if the file exists.

### IN-10: memory assertions on process-wide counters are tighter than the regressions they guard

**File:** `engine/test/ceiling.test.ts:155`, `:289`
**Issue:** `demonBytesGrowth` and `unrankBytesGrowth` must stay under 1 MiB of `process.memoryUsage().arrayBuffers`. The regressions
they are meant to catch are 128 MiB (the sorted Torque copy) or 256 MiB (a per-call O(n) buffer). It is deterministic today
(+0.0 MiB, because the whole test body is synchronous under the default forks pool), but it would start to depend on unrelated
allocations if the pool is ever switched to threads or async work is added between the two reads.
**Fix:** Loosen both bounds to 16 MiB; they still catch every regression named in the comments with a wide margin.

---

_Reviewed: 2026-09-27T03:27:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

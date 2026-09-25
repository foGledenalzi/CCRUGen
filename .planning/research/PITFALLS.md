# Pitfalls Research

**Domain:** Arbitrary-base (even n >= 2) CCRU numogram generator: pure TS math engine, procedural layout, tiered SVG/Canvas renderer, demon layer, naming builder, static export. Brownfield on the `lumpenspace/ccru` Next 14 / React 18 / TS base-10 viewer.
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH. Math pitfalls are HIGH (recomputed with a prototype, cross-checked against the guide and `reference/INDEX.md`). Toolchain/static-export pitfalls are HIGH (official Next 14 docs, `tsc` run, `which zip` on this machine). Browser canvas limits are MEDIUM (secondary sources). Rendering-performance thresholds are LOW-MEDIUM by design: the ceiling spike must measure them, not this file.

## How to read this

Phase labels below are WORKING NAMES (the roadmapper may rename or merge them). They map onto the Active requirements in `PROJECT.md`:

| Label | Scope |
|-------|-------|
| **P0 Foundations** | Test runner, TS config, build unblock (Windows), golden-master capture of the untouched base-10 viewer |
| **P1 Engine** | Pure math engine + golden/property tests |
| **P2 Spike** | Ceiling spike (measure renderer tiers) |
| **P3 Layout** | Procedural deterministic layouts |
| **P4 Migration** | Renderer generalization; base-10 becomes an engine preset |
| **P5 UI/URL** | Base picker, `?base=`, zone labels, summary |
| **P6 Demons** | Demon layer |
| **P7 Naming** | Naming builder |
| **P8 Export** | SVG/PNG/JSON export + static deployability |

## Findings that should change the plan (read first)

1. **The source guide contains errors that would poison golden fixtures.** Its own demon-type counts sum to 47, not 45 (4 "Syzygetic Xenodemons" should be 2); its conjecture that only bases 3^N+1 have several Torque cycles is false (110 of the 150 even bases <= 300 have more than one). Do not transcribe guide prose into tests without recomputing. (Pitfall 3, 4)
2. **Multiple Torque cycles are the norm, not an exotic case.** Of even bases 2..300: 2 have no Torque, 38 have exactly one, 110 have several; 71 have tied cycle lengths. Region/demon/legend/palette code that assumes "one Torque" or orders cycles by size only will be wrong or non-deterministic. (Pitfall 4, 5)
3. **`npm run build` cannot succeed on this machine today.** `build` runs `build:plugin-zip` first, which shells out to `zip`; `zip` is not installed here (verified `which zip` -> not found). (Pitfall 12)
4. **`tsconfig.json` has `"target": "es5"` with no `downlevelIteration`.** Verified with `tsc`: `for..of` / spread over `Set`/`Map`/generators is TS2802 and `123n` is TS2737. Engine code that passes under Vitest (esbuild, no type-check) will break `next build`. (Pitfall 11)
5. **Static export is incompatible with three existing features**, not just the Blob route: the POST route handler, the two pages that read `searchParams` (`/` redirect, `/numogram` `generateMetadata`), and per-share OG preview images. (Pitfall 12)
6. **CONCERNS.md undercounts the hard-coded base-10 surface.** Loops are the easy part; the dangerous ones are literals TypeScript cannot flag: `9 - z` (>= 10 sites), `[1, 2, 4, 5, 7, 8]` (3 sites besides `TC`), `n <= 9` (3 files), and `0..9` object-literal initializers that crash at n > 10. (Pitfall 6)
7. **`NumogramClient.tsx` is 1,943 lines, not ~1,500**, and the gate/current geometry (lines ~1127-1476) lives inside `useMemo` in the component, so it cannot be golden-tested until extracted. (Pitfall 7)

## Critical Pitfalls

### Pitfall 1: Digit sums done in decimal, or the digital-root off-by-one [HIGH]

**What goes wrong:**
- **Decimal reduction on in-base values.** `plexExpr` (`app/lib/numogram.ts`) uses `cum < 10`, `while (current >= 10)` and `String(current).split('')`. Ported naively to base 12, gates come out `0,1,3,6,1,6,3,1,9,9,1,3` instead of the correct `0,1,3,6,a,4,a,6,3,1,b,b` (zone 4: T=10 is the single digit `a` in base 12, not 1+0).
- **`T % (n-1)` instead of `((T-1) % (n-1)) + 1`.** The digital root of a positive multiple of n-1 is n-1, not 0. Wrong for 302 (base, zone) pairs across bases 4..200. In base 10 that is gates 8 (T=36) and 9 (T=45) landing on 0 instead of 9.
- **The T(0)=0 gate and base 2.** The `((T-1) % (n-1)) + 1` formula needs an explicit `T === 0 ? 0` guard. Without it base 10 and base 4 happen to work (`-1 % 9 = -1`, so result 0) but **base 2 returns 1** (`-1 % 1` is `-0`, `-0 + 1 = 1`), so gate 0 -> 1 instead of 0 -> 0. Base 2 also has n-1 = 1, so `T % 1` is always 0 and gate 1 -> 0 (wrong; should be 1 -> 1).
- **Gt-00 policy.** Existing `app/data/gates.ts` has 10 gates including `Gt-00` (0 -> 0); the guide and canonical drawing show only the 9 circles T(1)..T(9) ("many versions delete it"). Engine emits n gates; the renderer must decide. A golden test that compares "gate count" will flip-flop unless this is decided once.
- **Display strings.** `plexExpr` builds "4+5=9" from decimal digits. In base 12 the 9th triangular number (45) is written `39`, the sum is `10`, then `1+0=1`; every intermediate number must be formatted in-base. For n > 36 (`toString(radix)` limit) formatting needs a defined scheme (Pitfall 9).

**Why it happens:** Every prior implementation the author has seen is base-10; `% 9` "looks like" digital root; JS `%` is remainder, not modulo, so negative operands and `-0` bite exactly at the edge cases (T=0, n=2).

**How to avoid:**
- One primitive, `digitalRoot(value, base)`: `value === 0 ? 0 : ((value - 1) % (base - 1)) + 1`, used by gates and by anything else that reduces. Separate `toDigits(value, base): number[]` (digit VALUES) from label formatting (glyphs). Make `base` a required parameter with no default.
- Independent oracle in tests: iterated digit sum via `Number.prototype.toString(base)` for every even base 2..36 and every zone (0 mismatches expected; I measured 0 across n <= 200 for formula vs iterated in-base sum).
- Hand-verified literals from the guide's base-12 example (gate 4->a, 5->4, 7->6, 8->3, 9->1, a->b; "the 9th triangular number is `39` in base 12") plus explicit arrays for bases 2, 4, 6, 8: `[0,1]`, `[0,1,3,3]`, `[0,1,3,1,5,5]`, `[0,1,3,6,3,1,7,7]`.
- Invariants as property tests: gate(0)=0, gate(1)=1, gate(n-1)=n-1 in every even base (T(n-1) = (n/2)(n-1) is a multiple of n-1).

**Warning signs:** base-10 golden passes but a base-12 spot check disagrees; any gate value 0 for k > 0; `NaN`/`-0` in engine JSON; a `%` operator anywhere near a triangular number without a `T === 0` branch.

**Phase to address:** P1 (engine). Formatting scheme: P5.

---

### Pitfall 2: Base-vs-top-zone off-by-one, Numodemons, and mesh numbers [HIGH]

**What goes wrong:** Base n has zones 0..n-1; syzygy sum is n-1; demon count is T(n-1) = n(n-1)/2; "Numodemon" pairs sum to n (not n-1). The guide itself slips: Part 3's example "net-span 12::0" is written for a base-12 numogram whose highest zone is 11 (`b`); it is really a base-13 example (odd, invalid). Copying that example gives an invalid net-span.
- **Numodemon count is n/2 - 1**, not n/2: pairs {b, n-b} with 1 <= b < n/2 (the a == b case is not a demon; b = 0 would need a = n). Verified: base 10 -> 4, base 12 -> 5, base 4 -> 1, base 2 -> 0, base 28 -> 13, base 82 -> 40. Base 2 having 0 Numodemons and 1 demon is the classic array-bounds crash.
- **Mesh number = a(a-1)/2 + b with a > b** (0-based; CCRU "Mesh-00" is `1::0`). Off-by-one variants: 1-based index, `a(a+1)/2 + b`, or using `a >= b`. Max mesh is T(n-1) - 1 (base 10: 9::8 = 44). Golden checks: 1::0=0, 2::1=2, 9::8=44.
- **Inverse (mesh -> a::b)** via `floor((1 + sqrt(1+8m))/2)` is float-based; it matched exhaustively for n < 3000, but add an integer correction loop (`while a(a-1)/2 > m a--; while (a+1)a/2 <= m a++`) so it stays exact when the demon layer is windowed at large n.
- **Display base.** CCRU prints mesh numbers in decimal. Decide whether mesh numbers and net-spans display in-base; mixing (net-span in base 12, mesh in decimal, unlabeled) produces "wrong" screenshots that are actually right.

**Why it happens:** "base" and "top digit" differ by one in almost every sentence of the source material; the guide freely writes "12 demonic sounds" (n) and "12::0" (n, not n-1) in adjacent lines.

**How to avoid:** Name the two quantities distinctly in the API (`base` / `top = base - 1`). Encode each formula once (`meshOf(a,b)`, `pairOfMesh(m)`, `isNumodemon(a,b,n)`), test with the literals above and closed-form checks: `#Numodemons = n/2 - 1`, `max mesh = n(n-1)/2 - 1`, `pairOfMesh(meshOf(a,b))` round-trips for all a>b<n<=200.

**Warning signs:** a demon `a::a`, a zone equal to `n`, base-2 or base-4 throwing in the demon layer, Numodemon count equal to n/2.

**Phase to address:** P1.

---

### Pitfall 3: Golden fixtures derived from unreliable sources, or made tautological [HIGH]

**What goes wrong:**
- **Guide arithmetic/typo errors** (verified by recomputing the base-10 demon typing): (a) it lists "4 Syzygetic Xenodemons" and a total of 45; 12+3+12+12+4+4 = 47. Correct split is 12 cyclic + 3 syzygetic chrono + 12 plex-amphi + 12 warp-amphi + 4 chaotic xeno + **2** syzygetic xeno (9::0 and 6::3) = 45. (b) It says the two unlinked demons are "6::3, 6::9"; that is 6::3 and 9::0. (c) Part 1 lists odd base-12 zones as "1, 3, 5, 7, 8, b"; the odd zones are 1,3,5,7,9,b (8 is even). (d) Appendix B: "only 3^N+1 have multiple Torque regions" (hedged by the guide as "not guaranteeing it"); false, see Pitfall 4. (e) Part 3's example builds a name low-zone-first (0 then 12), contradicting Appendix B and the canonical names (high zone first: Ummnu = 9 + 8).
- **The two "known diagram errors."** The guide says widely-copied images render the top "15" as "16" and the small "3" as "8". Those are gate labels: Gt-15 (zone 5 -> 6) and Gt-03 (zone 2 -> 3). Mis-labelled, they would send 5 -> 7 and 2 -> 8. The repo's `gates.ts` has these right, but nothing guards them, and `reference/nonarian-numogram-*.svg` (scratch renderings from an earlier chat) must NOT be used as a fixture: their provenance is the "blurry image" class of source.
- **Tautology after migration.** `TESTING.md` recommends keeping `app/data/*.ts` as the golden fixtures. But `PROJECT.md` replaces that data with engine-derived data; once `app/data/*` is generated from the engine, "engine equals app/data" compares the engine to itself.
- **Field-shape mismatch.** `CURRENTS[i].from` is the EVEN zone of the pair for 4 of 5 entries (8, 2, 4, 6) and 9 for Plex (an exception); the engine's natural form is `hi::lo -> hi-lo`. Plex `to` is `hi` (9 = n-1); Warp `to` is `lo` (3); the renderer draws both folds toward the lower zone (`Math.min(from, 9-from)`). A comparator keyed on `from` will spuriously fail; compare on the unordered pair plus `to`.
- **Fixtures must not read `reference/`.** It is gitignored; a fresh clone and CI do not have it.

**Why it happens:** the guide is a hand-written Reddit post; the repo data was authored from the same blurry-image ecosystem; snapshot tools make "update the golden" one keystroke.

**How to avoid:**
- Freeze a numeric-only `tests/fixtures/base10.golden.json` (pairs, currents by pair+`to`, gates k -> to with T(k), demon net-spans + kinds, region membership) BEFORE any refactor, sourced from the current `app/data/*.ts` and re-verified against the Ccru book (Gt-15: 5->6, Gt-03: 2->3, Pandemonium Matrix p.231-254 for demon typing). No prose (`desc`/`detail`/lore) in fixtures.
- Add NAMED regression tests: "Gt-15 flows 5 -> 6 (not 16 -> 7)", "Gt-03 flows 2 -> 3 (not 8)".
- Recompute guide counts rather than copying them; keep a `docs/fixtures-provenance` note listing which literals come from which source and which guide statements were rejected (cite file + section, do not paste).
- Prefer literal `toEqual` fixtures to `toMatchSnapshot`; forbid `vitest -u` in CI; changes to `*.golden.json` require an explicit human-reviewed diff.
- Independent second implementation for differential testing (naive, string-based, per the guide's "calculate by hand" method) for bases <= 36.

**Warning signs:** a test that imports the thing it is validating; fixture diffs in a "refactor" commit; counts in tests copied from prose; guide's "47".

**Phase to address:** P0 (freeze fixtures first), P1.

---

### Pitfall 4: Region classification with several Torque cycles [HIGH]

**What goes wrong:**
- **Assuming one Torque.** Measured (even bases 2..300): none: 2 (bases 2, 4); exactly one: 38; several: **110**. Examples: 16 -> [4,2], 18 -> [4,4], 22 -> [6,3], 28 -> [9,3], 32 -> [5,5,5], 36 -> [12,3,2], 100 -> [15,15,5,5,5,3], 666 -> 14 cycles [36x7, 18x3, 12, 9, 3, 2]. The guide's 3^N+1 "shell" rule is true (10, 28, 82, 244, 730, 2188 all give [3^(N-1)..3]) but is a special case; base 80 -> [39] single.
- **Non-deterministic naming/ordering.** "Torque-A/B/C" ordered by length alone is ambiguous under ties (71 of 150 bases <= 300 have tied lengths, e.g. 18: [4,4], 32: [5,5,5]). If cycle order comes from `Map`/`Set` insertion order or from the direction the pair scan starts, golden fixtures flip when someone reorders a loop.
- **Units.** Guide and PROJECT.md use "length" for cycle length in PAIRS ([9,3] in base 28 = 18 and 6 zones). The guide itself says "3 pairs ... six zones". UI text saying "Torque length 3" for a 6-zone circuit will be read as 3 zones.
- **Deriving Warp from the formula.** `n = 3o+1, o odd` is a theorem (verified exact for all even n <= 5000), but code should find fixed pairs of the pair permutation and treat the formula only as a property-test oracle; otherwise a bug in either goes unnoticed. Only two fixed pairs can exist ({0,n-1} and {o,2o}).
- **Invented "Archetypal" region.** The guide's base-12 commentary invents an "archetypal" region (even zones, which never receive a major flow) distinct from Torque. That holds for EVERY even base (currents always land on the odd zone hi-lo) and is not a region; base-10's own Torque includes 2, 4, 8. If used for classification, demon counts stop matching the CCRU's 12/3/12/12/4/2.
- **Where "TC" (time circuit) goes.** `TC = Set([1,2,4,5,7,8])` and the `tc=1` URL param mean "all Torque zones"; with several parallel time-circuits define whether TC = union (recommended; keeps old URLs identical) and give per-cycle highlighting a new param.
- **Legend/palette exhaustion.** Cycle count grows: first base with more than 26 Torque cycles is 512 (letter names "Torque-A..Z" run out); base 820 has 38; base 4096 has 178. A fixed 1-color Torque palette or A-Z scheme breaks silently.

**Why it happens:** the base-10 viewer has `ZONE_REGION: 'torque'|'warp'|'plex'` (one Torque). The guide's own examples only show 1-3 cycles.

**How to avoid:**
- Regions are cycles of the pair permutation (O(n), verified permutation for every even n <= 5000). Represent `torque: Cycle[]`, never `torque: Set`.
- Canonical order: sort cycles by (length desc, smallest zone id in cycle asc); rotate each cycle to start at its smallest pair; direction = flow direction. Document it; freeze it in fixtures for bases 16, 18, 28, 32, 82.
- Units in the API (`lengthInPairs`, `zoneCount`), and in UI strings.
- `region=torque` URL keeps meaning "all Torque zones"; add `region=torque-<i>`; hide the Warp control when no Warp exists; show "none" for Torque in bases 2, 4.
- Cycle colors from an index-driven hue ramp with a legend that collapses beyond ~12 cycles ("+N more"); cycle names as numbers (`T1..Tk`) not letters.
- Property tests: warp-iff-formula for all even n <= 5000; `sum(cycle lengths) + fixed pairs = n/2`; every pair in exactly one region.

**Warning signs:** a `Set<number>` named `torque`; base 28 golden output changes when the scan order changes; region panel showing a Warp button in base 12.

**Phase to address:** P1 (model + ordering), P4/P5 (UI/legend), P3 (layout must expose cycles).

---

### Pitfall 5: Demon classification gaps (cross-Torque demons, empty Torque, subtype policy) [HIGH]

**What goes wrong:** The guide's types (Chrono -> Cyclic/Syzygetic; Amphi -> Plex/Warp; Xeno -> Chaotic/Syzygetic) cover base 10 exactly, but with several Torque cycles there is a category the guide never names: **Chronodemons linking zones in different Torque cycles** (base 16: 32 of 120; base 28: 108 of 378; base 82: 1,404 of 3,321). Forcing them into "Cyclic" mislabels them (they cross circuits). The guide's suggestion to split Amphi/Cyclic by Torque index ("Plex-Torque-I-Amphidemons") multiplies categories (k cycles -> O(k) amphi and O(k^2) cross types).
Verified base-10 counts: cyclic 12, syzygetic chrono 3, plex-amphi 12, warp-amphi 12, chaotic xeno 4, syzygetic xeno 2 = 45. Base 12: cyclic 40, syz chrono 5, plex-amphi 20, syz xeno 1 (no Warp, no chaotic). Base 4: chaotic 4 + syzygetic xeno 2 (no Torque at all). Base 2: one syzygetic xeno.
Also: syzygetic demons = n/2 in total (one per pair, including the Plex and Warp pairs); "same-region non-syzygetic Xeno" cannot exist (Plex/Warp are single pairs), so any code path for it is dead code hiding a bug.
Existing `demons.ts` classifies with `kind = isSyz ? 'syzygy' : both in TC ? 'chrono' : neither ? 'xeno' : 'amphi'` and the layer filter `d.kind !== 'syzygy'` HIDES all syzygetic demons, including the 3 Syzygetic Chronodemons, silently.

**How to avoid:** Decide the taxonomy once in the engine: `kind` in {chrono, amphi, xeno} plus `sub` in {cyclic, syzygetic, crossTorque, plex, warp, chaotic}; `torqueA/torqueB` indices as optional detail, not new kinds. Emit closed-form counts (`Zt` torque zones, `w` = 1 if Warp: chrono = C(Zt,2); syz chrono = Zt/2; amphi-plex = 2Zt; amphi-warp = 2Zt*w; chaotic = 4w; syz xeno = 1+w) and assert them against enumeration for n <= 200 and against the frozen base-10 counts (12/3/12/12/4/2). Never rely on the guide's "47". Keep the current `'syzygy'` kind separate from type so the layer filter is explicit.

**Warning signs:** counts that do not sum to n(n-1)/2; an "other" bucket; base 4 or base 2 rendering an empty legend.

**Phase to address:** P1 (types), P6 (layer/legend).

---

### Pitfall 6: Hidden base-10 constants that TypeScript will not find [HIGH]

**What goes wrong:** CONCERNS.md focuses on `0..9` loops. The worst offenders are literals that compile at any base and fail at runtime:
- Partner-zone `9 - z` at NumogramClient lines 631, 656, 898, 925, 1166, 1172, 1381; `Projection.tsx` line 50 (`Math.min(from, 9 - from)`); `geometry.ts` `syzMidBiased` and `syzTrianglePoints`. Syzygy partner is `base - 1 - z`.
- Literal `[1, 2, 4, 5, 7, 8]` at NumogramClient 197, 560, 880 (duplicates of `TC`, which will not be updated when TC is generalized).
- Zone-range clamps `n <= 9` in three separate places: `shareParams.ts:64` (and `parts.length > 10` at :58), `app/numogram/page.tsx:20`, `NumogramClient.tsx:548`. Fix one and the URL silently drops zones in another.
- Object-literal initializers keyed `0..9` (`connectionVectors`, `connectedByZone`, NumogramClient 1130-1138): at n > 10 `connectedByZone[10]` is `undefined` -> `TypeError: Cannot read properties of undefined`. At n < 10 they silently hold ghost zones.
- `plexExpr` `cum < 10`; `demons.ts` `i + j === 9`; `Projection.tsx:117` gradient ids `[1..9]`; `ZONE_CLR/ZONE_REGION/PLANET_SYMBOL` tables indexed 0..9.
- Inconsistent constants already: `zoneRadius` is **21** in `gateRenderData` (line 1140) and **22** in the share-capture code (line 983).
- A misleading `Record<number, X>` type: missing keys type as `X`, not `X | undefined` (`noUncheckedIndexedAccess` is off), so `pos[z].x` for a missing zone is a runtime crash, not a compile error.

**How to avoid:**
- Make `n` (or a `Numogram` model object) a REQUIRED argument of every new helper so unmigrated call sites fail to compile; delete `TC`, `ZONE_REGION`, `ALL_DEMONS` as importable constants after the preset adapter exists.
- CI grep gate over `app/` for standalone `9`, `10`, `45`, `[1, 2, 4, 5, 7, 8]`, `<= 9` with an explicit allow-list file.
- Smoke test: render every base 2..40 (and a few larger) with all layers on and assert (a) zero console errors, (b) serialized SVG contains no `NaN`, `undefined`, `Infinity`, `-Infinity`.
- Enable `noUncheckedIndexedAccess` for the engine and new layout modules.

**Warning signs:** compile is green but base 12 white-screens; only base 10 and 8 "work"; a bug report that "selected zone 11 is ignored".

**Phase to address:** P4 (migration); grep gate and smoke test set up in P0.

---

### Pitfall 7: Refactoring a 1,943-line, zero-test component; keeping base-10 byte-identical [HIGH]

**What goes wrong:**
- No baseline. "Base-10 output identical" cannot be asserted without capturing the current output first. The gate/current routing code (`gateRenderData` ~1127-1320, `currentRenderData` ~1324-1476) is inside `useMemo`; extracting it changes it before it is ever captured.
- **Non-determinism in the baseline.** `planetary.ts:25` `getAnglesForDate(date = new Date())` (planetary layout drifts daily); line 27 `new Date(2000, 0, 1, 12, 0, 0)` is local-time (timezone dependent, Mercury moves ~4 deg/day so hours matter); `useTween` uses `performance.now()`/rAF (mid-tween frames); `GlitchText` uses `Math.random`; particle animation. A snapshot taken at a random moment will not reproduce.
- **State that outlives the base.** `selZones`, `hlZones`, undo/redo stacks (`MAX_HISTORY_ENTRIES = 80`) hold zone sets from the OLD base; switching 12 -> 8 and pressing undo resurrects zones 8..11 -> crash. `useTween` interpolates `0..9` and would interpolate between differently-sized position maps (NaN paths) when the base changes.
- **Published-library coupling.** `tsconfig.components.json` includes `app/lib/xenotation.ts`, and `package.json` runs `prepare` -> `build:components` on `npm install`. Changing `xenotationByZone()` (loop `0..9`) or importing the engine there without adding it to that config breaks `npm install` for everyone, and changes the `dist/` API.
- Two competing sources of truth during transition (hand data + engine data) that drift.

**How to avoid:**
- P0: capture a golden master of the UNTOUCHED viewer before editing anything: Playwright (headless) drives the URL-state matrix the app already supports (`layout` x `layers` x `region`/`tc` x `selected`, with `date=2000-01-01`, `orbits=0`, `particles=0`; `TZ=UTC`; wait for tween settle), stores normalized `svg.outerHTML` hashes plus a few PNG diffs. Commit hashes, not prose.
- Strangler pattern: introduce a `Numogram` model whose base-10 preset is initially just the hand-authored data behind the same interfaces (`GATE_LIST`, `CURRENTS`, `SYZYGIES`, `ALL_DEMONS`, `ZONE_REGION`), refactor consumers to read the model, verify the golden master, and only then swap in the engine (verified equal by the frozen golden JSON, Pitfall 3).
- Extract `gateRenderData`/`currentRenderData` into pure functions taking `(model, pos, layout)` under the golden master; reduce the component by extraction, not rewrite.
- Put `base` in the history snapshot (or clear history on base change); snap positions, do not tween, across a base change; sanitize `selZones` on base change.
- Update or explicitly exclude `xenotation.ts` in `tsconfig.components.json`; run `npm run build:components` in CI.

**Warning signs:** "it looks the same" reviews; snapshots differing by date; undo after base switch throws; `npm install` fails after touching xenotation.

**Phase to address:** P0 (baseline), P4.

---

### Pitfall 8: DOM/React scaling of the drawing, especially the demon layer [MEDIUM; thresholds LOW, must be measured]

**What goes wrong:** Current design: each demon is a `<g>` with two `<path>`s (visible stroke + 12-unit-wide transparent hit target) and three inline handlers, rebuilt from `ALL_DEMONS.filter(...)` on every render; hover changes state in the parent, re-rendering the whole `Projection`.
- **Count.** Demons n(n-1)/2: 4,950 at 100 (9,900 paths), 221,445 at 666, 499,500 at 1000. Common guidance puts SVG lag at "> a few thousand nodes" (secondary sources, LOW-MEDIUM); the spike must find the real number on target hardware.
- **Alpha saturation.** Unfocused demon curves use opacity 0.15. Compositing k overlaps gives 1-(0.85)^k: 5 -> 0.56, 15 -> 0.91, 50 -> 1.00. At n = 100 the center of the diagram becomes a solid blob, not a readable weave. Opacity must scale with edge density, or edges must be bundled/limited.
- **Hit-testing.** 4,950 overlapping 12-unit hit strokes: the DOM-topmost wins, so hover returns an arbitrary demon. Needs nearest-edge picking (spatial grid) on a canvas, or focus-driven display only.
- **Per-frame recompute.** `useTween` moves every zone every frame; `gateRenderData` (incl. the 72-angle x all-segments clearance search for each self-loop gate) is a `useMemo` on `pos`, so it recomputes per tween frame. Cheap at 10, not at 1000 (n=1000 has 5 gate self-loops and thousands of clearance segments; n=256 and n=666 have 9 loops each).
- **Identity churn.** `gateRenderData`, `currentRenderData`, `planetaryPos` are new objects per parent render, so `React.memo(Projection)` never bails out (CONCERNS.md).
- **Filters.** `url(#gl)` Gaussian blur on highlighted demons, and per-zone gradient `<defs>`, are GPU/CPU expensive at scale and in raster export.
- **Transitions.** CSS `transition: opacity` on thousands of elements causes style-recalc storms on hover.

**How to avoid:**
- Three tiers decided by measured node budget (P2): rich SVG; SVG for nodes/currents/gates + Canvas for demon curves with a single overlay for hover; headless (export only). Draw demons only for the selected/hovered zone(s) above a threshold.
- Static layers in `React.memo` components fed by stable, `useMemo`-ed props; hover state stored outside the big tree (ref or `useSyncExternalStore`), rendered as ONE overlay path.
- Event delegation on the SVG root using `data-*` attributes, not per-element closures.
- Disable tween above a node threshold (snap).
- Precompute path strings per (layout, base); key by numeric ids, not formatted strings.

**Warning signs:** hover latency grows with base; DevTools "Recalculate style" long tasks; React Profiler flame chart dominated by `Projection`.

**Phase to address:** P2 (measure), P4/P6 (implement).

---

### Pitfall 9: Labels, node size and layout capacity at large n; label scheme beyond base 36 [HIGH for the geometry, MEDIUM for label UX]

**What goes wrong:**
- **Ring capacity is 1/n.** On one ring of radius R in an 800-unit viewBox, non-overlapping node radius is R*sin(pi/n): with R=350, n=50 -> 22.0 (the existing fixed radius 21-22 is already at its limit), n=100 -> 11.0, n=200 -> 5.5, n=666 -> 1.65, n=1000 -> 1.1. Two-character labels need ~7 units, so a single ring stops being legible near n ~ 150; concentric rings or a phyllotaxis/sunflower packing scales as R*sqrt(0.6/n): 27 at n=100, 10.5 at n=666, 8.6 at n=1000.
- **Fixed pixel constants.** Radius 21/22, `loopPath` r=13/off=20, marker sizes, stroke widths (0.4-1 unit at ~0.725 screen scale = sub-pixel hairlines), the 580 px wide SVG. All need to be functions of (n, layout, zoom).
- **Label ambiguity beyond base 36.** In-base digits `0-9a-z` stop at 36. A decimal fallback is ambiguous for multi-digit values: gate labels T(k) are TWO in-base digits (n(n-1)/2 < n^2), so "45" could be digit 45 or digits 4,5. A glyph-per-digit scheme risks font tofu (missing glyphs), color-emoji variance, combining marks that break `text-anchor` centering, and different fallback fonts in raster export.
- **Gate/xenotation label cost.** `xenotation.ts` keeps a module-global `PRIME_CACHE` grown by trial division; xenotating a value v needs primes up to v (index of the largest prime factor, recursively). Fine for zones and mesh numbers <= ~500k, but T(k) values reach 5e9 at n=1e5 (hundreds of millions of primes: memory blow-up, freeze).
- **Hubs.** Gate in-degree reaches 6 at n=100 and 12 at n=1000; arrowheads pile up on hub zones.

**How to avoid:**
- Node size, font size, stroke, loop radius as pure functions of `(n, layout)`; labels behind an LOD switch (zoom level or node radius >= ~6 units), tooltips otherwise.
- Label scheme: `0-9a-z` up to 36; beyond 36 either decimal WITH a separator for multi-digit values (`12.34`) or a documented glyph set with per-glyph fallback tests; always keep decimal zone index available in tooltips and URLs.
- Cap xenotation to values <= ~1e6 (show "-" above); memoize by value; never precompute for all gates/mesh numbers at large n.
- Layout: ring only for small n; rings/spiral beyond; port spreading at hubs.

**Warning signs:** overlapping circles at n ~ 50; blurry black smudge for edges; a label like "1a" clipped; page freeze on opening the gates panel at n ~ 1e4.

**Phase to address:** P3 (layout), P5 (labels), P2 (thresholds).

---

### Pitfall 10: Degenerate bases 2, 4, 6 break generic layout and geometry code [HIGH]

**What goes wrong:**
- **Base 2:** zones {0,1}; one syzygy; Plex only; no inter-zone gates (gate 0->0, gate 1->1 are both self-loops); one demon.
- **Base 4:** Plex {0,3} and Warp {1,2} only; NO Torque; gates 0->0, 1->1, 2->3, 3->3 (the first inter-zone minor flow, per the guide); 6 demons (4 chaotic + 2 syzygetic xeno).
- **Base 6:** first Torque (2 pairs); no Warp.
- Layout or normalization code that computes a Torque centroid/`ctr`, a bounding-box, or a min/max over an empty set yields `Infinity`/`NaN` -> `viewBox="Infinity ..."`, zero-height viewBox (two nodes on one line), division by zero in fit-to-view (`fitSelectionToView`), and `curveAway(from, to, ctr.x, ctr.y)` with NaN centers. `Math.min()`/`Math.max()` of an empty list are `Infinity`/`-Infinity`.
- **Fixed-point loops.** Gate self-loops occur at k = 0, 1, n-1 in every even base (plus more: 5 at bases 16 and 100, 9 at 256 and 666), and Plex/Warp currents fold onto themselves. Loops drawn at a fixed 13/20-unit offset collide with neighbors when nodes are small or crowded; base 2 and 4 draw loops on nearly every node.

**How to avoid:** Treat 2, 4, 6, 8, 10, 12 as mandatory test bases in the engine, layout and render smoke tests. Layout functions take a `Numogram` and must return finite coordinates for every zone (assert `Number.isFinite`), with an explicit minimum bounding-box size. Region panel shows "none" instead of hiding. Loop geometry scales with node radius and is placed on the outward side of the layout center.

**Warning signs:** blank canvas at base 2/4; `NaN` in path `d` attributes; region UI with empty sections.

**Phase to address:** P1 (data), P3/P4 (layout/render), P0 (smoke test).

---

### Pitfall 11: Toolchain: TS `target: es5`, Vitest wiring, and `next build` type-checking tests [HIGH]

**What goes wrong:**
- Verified with `tsc` 5.x against the repo's compiler options: `for (const x of aSet)`, `[...aSet]`, `for (const [k,v] of aMap)`, generator iteration -> **TS2802**; `123n` -> **TS2737**. The existing code dodges this with `Array.from()` and `.forEach` (see `shareParams.ts`). An engine written in modern style passes Vitest (esbuild does not type-check) but fails `next build`.
- `tsconfig.json` `include: ["**/*.ts", ...]` means `next build` also type-checks `*.test.ts` and `vitest.config.ts`. The template in `TESTING.md` sets `globals: true`, which requires `types: ["vitest/globals"]` or `describe`/`it` are TS errors.
- `@/*` alias needs `vite-tsconfig-paths` (or `resolve.alias`) in Vitest.
- `yarn.lock` is the only lockfile but this machine uses npm 11; `npm install` will add `package-lock.json` and leave `yarn.lock` stale. `prepare` runs `tsc` on install and rewrites tracked `dist/`.
- Windows dev vs Linux CI: `core.autocrlf=true` and **no `.gitattributes`** (verified) so golden text fixtures check out with CRLF on Windows and fail byte comparisons; imports that differ only by case pass on Windows and fail on Linux/Vercel.

**How to avoid:**
- Set `"target": "es2017"` (or add `"downlevelIteration": true`) in `tsconfig.json` (safe: `noEmit` and SWC does the transpile; `tsconfig.components.json` already overrides to es2019). Do this in P0, before writing engine code, and add `tsc --noEmit` to the test script.
- Engine folder is framework-free (no React, no `'use client'` imports) and tested with `environment: 'node'`.
- Import `describe/it/expect` explicitly from `vitest`; no globals.
- Add `.gitattributes` (`* text=auto eol=lf`, `*.json text eol=lf`, `*.svg text eol=lf`) before creating fixtures; write fixtures with `\n`; normalize line endings in the comparer as a backstop.
- Pick one package manager, delete the other lockfile, document it.
- Set `TZ=UTC` in the test config (`process.env.TZ` in a global setup), and never use unguarded `new Date()` in tested code.

**Warning signs:** green Vitest, red `next build`; fixtures showing as modified after checkout; tests passing only on one OS.

**Phase to address:** P0.

---

### Pitfall 12: Static-export blockers and Windows build failures [HIGH: docs and direct checks]

**What goes wrong:**
- **Route handler.** Next 14 docs: only `GET` route handlers are supported and "Route Handlers that rely on Request" are unsupported. `app/api/share-image/route.ts` is `POST` + `req.json()` -> incompatible with `output: 'export'`; with `next dev` the docs say using such features "will result in an error". Merely deleting the `@vercel/blob` import is not enough.
- **`searchParams` pages.** `app/page.tsx` (redirect if a numogram query key is present) and `app/numogram/page.tsx` (`generateMetadata({ searchParams })`) read request-time data. A static build cannot know the query string; these will fail or receive empty params. The root-page redirect (`/?layout=...` -> `/numogram?...`) must become a client-side redirect; `generateMetadata` must become static.
- **OG previews cannot exist.** Per-share `img=` Open Graph images depend on server-rendered metadata per URL; crawlers do not run client JS. Decide to drop share-preview images in the static product (local PNG download + copyable URL instead).
- **`useSearchParams` needs Suspense.** The app currently reads `window.location.search` in an effect (safe). If the refactor switches to `useSearchParams` for `?base=`, `next build` fails on statically rendered pages unless the reader is inside a `<Suspense>`.
- **`npm run build` = `build:plugin-zip && next build`**, and `scripts/build-plugin-zip.mjs` calls `zip -r9 ...` via `execSync`. `zip` is absent on this Windows box (verified), so the build fails before Next starts. The script also rewrites the TRACKED file `app/gematria/plugin/zipInfo.ts` with a SHA-256 of a zip that embeds timestamps: every build dirties the tree.
- **Hosting details.** Sub-path hosting (e.g. GitHub Pages `/repo/`) needs `basePath`/`assetPrefix`; plain `<img src="/numogram-logo.svg">` and `metadata.icons: '/icon.svg'` are not auto-prefixed. GitHub Pages also needs a `.nojekyll` in `out/` or `_next/` 404s. `sitemap.ts`/`robots.ts`/`metadataBase` hardcode `https://num.qliphoth.systems`. `@vercel/analytics` will request `/_vercel/insights/script.js` on non-Vercel hosts (404 noise).
- Env-var-prefixed scripts (`STATIC_EXPORT=1 next build`) do not work in cmd.exe/PowerShell.

**How to avoid:**
- P0: split scripts: `build:static` = `next build` only (no plugin zip), and make the plugin zip step optional/cross-platform (Node `archiver`/`adm-zip`, or skip when `zip` is missing). Set `output: 'export'` in `next.config.js`.
- Remove `app/api/share-image`, `@vercel/blob`, `@vercel/analytics`, `scripts/share-image-self-check.mjs`, and `test:share-image`, or isolate them behind a separate deploy profile; replace "share" with "copy link" + "download PNG".
- Read the URL only in client effects; keep the root redirect client-side (`useEffect` + `router.replace`) or a static `<meta refresh>` fallback.
- Use a `withBasePath()` helper (or relative asset paths) if sub-path hosting is in scope; add `.nojekyll`.
- Use `cross-env` or a Node script for env vars; run `next build` in CI on Linux and locally on Windows.

**Warning signs:** `next build` errors mentioning route handlers/dynamic rendering; a working local build that 404s on `/_next/` in production; `zipInfo.ts` in every `git status`.

**Phase to address:** P0 (build unblock), P8 (deployability).

---

### Pitfall 13: URL / share-link compatibility [HIGH]

**What goes wrong:**
- **Adding `base=10` to canonical URLs.** `app/api/share-image/route.ts` derives the cache signature from `sortedParamKeys` and `sortedValues`. Emitting `base=10` for the default case changes every signature (orphaning cached share images) and changes visible URLs of old links.
- **Strict param parser.** `canonicalizeShareParams` throws `Unsupported share param "base"` for unknown keys and REQUIRES `layout`. The root page's `NUMOGRAM_QUERY_KEYS` whitelist omits `base`, so `/?base=16` never redirects to the viewer.
- **Zone range clamps in three places** (Pitfall 6): with `base=16&selected=12` two of the three parsers silently drop zone 12.
- **Layout names are base-10 only.** `layout=planetary|ladder|labyrinth|original` reference hand-placed tables; `?base=16&layout=planetary` must degrade gracefully (fall back to a procedural layout) rather than crash on `pos[10]`.
- **Selected zone encoding.** In-base labels (`a`) are ambiguous with decimal (`10`); URLs must carry decimal zone indices, labels are display-only.
- **Uncapped `base`.** With "no fixed cap", `?base=100000000` in a shared link would compute O(n) arrays of 1e8 (and a 5e15-demon layer) in the visitor's tab. There is no server to refuse it.
- **Non-strict parsing.** `Number("1e3")`, `"0x10"`, `" 16"`, `"16.0"`, `"010"` all coerce.

**How to avoid:**
- Omit `base` when it equals 10 (preserve byte-identical old URLs and signatures); serialize only non-default.
- Parse `base` with `/^[1-9]\d*$/` + `Number.isSafeInteger`, require even and >= 2; on failure fall back to 10 with a visible explanation (odd bases: "no valid numogram, a self-paired zone").
- One `parseZoneSet(value, base)` used by all three sites.
- Tiered guard: above the measured "interactive" threshold show a size estimate and require confirmation (or default to headless tier); run heavy work in a Worker or in chunks; cancelable.
- Validate `layout` against the base (hand layouts only if base = 10).
- Do not put naming-builder state in URLs (size); use JSON import/export.
- Test old URLs from the repo's history as fixtures (a list of 10-20 real base-10 share URLs -> same state).

**Warning signs:** old bookmarks land on defaults; a `base=10` string in generated URLs; browser tab unresponsive on a pasted URL.

**Phase to address:** P5 (URL/picker), P4 (parser consolidation).

---

### Pitfall 14: SVG/PNG/JSON export correctness [MEDIUM-HIGH]

**What goes wrong:**
- **Raster size limits.** Canvas max: Chrome 32,767 px per side and 268,435,456 px area (16,384 x 16,384); Firefox 32,767 and 472,907,776; Safari (desktop and iOS) about 16,777,216 px area (4096 x 4096) (secondary sources, MEDIUM). Exceeding produces blank output, `toDataURL()` returning `"data:,"`, `toBlob(null)`, or on Safari `getImageData` `InvalidStateError`. A 16,384 x 16,384 RGBA canvas is 1 GiB of pixel memory. The existing `captureShareDataUrl` never checks for `"data:,"`.
- **SVG without explicit pixel size.** Historically Firefox failed silently; since Firefox 120 (Mozilla bug 700533) it falls back to 300 x 150, which for a big diagram means a silently tiny PNG. The existing capture code sets `width`/`height`/`viewBox` on the clone (good); generalized export must keep doing that.
- **Styles/fonts.** SVG rasterized via `<img>` cannot load external CSS/fonts; class-based Tailwind styles and `var()` are lost, and web fonts do not load unless embedded as base64 `@font-face`. The current path clones the live DOM and serializes with `XMLSerializer`, so anything styled by CSS classes vanishes; "self-contained SVG" needs inlined attributes.
- **Hard-coded target.** The existing capture targets 1200 x 630 (social card), crops to selected zones, and uses zone radius 22 (vs 21 elsewhere).
- **XML validity and script injection.** User-supplied names concatenated into an SVG string need XML escaping (`& < > " '`) AND removal of characters illegal in XML 1.0 (control chars other than tab/LF/CR). A single stray `&` makes the whole file unloadable; an unescaped `<script>`/`onload` executes when the standalone `.svg` is opened in a browser.
- **Nondeterministic bytes.** Float coordinates from `Math.sin/cos` differ in the last bit across engines (Pitfall 15), so "same input, same SVG" is false between Node and browsers unless coordinates are rounded before serialization.
- **Export cost.** 10k+ elements with filters is a multi-MB string; rasterization via `Image` decode can take seconds and Safari is the tightest.

**How to avoid:**
- Export SVG from the model/layout via a string builder (not from the live DOM) with all styling as attributes and an XML-escape utility; a "no scripts, no foreignObject, no external refs" test.
- PNG: compute target size = min(requested, browser-probed limit); check the result for `"data:,"`/null and surface an error; downscale/tile; test in Chrome, Firefox and Safari.
- Round coordinates to 2-3 decimals; give the SVG a stable id namespace.
- JSON export = numeric engine data (no lore prose) plus `schemaVersion`, `base`, `seed`.
- Drop filters in the export tier for large n.

**Warning signs:** 300x150 PNG in Firefox; export works on your machine at n=30 and produces a white image at n=300; downloaded SVG opens blank with "XML Parsing Error".

**Phase to address:** P8; measurement in P2.

---

### Pitfall 15: Determinism of layouts, PRNGs and sort orders [MEDIUM-HIGH]

**What goes wrong:**
- ECMAScript specifies `+ - * /` exactly but leaves `Math.sin/cos/exp/log/pow` implementation-approximated; V8, SpiderMonkey, JavaScriptCore differ in the last bit, and any layout step that makes a DISCRETE decision on those values (the existing `selfChannelArc` scores 72 angles with `cos/sin` and takes an argmax; force/relaxation loops; tie-breaks) can pick different branches per engine. A documented real-world case: seed `sunset` produced 643 roads in Node and 638 in the browser from one differing `Math.cos` bit.
- `Math.random()` is unseedable; any "auto sound generator" using it is non-reproducible.
- `localeCompare`/default sort orders depend on ICU data (already used in `shareParams.ts` for key sorting; fine for ASCII keys, wrong for user-supplied names).
- Iteration-order reliance on `Map`/`Set` insertion order (Pitfall 4 cycle ordering).

**How to avoid:**
- Prefer integer/rational layout math where possible (index-derived positions), and round to fixed decimals BEFORE any comparison or serialization; break ties by index, never by float equality.
- Implement an explicit PRNG (mulberry32/sfc32, ~10 lines), seed stored in exported JSON; never `Math.random` in engine/layout/naming.
- Compare strings with code-unit comparison (`a < b`) in canonical outputs.
- Snapshot tests compare rounded values; run the layout test on Node 20 and 22 in CI.

**Warning signs:** the same seed yields different diagrams on two machines; golden layout snapshots that fail only in CI.

**Phase to address:** P3 (layout), P7 (naming), P1 (canonical ordering).

---

### Pitfall 16: Naming builder: collisions, non-injective euphony, Unicode, import safety [MEDIUM]

**What goes wrong:**
- **Concatenation is not injective.** Two zone sounds like `t`, `tk`, `tt`, `ktt` make `t+ktt` and `tk+tt` identical strings. Euphony editing (vowel insertion, collapsing repeats) is many-to-one on top of that (the guide's own example: "Tnmnm" -> "Ummnu"). With T(n-1) demons and short syllable banks, collisions are guaranteed at moderate n. Birthday-style: a bank of ~100 CV syllables cannot label 100 zones and 4,950 pairs uniquely without multi-syllable sounds.
- **Order.** Canonical names are high-zone-first (Ummnu = 9 + 8; Kuttadid = 5 + 2); the guide's Part 3 example is low-first. Pick high-first (net-span order) and document.
- **Canonical names are overrides, not derivations.** The guide says names are "partly" derived and "primarily random". A test that the auto-namer reproduces `DEMON_NAMES` (Lurgo, Katak, ...) is unsatisfiable; treat the 45 base-10 names and the zone phonemes (`eiaoung`, `gl`, `dt`, `zx`, `skr`, `ktt`, `tch`, `pb`, `mnm`, `tn`) as a preset table.
- **Unicode.** `.length`/`.slice` split surrogate pairs and grapheme clusters (broken glyph in SVG text); different normalization forms (NFC/NFD) make "same" names compare unequal and defeat collision detection; case-insensitive uniqueness needs a defined folding; combining marks break label centering; XML-illegal characters (Pitfall 14).
- **Scale.** Materializing 499,500 names eagerly (n=1000) costs tens of MB and export files of ~20 MB.
- **Import safety.** Importing user JSON into a `Record<string, string>` keyed by `"a:b"` invites prototype-pollution-style bugs (`__proto__`, `constructor`); no schema/version; a JSON made for base 12 loaded into base 16.

**How to avoid:**
- Names are LAZY: `nameOf(a, b)` computed on demand from `(sounds[a], sounds[b], seed)`; store only user overrides (sparse map).
- Sound bank must satisfy: prefix-free or separator-aware, size >= n; a deterministic disambiguator (append a stable syllable derived from the mesh number) when the collision check finds duplicates; report collisions in the UI instead of silently renaming.
- Normalize to NFC on input; compare on a folded key; count/truncate with `Intl.Segmenter` (grapheme), never `.slice`.
- Import: parse with a schema validator, use `Map` or null-prototype objects, require `{schemaVersion, base, seed}`, reject size > limit and mismatched base with a clear message.
- Do not put names into URLs.

**Warning signs:** two demons with the same label in a hover list; a name showing "?" glyph; JSON round-trip changes names.

**Phase to address:** P7.

---

### Pitfall 17: Licensing and provenance [MEDIUM]

**What goes wrong:**
- `reference/` is correctly gitignored (`.gitignore` line 23; verified `git check-ignore` matches and `git ls-files reference` is empty). The risks are indirect:
  - **Fresh-clone dependency.** Anything (tests, scripts, docs) that reads `reference/...` fails in CI and for collaborators, and pressures someone to `git add -f` it.
  - **Inherited prose.** `app/data/zones.ts` (~7 KB), `gates.ts` and `currents.ts` contain long descriptive prose (zone lore, gate `detail`, "Lemurian/Centauri" notes) that appears to paraphrase or quote CCRU material. Provenance is unverified (LOW confidence). The base-10 preset carries it; new fixtures, JSON export and SVG metadata must not.
  - **No LICENSE file** in the repo root and no license field in `package.json`; upstream is `lumpenspace/ccru`, `origin` still points there. Publishing a derivative without upstream permission/attribution is a project-level risk to resolve before any push or deploy.
  - **Scraped sources** (`reference/web/*`: 4plebs archive, gramculator, doomcrypt) may be reproduced in docs by accident (quoting tables).
  - `.planning/` docs are tracked; long quotations from the book/guide/thread must not enter them.
- Demon names (Lurgo, Katak, ...), zone phonemes and the 45-name table are short lore facts already in the repo; keep as preset data with attribution to the Ccru Writings, not as a "derived" dataset.

**How to avoid:** CI check `git ls-files reference | wc -l` = 0 and reject files over ~5 MB or `*.pdf`/`*.mov` additions; tests never read `reference/`; fixtures numeric only; cite `file + page/section`, never paste passages; add a LICENSE/NOTICE decision (and attribution to upstream) to the roadmap; repoint `origin` before first push.

**Warning signs:** test paths starting with `reference/`; a diff containing paragraph-length quotations; `git add -f`.

**Phase to address:** P0 (guards), P8 (release checklist).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `app/data/*.ts` as both preset and golden fixture | No new files | Tautological tests once data is derived (Pitfall 3) | Never; freeze numeric `base10.golden.json` first |
| Materialize `Demon[]` for all pairs | Simple code, matches `ALL_DEMONS` | 36 MB at n=1000, ~3.6 GB extrapolated at n=10,000 (50M objects); property tests time out | Only n <= ~200; behind a lazy interface |
| Generalize by bumping loop bounds `9 -> n-1` only | Fast "it renders" | Leaves `9 - z`, `[1,2,4,5,7,8]`, `n <= 9` literals (Pitfall 6) | Never as the only step; pair with grep gate + smoke test |
| Keep `Record<number, X>` maps | Existing consumers compile | Silent `undefined` crashes; `noUncheckedIndexedAccess` off | Only at the adapter boundary; engine returns arrays/typed arrays |
| Keep one hover handler per SVG element | No change to Projection | Re-render storm and arbitrary picking (Pitfall 8) | n <= ~30 only |
| Screenshot/`toMatchSnapshot` goldens | Fast to write | `-u` habit, CRLF and float drift (Pitfalls 11, 15) | Only for rounded SVG hashes, never for math |
| Leave `@vercel/blob` route in place "for later" | No decisions | Blocks `output: 'export'` | Never if static export is a requirement |
| Force everything into 'Cyclic Chronodemon' | Matches guide wording | Mislabels cross-circuit demons in 110 of 150 bases <= 300 | Never; add `crossTorque` sub-type |
| Materialize all names at build/load | Simple JSON | Memory/time; import/export size | Only for n <= ~100 |
| Ignore `yarn.lock` vs npm | No tooling decision | Stale lockfile, inconsistent CI installs | Never; choose one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Next 14 `output: 'export'` | Keep POST route, `searchParams` pages, `generateMetadata` on query | Remove/replace; client-side URL parsing; static metadata (Pitfall 12) |
| `@vercel/analytics` | Leave `<Analytics />` in layout | Remove or gate by env var; else 404 noise off-Vercel |
| Vitest + Next | Forget `@/` alias, use `globals: true` | `vite-tsconfig-paths`; explicit imports; keep tests out of `next build` type errors |
| TypeScript `es5` target | `for..of` on Set/Map, spread, BigInt literals | Bump target to es2017 or `downlevelIteration`; type-check in CI |
| `zip` in `build:plugin-zip` | Assume POSIX `zip` | Node-based zipper or skip step for the static build |
| GitHub Pages hosting | Forget `basePath` and `.nojekyll` | `basePath`/`assetPrefix` from env; add `.nojekyll`; prefix plain `<img>` |
| Canvas PNG export | Assume `toDataURL` succeeds | Probe limits; detect `"data:,"`/null; downscale |
| `Intl`/locale sort | `localeCompare` for canonical order | Code-unit compare for anything serialized |
| Playwright golden master | Snapshot at random tween/date | Pin `date`, `TZ=UTC`, `orbits=0`, `particles=0`, wait for settle |
| Component-library build (`tsconfig.components.json`) | Edit `xenotation.ts` freely | Keep signatures or update include list; run `build:components` in CI |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| All demons as SVG `<g>`+2 paths | Frozen tab, hover lag, huge DOM | Canvas/LOD/focus-only; event delegation | Low thousands of nodes (spike must measure); n ~ 100 already gives 9,900 paths |
| `Demon[]` of objects | Memory spike | Lazy index math, typed arrays | 36 MB at n=1000; GB range at n=10^4 |
| Per-frame tween of all zones + `gateRenderData` recompute | Layout transition stutters | Snap above threshold; memoize path strings | Grows with n and self-loop count; n ~ 1000 |
| Translucent overlapping edges (opacity 0.15) | Solid blob center | Opacity ~ 1/sqrt(edge density); bundle; show only focus | k >= ~15 overlaps (n ~ 20-30 already dense) |
| Single-ring layout | Overlapping nodes, unreadable labels | Rings/spiral; LOD labels | n ~ 50 (r 22), n ~ 150 (2-char labels) |
| Xenotation of large values | Freeze / GB of primes | Cap at ~1e6; lazy | Gate T values at n >= ~10^4 |
| O(n^2) property tests | CI timeouts | Closed-form checks + sampling above n ~ 200 | n >= ~1000 |
| Filters/gradients per zone | GPU/CPU cost, slow raster | Drop in large tiers/export | Hundreds of zones |
| Un-memoized gate/current objects | `React.memo` ineffective | Stable identities via `useMemo`/stores | Any n; visible from ~100 |
| PNG at native scale | White image, OOM | Clamp to probed limits | > 4096^2 on Safari; > 16384^2 elsewhere |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exported SVG built by string concat with user names | Script execution when file opened; corrupted XML | XML-escape + strip illegal chars; no scripts/foreignObject; test |
| `?base=<huge>` in shared URL | Tab DoS (no server to refuse) | Strict parse; size estimate + confirm; Worker/chunking |
| JSON import into plain objects | Prototype pollution, wrong-base data | Schema validation, `Map`, size and version checks |
| Keeping `/api/share-image` (PNG data-URL regex, no magic-byte check, no origin check, per CONCERNS.md) | Abuse of upload endpoint | Remove for static build (recommended) |
| `git add -f reference/` or committing PDFs/scrapes | Copyright exposure | CI guard on `git ls-files`; size/type gate |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Odd base silently rounded | Wrong numogram | Restrict to even; explain "self-paired zone, rejected by the CCRU" |
| Showing Warp control in bases without one | Dead control | Hide/disable with reason (n = 3o+1, o odd) |
| Decimal labels in a base-12 diagram | User cannot check by hand (guide: "all arithmetic in the base") | In-base labels + decimal in tooltip |
| Cycle lengths reported ambiguously | "3" read as 3 zones | Label units (pairs and zones) |
| No feedback when base is large | Freeze | Size estimate, tier auto-selection, cancel |
| Hover on 5k overlapping edges | Random demon shown | Focus-driven list, nearest-edge picking |
| Unreadable labels at large n | Diagram is decorative | LOD labels, zoom, minimap |
| Naming collisions hidden | Two demons same name | Collision report and deterministic disambiguation |

## "Looks Done But Isn't" Checklist

- [ ] **Engine:** passes base 10 but not verified for bases 2, 4, 6, 8, 12, 16, 28, 80, 82 (`[4,2]`, `[9,3]`, `[39]`, `[27,9,3]`) and for the base-2 T(0)/`% 1` edge.
- [ ] **Digital root:** verified against an independent `toString(radix)` oracle for bases <= 36.
- [ ] **Regions:** cycles have a documented deterministic order; tie cases (bases 18, 32) frozen; Warp derived from fixed pairs.
- [ ] **Demons:** type counts sum to n(n-1)/2; base-10 = 12/3/12/12/4/2; cross-Torque category present; Numodemons = n/2 - 1.
- [ ] **Golden fixtures:** numeric-only, frozen before refactor, contain named 15/16 and 3/8 regressions, do not read `reference/`.
- [ ] **Base-10 byte-identity:** golden master (pinned date/TZ/orbits/particles) matches before AND after each migration step.
- [ ] **Hidden constants:** grep gate clean for `9 -`, `[1, 2, 4, 5, 7, 8]`, `<= 9`; smoke test 2..40 shows no `NaN`/`undefined`/`Infinity`.
- [ ] **Base change:** undo/redo, selection, tween state all sanitized when base changes.
- [ ] **URL:** old base-10 URLs unchanged; `base` omitted when 10; `selected` parsed by one function; odd/invalid `base` handled.
- [ ] **Static export:** `next build` with `output: 'export'` succeeds on Windows and Linux; no route handlers; `/` redirect works client-side; no `/_vercel` requests; `zipInfo.ts` not dirtied.
- [ ] **TS:** `tsc --noEmit` clean with engine code (no TS2802/2737); Vitest imports explicit.
- [ ] **Export:** PNG tested at 16k+ px request in Chrome, Firefox, Safari; SVG loads standalone; names with `& < >` and emoji survive.
- [ ] **Line endings:** `.gitattributes` present; fixtures LF in checkout on Windows.
- [ ] **Labels:** scheme defined and tested for n = 37, 64, 100, 666; multi-digit gate labels unambiguous.
- [ ] **Naming:** collision report at n = 100 and 666; JSON round-trip; import rejects wrong base.
- [ ] **Legal:** `git ls-files reference` empty; LICENSE/attribution decision recorded; `origin` repointed.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong gate/digit-sum (1, 2) | LOW | Fix primitive; regenerate derived data; golden tests localize |
| Poisoned fixtures (3) | MEDIUM | Recompute from engine + book; diff against frozen JSON; review by hand |
| One-Torque assumption baked into UI (4, 5) | HIGH | Change data model (`torque: Cycle[]`), update legend/URL semantics; hard to retrofit late |
| Hidden constants (6) | MEDIUM | Grep, smoke matrix; convert to `base`-parameterized helpers |
| Refactor without baseline (7) | HIGH | Check out pre-refactor commit, capture golden master retroactively, bisect differences |
| SVG DOM too heavy (8) | MEDIUM-HIGH | Introduce canvas/LOD tier for demons behind the same model interface |
| Non-deterministic layout (15) | MEDIUM | Round coordinates, index-based tie-breaks, seeded PRNG; re-freeze snapshots |
| Static export blocked (12) | MEDIUM | Remove route and searchParams pages; client-side redirect |
| Copyrighted material committed (17) | HIGH | History rewrite (out of scope per PROJECT.md for `demo.mov`; would be needed for text); prevention far cheaper |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Digit sum / digital root | P1 | Oracle vs `toString(radix)` for even n <= 36; base 2/4/6/8/12 literals |
| 2 Base vs top-zone; mesh; Numodemons | P1 | Closed-form counts; mesh round-trip; base 2 has 1 demon, 0 Numodemons |
| 3 Fixture provenance / tautology | P0, P1 | Frozen `base10.golden.json`; named 15/16, 3/8 tests; provenance note |
| 4 Multi-Torque regions | P1, P3, P5 | Frozen cycles for 16, 18, 28, 32, 82; warp-iff for n <= 5000 |
| 5 Demon taxonomy | P1, P6 | Counts sum to n(n-1)/2; 12/3/12/12/4/2 at base 10 |
| 6 Hidden constants | P0 (gate), P4 | Grep gate; smoke 2..40 no NaN/undefined; console clean |
| 7 Refactor safety | P0, P4 | Golden master before/after; history/tween base-change tests |
| 8 DOM/React scaling | P2, P4, P6 | Frame-time/memory per tier vs n table in spike report |
| 9 Labels, layout capacity, xenotation cost | P2, P3, P5 | Visual test n = 50, 100, 666; label scheme tests; xenotation cap |
| 10 Degenerate bases | P0, P1, P3 | Base 2/4/6 in every test layer; `Number.isFinite` positions |
| 11 Toolchain (es5, Vitest, CRLF, lockfile) | P0 | `next build` + `vitest run` green on Windows and Linux CI |
| 12 Static export + Windows build | P0, P8 | `output: 'export'` build passes; `out/` served from a plain static server |
| 13 URL compatibility | P4, P5 | Old-URL corpus test; strict `base` parser tests; huge-`base` guard test |
| 14 Export correctness | P2, P8 | Cross-browser PNG matrix; XML validity + escape tests |
| 15 Determinism | P1, P3, P7 | Same seed -> byte-identical output on Node 20/22 and browser |
| 16 Naming builder | P7 | Collision report at n = 100/666; Unicode/grapheme tests; import validation |
| 17 Licensing/provenance | P0, P8 | CI `git ls-files reference` = 0; LICENSE/attribution decision recorded |

**Research flags for later phases:**
- **P2 Spike / P8 Export:** needs real measurement and a cross-browser matrix (Safari especially); this file's thresholds are not measured.
- **P3 Layout:** needs its own research (multi-ring/spiral options that still expose syzygy pairing and Torque cycles; edge bundling for gates at n >= 100).
- **P5 Labels beyond base 36:** design decision plus font/glyph coverage testing.
- **P7 Naming:** euphony rules and phoneme-bank sizing need prototyping; low external prior art.
- **P1 Engine, P4 Migration, P0 Foundations:** standard patterns; the value is in the guards above, not in further research.

## Sources

**Verified by direct computation in this session (prototype in the session scratchpad, not committed; formulas are in `PROJECT.md`/`reference/INDEX.md` and reproduce in ~40 lines of JS):** digit-sum formula vs iterated in-base sum (0 mismatches, even n <= 200); permutation property and warp-iff-formula (0 exceptions, even n <= 5000); cycle statistics for even bases <= 300 (2 none, 38 single, 110 multiple, 71 with tied lengths); torque lists for 6, 8, 10, 12, 14, 16, 22, 28, 80, 82, 244, 730, 2188; demon type counts for bases 2, 4, 6, 10, 12, 16, 28, 82; base-2 T(0) edge case; ring/packing capacity; memory of 499,500 demon objects (36 MB); alpha compositing table.

**Repo files read (HIGH):** `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`, `reference/INDEX.md`, `reference/genius-guide-diy-numogram-demonology.txt` (not quoted; cited by section), `app/data/{gates,demons,currents,syzygies,zones}.ts`, `app/lib/{numogram,geometry,shareParams,xenotation}.ts`, `app/NumogramClient.tsx` (lines ~480-610, 940-1030, 1120-1240), `app/components/projection/Projection.tsx` (lines 30-160), `app/page.tsx`, `app/numogram/page.tsx`, `app/layout.tsx`, `app/api/share-image/route.ts`, `scripts/build-plugin-zip.mjs`, `package.json`, `tsconfig.json`, `tsconfig.components.json`, `next.config.js`, `.gitignore`; git config (`core.autocrlf=true`), absence of `.gitattributes`/LICENSE, `which zip` (not found).

**External (verified):**
- Next.js 14 Static Exports (official): https://nextjs.org/docs/14/app/building-your-application/deploying/static-exports (HIGH)
- Next.js "Missing Suspense boundary with useSearchParams": https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout (HIGH)
- `searchParams` forces dynamic rendering (community write-ups, consistent with docs): https://dev.to/anas_sheikh_2/using-searchparams-in-a-nextjs-page-silently-opts-it-out-of-static-rendering-too-8am (MEDIUM)
- Mozilla bug 700533, `drawImage()` of SVG without width/height, fixed in Firefox 120 with 300x150 fallback: https://bugzilla.mozilla.org/show_bug.cgi?id=700533 (HIGH)
- Safari 16,777,216 px canvas limit and behavior: https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ (MEDIUM)
- Chrome/Firefox canvas limits (32,767 px; 268,435,456 / 472,907,776 px area): https://github.com/niklasvh/html2canvas/issues/3169 and https://github.com/jhildenbiddle/canvas-size (MEDIUM; not all figures re-verified)
- SVG-as-image cannot load external fonts; embed as data URI: https://dzx.fr/blog/svg-font-embedding/ (MEDIUM)
- `Math.*` implementation-approximated, cross-engine last-bit differences and a real divergence case: https://github.com/jjgroenendijk/sunset-driver/issues/471 (MEDIUM); https://macwright.com/2020/02/14/math-keeps-changing (MEDIUM)
- SVG vs Canvas node-count guidance: https://apexcharts.com/blog/svg-vs-canvas-charts/ , https://felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster (LOW-MEDIUM; use only as a prior for the spike)
- Vitest + Next path alias: https://nextjs.org/docs/app/guides/testing/vitest (HIGH); `vite-tsconfig-paths`: https://www.npmjs.com/package/vite-tsconfig-paths (MEDIUM)
- fast-check reproducibility/seeds/numRuns: https://fast-check.dev/docs/introduction/what-is-property-based-testing/ (MEDIUM)
- Grapheme-safe truncation with `Intl.Segmenter`: https://dev.to/parsajiravand/youre-truncating-bios-with-slice-intlsegmenter-knows-where-the-emoji-actually-end-36eo (MEDIUM)
- GitHub Pages `basePath`/`assetPrefix` and plain-asset paths: https://wallis.dev/blog/next-js-basepath-and-assetprefix (MEDIUM); `.nojekyll` requirement is from general knowledge, not re-verified this session (LOW)

**Not verified this session (flagged):** whether Next 14.2 static export hard-errors or silently passes empty `searchParams` for the two affected pages (test it in P0); exact Safari behavior for very large SVG `<img>` decode; provenance of prose in `app/data/zones.ts`/`gates.ts`.

---
*Pitfalls research for: arbitrary-base numogram generator (brownfield Next 14 base-10 viewer)*
*Researched: 2026-09-25*

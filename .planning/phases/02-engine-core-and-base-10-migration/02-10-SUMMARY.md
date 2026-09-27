---
phase: 02-engine-core-and-base-10-migration
plan: 10
subsystem: migration
tags: [base10-adapter, strangler-swap, gates, own-base-names, formatGateName, frozen-oracle, seam]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: 02-04 createNumogram(10) with gate(zone); 02-01 the own-base numeral formatter (formatGateName, D-04, D-05); 02-07 app/presets/base10/lore.ts (GATE_LORE by origin zone) and the app/data seams; 02-08 and 02-09 BASE10, the adapter pattern and tests/presets/base10-adapter.test.ts; 02-03 the frozen behaviour baseline and npm run test:swap
provides:
  - app/presets/base10/gates.ts, GATE_LIST derived from the engine (all n gates, Gt-00 included, names written by the engine's own-base formatter) joined with GATE_LORE by origin zone
  - app/data/gates.ts reduced to a two-line seam, no hand-authored gate structure left (D-08)
  - the gates block of tests/presets/base10-adapter.test.ts (frozen oracle, named regressions, engine derivation against an independent definition, formatter names, key order, lore join, seam identity, no gate lore text in adapter files)
affects: [02-11, 02-12, 02-13, phase-04-components-engine-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same strangler sequence as 02-08 and 02-09: adapter + seam flip with the hand data renamed and kept, full gate green on the committed swap, hand data deleted in its own commit, full gate again"
    - "The own-base name rule (D-04) is exercised from day one: the viewer's Gt-NN names are produced by the engine formatter (formatGateName), not copied strings"
    - "The independent reference (tests/bruteforce refDigitSumRoot, iterated in-base digit sums) is used by an app-side test to check the adapter's `to` against a definition rather than against the engine formula"

key-files:
  created:
    - app/presets/base10/gates.ts
  modified:
    - app/data/gates.ts
    - tests/presets/base10-adapter.test.ts

key-decisions:
  - "The seam keeps the export name GATE_LIST and re-exports the adapter array itself (identity checked with toBe): NumogramClient.tsx (gate routing keys on g.name and g.from), Projection.tsx, GatesPanel.tsx, InfoDisplay.tsx and tests/oracle/deriveBase10.ts are untouched"
  - "name = formatGateName(gate.cumulation, BASE10.base) (BASE10.base is 10, asserted by the engine-instance test); from, to and cum are BASE10.gate(zone).from, .to and .cumulation, so nothing numeric is copied"
  - "All n gates are emitted in origin-zone order 0..9, Gt-00 included (policy locked in Phase 2: the engine emits every gate, the viewer keeps drawing what it draws today); the adapter does not filter, the viewer's own g.from !== g.to filters stay in Projection.tsx"
  - "The page-weight baseline was NOT touched: /numogram/ is +16,550 bytes raw (+2.9%) and +4,804 gzip (+2.8%) over the stored baseline, inside max(1 KiB, 5%); this swap alone REDUCED the bundle by 416 raw and 122 gzip bytes (a ten-iteration loop is smaller than ten literal entries)"

patterns-established:
  - "An adapter test may import the independent reference (tests/bruteforce) to check derived values against the definition; the engine stays out of the reference and the reference out of the engine"

requirements-completed: [MIG-01]

# Metrics
duration: 25min
completed: 2026-09-26
---

# Phase 2 Plan 10: Swap 3, Gates Summary

**The viewer's ten gates now come from `createNumogram(10)` (gate of zone k: cumulation T(k), flowing to the in-base digital root of T(k), T(0) to 0; all n gates including Gt-00) with every name written by the engine's own-base formatter `formatGateName` (Gt-00 ... Gt-45) and `desc`/`detail` joined by origin zone from `GATE_LORE`, through `app/presets/base10/gates.ts`; `app/data/gates.ts` is a two-line seam and the hand-authored name/from/to/cum structure is deleted. The swapped data is deep-equal to the frozen f7d6689 file (71 nodes, 60 primitive fields, 0 differences, key order name, from, to, cum, desc, detail, the only escape sequence of the old file, the em dash in the Gt-36 detail, equal by code point), and the full gate (60 DOM goldens, 5 behaviour baselines, numeric oracle, static-export specs) stayed green and unchanged.**

## Performance

- **Duration:** about 25 min (started about 01:17Z, finished about 01:42Z); about 20 of that is the five gate runs below
- **Tasks:** 2 (2 task commits), plus this metadata commit
- **Files:** 1 created, 2 modified (exactly the plan's `files_modified` list)

## What was built

### The adapter, what it reads, and its exported shape

```ts
// app/presets/base10/gates.ts
export const GATE_LIST: GateData[]   // built once at module load, 10 entries, keys name, from, to, cum, desc, detail
```

- **From the engine (`BASE10 = createNumogram(10)`):** for every origin zone `zone = 0 .. BASE10.zoneCount - 1`, `BASE10.gate(zone)` gives `{ from, to, cumulation }`. `from` = zone, `cum` = `cumulation` = T(zone) and `to` = the in-base digital root of T(zone) with T(0) mapped to 0 (the engine's `T === 0 ? 0 : ((T - 1) % (n - 1)) + 1`).
- **name:** `formatGateName(gate.cumulation, BASE10.base)` from the engine barrel (`../../../engine/index`, the plan's key link): `'Gt-'` plus the cumulation as two in-base digits (own-base rule, D-04). At base 10 that is `Gt-00, Gt-01, Gt-03, Gt-06, Gt-10, Gt-15, Gt-21, Gt-28, Gt-36, Gt-45`, identical to the old literal names. `gates.ts` is the third app file importing the engine (after `numogram.ts` and `currents.ts`).
- **From lore:** `desc` and `detail` come from `GATE_LORE[zone]` by origin zone (a missing entry throws `base-10 lore missing for gate <zone>`).
- Plain (unfrozen) objects in a plain array with the literal key order, like the hand data; the file holds no lore text, no escape sequence and no non-ASCII byte.
- **Gate 0 to 0 policy (locked):** the adapter keeps all ten entries including `Gt-00`; nothing is filtered here. The renderer's own `g.from !== g.to` filters in `Projection.tsx` stay as they are.
- `app/data/gates.ts` after Task 2 is exactly:

```ts
// Base-10 data seam (MIG-01): gates derived by the engine and joined with lore in app/presets/base10/gates.ts.
export { GATE_LIST } from '../presets/base10/gates'
```

### What was deleted (Task 2, D-08)

The ten literal entries (`{ name: 'Gt-00', from: 0, to: 0, cum: 0, desc: GATE_LORE[0].desc, ... }` .. `Gt-45`), the `LEGACY_GATE_LIST` rename that carried them between the two commits, the `GATE_LORE` and `GateData` imports of the seam, and the legacy comparison of the adapter test. No `tests/legacy` copy exists (D-08): the frozen numeric oracle (`tests/oracle/deriveBase10.ts` reads `GATE_LIST` through the seam and compares name, from, to, cum to `base10.golden.json`), the 60 DOM goldens (layer-gates and region states) and the behaviour baseline (Gates panel rows, lore sweep) guard the values.

### Tests (tests/presets/base10-adapter.test.ts, `describe('gates')`, written first)

RED was confirmed: before the adapter existed the file failed to load (`Cannot find module '../../app/presets/base10/gates'`, no tests ran). Ten tests then went green:

1. the ten gates equal the frozen oracle (name, from, to, cum) in the same order;
2. all n gates in origin-zone order, `Gt-00` first, the exact ten names, `from` = index;
3. `Gt-15 is 5 -> 6 in the viewer data` and 4. `Gt-03 is 2 -> 3 in the viewer data` (named regressions, T-02-40);
5. derived from the engine and from a definition: `from`/`to`/`cum` equal `BASE10.gate(k)`, `cum` equals a running sum 0, 1, 3, ..., 45 computed in the test, `to` equals `refDigitSumRoot(cum, 10)` (the independent reference: iterated in-base digit sums), `name` equals `formatGateName(cumulation, 10)`;
6. the names are `Gt-` plus two digits equal to the cumulation padded;
7. key order `name, from, to, cum, desc, detail` for every entry;
8. `desc` and `detail` are the lore of the gate's own origin zone;
9. equality with the hand list (`LEGACY_GATE_LIST`, removed in Task 2);
10. `SEAM_GATES` is the very adapter array (`toBe`).

The adapter-file lore scan was extended: `gates.ts` must exist in `app/presets/base10/`, and none of the 20 gate lore strings (10 titles and 10 details) may appear in any adapter file other than `lore.ts`.

Mutation check (throwaway, tree restored byte-identical afterwards, `cmp` verified): four mutants of the adapter were all killed by the new tests (name formatted in base 12: 6 failures; lore joined by destination zone: 2; keys reordered: 1; Gt-00 omitted: 5).

## Strict old-versus-new proof (throwaway, not committed)

`git show f7d6689:app/data/gates.ts` was written byte-exact into the scratchpad (checked with `cmp` against the blob; 2,383 bytes, 0 CR, 1 escape sequence for U+2014) and compared with `tsx` against the real `app/data/gates.ts`: on the uncommitted swap state (the seam then also exports `LEGACY_GATE_LIST`, the only reported "extra" export) and again on the final tree at 92dc1c6 (exit 0). The script walks both values with `Object.is` on primitives and requires equal key sets and key order, equal array lengths, equal prototypes and equal `typeof`; it also compares `name`, `desc` and `detail` as runtime strings and by code point and diffs the export names of the two modules.

| what | result |
|------|--------|
| entries | old 10, new 10 |
| nodes compared (1 array + 10 objects + 60 primitive fields) | 71 |
| primitive fields in the old file (10 x name, from, to, cum, desc, detail) | 60 |
| order (name:from>to/cum) | old and new both Gt-00:0>0/0 Gt-01:1>1/1 Gt-03:2>3/3 Gt-06:3>6/6 Gt-10:4>1/10 Gt-15:5>6/15 Gt-21:6>3/21 Gt-28:7>1/28 Gt-36:8>9/36 Gt-45:9>9/45 |
| key order of every entry | name, from, to, cum, desc, detail (10 of 10) |
| name, desc, detail as runtime strings and by code point | 30 of 30 identical; 1 non-ASCII character in the new text (the em dash in the Gt-36 detail, same as old) |
| exports | old module: `GATE_LIST` only; final new module: `GATE_LIST` only (missing 0, extra 0) |
| escape sequences in the source | old file 1; final `app/data/gates.ts` 0 (seam); `app/presets/base10/gates.ts` 0 |
| **differences** | **0** |

The names, descriptions and details are equal to the frozen upstream file, not only to the 02-07 lore module.

## Task Commits

1. **Task 1: Gates adapter with own-base names and seam flip (swap commit)** - `b8bea46` (refactor): `app/presets/base10/gates.ts`, `app/data/gates.ts`, `tests/presets/base10-adapter.test.ts`
2. **Task 2: Delete the hand-authored gate data (D-08)** - `92dc1c6` (refactor): `app/data/gates.ts`, `tests/presets/base10-adapter.test.ts`

No `perf(02-10)` commit: the page-weight budget passed unchanged (see below).

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification results (exact, per command)

| when | command | result |
|------|---------|--------|
| pre-flight, HEAD cc3e09e clean | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 251 s**: check:repo OK; typecheck clean; `test` 26 files 930 tests; `test:tz` 26 files 930 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` 75 passed 5 skipped; `check-repo: OK (... clean-tree, static-out)` |
| TDD RED | `vitest run --project oracle tests/presets/base10-adapter.test.ts` before the adapter existed | the file failed to load (`Cannot find module '../../app/presets/base10/gates'`), no tests ran |
| Task 1 quick | `npx cross-env CCRUG_TZ=UTC vitest run --project oracle` | 13 files, 454 tests pass (444 + 10 new) |
| Task 1 quick | `npm run typecheck` | exit 0 (4x tsc, lint: no warnings or errors) |
| Task 1, uncommitted swap | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 194 s**: build OK; playwright 65 passed 5 skipped (60 DOM goldens both timezones + 5 behaviour on UTC); vitest 26 files 940 tests |
| Task 1 committed (b8bea46), full gate | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 252 s**: unit 940 in both timezones, basepath e2e 10 passed, `page-weight: OK (2 routes, 30 golden states within tolerance)`, e2e 75 passed 5 skipped, final check-repo OK incl. clean-tree and static-out |
| Task 2 quick | oracle project, `npm run typecheck`, `node scripts/check-repo.mjs` | 13 files 453 tests pass; exit 0; `check-repo: OK` |
| Task 2, uncommitted deletion | `MSYS_NO_PATHCONV=1 npm run test:swap` | **exit 0 in 193 s**: playwright 65 passed 5 skipped (60 goldens + 5 behaviour), vitest 26 files 939 tests |
| final, deletion committed (92dc1c6), clean tree | `MSYS_NO_PATHCONV=1 npm run verify` | **exit 0 in 248 s**: check:repo OK; typecheck clean; `test` 26 files 939 tests; `test:tz` 26 files 939 tests; `test:e2e:basepath` 10 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)`; `test:e2e` **75 passed, 5 skipped** (60 goldens unchanged + 10 static-export + 5 behaviour; the 5 skipped are the behaviour specs under the New York project); `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)` |

Test count: 930 before, 940 after the swap (the gates block adds 10 tests), 939 after the deletion (the legacy comparison goes).

Frozen material (acceptance):

- `git diff --quiet f7d6689 -- app/NumogramClient.tsx app/components app/hooks app/lib e2e/__golden__ engine/test/fixtures/base10.golden.json` exits 0 (checked after the swap commit and after the final verify). `git diff --name-only f7d6689 -- app` lists only `app/data/{currents,demons,gates,syzygies,zones}.ts` and `app/presets/base10/{currents,gates,lore,numogram,syzygies}.ts`.
- `node scripts/golden-manifest.mjs verify e2e/__behaviour__/MANIFEST.json` prints `OK 5 files in 1 sets`; `git status --porcelain -- e2e/__behaviour__` prints nothing; `git diff --quiet ebab0cc -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures tests/oracle app/components app/hooks app/lib app/NumogramClient.tsx` exits 0 (nothing frozen or consumer-side changed since the pre-swap-1 state); `perf/` untouched.
- No `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used. Nothing was pushed, fetched or pulled.
- Cleanup: no listener on ports 3000, 3007, 3111, 3112, 3113 afterwards; `.e2e-basepath/` removed after every verify.

## Page weight (T-02-39/40 style check)

Measured with `node scripts/page-weight.mjs print` against `perf/page-weight.baseline.json`:

| route | metric | baseline | after 02-09 | now (92dc1c6) | vs baseline | this swap |
|-------|--------|----------|-------------|---------------|-------------|-----------|
| `/numogram/` | js bytes | 563,909 | 580,875 | 580,459 | +16,550 (+2.9%) | -416 |
| `/numogram/` | js gzip | 170,556 | 175,482 | 175,360 | +4,804 (+2.8%) | -122 |
| `/` | js bytes / gzip | 416,830 / 128,120 | unchanged | unchanged | 0 | 0 |

The post-swap-commit build (b8bea46) measured 580,683 raw and 175,424 gzip; the deletion commit removed another 224 raw and 64 gzip. Tolerance `max(1 KiB, 5%)`: limits are baseline + 28,196 raw and + 8,528 gzip, so the headroom left for swaps 02-11 and 02-12 is **about 11,646 raw and 3,724 gzip bytes** on `/numogram/`. `check:weight` passed on every run and the baseline file was not touched. 02-12 (demons) is the swap to watch.

## Decisions Made

See key-decisions above. The plan was followed as written. Judgement calls:

- `formatGateName` takes `BASE10.base` rather than the literal `10` of the plan's interface line; the value is the same (asserted by the engine-instance test) and the adapter then contains no base literal.
- The independent-definition check of `to` uses the existing `tests/bruteforce` reference (`refDigitSumRoot`) instead of a new helper, so the test does not restate the engine's closed form.
- The seam's LEGACY re-export order: the re-export line comes first and the renamed hand array follows with a one-line comment saying it lives only until the deletion commit.

## Deviations from Plan

None - plan executed exactly as written. The conditional page-weight step did not trigger, so `perf/page-weight.baseline.json` and any `perf(02-10)` commit do not exist.

Process notes (no effect on the result):

- `python3` is not available in this shell; byte checks (CR bytes, escape sequences, non-ASCII bytes) were done with `node`.
- The proof script's `exit 1` on the uncommitted swap state came only from the expected extra export `LEGACY_GATE_LIST`; after the deletion it exits 0.

## Issues Encountered

None. No peer plan ran, so no whole-repo check reported a foreign file.

## Known Stubs

None. `GATE_LIST` is fully engine- and lore-derived; nothing is hard-coded, empty or mocked.

## Threat Flags

None. T-02-39 (name formatting, padding, digits): the names come from the engine formatter and equal the hand names entry by entry before deletion (Task 1 test), the frozen oracle names (permanent test), the f7d6689 deep-equality proof (0 differences) and the DOM goldens (layer-gates) plus the behaviour baseline (Gates panel rows) passed. T-02-40 (Gt-15 drawn as 16, Gt-03 as 8): named regressions `Gt-15 is 5 -> 6` and `Gt-03 is 2 -> 3` in the adapter test, in the numeric oracle test and in the engine oracle test. T-02-41 (goldens regenerated): none touched, verified by the diffs above. No new network, auth, file-access or schema surface: the new import edge is app -> engine by relative path (already introduced in 02-08 and 02-09), and the engine imports nothing from app.

## Requirements Note

`requirements-completed` lists MIG-01 because this plan's frontmatter carries it; the plan delivers swap 3 of 5, not MIG-01 as a whole. Per the orchestrator's instruction no ENG-*/MIG-* checkbox was ticked and `requirements.mark-complete` was not run.

## Notes for swap 02-11 (regions and zones) and the rest

- **Pattern to copy:** a new adapter file under `app/presets/base10/` imports `BASE10` from `./numogram` (and, if it needs a formatter, from the engine barrel `../../../engine/index`), builds the viewer shape once at module load, and the seam re-exports it. Write the tests first (import of the missing adapter fails, RED), keep the hand data as `LEGACY_*` in the seam for the first commit, run `test:swap`, commit, `verify` on the committed swap, then delete in a second commit and run `test:swap`, quick checks and a final `verify`.
- **02-11 touches `app/lib/constants.ts`** (`TC_EDGES`, `TC_CURRENTS`, `TC_SYZYGIES` become re-exports of the regions adapter, a deliberate one-file extension of the D-01 seam beyond `app/data/*`, per the plan). Its acceptance diff against f7d6689 must therefore name `app/lib/constants.ts` as the only allowed change under `app/lib`; the `git diff --quiet f7d6689 -- app/lib` line used in 02-08..02-10 will exit 1 from that commit on.
- **`ZONE_REGION` and `TC`** live today in `app/data/zones.ts` and `app/data/demons.ts`; `ZONE_REGION[z]` is read by `NumogramClient.tsx`, `InfoDisplay.tsx` and `ZonesPanel.tsx`, so the seam must keep the same object shape (`Record<number, Region>`).
- **Never type a unicode escape sequence** in a Write/Edit argument: build the backslash from a char code in a script and check the bytes (there is no `python3` here; `node` works for byte counts). Do not edit the repo while a gate runs (`verify` ends with `--clean-tree`); keep drafts in the scratchpad.
- **Gate timings on this machine:** `npm run verify` 248-252 s, `npm run test:swap` 193-194 s. Test count now 939 in both timezones (26 files).
- **Page-weight headroom** is in the section above (about 11.6 KB raw and 3.7 KB gzip left on `/numogram/` before the stored baseline needs a reasoned `update --reason`).

## Next Phase Readiness

- Ready for swap 4 (02-11, regions and zones). Syzygies, currents and gates are engine-derived and lore-joined, no hand structure remains for any of the three, the full gate is green with the 60 goldens, the behaviour baseline and the numeric oracle unchanged.

## Self-Check: PASSED

- FOUND: `app/presets/base10/gates.ts`, `app/data/gates.ts`, `tests/presets/base10-adapter.test.ts`
- FOUND commits: `b8bea46`, `92dc1c6`

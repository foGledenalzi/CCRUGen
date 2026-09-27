---
phase: 02-engine-core-and-base-10-migration
verified: 2026-09-27T03:50:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification: false
verified_at_commit: 2239f56
notes_on_commit: "HEAD moved to 0fca013 during verification; that commit only adds 02-REVIEW.md (git diff --stat 2239f56 HEAD = 1 file), so every source, test, golden and fixture verified here is unchanged."
gaps: []
deferred: []
---

# Phase 2: Engine Core and Base-10 Migration Verification Report

**Phase Goal:** For any even base the correct numogram is derived by a pure, tested engine, and the base-10 viewer runs on that engine with no visible change
**Verified:** 2026-09-27T03:50:00Z (tree at 2239f56, clean)
**Status:** passed
**Re-verification:** No, initial verification

Method: the five ROADMAP success criteria were checked against my own probes and my own runs, not against the SUMMARY files. My probes are throwaway `npx tsx` scripts in the session scratchpad that use their own definitions-only model (maps and sets, iterated in-base digit sums, BigInt), not the repo's `tests/bruteforce` reference and not the engine's formulas. Mutation probes ran in a scratch copy of the tracked files (node_modules junctioned, junction removed afterwards). The real tree stayed clean (`git status --short` empty before and after), nothing was pushed, fetched, pulled or committed, no `-u`, `GOLDEN_CAPTURE` or `BEHAVIOUR_CAPTURE` was used, ports 3000/3111/3112 are free and `.e2e-basepath/` does not exist.

## Goal Achievement

### Observable Truths

ROADMAP success criteria first (the contract), then plan-level truths.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: the engine's base-10 output equals the frozen oracle: 10 zones, 5 pairs, currents, gates (Gt-15 = 5->6, Gt-03 = 2->3), regions, 45 demons = 12+3 chrono, 12+12 amphi, 4+2 xeno | VERIFIED | Probe 1 loaded `engine/test/fixtures/base10.golden.json` and compared it with `createNumogram(10)`: pairs `[[4,5],[3,6],[2,7],[1,8],[0,9]]` equal; every current's `to` equal (8->7, 2->5, 4->1, 6->3, 9->9); all 10 gates equal in `to` and `cum`, and `formatGateName` reproduces all 10 names `Gt-00 ... Gt-45`; `Gt-15` = `{from 5, to 6, cum 15}`, `Gt-03` = `{from 2, to 3, cum 3}`; `zoneRegion` equal; cycles = Torque pairs [1,2,4] zones [1,8,7,2,5,4] (equals the oracle's `tc.edges` walk), Plex [0], Warp [3]; all 45 demons equal in `a`, `b`, mesh order and, through the legacy mapping, in `kind`. `counts()` = cyclic 12, cross-Torque 0, syzygetic chrono 3, Plex amphi 12, Warp amphi 12, chaotic xeno 4, syzygetic xeno 2 (types chrono 15, amphi 24, xeno 6; Numodemons 4). 0 mismatches. |
| 2 | SC2: guide facts hold (base 12; Torque [4,2] at 16, [9,3] at 28, [39] at 80, [27,9,3] at 82; Warp iff n = 3o+1 with o odd); sweep over every even n up to 2000; odd, zero, negative, non-integer bases rejected | VERIFIED | Probe 2 recomputed, from the definitions with its own model, for EVERY even n in 2..2000 (1000 bases): the cycles of the pair map (canonical order: length descending, smallest first zone, each rotated to its smallest pair), region kinds, the Warp rule (`n = 3o+1`, o odd, computed from the rule itself), and every gate as the ITERATED in-base digit sum of T(k) (not the closed form): 0 mismatches. Torque lengths in pairs: 16 [4,2], 28 [9,3], 80 [39], 82 [27,9,3], plus 18 [4,4], 22 [6,3], 32 [5,5,5], 36 [12,3,2], 100 [15,15,5,5,5,3], all OK. Base 12 gates `0,1,3,6,a,4,a,6,3,1,b,b`, zone 11 -> `Gt-56` (T = 66), one Torque [1,2,4,3,5], Plex, no Warp. Probe 5 repeated the structure check with plain map walks at 2^20, 2^22, 2^24, 2^26 - 2, 2^26, 666, 1024 and others: cycle count, lengths, first pairs and Warp rule all match. Rejections: 1, 3, 9, 0, -2, -1, -10, 2.5, 10.5, NaN, Infinity, -Infinity, 67108866, 67108865, 2^27, 1e308, `'10'`, null, undefined, `{}`, `4n`, -0 all throw `RangeError` with a reason ("odd bases have a self-paired zone", "must be a whole number", above the safe ceiling ...); `validateBase` returns `{ok:false, reason}` without throwing (`not-a-number`, `infinite`, `not-integer`, `zero`, `negative`, `odd`, `too-large`) and `ok` for 2, 4, 10, 2^26 - 2, 2^26. |
| 3 | SC3: base 28 = 378 demons, 108 cross-Torque chrono; mesh <-> net-span in O(1); per-type counts sum to C(n,2); Numodemons n/2 - 1 | VERIFIED | Probe 3: base 28 `counts()` = `[156, 108, 12, 48, 48, 4, 2]`, sum 378, count 378, Numodemons 13. My own enumeration of every demon a::b for EVERY even n <= 400 (classification from my own region model) equals `demons.at(mesh)` / `ref` (subtype, type, mesh) on every sampled demon (all demons for n <= 40), and per-subtype counts, C(n,2), and n/2 - 1 Numodemons (including iterating `numodemons()`); engine type and subtype counts sum to C(n,2) for every even n up to 2000. Base 12 = 40+5 chrono, 20 Plex amphi, 1 syzygetic xeno, 5 Numodemons; base 82 = 40 Numodemons; base 2 = 1 demon, 0 Numodemons. Mesh: the exact top demon `67108863::67108862` has mesh 2251799780130815 (my BigInt computation) and the engine's `meshOf` and `netSpanOf` agree in both directions; 20,770 meshes (20,000 pseudo-random over [0, C(2^26,2)), every row start/end/predecessor for a in 60,000,000..60,000,199, every 1,234,567th row, 0, 1, 2 and the last two) all equal a BigInt isqrt reference and round-trip. Probe 7: the float estimate `floor((1+sqrt(8m+1))/2)` is exactly the true row at all 2^26 row boundaries (max deviation 0), so the two integer correction loops in `rowOf` run at most a step or two: O(1). Out-of-range and non-integer meshes, equal zones and zones >= 2^26 throw `RangeError`. Unranking (`group`, `subtype`) for base 28 equals my enumeration for all 3 types and 7 subtypes. |
| 4 | SC4: base 2^26 computes zones, pairs and cycles with no O(n^2) structure; bases above the ceiling are refused | VERIFIED | Probe 4 (fresh process, `--expose-gc`): `createNumogram(2^26)` in 653 ms; `arrayBuffers +270.8 MB`, `heapUsed +0.1 MB`, RSS +271 MB total; `storageBytes` = 4.23 bytes per zone; 1,290,872 cycles, 1,290,870 Torque, Warp present (correct: (2^26 - 1)/3 = 22369621 is odd). Touching the demon space adds 0.0 MB (`count` 2251799780130816 = 2^51 - 2^25, counts read in 5.75 ms, 100,000 `demons.at()` queries in 18 ms). 67108866, 2^27, 2^40 and 2^53 throw `RangeError`. Source read: `build()` allocates five `Int32Array`/`Uint8Array` of length pairCount or cycleCount only, cycles are found by one walk per cycle and ordered by a counting sort; no per-cycle JS object exists until `cycles` or `cycleAt` is read. |
| 5 | SC5: the viewer's syzygies, currents, gates, demons and regions come from the engine joined with lore by id; DOM goldens byte-identical; layouts, hover, undo, share links as before | VERIFIED | Adapters read (`app/presets/base10/{syzygies,currents,gates,regions,demons}.ts`): each builds from `BASE10 = createNumogram(10)` and joins `SYZYGY_LORE[pairId]`, `CURRENT_LORE[pairId]`, `GATE_LORE[originZone]`, `DEMON_NAMES[mesh]`; regions from `cycleOfZone(z).kind` and the Torque cycle's `zones()`/`pairs()`; gate names through `formatGateName`, current labels through `formatNumeral` with U+2212. The five `app/data/*.ts` files are 2- and 3-line re-exports; `app/lib/constants.ts` re-exports `TC_EDGES/TC_CURRENTS/TC_SYZYGIES` from the regions adapter. `git diff --name-only f7d6689 -- app` lists exactly 13 files: the five `app/data` seams, `app/lib/constants.ts` and seven `app/presets/base10/*`; `git diff f7d6689 HEAD -- app/components app/hooks app/NumogramClient.tsx` (which contains `app/components/projection/**`) is empty, as are `positions.ts`, `types.ts`, `layout.tsx` and the pages. I ran `npx playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` against the existing `out/` (built 21:06, after the last source edit at 20:36): 65 passed (60 DOM goldens = 30 states x 2 timezones, 5 behaviour baselines on the UTC project), 5 skipped by design (behaviour under the New York project). Stronger, transitive proof: I built the PRE-phase app (`git archive f7d6689 app`) in a scratch copy and ran today's 30 goldens and 5 behaviour baselines against it: 35 passed. So the behaviour baseline is a true capture of the original viewer and the migrated viewer passes the same baseline. `e2e/static-export.spec.ts` on the real `out/`: 10 passed (legacy `/?...` and `/numogram/?...` share links, no foreign requests). All four manifests verify (30 / 1 / 1 / 5 files). |
| 6 | Nothing frozen changed; the new oracles are protected | VERIFIED | `git diff --name-status f7d6689 HEAD -- e2e engine/test/fixtures` shows only additions (`e2e/__behaviour__/*`, `engine/test/fixtures/derived/*`, the new behaviour specs); no modified or deleted frozen file. `git diff b82f6a2 HEAD -- e2e/__behaviour__` and `git diff 0b809d6 HEAD -- engine/test/fixtures` are empty. `node scripts/golden-manifest.mjs verify` on `e2e/__golden__`, `engine/test/fixtures`, `engine/test/fixtures/derived`, `e2e/__behaviour__`: all OK. `git diff f7d6689 b82f6a2 -- app` is empty: the behaviour baseline was captured (a11e132) and frozen (b82f6a2) before the first swap (27f0d8e). |
| 7 | The tests can genuinely fail (mutation probes in a scratch copy) | VERIFIED | Lore key flip (`SYZYGY_LORE` keys 1 and 2 swapped): unit tests fail (2 failed) AND a full rebuild fails all 5 behaviour specs (e.g. `Syzygies: ... Oddubb | 5 | 1 | :: | 8 | Murrumur ...` vs baseline) and 6 DOM goldens (`region-torque` and `time-circuit` in three layouts). Adapter mapping (`legacyKind`: syzygetic-chrono moved to chrono): 7 adapter tests fail, and a rebuild fails the 3 `layer-pandemonium` goldens (extra `#00ccff` demon path). Gate adapter `to: gate.cumulation % 9`: adapter and oracle tests fail. Engine: bare-modulus digital root, cross-Torque folded into cyclic, ascending canonical order, ceiling raised to 2^27, mesh formula off by one: each turns the engine sweeps and unit tests red. Unmutated baseline in the copy: 99 + 82 tests green. |
| 8 | Engine purity and independence of the reference | VERIFIED | `engine/core/*.ts` and `engine/index.ts` import only relative `./` paths inside `engine/` (grep); no DOM/Node globals, `Math.random`, `Date`, or `BigInt` in `engine/core`. My own `npm run typecheck` (four `tsc` runs plus `next lint --dir app --dir engine --dir workers`) exit 0, "No ESLint warnings or errors". `engine/test/guard.test.ts` (Phase 1) still passes inside my own full unit run. `tests/bruteforce/numogramReference.ts` has no imports at all; `tests/bruteforce/*.test.ts` import only `fast-check`, `vitest`, the reference and (fixture test) `scripts/golden-manifest.mjs`; `scripts/capture-notable-bases.ts` imports only the reference. The notable-bases fixture manifest reason states it was captured from the reference, never from the engine or `reference/`. |
| 9 | Decisions D-01 .. D-16 honored | VERIFIED | See the decision table below. |
| 10 | Phase 1 guarantees still hold (regression) | VERIFIED | `node scripts/check-repo.mjs`: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow). `node scripts/page-weight.mjs check`: OK (2 routes, 30 golden states). `npm run typecheck` exit 0. My own full unit run (`CCRUG_TZ=UTC npx vitest run`): 26 files, 958 tests passed (same count the orchestrator's gate reported, both timezones). 60 DOM goldens and 10 static-export specs pass (above). `git ls-files reference` empty; origin = `foGledenalzi/CCRUGen`, upstream push disabled. The Phase 1 "five lore files" wording was superseded deliberately by D-06/D-16: guard, NOTICE section 3 and the header now name the single `lore.ts`, and the guard passes. |

**Score:** 10/10 truths verified

### Decision checks (02-CONTEXT.md)

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 adapter, components untouched | HONORED | Diff scope above; components, hooks, `NumogramClient.tsx`, projection byte-identical to f7d6689. `app/lib/constants.ts` (3 re-exports) is the one extra seam, explicitly allowed by plan 02-11; same names and values, so consumers are unchanged. |
| D-02 one source at a time, own commit, gate before deleting | HONORED | `git show --stat` per commit: syzygies 27f0d8e then delete 54ec485; currents d34787b / 580aa8c; gates b8bea46 / 92dc1c6; regions 77be052 / 258b440; demons f54f92b / d0cbf2a. Each swap commit touches only its source's seam, adapter and the adapter test; each deletion follows. |
| D-03 hard-coded 10-zone logic stays for Phase 4 | HONORED | No component/hook edit; MIG-02 remains open by design. |
| D-04 own-base gate names, mesh and net-span | HONORED | `formatGateName(66, 12) = Gt-56`, `formatNetSpan(11, 3, 12) = b::3`, base 10 names identical to today's (probe 6). |
| D-05 formatter in engine, beyond-36 scheme, pure and reversible | HONORED | Digits 0-9a-z to base 36, dot-separated decimal digit groups beyond (`3601` in base 60 = `1.0.1`). Probe 6: equals `Number.toString(radix)` for bases 2..36 on 12 values each, and 2,000 random safe integers per base round-trip in ten bases from 38 to 2^26. Every unpadded numeral of a safe integer round-trips (longest 53 chars). See advisory A1 for one padded edge. |
| D-06 one lore file, text unchanged, id-keyed, coverage test | HONORED | `app/presets/base10/lore.ts` (170 lines) keyed by zone, pair id, gate origin, mesh; `tests/presets/base10-lore.test.ts` covers all engine ids and orphans; `grep` finds no lore text outside it (adapter test 'no file other than lore.ts contains lore'). |
| D-07 typed TS module with licence header | HONORED | Line 1 is the required header; guard `lore` check passes. |
| D-08 old hand data deleted after each swap | HONORED | `app/data/{syzygies,currents,gates,demons,zones}.ts` are 2-3 line re-exports; the import-time `ALL_DEMONS` builder and Torque literals are gone; `positions.ts` and `types.ts` untouched; no `tests/legacy`. |
| D-09 tiered independent cross-check | HONORED | Reference in `tests/bruteforce`; sweeps for n <= 300 (all demons), n <= 2000 (structure, counts), closed-form and spot unranking beyond (666, 1024, 2^26). My own probes reproduce the same tiers with an independent model. |
| D-10 fixed seeds | HONORED | 29 `seed:` occurrences across engine and oracle tests; no `Math.random` in any test outside the boundary guard's own violation fixtures. |
| D-11 2^26 test in verify with explicit ceilings | HONORED | `engine/test/ceiling.test.ts` asserts 20,000 ms, 768 MiB array buffers, 128 MiB heap; it runs in the standard `engine/**/*.test.ts` glob (my run: 958 passed, no skipped test except a Phase 1 symlink `skipIf`); measured by me at 653 ms and +270.8 MB. No `test:heavy` needed. |
| D-12 RangeError plus non-throwing `validateBase` | HONORED | Probe 2. |
| D-13 `createNumogram(base)` immutable, cached, bounded | HONORED | Probe 6: object and cycle views frozen, same object returned for the same base, `pairs()`/`zones()` return copies, cache limits 4 entries and 2^26 zones, lazy `demons`. API matches the ARCHITECTURE sketch (`at`, `ref`, `meshOf`, `netSpanOf`, `counts`, `typeCounts`, `incident`, `numodemons`, `group`, `subtype`). |
| D-14 eager typed arrays, virtual demons | HONORED | Probe 4: 4.23 bytes per zone; demon space adds 0.0 MB. |
| D-15 frozen behaviour and text baseline | HONORED | Captured before the first swap, manifest-protected (`e2e/__behaviour__/MANIFEST.json`), registered in `scripts/check-repo.mjs` (`goldens`, `lf`), and proven to be a capture of the original viewer (pre-phase app passes it, mutation probes fail it). |
| D-16 guard, tests, NOTICE and header changed together | HONORED | Commit cb32c1a changes NOTICE, `scripts/check-repo.mjs`, `tests/repo/check-repo.test.ts` and the five seams in one change; `check-repo` is green. |
| Locked earlier | HONORED | Gate 0->0 emitted (n gates); explicit cross-Torque subtype; canonical cycle order; `torqueLabel` A..Z then numbers (index + 1); units stated as pairs and zones; ceiling 2^26 with no BigInt path; the viewer's `syzygy` kind reproduced from the 3 syzygetic chrono + 2 syzygetic xeno demons. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `engine/core/{base,arith,numerals,types,numogram,demons,unrank}.ts`, `engine/index.ts` | pure engine | VERIFIED | 1,282 lines, substantive, exported through `engine/index.ts`, consumed by `app/presets/base10/*` and the tests; no stubs or TODOs (grep) |
| `tests/bruteforce/numogramReference.ts` | independent reference | VERIFIED | 306 lines, no imports |
| `engine/test/fixtures/derived/notable-bases.golden.json` + manifest | frozen derived fixture | VERIFIED | manifest OK, unchanged since 0b809d6 |
| `e2e/__behaviour__/*.json`, `e2e/behaviour*.ts` | frozen behaviour baseline and spec | VERIFIED | manifest OK, unchanged since b82f6a2, passes on both the pre-phase and the migrated viewer |
| `app/presets/base10/{lore,numogram,syzygies,currents,gates,regions,demons}.ts` | adapters and lore | VERIFIED | wired through the five seams and `app/lib/constants.ts`, data flows from the engine (Level 4 below) |
| `NOTICE`, `scripts/check-repo.mjs` | single lore file recorded | VERIFIED | `check-repo` OK |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/data/syzygies.ts` | `presets/base10/syzygies.ts` | re-export | WIRED | `SYZYGIES` is the adapter array (adapter test 'the very array the seam exports') |
| `app/data/{currents,gates,demons,zones}.ts`, `app/lib/constants.ts` | adapters | re-export | WIRED | same |
| adapters | `engine/index` | `createNumogram(10)` in `numogram.ts`, `formatGateName`, `formatNumeral` | WIRED | relative imports; `BASE10` singleton asserts one Torque cycle and a Warp |
| adapters | `lore.ts` | id joins, throw on a missing key | WIRED | mutation of a lore key fails unit tests, goldens and the behaviour baseline |
| `NumogramClient` and components | `app/data/*`, `app/lib/constants` | unchanged imports | WIRED | byte-identical to f7d6689, viewer renders identically |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SYZYGIES`, `CURRENTS`, `GATE_LIST`, `ALL_DEMONS`, `ZONE_REGION`, `TC*` | adapter arrays | `createNumogram(10)` pairs, currents, gates, demon space, cycles + `lore.ts` | Yes (compared with the frozen oracle and the pre-phase viewer) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Base 10 equals oracle | probe 1 (`npx tsx`) | 0 mismatches | PASS |
| Sweep 2..2000 vs own model | probe 2 | 0 mismatches | PASS |
| Demons, counts, mesh round trip (BigInt) | probe 3 | 0 mismatches, 20,770 meshes | PASS |
| 2^26 build time and memory | probe 4 | 653 ms, +270.8 MB | PASS |
| Large-base structure | probe 5 | all OK | PASS |
| Numerals, immutability, cache | probe 6 | 0 fails | PASS |
| Full unit suite | `CCRUG_TZ=UTC npx vitest run` | 26 files, 958 passed | PASS |
| Typecheck and lint | `npm run typecheck` | exit 0 | PASS |
| Repo guard, page weight | `check-repo`, `page-weight check` | OK, OK | PASS |
| DOM goldens + behaviour | `playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` | 65 passed, 5 skipped by design | PASS |
| Pre-phase app vs today's baselines | scratch build of f7d6689 | 35 passed | PASS |
| Static export / share links | `playwright test e2e/static-export.spec.ts` | 10 passed | PASS |

### Requirements Coverage

All six IDs are claimed in plan frontmatter and match REQUIREMENTS.md; the traceability table maps exactly these six to Phase 2 (no orphans). Their checkboxes are intentionally unticked until the orchestrator acts on this verdict.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ENG-01 | 02-01, 02-02, 02-04, 02-13 | zones, pairs, currents, in-base gates for any even base | SATISFIED | SC1, SC2 (1000-base sweep, iterated digit-sum gates) |
| ENG-02 | 02-02, 02-04, 02-13 | Plex, Warp iff n = 3o+1 (o odd), canonical Torque cycles in pairs and zones | SATISFIED | SC2; probe 5 to 2^26 |
| ENG-03 | 02-02, 02-05, 02-06, 02-13 | virtual demons, mesh <-> net-span O(1), cross-Torque subtype, closed-form counts, Numodemons n/2 - 1 | SATISFIED | SC3 |
| ENG-04 | 02-01, 02-02, 02-04, 02-05, 02-13 | base-10 equals oracle, guide facts, sweeps to 2000, invalid bases rejected | SATISFIED | SC1, SC2 |
| ENG-05 | 02-04, 02-05, 02-13 | no O(n^2) structure up to 2^26 | SATISFIED | SC4 |
| MIG-01 | 02-03, 02-07 .. 02-13 | viewer derived from the engine, joined with lore by id, goldens byte-identical | SATISFIED | SC5, truths 6 and 7 |

### Anti-Patterns Found

None blocking. `grep` for TODO/FIXME/placeholder/not-yet-implemented over `engine/core`, `engine/index.ts`, `app/presets/base10`, `app/data`, `app/lib/constants.ts` finds nothing. No hard-coded base-10 constant in `engine/core` (only the digit-value offsets in the numeral parser). No upstream branding was added: the added lines and new file names in `f7d6689..HEAD` contain none of `qliphoth`, `delight nexus` or `gematria`; the remaining mentions are the guard's own forbidden list, its tests, `CLAUDE.md` and the pre-existing `app/cyphers/gematria.ts` (Phase 1 baseline, untouched).

### Advisories (not gaps; for the orchestrator)

- **A1 (from 02-REVIEW WR-01, reproduced by me):** `parseNumeral` rejects text over 64 characters, but `formatNumeral(v, base, minDigits)` can write longer text when padding dotted numerals (`formatNumeral(0, 60, 33)` is 65 characters and `parseNumeral` throws; `formatNumeral(5, 37, 64)` is 127). Unpadded numerals of any safe integer in any base 2..2^26 always round-trip (longest 53 characters), and the only production caller pads to 2 digits, so no Phase 2 criterion, requirement or visible behaviour is affected. Worth fixing before Phase 4 starts consuming the scheme for zone labels (the review proposes raising the cap to 575 and bounding by groups).
- **A2 (from 02-REVIEW IN-02):** unranking `cyclic-chrono` and `cross-torque-chrono` is documented as O(K log n log C(n,2)); at the 2^26 cap with 1.29 million Torque cycles that is seconds per `at(k)`. Not a Phase 2 criterion (unranking is an extra of plan 02-06); relevant to Phase 5 only for very large bases.
- **A3:** `origin/main` (local remote-tracking ref, I did not fetch) is at 9df17cd, the `docs: README update for the completed engine (Phase 2, 6 of 13 plans)` commit made between plans 02-06 and 02-07; HEAD is 20 commits ahead of it. No plan contains a push step (every plan says "Never `git push`"), every summary from 02-03 on states nothing was pushed, and no plan commit (`feat`, `test`, `refactor`, `fix`, `docs(02-NN)`) is on the remote. That README push happened outside every plan; CLAUDE.md records user-approved pushes of this kind, but I cannot verify from the repo that this specific push was authorized, so that is the orchestrator's call.
- **A4:** `legacyCurrentFrom` in `app/presets/base10/currents.ts` keeps the upstream drawing convention (even member, Plex folded to its high zone) so the SVG stays byte-identical; it is documented in place as non-canonical and to be replaced by engine-driven routing in Phase 4.
- **A5:** MIG-02 (removing the hard-coded 10-zone logic from the components) is open by design and belongs to Phase 4.

### Human Verification Required

None. 02-VALIDATION states that a human glance at the served viewer is welcome but not required; the 60 DOM goldens and the behaviour baseline are the contract, and both pass on the migrated viewer and on the pre-phase viewer.

### Gaps Summary

No gaps. All five ROADMAP success criteria hold under independent probes, all six requirement IDs are satisfied and accounted for, decisions D-01 .. D-16 were honored, nothing frozen was modified, the tests are demonstrably able to fail, and the Phase 1 guarantees still hold. Phase 2 goal achieved.

---

_Verified: 2026-09-27T03:50:00Z_
_Verifier: Claude (gsd-verifier)_

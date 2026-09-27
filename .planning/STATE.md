---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-08-PLAN.md
last_updated: "2026-09-27T00:50:00.000Z"
last_activity: 2026-09-26
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 21
  completed_plans: 16
  percent: 76
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-25)

**Core value:** For any even base n, derive the numogram correctly (base-10 must reproduce the canonical numogram exactly) and draw it legibly.
**Current focus:** Phase 2 — Engine Core and Base-10 Migration

## Current Position

Phase: 2
Plan: 8 of 13 executed
Status: Executing Phase 2 (02-08 syzygies swap done; next 02-09, currents)
Last activity: 2026-09-26

Progress: [████████░░] 76%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 8 | - | - |
| 2 | 8 | 197min | 25min |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 1 P01 | 6min | 3 tasks | 13 files |
| Phase 1 P02 | 3min | 2 tasks | 2 files |
| Phase 1 P03 | 5min | 2 tasks | 5 files |
| Phase 1 P04 | 14min | 2 tasks | 36 files |
| Phase 1 P05 | 7min | 3 tasks | 24 files |
| Phase 1 P06 | 8min | 3 tasks | 5 files |
| Phase 1 P07 | 12min | 2 tasks | 8 files |
| Phase 1 P08 | 9min | 2 tasks | 63 files |
| Phase 2 P01 | 14min | 2 tasks | 8 files |
| Phase 2 P02 | 11min | 2 tasks | 6 files |
| Phase 2 P03 | 38min | 3 tasks | 15 files |
| Phase 2 P04 | 21min | 3 tasks | 7 files |
| Phase 2 P05 | 24min | 2 tasks | 9 files |
| Phase 2 P06 | 24min | 2 tasks | 5 files |
| Phase 2 P07 | 30min | 2 tasks | 11 files |
| Phase 2 P08 | 35min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8 phases (standard granularity); research merges 2+3, 4+5, 10+11 applied; Next 16 upgrade phase dropped
- [Roadmap]: Next.js pinned at 14.2.35 for all of v1; UPG-01 is v2
- [Roadmap]: Explicit cross-Torque chronodemon subtype (ENG-03); text view, region legend and pair-graph view are v1
- [Roadmap]: Poster export is v2; EXP-01..04 are plain SVG/PNG/JSON plus CLI
- [Roadmap]: Gate 0->0 draw/omit policy and Torque ordering/naming are frozen in Phase 2
- [Phase 1 P01]: TZ pinned by runtime process.env.TZ assignment in vitest.config.mts from CCRUG_TZ (process-start TZ= is ignored by Node on Windows); tz.test.ts is the canary
- [Phase 1 P01]: golden-manifest resolves paths against the repo root, stores repo-relative forward-slash paths, refuses CR files, and never overwrites a frozen file (new dated set with a written reason)
- [Phase 1 P01]: until plan 01-08, every npm install must be followed by git checkout -- dist and git checkout -- yarn.lock (prepare and npm rewrite tracked files)
- [Phase 1 P02]: engine boundary = tsc (lib ES2022, types []) plus ESLint no-restricted-syntax/globals/paths override; guard.test.ts uses lintText on a virtual engine/ path (no in-repo probe) and a temp tsconfig extending engine/tsconfig.json
- [Phase 1 P03] Numeric base-10 oracle frozen as engine/test/fixtures/base10.golden.json (sha256 in MANIFEST.json, set 2026-09-26-base10-numeric); capture script refuses to overwrite; oracle test asserts definitions (T(k), base-n digital root, current cycles, 12+3/12+12/4+2 demon split) independently of the JSON
- [Phase 1 P04] DOM oracle frozen: 30 visual-DOM goldens (original/labyrinth/ladder x 10 states) in e2e/__golden__ captured once from the untouched viewer on next dev, sha256 in e2e/__golden__/MANIFEST.json (set 2026-09-26-baseline, strictDir); capture only with GOLDEN_CAPTURE=1 (exits 1 by design), every other run is updateSnapshots none; settle signal = viewBox + __reactFiber$ + 2 rAF + 300 ms stable; aria/data/role/tabindex ignored, numbers rounded to 3 decimals
- [Phase 1 P05] Static export live: output 'export' unconditional, NEXT_PUBLIC_BASE_PATH validated sub-path, / is a client location.replace redirect keeping query+hash; 30 frozen DOM goldens pass unchanged on serve out (60/60, no golden touched); capture page-weight baseline from a root build (basePath build reports different route sizes)
- [Phase 1 P06] Page-weight budget: baseline perf/page-weight.baseline.json from a root build (/ and /numogram/ bytes raw+gzip, 30 golden DOM counts 6405 total), tolerance max(1 KiB, 5%) bytes and max(2, 2%) nodes stored in the file; raising it only via update --reason (history ledger); check reads counts from the frozen goldens, no browser
- [Phase 1] Branding scrub (user order, 2026-09-25): removed the "(c) qliphoth.systems / delight nexus" footer text, the upstream logo and Aleph0.svg (new original `public/ccrug-mark.svg`, also the favicon), the "Numogram" wordmarks (now "CCRUG"), and the whole inherited gematria plugin with its build:plugin/build:plugin-zip scripts, scripts/build-plugin-zip.mjs and the fflate dependency (this supersedes the plugin-ZIP part of 01-06). Attribution to lumpenspace/ccru in README + NOTICE is kept on purpose. Goldens unaffected (they capture only the projection svg): 60/60 + static-export 68/68 + sub-path 8/8 green.
- [Phase 1 P06] Dormant CI ci.yml (ubuntu+windows, read-only token, calls npm run verify; verify needs scripts/check-repo.mjs from 01-08 to run end to end); plugin ZIP is fflate, sha256 e1370547... identical under UTC/Tokyo/New_York, written to gitignored artifacts/
- [Phase 1 P07] LICENSE is canonical MIT (holder foGledenalzi); NOTICE is authoritative on scope: only post-fork files (plus the original CCRUG mark) are MIT, every file inherited from upstream 7c38ad9 is not relicensed, and the five app/data lore files are excluded as CCRU-derived (header comment only, oracle and manifests unchanged)
- [Phase 1 P08] check-repo guard (12 checks, --only, --clean-tree, --static-out) with failing-input tests; static-out forbids Vercel markers, api/share-image and the old upstream branding case-insensitively (user scrub order); pre-mutation run failed with 61 junk problems, post-mutation and npm run verify green (68 e2e, 60 goldens unchanged, 122 s); hygiene commit = 61 deletions (dist/ untracked and kept on disk, yarn.lock, 2 .DS_Store), remotes asserted already final, nothing pushed; Task 3 (LICENSE holder foGledenalzi and NOTICE scope) confirmed by the user on 2026-09-25
- [Todo 001] UI declutter done (2026-09-26): CRT overlays, glitch effects, route-transition provider and intro splash removed, panel chrome flattened; no control, readout or behaviour changed (before/after inventory in .planning/notes/2026-09-25-ui-declutter-inventory.md); 60 goldens unchanged; WR-01 closed by a new sub-path click test; page-weight baseline lowered
- [Phase 2 P01] Engine numeral scheme (D-05, Phase 4 contract): base 2..36 = one lowercase char per digit (0-9a-z), base 37..2^26 = decimal digit groups joined by '.' ('1.0.1' = 3601 in base 60), minDigits pads with zero digits, parseNumeral is the exact inverse (text 1..64 chars, value <= MAX_SAFE_INTEGER, linear loop); numerals take any integer base 2..2^26, numograms only even bases via validateBase/assertBase (RangeError, ceiling 2^26); torqueLabel = A..Z then i+1; engine/core/types.ts holds the contracts (02-05 adds Numogram.demons, 02-06 adds DemonSpace.group/subtype)
- [Phase 2 P02] Independent oracle: the definitions-only reference lives in tests/bruteforce/ (never tests/reference/, which the unanchored reference/ ignore rule would hide), imports nothing from engine/, does no file access and uses none of the engine closed forms (running-sum cumulation, iterated in-base digit sums, enumeration-counter mesh, non-permutation-assuming cycle walk); exports refStructure/refDigits/refDigitSumRoot/refClassify/refDemons/refSubtypeCounts (refSubtypeCounts(2000) about 6.4 ms). New frozen fixture engine/test/fixtures/derived/notable-bases.golden.json (17 bases 2..100 in full, digests for 256/666/1000/1024) under its own strict manifest engine/test/fixtures/derived/MANIFEST.json (set 2026-09-26-notable-bases); the older manifests are untouched; check-repo registration of the new manifest waits for 02-07
- [Phase 2 P03] Frozen behaviour and text baseline of the pre-swap viewer (D-15): e2e/__behaviour__/{original,labyrinth,ladder,planetary,mobile}.json captured once from the untouched viewer (app/ identical to f7d6689), sha256 in e2e/__behaviour__/MANIFEST.json (set 2026-09-26-behaviour-baseline, freeze commit b82f6a2), registered in check-repo MANIFESTS and LF_DIRS; text/attribute/computed-style facts only (cross-OS, remedy = new dated set from a checkout of the baseline commit, never -u); the lore sweep clicks each Zones/Syzygies/Currents/Gates row and records the opened Selection item because hovering shows no lore; npm run test:swap = build + 60 goldens + behaviour + vitest; not covered: demon names/kinds (DemonInfo needs a canvas hover or pin)
- [Phase 2 P04] createNumogram(base) (engine/core/numogram.ts): frozen, cached (LRU 4 entries, 2^26 zones), five Int32Arrays (flow, pairCycle, first, length, offset) with per-cycle frozen views made on demand (compare by id; only Plex and Warp are shared objects), canonical order by a stable counting sort; numogramInternals is for engine siblings and not in the barrel; proven equal to the independent reference for every even n 2..2000 (0.63 s), the frozen base-10 oracle and the notable-bases fixture, five mutants killed; D-11: the 2^26 test stays in npm run verify (measured about 0.62 s, +302 MiB of array buffers, 1,290,872 cycles; no test:heavy); the fixture's current.from is viewer data (the pair's even member, the Plex drawn at 9), not engine data
- [Phase 2 P05] Virtual demon space (engine/core/demons.ts, `g.demons`): mesh = a(a-1)/2 + b is inverted exactly up to 2^26 by a float square-root ESTIMATE (clamped to >= 1) plus two integer correction loops, no BigInt; on V8 the bare estimate is exact for every row, so a test that replaces Math.sqrt with a wrong one is what pins the loops; explicit cross-torque-chrono subtype (cyclic = same Torque cycle only), closed-form counts over the Torque cycles (base 28 = 378 with 108 cross-Torque), Numodemons n/2 - 1 with numodemons() in b-ascending (mesh-descending) order; frozen DemonRef values built per call, no per-demon storage (+0.0 MiB of array buffers for the 2^26 queries); proven against the reference for every demon of every even n <= 300 (2,261,225 demons), brute-force counts for every even n <= 2000, twelve sampled bases to 2^20, the frozen base-10 oracle (45 demons in mesh order, viewer kinds) and the notable-bases fixture; sweeps also tally the classifier itself because the viewer kinds and the fixture counts alone cannot see a cyclic/cross swap; group()/subtype() unranking is 02-06
- [Phase 2 P06] Demon unranking (engine/core/unrank.ts): `g.demons.group(type)` / `subtype(subtype)` return frozen memoized `{ count, at(k) }` in ascending mesh order; at(k) is a binary search over mesh numbers (about 51 steps) with a closed-form countBelow(m) = demons in the rows below a plus the partial row, from the at most 4 non-Torque zones (plex/warp/torque zone counts), exact through netSpanOf, no BigInt; only cyclic-chrono and cross-torque-chrono use per-cycle binary searches (O(K log n) per step) over a lazily built sorted copy of the Torque pair ids (WeakMap keyed by the numogram's internals, about 0.2 s and 128 MiB at 2^26, never built by any other selector); measured 0.01-0.03 ms per rank for every other selector at any base to 2^26, cyclic/cross about 0.1 ms at n=1024, 2 ms at 65,536, 30 ms at 2^20, 2 s at 2^26; proven against the reference for every rank of every even n <= 64, fixed-seed samples to 300, 666 (14 Torque cycles) and 1024 (54), rank/partition identities (type ranks and subtype ranks of a mesh sum to the mesh) to about 10^6, the exact 2^26 end points (2::1 .. 67108862::67108861, 33554432::33554431, xeno 22369621::0, +0.0 MiB), 13 mutants killed
- [Phase 2 P07] Lore consolidation (D-06, D-07, D-16): all CCRU-derived base-10 lore lives in app/presets/base10/lore.ts (typed, licence header on line 1, keyed by zone, pair id = low zone, gate origin zone and mesh number: ZONE_CLR, ZONE_PARTICLE, PLANET_SYMBOL, ZONE_META, SYZYGY_LORE, CURRENT_LORE, GATE_LORE, DEMON_NAMES), text moved mechanically and proven identical (757 fields deep-equal, 240 of 241 raw string literals equal with every unicode escape kept, 0 differences); app/data/{zones,syzygies,currents,gates,demons}.ts are structure seams that read text by id (same exports and order; the unimported string-keyed DEMON_NAMES is gone from demons.ts; current labels stay literal); NOTICE section 3, LORE_FILES, the derived manifest in MANIFESTS and the check-repo tests changed in one commit; coverage test against the createNumogram(10) ids (no missing or orphaned key); 60 goldens, behaviour baseline and numeric oracle unchanged, npm run verify exit 0 in 251 s; gotcha for the swaps: the file-write tool decodes typed unicode escapes into raw characters, so never type them, use a script and check the bytes
- [Phase 2 P08] Swap 1 (syzygies, D-02): app/presets/base10/numogram.ts exports BASE10 = createNumogram(10) (one Torque cycle and a Warp checked at load, the only file that imports the engine) and app/presets/base10/syzygies.ts builds SYZYGIES from BASE10.pair(id) (ids descending, a = lo, b = hi) joined with SYZYGY_LORE by pair id; app/data/syzygies.ts is now a two-line seam (comment and re-export, same array object) and the hand structure is deleted (D-08) in a separate commit after the full gate was green on the committed swap; strict deep-equality against git show f7d6689:app/data/syzygies.ts: 26 nodes, 20 primitive fields, 0 differences, key order a, b, demon, desc; adapter test also asserts no lore text in any adapter file; pre-flight, post-swap and final npm run verify all exit 0 (250 s, 249 s, 249 s), 60 goldens, behaviour baseline and numeric oracle unchanged; page-weight not updated: /numogram/ grew +16,059 bytes raw and +4,666 gzip (inside the max(1 KiB, 5%) tolerance), about 12.1 KB raw and 3.9 KB gzip of headroom left for swaps 02-09..02-12

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: RESOLVED in 01-05: the static export builds (`next build` exit 0) and the client redirect is proven at the root and under `/ccrug`
- [Phase 1]: RESOLVED: Windows specifics verified (`process.env.TZ` runtime pin and canary in 01-01, Vite 8 with Vitest 5 runs green, fflate plugin ZIP sha256 identical under UTC / Asia/Tokyo / America/New_York in 01-06)
- [Phase 1]: RESOLVED in 01-07: LICENSE and NOTICE exist and the five lore files are marked CCRU-derived (prose provenance recorded, text unchanged). Confirmed by the user on 2026-09-25 at the 01-08 Task 3 checkpoint: LICENSE holder `foGledenalzi` and the NOTICE scope as written. The remotes were already set (origin = foGledenalzi/CCRUGen, upstream push disabled); 01-08 only asserted them.
- [Phase 3]: Renderer thresholds are unmeasured (research figures conflict); Phases 4-6 wait on the spike's threshold table
- [Phase 3]: Aesthetic choices need the user: flow direction, Plex placement, default label case
- [Phase 4]: Label scheme beyond base 36 needs a decision plus font/glyph coverage tests
- [Phase 6]: Worker chunk loading in an exported site with `trailingSlash` and `basePath` is unverified
- [Phase 7]: Naming generator quality and demon-name collisions at scale need prototyping
- [Phase 8]: Safari canvas-area limit and SVG-as-image font behavior rest on secondary sources

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | CMP-01, CMP-02 two-base comparison and base atlas | Deferred | Requirements 2026-09-25 |
| v2 | EXP-05 poster-quality SVG | Deferred | Requirements 2026-09-25 |
| v2 | FLW-01 flow tracer | Deferred | Requirements 2026-09-25 |
| v2 | UPG-01 Next.js major upgrade | Deferred | Requirements 2026-09-25 |

## Session Continuity

Last session: 2026-09-27T00:50:00.000Z
Stopped at: Completed 02-08-PLAN.md
Resume file: .planning/phases/02-engine-core-and-base-10-migration/02-09-PLAN.md

**Planned Phase:** 2 (Engine Core and Base-10 Migration) — 13 plans — 2026-09-26T15:32:00Z

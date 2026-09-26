---
phase: 2
slug: engine-core-and-base-10-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Written by the orchestrator from 02-CONTEXT.md (decisions D-01..D-16) because research was skipped by request; the math is verified in `.planning/research/` and the oracle tooling already exists from Phase 1.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (node env; `test.projects`: `engine` = `engine/**/*.test.ts`, `oracle` = `tests/**/*.test.ts`) + fast-check 4.10.2 (fixed seeds) + Playwright 1.63.0 (Chromium, projects `chromium-utc` and `chromium-ny`) |
| **Config files** | `vitest.config.mts`, `playwright.config.ts`, `engine/tsconfig.json`, `engine/tsconfig.test.json`, `.eslintrc.json` (all exist from Phase 1) |
| **Quick run command** | `npx vitest run --project engine` (engine unit + property + sweep tests) |
| **Full suite command** | `MSYS_NO_PATHCONV=1 npm run verify` (repo guard, typecheck, vitest in UTC and America/New_York, sub-path e2e, build, page weight, e2e incl. the 60 DOM goldens, clean-tree/static-out guard) |
| **Estimated runtime** | quick ~5-20 s (the tiered sweeps of D-09 must fit); migration-swap gate ~1-2 min (`npm run build` + goldens + behaviour baseline); full verify ~3 min |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --project engine` (+ `npm run typecheck` when TS or config changed)
- **After every data-source swap (D-02):** `npm run build`, then `npx playwright test e2e/golden.spec.ts` (60 comparisons, no `-u`), the numeric oracle (`npx vitest run --project oracle`) and the behaviour-baseline check (D-15); the old hand data for that source is deleted only after all are green
- **After every plan wave:** `npm run test && npm run test:tz && npm run typecheck`
- **Before `/gsd-verify-work`:** full `npm run verify` green, `git status --porcelain -- e2e/__golden__ engine/test/fixtures` empty
- **Max feedback latency:** 30 s for the per-task quick run

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is the requirement-level contract each task must map into.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| ENG-01 | For every even n, zones, syzygy pairs (hi::lo, sum n-1), currents (pair to hi-lo), gates (k to in-base digital root of T(k), T(0) to 0) equal an independent brute-force reference built from definitions | unit + property + sweep | `npx vitest run --project engine` | ❌ W0 | ⬜ pending |
| ENG-02 | Plex always; Warp iff n = 3o+1 with o odd; Torque cycles in canonical order (length descending, then smallest zone id; rotated to smallest pair), reported as pairs and zones; base 16 = [4,2], 28 = [9,3], 80 = [39], 82 = [27,9,3]; base-12 example | unit + sweep (every even n <= 2000) | `npx vitest run --project engine` | ❌ W0 | ⬜ pending |
| ENG-03 | Demons virtual: mesh <-> net-span a::b round trip in O(1); type and subtype classification incl. explicit cross-Torque chronodemon; closed-form counts sum to C(n,2); Numodemons n/2 - 1; base 28 = 378 demons of which 108 cross-Torque chrono; base 10 = 12+3 chrono, 12+12 amphi, 4+2 xeno | unit + property (fixed seeds) + brute force (every even n <= 300) | `npx vitest run --project engine` | ❌ W0 | ⬜ pending |
| ENG-04 | Base-10 engine output equals the frozen numeric oracle (`base10.golden.json`, Gt-15 = 5->6, Gt-03 = 2->3, 45 demons); odd, zero, negative, non-integer, NaN, Infinity and > 2^26 rejected with `RangeError`; `validateBase(n)` returns the reason without throwing | unit | `npx vitest run --project oracle --project engine` | ❌ W0 | ⬜ pending |
| ENG-05 | Base 2^26 builds zones, pairs and cycles with no O(n^2) structure, within an explicit time and memory ceiling; bases above the ceiling refused | perf/unit (runs in verify per D-11; falls back to opt-in `test:heavy` only if measured too heavy for CI) | `npx vitest run --project engine` | ❌ W0 | ⬜ pending |
| ENG-01/ENG-03 (numerals) | `formatNumeral`/parse round trip in every base up to the beyond-36 scheme; `Gt-56` for zone 11 in base 12; identical to today's names at base 10 | unit + property | `npx vitest run --project engine` | ❌ W0 | ⬜ pending |
| MIG-01 | Viewer's syzygies, currents, gates, demons, regions come from engine + lore (adapter, D-01); 60 DOM goldens byte-identical after every swap; behaviour and text baseline (D-15) identical; every engine base-10 id has lore and no lore entry is orphaned | e2e + unit | `npm run build && npx playwright test e2e/golden.spec.ts`; behaviour check (planner names the command); `npx vitest run --project oracle` | ❌ W0 | ⬜ pending |
| MIG-01 (guards) | Lore consolidation keeps `check-repo` green: NOTICE section 3, the lore header and `scripts/check-repo.mjs` + its tests updated together (D-16) | script + unit | `node scripts/check-repo.mjs && npx vitest run --project oracle` | ✅ (needs update) | ⬜ pending |
| Boundary | Engine stays pure: no DOM/Node types, relative imports only, nothing imported from outside `engine/` | typecheck + lint | `npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Independent brute-force reference module (from the definitions, sharing no formula code with the engine), used by the tiered sweeps (D-09): full enumeration incl. demons for every even n <= 300; structural brute force for every even n <= 2000
- [ ] Engine test files under `engine/test/` and fixed-seed fast-check settings (seed and run counts written in the tests, D-10)
- [ ] Behaviour and text baseline (D-15): the seed `.planning/phases/02-engine-core-and-base-10-migration/seed/inventory.mjs` turned into a committed, parametrized check plus a frozen baseline captured from the current viewer BEFORE the first swap, protected like the other oracles (manifest set, never regenerated to make a test pass)
- [ ] New frozen fixtures (for example the base-12/16/28/80/82 facts) derived from definitions, added without touching the existing frozen sets

---

## Manual-Only Verifications

All phase behaviors have automated verification. (A human glance at the served viewer after the last swap is welcome but not required: the DOM goldens and the behaviour baseline are the contract.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s for the quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

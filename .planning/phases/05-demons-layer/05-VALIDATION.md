---
phase: 5
slug: demons-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (unit/adapter tests) + Playwright 1.63.0 (e2e) |
| **Config file** | `vitest.config.mts` (unit); Playwright config implied by existing `e2e/*.spec.ts` + `test:e2e` script |
| **Quick run command** | `cross-env CCRUG_TZ=UTC vitest run tests/app/<new-file>.test.ts` |
| **Full suite command** | `npm run verify` |
| **Estimated runtime** | ~4-5 minutes (project's existing full gate) |

---

## Sampling Rate

- **After every task commit:** Run `cross-env CCRUG_TZ=UTC vitest run <touched test files>`
- **After every plan wave:** Run `npm run typecheck && cross-env CCRUG_TZ=UTC vitest run && npm run test:e2e`
- **Before `/gsd-verify-work`:** Full suite (`npm run verify`) must be green
- **Max feedback latency:** ~10 seconds for unit tests, ~30-60s for the touched e2e spec

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-XX-XX | TBD | TBD | DEM-01 | T-05-XX | Base 28 facet counts equal 378 chrono / 108 cross-Torque-chrono, matching `g.demons.typeCounts()`/`counts()` directly | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonFacets.test.ts` | ❌ W0 | ⬜ pending |
| 05-XX-XX | TBD | TBD | DEM-02 | T-05-XX | `DemonRowSource` for `g.demons`/`group()`/`subtype()` returns correct `count`/`at(k)`; `rankOfMesh` binary search matches linear scan; sort-direction index reversal correct at both ends | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonBrowserSource.test.ts` | ❌ W0 | ⬜ pending |
| 05-XX-XX | TBD | TBD | DEM-02 | T-05-XX | Base 666 browser scrolls without materializing all rows; search jumps to the correct row under an active facet | e2e | `playwright test e2e/demons-browser.spec.ts` | ❌ W0 | ⬜ pending |
| 05-XX-XX | TBD | TBD | DEM-03 | T-05-XX | Clicking a zone shows n-1 chords; clicking a demon row highlights its two zones; both directions round-trip | e2e | `playwright test e2e/demons-focus.spec.ts` | ❌ W0 | ⬜ pending |
| 05-XX-XX | TBD | TBD | DEM-04 | T-05-XX | Matrix hover/click at multiple zoom levels resolves the exact same `a::b`/mesh/type `g.demons.ref(a,b)` would give directly, regardless of raster LOD | unit + e2e | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonMatrix.test.ts` + `playwright test e2e/demons-matrix.spec.ts` | ❌ W0 | ⬜ pending |
| 05-XX-XX | TBD | TBD | DEM-05 | T-05-XX | Base 10 browser/detail panel shows all 45 canonical names; every other base's name column is present but empty | unit | `cross-env CCRUG_TZ=UTC vitest run tests/app/demonNames.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan/Wave/Task IDs and threat refs are TBD here — the planner fills these in once PLAN.md files exist and threat_model blocks assign T-05-NN ids.*

---

## Wave 0 Requirements

- [ ] `tests/app/demonFacets.test.ts` — DEM-01 closed-form facet display logic
- [ ] `tests/app/demonBrowserSource.test.ts` — DEM-02 `DemonRowSource`/`rankOfMesh`/sort-reversal adapter logic
- [ ] `tests/app/demonMatrix.test.ts` — DEM-04 `cellAtPixel`/exact-resolve logic
- [ ] `tests/app/demonNames.test.ts` — DEM-05 name join
- [ ] `e2e/demons-browser.spec.ts`, `e2e/demons-focus.spec.ts`, `e2e/demons-matrix.spec.ts` — end-to-end coverage of DEM-02/03/04 interaction
- [ ] Dependency install: `npm install @tanstack/react-virtual` (no test-framework install needed — Vitest/Playwright already present)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the map above. The matrix LOD's exact visual tiling parameters (panel size, supersampling) are flagged in 05-RESEARCH.md as needing a planning-time prototype spike, but correctness (exact-resolve regardless of LOD) is automatable via the unit+e2e pair above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

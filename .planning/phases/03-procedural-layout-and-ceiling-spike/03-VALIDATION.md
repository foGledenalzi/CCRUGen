---
phase: 3
slug: procedural-layout-and-ceiling-spike
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Transcribed by the orchestrator from `03-RESEARCH.md`'s "Validation Architecture" section (research was run for this phase); the layout formulas, preset-equality proof and ceiling-spike numbers behind these tests were verified against the Phase 2 engine and the frozen oracles during research, not merely asserted.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2, two existing projects: `engine` (`engine/**/*.test.ts`) and `oracle` (`tests/**/*.test.ts`) — unchanged config |
| **Config file** | `vitest.config.mts` (existing, not modified by this phase) |
| **Quick run command** | `npx cross-env CCRUG_TZ=UTC vitest run engine/test/layout.*.test.ts` (the new layout test files this phase adds) |
| **Full suite command** | `MSYS_NO_PATHCONV=1 npm run verify` (repo guard, typecheck, unit tests in two timezones, sub-path e2e, build, page-weight budget, e2e incl. the 60 DOM goldens, clean-tree/static-out guard) |
| **Estimated runtime** | quick ~5-15 s; full verify ~4.5 min (per RESEARCH.md's measurement, slightly up from Phase 2's ~4.3 min once layout tests are added) |

---

## Sampling Rate

- **After every task commit:** the relevant `vitest run engine/test/layout.*.test.ts` (or `tiers.*.test.ts`) file(s) for the module just written
- **After every plan wave:** `npm run test && npm run test:tz && npm run typecheck`
- **Before `/gsd-verify-work`:** full `npm run verify` green, plus the human contact-sheet sign-off (D-10)
- **Max feedback latency:** 30 s for the per-task quick run
- **Never in `npm run verify`:** the ceiling-spike driver itself (`scripts/spike/*`) — it launches real browsers with CPU-throttle CDP sessions across four device profiles and takes several minutes; it is run manually and its output is committed as static data, re-generated only by deliberately re-running it

---

## Per-Task Verification Map

Task IDs, plans and waves are assigned by the planner; this table is the requirement-level contract each task must map into (transcribed from `03-RESEARCH.md`'s Validation Architecture, "Phase Requirements -> Test Map").

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|--------------------|-------------|--------|
| LAY-01 | Every even base 2..400 (plus notable large bases) gives a deterministic ring layout with adjacent syzygies, correct odd/even alternation, current landing on the next odd zone, anticlockwise angle step, and no overlap/clip | unit (sweep) | `vitest run engine/test/layout.ring.test.ts -t "sweep even bases"` | ❌ W0 | ⬜ pending |
| LAY-01 | Two independent runs of `ringLayout`/`ladderLayout`/`spiralLayout`/`pairGraphLayout` in the same process, and under `CCRUG_TZ=America/New_York`, produce identical typed arrays | unit | `vitest run engine/test/layout.determinism.test.ts` | ❌ W0 | ⬜ pending |
| LAY-01 | Degenerate bases 2, 4, 6 give finite, unclipped coordinates and no `NaN`/`Infinity` in any emitted route string | unit | `vitest run engine/test/layout.degenerate.test.ts` | ❌ W0 | ⬜ pending |
| LAY-02 | Base-10 preset layouts equal `engine/test/fixtures/base10.golden.json` (`layouts`, `center`, `planetary`) exactly | unit (oracle) | `vitest run tests/presets/base10-layouts.test.ts -t "numeric oracle"` | ❌ W0 (extends existing `tests/oracle/base10.oracle.test.ts` pattern) | ⬜ pending |
| LAY-02 | Base-10 preset draw order, coordinates, region-label position/size/opacity and frame height equal what the frozen DOM goldens encode (parsed independently, never re-rendered) | unit | `vitest run tests/presets/base10-layouts.test.ts -t "DOM golden parity"` | ❌ W0 | ⬜ pending |
| LAY-02 | The full gate proves the viewer itself is unaffected by the new `app/presets/base10/layouts.ts` seam | e2e (existing, replayed) | `npm run test:swap` then `npm run verify` | ✅ (existing suites, unmodified) | ⬜ pending |
| LAY-03 | Node radius, label size and stroke scale are monotonic non-increasing functions of the frame's growth factor; no review-sheet base has an on-screen node radius of 0 or overlapping labels at fit scale | unit + visual (human) | `vitest run engine/test/layout.sizing.test.ts` (unit invariants); HTML contact sheet (human, D-10) for the visual judgement | ❌ W0 (unit) | ⬜ pending |
| LAY-04 | Pair-graph layout: every Torque cycle's pair-nodes lie on one circle, equal angular steps, anticlockwise, arrows follow `nextPair`, for all even n <= 400 including base 64 (six rings) | unit (sweep) | `vitest run engine/test/layout.pairgraph.test.ts` | ❌ W0 | ⬜ pending |
| REN-01 | The tier table is schema-valid: monotonic n per series, every `boundaries.*.basedOn` references a declared environment, `canvasAreaLimitPx > 0`, `tierOverrideParam.enabled === true`, `webglDecision.adopt === false` is accompanied by a non-empty `reason` | unit | `vitest run engine/test/tiers.schema.test.ts` | ❌ W0 | ⬜ pending |
| REN-01 | `selectTier` respects an explicit `?tier=` override (D-13) regardless of table contents, and falls through svg -> canvas -> headless in n order | unit | `vitest run engine/test/tiers.select.test.ts` | ❌ W0 | ⬜ pending |
| REN-01 | Shipped/default tier boundaries are read from the conservative `sw-6x` (low-tier, CPU-throttled) profile row per D-14, while native (`gpu`) rows stay in the table for reference | unit | `vitest run engine/test/tiers.schema.test.ts -t "conservative boundary source"` | ❌ W0 | ⬜ pending |
| REN-01 | The measured spike data (raw JSON) is **not** re-run inside `npm run verify`; it is committed as static data and re-generated only by deliberately re-running `scripts/spike/*` | n/a (by design) | — | n/a | n/a |
| Boundary | `engine/` stays pure: layout modules have no DOM/Node types, relative imports only; `app/presets/base10/layouts.ts` imports engine layout **types only** (Pitfall 1: full layout/routing/emitter code is ~19.8 KB minified against ~11 KB of remaining page-weight headroom) | typecheck + budget | `npm run typecheck && npm run build` (page-weight budget check) | ✅ (existing guard) | ⬜ pending |
| Security (SVG escaping) | Any free-text label interpolated into an emitted SVG/HTML string (contact sheet, future export) is HTML-escaped (`&`, `<`, `"`, `>`) before interpolation | unit | `vitest run engine/test/scene.svgString.test.ts -t "escapes"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `engine/layout/{types,params,format,ring,pack,ladder,spiral,routing,registry}.ts` — none exist yet; this phase's first wave creates them
- [ ] `engine/scene/{svgString,tiers}.ts` — none exist yet
- [ ] `engine/test/layout.*.test.ts`, `engine/test/tiers.*.test.ts`, `engine/test/scene.svgString.test.ts` — no test files yet for any of the above
- [ ] `tests/presets/base10-layouts.test.ts` — new file; reuses the DOM-golden-parsing helper prototyped in research (verified in that session to correctly recover draw order, coordinates and region labels from the three frozen golden files)
- [ ] `scripts/review-sheet.ts`, `scripts/spike/*.ts` — dev-only, not covered by `npm run verify`, but should get a smoke test that the review-sheet script runs and produces valid, non-empty, deterministic (same sha256 twice) output — `tests/presets/review-sheet.smoke.test.ts` or similar
- [ ] `.gitignore` additions: `/.review/`, `/.spike/`

*There is no existing test infrastructure for layout/rendering because Phase 3 is the first phase to introduce this code — every item above is net-new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|-------------|--------------------|
| Visual sign-off of generated ring/ladder/spiral/pair-graph layouts across bases 2, 4, 6, 8, 12, 16, 28, 64, 82, 100 | LAY-01, LAY-03, LAY-04 | Legibility and aesthetic packing quality are judged by eye, not assertable by a unit test (D-10) | Run `scripts/review-sheet.ts`; open the generated self-contained, zoomable HTML/SVG contact sheet; confirm every base reads cleanly at fit scale and the packed-ring vs Barker-spiral options both look reasonable |
| Ceiling-spike threshold table plausibility | REN-01 | The numbers are real measurements on one machine (D-11/D-14), not a property a unit test can derive; a human should sanity-check the table before it ships as the app's default tier boundaries | Read `engine/scene/tiers.ts`'s committed data plus its environment metadata; confirm the shipped/default boundaries come from the conservative (`sw-6x`) row, not the native (`gpu`) row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s for the quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

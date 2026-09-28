---
phase: 4
slug: base-picker-and-generator-ui
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Transcribed by the orchestrator from `04-RESEARCH.md`'s "Validation Architecture" section (research was run for this phase); the row-click bug, the `Region` type's cardinality mismatch with base 64's six Torque cycles, and the `plexExpr` decimal-digit-sum bug were all confirmed by reading source, not asserted.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | Vitest 5.0.2 |
| **Framework (e2e)** | `@playwright/test` 1.63.0, Chromium only |
| **Config files** | `vitest.config.mts` (unit, both timezones via `CCRUG_TZ`), `playwright.config.ts` (e2e) — both existing, unmodified by this phase |
| **Quick run command (unit)** | `npx vitest run <path-to-new-test-file>` |
| **Quick run command (e2e)** | `npx playwright test e2e/<new-file>.spec.ts` |
| **Full suite command** | `MSYS_NO_PATHCONV=1 npm run verify` (~4-4.5 min: check-repo, typecheck, vitest x2 timezones, sub-path e2e, build, page-weight, full e2e incl. the 60 DOM goldens, clean-tree/static-out guard) |

No accessibility-audit tool (`axe-core`, `@axe-core/playwright`, `jest-axe`) is installed, and none is added by this phase — the formal accessibility-audit gate is Phase 8 (HRD-01). Phase 4 builds the actual UI-07 features (keyboard traversal, ARIA, reduced-motion, text view) and tests them with targeted Playwright assertions against the accessibility tree (`getByRole`, keyboard-driven focus assertions, `page.emulateMedia`).

Every existing e2e spec (`e2e/golden.spec.ts`, `e2e/behaviour.spec.ts`, `e2e/static-export.spec.ts`) is base-10-only and pre-dates this phase — they are the frozen oracles this phase's generalization work (`Projection.tsx`, `NumogramClient.tsx`) is most at risk of silently breaking, so they are sampled aggressively (see Sampling Rate) rather than only at the phase gate.

---

## Sampling Rate

- **After every task commit:** the relevant quick-run unit test file for the module just written; additionally, for any task touching `Projection.tsx`, `NumogramClient.tsx`, or a panel component, run `npx playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` immediately to catch a base-10 regression before it compounds.
- **After every plan wave:** `npm run test` (a single timezone is sufficient mid-wave; both timezones is a `verify`-only requirement) plus whatever new Phase 4 e2e spec files exist so far.
- **Before `/gsd-verify-work`:** full `MSYS_NO_PATHCONV=1 npm run verify` green (both timezones, 60 goldens, behaviour baseline, the new MIG-02 grep gate, and the new smoke-bases sweep).
- **Max feedback latency:** 30 s for the per-task quick run.

---

## Per-Task Verification Map

Task IDs, plans and waves are assigned by the planner; this table is the requirement-level contract each task must map into (transcribed from `04-RESEARCH.md`'s Validation Architecture, "Phase Requirements → Test Map").

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|--------------------|-------------|--------|
| UI-01 | Typing/stepping/sliding/clicking a chip changes the base; odd input refused with a message next to the picker; live summary matches engine output (e.g. base 28 → 28 zones, cycles [9,3], 378 demons) | unit + e2e | `npx vitest run app/components/numogram/BasePicker.test.tsx`; `npx playwright test e2e/base-picker.spec.ts -g "base 28"` | ❌ W0 | ⬜ pending |
| UI-02 | `?base=28` reloads to the same view; `?base=` omitted still loads base 10 (back-compat); an absurd base is refused with a message, not a frozen tab | e2e | `npx playwright test e2e/url-codec.spec.ts` | ❌ W0 | ⬜ pending |
| UI-03 | Zone labels are in-base digits ≤ base 36, decimal-with-separator beyond; custom alphabet + xenotation modes render and round-trip through the URL; integer identity preserved in URL/JSON/demon keys | unit + e2e | `npx vitest run app/lib/customAlphabet.test.ts`; `npx playwright test e2e/label-scheme.spec.ts` | ❌ W0 | ⬜ pending |
| UI-04 | Hover/pin a zone/syzygy/current/gate highlights it and opens the detail panel, at a non-base-10 base | e2e | `npx playwright test e2e/hover-pin.spec.ts -g "base 28"` | ❌ W0 (existing `behaviour.spec.ts` only covers base 10) | ⬜ pending |
| UI-05 | Region legend lists Plex, Warp, every Torque cycle (e.g. 6 rows at base 64) with a stable id; isolate and mute are independent, multi-select, apply uniformly to all rows | unit + e2e | `npx vitest run app/components/panels/RegionsPanel.test.tsx`; `npx playwright test e2e/region-legend.spec.ts -g "base 64"` | ❌ W0 | ⬜ pending |
| UI-06 | Layer toggles show/hide the right elements; zoom/pan/fit work at a generated base | e2e | `npx playwright test e2e/layers-zoom.spec.ts` | ❌ W0 (no existing test for `useCanvasPan.ts`) | ⬜ pending |
| UI-07 | Keyboard-only traversal reaches every zone/syzygy/current/gate; ARIA labels present; reduced-motion skips the tween; text view renders and its copy button works | e2e | `npx playwright test e2e/accessibility.spec.ts` (real `page.keyboard`, `page.emulateMedia({ reducedMotion: 'reduce' })`) | ❌ W0 | ⬜ pending |
| UI-08 | Switching base clears selection, undo/redo stacks, and any in-flight tween/animation | unit + e2e | a `HistorySnapshot`-reset unit test; `npx playwright test e2e/base-switch-reset.spec.ts` | ❌ W0 | ⬜ pending |
| MIG-02 | CI grep gate finds none of the named hard-coded-10 patterns (`9 - z`, `[1, 2, 4, 5, 7, 8]`, `n <= 9`) outside `app/presets/base10/**`; bases 2-40 smoke-render with no NaN/undefined | static + e2e | a new gate function in `node scripts/check-repo.mjs` (with a failing-input test, matching the project's own convention); `npx playwright test e2e/smoke-bases.spec.ts` (loop `?base=2..40` step 2) | ❌ W0 (both new) | ⬜ pending |
| Todo 003 | Real mouse click (`page.mouse.down()`/`up()`, not `.click()`) on a Zones/Syzygies/Currents/Gates row selects the row, first failing on current code (confirmed root cause: inline `ItemDisplayComponent` remounts on `onMouseDownCapture` before mouseup lands) | e2e | `npx playwright test e2e/row-click-regression.spec.ts` | ❌ W0 | ⬜ pending |
| Boundary | Base-10 stays byte-identical: the 60 DOM goldens and the behaviour/text baseline pass unchanged after every generalization change to `Projection.tsx`/`NumogramClient.tsx`/panels | e2e (existing, replayed) | `npx playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` | ✅ (existing suites, unmodified) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/base-picker.spec.ts` — UI-01
- [ ] `e2e/url-codec.spec.ts` — UI-02
- [ ] `app/lib/customAlphabet.test.ts` + `e2e/label-scheme.spec.ts` — UI-03
- [ ] `e2e/hover-pin.spec.ts` — UI-04 at a non-base-10 base
- [ ] `app/components/panels/RegionsPanel.test.tsx` + `e2e/region-legend.spec.ts` — UI-05
- [ ] `e2e/layers-zoom.spec.ts` — UI-06
- [ ] `e2e/accessibility.spec.ts` — UI-07
- [ ] A base-switch-sanitation unit test + `e2e/base-switch-reset.spec.ts` — UI-08
- [ ] A new MIG-02 grep-gate function inside `scripts/check-repo.mjs` (with a failing-input test) + `e2e/smoke-bases.spec.ts` — MIG-02
- [ ] `e2e/row-click-regression.spec.ts` — todo 003, using real `page.mouse` events, first failing on current code

*No framework install needed — Vitest and Playwright are already configured; only new spec/test files are missing.*

---

## Manual-Only Verifications

All phase behaviors have automated verification. (A human glance at the live picker/legend/label-scheme controls is welcome given `UI hint: yes`, but the DOM goldens, behaviour baseline, and the new Phase 4 e2e specs are the contract — see the UI Design Contract Gate decision recorded separately for this phase.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s for the quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

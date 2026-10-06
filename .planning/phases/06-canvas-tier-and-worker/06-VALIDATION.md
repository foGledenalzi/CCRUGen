---
phase: 6
slug: canvas-tier-and-worker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `06-RESEARCH.md` section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (node env; projects `engine` = `engine/**/*.test.ts`, `oracle` = `tests/**/*.test.ts`) plus Playwright 1.63.0 (projects `chromium-utc`, `chromium-ny`) |
| **Config file** | `vitest.config.mts`, `playwright.config.ts` |
| **Quick run command** | `npx vitest run <file> --project oracle` (or `--project engine`); `npm run typecheck` when types or the worker directory change; `node scripts/check-repo.mjs --only base-ten` after each new `app/` module |
| **Full suite command** | `MSYS_NO_PATHCONV=1 npm run verify` |
| **Estimated runtime** | about 2 to 4 minutes for the full gate; about 10 seconds for a unit file; about 30 to 60 seconds for one e2e spec |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed test files>`, plus `node scripts/check-repo.mjs --only base-ten` for new `app/` code and `npm run typecheck` when types or `workers/` change
- **After every plan wave:** `npm run test` and `npm run test:swap` after any `NumogramClient.tsx` edit, plus the new e2e specs for that wave
- **Before `/gsd-verify-work`:** `MSYS_NO_PATHCONV=1 npm run verify` green; page-weight baseline raised only via `update --reason`
- **basePath coverage:** `npm run test:e2e:basepath` runs only `e2e/static-export.spec.ts`, so the sub-path worker proof must live in that file
- **Max feedback latency:** about 10 seconds (unit), 30 to 60 seconds (touched e2e spec)

Sampling bases: 10, 28, 64, 100, 200 (SVG tier, synchronous, unchanged); 28 and 64 with `?tier=canvas` (worker path at a small base, parity); 202 (first Canvas base); 666; 1024; 4000 (shipped ceiling); 4002 (first headless base); 65,536 and 2^20; 2^26 (worst case, stale result discarded); 27, 99999999999 and malformed values (existing refusals unchanged).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 06-01 | 1 | REN-02, REN-03 | T-06-07, T-06-01a | ceiling is data; validator rejects each bad interactiveMaxN | unit (engine) | `npx vitest run engine/test/tiers.select.test.ts engine/test/tiers.schema.test.ts --project engine` | extend existing | ⬜ pending |
| 06-01-T2 | 06-01 | 1 | REN-02, REN-03 | T-06-07b | shaper carries and clamps the ceiling; app reads it by property access | unit | `npx vitest run tests/spike/shape.test.ts tests/app/tierBounds.test.ts --project oracle` | extend existing | ⬜ pending |
| 06-02-T1 | 06-02 | 2 | REN-02 | T-06-15, T-06-13 | route parser whitelist; distinct buffers | unit (engine) | `npx vitest run engine/test/scene.canvasScene.test.ts --project engine` | Wave 0 (06-02) | ⬜ pending |
| 06-02-T2 | 06-02 | 2 | REN-02 | T-06-16 | pair scene; base mismatch rejected | unit (engine) | `npx vitest run engine/test/scene.canvasScene.test.ts --project engine` | Wave 0 (06-02) | ⬜ pending |
| 06-03-T1 | 06-03 | 1 | REN-02 | T-06-18 | Page keys clamp; no unbounded loop | unit | `npx vitest run tests/app/canvasKeyboard.test.ts --project oracle` | Wave 0 (06-03) | ⬜ pending |
| 06-03-T2 | 06-03 | 1 | REN-02 | T-06-17 | non-finite input ignored; immutable state | unit | `npx vitest run tests/app/canvasInteraction.test.ts --project oracle` | Wave 0 (06-03) | ⬜ pending |
| 06-04-T1 | 06-04 | 3 | REN-03 | T-06-14 | lore-free summary; text bounded by the ceiling | unit | `npx vitest run tests/app/numogramText.test.ts tests/app/numogramView.test.ts --project oracle` | extend existing | ⬜ pending |
| 06-04-T2 | 06-04 | 3 | REN-03 | T-06-01, T-06-08, T-06-13, T-06-14 | no scene above the ceiling; guarded protocol; lore-free import graph | unit | `npx vitest run tests/app/workerCore.test.ts tests/app/demonState.test.ts --project oracle` | Wave 0 (06-04) | ⬜ pending |
| 06-05-T1 | 06-05 | 3 | REN-02 | T-06-02 | backing store bounded by table area limit and DPR 3 | unit | `npx vitest run tests/app/canvasView.test.ts --project oracle` | Wave 0 (06-05) | ⬜ pending |
| 06-05-T2 | 06-05 | 3 | REN-02 | T-06-19 | 12 px nearest-wins pick equals brute force | unit (+ fast-check, mutants) | `npx vitest run tests/app/canvasPick.test.ts --project oracle` | Wave 0 (06-05) | ⬜ pending |
| 06-06-T1 | 06-06 | 2 | REN-02 | T-06-11 | first NumogramClient edit leaves the oracles unchanged | typecheck + oracle gate | `npm run typecheck && npm run test:swap` | existing | ⬜ pending |
| 06-06-T2 | 06-06 | 2 | REN-02 | T-06-20 | no 4000-row lists at the Canvas tier | SSR smoke | `npx vitest run tests/app/canvasPanelsRender.test.ts --project oracle` | Wave 0 (06-06) | ⬜ pending |
| 06-06-T3 | 06-06 | 2 | REN-02 | T-06-01b | Regions panel never forces the lazy numogram | SSR smoke + oracle gate | `npx vitest run tests/app/canvasPanelsRender.test.ts --project oracle && npm run test:swap` | Wave 0 (06-06) | ⬜ pending |
| 06-07-T1 | 06-07 | 4 | REN-03 | T-06-03, T-06-21, T-06-01c | latest-wins delivery; bounded queue; bounded fallback | unit (+ fast-check, mutants) | `npx vitest run tests/app/workerClient.test.ts --project oracle` | Wave 0 (06-07) | ⬜ pending |
| 06-07-T2 | 06-07 | 4 | REN-03 | T-06-04 | same-origin literal worker; no raw .ts in out/ | typecheck + build | `npm run typecheck && npx vitest run tests/app/workerClient.test.ts --project oracle && npm run build` | Wave 0 (06-07) | ⬜ pending |
| 06-08-T1 | 06-08 | 4 | REN-02 | T-06-05, T-06-22 | fillText only; no repaint per hover | unit (recording context) | `npx vitest run tests/app/canvasDraw.test.ts --project oracle` | Wave 0 (06-08) | ⬜ pending |
| 06-08-T2 | 06-08 | 4 | REN-02 | T-06-10 | fidelity downgrade bounds overlay cost | unit (recording context) | `npx vitest run tests/app/canvasDraw.test.ts --project oracle` | Wave 0 (06-08) | ⬜ pending |
| 06-09-T1 | 06-09 | 3 | REN-03 | T-06-23 | pending switch cannot be reverted by the picker | SSR smoke | `npx vitest run tests/app/basePickerRender.test.ts tests/app/basePicker.test.ts --project oracle` | Wave 0 (06-09) | ⬜ pending |
| 06-09-T2 | 06-09 | 3 | REN-02 | T-06-09 | Selection list O(k) and capped | unit | `npx vitest run tests/app/selectionList.test.ts --project oracle` | Wave 0 (06-09) | ⬜ pending |
| 06-09-T3 | 06-09 | 3 | REN-03 | T-06-01d | URL never builds a numogram above the ceiling (natural tier; override keeps codec behaviour) | unit (module spy) | `npx vitest run tests/app/shareParamsHeadless.test.ts tests/app/shareParams.test.ts --project oracle` | Wave 0 (06-09) | ⬜ pending |
| 06-10-T1 | 06-10 | 5 | REN-02 | T-06-24 | pick filters respect mute/layers/gate modes | unit | `npx vitest run tests/app/canvasDiagramModel.test.ts --project oracle` | Wave 0 (06-10) | ⬜ pending |
| 06-10-T2 | 06-10 | 5 | REN-02 | T-06-02b, T-06-05b | bounded store; no innerHTML | SSR smoke | `npx vitest run tests/app/canvasDiagramRender.test.ts tests/app/canvasDiagramModel.test.ts --project oracle && npm run typecheck` | Wave 0 (06-10) | ⬜ pending |
| 06-11-T1 | 06-11 | 6 | REN-02, REN-03 | T-06-25, T-06-01, T-06-11 | over-limit copy from data; scene-less result above the ceiling renders headless; lazy headless g; SVG path byte-identical | SSR smoke + typecheck + oracle gate | `npx vitest run tests/app/bigBaseSummary.test.ts tests/app/numogramText.test.ts --project oracle && npm run typecheck && npm run test:swap` | Wave 0 (06-11) | ⬜ pending |
| 06-11-T2 | 06-11 | 6 | REN-02, REN-03 | T-06-01, T-06-03, T-06-11 | whole-record requests; atomic latest swap; deferred hydration; no headless main-thread build | typecheck + oracle gate | `npm run typecheck && node scripts/check-repo.mjs --only base-ten && npm run test:swap` | existing | ⬜ pending |
| 06-11-T3 | 06-11 | 6 | REN-02, REN-03 | T-06-25 | old-fallback specs rewritten, never skipped | e2e | `npm run build && npx playwright test e2e/url-codec.spec.ts e2e/base-picker.spec.ts e2e/demons-browser.spec.ts e2e/demons-focus.spec.ts e2e/demons-matrix.spec.ts --project=chromium-utc` | rewrite existing | ⬜ pending |
| 06-12-T1 | 06-12 | 7 | REN-02 | T-06-11 | toolbar/fit on canvas; SVG props unchanged | typecheck + oracle gate | `npm run typecheck && npm run test:swap` | existing | ⬜ pending |
| 06-12-T2 | 06-12 | 7 | REN-02 | T-06-26 | tier, parity, LOD, picks, on-demand gate, fidelity in Chromium | e2e | `npm run build && npx playwright test e2e/canvas-tier.spec.ts --project=chromium-utc` | Wave 0 (06-12) | ⬜ pending |
| 06-12-T3 | 06-12 | 7 | REN-02 | T-06-12 | budget raised only with --reason | page weight + full e2e | `npm run build && node scripts/page-weight.mjs check && npm run test:e2e` | existing | ⬜ pending |
| 06-13-T1 | 06-13 | 8 | REN-02 | T-06-27 | narrow windows and touch | e2e | `npm run build && npx playwright test e2e/canvas-interaction.spec.ts --project=chromium-utc` | Wave 0 (06-13) | ⬜ pending |
| 06-13-T2 | 06-13 | 8 | REN-02 | T-06-28 | keyboard model and announcements | e2e | `npm run build && npx playwright test e2e/canvas-interaction.spec.ts --project=chromium-utc` | Wave 0 (06-13) | ⬜ pending |
| 06-14-T1 | 06-14 | 8 | REN-03 | T-06-03, T-06-01 | stale results discarded; 2^26 responsive; fallbacks | e2e (+ heartbeat guard, mutant) | `npm run build && npx playwright test e2e/worker.spec.ts --project=chromium-utc` | Wave 0 (06-14) | ⬜ pending |
| 06-14-T2 | 06-14 | 8 | REN-03 | T-06-04, T-06-06 | worker from own chunk path at root and /ccrug, offline; lore-free chunk | e2e + script | `npm run build && node scripts/worker-chunks.mjs && npx playwright test e2e/static-export.spec.ts && npm run test:e2e:basepath` | extend existing | ⬜ pending |
| 06-15-T1 | 06-15 | 9 | REN-02, REN-03 | T-06-11, T-06-06 | full gate with oracles untouched | full suite | `MSYS_NO_PATHCONV=1 npm run verify` | existing | ⬜ pending |
| 06-15-T2 | 06-15 | 9 | REN-02, REN-03 | T-06-29 | manual-only checks signed off | manual checkpoint | `grep -c "Manual-Only Verifications" .planning/phases/06-canvas-tier-and-worker/06-VALIDATION.md` | existing | ⬜ pending |

*Filled at planning time from the 15 Phase 6 plans (one row per task). "Wave 0 (06-NN)" means the test file is created by that plan alongside the code it covers. Plan 06-15 flips the statuses and the sign-off.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `engine/test/scene.canvasScene.test.ts` — typed-array scene (REN-02)
- [ ] `tests/app/canvasView.test.ts` — fit, zoom clamp, DPR and area cap, LOD boundary read from the table (REN-02)
- [ ] `tests/app/canvasPick.test.ts` — grid equals brute force, 12 px boundary, nearest-wins, tie order (REN-02)
- [ ] `tests/app/canvasDraw.test.ts` — recording-context draw calls (REN-02)
- [ ] `tests/app/canvasKeyboard.test.ts` — traversal order, Page jumps, announcements (REN-02)
- [ ] `tests/app/canvasInteraction.test.ts` — click slop, tap/pan threshold, pinch, pointercancel (REN-02)
- [ ] `tests/app/canvasDiagramRender.test.ts` — Canvas DOM contract, SSR smoke (REN-02)
- [ ] `tests/app/workerCore.test.ts` and `tests/app/workerClient.test.ts` — pure core and latest-wins client (REN-03)
- [ ] `tests/app/bigBaseSummary.test.ts` — ceiling message and degradation copy (REN-03)
- [ ] `tests/app/canvasDiagramModel.test.ts` — pick filters, targets, callout, frameOf (REN-02, 06-10)
- [ ] `tests/app/canvasPanelsRender.test.ts` — Canvas panel notes, Layers/Shortcuts copy, Regions read order (REN-02, 06-06)
- [ ] `tests/app/basePickerRender.test.ts` — computing state and persistent status carrier (REN-03, 06-09)
- [ ] `tests/app/selectionList.test.ts` — O(k) order merge and cap (REN-02, 06-09)
- [ ] `tests/app/shareParamsHeadless.test.ts` — no main-thread numogram above the ceiling (REN-03, 06-09)
- [ ] `scripts/worker-chunks.mjs` — worker chunk sizes and lore-free check (REN-03, 06-14)
- [ ] `e2e/canvas-tier.spec.ts`, `e2e/canvas-interaction.spec.ts`, `e2e/worker.spec.ts`, a worker test added to `e2e/static-export.spec.ts`, and a Canvas-aware wait helper next to `openViewer` in `e2e/viewer-helpers.ts`
- [ ] No framework install needed (no new dependency)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen-reader announcements on the Canvas (focus ring moves, "ready" status, repeats not dropped) | REN-02 (UI-07 extended) | Live-region behaviour differs per screen reader and cannot be automated here | With NVDA or VoiceOver on `?tier=canvas` at base 28 and at 202, Tab to the canvas, press arrows and Tab, confirm each zone is announced once per move and the ready status is announced after a base switch |
| Pinch and tap on a real touch device | REN-02 | CDP touch emulation covers the state machine, not real hardware feel | On a phone or tablet at base 202 and 1024, pinch to zoom, drag to pan, tap a small node, confirm it pins without zooming first |
| Visual parity between the SVG and Canvas tiers | REN-02 | Pixel parity is not asserted (palette, widths and node centres are) | Open base 28 with `?tier=svg` and `?tier=canvas` side by side and compare |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per touched spec
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

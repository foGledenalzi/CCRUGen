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

*Populated from the plans once they exist. The requirement-to-test map from `06-RESEARCH.md` (REN-02: tier selection, scene, view transform, pick, draw, keyboard, interaction, DOM contract, parity, narrow windows; REN-03: worker core, worker client, exported-site worker at root and `/ccrug`, stale results, responsiveness at 2^26, ceiling message) is the source for every row.*

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

---
title: "Lazy-load the Canvas tier and the worker fallback core so base-10 and SVG-tier pages stay at their old weight"
status: pending
priority: P2
source: "Phase 6 execution, plan 06-11 page-weight result, 2026-10-15"
created: 2026-10-15
theme: performance
---

## Goal

Keep the `/numogram/` entry bundle at (about) its pre-Phase-6 size for visitors who never reach a Canvas base (the default base 10 and every SVG-tier base up to 200), by loading the Canvas renderer and the main-thread worker fallback on demand instead of eagerly.

## Context

Plan 06-11 wired `CanvasDiagram` and `useNumogramWorker` into `app/NumogramClient.tsx`, which made them part of the `/numogram/` entry chunk. `npm run verify` then failed at the page-weight step: raw JS went from the stored baseline of 726,294 bytes to 808,034 (+11.3%) and gzip from 218,587 to 245,633 (+12.4%), against a tolerance of max(1 KiB, 5%). Plan 06-12 Task 3 settles this by raising the baseline through `node scripts/page-weight.mjs update --reason "..."` (the project's sanctioned route, so the budget stays a ledger of reasoned changes).

Raising the baseline is the plan as approved, but it makes every visitor pay about 27 KB gzip for code that only large bases use. The likely heavy parts are not only the Canvas drawing and picking modules but also the **main-thread fallback**: `useNumogramWorker` passes the shared `buildResult` core (engine layouts, routes, scene builders, text view) as the no-Worker fallback, so that whole core is bundled into the page even though the real worker chunk (about 17 KB) is separate.

## Approach to evaluate

- `next/dynamic` (client only, `ssr: false`) for `CanvasDiagram` so its modules (`draw`, `pickIndex`, `viewTransform`, `keyboardModel`, `interaction`, `diagramModel`) move into their own chunk loaded at the first Canvas base.
- Load the fallback core lazily inside `WorkerClient` (a dynamic `import()` only when no Worker is available), so the page bundle carries only the thin client.
- Check what else imports from `app/lib/canvas/*` and `app/lib/worker/*` eagerly (for example `viewTransform` for fit), since any eager import keeps that module in the entry chunk.
- Re-measure with `node scripts/page-weight.mjs print`; the goal is to land back inside the stored tolerance, or to record a much smaller reasoned raise.

## Constraints

- Static export on Next 14.2.35, no new dependency; chunks must work under `basePath` and offline once loaded.
- The frozen oracles do not capture the Canvas branch, but `npm run test:swap` must still pass unchanged after the `NumogramClient.tsx` edit, and `e2e` specs that wait on `[data-render-tier="canvas"][data-canvas-state="ready"]` must tolerate the extra chunk fetch.
- Never edit `perf/page-weight.baseline.json` by hand.

## Acceptance Criteria

- [ ] Entry-chunk growth versus the pre-Phase-6 baseline is within the stored tolerance (or the raise is small and justified in the ledger)
- [ ] Canvas bases still render, pick and animate as before; `npm run verify` is green
- [ ] The decision (raise vs split) is recorded at the 06-15 checkpoint

## Related

Phase 6 plans 06-07 (worker, fallback), 06-10 (CanvasDiagram), 06-11 (integration), 06-12 (page-weight settlement).

# Phase 6: Canvas Tier and Worker - Research

**Researched:** 2026-10-05
**Domain:** Canvas 2D renderer behind the existing view contract, a same-origin Web Worker bundled by Next 14.2.35 (webpack 5) in a static export, Canvas hit-testing, request-id stale-result handling
**Confidence:** HIGH on worker bundling, tier-table data design, measured costs and the list of tests that change (all verified by experiment or code reading in this session). MEDIUM on the Canvas interaction details that rest on spec choices (gesture-time bitmap stretch, context dimming), which are flagged in Open Questions.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Interactive ceiling and the over-limit offer**
- **D-01:** The shipped interactive ceiling is **n = 4000**, the largest measured size (`budgets.canvasTargetN` in `tier-table.json`: Canvas stayed inside budget on every profile to 4000). Bases from 202 up to 4000 draw on Canvas; above 4000 the page shows the message plus the summary and text view (the same fallback Phase 4 D-14 built, now moved from above 200 to above 4000). Raising the ceiling later is a data change after re-measuring, not a code change. The table currently records `boundaries.canvasMaxN: null` ("no ceiling found in the measured range") and `validateTierTable` forces a measured table's `canvasMaxN` to equal what the measurements derive, so the shipped ceiling must live as its own data field (planner's call on name and schema) and must not be hard-coded in a component.
- **D-02:** The message follows Phase 4 D-15/D-16/D-18: short and factual, the cutoff number read live from the table, no apology, no "show anyway" button, and the `tier=` URL override stays diagnostic-only. It also **names headless export as the route** for larger bases. The real export button and CLI command are Phase 8 work, so ROADMAP criterion 4 ("offers headless export") is split: Phase 6 delivers the message and the pointer, Phase 8 delivers the export it points at. No JSON download is pulled forward (Phase 8 EXP-03 owns that format).

**What Canvas draws and what is pickable**
- **D-03:** **The SVG-lean tier is dropped.** Canvas takes over immediately after `svgRichMaxN` (200). Phase 3's measured `svgLeanMaxN` row stays in the table as measurement history, but no lean renderer is designed or built (this closes the deferral in Phase 4 D-17).
- **D-04:** **Edges follow the table and are drawn on demand for a selection.** Syzygies and currents are always drawn and pickable. The gate layer follows `gateLayerMode` (full up to `gatesFullMaxN` 40, thin up to `gatesThinMaxN` 150, off above). Hovering or pinning a zone always draws that zone's own gate, syzygy partner and current even when the gate layer is off, so no edge becomes unreachable at large n.
- **D-05:** **Canvas carries the whole viewer surface, not a reduced subset.** All four layouts draw on Canvas (ring, ladder, Barker spiral, pair-graph view) and Phase 5's demon focus mode draws a zone's or a demon's chords. Both consume the same coordinate arrays, routes and demon API the SVG tier already uses, so the Canvas tier is not second-class. Existing caps still apply: the all-chords web stays at `allChordsMaxN` 80 (Phase 5 D-04) and layout-switch animation stays at `layoutTweenMaxN` 28, instant above.

**Worker scope and loading experience**
- **D-06:** **The worker owns all engine work above `svgRichMaxN` (200); at or below 200 everything stays synchronous exactly as today.** Above 200 the worker builds the numogram, the summary, the text-view data and the Canvas scene (including bases above the 4000 ceiling, where the summary and text view are still shown and `createNumogram` at 2^26 measured about 0.6 s and +271 MiB). Base 10 and every SVG-tier base never become asynchronous, so the 60 DOM goldens, the behaviour baseline and the Phase 4 and 5 interactions see no new timing.
- **D-07:** **While the worker computes, the last result stays visible.** The previous diagram stays on screen slightly dimmed, with a short inline "computing base N" status next to the base picker, and swaps in when the result arrives (the same keep-the-last-valid-base pattern as Phase 4 D-06). Results for bases that were superseded in the meantime are discarded, so rapid base changes (typing, dragging, stepping) never show a stale result.

**Canvas accessibility, touch and small windows**
- **D-08:** **The Canvas tier keeps UI-07's promise.** One focusable canvas: arrow keys and Tab move a visible focus ring between zones and along a zone's syzygy, current and gate, Enter pins, and an `aria-live` region announces the focused zone. The Phase 4 text view stays as the fallback route. Reduced-motion and non-colour cues carry over to the Canvas drawing.
- **D-09:** **Hit-testing is forgiving and shared by mouse and touch.** Pinch zooms, one finger pans, a tap pins (there is no hover on touch, so tap does what pin does today). Every pick uses a minimum hit radius of about 12 CSS px whatever the zoom and the nearest zone or edge wins; mouse hover uses the same rule so tiny nodes stay reachable without zooming first. No disambiguation list or magnifier in this phase.

**Carried forward (not re-discussed)**
- Label visibility by on-screen node size (about a 7 px radius, `labelVisibleMinRadiusPx` in the table) applies to the Canvas tier as level of detail (Phase 3 D-07).
- Tier selection stays data-driven through the table (`selectTier`, `tierFor`); the `tier=svg|canvas|headless` override stays diagnostic-only (Phase 3 D-13, Phase 4 D-18).
- The frozen oracles never change: the 60 DOM goldens, `e2e/__behaviour__` and the numeric oracle stay green and are never regenerated to make a test pass. Canvas adds new tests, it does not touch the base-10 SVG path.
- The engine stays pure (no DOM or Node types, relative imports only, no O(n^2) materialization); the worker is app-side glue around engine functions.
- Static-first on Next 14.2.35 (exact pin), no server routes; the worker must also run in the exported site with and without `NEXT_PUBLIC_BASE_PATH`, offline (ROADMAP criterion 5).

### Claude's Discretion

How Canvas picking is implemented (uniform-grid zone picking, id-buffer or geometric edge picking: ROADMAP research item), the worker bundling approach under Next 14 webpack in an export build (`trailingSlash`, `basePath`, same-origin worker), the worker message protocol and transferable typed arrays, request ids and cancellation, the fallback when `Worker` is unavailable (for example run on the main thread up to the ceiling), the schema name and file location of the shipped-ceiling datum (D-01), the exact dim opacity and wording of the "computing" status and the over-ceiling message, the focus-ring styling and the announcement wording, how the Canvas scene is cached or redrawn on zoom and pan, and the plan and wave breakdown.

### Deferred Ideas (OUT OF SCOPE)

- A user-facing "show it anyway" override above the ceiling: declined again (Phase 4 D-18).
- A disambiguation list or magnifier for crowded hit areas: not in this phase (D-09 chose nearest-wins).
- A minimal JSON download pulled forward from Phase 8: declined (D-02); the export format belongs to EXP-03.
- Extending the ceiling past 4000 by measuring further: possible later as a table re-measure, not planned here.

(Reviewed todos not folded: 002, 004, 006. 006 touches the frozen base-10 oracle.)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REN-02 | An SVG tier serves small bases and a Canvas tier serves large bases, selected from the threshold table, behind one shared view contract | Shipped-ceiling datum design and `selectTier` extension (Pattern 1); measured Canvas paint/blit/overlay costs and the layered-canvas redraw model (Pattern 5); pick index (Pattern 6); the view-contract extension (`tier`, `interactiveMaxN` in `NumogramViewContextValue`, `view` non-null at Canvas) and the list-panel pitfall (P9) |
| REN-03 | Heavy computation runs in a Web Worker at large n so the UI never freezes; beyond the measured ceiling the app degrades to headless export with a visible message | Verified Next 14.2.35 worker bundling under export, trailingSlash and basePath (Worker Bundling Evidence); request-id / latest-wins protocol and transfer pattern (Pattern 2); main-thread `createNumogram` call sites that must go (P6); ceiling message and the Phase 8 split (D-02) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Correctness is the core value; all arithmetic in the numogram's own base; even bases only; regions are `Cycle[]` (never one Torque). Canvas code must not decimal-assume anything about zone labels (use `zoneLabels`/`formatZoneLabel`).
- The base-10 oracle is frozen: numeric golden JSON, the 60 DOM goldens and `e2e/__behaviour__` are never regenerated with `-u`. `NumogramClient.tsx` may be edited but the DOM goldens capture only the projection `<svg>`: keep `Projection.tsx` and `PairGraphProjection.tsx` output byte-identical.
- `engine/` is pure: no DOM or Node types, relative imports only, no O(n^2) materialization. The worker is app-side glue (`workers/`), not engine.
- Static-first: no server routes; stay on Next 14.2.35 exact pin.
- No upstream branding, ever; no new files that reintroduce old names. New files are MIT original code (no NOTICE change needed for new files).
- Environment: Windows 10, Node 22, npm 11 locally; `package-lock.json` must stay valid for npm 10 and 11 (this phase should add no dependency, so the lockfile should not change). On Windows Git Bash prefix builds with `MSYS_NO_PATHCONV=1`; the timezone is pinned with `CCRUG_TZ`.
- The full gate is `npm run verify`; run it before claiming done. Do not `git push`.
- No jsdom/happy-dom is installed and Vitest runs in `environment: 'node'`: component logic that must be unit-tested has to live in pure modules (the Phase 5 `demonMatrix.ts` precedent); components get `renderToStaticMarkup` smoke tests and Playwright coverage.

## Summary

The phase is a renderer swap plus a worker. Everything the planner needs about the two ROADMAP research flags was settled by experiment against the real Next 14.2.35 in a scratch app outside the repo (deleted afterwards): `new Worker(new URL('../workers/x.ts', import.meta.url))` works under `output: 'export'` with `trailingSlash: true`, both at the root and under a `basePath`, the worker is emitted as ordinary hashed JS under `out/_next/static/chunks/`, loaded by `importScripts` from the public path (`/ccrug/_next/` under a basePath), the engine's relative-import TypeScript compiles inside it, and the worker keeps computing with the network off once created. Canvas picking is cheap enough that no id-buffer is warranted: a uniform grid for zone centres and a brute-force pass over about 38,000 flattened edge segments cost 0.2 ms per pick (1.4 ms at 6x CPU throttle) at n = 4000, against a 100 ms interaction budget.

Three findings change how the plan should be shaped. (1) At n <= 4000 the whole engine, view-model, layout and routing pipeline costs 30 to 40 ms natively (about 120 ms in the spike's throttled profile) and `createNumogram` itself is 0.26 ms; the only genuine main-thread freeze is `createNumogram` above roughly 2^22 (625 ms at 2^26). So the worker's real obligations are the over-ceiling summary/text and a clean, uniform request/stale protocol, and several main-thread `createNumogram(n)` call sites in `NumogramClient.tsx` and `shareParams.ts` must be removed from the commit path or the 2^26 freeze simply moves. (2) A hover that re-rasterizes the static layer would cost 29 ms (gpu) to 249 ms (software raster at 6x throttle, DPR 2) at n = 4000, which breaks the 100 ms interaction budget on the shipped profile, so context dimming must be a layer-opacity change, not a repaint. (3) The UI-SPEC's "Scale rule" (`s = windowWidth / layout.width x zoom`) is wrong for tall layouts: the ladder at n = 4000 has a 19 x 4096 frame, so fit must be `min(W / width, H / height)` and zoom must be relative to fit.

**Primary recommendation:** Add `boundaries.interactiveMaxN` (a `Boundary`) to `tier-table.json` and teach `selectTier` to use `min(canvasMaxN, interactiveMaxN)`; run every non-SVG-tier computation through one pure `buildResult(request)` core used by both `workers/numogram.worker.ts` and the no-Worker main-thread fallback, driven by a single latest-wins request-id client with one long-lived worker; render Canvas as stacked layers (per-kind edge canvases whose CSS opacity switches ambient/context, a node-and-label canvas, an overlay canvas that is the single focusable element) from worker-built typed arrays, with geometric picking; test the worker path at base 28 through the existing `?tier=canvas` diagnostic override and prove staleness with a test-only `Worker` wrapper injected through Playwright `addInitScript`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tier selection (svg / canvas / headless) | Browser / Client (pure `tierFor` over table data) | Engine (`selectTier`, table schema) | Data-driven from `tier-table.json`; the client only passes the displayed base and the diagnostic override |
| Numogram build, summary, text, layout, routes, scene buffers above 200 | Browser Web Worker | Main-thread fallback (same pure core) | D-06; avoids main-thread freeze at huge n and keeps one code path |
| View model (`view`), zone labels, `g` for hover/info at Canvas (n <= 4000) | Browser main thread | Worker (not needed) | 11 ms at n = 4000, needed synchronously by InfoDisplay/regions/demons; cloning the same data from the worker would cost about the same |
| Canvas raster (static layers) | Browser main thread (2D canvas) | none | `Path2D` is not structured-cloneable; measured main-thread paint fits the budgets; OffscreenCanvas in a worker is out of scope |
| Picking and keyboard traversal | Browser main thread (pure modules) | none | Pointer events and focus live on the main thread; pure math modules make it testable without a DOM |
| Over-ceiling summary + text view message | Browser (React components) | Worker (data) | D-01/D-02; Phase 4 `BigBaseSummary` extended |
| Static hosting of the worker chunk | CDN / Static (`out/_next/static/chunks`) | none | Verified: an ordinary same-origin hashed JS file; no server involvement |
| Request-id / stale handling | Browser main thread (`WorkerClient`) | Worker echoes id and key | The worker cannot be interrupted mid-job; the client discards non-latest ids |

## Standard Stack

### Core

No new dependency (UI-SPEC "Registry Safety": platform APIs only; the lockfile should not change).

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Next.js | 14.2.35 (exact pin) [VERIFIED: node_modules/next/package.json] | Static export, webpack 5 worker bundling | Locked by CLAUDE.md; native worker support verified |
| Web Worker via `new Worker(new URL(..., import.meta.url))` | webpack 5 syntax [CITED: https://webpack.js.org/guides/web-workers/] | Same-origin worker, bundled by Next | Verified in a scratch Next 14.2.35 export (root and basePath) |
| Canvas 2D + `Path2D` | platform | Canvas tier rendering | Spike measured this model (`scripts/spike/harness.mjs` canvas suite); `Path2D` accepts SVG path strings including `A` arcs [VERIFIED: bench in Chromium 153] |
| Pointer Events (`setPointerCapture`, `touch-action: none`) | platform | Mouse + touch pan, pinch, tap | Phase 5 `DemonMatrix.tsx` precedent |

### Supporting (already installed, versions from package.json)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.2 | Unit tests (node env; projects `engine` and `oracle`) | Pure scene/pick/keyboard/protocol modules |
| fast-check | 4.10.2 | Property tests | Grid pick vs brute force, protocol out-of-order replies |
| @playwright/test | 1.63.0 (Chromium 153 recorded in the table environments) | e2e, CDP touch events, `page.on('worker')` | Canvas, worker, basePath, staleness |
| serve | 14.2.6 | Static server for `out/` | Existing e2e webServer |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `new Worker(new URL())` | Blob/inline worker, `public/` copy, comlink | Blob URLs break the "same-origin chunk" story and CSP; `public/` copy bypasses TS and webpack; comlink is a new dependency (forbidden) |
| Geometric picking | id-buffer offscreen canvas | Measured build 11 ms (gpu) / 96 ms (6x) per rebuild, second full-size backing store, antialias blends corrupt ids at edges, still needs distances for nearest-wins; no benefit at n <= 4000 |
| `OffscreenCanvas` raster in the worker | main-thread raster | Adds a second protocol (bitmap per commit); D-06 only requires the scene data in the worker; revisit only if a re-measure raises the ceiling far past 4000 |
| `boundaries.interactiveMaxN` | reuse `budgets.canvasTargetN` | `canvasTargetN` is a measurement input (largest n the spike ran), not a shipping decision; D-01 asks for its own field |

**Installation:** none. **Version verification:** `package.json` pins read this session; `node --version` = v22.16.0, `npm --version` = 11.6.2.

## Worker Bundling Evidence (the ROADMAP research flag, answered)

Method: a scratch Next 14.2.35 app outside the repo (copied `engine/`, `app/lib`, `app/presets`, the repo's `next.config.js` and `tsconfig.json`, `node_modules` linked), a client page that creates the worker in an effect, built with `output: 'export'`, `trailingSlash: true`, with and without `NEXT_PUBLIC_BASE_PATH=/ccrug`, served with the repo's `serve` and driven by the repo's Playwright (Chromium). Scratch deleted afterwards; the repo tree was left clean.

| Question | Finding | Tag |
|----------|---------|-----|
| Is `new Worker(new URL('../workers/x.ts', import.meta.url))` supported by Next 14.2.35 webpack? | Yes. Page chunk contains `new Worker(t.tu(new URL(t.p+t.u(<id>),t.b)))` | [VERIFIED: scratch build] |
| Where is it emitted? | `out/_next/static/chunks/<id>.<hash>.js` (a 1.5 KB entry runtime) plus a shared code chunk (the engine and imports) fetched by `importScripts` from the worker entry | [VERIFIED] |
| Classic or module worker? | Always a classic script worker: webpack rewrote `{ type: 'module' }` to `{type:void 0}`. Write `new Worker(new URL(...))` without options; ES module syntax in the source is fine | [VERIFIED] |
| URL with `trailingSlash` and `basePath` | Root: `http://host/_next/static/chunks/647.<hash>.js`. basePath `/ccrug`: `http://host/ccrug/_next/static/chunks/647.<hash>.js` (`f.p="/ccrug/_next/"`). Absolute path, so `trailingSlash` and page depth are irrelevant. Playwright `page.on('worker', w => w.url())` reports it | [VERIFIED: both builds, Chromium] |
| Reachable offline? | It is a static file in `out/`. With the network switched off after the worker exists, a request posted to that worker is still answered. A *second* `new Worker()` created while offline fails (`script load failed`, with `serve`'s revalidating headers). So keep one long-lived worker and do not terminate/respawn per request | [VERIFIED] |
| CSP / `next/script` | No CSP exists in the repo. Next's worker loader goes through Trusted Types policy `nextjs#bundler`. `next/script` is not involved | [VERIFIED in chunk text] |
| TS in the worker | Relative imports of `../engine/index` and `../app/lib/*` compile and bundle (engine code is duplicated into the worker chunk: 37.7 KB raw, 13.6 KB gzip with the base-10 lore, see P11). `tier-table.json` rows are tree-shaken (chunk smaller than the 84 KB table) | [VERIFIED] |
| Root `tsc --noEmit` on `workers/*.ts` | The root `tsconfig.json` (`include: **/*.ts`, `lib: dom`) type-checks `workers/`. `importScripts` does not exist in the DOM lib. `self.postMessage(msg, [buf])` fails TS2769; `self.postMessage(msg, { transfer: [buf] })` passes and is valid in a real worker | [VERIFIED: tsc in scratch] |
| `engine/tsconfig.json`, engine ESLint override | `engine/tsconfig.json` covers `engine/**` only; the engine restricted-syntax/globals override is `engine/**` only. `tsconfig.components.json` (explicit file list) and `engine/tsconfig.test.json` (`engine/test`) do not include `workers/` either, so the four `tsc` invocations in `npm run typecheck` reduce to one that sees the worker (the root one). A `workers/` directory is therefore outside the engine purity guard, as intended (the worker is app-side glue). `next lint --dir workers` and the `next build` lint step accept the directory | [VERIFIED] |
| `next dev` | Works; React StrictMode runs the effect twice so a worker created in an effect is spawned twice (the first terminated by cleanup). Create the worker lazily at first request, not in an effect | [VERIFIED: dev server in scratch] |
| Does `out/` HTML reference the worker chunk? | No, so `scripts/page-weight.mjs` (which counts only JS/CSS referenced from HTML) never sees the worker chunk. Only the client-side code on the main bundle moves the budget | [VERIFIED] |
| Stray `new URL('./x.ts', import.meta.url)` outside `new Worker(...)` | Emits the raw TypeScript file into `out/_next/static/media/`, and root `tsc` (which includes `**/*.ts` except `node_modules`) then type-checks it and fails. Webpack also rejects the variable form `new Worker(urlVar)` [CITED: webpack web-workers guide]. Only ever write the literal `new Worker(new URL('<literal>', import.meta.url))` | [VERIFIED + CITED] |

## Architecture Patterns

### System Architecture Diagram

```
URL hydration / BasePicker / layout & packer buttons / label scheme
        |  desired = { base, layout, packer, labels }   (one record)
        v
NumogramClient --- tierFor(base, tierOverride) <-- tier-table.json (boundaries.svgRichMaxN, interactiveMaxN)
   |
   |-- 'svg'  (n <= 200, or tier=svg): SYNC path, byte-for-byte today's code
   |       createNumogram -> buildNumogramView -> layoutTarget -> Projection / PairGraphProjection  (UNCHANGED)
   |       a sync commit also INVALIDATES any in-flight worker request (P2)
   |
   '-- 'canvas' | 'headless' (n > 200, or tier=canvas|headless): WORKER path
           WorkerClient.request(id, key)  ---- postMessage ---->  workers/numogram.worker.ts
              ^  one long-lived worker                              handleRequest = pure buildResult(req)
              |  latest-wins: 1 in flight + 1 pending slot             createNumogram, summarize, numogramText,
              |  fallback: no Worker / error -> same buildResult        resolveLayout|pairGraphLayout, routeGates/Currents|PairGraph,
              |            on main thread (<= ceiling), else refuse     flatten -> typed-array scene (n <= interactiveMaxN only)
              |
              '-- response {id, key, summary, text, scene?}  (typed arrays transferred, not copied)
                     id !== latest -> discard (superseded)
                     id === latest -> ONE batched swap (existing UI-08 reset) : shown = {base, summary, text, scene}
                                      |
                  canvas: main-thread g + buildNumogramView + zoneLabels (cheap at n <= 4000) --> <CanvasDiagram>
                                      |   layers: edge canvases (syzygy, current; CSS opacity = ambient | context)
                                      |           node + label canvas (LOD at labelVisibleMinRadiusPx)
                                      |           overlay canvas = the single focusable element (highlights, on-demand edges,
                                      |           selection rings, demon-focus chords, focus ring) + callout chip + aria-live region
                                      |   input : pointer / keyboard -> pickIndex (zone grid + edge segments, 12 CSS px, nearest wins)
                                      |           -> onHoverInfo / onPinInfo / onZoneNodeClick  (same callbacks the SVG tier uses)
                  headless: BigBaseSummary(summary, text, interactiveMaxN)   (no `g`, no `view`)
```

### Recommended Project Structure (names are the planner's call)

```
workers/
  numogram.worker.ts           # thin shell: onmessage -> handleRequest -> postMessage(msg, { transfer })
engine/scene/canvasScene.ts    # RECOMMENDED pure typed-array scene from (g, layout, routes): reuse by Phase 8 CLI; tests in engine/test
app/lib/worker/
  protocol.ts                  # request/response/scene-buffer types and guards
  buildResult.ts               # pure core shared by worker and main-thread fallback (no DOM, no React)
  workerClient.ts              # request ids, latest-wins slot, injected factory, fallback
  useNumogramWorker.ts         # thin React hook over WorkerClient
app/lib/canvas/
  viewTransform.ts             # fit, zoom clamp, screen<->world, DPR/backing-store sizing
  pickIndex.ts                 # zone grid + edge segments + nearest-wins + tie order
  keyboardModel.ts             # ring-target sequence, Page keys, announcement strings
  interaction.ts               # pointer state machine (mouse, touch, pinch, tap)
  draw.ts                      # drawStatic / drawOverlay against an injected ctx-like interface
app/components/canvas/CanvasDiagram.tsx   # DOM shell: layers, listeners, callout chip, live region
```

`summarize` (and `NumogramSummary`, `SUMMARY_TORQUE_LIMIT`) should move to a lore-free module re-exported from `numogramView.ts` so the worker bundle does not carry the base-10 lore (P11). New `app/` files are scanned by the base-ten grep gate (P12); `workers/` and `engine/` are not.

### Pattern 1: Shipped ceiling as data (`boundaries.interactiveMaxN`)

**What:** Add `interactiveMaxN: Boundary` (`{ n: 4000, basedOn: 'sw-6x', rule: '...' }`) to `boundaries` in `tier-table.json` and `TierBoundaries`. `selectTier` becomes: svg if `n <= svgRichMaxN.n`; else canvas if `n <= min(canvasMaxN?.n ?? Infinity, interactiveMaxN?.n ?? Infinity)`; else headless. Existing tests that set `canvasMaxN: null` and no `interactiveMaxN` keep their meaning (`selectTier(10**6)` is `canvas`, tiers.select.test.ts:142-148) if the field is optional in the type.
**Validator rules (one `if` per rule, like the rest of `validateTierTable`):** integer >= `svgRichMaxN.n`; `basedOn === shippedProfile` (add it to the `namedBoundaries` loop); required when `status === 'measured'`; for a measured table `interactiveMaxN.n <= derived.maxMeasuredN` (the last Canvas row, 4000) and `<= canvasMaxN.n` when `canvasMaxN !== null`. This leaves `canvasMaxN: null` equal to what the measurements derive, so the existing equality rule (tiers.ts:438-441) is untouched.
**Also change:** `scripts/spike/shape.ts` builds `boundaries` field by field (shape.ts:221-229), so a re-measure would silently drop the new field: carry `previous.boundaries.interactiveMaxN` forward like `labelVisibleMinRadiusPx` and extend `tests/spike/shape.test.ts`. `app/lib/tierBounds.ts` gets `INTERACTIVE_MAX_N` by property access (never the whole JSON). Tests must read the number from the table, never a literal 4000.
**When to use:** D-01. **Source:** engine/scene/tiers.ts lines 129-135, 339-352, 408-451 [VERIFIED: read].

### Pattern 2: One desired-state record, latest-wins worker client, pure shared core

**What:** `NumogramClient` holds `desired = { base, layout, packer, labels }`. Every change that needs recomputation (base, layout, packer, label scheme) re-issues one request for the *whole desired record*, so a layout click during a pending base switch updates the pending request instead of orphaning it. The response carries `id` and `key`; the client commits only when `id === latestId`, in one batched swap that is the existing `commitBase` body (UI-08 reset of selection, history, region filter, orientation cache, demon state) plus `setBase` and the new result. Until then all state still belongs to the displayed base, so no stale-zone state can exist.
**Protocol:** `request {type:'build', id, base, layout, packer, labels, wantScene}` -> `response {type:'built', id, key, base, summary, text, scene | null}` or `{type:'error', id, message}`. Client keeps `inFlight` and one `pending` slot: while a job runs, a newer request replaces `pending`; when the job returns, the pending request is sent. Worst-case latency is one extra job and the queue never grows. A synchronous (SVG-tier) commit must also bump `latestId` so a late worker result cannot overwrite it (P2). No terminate/respawn per request (offline respawn fails, see the evidence table); optionally a long watchdog (several seconds) that terminates and falls back.
**Fallback:** `buildResult` is a pure module imported by both the worker shell and the client. If `typeof Worker === 'undefined'`, the constructor throws, or the worker fires `error`, run the same function on the main thread after yielding one frame so the status paints, but only up to `interactiveMaxN`; above it show the UI-SPEC "needs a background worker" refusal (that copy is only reachable through this path).
**Transfer:** allocate each output array separately, put each `.buffer` in the transfer list exactly once (a duplicate buffer throws `DataCloneError`; two views over one buffer detach both); use `postMessage(msg, { transfer })`.
**Guard in the worker:** build the scene only when `base <= interactiveMaxN` (a `scene` request for 2^26 must return `scene: null`, never allocate gigabytes). Summary and text are bounded (T-04-21) and safe at 2^26.

### Pattern 3: Worker path testable at base 28 without changing production behaviour

**What:** Use the existing `?tier=canvas` / `?tier=headless` override: `useWorker = tierFor(displayedBase, tierOverride) !== 'svg'`. With no `tier=` param production behaviour is exactly D-06; with it, base 28 takes the worker and Canvas path. This is the same switch the UI-SPEC parity method uses, it already round-trips through the URL codec (`tier=canvas`, shareParams.test.ts:266) and adds no new constant, flag or global. For deterministic out-of-order and slow-worker scenarios, Playwright `addInitScript` wraps `window.Worker` to delay `postMessage` by a per-message amount (delay the older request longer): the worker is FIFO, so the response order is reversed and the stale response must be discarded. Nothing is added to production code.

### Pattern 4: Typed-array scene built in the worker, `Path2D` built on the main thread

**What:** The worker returns, per (base, layout, packer): `x`, `y` (`Float64Array`), `drawOrder`, frame/radius/stroke numbers, `regionLabels`, and for edges a `Float64Array` of 6 numbers per curve (x0,y0,cx,cy,x1,y1; a straight `L` is stored with its midpoint as control) for current legs A/B and stems, gates, plus junction x/y, `loop`, `to`, label x/y; pair-graph arcs/loops as joined path strings (they use SVG `A` arcs, see P14); and flattened pick segments with an edge-id array. The main thread builds `Path2D` from these with `moveTo`/`quadraticCurveTo` (0.6 ms gpu, 4 ms at 6x throttle for all 10,000 curves of n = 4000) instead of `new Path2D(d)` per string (11 ms / 103 ms) or one joined string (1.7 ms / 13.9 ms). The engine's route functions emit only `M`, `L`, `Q` for zone layouts [VERIFIED: route letters at n = 4000 are `MQL`], so a small parser in the worker is exact; it is cheap there and off the main thread (4.8 ms gpu / 38 ms at 6x).
**Edge identity:** key edges by pair id `q` and zone `z`, never by view array index: `buildStructuralSyzygies` lists pairs in descending id, `buildStructuralCurrents` lists Torque pairs in flow order then Warp then Plex, gates are by origin zone. Main maps ids to `view` entries through `Map`s (`g.pairOf(c.from)` is the join `engineRenderData` already uses).

### Pattern 5: Layered canvases and three redraw tiers

| Tier of change | Examples | Cost model (n = 4000, measured, 580 css px column) |
|---|---|---|
| Re-raster static layers | scene swap, committed zoom/pan, resize, DPR change, layers/labels/isolate/mute/Time Circuit | paint at fit: DPR 1 / 2 / 3 = 6.4 / 29.4 / 35.5 ms (gpu) and 77.7 / 249.3 / 279.4 ms (software raster, 6x throttle); budget `oneTimePaintMs` 500 |
| Overlay redraw | hover, pin, selection rings, on-demand edges, focus ring, demon focus chords | spike overlay redraw 0.6 ms (sw-6x row), budget `interactionMs` 100 |
| Compositor only | pan/zoom gesture in flight, ambient-to-context dimming | CSS `transform` / `opacity` on the layer elements; cached-bitmap blit frame at DPR 2 is 0.6 ms (gpu) / 5.7 ms (6x), budget `panMs` 32 |

**Context dimming (UI-SPEC "when any zone is highlighted every other edge drops to 0.08 / 0.1")** must be a CSS `opacity` switch on per-kind edge canvases (syzygy ambient 0.5 to 0.1, current 0.6 to 0.08), with highlighted and on-demand edges drawn on the overlay at their highlighted alpha. A repaint per hover would cost 29 ms (gpu) to 249 ms (software, 6x) and fails `interactionMs` on the shipped profile. Draw the edge layers at alpha 1 and let the element opacity carry the table value. Selection rings, hover highlights and focus ring are overlay-only. During a continuous gesture (wheel burst, drag, pinch) transform the static layers with CSS and re-raster after the gesture ends (wheel idle 120 ms like the existing `wheelGestureTimerRef`, or pointer up) in the next animation frame; discrete changes (ViewControls steps, Fit, keyboard zoom, resize, DPR change) re-raster at once. Hover picking is suspended while a gesture is active.
**View state:** keep `{ tx, ty, zoom }` in a ref (mirrored to `data-zoom`, `data-tx`, `data-ty` on commit); do not `setState` per pointer move. Zoom is relative to fit: `s = fitScale x zoom`, `fitScale = min(W / layout.width, H / layout.height)` (P8).
**Backing store:** `dpr = min(devicePixelRatio, 3)` reduced so `cssW x cssH x dpr^2 <= boundaries.canvasAreaLimitPx` (read from the table). The window-only store is at most about 3.65M px at DPR 3, so the 2^28 limit never binds in practice; keep the rule as the safety net. Safari is stricter than the table's Chromium measurement: a 16,777,216 px per-canvas area limit and a total canvas memory limit (384 MB cited for iOS 15) [CITED: https://www.pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/, https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/]; four stacked layers at DPR 3 are about 58 MB, well inside it. Re-measure on re-raster on `resize` (ResizeObserver) and on `matchMedia('(resolution: Xdppx)')` change events (re-armed after each change).
**Culling:** at zoom the static paint cost is not proportional to visible content unless culled; cull zones through the same zone grid and skip edges whose bbox misses the window. The spike measured the unculled zoom-20 paint at 25 / 130 / 136 ms (software 6x; DPR 1 / 2 / 3).

### Pattern 6: Picking (geometric, nearest-wins, 12 CSS px)

- **Zones:** uniform grid over zone centres (CSR arrays: `cellStart: Int32Array`, `items: Int32Array`), cell about 2 to 4 nodes wide. Query cells overlapping `cursor +/- (R + 12/s)` in world units; metric `max(0, |cursor - centre| x s - R_px)`; accept `<= 12`. Measured 1.0 to 1.5 microseconds per pick (2 to 9.5 microseconds at 6x). The same grid serves rubber-band selection and culling.
- **Edges:** keep flattened segments (4 numbers each, plus an edge-id `Int32Array`) from the worker: 38,000 segments at n = 4000 (2000 syzygies as one segment each, 6000 current curves flattened to 6 chords). Brute force with a per-edge bbox reject costs 0.215 ms per pick (1.395 ms at 6x throttle), 70 times under the interaction budget. A segment grid is unnecessary now; note the headroom if the ceiling is ever raised. Flattening with 6 chords per quadratic leaves a deviation of at most about 0.4% of curve length (2.5 px on a 600 px edge, well inside the 12 px radius); use 8 for margin. Gates are pickable only when drawn: ambient gates are off above `gatesThinMaxN`, so only a highlighted zone's own gate (flattened on demand from its control points) is a candidate.
- **Pair graph:** pill = rectangle distance with half-height as `R_px`; pair-graph arcs use SVG `A` commands, so flatten circular arcs analytically for picking (endpoint to centre parameterization) and draw them with `new Path2D(d)` (2000 strings are about 2 ms).
- **Order:** collect the best candidate per class and resolve ties zone, syzygy, current, gate, demon chord (UI-SPEC). A disc hit has distance 0, so a click on a node never loses to an edge.
- **Why not an id-buffer:** build 11.3 ms (gpu) / 96.3 ms (6x) for 2000 per-pair strokes at DPR 2 (one `stroke()` per edge is required to colour each uniquely), `getImageData` of a 25 x 25 window is cheap (0.006 / 0.044 ms with `willReadFrequently`), but antialiasing blends adjacent edge colours into wrong ids, it doubles the backing store, must be rebuilt at every zoom commit, and still cannot give the distance that nearest-wins needs. Geometric picking is both faster to build and exact.
- **Hit regions:** do not rely on `addHitRegion`; it is an experimental API that has not shipped broadly [ASSUMED: from MDN-derived search results, not re-verified in a browser].

### Pattern 7: Keyboard traversal and live region on one canvas

Per UI-SPEC: the focusable overlay canvas is `role="application"`, `tabIndex=0`, `outline: none`, with the painted ring as the indicator. Model as a pure function `nextTarget(state, key) -> {target, announcement}` (zone ring: arrows wrap, Home/End, Page +/-10 clamped; Tab steps zone -> syzygy -> current -> gate skipping muted or absent, then lets the browser move focus on; Shift+Tab mirrors it). Keyboard focus counts as hover (calls `onHoverInfo`) which is what draws a focused zone's own edges when the gate layer is off. Auto-pan the ring target into the window (24 css px margin). Announce through a persistent `aria-live="polite"` sr-only element carrying `data-canvas-live`; coalesce announcements to one per animation frame (Page keys repeat fast) and append a zero-width toggle when the same string repeats [ASSUMED: common practice, not verified against a screen reader]. The existing SVG tier's flat roving order (zones, syzygies, currents, gates in one arrow sequence, Projection.tsx:117-139) is a different model; the Canvas tier follows the UI-SPEC model and must not change the SVG tier.

### Pattern 8: Pointer interaction as a pure state machine

Mouse: hover (rAF-coalesced pick), click = movement <= 3 px, alt/middle drag pans, wheel zoom about the cursor with a native non-passive `wheel` listener (React's `onWheel` is passive, `preventDefault` would be ignored; `useCanvasZoom` already uses `addEventListener('wheel', ..., { passive: false })`). Touch: `touch-action: none` on the canvas only, a `Map` of active pointers, `setPointerCapture`, one finger drags past 8 px to pan, two pointers pinch about the midpoint, a pointer that ends within 8 px is a tap. Model events as plain objects into a reducer that returns actions so it is testable without a DOM; the component only translates DOM events. Playwright can drive it: `Input.dispatchTouchEvent` through a CDP session with two touch points produces two `pointerType: 'touch'` pointers and pointermove events with a measurable distance ratio [VERIFIED: recipe run in Chromium: down x2, pinch ratio 1.17 to 2.67, up x2]; `page.touchscreen.tap` produces down/up for a tap.

### Anti-Patterns to Avoid

- **Re-rasterizing static layers on hover** (P4). Use layer opacity and the overlay.
- **Building `g`, `view`, `layoutTarget` or `Record<number, Pos>` for a base above the ceiling on the main thread** (P6).
- **`new URL('x.ts', import.meta.url)` outside `new Worker(...)`** (raw TS in `out/`, breaks root `tsc`).
- **Terminate/respawn the worker per request** (breaks offline reuse).
- **Letting the pending base switch be superseded by a layout click** (P3): re-issue the full desired record.
- **Reading the ceiling, the 7 px threshold or the area limit as literals** in components or tests.
- **Rendering list panels from a non-null `view` at the Canvas tier** (P9).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker bundling and chunk URL under basePath | A custom webpack config, a Blob worker, a copy into `public/` | `new Worker(new URL('<literal>', import.meta.url))` | Verified: webpack emits the hashed chunk and resolves the public path including basePath |
| SVG path rendering on Canvas | A path renderer for `M L Q A` | `new Path2D(d)` for the few on-demand or pair-graph strings; typed-array `moveTo/quadraticCurveTo` for the bulk | Platform parser handles `A`; the bulk path avoids per-string cost |
| Hit-testing via pixels | An id-buffer canvas | Grid + segment distance (pure TS) | Measured; exact; no antialias artefacts |
| Multi-pointer gesture recognition | A gesture library | A small reducer over Pointer Events (`DemonMatrix.tsx` precedent) | UI-SPEC forbids new dependencies |
| Spatial index | RBush or similar | Uniform grid (CSR typed arrays) | No dependency; n <= 4000 |
| Worker RPC | comlink or a message bus | The four-field request/response protocol above | Needs only id, key, latest-wins |
| Zone label formatting in the worker | A second formatter | `formatZoneLabel` / `zoneLabelsFor` (`app/lib/labelScheme.ts` imports only engine, customAlphabet, xenotation: DOM-free) | Same strings as the SVG tier |
| Tier selection | An ad-hoc `n > 4000` in a component | `selectTier` over `boundaries` | D-01, REN-02 |

**Key insight:** every expensive thing here already exists as a pure function (layout, routes, text, summary); the new work is packaging (typed arrays, protocol) and drawing, not new math. The risky parts are integration discipline (stale results, main-thread `createNumogram` calls, list panels) rather than algorithms.

## Common Pitfalls

### P1: Main-thread cost model assumed wrong
**What goes wrong:** Treating "move everything to a worker" as the fix for slowness at 202-4000, or leaving a main-thread `createNumogram(2^26)` in place.
**Evidence:** native cost per step at n = 4000: `createNumogram` 0.26 ms, `buildNumogramView` 11.1 ms, `resolveLayout` ring 5.1 ms, `routeGates` 5.5 ms, `routeCurrents` 7.4 ms, `numogramText` (limit raised to 5000) 7.2 ms; 65,536: `createNumogram` 3.8 ms; 2^20: 10 ms; 2^26: 625 ms (+271 MiB per Phase 2). The spike's throttled `computeMs` at n = 4000 is 119 ms (sw-6x).
**How to avoid:** the worker's real job is above-ceiling summary/text and a uniform stale protocol; remove every main-thread `createNumogram(n)` from the commit path (P6). **Warning sign:** the heartbeat e2e shows a rAF gap above the bound while typing 67108864.

### P2: A synchronous commit or older result overwrites a newer state
**What goes wrong:** Typing 67108864 then clicking the 100 chip: the SVG-tier (synchronous) commit runs, then the 2^26 worker result arrives and replaces it. The worker is FIFO, so the older job finishes first.
**How to avoid:** one monotonically increasing `latestId` owned by the client; every commit path (worker or sync) bumps it; a response applies only if `id === latestId`.
**Warning signs:** unit test with a fake worker that replies out of order; e2e with a delayed `postMessage` wrapper.

### P3: A layout/packer/label change orphans a pending base switch
**What goes wrong:** While base B is pending (state still base A), clicking a layout button issues a request for (A, newLayout), superseding B.
**How to avoid:** the single `desired` record (Pattern 2); validate the layout against the *desired* base (`isLayoutIdFor`, `layoutIdsForBase`; the base-10 preset ids exist only at base 10); UI-SPEC says key handling and diagram pointer events are paused while pending.

### P4: Hover repaints the static layer
**What goes wrong:** Context dimming implemented by redrawing edges at 0.08 alpha. Cost at n = 4000, DPR 2: 29 ms (gpu), 249 ms (software, 6x throttle): breaks `interactionMs` 100 on the shipped profile.
**How to avoid:** Pattern 5 (opacity switch per edge layer, highlighted edges on the overlay). Add a fidelity-downgrade count for highlighted edges (checker recommendation 5): a region highlight or select-all can highlight up to about 8000 edges; decorated per-edge drawing (graded dots, arrowheads) was not measured, so above a count threshold draw highlighted edges as plain batched strokes at highlighted alpha and add a perf probe for it.

### P5: Selection panel and `InfoDisplay` blow up with large selections
**What goes wrong:** `selectedInfos` (NumogramClient.tsx:1036-1073) lists gate, current, syzygy and zone entries for the selection, and `InfoDisplay` renders one panel-group item per entry with an O(k^2) `kept.includes` pass (InfoDisplay.tsx:493). Rubber-band or select-all at n = 4000 yields roughly 14,000 entries.
**How to avoid:** cap the Selection list at the Canvas tier (render the first N and a "and M more" row), and keep selection state as a `Set` of zones; the SVG tier (<= 200) is unaffected.

### P6: Main-thread `createNumogram` call sites
**What goes wrong:** Even with a perfect worker, these run synchronously on the main thread: `NumogramClient.tsx:199` (`g = useMemo(createNumogram(base))`), `:366` (`commitBase` calls `createNumogram(n)` for `demonsAfterBaseSwitch`), `:639` and `:651` (URL hydration), and `app/lib/shareParams.ts:193` (`parseShareParams` builds a numogram when `region=`, `isolate=` or `mute=` is present).
**How to avoid:** at the Canvas tier (<= ceiling) main-thread `g` is cheap (0.26 ms) and needed by hover/info/regions/demons: keep it. Above the ceiling the main thread must not build `g` on commit: the headless view needs only `base`, `summary`, `text`. Build `g` lazily when the Demons overlay opens or a demon focus must be validated (0.6 s at 2^26, user-initiated). `demonsAfterBaseSwitch` needs `facetCount(g, filter)`: with a null filter it needs no `g`; otherwise defer or compute from the worker's `summary.typeCounts`. For `region=` URL params above the ceiling, drop them (no Canvas/regions there) before calling the codec's numogram branch or move that branch behind the same lazy getter. `ViewContext.g` is typed non-null and read by seven components (DemonBrowser, DemonFacets, DemonFocusView, DemonMatrix, DemonsOverlay, InfoDisplay's DemonInfo and RegionsPanel; the five Demons components mount only inside the overlay), so the lazy getter must be resolved before the overlay mounts (or the context type changes): Open Question 1.

### P7: Initial render shows the base-10 SVG, not a Canvas shell
**What goes wrong:** `useState(10)` renders base 10 first; at `?base=1024` the hydration effect then requests the worker. `e2e/viewer-helpers.ts#openViewer` resolves on the first `[data-diagram]` (the base-10 `<svg>`), so tests race the swap.
**How to avoid:** treat that first base-10 render as "the last result" (dimmed with the status after the 150 ms grace); add a helper that waits for `[data-render-tier="canvas"][data-canvas-state="ready"]` and use it in the new and rewritten specs.

### P8: UI-SPEC scale rule breaks on tall layouts
**What goes wrong:** `s = (windowCssWidth / layout.width) x zoom` with the ladder: frame 19 x 4096 at n = 4000 (386 x 4096 at 200, 117 x 4096 at 666, 76 x 4096 at 1024). At zoom 1 that is 30 css px per unit, so the diagram is far larger than the window; the UI-SPEC's own "Fit letterboxes inside this window (height clamp 100vh - 96)" contradicts it.
**How to avoid:** `fitScale = min(W / width, H / height)`, `s = fitScale x zoom`, zoom relative to fit; the max-zoom formula `max(5, 2 x labelVisibleMinRadiusPx / R_px_at_fit)` clamped to 100 must use the fit-based `R_px`. Measured fit `R_px` (ring/spiral/pair graph, 580 px column): 4.97 at 202 ring, 1.96 at 666 ring, 2.60 at 1024 ring, 0.63 at 4000 ring (zoom for 7 px = 11.2), 0.60 at 4000 pair graph. Labels are never visible at fit anywhere in the Canvas range for these layouts. The ladder at large n is a hairline strip; it still must not overflow the page.

### P9: List panels render thousands of rows once `view` is non-null at the Canvas tier
**What goes wrong:** Zones, Syzygies, Currents and Gates panels render from `view` whenever it is non-null (they branch on `!view`). At the Canvas tier `view` must be non-null (InfoDisplay, callouts, regions), so unvirtualized lists of 4000 rows times four panels would render.
**How to avoid:** add `tier` and `interactiveMaxN` to `NumogramViewContextValue`, and make those four panels early-return the UI-SPEC note when `tier === 'canvas'`; `LayersPanel`, `PanelUnavailable` copy and the Particles `N/A` row key off the same field. `DemonsOverlay`'s `showDiagram` prop must become "a diagram exists" (`tier !== 'headless'`), otherwise the Focus tab keeps saying there is no diagram.

### P10: Worker and page weight accounting
**What goes wrong:** The worker chunk (37.7 KB raw with lore, 13.6 KB gzip) is not referenced from the HTML, so `check:weight` never sees it; the Canvas renderer and client code do land on `/numogram/` and will exceed the max(1 KiB, 5%) tolerance. **How to avoid:** expect to raise the baseline with `node scripts/page-weight.mjs update --reason "..."` (Phase 4 and 5 precedent) and consider recording the worker chunk size in the plan summary.

### P11: Base-10 lore in the worker bundle
**What goes wrong:** `numogramText.ts` imports `summarize` from `numogramView.ts`, which imports `app/presets/base10/*` (verified: the worker chunk contained lore strings such as "Djynxx"). **How to avoid:** move `summarize` to its own module and re-export it from `numogramView.ts` (existing imports and tests keep working); the worker then imports engine plus lore-free modules.

### P12: The base-ten grep gate scans every new `app/` file
**What goes wrong:** `scripts/check-repo.mjs` (`BASE_TEN_PATTERNS`) fails the verify gate on lines like `x <= 4`, `x > 9`, `x <= 9`, `length: 10`, `9 - x`, `} = 9`, or a literal `[1, 2, ..., 9]` in any tracked `app/**/*.ts(x)` outside `app/presets/base10/`. Page-step or slop constants written as `n > 9` or `{ length: 10 }` will trip it. **How to avoid:** use named constants (`PAGE_STEP = 10` is fine; `length: PAGE_STEP`), run `node scripts/check-repo.mjs --only base-ten` after each module.

### P13: Wheel zoom and the SVG zoom range
**What goes wrong:** `useCanvasZoom` clamps zoom to 0.3-5 and is a CSS-scale, percent-origin model; reusing it caps Canvas zoom at 5 and cannot reach readable labels at n = 4000. The SVG range is part of the frozen behaviour baseline. **How to avoid:** a separate Canvas zoom state (range to 100, native non-passive wheel listener), `ViewControls` fed by it, and a Canvas `Fit` that uses the canvas transform, not `getScreenCTM`. Also generalize the two `querySelector('svg')` users: Selection panel initial position (NumogramClient.tsx:443) and rubber-band `finalizeSelection` (:556-573).

### P14: Pair-graph routes use SVG arcs
**What goes wrong:** `routePairGraph` emits `M x y A r r 0 f s x y` for arcs and loops (verified sample), unlike zone-layout routes (`M`, `L`, `Q` only). A quadratic-only parser mis-draws or throws on the pair graph. **How to avoid:** draw those strings through `Path2D(d)`; flatten circular arcs analytically for picking.

### P15: A detached or doubly-listed transferable
**What goes wrong:** transferring `layout.x.buffer` detaches it in the worker (fine) but a second transfer of the same buffer, or views sharing a buffer, throws or silently detaches a sibling. **How to avoid:** copy into fresh arrays, dedupe the transfer list, unit-test that every buffer in `transfer` is distinct and that the response arrays have the expected lengths.

### P16: Tests assume bases 202-4000 show a summary
See "Existing tests that legitimately change". Rewrite, do not skip.

### P17: Worker started in an effect
**What goes wrong:** StrictMode double-runs the effect (verified in dev: two chunk requests). **How to avoid:** lazy creation inside `WorkerClient.request`, `dispose()` on unmount, idempotent.

### P18: `Worker` creation failures are asynchronous
**What goes wrong:** a 404 chunk or blocked worker surfaces as an `error` event after construction, not an exception. **How to avoid:** `onerror` marks the client dead and re-runs pending requests through the fallback; cover with an e2e that replaces `window.Worker` with a throwing/erroring stub via `addInitScript`.

### P19: The base picker snaps its numeral back while the worker computes
**What goes wrong:** `BasePicker` (app/components/numogram/BasePicker.tsx) calls `onCommitBase` and then `setDirty(false)` in `evaluateNow` (:84-93), and the effect at :65-67 (`if (!dirty) setCandidate(String(base))`) re-syncs the visible text to the committed `base` prop. With the worker, `base` stays the old displayed base until the swap, so the typed numeral would flicker back to it. The UI-SPEC wants the numeral to show the requested base and the summary span to show `Computing base {n}...`.
**How to avoid:** give `BasePicker` the requested base and a status string (new props), keep the 200 ms debounce and Enter/chip commit semantics, and add the persistent sr-only `role="status"` carrier the UI-SPEC checker asked for (a `role` added only at swap time is not reliably announced). Everything new carries `data-post-baseline`. Failure copy goes through the picker's existing inline refusal slot.

### P20: The Regions panel is unvirtualized at the Canvas tier
**What goes wrong:** `RegionsPanel` lists `regionRows(g)` for any base with two icon buttons per row. Across even bases 202 to 4000 the most Torque cycles is 130 (n = 3856), so up to about 132 rows (measured with the engine: 14 at 666, 54 at 1024, 42 at 4000). That is acceptable DOM, but each Isolate/Mute toggle changes the zone states and so costs one static re-raster (the P4 cost model). A region highlight on a large cycle can highlight thousands of edges at once (the P4 fidelity downgrade applies).

## Code Examples

Patterns verified in this session are marked; the rest are sketches for the planner to adapt.

### Worker shell (typechecks under the root tsconfig, DOM lib) [VERIFIED: tsc in scratch]

```ts
// workers/numogram.worker.ts  (classic worker once bundled; no `type` option)
import { handleRequest } from '../app/lib/worker/buildResult'
import type { WorkerRequest } from '../app/lib/worker/protocol'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { response, transfer } = handleRequest(e.data)   // never throws: errors become {type:'error'}
  self.postMessage(response, { transfer })               // the array form `postMessage(msg, [buf])` fails TS2769 here
}
export {}
```

### Worker factory (the only place `new Worker` appears) [VERIFIED pattern]

```ts
// app/lib/worker/workerClient.ts
export const createNumogramWorker = (): Worker =>
  new Worker(new URL('../../../workers/numogram.worker.ts', import.meta.url))   // literal only; no options, no variable
```

### Latest-wins client skeleton (testable with a fake `WorkerLike`)

```ts
export class WorkerClient {
  private latestId = 0
  private inFlight: number | null = null
  private pending: WorkerRequest | null = null
  constructor(private makeWorker: () => WorkerLike | null, private fallback: (r: WorkerRequest) => WorkerResponse) {}
  request(req: Omit<WorkerRequest, 'id'>, onResult: (r: WorkerResponse) => void): number {
    const id = ++this.latestId
    // ...send immediately if idle, else replace `pending`; on response: if (resp.id !== this.latestId) return (stale)
    return id
  }
  supersede(): void { this.latestId++ }   // a synchronous commit calls this (P2)
  dispose(): void { /* terminate worker, drop callbacks; idempotent for StrictMode */ }
}
```

### Shipped-ceiling selection and validator (Pattern 1)

```ts
// engine/scene/tiers.ts (sketch)
export function selectTier(n: number, table: Pick<TierTable, 'boundaries'>, override?: RenderTier): RenderTier {
  if (override !== undefined) return override
  if (n <= table.boundaries.svgRichMaxN.n) return 'svg'
  const ceiling = Math.min(table.boundaries.canvasMaxN?.n ?? Infinity, table.boundaries.interactiveMaxN?.n ?? Infinity)
  return n <= ceiling ? 'canvas' : 'headless'
}
// validateTierTable additions, one message per rule, for a measured table:
//   interactiveMaxN missing | not an integer >= svgRichMaxN.n | basedOn !== shippedProfile
//   interactiveMaxN.n > derived.maxMeasuredN | (canvasMaxN !== null && interactiveMaxN.n > canvasMaxN.n)
```

### Zone grid pick (nearest-wins metric) [VERIFIED cost: 1 us per pick at n = 4000]

```ts
// world point p = fromScreen(cursor); s = css px per world unit; R = nodeRadius (world)
const rq = R + PICK_RADIUS_PX / s                       // PICK_RADIUS_PX = 12 (a named constant, not a table value)
for (each cell overlapping [p - rq, p + rq]) for (each zone z in cell) {
  const d = Math.max(0, Math.hypot(px - cx[z], py - cy[z]) * s - R * s)   // distance 0 on the disc
  if (d <= PICK_RADIUS_PX && better(d, 'zone')) best = { kind: 'zone', id: z, d }
}
```

### Recording 2D context for draw tests (no DOM, no canvas package)

```ts
const calls: string[] = []
const ctx = new Proxy({}, { get: (_t, k) => (...a: unknown[]) => { calls.push(`${String(k)}(${a.join(',')})`) }, set: (_t, k, v) => { calls.push(`${String(k)}=${v}`); return true } })
drawStatic(ctx as unknown as Ctx2D, scene, state)       // assert strokeStyle hexes, lineWidth floors, fillText count (LOD), no gate stroke at n > 150
```

### Playwright: worker URL under basePath, offline reuse, deterministic stale scenario

```ts
// e2e/static-export.spec.ts addition (runs at root and, via test:e2e:basepath, under /ccrug)
const urls: string[] = []
page.on('worker', w => urls.push(w.url()))
await page.goto(`${BASE}/numogram/?base=28&tier=canvas`)
await expect(page.locator('[data-render-tier="canvas"][data-canvas-state="ready"]')).toBeVisible()
expect(urls).toHaveLength(1)
expect(urls[0]).toMatch(new RegExp(`${esc(BASE)}/_next/static/chunks/[^/]+\\.js$`))
await context.setOffline(true)                                  // the existing worker keeps answering; do not expect a new Worker to start
// ...change base through a chip with tier=canvas still in force; assert ready again
```

```ts
// test-only staleness: delay older requests so replies arrive reversed (nothing added to production code)
await page.addInitScript(() => {
  const proto = Worker.prototype
  const post = proto.postMessage
  proto.postMessage = function (msg: { id?: number; base?: number }, ...rest: unknown[]) {
    const delay = (window as unknown as { __delayFor?: (m: unknown) => number }).__delayFor?.(msg) ?? 0
    setTimeout(() => (post as Function).apply(this, [msg, ...rest]), delay)
  }
})
```

### Two-finger pinch through CDP [VERIFIED recipe]

```ts
const cdp = await context.newCDPSession(page)               // context created with { hasTouch: true }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 200, id: 1 }, { x: 210, y: 200, id: 2 }] })
for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150 - i * 10, y: 200, id: 1 }, { x: 210 + i * 10, y: 200, id: 2 }] })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
```

### LOD probe without a production hook

```ts
await page.addInitScript(() => {
  const real = CanvasRenderingContext2D.prototype.fillText
  ;(window as unknown as { __fillText: number }).__fillText = 0
  CanvasRenderingContext2D.prototype.fillText = function (...a: Parameters<typeof real>) {
    ;(window as unknown as { __fillText: number }).__fillText++
    return real.apply(this, a)
  }
})
// at 4000 fit: after ready, __fillText is 0 for zone labels; zoom until R_px crosses the table threshold: it becomes > 0
```

## Measured Costs (n = 4000, ring layout, 580 css px column; this PC, Chromium 153)

| Measure | gpu, no throttle | `--disable-gpu`, CDP CPU 6x |
|---------|------------------|-----------------------------|
| `new Path2D(d)` for 10,000 route strings via `addPath` | 11.1 ms | 102.7 ms |
| One joined string per layer | 1.7 ms | 13.9 ms |
| Parse M/L/Q strings to `Float64Array` | 4.8 ms | 37.9 ms |
| `Path2D` from typed arrays | 0.6 ms | 4.0 ms |
| Static paint at fit, DPR 1 / 2 / 3 | 6.4 / 29.4 / 35.5 ms | 77.7 / 249.3 / 279.4 ms |
| Static paint at zoom 20, unculled, DPR 1 / 2 / 3 | 2.8 / 18.9 / 19.8 ms | 24.9 / 129.9 / 136.0 ms |
| Cached-bitmap blit frame, DPR 2 | 0.6 ms | 5.7 ms |
| Pick, brute force over 38,000 segments | 0.215 ms | 1.395 ms |
| Pick, zone grid (rq 74 / rq 240 world units) | 1.0 / 1.5 us | 2.0 / 9.5 us |
| id-buffer build, 2000 per-pair strokes, DPR 2 | 11.3 ms | 96.3 ms |
| `fillText` x 4000 | 5.3 ms | 49.8 ms |

Engine and view (native Node): see P1. Spike table rows for the shipped profile at n = 4000 (sw-6x): Canvas static paint 136.3 ms (`oneTimePaintMs` budget 500), overlay redraw 0.6 ms (`interactionMs` 100), cached-blit pan 21.4 ms (`panMs` 32), `computeMs` 118.7 ms. Caveat: the spike painted a 1000 x 800 store at DPR 1 without labels or node strokes; the DPR 2 and 3 figures above are this session's estimate of the real renderer and the spike table was not changed. These numbers are for sizing, not for test assertions (tests never depend on this PC's speed).

## Existing Tests That Legitimately Change (rewrite, never skip)

| File | Why | Needed change |
|------|-----|---------------|
| `tests/app/numogramText.test.ts:99-105` (`bigBaseMessage`) | New copy and signature `Base {n} is above the interactive limit of {ceiling}. Showing the summary and text view. To draw it, use headless export.`; zone count dropped; cutoff is the shipped ceiling | Rewrite with the ceiling read from the table; add the tier-override string test |
| `tests/app/numogramText.test.ts:107-110` (`TEXT_VIEW_ZONE_LIMIT` is 1024) | Only if UI-SPEC decision 4 is taken (limit follows the ceiling): text at 4000 is 358 KB and 7.2 ms | Update the constant test and the "base 4096 above the limit" describe (:77) deliberately |
| `e2e/url-codec.spec.ts:72-85` (`?base=1024` summary and no diagram) | 1024 is Canvas now | Move the summary assertions to a base above the ceiling (read from the table) and assert `[data-render-tier="canvas"]` at 1024 |
| `e2e/base-picker.spec.ts:126-130` (chip 1024 expects `SUMMARY` and no `DIAGRAM`) | **Not listed by the UI-SPEC**; same cause | Assert the Canvas tier after the chip, summary only above the ceiling |
| `e2e/demons-browser.spec.ts:54` (`DIAGRAM` count 0 at base 666) and :234 (base 1024 pager) | 666 and 1024 now draw a canvas that carries `data-diagram` | Replace the "no diagram" assertion with the Canvas assertion; keep the demon assertions |
| `e2e/demons-focus.spec.ts:81-86` (title and `DIAGRAM` count 0 at 666) | same | Retitle; the Focus tab still works through its own zone input; with a diagram present, focus chords also draw on the canvas |
| `e2e/demons-matrix.spec.ts:110-114` (`DIAGRAM` count 0 at 666); :129 loop `[28, 666, 4096]` | 666 is Canvas; 4096 is above the ceiling (headless) | Drop the no-diagram assertion; the timing loop stays valid |
| `e2e/viewer-helpers.ts#openViewer` | resolves on the first `[data-diagram]` or summary; at Canvas bases that is the transient base-10 SVG (P7) | Add a Canvas-aware wait; do not change the SVG behaviour of the helper for existing specs |
| `tests/app/tierBounds.test.ts`, `engine/test/tiers.select.test.ts`, `engine/test/tiers.schema.test.ts`, `tests/spike/shape.test.ts` | New datum and selection rule | Extend (do not weaken): boundaries at 200, 202, ceiling, ceiling + 2; validator mutants; shape carries the field |

## Must Stay Byte-Identical

- `e2e/__golden__/**` (60 DOM goldens plus `MANIFEST.json`), `e2e/__behaviour__/**` (5 JSON plus manifest), `engine/test/fixtures/**` (`base10.golden.json`, `derived/notable-bases.golden.json`, both manifests), `engine/test/layout.digest.test.ts` digests (a digest changes only with a new sign-off).
- `Projection.tsx` and `PairGraphProjection.tsx` output and, ideally, the files themselves; `app/presets/base10/**`; the SVG tier's zoom range 0.3-5 in `useCanvasZoom`.
- `tier-table.json` measurement rows (144), derived boundaries and `webglDecision`; only the new shipped-ceiling field is added.
- `npm run test:swap` (build + goldens + behaviour baseline + vitest) must pass unchanged right after the first `NumogramClient.tsx` edit; new wrapper attributes (`data-render-tier`) must not alter anything the behaviour collector reads (it samples named regions and `data-post-baseline` subtrees, `e2e/behaviour-collect.ts`), and all new DOM carries `data-post-baseline=""`.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hand-rolled worker URLs / `worker-loader` | webpack 5 `new Worker(new URL(..., import.meta.url))`, native in Next 14 | No config change; classic worker with `importScripts` chunk loading |
| Canvas hit regions (`addHitRegion`) | Own geometric hit-testing plus a live region | Hit regions are not broadly available [ASSUMED] |
| Per-frame full Canvas redraw | Layered canvases: cached static bitmap, overlay, compositor transforms | The shape the Phase 3 spike measured (flat blit cost) |

**Deprecated/outdated:** `postMessage(msg, [buffers])` array form is not type-valid under the DOM lib this repo compiles workers with; use `{ transfer }`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ROADMAP criterion 5 "computes base 28 through the worker offline" means: no external/server dependency (static files only) and an already-created worker keeps working with the network off; it cannot mean a first-ever `new Worker()` succeeds while offline (verified to fail) | Pattern 2, evidence table | The criterion could be read as requiring a service worker or eager pre-warm; planner should state the interpretation in the plan |
| A2 | Gesture-time stretching of the cached bitmap (CSS transform during wheel/drag/pinch, re-raster on gesture end) satisfies the UI-SPEC "never leave a bitmap stretched by more than one frame" | Pattern 5 | If a per-frame re-raster is required it costs 30-250 ms per frame at fit on the shipped profile (fails `panMs` 32); needs a user/UI decision |
| A3 | Context dimming by layer opacity (instead of per-pixel repaint) is an acceptable rendering of the UI-SPEC context column (composite error about 3% in alpha on edges touching a highlighted zone) | Pattern 5, P4 | Visible deviation from SVG parity if the user wants exact alpha |
| A4 | `addHitRegion` is not usable in current browsers | Pattern 6 | Low; we do not use it |
| A5 | Coalescing live-region announcements to one per frame and toggling a zero-width character for repeats is adequate for screen readers | Pattern 7 | Announcement flooding or dropped repeats; needs a manual screen-reader pass (not automatable) |
| A6 | Flattening quadratics to 6 to 8 chords is within the 12 px pick tolerance for every layout | Pattern 6 | A long strongly-curved edge at high zoom could mis-pick by a few px |
| A7 | Building main-thread `g` lazily (Demons overlay open, 0.6 s at 2^26) is acceptable above the ceiling | P6 | Overlay open at 2^26 freezes for about 0.6 s on this PC; the alternative (worker-hosted demon space) is a large scope increase |
| A8 | A `webpackChunkName` magic comment would give the worker chunk a stable name | not tested | If used, test it; the plan can assert the URL shape (`/_next/static/chunks/*.js`) instead |
| A9 | The measured benchmark proxies (gpu 1x; `--disable-gpu` + CDP 6x) approximate the shipped `sw-6x` profile | Measured Costs | Real low-end devices may differ; probes are for sizing only |

## Open Questions

1. **Main-thread `g` above the ceiling.**
   - Known: `ViewContext.g` is non-null and read by seven components (five of them inside the Demons overlay); main-thread `createNumogram(2^26)` is 625 ms.
   - Unclear: type change (`g: Numogram | null`) versus a lazy getter resolved before the overlay mounts.
   - Recommendation: keep `g` non-null for tiers svg and canvas; for headless build it lazily on first overlay open or demon focus, and make `commitBase` and URL hydration not touch it (P6). Ask the user only if a 0.6 s one-time overlay-open delay at 2^26 is unacceptable.
2. **UI-SPEC scale rule versus fit (P8).** Recommendation: fit-relative zoom; confirm in plan checking that the UI-SPEC "Scale rule" is superseded.
3. **Gesture stretching (A2) and context dimming (A3).** Both are performance-driven readings of the UI-SPEC; the plan should record them as `[default]` decisions.
4. **`TEXT_VIEW_ZONE_LIMIT` (UI-SPEC decision 4).** Recommendation: follow the ceiling (text at 4000 is 358 KB, 7 ms) so the non-visual fallback is complete at every Canvas base; worker builds it.
5. **`ShortcutsModal` and keyboard model split.** The SVG tier keeps its flat roving order; the Canvas tier follows the UI-SPEC model. Confirm the qualifier text "Up to {svgRichMaxN} zones" for the existing line.
6. **Worker chunk size reporting.** `check:weight` cannot see it; decide whether to log it in the plan summary or extend the script.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, tests | yes | v22.16.0 [VERIFIED] | none needed |
| npm | scripts | yes | 11.6.2 locally (CI 10; no dependency change planned) [VERIFIED] | none needed |
| Next.js | static export, worker bundling | yes | 14.2.35 [VERIFIED] | none |
| Playwright + Chromium | e2e, CDP touch, worker events | yes (ran in this session) | 1.63.0 / Chromium 153 [VERIFIED] | none |
| `serve` | e2e static server | yes | 14.2.6 [VERIFIED: package.json, ran] | none |
| jsdom / happy-dom | component tests | no | not installed [VERIFIED: package.json] | pure modules + `renderToStaticMarkup` + Playwright |

**Missing dependencies with no fallback:** none. **Note:** a stale `serve out` process from 2026-09-29 (PID 13912, not listening) exists on this machine; unrelated to this phase.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (node env; projects `engine` = `engine/**/*.test.ts`, `oracle` = `tests/**/*.test.ts`), Playwright 1.63.0 (projects `chromium-utc`, `chromium-ny`) |
| Config file | `vitest.config.mts`, `playwright.config.ts` |
| Quick run command | `npx vitest run <file> --project oracle` (or `--project engine`); `npm run typecheck` when types change; `node scripts/check-repo.mjs --only base-ten` |
| Full suite command | `npm run verify` (about 2 to 4 minutes; includes the sub-path e2e, build, page-weight, 60 goldens) |

### Sampling points (bases and what each proves)

| Base | Role |
|------|------|
| 10, 28, 64, 100, 200 | SVG tier, synchronous, must be unchanged (goldens, behaviour baseline) |
| 28 and 64 with `?tier=canvas` | Worker path at a small base: offline/basePath check, SVG-versus-Canvas parity of node centres and picks, pair graph at 64 |
| 202 | First Canvas base (boundary + 2); first base where fit `R_px` < 7 for ring |
| 666 | Demons overlay with a diagram present; 14 Torque cycles; old "no diagram" specs |
| 1024 | Notable chip; formerly the summary base; 54 Torque cycles |
| 4000 | The shipped ceiling: still Canvas; 38,000 pick segments; labels need zoom about 11 |
| 4002 | First headless base: message, summary, text; no `g`, no `view` |
| 65,536, 2^20 | Worker-owned summary/text; main thread never builds `g` |
| 2^26 (67108864) | Worst case: heartbeat gap, stale 2^26 result discarded after a later request |
| 27, 99999999999, malformed | Existing refusals unchanged |

### Phase Requirements to Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| REN-02 | `selectTier` boundaries from data: 200, 202, ceiling, ceiling + 2; override wins; validator rules and mutants for `interactiveMaxN`; `shape.ts` carries the field | unit (engine) | `npx vitest run engine/test/tiers.select.test.ts engine/test/tiers.schema.test.ts tests/app/tierBounds.test.ts tests/spike/shape.test.ts` | extend existing |
| REN-02 | Typed-array scene: lengths, finite numbers, route endpoints equal the engine route strings, determinism, ring/ladder/spiral/pairGraph at 2..64 sweep and 202, 666, 1024, 4000 | unit (engine) | `npx vitest run engine/test/scene.canvasScene.test.ts` | Wave 0 |
| REN-02 | View transform: fit for tall frames (ladder), zoom clamp formula, DPR/area cap read from table, LOD boundary read from table | unit | `npx vitest run tests/app/canvasView.test.ts` | Wave 0 |
| REN-02 | Pick: grid equals brute force (fast-check), 12 px boundary (5 and 11 in, 13 out), nearest-wins, tie order zone/syzygy/current/gate/chord, muted excluded, isolate-dimmed included, pair pill | unit | `npx vitest run tests/app/canvasPick.test.ts` | Wave 0 |
| REN-02 | Draw calls through a recording context: palette hexes, widths with floors, alpha table, dashes, no label below the LOD threshold, gate layer off above `gatesThinMaxN` but on-demand gate drawn, underlay for highlight | unit | `npx vitest run tests/app/canvasDraw.test.ts` | Wave 0 |
| REN-02 | Keyboard model: order, wrap, Home/End, Page +/-10 clamp, Tab sub-stops skipping muted/absent, announcement strings equal the SVG tier's | unit | `npx vitest run tests/app/canvasKeyboard.test.ts` | Wave 0 |
| REN-02 | Pointer state machine: click slop 3 px, touch tap/pan 8 px, pinch ratio and midpoint, pointercancel | unit | `npx vitest run tests/app/canvasInteraction.test.ts` | Wave 0 |
| REN-02 | Canvas DOM contract: wrapper `data-render-tier`/`data-canvas-state`, canvas `role=application`, `aria-label` strings, live region, list panels show the Canvas note | SSR smoke | `npx vitest run tests/app/canvasDiagramRender.test.ts` | Wave 0 |
| REN-02 | Canvas parity at 28/64 (`tier=canvas` vs `tier=svg`): hover at the SVG-measured node centre yields the same callout; LOD fillText count; pick offsets 5/11/13 px at 202+ | e2e | `npx playwright test e2e/canvas-tier.spec.ts --project=chromium-utc` | Wave 0 |
| REN-02 | Narrow windows (375x667, 768x1024): no body overflow, canvas width 359, pinch changes `data-zoom`, drag changes `data-tx`, tap pins | e2e | `npx playwright test e2e/canvas-interaction.spec.ts --project=chromium-utc` | Wave 0 |
| REN-02 | Keyboard: Tab to canvas, arrows move `data-focus-key`, live region text, Enter pins, gate reachable with the gate layer off | e2e | same spec | Wave 0 |
| REN-03 | `buildResult`: summary equals `summarize`, text equals `numogramText`, error responses for odd/invalid base, `scene: null` above the ceiling, buffer list distinct | unit | `npx vitest run tests/app/workerCore.test.ts` | Wave 0 |
| REN-03 | `WorkerClient`: out-of-order replies, latest-wins slot, sync commit supersedes, dispose idempotent, no-Worker and error fallback, ceiling refusal copy | unit (+ fast-check) | `npx vitest run tests/app/workerClient.test.ts` | Wave 0 |
| REN-03 | Worker in the exported site, root and `/ccrug`: worker URL under the chunk path, ready state, no foreign or failed requests, base change works offline with the existing worker | e2e | `npx playwright test e2e/static-export.spec.ts` and `npm run test:e2e:basepath` | extend existing |
| REN-03 | Stale results: delayed-`postMessage` wrapper reverses replies; 2^26 typed then a smaller base: the over-limit summary never appears; final state is the last request | e2e | `npx playwright test e2e/worker.spec.ts --project=chromium-utc` | Wave 0 |
| REN-03 | Responsiveness at 2^26: rAF heartbeat gap during the commit stays under a generous bound (guards a main-thread `createNumogram`); the one timing-based guard, bound chosen well above scheduling noise | e2e | same spec | Wave 0 |
| REN-03 | Ceiling message and degradation: 4000 is Canvas, 4002 is the summary with the ceiling read from the table, the tier-override string at `tier=headless` within the limit, no-`Worker` copy | e2e + SSR smoke | `npx playwright test e2e/worker.spec.ts`; `npx vitest run tests/app/bigBaseSummary.test.ts` | Wave 0 |
| (regression) | Frozen oracles and SVG path unchanged | e2e + unit | `npm run test:swap` | existing |

Mutation checks to run once (the Phase 2 precedent): drop the `id === latestId` check; change the pick radius or swap two tie classes; hard-code the ceiling in a component (a test with an injected table must fail); change `labelVisibleMinRadiusPx` read to a literal; remove `supersede()` from the sync commit.

### Sampling Rate

- **Per task commit:** `npx vitest run <changed test files>` plus `node scripts/check-repo.mjs --only base-ten` (new `app/` code) and `npm run typecheck` when types or the worker directory change.
- **Per wave merge:** `npm run test` and `npm run test:swap` after any `NumogramClient.tsx` edit, plus the new e2e specs for that wave.
- **Phase gate:** `MSYS_NO_PATHCONV=1 npm run verify` green before `/gsd-verify-work`; page-weight baseline raised only via `update --reason`.
- **basePath coverage:** `npm run test:e2e:basepath` builds with `NEXT_PUBLIC_BASE_PATH=/ccrug`, stages `out/` under `.e2e-basepath/ccrug/` and runs **only** `e2e/static-export.spec.ts` (package.json script), so the sub-path worker proof must be a test in that file; it also runs in both Playwright projects at the root path in the normal e2e run.

### Wave 0 Gaps

- [ ] Unit test files listed above (engine scene, view transform, pick, draw, keyboard, interaction, worker core, worker client, big-base summary/render).
- [ ] `e2e/canvas-tier.spec.ts`, `e2e/canvas-interaction.spec.ts`, `e2e/worker.spec.ts`, and the added worker test in `e2e/static-export.spec.ts`; a Canvas-aware helper next to `openViewer`.
- [ ] No framework install needed.

## Security Domain

> `security_enforcement` is not set to false; included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | static site, no accounts |
| V3 Session Management | no | none |
| V4 Access Control | no | none |
| V5 Input Validation | yes | `validateBase` (engine) is the single gate for `base`; the worker re-validates (`assertBase`) and enforces the ceiling for scene building; the `tier=` param is validated by `parseTierOverride`; worker messages are first-party but shape-checked by a type guard |
| V6 Cryptography | no | none |
| V12/V13 Resources and API | partly | bounded work: text bounded by `TEXT_VIEW_ZONE_LIMIT`/ceiling, scene only at <= ceiling, focus chords <= `FOCUS_CHORD_DRAW_MAX`, backing store capped by DPR 3 and `canvasAreaLimitPx` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Huge `?base=` or typed base exhausting memory/CPU | Denial of service | Worker owns summary/text; scene never built above the ceiling; no main-thread `createNumogram(n)` (P6); latest-wins queue cannot grow; the 2^26 safe ceiling stays |
| Unbounded canvas allocation (zoom, DPR, huge viewport) | Denial of service | Window-only backing store, DPR cap 3, `canvasAreaLimitPx` from the table, zoom clamp 100 |
| Text injection through labels/names | Tampering / XSS | Canvas `fillText` and React text nodes only; no `innerHTML`; custom alphabets already validated (T-04-04) |
| Stale result applied to the wrong base | Tampering (integrity of displayed data) | `id`/`key` check, one batched swap, UI-08 reset at swap time |
| Loading a worker from an unexpected origin | Spoofing | Same-origin hashed chunk only; no `blob:` or cross-origin URL; no `eval` |
| Static export leaking forbidden markers | Information disclosure (policy) | `scanStaticOut` scans emitted `.js` (including worker chunks); no new text introduced |

## Sources

### Primary (HIGH confidence)
- Scratch Next 14.2.35 experiment (this session): worker emission, chunk URLs at root and `/ccrug`, classic worker, `importScripts` loading, offline behaviour, `.ts` asset hazard, tsc/lint behaviour, dev-mode StrictMode double spawn, HTML not referencing the worker chunk.
- Repo files read: `next.config.js`, `package.json`, `tsconfig*.json`, `.eslintrc.json`, `vitest.config.mts`, `playwright.config.ts`, `scripts/check-repo.mjs`, `scripts/page-weight.mjs`, `scripts/stage-basepath.mjs`, `scripts/spike/harness.mjs`, `engine/scene/tiers.ts`, `tier-table.json`, `app/NumogramClient.tsx`, `ViewContext.tsx`, `numogramView.ts`, `renderData.ts`, `viewLayouts.ts`, `numogramText.ts`, `BasePicker.tsx`, `BigBaseSummary.tsx`, `Projection.tsx`, `PairGraphProjection.tsx`, `useCanvasPan.ts`, `useLayoutTween.ts`, `engine/layout/routing.ts`, `types.ts`, `shareParams.ts`, `demonState.ts`, existing e2e/unit specs.
- Benchmarks run in Chromium 153 via the repo's Playwright and Node via `tsx` (numbers in the tables above).
- webpack web-workers guide: https://webpack.js.org/guides/web-workers/ (literal `new Worker(new URL(...))`, variable form unsupported).

### Secondary (MEDIUM confidence)
- Safari canvas limits: https://www.pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ and https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/ (16,777,216 px per canvas, 384 MB total on iOS 15; secondary sources, same caveat STATE.md records for Phase 8).

### Tertiary (LOW confidence)
- Canvas hit-region API status (search results only): used only to justify not using it.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependency, versions read from package.json and node_modules.
- Worker bundling: HIGH, built and run against Next 14.2.35 in Chromium, root and basePath, plus dev mode.
- Architecture and costs: HIGH for measured numbers (sizing proxies), MEDIUM for the layered-canvas model's UX equivalence to the SVG tier (A2, A3).
- Pitfalls: HIGH for P1-P6, P9-P15 (each tied to a read or measured fact), MEDIUM for P7, P16-P18.

**Research date:** 2026-10-05
**Valid until:** 2026-11-04 (stable: Next is pinned; re-check only if the table is re-measured or the ceiling changes)

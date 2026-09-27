---
phase: 03-procedural-layout-and-ceiling-spike
plan: 09
subsystem: testing
tags: [playwright, cdp, react, canvas, path2d, measurement-harness, ren-01, d11, d14b]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: "03-01/03-03/03-04/03-06/03-07: the committed engine/layout and engine/scene (ringLayout, spiralLayout, routeGates, routeCurrents, lerpPositions, layoutToSvg); 03-02: the tier-table schema (EnvironmentMeta, TierMeasurement, ChordMeasurement, CanvasProbe, HeadlessMeasurement) this plan's raw records are shaped into"
provides:
  - "scripts/spike/driver.ts: a dev-only Playwright driver (--profile gpu|sw|sw-4x|sw-6x --suite calib|limits|chords|svg-rich|svg-lean|canvas|headless|all [--ns] [--quick] [--fresh] [--no-compile]) that compiles engine/ to .spike/engine-js, serves it plus React 18 UMD and the harness from a cross-origin-isolated fake https://spike.test/ origin, and writes raw JSONL records plus environment metadata to .spike/raw/"
  - "scripts/spike/harness.mjs: the browser-side window.__spike measurement module — calib/rendererInfo/probeCanvas/memory (environment probes), build/mountSvg/hoverSvg/panCss/tweenSvg (real React 18 SVG-rich and SVG-lean tiers over the real engine), canvasStatic/canvasPan/canvasHover/canvasTween (a cached-static-bitmap Canvas tier), and chords (the synthetic all-chords density/legibility probe)"
  - ".gitignore: /.spike/ (raw measurement output, never committed; plan 03-10 shapes it into the committed engine/scene/tier-table.json)"
affects: [03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fake-origin route interception for cross-origin isolation: a Playwright context.route('https://spike.test/**') handler fulfills every request locally (page HTML, React UMD, the harness module, the compiled engine) with COOP/COEP/CORP headers, so performance.measureUserAgentSpecificMemory() resolves with zero real network access (T-03-25)"
    - "Dev-only tsc-to-outDir compile of a pure engine for the browser: execFileSync('node_modules/typescript/bin/tsc', ['-p','engine/tsconfig.json','--outDir','.spike/engine-js',...]) reuses the engine's own tsconfig (no bundler, no new dependency) and the driver's route handler appends '.js' to extensionless relative imports, mirroring the engine's own extensionless-import convention"
    - "One fresh Playwright page per (profile, suite, n): memory/heap deltas are bracketed tightly around the single operation being measured (e.g. mountSvg only, not the whole page lifecycle), never cumulative across measurements (research repeatability rule)"
    - "Tween reuses the destination layout's orientation arrays: a tween frame computes routeGates/routeCurrents on an interpolated { ...ring, x: X, y: Y } layout with opts.orientation taken from the spiral (destination) routes, so a gate bulge or current-junction side never flips mid-tween (Pitfall 6)"
    - "Adaptive stop, not a fixed n ceiling: svg-rich/svg-lean/canvas suites stop measuring larger n for the current (profile, suite) once mount exceeds 20s or hover-to-frame median exceeds 3s, recording { skipped: 'previous n too slow' } for the remaining sizes instead of hanging on a throttled profile"

key-files:
  created:
    - scripts/spike/driver.ts
    - scripts/spike/harness.mjs
  modified:
    - .gitignore

key-decisions:
  - "page.evaluate callbacks cannot close over outer Node-side helper functions (e.g. a `const win = () => window as SpikeWindow` defined in driver.ts) — Playwright serializes only the callback body via toString() and runs it in the browser process, so every window.__spike access is cast inline inside each evaluate callback (`(window as unknown as SpikeWindow).__spike...`) rather than through a shared closure. Found and fixed during Task 2's first smoke run (ReferenceError: win is not defined)."
  - "The chords suite is intentionally independent of the numogram engine (a synthetic n-point circle with all C(n,2) chords), matching 03-RESEARCH.md's own separation of the all-chords legibility question from the gate/current route cost — it measures a demon-relationship density limit, not the zone layout's own routing"
  - "REQUIREMENTS.md REN-01 is left as 'Pending' (not hand-edited to Complete or 'in progress' wording): this plan is one of two remaining covering plans (03-09 harness, 03-10 the actual four-profile measured run); per this phase's plan-checker coverage table and the STATE.md convention already used for partially-covered requirements (e.g. 03-06 on LAY-01/03/04), only the final covering plan updates the traceability row"

# Metrics
duration: 30min
completed: 2026-09-27
---

# Phase 3 Plan 09: Ceiling Spike Harness Summary

**Playwright + CDP driver and React/Canvas measurement harness that renders the real, committed engine's layouts and routes in four device profiles (gpu/sw/sw-4x/sw-6x) and writes raw frame-time/memory JSONL to the gitignored `.spike/` directory.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 3 (`scripts/spike/driver.ts`, `scripts/spike/harness.mjs`, `.gitignore`)

## Accomplishments

- A dev-only Playwright driver that launches real Chromium in four device profiles (native GPU, SwiftShader software raster, and CDP 4x/6x CPU throttle on top of software raster), serves the real compiled engine plus React 18 to a cross-origin-isolated fake origin, and captures full environment metadata (CPU, RAM, OS, browser/Playwright versions, GPU renderer string, measured on this session's machine: AMD Ryzen 9 3900X / RX 6700 XT / Windows 10)
- Eight measurement suites wired end to end and smoke-tested with real output: `calib` (CPU throttle calibration), `limits` (canvas width/height/area probes — reproduced the exact 2^28 area cap and the 16385x16384/32767x8193/23171x11586/32767x32767 failures from 03-RESEARCH.md), `headless` (Node-only real-engine layout/route/emit timing), `svg-rich`/`svg-lean` (React 18 SVG tiers with real gate/current routes, mount/hover/pan/tween timing plus DOM byte and JS heap deltas), `canvas` (cached-static-bitmap tier with static paint, cached-blit pan, hover overlay redraw and tween repaint), and `chords` (synthetic all-chords density/legibility probe)
- Verified on the sw-6x (6x CPU-throttled, software-raster) profile that the harness reproduces the qualitative slowdown pattern from 03-RESEARCH.md (n=10 svg-rich mount: 17.9ms on gpu vs 139.5ms on sw-6x, an ~8x slowdown consistent with the research's combined software-raster + throttle measurements)
- Nothing added to `npm run verify`, no new dependency, no lockfile change, no file touched outside `scripts/spike/` and `.gitignore`

## Task Commits

Each task was committed atomically:

1. **Task 1: Driver skeleton, engine compile and serving, environment capture, calibration, canvas limits and headless suite** - `dd1a091` (feat)
2. **Task 2: SVG-rich, SVG-lean, Canvas, tween and all-chords suites with a quick smoke run** - `8efef1d` (feat)

**Plan metadata:** (this commit) `docs: complete 03-09-PLAN.md`

## Files Created/Modified

- `scripts/spike/driver.ts` - Playwright/CDP driver: CLI parsing, four device profiles, engine compile-to-`.spike/engine-js`, fake-origin route serving with COOP/COEP/CORP headers, `freshPage`/`metrics` (CDP `HeapProfiler.collectGarbage` + `Performance.getMetrics`), environment capture, and the eight suite runners (`calib`, `limits`, `headless`, `svg-rich`/`svg-lean`, `canvas`, `chords`) with adaptive frame/hover/tween counts and the 20s/3s early-stop rule
- `scripts/spike/harness.mjs` - browser-side `window.__spike`: environment probes (`calib`, `rendererInfo`, `probeCanvas`, `memory`), the real-engine scene builder (`build`), React 18 SVG-rich/SVG-lean rendering (`mountSvg`, `hoverSvg`, `panCss`, `tweenSvg`), the Canvas tier (`canvasStatic`, `canvasPan`, `canvasHover`, `canvasTween`), and the synthetic chord-density probe (`chords`)
- `.gitignore` - added `/.spike/` (raw spike output, never committed)

## Decisions Made

See `key-decisions` in the frontmatter above (inline-cast `page.evaluate` closures, chords suite independence from the numogram engine, REN-01 left "Pending" pending 03-10).

## Deviations from Plan

None beyond the one auto-fixed bug below - the plan's suite shapes, adaptive counts, route/serving design and threat mitigations were followed as specified.

### Auto-fixed Issues

**1. [Rule 1 - Bug] `page.evaluate` callbacks referencing an outer Node-side closure**
- **Found during:** Task 2, first `--suite all --quick` smoke run
- **Issue:** `runSvgTier`/`runCanvas` defined a local `const win = () => window as unknown as SpikeWindow` in the surrounding (Node-side) TypeScript scope and referenced `win()` inside `page.evaluate(() => win().__spike...)` callbacks. Playwright serializes only the callback function body and runs it inside the browser process, which has no access to the Node-side `win` binding, so every such call failed with `ReferenceError: win is not defined` (visible as `{"suite":"svg-rich",...,"error":"...ReferenceError: win is not defined..."}` rows).
- **Fix:** Replaced every such call site with the cast written inline inside the callback (`(window as unknown as SpikeWindow).__spike...`), which Playwright serializes correctly since it references only browser-global `window`, not an outer Node variable.
- **Files modified:** `scripts/spike/driver.ts`
- **Verification:** Re-ran `npm run typecheck` (clean) and `npx tsx scripts/spike/driver.ts --profile gpu --suite all --quick --fresh`; all svg-rich/svg-lean/canvas rows now carry real numeric `mountMs`/`interactionMs`/`panMs`/`tweenMs`/`domBytes`/`jsHeapBytes` instead of errors.
- **Committed in:** `8efef1d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary for the harness to function at all; no scope creep, no change to the plan's measurement design or record shapes.

## Issues Encountered

- The first `--suite all --quick --fresh` gpu run and the `sw-6x` run each exceeded the Bash tool's 120s foreground timeout (real Chromium launches across multiple suites); both were re-run with `run_in_background: true` and polled via a `tasklist`-based wait loop rather than fixed sleeps, then verified complete with exit code 0 and zero remaining `chrome.exe` processes.

## User Setup Required

None - no external service configuration required. Playwright's Chromium was already installed from a prior phase.

## Next Phase Readiness

- The harness is ready for plan 03-10 to run the real four-profile spike (`--profile gpu|sw|sw-4x|sw-6x --suite all`, plus a dedicated `headless` pass) and shape `.spike/raw/*.jsonl` into the committed `engine/scene/tier-table.json`, replacing the conservative placeholder table from 03-02.
- `.spike/` currently holds this plan's own smoke-test output (quick runs only, `n` in {10, 28}); it is gitignored and un-tracked, and plan 03-10 should probably `--fresh` before its real, full-size run.
- REN-01 stays "Pending" in `REQUIREMENTS.md` until 03-10 lands the measured table.

## Self-Check: PASSED

- FOUND: `scripts/spike/driver.ts`
- FOUND: `scripts/spike/harness.mjs`
- FOUND: `.gitignore` contains `/.spike/`
- FOUND commit `dd1a091` (Task 1)
- FOUND commit `8efef1d` (Task 2)
- FOUND: `.spike/raw/gpu.jsonl`, `.spike/raw/sw-6x.jsonl`, `.spike/raw/headless.jsonl`, `.spike/raw/env-gpu.json`, `.spike/raw/env-sw-6x.json` on disk (gitignored, untracked, confirmed via `git status --porcelain -- .spike` printing nothing)
- FOUND: `git diff --name-only 8834387 HEAD` = `.gitignore`, `scripts/spike/driver.ts`, `scripts/spike/harness.mjs` only (no engine/app/e2e/perf/package.json/package-lock.json change)
- FOUND: 0 `chrome.exe` processes after each run (`tasklist` checked after both the gpu quick run and the sw-6x run)

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-27*

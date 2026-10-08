---
phase: 06-canvas-tier-and-worker
plan: 04
subsystem: worker
tags: [worker-core, protocol, summary, text-view, over-limit-copy, scene-guard, transferables, import-graph, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-01's INTERACTIVE_MAX_N (the shipped ceiling as data) and 06-02's pure CanvasScene builders (buildZoneScene, buildPairScene)
  - phase: 04-base-picker-and-generator-ui
    provides: summarize, numogramText (bounded text view, T-04-21), labelScheme, layoutIds and the keep-the-last-valid-base pattern
  - phase: 05-demons-layer
    provides: demonsAfterBaseSwitch and the closed-form demon counts (g.demons.count, typeCounts, counts)
provides:
  - app/lib/summary.ts, the lore-free summarize (re-exported from numogramView.ts, every importer unchanged)
  - TEXT_VIEW_ZONE_LIMIT = INTERACTIVE_MAX_N, so the text view lists every zone, syzygy and gate at every Canvas base
  - overLimitMessage(base, interactiveMaxN) and tierOverrideMessage(base), the D-02 copy as pure functions
  - app/lib/worker/protocol.ts, the request/response contract with total shape guards, resultKey and the two failure messages
  - app/lib/worker/buildResult.ts, the single pure core the worker shell and the main-thread fallback both run (buildResult, handleRequest, sceneWanted, transferListFor)
  - demonsAfterSwitchFromCounts, the filter-survival rule from closed-form counts (no main-thread Numogram needed)
affects: [06-07, 06-09, 06-11, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One pure core, two hosts: handleRequest(data) never throws and returns { response, transfer }; the worker shell only forwards, so the fallback and the worker cannot drift"
    - "Static import-graph walk as a licensing test: relative imports from the core are followed with node:fs (comments stripped, .ts/.tsx/index/.json resolved) and the test fails if base-10 lore becomes reachable; the walker is itself proven on numogramView.ts, which does reach lore"
    - "Total guards at a message boundary: isWorkerRequest and isWorkerResponse wrap their bodies so a hostile object whose accessors throw is simply not a message"
    - "Engine failure injected with a file-scoped vi.mock (importOriginal plus a hoisted switch) so the catch path is proven without touching the main test file"

key-files:
  created:
    - app/lib/summary.ts
    - app/lib/worker/protocol.ts
    - app/lib/worker/buildResult.ts
    - tests/app/workerCore.test.ts
    - tests/app/workerCoreFailure.test.ts
  modified:
    - app/lib/numogramView.ts
    - app/lib/numogramText.ts
    - app/lib/demonState.ts
    - tests/app/numogramText.test.ts
    - tests/app/demonState.test.ts

key-decisions:
  - "summarize moved character for character to app/lib/summary.ts and is re-exported from numogramView.ts (value and type), so BasePicker, BigBaseSummary, ViewContext, basePicker.ts and eight test files compile unchanged; summarize imported from either module is the same function (toBe)"
  - "TEXT_VIEW_ZONE_LIMIT is the ceiling (data), so bases 1025..ceiling now list every line; at the ceiling base the text lists exactly INTERACTIVE_MAX_N gate lines and the limit line appears from ceiling + 2. bigBaseMessage is kept untouched (the current BigBaseSummary still renders it until 06-11); the new copy is added beside it"
  - "isWorkerRequest validates more than the plan's 'labels an object with a string mode': the mode must be one of the four exact values, a preset id must pass isAlphabetPresetId and a custom alphabet must be an array of at most MAX_ALPHABET strings (both from the lore-free customAlphabet.ts that labelScheme already imports), so a stale or hostile scheme is 'malformed worker request' rather than a thrown error deep in labelling"
  - "A scene is built only when sceneWanted: wantScene, base <= INTERACTIVE_MAX_N and not a base-10 authored layout; every other case returns scene null, so 2^26 allocates only the bounded summary and text. The ceiling comes from tierBounds, no literal in the core"
  - "handleRequest answers a malformed request with id and base taken from the data only when the id is a finite integer and the base a number (else -1), through a field reader that cannot throw; invalid bases are 'invalid-base' with the engine's own message, any other failure 'build-failed' with the error text, and an outer catch makes the 'never throws' promise unconditional"
  - "demonsAfterSwitchFromCounts validates the filter with isDemonFilter before using it as a key and keeps it only when the closed-form count is above 0; proven equal to demonsAfterBaseSwitch for null, 3 types and 7 subtypes at bases 2, 10, 28 and 666"

patterns-established:
  - "Move-and-re-export for lore isolation: when a pure helper sits in a module that imports lore, move it verbatim to its own file and re-export it from the old module"
  - "Mutation-check a protocol core: 17 hand-made mutants over the guards, the scene guard, the packer, the key and the demon rule; the two survivors (label scheme in the key, packer at a base where it changes nothing) became tests, and the one reasoned-equivalent check is recorded"

requirements-completed: []  # REN-03 stays Pending: this plan ships the pure core and contract; the WorkerClient and shell (06-07), the large-base guards (06-09), the viewer integration (06-11) and the worker e2e specs (06-14) are what make the requirement true

# Metrics
duration: 18min
completed: 2026-10-08
---

# Phase 6 Plan 04: Worker Contract and Pure Core Summary

**One pure, guarded, lore-free core turns a build request into the summary, the complete text view, the demon facet counts and (up to the 4000 ceiling) the Canvas scene, never throws, builds no scene at 2^26, transfers each buffer once, and has its base-10-lore-free import graph proved by a static walk.**

## Performance

- **Duration:** ~18 min (including a 5 min full gate and a mutation round)
- **Started:** 2026-10-08T18:58:00Z
- **Completed:** 2026-10-08T19:16:00Z
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- **Lore-free summary (research P11).** `app/lib/summary.ts` holds `SUMMARY_TORQUE_LIMIT`, `NumogramSummary` and `summarize`, moved verbatim; its only import is the engine type. `numogramView.ts` re-exports all three, and `numogramText.ts` now imports from `./summary`, so the text module no longer reaches `app/presets/base10/*`. The base-28 summary (torque lengths 9 and 3, 378 demons) is pinned and `summarize` from either module is the same function.
- **Complete text view up to the ceiling (UI-SPEC decision 4).** `TEXT_VIEW_ZONE_LIMIT = INTERACTIVE_MAX_N`. The numogramText tests now check that the ceiling base lists exactly `INTERACTIVE_MAX_N` gate lines (and no limit line), that base 1024 still lists 1024, that the first even base above the ceiling carries `Zone, syzygy and gate listings are shown up to ${TEXT_VIEW_ZONE_LIMIT} zones.` and stays under 4000 characters. The "more Torque cycles than the summary lists" case finds its base from data (4002 has only 4 Torque cycles).
- **D-02 copy as pure functions.** `overLimitMessage(base, interactiveMaxN)` and `tierOverrideMessage(base)` match the UI-SPEC strings exactly, take the cutoff as a parameter, write bases as plain integers (`Base 67108864 is above`) and contain no em dash or exclamation mark. `bigBaseMessage` is untouched until 06-11.
- **Message contract.** `protocol.ts` defines `WORKER_PROTOCOL = 'ccrug-numogram-worker/1'`, `WorkerRequest`, `WorkerBuilt`, `WorkerFailed`, `DemonFacetCounts`, `resultKey` (`base:layout:packer:labelSchemeKey`), the shape guards and the two failure messages (`Couldn't compute base N. Showing base M.` and the no-worker line). 29 rejection cases cover wrong protocol, id 0 / 1.5 / NaN / Infinity / a string, a string base, an unknown layout or packer, an inherited-key layout (`constructor`), null or malformed labels, a missing `wantScene`, arrays and null.
- **The core.** `buildResult` validates the base and that the layout is offered at it, then returns the summary (equal to `summarize`), the text (equal to `numogramText` under the request's label scheme), plain-object facet counts (equal to `g.demons.typeCounts()` / `counts()`) and the scene (equal to what `buildZoneScene` / `buildPairScene` make from `resolveLayout` / `pairGraphLayout` with the same packer; the packer test runs at base 66, the smallest base where the packer moves the ring and the pair graph). `handleRequest` never throws: malformed -> `build-failed` (id and base kept when usable), odd or absurd base -> `invalid-base` with the engine message, thrown engine errors -> `build-failed` (proved with a file-scoped engine mock for both Error and non-Error throws), hostile accessor objects -> `malformed worker request`.
- **Scene guard (T-06-01).** `sceneWanted` = `wantScene && base <= INTERACTIVE_MAX_N && !isPresetLayoutId`. The ceiling base builds a scene, ceiling + 2 builds none for ring, ladder, spiral and the pair graph, base 2^26 returns only the bounded summary and text (about 0.6 s, run once), and base 10's authored layouts (original, labyrinth, ladder, planetary) return `scene: null` while the procedural ring at base 10 still builds one.
- **Transfer list (T-06-13, P15).** `transferListFor` lists the 17 typed-array buffers of a zone scene (19 for a pair scene, `px` and `py` included) once each through a `Set`. A test performs a real `structuredClone(response, { transfer })` with that list: it does not throw, the clone carries the same coordinates and the original buffer is detached.
- **Lore-free import graph (T-06-14).** A static walker (node:fs, comments stripped, `.ts`/`.tsx`/`index`/`.json` resolved) follows relative imports from `buildResult.ts` and `protocol.ts`: no file under `app/presets/` or `app/data/`, none of `numogramView.ts`, `demonBrowser.ts`, `demonState.ts`, no package import at all. The walker is itself checked: started from `numogramView.ts` it does reach `app/presets/base10/lore.ts`, so a clean result means something.
- **Counts-based demon rule.** `demonsAfterSwitchFromCounts(prev, counts)` equals `demonsAfterBaseSwitch(prev, g)` for every filter (null, 3 types, 7 subtypes), with and without a focus, at bases 2, 10, 28 and 666; a zero count drops a type or subtype, and hostile filter strings (`constructor`, `__proto__`, `toString`, `total`, empty, `Chrono`) become null.

## Task Commits

Each task followed RED then GREEN (4 commits, each carries the Co-Authored-By trailer, checked with `git log -1 --format=%B`):

1. **Task 1: Lore-free summary module, text limit and the new over-limit copy**
   - `cf13731` test(06-04): add failing tests for the lore-free summary, ceiling-long text view and over-limit copy
   - `66317c6` feat(06-04): move summarize to a lore-free module, follow the ceiling in the text view, add over-limit copy
2. **Task 2: Worker protocol, the pure build core and the counts-based demon filter rule**
   - `ffb2b1c` test(06-04): add failing tests for the worker core, protocol and counts-based demon filter rule
   - `85e672f` feat(06-04): add the pure worker core, its message protocol and the counts-based demon filter rule

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

_Both RED commits failed for the expected reason (`Cannot find module '../../app/lib/summary'`; then `Cannot find module '../../app/lib/worker/protocol'` and `demonsAfterSwitchFromCounts is not a function`). The Task 2 GREEN commit also carries two test additions made after the mutation round (below)._

## Files Created/Modified

- `app/lib/summary.ts` - `SUMMARY_TORQUE_LIMIT`, `NumogramSummary`, `summarize` (moved, lore-free)
- `app/lib/numogramView.ts` - the three definitions replaced by an import and a re-export; nothing else changed
- `app/lib/numogramText.ts` - imports from `./summary` and `./tierBounds`, `TEXT_VIEW_ZONE_LIMIT = INTERACTIVE_MAX_N`, `overLimitMessage`, `tierOverrideMessage`
- `app/lib/worker/protocol.ts` - the message contract, guards and failure copy
- `app/lib/worker/buildResult.ts` - `buildResult`, `handleRequest`, `sceneWanted`, `transferListFor`, `BuildOutput`
- `app/lib/demonState.ts` - `demonsAfterSwitchFromCounts` (and a type-only import of `DemonFacetCounts`)
- `tests/app/numogramText.test.ts` - rewritten on the ceiling (no 1024 or 4000 literal tied to the limit), summary-move identity, the two message functions
- `tests/app/workerCore.test.ts` - protocol, core, scene guard, `handleRequest`, transfer list and the import-graph walk (66 tests)
- `tests/app/workerCoreFailure.test.ts` - forced engine failure through a file-scoped `vi.mock` (3 tests)
- `tests/app/demonState.test.ts` - the counts-versus-numogram equivalence sweep and the zero-count and hostile-filter cases

## Decisions Made

See `key-decisions` above. The plan fixed the structure; the judgement calls were the stronger label-scheme guard, total guards with an outer catch in `handleRequest`, finding the "many Torque cycles" base from data instead of a literal, and a separate mocked test file for the engine-failure path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Label scheme validated beyond "an object with a string mode"**
- **Found during:** Task 2, writing the guard tests
- **Issue:** The worker boundary (T-06-08) would have accepted `{ mode: 'weird' }`, an unknown preset id or a custom alphabet of non-strings, and the failure would surface as a thrown error inside labelling (or a wrong label) instead of a clean refusal.
- **Fix:** `isLabelScheme` checks exact mode membership, `isAlphabetPresetId` for presets and an array of at most `MAX_ALPHABET` strings for custom alphabets. Both helpers live in `customAlphabet.ts`, which `labelScheme.ts` already imports, so the import graph stays lore-free (and the walker test confirms it). One more import than the plan's list for `protocol.ts`; `buildResult.ts` imports exactly the planned modules.
- **Files modified:** app/lib/worker/protocol.ts, tests/app/workerCore.test.ts
- **Committed in:** 85e672f

**2. [Rule 2 - Missing critical functionality] Guards and `handleRequest` made unconditionally total**
- **Found during:** Task 2, the hostile-object test
- **Issue:** An object whose field accessors throw (a `Proxy` in the test) would have thrown out of `isWorkerRequest` and therefore out of `handleRequest`, breaking "the core never throws".
- **Fix:** both guards wrap their bodies in try/catch (a hostile object is not a message), the id and base of a malformed request are read through a field reader that cannot throw, and `handleRequest` has an outer catch.
- **Files modified:** app/lib/worker/protocol.ts, app/lib/worker/buildResult.ts
- **Committed in:** 85e672f

**3. [Rule 3 - Blocking test construction] The "many Torque cycles" case could not stay on base ceiling + 2**
- **Found during:** Task 1, RED
- **Issue:** the plan says the base-4096 describe moves to ceiling + 2 (4002), but 4002 has only 4 Torque cycles, so the old "past 12 with a more suffix" assertions cannot hold there.
- **Fix:** the limit-line and bounded-length assertions run on ceiling + 2; the Torque truncation assertion runs on the first even base above the ceiling whose Torque count exceeds `SUMMARY_TORQUE_LIMIT`, found from data in the test (no literal, valid if the ceiling moves).
- **Files modified:** tests/app/numogramText.test.ts
- **Committed in:** cf13731 / 66317c6

**Additions not in the plan's file list:** `tests/app/workerCoreFailure.test.ts` (the engine-failure path needs a module mock that must not affect the main test file).

---

**Total deviations:** 3 auto-fixed (2 missing critical validation, 1 test construction) plus one extra test file. **Impact on plan:** no scope change; the validation only rejects inputs that were already invalid, and the plan's stated behaviours all hold as written.

## Issues Encountered

None beyond the deviations. Mutation testing (16 hand-made mutants, 14 killed on the first run, and a 17th, the packer for the pair graph, added with the fix; over the scene ceiling `<=`, the preset clause, the id and integer guards, the preset-id check, the invalid-base branch, the layout-offered check, the packer for the ring and the pair graph, the facet spread, the facet total, the response key, the transfer list's `px`, the id echo, the demon `> 0` rule and the focus clear) found two survivors that pointed at real gaps, both closed: the response `key` used the request's label scheme but the test only used digits (now an xeno request pins it), and the packer test ran at base 28 where neither packer changes the ring or the pair graph (now base 66, with an assertion that the two packers really differ). One more is equivalent and stays: dropping the `isDemonFilter` check in `demonsAfterSwitchFromCounts` cannot change the result, because a foreign string reads `undefined` or a function from the counts and `> 0` is false (the check is defence in depth, as the plan specifies).

Behaviour note for later plans: until 06-11 switches the viewer, `NumogramClient.tsx` still builds `numogramText(g, ...)` on the main thread for non-SVG bases. With the new limit this now lists every line for bases 1025 to 4000 (about 358 KB, about 7 ms at 4000) instead of only the header block; the existing url-codec test (`?base=1024`) and the rest of the suite stay green.

## Verification

- `npx vitest run tests/app/numogramText.test.ts tests/app/numogramView.test.ts tests/app/demonMatrixRender.test.ts --project oracle`: 68 passed (Task 1 RED run: suite failed to load, `Cannot find module '../../app/lib/summary'`).
- `npx vitest run tests/app/workerCore.test.ts tests/app/workerCoreFailure.test.ts tests/app/demonState.test.ts tests/app/numogramText.test.ts --project oracle`: 126 passed (Task 2 RED run: modules missing, 4 failures in demonState).
- Acceptance greps: `export function summarize` is 1 in `summary.ts` and 0 in `numogramView.ts`; no `presets|data/` in `summary.ts`; `from './summary'` 1 and `from './numogramView'` 0 in `numogramText.ts`; `export const TEXT_VIEW_ZONE_LIMIT = INTERACTIVE_MAX_N` 1; no `toBe(1024)` in the text test; `WORKER_PROTOCOL` line 1; no `presets|numogramView|demonBrowser|demonState|viewLayouts` and no `4000` in `buildResult.ts` or `protocol.ts`; `INTERACTIVE_MAX_N` appears in `buildResult.ts`; the worker test contains `67108864`, `new Set(` and `presets`; `export function demonsAfterSwitchFromCounts` 1.
- `npm run typecheck` (4x tsc plus lint): exit 0 after each task. The one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK, run after `git add` of the new files (the gate scans tracked files only).
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing before and after the full gate. `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**` and `useCanvasPan.ts` are unchanged; no `-u` anywhere.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 78 test files and 2010 unit tests in both timezones (1927 + 83 new and rewritten), sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out. `npm run test:swap` was not required by this plan (no `NumogramClient.tsx` edit); the full gate covers the goldens and the behaviour baseline.

## Known Stubs

None. The new modules are not imported by any route yet (the WorkerClient and shell land in 06-07, the viewer wiring in 06-11), which is why the page-weight budget did not move; that is the plan's sequencing, not a stub.

## Threat Flags

None. No new endpoint, auth path, file access or schema change beyond the plan's register: T-06-01 (scene guard, mitigated and tested at the ceiling, ceiling + 2 and 2^26), T-06-08 (exact-membership guards, `validateBase` re-check, total guards and an outer catch, mitigated), T-06-13 (transfer list through a `Set`, proven by a real structured-clone transfer, mitigated) and T-06-14 (import-graph walk, mitigated).

## Next Phase Readiness

- 06-07 can build `WorkerClient` and the shell on `handleRequest(data)` and `isWorkerResponse`: the shell is `onmessage -> handleRequest -> self.postMessage(response, { transfer })`, the client numbers requests, compares `resultKey` and applies a response only when its id is the latest; the no-Worker fallback calls the same `handleRequest` (up to `INTERACTIVE_MAX_N`, with `noWorkerMessage` above it).
- 06-09 and 06-11 can use `demonsAfterSwitchFromCounts` with the worker's `facetCounts` so a huge new base never needs a main-thread `Numogram`, `overLimitMessage` / `tierOverrideMessage` for the over-limit and `tier=headless` views, and `computeFailedMessage` / `noWorkerMessage` for the picker's refusal slot. `bigBaseMessage` is still in place and still used by the current `BigBaseSummary`; 06-11 removes it.
- REN-03 stays Pending until the client and shell (06-07), the guards (06-09), the integration (06-11) and the worker e2e specs (06-14) land.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED

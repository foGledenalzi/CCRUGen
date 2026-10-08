---
phase: 06-canvas-tier-and-worker
plan: 07
subsystem: worker
tags: [web-worker, latest-wins, supersede, main-thread-fallback, static-export, webpack-worker-chunk, react-hook, strictmode, fast-check, mutation-testing, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-04's pure worker core and contract (handleRequest, transferListFor, isWorkerResponse, WORKER_PROTOCOL, noWorkerMessage) and 06-01's INTERACTIVE_MAX_N
provides:
  - app/lib/worker/workerClient.ts, WorkerClient (latest-wins, 1 in flight + 1 pending, supersede, dispose, main-thread fallback up to a ceiling) and createNumogramWorker, the single Worker construction site
  - workers/numogram.worker.ts, the thin classic-worker shell (onmessage, handleRequest, postMessage(response, { transfer }))
  - app/lib/worker/useNumogramWorker.ts, the SSR-safe, StrictMode-safe hook (stable request and supersede, client built lazily, disposed on unmount)
  - the verified bundling form: a same-origin classic worker chunk under /_next/static/chunks at the root and under /ccrug, one spawn, replies online and offline
affects: [06-08, 06-11, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected factory and scheduler: WorkerClient never touches Worker, window or timers itself, so a hand-written fake worker plus an on-demand scheduler drive every ordering in node (no jsdom)"
    - "Latest-wins by id, not by cancellation: a reply is delivered only while its id is still the latest; a superseded job keeps its worker slot (no watchdog) and its result is dropped, while the single pending slot keeps the queue at length one"
    - "Two redundant guards on the pending request (supersede() clears it, the reply handler re-checks its id): each alone is behaviourally equivalent, so single-guard mutants survive and the joint mutant is what a test must kill"
    - "Literal-only worker construction guarded by static tests: new Worker( and import.meta.url may appear once, in workerClient.ts, with no options object"
    - "Bundling proof by temporary probe route: a throwaway app/zz-probe/page.tsx imports the hook, the export is built and driven with Playwright at root and /ccrug, then the route is deleted and the export rebuilt"

key-files:
  created:
    - app/lib/worker/workerClient.ts
    - app/lib/worker/useNumogramWorker.ts
    - workers/numogram.worker.ts
    - tests/app/workerClient.test.ts
  modified: []

key-decisions:
  - "WorkerLike.onerror is typed (e: ErrorEvent) => void, not the plan's (e: Event) => void: with strictFunctionTypes a real Worker (onerror: (ev: ErrorEvent) => any) is not assignable to the Event form (TS2322 in the hook, reproduced and then reverted), and the client never reads the event"
  - "Any failure to send is treated like a worker error: a postMessage that throws marks the client dead, terminates the worker once and answers that request through the fallback, so a request can never be lost silently (not in the plan's list)"
  - "A throwing fallback becomes a build-failed error response for the latest request instead of an uncaught exception inside a timer (handleRequest never throws, but the injected function is a seam); a fallback job that runs after dispose() delivers nothing"
  - "Fallback jobs carry no watchdog and the worker keeps no cancel: as the plan fixed, a superseded long job keeps its in-flight slot and the next request waits in the single pending slot; replies from it are dropped by id"
  - "A malformed-request reply from the core keeps the request's own integer id (06-04 readField), so a client request that fails the core's guard still resolves its slot instead of wedging it"
  - "The worker chunk cannot appear in the real export until some module imports the hook (06-11), so the plan's build step was proven with a temporary probe route (deleted, nothing committed) at root and under /ccrug instead of only by the shipped build"

patterns-established:
  - "Fake WorkerLike with deliver() and crash() plus a queued scheduler: the way later plans (06-11, 06-14) can unit-test anything built on WorkerClient"
  - "Kill the equivalent-mutant pair jointly: when two guards each make the other redundant, record the single mutants as reasoned-equivalent and run the combined mutant"

requirements-completed: []  # REN-03 stays Pending: the client, shell and hook ship here, but the viewer wiring (06-11), the large-base guards already done in 06-09 and the worker e2e specs (06-14) are what make the requirement true

# Metrics
duration: ~50min (active, excluding a usage-limit pause between the build proof and the closing steps)
completed: 2026-10-08
---

# Phase 6 Plan 07: Latest-Wins WorkerClient, Worker Shell and Hook Summary

**One long-lived same-origin worker runs the pure 06-04 core behind a latest-wins client that keeps one job in flight and one waiting, discards every superseded reply, falls back to the main thread only up to the 4000 ceiling, and is proven to bundle as an ordinary hashed classic chunk in the static export at the root and under /ccrug, online and offline.**

## Performance

- **Duration:** ~50 min active (the full gate is about 5 min; there was a usage-limit pause before the closing steps)
- **Started:** 2026-10-08T20:00:00Z (about)
- **Completed:** 2026-10-08
- **Tasks:** 2 (Task 1 TDD: RED then GREEN commits; Task 2 one commit)
- **Files modified:** 4 (all created)

## Accomplishments

- **Latest-wins client (D-07, T-06-03, T-06-21).** `WorkerClient` numbers requests, wraps them in the protocol envelope and posts at most one at a time. A newer request replaces the single pending slot (never posted, never answered), a reply is delivered only when its id is the in-flight id and still the latest, and a reply with any other id leaves the slot untouched. `supersede()` raises the latest id and drops the pending request, so a synchronous (SVG-tier) commit makes every outstanding reply stale. Replies are shape-guarded with `isWorkerResponse`. A burst of 50 requests leaves one message in the worker and posts only the last afterwards.
- **Lazy, single, disposable worker (P17).** The worker is created on the first request (zero `makeWorker` calls before it, one after any number of requests, never re-created), `dispose()` terminates it once and is idempotent, and after dispose replies are ignored and `request()` never posts. The hook does the same at the React level: its only effect is the dispose cleanup, the client is built lazily and a request after a StrictMode remount builds a fresh one.
- **Bounded fallback (T-06-01c, P18).** `makeWorker` returning `null`, throwing, a worker `error` event, or a `postMessage` that throws all end in the same place: the request runs `fallback` after the injected scheduler's one frame, only if it is still the latest, and only up to `fallbackMaxBase` (inclusive). Above it the callback gets `{ type: 'error', reason: 'no-worker', id, base }` and the fallback is never called. A crash re-runs only what is still latest (the in-flight request, or the pending one when the in-flight one is already stale) and later requests go straight to the fallback. Run through the real core, base 28 returns `built` and `INTERACTIVE_MAX_N + 2` returns the refusal.
- **The shell and the one construction site (T-06-04).** `workers/numogram.worker.ts` is the eight-line shell from the research. `createNumogramWorker` is the only `new Worker(` in `app/` and `workers/`, written as the literal `new Worker(new URL('../../../workers/numogram.worker.ts', import.meta.url))` with no options object; static tests pin both facts, that the shell imports only `../app/lib/worker/buildResult`, and that its import graph reaches no preset, no `app/data` file, none of `numogramView.ts`, `demonBrowser.ts`, `demonState.ts`, and not the client.
- **Bundling proven in the export (the ROADMAP research flag, now measured on the real client and hook).** With a temporary probe route importing the hook, `npm run build` emits the worker as a classic chunk `chunks/215.<hash>.js` (webpack runtime plus the shell), which `importScripts` the shared code chunks 506 and 755; Playwright against `serve` saw exactly one worker, at `/_next/static/chunks/215.85f37e7ecf40aed8.js` at the root and `/ccrug/_next/static/chunks/215.60b03d0a5a46e683.js` under the basePath, answered `built` for base 28 with a scene, and answered again after `context.setOffline(true)`. No page error or console error, and no `.ts` file anywhere under `out/`.

## Worker chunk sizes (invisible to `check:weight`)

`scripts/page-weight.mjs` counts only JS and CSS referenced from HTML, so the worker entry never moves the budget (the budget stayed untouched: `page-weight: OK (2 routes, 30 golden states within tolerance)`, no baseline update).

**Shipped build as committed (nothing imports the hook yet):** there is no worker chunk. The chunks under `out/_next/static/chunks/` that no `out/**/*.html` references are only the pages-router runtime that the app-router pages never load: `framework-f66176bb897dc684.js` 139,978 B and `main-1736eb0d777e067c.js` 116,489 B. (`polyfills-*.js` contains `importScripts` but is referenced from HTML, so the plan's `grep -l importScripts ... | wc -l >= 1` is satisfied only by it and proves nothing about the worker; see Deviations.)

**Probe build with the hook imported (what 06-11 will ship), measured on the temporary route:**

| File | Raw bytes | Gzip bytes | Referenced by out HTML |
|------|-----------|------------|------------------------|
| `215.85f37e7ecf40aed8.js` (worker entry, root build) | 9,551 | 3,896 | no |
| `215.60b03d0a5a46e683.js` (worker entry, `/ccrug` build) | 9,557 | 3,899 | no |
| `506-1a59dea4b0595fc0.js` (shared code chunk the entry loads) | 36,255 | 12,677 | yes (also loaded by the page that uses the hook) |
| `755-a9891c3bfb348890.js` (shared code chunk the entry loads) | 9,441 | 3,561 | yes |
| `framework-f66176bb897dc684.js`, `main-103c195fa91ba3bb.js` (pages-router runtime) | 139,978 and 116,527 | n/a | no |

So the worker costs about 55 KB raw (about 20 KB gzip) of which the engine code is shared with the page bundle, not duplicated. The lore check: none of `Uttunul`, `Murrumur`, `Oddubb`, `Blind Humpty`, `Tohu Bohu` appears in the worker entry or in chunks 506 and 755 (0 hits each), while the positive control finds them in `chunks/app/numogram/page-3e11b3d3291b6f8a.js`, so the base-10 lore stays out of the worker bundle. 06-14 reports the final chunk set again after 06-11 wires the hook.

## Task Commits

Every commit carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`):

1. **Task 1: Latest-wins WorkerClient with the main-thread fallback**
   - `ec4e462` test(06-07): add failing tests for the latest-wins worker client (RED: `Cannot find module '../../app/lib/worker/workerClient'`)
   - `118081a` feat(06-07): add the latest-wins worker client with a ceiling-bounded main-thread fallback
2. **Task 2: Worker shell and the React hook**
   - `97ae989` feat(06-07): add the numogram worker shell and the useNumogramWorker hook

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

## Files Created/Modified

- `app/lib/worker/workerClient.ts` - `WorkerLike`, `WorkerClientOptions`, `WorkerClient`, `createNumogramWorker`
- `workers/numogram.worker.ts` - the worker shell
- `app/lib/worker/useNumogramWorker.ts` - `useNumogramWorker`, `NumogramWorkerApi`
- `tests/app/workerClient.test.ts` - 44 tests: creation, latest-wins and the pending slot, out-of-order and malformed replies, supersede, the fallback and its ceiling, worker errors, dispose, a loopback worker on the real core, a 400-run fast-check event-sequence property, and the static checks (shell, import graph, construction site, hook wiring)

## Decisions Made

See `key-decisions` above. The plan fixed the structure; the judgement calls were the `ErrorEvent` typing, treating a failed send as a dead worker, the throwing-fallback guard, and proving the bundling form with a probe route because the shipped graph does not yet contain the worker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking type error] `WorkerLike.onerror` takes `ErrorEvent`, not `Event`**
- **Found during:** Task 2 typecheck of the hook (`makeWorker: () => (typeof Worker === 'undefined' ? null : createNumogramWorker())`)
- **Issue:** with the plan's `onerror: ((e: Event) => void) | null` a real `Worker` is not assignable to `WorkerLike` under strictFunctionTypes (TS2322, "Type 'Event' is missing the following properties from type 'ErrorEvent'"); reproduced, then reverted to the working form.
- **Fix:** `onerror: ((e: ErrorEvent) => void) | null` (the client never reads the event; tests cast a stub).
- **Files modified:** app/lib/worker/workerClient.ts (committed with the first version in 118081a, so the plan's form never landed)
- **Committed in:** 118081a

**2. [Rule 2 - Missing critical functionality] Three failure paths the plan did not list**
- **Found during:** Task 1 design
- **Issue:** a `postMessage` that throws would have left the request unanswered with the client believing a job is in flight; a throwing `fallback` would have thrown inside a timer and left the UI computing forever; a fallback job queued before `dispose()` could still deliver after unmount.
- **Fix:** a failed send marks the client dead and answers through the fallback; a throwing fallback is delivered as `build-failed` for the latest request; fallback jobs check `disposed` first. Each has a test.
- **Files modified:** app/lib/worker/workerClient.ts, tests/app/workerClient.test.ts
- **Committed in:** 118081a

**3. [Rule 3 - Plan acceptance not satisfiable as written] The shipped export has no worker chunk yet**
- **Found during:** Task 2 build step
- **Issue:** the plan wants a chunk under `out/_next/static/chunks/` that no HTML references and that contains `importScripts`. Nothing in `app/` imports the hook or the client until 06-11, so webpack never sees `new Worker(new URL(...))` and emits no worker chunk. The plan's count check (`grep -l importScripts out/_next/static/chunks/*.js | wc -l` at least 1) is met only by `polyfills-*.js`, which is referenced from HTML, so it is vacuous. The other build criteria hold on the real build: `npm run build` exits 0, `find out -name "*.ts"` is 0, `git status --porcelain --untracked-files=no out` is empty.
- **Fix:** proved the actual form with a temporary route `app/zz-probe/page.tsx` that imports the hook (never staged or committed): built at the root and with `NEXT_PUBLIC_BASE_PATH=/ccrug` (staged with `scripts/stage-basepath.mjs`), drove both with a scratch Playwright script from the session scratchpad, then deleted the route and `.e2e-basepath` and rebuilt the root export. The route sizes of the rebuilt export equal the pre-probe build (`/numogram` 91.9 kB, first load 179 kB). 06-14's e2e and chunk report are the permanent proof once 06-11 wires the hook.
- **Files modified:** none committed

**4. [Test construction] Crash events before the worker exists**
- **Found during:** Task 1 GREEN, fast-check counterexample `[crash, request]`
- **Issue:** the property model counted a crash that happens before any request (no worker, no handler) as a crash, then expected no post afterwards.
- **Fix:** the model records a crash only once the worker has been created. No production change.
- **Files modified:** tests/app/workerClient.test.ts
- **Committed in:** 118081a

**Addition not in the plan's file list:** none. The import-graph walker is repeated in compact form inside `tests/app/workerClient.test.ts` rather than exported from `workerCore.test.ts` (importing a test file would re-run its tests; a shared helper would have meant editing the 06-04 test).

---

**Total deviations:** 4 (1 type blocker, 1 set of missing failure paths, 1 plan acceptance that cannot hold before 06-11 and was proven another way, 1 test-model fix). **Impact on plan:** no scope change; every plan behaviour holds as written, with the three extras above.

## Issues Encountered

- The first GREEN run failed 10 tests because `onMessage` compared against `job.id` while the in-flight record holds `{ msg, onResult }` (it is `job.msg.id`); the tests found it before the typecheck was run. Fixed in the same GREEN commit.
- While appending the static tests with a shell helper, a hung `python -` call later fell through to a `sed` that duplicated the three node imports and a heredoc dropped one backslash from a regex; both caused a parse error in the test file, were fixed with the editor and never reached a commit.

### Mutation check (plan requirement, run once after the suite was green; the code was restored and re-run green after each mutant)

Required: removing the `=== latestId` check on delivery was killed (7 tests failed) and making `supersede()` a no-op was killed (5 tests failed). Extra mutants, all killed unless stated: a newer request posted instead of replacing the pending slot (killed), no ceiling refusal in the fallback (killed), any reply releases the in-flight slot (killed), a worker error that does not terminate (killed), a fallback job that skips the latest check (killed), the worker re-created on every request (killed), dispose that does not terminate (killed), a fallback result not id-checked (killed), a disposed client that still accepts requests (killed).

Three survivors, each reasoned equivalent: (a) `supersede()` not clearing `pending` and (b) the reply handler posting the pending request without re-checking its id are redundant guards of each other (the other guard already blocks the post); the joint mutant (both removed) is killed by the supersede test. (c) `if (this.dead)` forced false in `request()` is equivalent because `post()` with no worker throws into the same kill-and-fallback path.

## Verification

- `npx vitest run tests/app/workerClient.test.ts --project oracle`: 44 passed (RED run before the client existed: suite failed to load, `Cannot find module '../../app/lib/worker/workerClient'`).
- Acceptance greps re-run at the end: the literal `new Worker(new URL('../../../workers/numogram.worker.ts', import.meta.url))` count is 1 in `workerClient.ts`; no other `new Worker(` and no other `import.meta.url` under `app/` or `workers/`; the test file has `fc.assert` and `no-worker`; `postMessage(response, { transfer })` is 1 and `type:` is 0 in the shell; `useEffect` appears only as the import and the dispose cleanup in the hook; `find out -name "*.ts"` is 0; `git status --porcelain --untracked-files=no out` is empty.
- `npm run typecheck` (4x tsc plus lint, `--dir workers` now has a file): exit 0 after each task; the one lint warning is the existing `react-hooks/exhaustive-deps` note in `app/components/demons/DemonMatrix.tsx` (not touched here).
- `node scripts/check-repo.mjs --only base-ten`: OK, run after `git add` of the new files (the gate scans tracked files only).
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` printed nothing; `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**`, `useCanvasPan.ts` and `NumogramClient.tsx` are unchanged; no `-u` anywhere.
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 84 test files and 2199 unit tests in both timezones, sub-path e2e 10 passed, build OK, `page-weight: OK (2 routes, 30 golden states within tolerance)` with no baseline update, e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out. After the closing probe cleanup `node scripts/check-repo.mjs --clean-tree --static-out` was run again and passed. `npm run test:swap` was not required (no `NumogramClient.tsx` edit).

## Known Stubs

None. `useNumogramWorker` and `WorkerClient` are not imported by any route yet (06-11 wires the viewer), which is why the page-weight budget did not move and the shipped export contains no worker chunk; that is the plan's sequencing, not a stub.

## Threat Flags

None beyond the plan's register: T-06-04 (single literal construction site, grep and static test, same-origin hashed chunk observed at root and /ccrug, mitigated), T-06-03 (monotonic ids, delivery only for the latest id, supersede, shape guard, fast-check property, mutants killed, mitigated), T-06-21 (one in flight plus one pending, 50-request burst test, mitigated) and T-06-01c (fallback only up to the ceiling after one frame, 'no-worker' refusal above it, mitigated). The scratch probe route was never committed and is gone.

## Next Phase Readiness

- 06-11 imports `useNumogramWorker` in `NumogramClient`: call `request(...)` for every recomputation above `svgRichMaxN` (or under `tier=canvas|headless`), `supersede()` on every synchronous commit, treat a `reason: 'no-worker'` error with `noWorkerMessage` and any other error with `computeFailedMessage`, and key stale checks on the returned id as well as `resultKey`.
- The first real worker chunk appears when 06-11 lands; 06-14 should assert the URL under `/_next/static/chunks/` at the root and under `/ccrug` and report the chunk sizes again (expect about 9.5 KB entry plus the two shared chunks listed above, subject to how the final graph splits).
- The fake `WorkerLike` plus on-demand scheduler in `tests/app/workerClient.test.ts` is the pattern for any test of code built on the client.
- REN-03 stays Pending until 06-11 and 06-14.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED

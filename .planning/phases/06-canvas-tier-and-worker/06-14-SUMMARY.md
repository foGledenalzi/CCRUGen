---
phase: 06-canvas-tier-and-worker
plan: 14
subsystem: worker-e2e
tags: [web-worker, e2e, playwright, stale-results, supersede, heartbeat, static-export, basepath, offline, fallback, mutation-testing, worker-chunks]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-07's latest-wins WorkerClient, worker shell and hook; 06-09's picker computing state and persistent status carrier; 06-11's render tier, worker requests, over-limit view and the e2e helpers (openCanvas, openHeadless, CANVAS_READY, HEADLESS); 06-12's page-weight baseline
provides:
  - e2e/worker.spec.ts - 11 browser tests of the worker scope, stale-result discarding, computing state, 2^26 responsiveness, the ceiling as data, both fallbacks and the lazy Demons overlay
  - e2e/static-export.spec.ts - the worker URL under the site chunk path and offline reuse, run at the root and (through npm run test:e2e:basepath) under /ccrug
  - scripts/worker-chunks.mjs - reports the worker chunks no HTML references (raw and gzip) and fails on a missing chunk or base-10 lore
affects: [06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Held-postMessage wrapper (test-only, addInitScript): messages for chosen bases wait in a queue until the test releases them, and every reply that really reaches the page is recorded by id; a late reply is then a fact of the scenario, not a race against this machine's speed, and the test waits for the stale reply to arrive before asserting that it never painted"
    - "MutationObserver init scripts as 'never seen, not even for a frame' probes (the over-limit summary, every data-base value the canvas wrapper ever carries)"
    - "rAF heartbeat with a trailing gap: the largest frame gap plus the gap from the last frame to the read, so a stalled page cannot read as a clean one; installed by addInitScript when the compute happens during hydration"
    - "Replies recorded from the worker (not just the worker's existence) so a main-thread fallback can never pass for the worker in the offline test"

key-files:
  created:
    - e2e/worker.spec.ts
    - scripts/worker-chunks.mjs
  modified:
    - e2e/static-export.spec.ts

key-decisions:
  - "Staleness is made deterministic by HOLDING the postMessage of the chosen base until the test calls releaseWorker(), instead of delaying it by a fixed 1000 to 1500 ms: the plan's timed delays race the test's own assertions on a slow machine, while a held message cannot; the only timing assertion in the phase stays the 2^26 heartbeat bound"
  - "ROADMAP criterion 5 is interpreted as the plan fixed it (research A1, [default] for review at verification): the site needs only its static files, and an already-created long-lived worker keeps answering with the network off; a first-ever new Worker() while offline fails by platform behaviour. The worker path runs at base 28 through ?tier=canvas, so production behaviour at 28 stays synchronous (D-06)"
  - "No production code changed: every e2e assertion held against the shipped viewer, so there is no production fix to report"
  - "The 2^26 hydration case is its own test (not a clause of 'the ceiling is data') because its heartbeat must be installed with addInitScript before navigation, which would otherwise apply to every later navigation of the same test"

patterns-established:
  - "Mutation check for redundant guards: when two guards cover each other, record each single mutant as equivalent and the joint mutant as the one a test must kill (06-07 precedent, repeated here for the commit-path and effect-branch supersede calls)"
  - "A guard that is about timing gets a sensitivity mutant: adding createNumogram(n) to the worker commit path makes the heartbeat gap 676 ms against 33 to 38 ms normally, so the 450 ms bound can fail"

requirements-completed: []  # REN-03 is the plan's requirement. Left Pending in REQUIREMENTS.md on purpose: 06-15's task text says "Leave REQUIREMENTS.md checkboxes to the orchestrator (project precedent)", and criterion 5's interpretation is marked [default] for review at verification

# Metrics
duration: ~20min
completed: 2026-10-15
---

# Phase 6 Plan 14: Worker E2E and Worker Chunk Report Summary

**The worker is proven end to end in the exported site: base 10 and every SVG base never create one and a Canvas base creates exactly one, a superseded base never paints (deterministically, with the joint supersede mutant killed), the computing state, pause and ready announcement work, typing or loading 2^26 keeps the page at a 33 to 57 ms worst frame gap, the ceiling is read from the table, both fallbacks draw, and the same single worker loads from `<origin><basePath>/_next/static/chunks/` at the root and under /ccrug and keeps answering base 28 offline. The worker chunk is 17,006 B raw and 6,315 B gzip and carries no lore.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-15T18:22:29Z
- **Completed:** 2026-10-15T18:41Z (about)
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified); no production file changed

## Accomplishments

- **Worker scope (D-06).** `SVG-tier bases never create a worker` opens the viewer and commits 28 and 100 through the Base input: zero `worker` events. `a Canvas base computes in the one worker` opens base 1024 (one worker) and commits 2048 (still one, `data-base` 2048).
- **Stale results (D-07, ROADMAP criterion 3).** A typed 2^26 followed by the 100 chip: the 2^26 message is held, the SVG commit lands, the message is released, the test waits until the 2^26 reply has really come back (`arrived` equals `[67108864]`) plus 500 ms, and a MutationObserver that watches for `section[aria-label="Numogram summary"]` never saw it; the page stays on 100 zones and `base=100`. Rapid Canvas bases (666, then 2048 held, then 1024) end on 1024: the canvas wrapper only ever carried `['666', '1024']`, and the worker saw `[666, 2048, 1024]` in that order, so 2048 was computed, answered and discarded.
- **Computing state (D-07).** After the 150 ms grace: `span[data-computing]` and `[data-picker-status]` read `Computing base 1024...`, the canvas root is `pending` with inline opacity 0.5, the overlay is `aria-busy="true"`, the last result (666) stays on screen, and ArrowRight leaves `data-focus-key` unchanged (with a control step first proving the same key moves the ring when nothing is pending). After release: `data-base` 1024 ready, `Base 1024 ready.`, no `[data-computing]`, no dim, no busy flag.
- **2^26 responsiveness (ROADMAP criterion 4).** Typing 67108864 into a loaded page and loading `?base=67108864&tier=canvas` (heartbeat installed before navigation) both end on the over-limit summary with the ceiling read from the table. Worst rAF gap: 33.2 to 38.1 ms (typed) and 48.1 to 56.8 ms (from the URL), against the 450 ms bound.
- **Ceiling as data and the no-override rule.** `base=${CEIL}` draws; `base=${CEIL + 2}` shows the full over-limit sentence with both numbers from the table, no link in the view and no button containing "anyway" or "export" (the only button is "Copy numogram text"), and no `[data-diagram]`; `base=28&tier=headless` says `Tier override active. Showing the summary and text view for base 28.` and never "interactive limit".
- **Both fallbacks.** With `window.Worker` undefined, base 1024 reaches ready on the main thread with zero worker events and `CEIL + 2` ends on `Base 4002 needs a background worker, which this browser can't start. Showing base 1024.` while the canvas stays at 1024. With a `Worker` whose constructor schedules an error event, base 1024 and then 2048 still draw.
- **Lazy Demons overlay above the ceiling.** From the over-limit view, `Browse demons` opens the dialog showing `[data-demons-total="N"]` with N from `createNumogram(CEIL + 2).demons.count`.
- **Worker in the exported site (T-06-04, ROADMAP criterion 5).** One test in `e2e/static-export.spec.ts`: exactly one worker, whose URL matches `^<origin><basePath>/_next/static/chunks/<file>.js$` (no blob: or foreign URL), then `context.setOffline(true)`, base 28 committed through the existing worker (`?tier=canvas`), ready at 28 with still one worker, and the recorded worker replies equal `[64, 28]` so a main-thread fallback could not pass for the worker. Green at the root (both projects) and through `npm run test:e2e:basepath` under /ccrug (both projects).
- **Worker chunk report.** `scripts/worker-chunks.mjs` lists the `.js` chunks under `_next/static/chunks/` that no HTML references and that carry `importScripts` or the protocol tag, prints sizes and a total, and exits 1 when none is found or one contains `Lurgo` or `Djynxx`. Negative paths checked on fabricated trees (lore leak: exit 1; no worker chunk: exit 1; missing dir: exit 1). Positive control: `Lurgo` is in `chunks/app/numogram/page-*.js` and absent from the worker chunk.

## Worker chunk report (invisible to `check:weight`)

Final root build (`node scripts/worker-chunks.mjs`):

```
worker-chunk _next/static/chunks/397.35507a7dcb1d10a0.js raw=17006 gzip=6315
worker-chunks total: 1 chunk(s) raw=17006 gzip=6315
```

The `/ccrug` build (`NEXT_PUBLIC_BASE_PATH=/ccrug`, staged in `.e2e-basepath/ccrug`, gitignored):

```
worker-chunk _next/static/chunks/397.f4eb17f60a70adde.js raw=17012 gzip=6319
```

The worker is one self-contained classic chunk of about 17 KB (the 06-07 probe saw a 9.5 KB entry plus two shared code chunks; with the real graph webpack kept this one whole). The framework and main chunks of the pages-router runtime remain unreferenced by the app-router HTML but carry neither worker mark, so they are not listed. `check-repo --static-out` (forbidden-marker scan, which covers the worker chunk) passes on the root build.

## Mutation checks (run once; `app/NumogramClient.tsx` restored with `git checkout --` after each, `git diff --quiet app/NumogramClient.tsx` exits 0 afterwards, out/ rebuilt from the clean source)

| Mutant | Result |
|--------|--------|
| delete `worker.supersede()` in the synchronous commit path (the plan's mutant) | **survived**: test 3 stays green |
| delete `worker.supersede()` in the desired-key effect's SVG branch only | **survived** |
| delete both calls (joint) | **killed**: the stale 2^26 reply paints the over-limit summary, `__summarySeen` is true |
| add `createNumogram(n)` to the worker branch of `commitBase` (main-thread build at 2^26) | **killed** by the heartbeat test: max gap 675.8 ms against the 450 ms bound |

The two `supersede()` calls are redundant guards: a synchronous commit sets the base to an SVG-tier base, the desired key becomes null and the effect calls `supersede()` right after render, long before any worker reply, so each call alone is behaviourally equivalent to both. This is the same pair of redundant guards 06-07 recorded for its client. The plan wanted "the supersede mutant killed"; the honest result is that each single mutant is reasoned-equivalent and the joint mutant is killed by test 3, which proves the supersede mechanism itself is exercised and the stale result would paint without it.

## Task Commits

Each carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`):

1. **Task 1: e2e/worker.spec.ts** - `0c51cbc` (test)
2. **Task 2: worker at root and /ccrug offline; worker chunk report** - `cfb03a3` (test)

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

## Files Created/Modified

- `e2e/worker.spec.ts` - 11 tests (364 lines); UTC project only, like the other Phase 4 to 6 UI specs; every threshold read from the tier table
- `e2e/static-export.spec.ts` - the worker URL and offline test appended (35 lines); the existing five tests are unchanged
- `scripts/worker-chunks.mjs` - the chunk report and lore guard (67 lines, Node built-ins and the repo's `isMain`)

## Decisions Made

See `key-decisions`. The plan fixed the scenarios; the judgement calls were holding messages instead of timing them, splitting the hydration heartbeat into its own test, and recording the worker's replies in the offline test.

## Deviations from Plan

### Judgement calls (no production change, no scope change)

1. **Held messages instead of timed delays (Pattern 3 form).** The plan's wrapper delays `postMessage` by 1000 to 1500 ms. The wrapper here queues the message for chosen bases and `releaseWorker(page)` lets it through. Same mechanism (a wrapped `Worker.prototype.postMessage`, installed with `addInitScript`, nothing in `app/`), but the "within the delay" assertions of the computing-state test and the "within 200 ms" of the chip test cannot be lost to a slow machine. The stale-result tests also record every reply that reaches the page by request id, wait for the stale one to arrive (up to 60 s), and only then give React 500 to 1000 ms to paint it wrongly, which the plan's fixed 3000 ms wait could not guarantee at 2^26.
2. **Heartbeat at hydration is its own test.** Plan test 7 combined the ceiling checks and the `tier=canvas` 2^26 case. The heartbeat for the latter is installed with `addInitScript` before navigation, which would also run in every earlier navigation of the same test, so it is a separate test with the same assertions (no `[data-diagram]`, over-limit sentence, gap under 450 ms).
3. **Extra assertions beyond the plan's list.** A control step in the computing-state test (the arrow key moves the ring when nothing is pending, so "unchanged while pending" means something); the order of messages that reached the worker and replies that came back in the rapid-bases test; the heartbeat's frame count above 5 and its trailing gap; in the offline test, the worker's recorded replies `[64, 28]`.
4. **The ceiling-adjacent part of test 7 asserts that the over-limit view has no link and no button with "anyway" or "export" in it** (the sentence itself says "headless export" in a paragraph, and the only button is the text view's copy button).
5. **`next lint --dir e2e` reports two errors in files this plan did not touch** (`e2e/canvas-tier.spec.ts:78` unused `pairScene`, `e2e/visual-dom.ts:50` unused expression). The repo's lint script covers `app`, `engine` and `workers` only, so they are outside the gate; logged in `deferred-items.md` and left alone. `e2e/worker.spec.ts`, `e2e/static-export.spec.ts` and `scripts/worker-chunks.mjs` are not among them (`tsc` is clean).

### Auto-fixed Issues

None. Every spec was green against the shipped viewer on its first run.

**Total deviations:** none of scope; five judgement calls above. **Impact on plan:** none, except that the supersede mutant result is stated as joint-killed rather than single-killed.

## Issues Encountered

- A first `grep` in the verify wait loop matched the early `check-repo: OK` line; the final wait used the background task's own exit line instead. No effect on the gate.

## Verification

- `npx playwright test e2e/worker.spec.ts --project=chromium-utc` after `npm run build`: 11 passed, then again with `--repeat-each=3`: 33 passed (4 full runs, 44 passes, no flake). Heartbeat max gaps seen: 33.2, 35.2, 36.6, 38.1 ms (typed 2^26) and 48.1, 52.9, 53.7, 56.2, 56.8 ms (hydration at 2^26).
- `npx playwright test e2e/static-export.spec.ts`: 12 passed (both projects, root path). `npm run test:e2e:basepath`: 12 passed under /ccrug.
- `node scripts/worker-chunks.mjs`: exit 0, one `worker-chunk` line (above). `node scripts/check-repo.mjs --static-out` on the final root build: OK (the 11 default checks plus static-out). `node scripts/check-repo.mjs --only base-ten` after `git add` of the new files: OK.
- `npx tsc --noEmit --incremental false`: exit 0. `grep -rn "addInitScript" app` prints nothing. `git status --porcelain e2e/__golden__ e2e/__behaviour__` prints nothing; no `-u` anywhere; `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**`, `useCanvasPan.ts` and `NumogramClient.tsx` are unchanged (`git diff --quiet app/NumogramClient.tsx` exits 0), so `npm run test:swap` was not required.
- `MSYS_NO_PATHCONV=1 npm run verify`: **exit 0.** check:repo OK; typecheck (4x tsc plus lint) OK; 88 files and 2411 unit tests in UTC and again in America/New_York; sub-path e2e 12 passed; build OK; `page-weight: OK (2 routes, 30 golden states within tolerance)` with no baseline update; e2e 237 passed and 165 skipped (the 11 worker tests run in the UTC project only and skip in the New York project, like the other UI specs; the 60 DOM goldens and the behaviour baseline unchanged); check-repo clean-tree and static-out OK (13 checks).

## ROADMAP criterion 5 interpretation (for review at verification)

"The exported static site, with and without a `basePath`, computes base 28 through the worker offline" is read as research A1 and the plan fixed it: the site needs only its static files (no server and no external dependency; the 'no foreign, Vercel or API requests' test still passes), and the already-created long-lived worker keeps answering with the network off. A first-ever `new Worker()` while offline fails by platform behaviour because the browser must fetch the chunk, which is why the client creates one worker and never respawns it. Base 28 reaches the worker through the existing diagnostic `?tier=canvas` override, so production behaviour at 28 stays synchronous (D-06). Evidence: root and /ccrug, worker URL under `_next/static/chunks/`, replies `[64, 28]` recorded from the worker while offline.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-06-04 (worker URL asserted as `<origin><basePath>/_next/static/chunks/<file>.js` at the root and under /ccrug, no blob: or foreign URL, `check-repo --static-out` scans the worker chunk; mitigated), T-06-03 (deterministic held-message scenarios, joint supersede mutant killed; mitigated), T-06-01 (2^26 heartbeat under 450 ms, with a sensitivity mutant that makes it fail at 676 ms; mitigated) and T-06-06 (static-out scan plus `worker-chunks.mjs` lore guard with a checked negative path; mitigated).

## Next Phase Readiness

- 06-15 (the phase gate) can rely on `e2e/worker.spec.ts` and the static-export worker test, and should include the worker chunk line (17,006 B raw, 6,315 B gzip) in its report. REQUIREMENTS.md checkboxes for REN-02 and REN-03 are left to the orchestrator as 06-15 says.
- Deferred item 008 (Regions panel overlapping the Currents header) is unrelated to this plan and untouched.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-15*

## Self-Check: PASSED

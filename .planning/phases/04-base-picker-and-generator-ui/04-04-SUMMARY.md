---
phase: 04-base-picker-and-generator-ui
plan: 04
subsystem: ui
tags: [numogram, routes, geometry, mig-02, licensing, notice]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: createNumogram(10)/Numogram.partner/zoneCount/pairCount (BASE10), the base-10 preset adapters (GATE_LIST/CURRENTS/SYZYGIES)
provides:
  - app/presets/base10/routes.ts — base10GateRender/base10CurrentRender, the moved-and-generalized upstream gate/current SVG route geometry for the four authored base-10 layouts, proven against the frozen DOM goldens
  - A shrunk app/NumogramClient.tsx (two ~350-line memos replaced by two pure-function calls plus a memoized zoneRadius)
  - tests/presets/base10-routes.test.ts, a golden-parity harness other plans can copy when moving more upstream geometry
affects: [04-16 (MIG-02 close-out: the remaining hard-coded-base-10 worklist and defaulting the check-repo grep gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verbatim-move-with-enumerated-edits: geometry code character-for-character relocated out of a component, with only the 10-zone literals replaced by g.zoneCount/g.pairCount/g.partner(z) loops, proven equal to a byte-frozen oracle instead of re-derived from scratch."
    - "Golden parity without a browser: read the frozen DOM goldens' d=\"...\" attributes as a plain-text Set, run the moved function in Node, and assert canonAttr-normalized output is a member of that set — the same normalization the Playwright golden capture itself uses (e2e/visual-dom.ts), so no snapshot regeneration is ever needed to validate a refactor."

key-files:
  created:
    - app/presets/base10/routes.ts
    - tests/presets/base10-routes.test.ts
  modified:
    - app/NumogramClient.tsx
    - NOTICE
    - tests/presets/base10-adapter.test.ts

key-decisions:
  - "The Base10RouteInput.g field name (the Numogram instance) intentionally shadows the pre-existing local loop variable `for (const g of gates)` inside base10GateRender — this is the exact original variable name carried over verbatim (rule: move character-for-character), and TypeScript/ESLint have no no-shadow rule configured in this repo, so the shadow is legal and harmless (the loop body never needs the outer Numogram)."
  - "zoneRadius, previously a closure inside each memo, becomes an injected function field on Base10RouteInput (NumogramClient.tsx builds it once via useCallback and passes the same reference to both render calls), matching the plan's rule-5 'reference the input fields' edit rather than duplicating the closure inside routes.ts."
  - "MIG-02 stays Pending in REQUIREMENTS.md after this plan: it removes route geometry's 10-zone literals from NumogramClient.tsx (one item off the 04-01 worklist) but the grep gate is still opt-in and other worklist files (Projection.tsx, InfoDisplay.tsx, panels, useTween.ts, geometry.ts, shareParams.ts, xenotation.ts) are untouched; the final covering plan remains 04-16, per the 04-01/04-03 precedent."

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-09-28
---

# Phase 4 Plan 04: Base-10 Route Geometry Extraction Summary

**Moved the ~350-line upstream gate/current SVG route geometry out of NumogramClient.tsx into a pure app/presets/base10/routes.ts module (10-zone literals replaced by engine-derived loops), proved it byte-for-byte equal to the frozen DOM goldens without a browser, and updated NOTICE's licensing record for the new upstream-derived file.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-28T19:10:49-06:00 (immediately after 04-03's completion commit)
- **Completed:** 2026-09-28T19:28:09-06:00
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `app/presets/base10/routes.ts`: `base10GateRender`/`base10CurrentRender`, exact upstream geometry (self-arc placement, concave gate bezier lanes, Y-shaped current routing, orientation caching) with the only changes being the enumerated ones — `connectionVectors`/`connectedByZone` built via `for (let z = 0; z < g.zoneCount; z++)` loops instead of 10-key object literals, `9 - c.from` replaced by `g.partner(c.from)`, the `for (let z = 0; z <= 4; z++)` special loop replaced by `for (let z = 0; z < g.pairCount; z++) addConnectionVector(z, g.partner(z), 0.5)`, and `typeof GATE_LIST` replaced by `GateData[]`.
- `app/NumogramClient.tsx`: the two `useMemo` geometry blocks reduced to `zoneRadius` (one `useCallback`) plus two calls into the new module; the five now-unused geometry helper imports (`midpoint`, `syzMidBiased`, `loopPath`, `curveAway`, `quadPath`) and the two now-unused `GateRender`/`CurrentRender` type imports were removed to keep lint clean.
- `tests/presets/base10-routes.test.ts`: for `original`/`labyrinth`/`ladder`, asserts exactly 10 gate entries keyed by `GATE_LIST` names, self-gates (zones 0/1/9) render `loop` and the rest `single`, every gate/current path/leg/stem/loop string (after `canonAttr('d', ...)` normalization) is a member of the frozen golden's `d="..."` attribute set, no string contains `NaN`, and `findHardcodedBaseTen` finds zero hard-coded base-10 patterns in the moved source text (checked under a path outside the real exemption list, to prove the literals are actually gone rather than merely exempted).
- `NOTICE`: section 1's `app/presets/base10/` exclusion list and section 2's upstream-derived file list both updated to include `routes.ts`, matching `layout-tables.ts`'s precedent.
- Full `npm run verify` green on the committed tree (build, typecheck+lint, unit tests in both timezones, sub-path e2e, page-weight, 75 e2e + 5 skipped including the 60 DOM goldens and 5 behaviour-baseline specs, clean-tree/static-out); page-weight baseline unchanged (`git diff --quiet HEAD~2 -- perf/page-weight.baseline.json` exits 0). `/numogram/` now measures 581,112 bytes raw / 175,607 bytes gzip of JS (`node scripts/page-weight.mjs print`), within the stored tolerance — the move shrank a component and grew a new module by the same code, so no budget change was needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract base10GateRender/base10CurrentRender with a golden-parity test** - `ff3b221` (refactor)
2. **Task 2: NOTICE entry for routes.ts and the full gate** - `0efd14f` (docs)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `app/presets/base10/routes.ts` - `Base10RouteInput`, `base10GateRender`, `base10CurrentRender` (upstream-derived, NOTICE section 2)
- `app/NumogramClient.tsx` - two geometry memos replaced by calls into `routes.ts`; five geometry-helper imports and two now-unused type imports removed
- `tests/presets/base10-routes.test.ts` - golden-parity proof for all three DOM-golden layouts plus the MIG-02 cleanliness check
- `NOTICE` - section 1 exclusion list and section 2 entry updated for `routes.ts`
- `tests/presets/base10-adapter.test.ts` - Rule 3 fix (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (the intentional `g` shadow, `zoneRadius` as an injected field, and MIG-02 staying Pending).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `tests/presets/base10-adapter.test.ts`'s CCRU-lore scanner flagged the moved code's literal current-name checks**
- **Found during:** Task 1, first `npm run test:swap` run (after the golden-parity test and typecheck were already green)
- **Issue:** `tests/presets/base10-adapter.test.ts` (a pre-existing Phase 2 test, not in this plan's `files_modified`) auto-discovers every `.ts` file directly under `app/presets/base10/` (except `lore.ts`) and fails if any of them contains a quoted literal matching one of the five current names, on the theory that a bare quoted current name in an MIT-labeled file is decorative lore. `routes.ts` legitimately contains `c.name === 'Warp'` and `c.name === 'Plex'` — upstream routing logic (which pair converges to its low zone), moved verbatim per this plan's explicit instruction to keep that exact check — which the scanner flagged as "the current name Plex"/"the current name Warp".
- **Fix:** Extended the scanner's exemption list (previously only `lore.ts`) to also exclude `routes.ts`, with a comment explaining why: the file is NOTICE section 2 (not MIT, like `layout-tables.ts`) and its quoted literals are structural routing logic, not decorative lore text. Updated the companion assertion and test description (`'only lore.ts is exempt'` -> `'only lore.ts and routes.ts are exempt'`) to match.
- **Files modified:** `tests/presets/base10-adapter.test.ts`
- **Verification:** `npx cross-env CCRUG_TZ=UTC vitest run tests/presets/base10-adapter.test.ts` (44/44 green), then the full oracle suite (1386/1386) and `MSYS_NO_PATHCONV=1 npm run test:swap` (60 goldens + 5 behaviour + 1386 unit tests) all green; re-confirmed by the final `npm run verify` run.
- **Committed in:** `ff3b221` (part of the Task 1 commit, since it was required for that task's own verification command to pass)

## Issues Encountered

None beyond the auto-fixed item above. The golden-parity test (`tests/presets/base10-routes.test.ts`) passed on the first run with no debugging needed, confirming the move introduced no geometric drift.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/NumogramClient.tsx` no longer holds base-10 route geometry or its 10-zone loops; `app/presets/base10/routes.ts` is a reusable pattern (and golden-parity test template) for any later plan moving more upstream-authored geometry out of the component.
- No blockers. MIG-02 correctly remains `Pending` in REQUIREMENTS.md pending its final covering plan (04-16) — this is expected, not a gap; the rest of the 04-01 worklist (`Projection.tsx`, `InfoDisplay.tsx`, the panel components, `useTween.ts`, `geometry.ts`, `shareParams.ts`, `xenotation.ts`) is unaffected by this plan.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-28*

## Self-Check: PASSED

`app/presets/base10/routes.ts`, `tests/presets/base10-routes.test.ts` and this SUMMARY.md all verified present on disk; both task commits (`ff3b221`, `0efd14f`) verified present in `git log --oneline --all`.

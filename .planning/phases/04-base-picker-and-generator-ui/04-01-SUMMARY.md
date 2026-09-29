---
phase: 04-base-picker-and-generator-ui
plan: 01
subsystem: testing-infra
tags: [mig-02, behaviour-baseline, check-repo, grep-gate, data-post-baseline]

# Dependency graph
requires:
  - phase: 02-engine-core-and-base-10-migration
    provides: "the frozen behaviour and text baseline (e2e/__behaviour__/*.json, D-15) that this plan extends with a marker contract without regenerating it"
provides:
  - "e2e/behaviour-collect.ts / e2e/behaviour.spec.ts: a data-post-baseline marker contract letting Phase 4 add new interactive chrome (header base picker, isolate/mute, collapse toggles, extra layout buttons, Text panel, ARIA roles) without ever regenerating the frozen behaviour JSON, with a spec-level guard that fails if any pre-existing region is ever marked"
  - "scripts/check-repo.mjs: findHardcodedBaseTen/BASE_TEN_PATTERNS/BASE_TEN_EXEMPT and the opt-in 'base-ten' check (node scripts/check-repo.mjs --only base-ten), tested against failing inputs, not yet a default check"
affects: [04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marker contract: new Phase 4 DOM carries data-post-baseline on its root element; the collector's postBaseline(el) helper (el.closest('[data-post-baseline]')) skips such subtrees in every place the frozen JSON reads text/interactive rows/svg count/popovers/headers, so the skip is a no-op against everything captured at baseline-freeze time (2026-09-26) and the frozen JSON is never regenerated"
    - "Oracle-erosion guard: behaviour.spec.ts computes markedRegions via page.evaluate and asserts it is empty (via expect, never via B(...), which would leak into the recorded JSON) — marking any PANELS header, the page header, or the projection svg fails the spec outright, so the marker cannot be used to hide pre-existing UI"
    - "check-repo pure-helper convention extended: findHardcodedBaseTen(files) takes in-memory {path, text} objects (never touches disk itself), registered in CHECKS but deliberately withheld from DEFAULT_CHECKS until the tree's own worklist is cleared (04-16)"

key-files:
  created: []
  modified:
    - e2e/behaviour-collect.ts
    - e2e/behaviour.spec.ts
    - scripts/check-repo.mjs
    - tests/repo/check-repo.test.ts

key-decisions:
  - "Rule 1 (auto-fixed bug, commit 0d2c77f): the markedRegions page.evaluate callback's `names` parameter inferred PANELS' literal-union array type from the `[...PANELS]` argument, so `names.includes(t)` on a plain `string` failed tsc under npm run typecheck (not caught by the earlier standalone playwright run, only by the full npm run verify). Fixed by annotating the callback parameter as `string[]`; no behaviour change, playwright behaviour spec re-run green after the fix."
  - "MIG-02 worklist recorded from `node scripts/check-repo.mjs --only base-ten` on the current tree: app/NumogramClient.tsx, app/components/projection/Projection.tsx, app/components/info/InfoDisplay.tsx, app/components/panels/{Currents,Gates,Zones}Panel.tsx, app/hooks/useTween.ts, app/lib/geometry.ts, app/lib/shareParams.ts, app/lib/xenotation.ts — matches 04-RESEARCH.md Priority 3 exactly, confirming the patterns are calibrated correctly for later Phase 4 plans and for 04-16's default-check activation."

# Metrics
duration: ~30min
completed: 2026-09-28
---

# Phase 4 Plan 1: Behaviour Baseline Marker Contract and MIG-02 Grep Gate Summary

**Added a `data-post-baseline` marker contract so Phase 4's new UI can coexist with the frozen behaviour baseline without ever regenerating it, and shipped the MIG-02 hard-coded-base-10 grep gate as a tested, opt-in `check-repo` check with the current violation worklist recorded.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (1 auto, 1 auto+TDD)
- **Files modified:** 4 (`e2e/behaviour-collect.ts`, `e2e/behaviour.spec.ts`, `scripts/check-repo.mjs`, `tests/repo/check-repo.test.ts`)

## Accomplishments

- **Marker contract in the collector** (`e2e/behaviour-collect.ts`): added `postBaseline(el)` (`el.closest('[data-post-baseline]') !== null`) and applied it at exactly five points — `visibleText`, panel/page-header detection, the interactive-elements loop (checked before the projection-svg check, so a marked element inside the svg is never counted in `svgInteractive`), the popovers list, and the `otherPageText` tree walker. No other logic (regions, `SEL`, name/flags formatting, open-state detection) was touched. A verbatim contract paragraph was added to the file's top comment.
- **Spec-side exclusion and guard** (`e2e/behaviour.spec.ts`): the panel-toggle loop, `driveMobile`'s toggle locators, the layout-button locator and the popovers helper all gained `:not([data-post-baseline])`. A `markedRegions` guard (via `page.evaluate` + `expect`, never `B(...)`) was added right after the initial snapshot in both `driveLayout` and `driveMobile`, asserting no PANELS header, page header, or projection svg is ever marked — proving the marker cannot be used to hide pre-existing UI.
- **No-op proven on the unchanged app**: fresh `next build`, then `npx playwright test e2e/behaviour.spec.ts e2e/golden.spec.ts` — 5 behaviour tests (chromium-utc) and 60 golden runs (both timezones) all green, `git status --porcelain e2e/__behaviour__ e2e/__golden__` empty, `node scripts/check-repo.mjs --only goldens` OK.
- **MIG-02 grep gate** (`scripts/check-repo.mjs`): `BASE_TEN_PATTERNS` (11 patterns covering `9 - x`, the two named torque zone/walk literals, `<=9`/`>9`/`<=4` bounds, `{ length: 10 }`, `total={10}`, `}=9`, and the `[0..9]`/`[1..9]` zone lists), `BASE_TEN_EXEMPT` (the base-10 preset plus the base-10-only planetary layout files and icon geometry), `findHardcodedBaseTen(files)`, and an `appSourceFiles()` helper scanning tracked `.ts`/`.tsx` files under `app/`. Registered as the opt-in `'base-ten'` check (`--only base-ten`), explicitly **not** added to `DEFAULT_CHECKS` (the tree still violates it until plan 04-16 flips it on).
- **TDD gate honored**: tests were written first in `tests/repo/check-repo.test.ts` (a fixture per pattern, an exemption test, seven generic-code negative fixtures, a line-number test, and a multi-file/multi-pattern test), run red (failed to even load — `BASE_TEN_EXEMPT`/`findHardcodedBaseTen` undefined), then made green by the implementation above.
- **Full phase gate green on the committed tree**: `MSYS_NO_PATHCONV=1 npm run verify` exit 0 (`check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow, clean-tree, static-out)`, 958+ unit tests in both timezones, sub-path e2e, build, page-weight OK, 75 e2e passed + 5 skipped = 60 goldens + 10 static-export + 5 behaviour). `base-ten` is not a default check, so it did not affect this result.

## MIG-02 Worklist (recorded via `node scripts/check-repo.mjs --only base-ten`)

| File | Violations |
|---|---|
| `app/NumogramClient.tsx` | `zone bound <= 9` x5 (lines 180, 421, 510, 581, 845), `partner 9 - x` x7 (593, 618, 860, 887, 997, 1003, 1212), `torque zones [1, 2, 4, 5, 7, 8]` x2 (522, 842), `half-base bound <= 4` (1002), `zone list [0..9]` (1310) |
| `app/components/projection/Projection.tsx` | `partner 9 - x` x6 (50, 266, 479, 740, 851, 865), `torque walk [1, 8, 7, 2, 5, 4, 1]` x2 (822, 996), `zone list [1..9]` (117) |
| `app/components/info/InfoDisplay.tsx` | `nine-sum = 9` x2 (41, 95) |
| `app/components/panels/CurrentsPanel.tsx` | `partner 9 - x` (28) |
| `app/components/panels/GatesPanel.tsx` | `zone total={10}` (68) |
| `app/components/panels/ZonesPanel.tsx` | `ten-zone array { length: 10 }` (39), `zone total={10}` (72) |
| `app/hooks/useTween.ts` | `zone bound <= 9` (48) |
| `app/lib/geometry.ts` | `partner 9 - x` x2 (8, 40) |
| `app/lib/shareParams.ts` | `zone bound > 9` (64) |
| `app/lib/xenotation.ts` | `zone bound <= 9` (178) |

This matches `04-RESEARCH.md` Priority 3 file-for-file, confirming the patterns are correctly calibrated for later Phase 4 plans to clear and for plan 04-16 to promote to a default check.

## Task Commits

Each task was committed atomically:

1. **Task 1: `data-post-baseline` marker contract** — `e3059b2` (test)
   - Rule 1 fix discovered during Task 2's `npm run verify` typecheck step — `0d2c77f` (fix)
2. **Task 2: MIG-02 grep gate `findHardcodedBaseTen`** — `637172c` (feat)

## Files Created/Modified

- `e2e/behaviour-collect.ts` — `postBaseline(el)` helper plus five skip sites (visible text, headers/pageHeader, interactive loop, popovers, otherPageText); contract paragraph added to the top comment
- `e2e/behaviour.spec.ts` — `:not([data-post-baseline])` on four locators; `markedRegions` guard in `driveLayout` and `driveMobile`; comment referencing the contract
- `scripts/check-repo.mjs` — `BASE_TEN_PATTERNS`, `BASE_TEN_EXEMPT`, `findHardcodedBaseTen`, `appSourceFiles()`, `'base-ten'` registered in `CHECKS` (not `DEFAULT_CHECKS`); header comment updated ("any of the thirteen")
- `tests/repo/check-repo.test.ts` — new `describe('findHardcodedBaseTen', ...)` block: 11 per-pattern fixtures, a line-number test, an exemption test over every `BASE_TEN_EXEMPT` entry, 7 generic-code negative fixtures, a multi-file/multi-pattern test

## Decisions Made

See `key-decisions` in the frontmatter above (the Rule 1 typecheck fix, and the recorded MIG-02 worklist confirming pattern calibration).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `markedRegions` `page.evaluate` callback failed `tsc` under the literal-union array type**

- **Found during:** Task 2's `npm run verify` (the `typecheck` step; not caught by the standalone `npx playwright test` run in Task 1, since Playwright uses `ts-node`/esbuild transpilation without full type-checking)
- **Issue:** `page.evaluate(names => {...}, [...PANELS])` let TypeScript infer `names` as the literal-union array type of `PANELS` (`("Layers" | "Labels" | ... )[]`), so `names.includes(t)` on a plain `string` `t` was a type error (`string` not assignable to the union) at all four call sites (two in `driveLayout`, two in `driveMobile`).
- **Fix:** Annotated the callback parameter explicitly as `(names: string[]) => {...}`; the `[...PANELS]` argument (a mutable array of the union type) is assignable to `string[]`, and `string[].includes(string)` type-checks cleanly. No runtime/behaviour change.
- **Files modified:** `e2e/behaviour.spec.ts`
- **Verification:** `npx tsc --noEmit --incremental false` clean; `npx playwright test e2e/behaviour.spec.ts --project=chromium-utc` re-run green (5/5) after the fix.
- **Commit:** `0d2c77f`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope change; the fix is a type-only correction with no effect on the marker contract or the recorded behaviour JSON.

## Issues Encountered

None beyond the Rule 1 fix above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The marker contract is available for every subsequent Phase 4 plan: any new interactive element (header base picker, isolate/mute buttons, collapse toggles, extra layout buttons, Text panel, ARIA roles) can carry `data-post-baseline` on its root to stay invisible to the frozen behaviour baseline, with the spec itself refusing to let a pre-existing region be marked.
- The MIG-02 grep gate exists and is runnable today via `node scripts/check-repo.mjs --only base-ten`; it is intentionally not a default check yet. Later Phase 4 plans clear the recorded worklist file-by-file; plan 04-16 is expected to add `'base-ten'` to `DEFAULT_CHECKS` once the tree is clean.
- No frozen oracle (numeric golden, DOM goldens, behaviour baseline, derived-bases fixture) was touched or regenerated by this plan.

## Self-Check: PASSED

- FOUND: `e2e/behaviour-collect.ts` contains `postBaseline(`
- FOUND: `e2e/behaviour.spec.ts` contains `markedRegions`
- FOUND: `scripts/check-repo.mjs` contains `export function findHardcodedBaseTen`
- FOUND: `tests/repo/check-repo.test.ts` contains `describe('findHardcodedBaseTen'`
- FOUND commit `e3059b2` (Task 1)
- FOUND commit `0d2c77f` (Rule 1 fix)
- FOUND commit `637172c` (Task 2)
- FOUND: working tree clean at HEAD `637172c`
- FOUND: `npm run verify` exit 0 on the committed tree (`check-repo: OK (..., clean-tree, static-out)`)

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-28*

---
phase: 06-canvas-tier-and-worker
plan: 09
subsystem: ui
tags: [base-picker, computing-state, selection-panel, url-codec, ssr-tests, fast-check, vitest, large-bases]

# Dependency graph
requires:
  - phase: 06-canvas-tier-and-worker
    provides: 06-01's INTERACTIVE_MAX_N and the data-driven tierFor (natural tier), so the URL guard and the tests read the ceiling from the table
  - phase: 06-canvas-tier-and-worker
    provides: 06-06's NumogramViewContextValue.tier, which InfoDisplay reads to cap the Selection list by tier
  - phase: 04-base-picker-and-generator-ui
    provides: BasePicker (candidate, debounce, refusal slot) and the strict-base URL codec these guards extend
provides:
  - BasePicker optional props requestedBase, computing and announcement (defaults keep today's behaviour and markup), with the `Computing base {n}...` status in the summary slot and a persistent sr-only role=status carrier
  - app/lib/selectionList.ts: SELECTION_LIST_MAX (200), mergeSelectionOrder (O(k), identity-preserving) and capSelection (tier-aware)
  - InfoDisplay using the O(k) merge and listing at most 200 entries above the SVG tier, plus an `and {M} more selected` line
  - parseShareParams dropping region=, isolate= and mute= when the natural tier of the base is headless, so no URL builds a numogram on the main thread above the ceiling
  - tests/app/basePickerRender.test.ts (8), tests/app/selectionList.test.ts (15), tests/app/shareParamsHeadless.test.ts (9)
affects: [06-11, 06-12, 06-14, 06-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pending-switch prop pair (requestedBase, computing) layered over an unchanged displayed-base prop: every editable value and commit runs on the effective base, every display (header, type counts, label controls) keeps the displayed one"
    - "Identity-preserving merge: the pure function returns its input when nothing changed, so a React state setter given the result bails out and cannot loop"
    - "A guard keyed on the NATURAL tier (override ignored) so a diagnostic URL parameter can neither bypass a safety guard nor change small-base codec behaviour"
    - "vi.mock with importOriginal and a vi.fn wrapper to prove an expensive call is NOT made, by call count rather than timing"

key-files:
  created:
    - app/lib/selectionList.ts
    - tests/app/basePickerRender.test.ts
    - tests/app/selectionList.test.ts
    - tests/app/shareParamsHeadless.test.ts
  modified:
    - app/components/numogram/BasePicker.tsx
    - app/components/info/InfoDisplay.tsx
    - app/lib/shareParams.ts

key-decisions:
  - "The role=status carrier is a persistent sr-only span; the visible computing span is replaced in place with data-computing=true and NO role, so the announcement is read once (checker recommendation 1)"
  - "SELECTION_LIST_MAX = 200 at the Canvas and headless tiers, no cap at the SVG tier (at most about 800 entries at base 200, unchanged behaviour)"
  - "The URL guard uses tierFor(base) === 'headless' (override ignored), so tests/app/shareParams.test.ts, which round-trips tier together with region/isolate/mute at bases 2..64, stays untouched and green"
  - "InfoDisplay's orderedKeys state is typed readonly string[] instead of casting the merge result as string[]"
  - "The new picker props are optional (requestedBase defaults to base, computing to false, announcement to ''), so NumogramClient compiles unchanged until 06-11 wires them"

patterns-established:
  - "effectiveBase = requestedBase ?? base is the single value the picker edits, steps, chips and commits against"
  - "capSelection(items, tier, max) returns the input array itself when nothing is cut"

requirements-completed: []  # REN-02 and REN-03 stay Pending: this plan lands the picker, panel and codec guards only; the Canvas component (06-10), the integration (06-11) and the e2e specs (06-12..06-14) are what make them true

# Metrics
duration: 13min
completed: 2026-10-08
---

# Phase 6 Plan 09: Large-Base Guards Summary

**The base picker keeps the requested numeral and shows `Computing base {n}...` in place with a persistent sr-only status carrier while a worker computes, the Selection panel merges its order in O(k) and lists at most 200 entries above the SVG tier, and the URL codec never builds a numogram for a base above the interactive ceiling.**

## Performance

- **Duration:** ~13 min (including one full `npm run verify` of about 4 min)
- **Started:** 2026-10-08T19:45:00Z
- **Completed:** 2026-10-08T19:58:00Z
- **Tasks:** 3 (all TDD: a RED commit then a GREEN commit each)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- **Picker computing state (D-07, research P19, T-06-23).** `BasePicker` gained optional `requestedBase`, `computing` and `announcement`. `effectiveBase = requestedBase ?? base` now drives the re-sync effect, `evaluateCandidate`, the commit-if-changed checks in `evaluateNow` and `commitNow`, both steppers, the chips' `active`, the slider fallback and the Escape reset, so with a worker pending the numeral never snaps back to the displayed base and a stepper steps from the requested one. `LabelSchemeControls`, `summaryLine` and `typeCountsLine` keep the displayed base and summary. The summary slot is `refusal ? refusal span : computing ? <span id data-computing="true">Computing base {n}...</span> : summary span`, so a failure still wins over the computing text and the `aria-describedby` target keeps its id in all three states. A persistent `<span role="status" data-picker-status="" class="sr-only">{announcement}</span>` sits after the slot. With defaults the markup is today's markup plus that one empty span, asserted byte for byte against the markup captured from the untouched component.
- **Bounded, linear Selection list (T-06-09, research P5).** `app/lib/selectionList.ts` exports `SELECTION_LIST_MAX = 200`, `mergeSelectionOrder` (two Sets, returns `prev` itself when the merge is element-wise equal, so the React setter bails out and cannot loop) and `capSelection` (SVG tier never capped; Canvas and headless keep the first 200 and report the rest; returns the input array itself when nothing is cut). `InfoDisplay` replaces the O(k^2) `kept.includes` pass with the merge and builds its group items from `capSelection(orderedKeys, ctx.tier).shown`, so `selectedInfoMeta` and `renderInfoContent` run for at most 200 entries; when entries are hidden it renders `and {hidden} more selected` (`data-post-baseline`, `data-selection-more`, 10px gray-500) after the `PanelGroup`.
- **URL codec guard (T-06-01d, research P6).** `parseShareParams` computes `aboveCeiling = tierFor(base) === 'headless'` and skips the `createNumogram` branch for it, so `region=`, `isolate=` and `mute=` are dropped above the ceiling. The 2^26 case that used to cost about 650 ms and +271 MiB in the RED run now costs nothing; every other field (base, selected, tc, layers, tier) still parses.
- **Tests.** `basePickerRender` (8 SSR tests: requested numeral, computing span markup and absence of a role, refusal wins, id stable in three states, byte-level baseline plus carrier, announcement text, defaults), `selectionList` (15: the spec's examples, identity, a 20,000-key order check, a 200,000-key linear-time guard that would take minutes through an O(k^2) pass, a fast-check property of 200 runs over up to 300 keys against the old O(k^2) body including result identity, cap per tier), `shareParamsHeadless` (9: spy proves `createNumogram` is not called at INTERACTIVE_MAX_N + 2 or 2^26 with region fields, is called once at base 28 and at the top of the Canvas tier, and that `tier=svg` at a huge base and `tier=headless` at base 28 behave as specified).

## Task Commits

Each task was TDD: a RED commit (failing tests, run and seen to fail for the intended reason) then a GREEN commit. Every commit carries the Co-Authored-By trailer (checked with `git log -1 --format=%B`).

1. **Task 1: Base picker computing state**
   - `083dfc2` test(06-09): failing tests for the base picker computing state (5 failed, 3 passed)
   - `a9b311e` feat(06-09): base picker computing state with requested base and status carrier
2. **Task 2: Bounded, O(k) Selection list**
   - `0807b96` test(06-09): failing tests for the bounded O(k) selection list (module not found)
   - `a0248d8` feat(06-09): bounded O(k) selection list for the Canvas and headless tiers
3. **Task 3: URL codec never builds a numogram for a headless base**
   - `9f64306` test(06-09): failing tests for the headless-tier URL guard (3 failed, 6 passed: `expected 'plex' to be null`)
   - `355e575` feat(06-09): URL codec never builds a numogram for a headless base

**Plan metadata:** recorded by the final docs commit (SUMMARY, STATE, ROADMAP).

## Files Created/Modified

- `app/lib/selectionList.ts` - `SELECTION_LIST_MAX`, `mergeSelectionOrder`, `capSelection` (pure, engine type import only)
- `app/components/numogram/BasePicker.tsx` - three optional props, `effectiveBase`, computing summary span, persistent status carrier
- `app/components/info/InfoDisplay.tsx` - O(k) merge, tier cap, `and {M} more selected` line
- `app/lib/shareParams.ts` - `tierFor` import, `aboveCeiling` guard before the numogram branch, doc comment
- `tests/app/basePickerRender.test.ts`, `tests/app/selectionList.test.ts`, `tests/app/shareParamsHeadless.test.ts` - new test files

## Decisions Made

See `key-decisions` above. The plan fixed the structure and the copy; the judgement calls were typing `orderedKeys` as `readonly string[]` (no cast) and rewording two doc comments so the literal `Computing base ` appears once in `BasePicker.tsx` (the plan's acceptance grep counts exactly one occurrence, the status template).

## Deviations from Plan

None - plan executed exactly as written. Small additions inside the plan's open space, none changing behaviour: the 200,000-key linear-time guard test, a `tier=svg`-at-a-huge-base test documenting that the guard ignores the override, a canvas-top-of-range case (`base=4000` still validates region, isolate and mute), and `InfoDisplay`'s state typed `readonly string[]` where the plan said `as string[]`.

## Issues Encountered

None. Two RED-phase notes, neither a defect: `renderToStaticMarkup` HTML-escapes an apostrophe (`Couldn't` became `Couldn&#x27;t`), so the refusal-wins test uses a message without one; and the shareParams RED run built `createNumogram(2^26)` once (650 ms), which is exactly the cost the guard removes.

## Verification

- `npx vitest run tests/app/basePickerRender.test.ts tests/app/basePicker.test.ts --project oracle`: 34 passed (RED was 5 failed of 8).
- `npx vitest run tests/app/selectionList.test.ts --project oracle`: 15 passed (RED was the missing module).
- `npx vitest run tests/app/shareParamsHeadless.test.ts tests/app/shareParams.test.ts --project oracle`: 65 passed (RED was 3 failed of 9); `git diff --stat tests/app/shareParams.test.ts` prints nothing.
- Acceptance greps: `requestedBase?: number` 1, `data-picker-status` 1, `Computing base ` 1, `stepBase(base,` 0 in BasePicker; `kept.includes` 0, `mergeSelectionOrder(` 1, `capSelection(` 1 in InfoDisplay; `export const SELECTION_LIST_MAX = 200` 1; `tierFor(base) === 'headless'` 1 and `tierFor(base, tier)` 0 in shareParams.
- `npm run typecheck` (4x tsc plus lint): exit 0 after each task; the only lint output is the existing `react-hooks/exhaustive-deps` warning in `DemonMatrix.tsx` (untouched).
- `node scripts/check-repo.mjs --only base-ten`: OK, run after `git add` of the new files (the gate scans tracked files only).
- `MSYS_NO_PATHCONV=1 npm run verify`: exit 0. 83 test files and 2155 unit tests in both timezones, sub-path e2e 10 passed, build OK, page-weight OK (2 routes, 30 golden states within tolerance, no baseline update), e2e 200 passed and 130 skipped (the 60 DOM goldens and the behaviour baseline unchanged), check-repo 13/13 including clean-tree and static-out.
- `NumogramClient.tsx`, `Projection.tsx`, `PairGraphProjection.tsx`, `app/presets/base10/**` and `useCanvasPan.ts` are untouched, so `npm run test:swap` was not required by this plan (the full gate above includes the goldens). No frozen file, manifest or `tests/app/shareParams.test.ts` was edited, and no `-u` was used.

## Known Stubs

- `BasePicker`'s `requestedBase`, `computing` and `announcement` have no caller yet: `NumogramClient.tsx` does not pass them, so the shipped viewer behaves exactly as before (defaults). 06-11 wires them to the worker request state (`requestedBase` = the desired base, `computing` after the 150 ms grace, `announcement` = `Computing base {n}...` then `Base {n} ready.`).
- No automated test renders the `and {M} more selected` line or proves `InfoDisplay` applies the cap: the component fills `orderedKeys` in an effect, which `renderToStaticMarkup` does not run, and this repo has no DOM test environment. The cap and merge are unit tested as pure functions and the wiring is covered by typecheck and the acceptance greps. 06-12's select-all-at-the-ceiling e2e (rubber band over the whole canvas) is the natural place to assert `[data-selection-more]` reads `and {N - 200} more selected`.

## Threat Flags

None. No new endpoint, auth path, file access or schema change at a trust boundary. T-06-01d (URL to main-thread engine work) is mitigated and proven by call count at INTERACTIVE_MAX_N + 2 and 2^26; T-06-09 (selection size to panel DOM) by the O(k) merge, the 200-entry cap and the 200,000-key linear guard; T-06-23 (a pending switch silently reverted) by `effectiveBase` driving every edit and commit.

## Next Phase Readiness

- 06-11 passes `requestedBase`, `computing` and `announcement` to `BasePicker` and replaces the interim `tier` in `viewCtx`; until then `InfoDisplay`'s cap is inert in the shipped viewer because `ctx.tier` is only `'svg'` or `'headless'` and a headless base has no Selection list.
- 06-12 can assert `[data-selection-more]` in its select-all e2e; 06-14's stale-result and computing-state specs can target `[data-computing="true"]` and `[data-picker-status]`.
- REN-02 and REN-03 stay Pending until the Canvas component (06-10), the integration (06-11) and the e2e specs (06-12 to 06-14) land.

---
*Phase: 06-canvas-tier-and-worker*
*Completed: 2026-10-08*

## Self-Check: PASSED

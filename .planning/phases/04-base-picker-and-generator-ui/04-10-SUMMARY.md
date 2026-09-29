---
phase: 04-base-picker-and-generator-ui
plan: 10
subsystem: ui
tags: [react, playwright, dom-golden, view-model, todo-003]

requires:
  - phase: 04-09
    provides: NumogramViewContext/useNumogramView (base, g, summary, view, zoneLabels, labelScheme, zoneLabel(), svgRichMaxN, allChordsMaxN, gateMode), base-generic Projection.tsx
  - phase: 04-03
    provides: NumogramView/buildNumogramView, NumogramSummary
provides:
  - Real-mouse Playwright regression proving todo 003 finding 1 is fixed (e2e/row-click-regression.spec.ts, e2e/viewer-helpers.ts)
  - SelectableListPanel with itemDisplay only (no ItemDisplayComponent type), PanelUnavailable for bases above the SVG tier
  - ZonesPanel/SyzygiesPanel/CurrentsPanel/GatesPanel, LayersPanel/LabelsPanel, InfoDisplay.tsx and PinnedBackground.tsx all reading the active base from NumogramViewContext
affects: [04-11, 04-12, 04-13, 04-16]

tech-stack:
  added: []
  patterns:
    - "A list panel's row markup is passed as itemDisplay (a plain function called directly and returning ReactNode)
       rather than as a component type (ItemDisplayComponent): calling a function does not create a new React
       element type identity across renders, so CyberPanel's per-mousedown re-render (bring-to-front) can no longer
       remount the row between mousedown and mouseup and swallow the click"
    - "A detail-info sub-component branches on view.lore (Base10Lore | null) rather than on base === 10, so the
       base-10 branch is reachable by construction only when real CCRU lore exists, and a future base-10-shaped
       preset would automatically get the lore branch too"
    - "PanelUnavailable (data-post-baseline) is the one shared 'no view model' fallback every panel reaches for when
       useNumogramView().view is null (bases above the SVG tier, wired by 04-11)"

key-files:
  created:
    - e2e/viewer-helpers.ts
    - e2e/row-click-regression.spec.ts
  modified:
    - app/components/panels/shared.tsx
    - app/components/panels/ZonesPanel.tsx
    - app/components/panels/SyzygiesPanel.tsx
    - app/components/panels/CurrentsPanel.tsx
    - app/components/panels/GatesPanel.tsx
    - app/components/panels/LayersPanel.tsx
    - app/components/panels/LabelsPanel.tsx
    - app/components/info/InfoDisplay.tsx
    - app/components/info/PinnedBackground.tsx
    - perf/page-weight.baseline.json

key-decisions:
  - "zoneLabel() (not the raw zone number) is used for every zone-identifying text in InfoDisplay.tsx and
     PinnedBackground.tsx, including places the plan's substitution list did not spell out verbatim (CurrentInfo's
     FROM/TO, GateInfo's FLOW block, the Selection-panel title builder selectedInfoMeta, PinnedBackground's zone/
     syzygy/gate/demon titles): the plan's own truths require zone labels to follow the active scheme 'everywhere' in
     these panels, and formatZoneLabel(z, 10, DEFAULT_LABEL_SCHEME) === String(z) at base 10 (digits scheme), so this
     is text-identical to the pre-existing literals at base 10 while being correct at any other base"
  - "LayersPanel's Pandemonium row is only locked (onClick no-op, right label 'N/A') when the base is non-lore AND
     view.demons is null (i.e. the base is above allChordsMaxN but still within svgRichMaxN, so a view model exists
     but the demon chord list does not); base 10 and any structural base within allChordsMaxN keep the row fully
     interactive, matching the plan's 'when view.demons is non-null' / 'else' split"
  - "Closed todo 003 (moved .planning/todos/pending/003-... to completed/): all four of its own acceptance criteria
     are now satisfied — finding 1 reproduced red-then-green by this plan's new spec, the 60 goldens and full verify
     gate pass unchanged, and findings 2/3 were already folded into 04-CONTEXT.md before this plan was even planned.
     Findings 2 (mobile overlap) and 3 (dead panel-collapse code) are themselves NOT fixed by this closure — the
     todo's own criterion only required they be carried into the Phase 4 discuss, which they were."

requirements-completed: []
# UI-04, UI-03 and MIG-02 all remain Pending: UI-04's final covering plan is 04-11 (hover/pin generality is proven
# only once the app can actually run a non-base-10 base), UI-03's is 04-12 (label scheme spans six plans), MIG-02's
# is 04-16 (NumogramClient.tsx, useTween.ts and the default grep gate are still untouched — confirmed by
# `node scripts/check-repo.mjs --only base-ten`, which still flags 12 literals in those two files only), matching
# this phase's established per-plan-requirements precedent (see STATE.md Phase 4 P02/P03/P09 notes).

duration: ~50min
completed: 2026-09-29
---

# Phase 4 Plan 10: Todo 003 Real-Mouse Fix and Context-Driven Panels, Detail and Pinned Views Summary

**Fixed the dropped-row-click bug (todo 003) by removing the `ItemDisplayComponent` prop path that let a panel recreate its row's component identity on every re-render, then moved every side panel, the Selection detail panel and the pinned background onto `NumogramViewContext` so they render any base's data while keeping base 10 byte-identical against the frozen goldens and behaviour baseline.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 12 (2 created, 10 modified) plus one todo file moved from pending/ to completed/

## Accomplishments

- **Todo 003 finding 1 fixed and proven with a real-mouse regression.** `e2e/viewer-helpers.ts` (new, never collected
  as a spec) provides `openViewer`/`panel`/`selectionHeading`/`stubClipboard`/`DIAGRAM`/`SUMMARY` shared by Phase 4 UI
  specs, reusing `e2e/behaviour.spec.ts`'s exact `panel()` locator. `e2e/row-click-regression.spec.ts` drives
  `page.mouse.move`/`down`/`up` (never `.click()`, which never dispatches a real `mousedown`) at the centre of a
  Zones/Syzygies/Currents/Gates row's text and asserts the Selection heading gains a count and the URL gains
  `selected=`. Run red on the unchanged panels first (all four failed — todo 003's confirmed root cause: each panel
  defined its row component inline and passed it as `ItemDisplayComponent`, so `CyberPanel`'s
  `onMouseDownCapture`-driven bring-to-front re-render recreated that component's identity and remounted the row's
  DOM node before `mouseup` landed), committed as the RED state, then fixed and rerun green.
- **The root cause is removed structurally, not patched.** `app/components/panels/shared.tsx`'s
  `SelectableListPanel` now only accepts `itemDisplay` (a plain function called directly and returning `ReactNode`);
  the `ItemDisplayComponent` variant of `SelectableListPanelRendererProps` is deleted from the type, so a panel
  cannot reintroduce the bug and have it compile. Added `PanelUnavailable({ max })` (`data-post-baseline`) for the
  "no view model" fallback every panel now shares.
- **ZonesPanel/SyzygiesPanel/CurrentsPanel/GatesPanel are base-generic.** Each calls `useNumogramView()` for
  `base`/`view`/`zoneLabels`/`svgRichMaxN`, renders `PanelUnavailable` when `view` or `zoneLabels` is null, and reads
  its list, colours and labels from `view.zoneCount`/`view.zoneColors`/`view.syzygies`/`view.currents`/`view.gates`/
  `zoneLabels[...]` instead of `app/data/{zones,syzygies,currents,gates}`; the syzygy difference and gate cumulation
  use `formatNumeral(value, base)`, and `view.partner(c.from)` replaces the literal `9 - c.from`. Header totals use
  `view.zoneCount` instead of a literal `10`.
- **LayersPanel/LabelsPanel keep base 10's `LAYER_DEFS`/`LABEL_DEFS` text verbatim** (guarded by `view.lore`) and
  build generic info strings from `view.zoneCount`/`gateMode`/`allChordsMaxN` at other bases (gates row appends a
  thin/hidden note per `gateMode`; Pandemonium row shows `N/A` and stops toggling once `view.demons` is null;
  Labels' Planets row is omitted entirely when there is no lore).
- **InfoDisplay.tsx and PinnedBackground.tsx no longer import any base-10 data module.** `ZoneInfo`/`SyzygyInfo`/
  `CurrentInfo`/`GateInfo`/`DemonInfo`/`NumogramIntro` all call `useNumogramView()` directly; the two non-component
  helpers (`selectedInfoMeta`, `renderInfoContent`) take the context value as a parameter since hooks cannot be
  called from a plain function. Each sub-component branches on `view.lore`: the lore branch keeps today's exact JSX
  and text at base 10 (only value substitutions: `zoneLabel()` for every zone number, `formatNumeral(base - 1, base)`
  in place of the literal `9`, `formatNumeral(cum/diff, base)` for cumulations and differences); the generic branch
  drops planet names, lore descriptions and base-10-only footers. `PinnedBackground.tsx` mirrors the same split.
- **Verification, in order:** the new regression spec red then green (`e2e/row-click-regression.spec.ts` + the
  frozen `e2e/behaviour.spec.ts` + `e2e/golden.spec.ts`, 39/39) after Task 1; `npm run typecheck` (4x tsc + lint)
  clean after both tasks; `npm run test:swap` green after Task 2 (65 e2e passed/5 skipped, 1537 unit tests); the
  opt-in base-ten grep gate (`node scripts/check-repo.mjs --only base-ten`) no longer flags any of the nine files
  this plan touched (only `app/NumogramClient.tsx` and `app/hooks/useTween.ts` remain, out of this plan's scope);
  `npm run verify` exit 0 twice — once revealing the expected `check:weight` growth (only failing step), once clean
  after the page-weight baseline update. `git status --porcelain e2e/__golden__ e2e/__behaviour__` empty throughout.

## Task Commits

1. **Task 1a (RED): real-mouse row-click regression, unchanged panels** - `d6c3a49` (test)
2. **Task 1b (GREEN): stable row renderers fix dropped clicks; list panels read the view context** - `df1e8e5` (fix)
3. **Task 2: detail panel, pinned background, layers and labels follow the active base** - `a30da6b` (feat)
4. **Page-weight baseline update** (the plan's own instruction: raise it only if `check:weight` is the sole failure) - `df51487` (chore)

## Files Created/Modified

- `e2e/viewer-helpers.ts` - `DIAGRAM`/`SUMMARY` selectors, `panel()`, `selectionHeading()`, `stubClipboard()`,
  `openViewer()` (new; never collected as a spec — `playwright.config.ts`'s `testMatch` is `/\.spec\.ts$/`)
- `e2e/row-click-regression.spec.ts` - four `page.mouse` down/up tests on Zones/Syzygies/Currents/Gates row text (new)
- `app/components/panels/shared.tsx` - `SelectableListPanel` accepts only `itemDisplay`; added `PanelUnavailable`
- `app/components/panels/ZonesPanel.tsx` - reads `view`/`zoneLabels`/`svgRichMaxN` from context, `itemDisplay`
- `app/components/panels/SyzygiesPanel.tsx` - same, plus `formatNumeral(b - a, base)` for the difference column
- `app/components/panels/CurrentsPanel.tsx` - same, `view.partner(c.from)` replaces `9 - c.from`
- `app/components/panels/GatesPanel.tsx` - same, `formatNumeral(cum, base)`, header `total={view.zoneCount}`
- `app/components/panels/LayersPanel.tsx` - base-10 `LAYER_DEFS` kept verbatim; generic info text built from
  `view.zoneCount`/`gateMode`/`allChordsMaxN`; `PanelUnavailable` when `view` is null
- `app/components/panels/LabelsPanel.tsx` - base-10 `LABEL_DEFS` kept verbatim; generic Numbers info text; Planets
  row omitted without lore; `PanelUnavailable` when `view` is null
- `app/components/info/InfoDisplay.tsx` - every sub-component calls `useNumogramView()`; `selectedInfoMeta`/
  `renderInfoContent` take the context as a parameter; lore/generic branches per sub-component
- `app/components/info/PinnedBackground.tsx` - reads `view`/`zoneLabel` from context; lore/generic branches
- `perf/page-weight.baseline.json` - raised for this plan's `/numogram/` growth (below)

## Decisions Made

See `key-decisions` in the frontmatter for the zoneLabel-everywhere, Pandemonium-lock and todo-003-closure decisions
(kept there to avoid duplicating the exact wording).

## Deviations from Plan

None - the plan's own `<action>` steps were followed for both tasks; the only additions beyond the literal action
text are the `key-decisions` above, which fill in cases the plan's substitution list didn't spell out verbatim
(consistent with UI-03's "everywhere" requirement and text-identical at base 10 either way) and the todo-003 closure
(bookkeeping, not a code change).

## Page Weight

`check:weight` was the only failing step of `npm run verify` after Task 2: `/numogram/` grew to 598,261 bytes raw
(598,261 > the prior limit 592,105) and 180,068 bytes gzip (> 179,084), from `InfoDisplay.tsx`/`PinnedBackground.tsx`/
`LayersPanel.tsx`/`LabelsPanel.tsx` switching from static base-10 imports to `useNumogramView()` plus new generic-base
branches. Confirmed independently that every other verify step passed on the committed tree (`npm run test:e2e`
79/79 passed + 9 skipped, `node scripts/check-repo.mjs --clean-tree --static-out` OK) before raising the baseline
with `node scripts/page-weight.mjs update --reason "..."` (commit `df51487`). Final `npm run verify` exit 0.

## Issues Encountered

None beyond the expected page-weight growth above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every panel and detail/pinned view in the shell now reads from `NumogramViewContext`; `04-11` can make the
  provider follow a chosen base (instead of always base 10) without touching any of these nine files again.
- `PanelUnavailable` is in place and already exercised by the type system (`view: NumogramView | null`), ready for
  `04-11` to actually produce a null view above `svgRichMaxN`.
- Todo 003 is fully closed (moved to `.planning/todos/completed/`); only todos 002, 004 (both deferred review
  findings, low priority) and 005 (packer choice in the UI, scheduled for this phase) remain pending.
- UI-04, UI-03 and MIG-02 all remain Pending in REQUIREMENTS.md by design (see `key-decisions`); no blockers for
  `04-11`.

---
*Phase: 04-base-picker-and-generator-ui*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 14 files (2 created e2e helpers/spec, 9 modified components/panels, `perf/page-weight.baseline.json`, the moved
todo, this SUMMARY) found on disk; all four commits (`d6c3a49`, `df1e8e5`, `a30da6b`, `df51487`) found in `git log`;
`.planning/todos/pending/003-...` confirmed gone (moved, not duplicated).

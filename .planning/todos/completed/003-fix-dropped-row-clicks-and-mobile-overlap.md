---
title: "Fix dropped real mouse clicks on Zones/Syzygies/Currents/Gates rows; note mobile panel overlap"
status: completed
priority: P2
source: "todo 001 executor findings (2026-09-26)"
created: 2026-09-26
completed: 2026-09-29
theme: ui
---

## Goal

Two pre-existing upstream defects found while inventorying the UI before and after the declutter. Both behave identically before and after todo 001, so neither was caused or fixed by it.

## Findings

1. **Real mouse clicks on the text of Zones, Syzygies, Currents and Gates rows are dropped in Chromium.** Clicks on the row padding, keyboard, canvas selection and a DOM `click()` all work; Layers, Labels and Regions rows are fine. Suspected cause (not confirmed): those panels define `ItemDisplayComponent` inline, and `CyberPanel`'s mousedown handler re-renders the page, remounting the clicked child before mouseup so the click never lands. Automated e2e tests use DOM-level actions, so nothing caught it.
2. **At about 390 px width the shell already overlapped upstream:** the header sits over the layout buttons, and the seven always-open panels stack over each other and over the Selection panel. Phase 4 (Base Picker and Generator UI) territory; the declutter added no overflow.
3. **Dead code:** panel open/close toggles never existed in the shipped shell (`CyberPanel` shows its chevron only when `collapseDirection !== 'none'`, and `NumogramClient.tsx` never passes it), so `layersOpen` and friends and the mobile "start collapsed" effect are dead. Left alone on purpose (no functionality removed). Decide in Phase 4 whether to delete them or to make panels collapsible for real, which would also help finding 2.

## Acceptance Criteria

- [x] Finding 1 reproduced with a real-mouse Playwright test (`locator.click()` or `page.mouse`) on a Zones row, a Syzygies row, a Currents row and a Gates row, first failing on current code (04-10, `e2e/row-click-regression.spec.ts`, commit d6c3a49: all four panels failed before the fix)
- [x] Root cause confirmed and fixed (for example define the row component outside the render function or stop remounting on mousedown), with that test passing (04-10, commit df1e8e5: `SelectableListPanel` only accepts `itemDisplay`, a plain function called directly rather than mounted as a component type, so a row can no longer be recreated as a new component identity and remounted mid-click)
- [x] The 60 DOM goldens and the full `npm run verify` gate still pass unchanged (04-10: `npm run verify` exit 0 on the committed tree, goldens and behaviour baseline byte-identical)
- [x] Findings 2 and 3 taken into the Phase 4 discuss (mention them in that phase's CONTEXT) (done before 04-10 was planned: `04-CONTEXT.md` line 54 folds both into Phase 4 scope)

Finding 2 (mobile overlap below ~390px) and finding 3 (dead panel-collapse-toggle code) are not themselves fixed by this closure — they were folded into Phase 4's broader UI work per `04-CONTEXT.md`, which is what this todo's own acceptance criteria required. See `.planning/phases/04-base-picker-and-generator-ui/04-10-SUMMARY.md` for the finding-1 fix detail.

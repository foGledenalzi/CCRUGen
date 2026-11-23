---
phase: 07-naming-builder
fixed_at: 2026-11-23
review_path: .planning/phases/07-naming-builder/07-REVIEW.md
findings_in_scope: 20
fixed: 20
skipped: 0
deferred_to_todo: 17
status: all_fixed
---

# Phase 7: Code Review Fix Report

All ten warnings and ten of the 27 info items were fixed (22 commits, since WR-02 and WR-03 took extra commits), each with a regression test. The other seventeen info
items are design notes, pre-existing code, a signed-off file or refactors; they are recorded in `.planning/todos/pending/010-phase7-review-info-followups.md`.

The fixer agent was stopped before it could write this report and before its last gate runs; the gate below was run by the orchestrator on the final
tree (HEAD f756fb3 plus this report).

## Verification of the fixed tree

`MSYS_NO_PATHCONV=1 npm run verify`: exit 0 (10.5 min e2e, about 11 min in all).

- repo guard (13 checks incl. goldens, lore, base-ten, clean-tree, static-out): OK; typecheck: clean (the one pre-existing `DemonMatrix` lint warning)
- unit tests: 119 files, 4,098 tests passed under `CCRUG_TZ=UTC` and under `America/New_York`
- sub-path e2e: 12 passed; build OK; `check:weight`: OK (no baseline change after ledger entry 10)
- e2e: 440 passed, 368 skipped by design (the New York project), 0 failed, including the 60 DOM goldens and the 5 behaviour specs
- frozen sets unchanged: `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` empty; `engine/naming/banks.ts` and
  `engine/test/naming.vectors.test.ts` untouched since their 07-06 sign-off commits (67e3002, fb00ada)

## Warnings

| id | commit | what changed | proof |
|----|--------|--------------|-------|
| WR-01 | f20e2b4 | `graphemeCount` stops at the limit instead of materialising every grapheme (an 8-million-letter sound no longer freezes the validator) | `naming.text.test.ts`, `naming.schema.test.ts` |
| WR-02 | c14a98c | seeds refuse lone surrogates and bidi controls, so a `names=` link reproduces the same names | `naming.text.test.ts`, `naming.schema.test.ts`, `shareParamsNames.test.ts` |
| WR-03 | 96246b6, d4599f5, 2f6baf6 | untrusted text echoed into messages (validator issues, copy, demon search) has control, format, bidi and surrogate characters replaced; the escapes are spelled as `\u` sequences in the sources | `naming.text/schema.test.ts`, `namingCopy.test.ts`, `demonSearch.test.ts` |
| WR-04 | 97d5759 | demon name search accepts letters of any script (`[\p{L}\p{M}]`, NFC, lower-cased on both sides) | `demonSearch.test.ts` (Greek, Cyrillic, accented Latin cases) |
| WR-05 | 6357021 | "Undo this change" is a naming-only undo: it refuses when the newest history entry is not a naming change and the panel drops the stale status | `historyHydration.test.ts`; `names-panel.spec.ts` (reroll, toggle a layer, press the button: the layer toggle stays) |
| WR-06 | a8ceddb | the focused sound row stays mounted when scrolled out of the virtual window (rangeExtractor), so focus and the draft survive | `zoneListModel.test.ts`; `names-panel.spec.ts` |
| WR-07 | 50cfc8b | the seed field ignores Enter/Escape during IME composition; `dir="auto"` | `namesPanelRender.test.ts`; `names-panel.spec.ts` |
| WR-08 | 43c24ca | every Names announcement is a DOM change (a nonce-keyed text inside the single `role="status"` carrier), so an identical consecutive announcement is re-read | `namingSession.test.ts`, `namesPanelRender.test.ts`; `names-panel.spec.ts` |
| WR-09 | 564d401 | the Base picker dropdown is clamped to the viewport and uses `w-[min(340px,calc(100vw-16px))]` | `basePicker.test.ts`; `base-picker.spec.ts` (375 x 667) |
| WR-10 | 548e964 | a naming revision change passes the planetary `orbiting` gate in the history effect, so edits made while the orbit runs get an undo entry | `historyHydration.test.ts`; `names-panel.spec.ts` |

## Info items fixed

| id | commit | what changed | proof |
|----|--------|--------------|-------|
| IN-01 | 681fe04 | `feistelPermutation` throws a RangeError outside its domain instead of looping | `naming.feistel.test.ts` |
| IN-04 | 317d0f7 | a failed flush write at a base switch is reported, not dropped | `namingStorage.test.ts`; `names-io.spec.ts` (full store) |
| IN-05 | ef9c745 | the export is written compact when the pretty text would exceed the import cap, so the app can always re-import its own file | `namesPanelRender.test.ts` |
| IN-16 | 45dc24e | the render-time write of the session ref is gone (`commitSession` is its only writer) | `namingSession.test.ts` |
| IN-17 | ee54876 | the demon search hit is revealed only when the hit changes, not after every naming change | `demonSearch.test.ts`; `names-panel.spec.ts` |
| IN-19 | be9b931 | an invalid seed draft is dropped when the seed changes from outside | `namesPanelRender.test.ts`; `names-panel.spec.ts` |
| IN-20 | 22397df | the export object URL is revoked after 10 s, not at once | `namesPanelRender.test.ts` |
| IN-21 | 4d9531c | the pending slot write is also flushed when the page becomes hidden | `namingStorage.test.ts`; `names-io.spec.ts` |
| IN-22 | 6cd1f0e | the two typed accessible names moved into `NAMES_COPY` (77 -> 79 pinned keys) | `namingCopy.test.ts` |
| IN-26 | fb9ae32 | a zone paste is cut to what the rows can use before it is split | `zoneListModel.test.ts` |

## Not fixed here (todo 010)

IN-02, IN-03, IN-06 to IN-15 and IN-18, IN-23 to IN-25, IN-27: see `.planning/todos/pending/010-phase7-review-info-followups.md` (includes IN-10, the stale
DRAFT header of the signed-off `banks.ts`, which must not be touched without a new contact-sheet sign-off).

## Outside the review

The two user-reported defects fixed before this review (commits 1425bd4 for the header, e7071e8..f10c305 for the Canvas paint surface) were verified by
their own unit, e2e and mutation checks and by eye in the browser pane; their files were excluded from the review because they were being edited while it ran.

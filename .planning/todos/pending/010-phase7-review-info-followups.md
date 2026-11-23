---
title: "Phase 7 code review: info items deliberately left unfixed (hardening notes and refactors)"
status: pending
priority: P3
source: "Phase 7 deep code review, .planning/phases/07-naming-builder/07-REVIEW.md, 2026-11-15"
created: 2026-11-23
theme: hardening
---

## Goal

The Phase 7 review found 0 critical, 10 warning and 27 info items. All ten warnings and twelve of the info items were fixed (see `07-REVIEW-FIX.md`). The items below were left on purpose: design notes, pre-existing code, a signed-off file, or refactors that belong in their own change.

## Items (ids from 07-REVIEW.md)

Pure side (reviewer A):
- **IN-02** The collision scan's walk phase yields only between partitions: 10 ms (generated table) up to 278 ms (all-identical typed sounds) at base 1024 against an 8 ms slice budget. Consider yielding inside a partition.
- **IN-03** `readSlot` returns null for absent, corrupt and newer-schema slots alike, so the next autosave overwrites an unreadable slot with no backup. Consider keeping the unreadable text under a `.bak` key once.
- **IN-06** `namingSession.ts` comment says every no-op edit returns the same session; only the override ops do. Fix the comment or the ops.
- **IN-07** `resultKey` differs for sounds and digits though the worker output is identical, so toggling Sounds at a Canvas base triggers a full rebuild. Collapsing it needs care because `NumogramClient` restores the label scheme from `resp.labels`.
- **IN-08** `deriveName` is documented as NFC but is not NFC-stable after `upperFirst` for a few characters (for example the Greek iota with dialytika and tonos).
- **IN-09** `seedError()` says "characters" but the limit counts UTF-16 units.
- **IN-10** `engine/naming/banks.ts` header still says DRAFT/unsigned. The file is signed off and pinned by digests: change the comment only together with a new contact-sheet sign-off, never on its own.
- **IN-11** `NAMES_COPY.title` is unused (the panel title is hard-coded).
- **IN-12** `Naming.meta` is never read or set in `app/`; one unreachable guard in `validate.ts`.
- **IN-13** `panelStack.ts` reporter guards accept negative or infinite heights and propagate NaN. The inputs cannot occur today.
- **IN-14** `shareParams.ts` uses `localeCompare` for canonical key order (pre-existing, locale-dependent URL order; parsing is unaffected).
- **IN-15** `runSlicedJob` has no try/catch around `job.step`; `derive.ts` hides a table-length mismatch with an `as string`; `clipEcho` can cut a surrogate pair.

Client side (reviewer B):
- **IN-18** Clicking a row's lock right after typing a sound un-locks it (the blur commit auto-locks, the click toggles). Design edge; the helper line documents "editing a sound locks it".
- **IN-23** Duplicated helpers: `dataProps` in three Cyber controls, `TAGS` twice, shared class strings, four `zoneLabel` lambdas that disagree on the base guard. Extract one of each.
- **IN-24** Dead branches: the `open` prop below `NamesPanel`, the unreachable `if (!open) return` in `CollisionReport`, the test-only `initialReport` prop.
- **IN-25** Header: the brand description is effectively unreachable at 480 px, and the fixed 480 px desktop header may cover the leftmost layout switcher buttons between 821 and about 1300 px (estimated from CSS arithmetic, not measured). Measure at 900, 1100 and 1280 px and narrow the header or move the switcher.
- **IN-27** `NumogramClient.tsx` is over 2,200 lines; the naming plumbing is a natural `useNamingSession` hook.

## Constraints

- Frozen oracles untouched; `npm run test:swap` and `npm run verify` stay green.
- No new dependency; engine stays pure; the signed-off banks and vectors are never edited without a new contact-sheet sign-off.

## Acceptance Criteria

- [ ] Each item is either fixed with a regression test or closed with a one-line reason in this file.

---
phase: 04-base-picker-and-generator-ui
plan: 02
subsystem: label-schemes
tags: [zone-labels, unicode, url-codec, custom-alphabet, accessibility]
dependency-graph:
  requires: [engine/core/numerals.ts, app/lib/xenotation.ts]
  provides: [app/lib/customAlphabet.ts, app/lib/glyphCoverage.ts, app/lib/labelScheme.ts]
  affects: [04-05-PLAN.md, 04-06-PLAN.md, 04-09-PLAN.md, 04-10-PLAN.md, 04-12-PLAN.md]
tech-stack:
  added: []
  patterns:
    - "Typed-reason validation (AlphabetCheck union), same idiom as engine/core/base.ts's BaseCheck"
    - "Injectable heuristic (GlyphCanvas interface) so a canvas-dependent check is unit-testable under vitest's node environment"
key-files:
  created:
    - app/lib/customAlphabet.ts
    - app/lib/glyphCoverage.ts
    - app/lib/labelScheme.ts
    - tests/app/customAlphabet.test.ts
    - tests/app/glyphCoverage.test.ts
    - tests/app/labelScheme.test.ts
  modified: []
decisions:
  - "All four curated alphabet presets ship (Base62, Base64 URL-safe, ASCII Printable, Latin-1 Printable) per D-10's '2-4 to start' and the plan's explicit instruction, not a trimmed 2-3 set"
  - "FORBIDDEN character class is \\p{Cc}\\p{Cf}\\p{Z}\\p{M}\\p{Cs}\\p{Co}\\p{Cn} (control, format/bidi, separator/space, combining marks, surrogates, private-use, unassigned) — one regex covers every T-04-04 spoofing vector plus plain non-printables"
  - "zoneLabelsFor checks alphabet validity once per (scheme, base) call, not once per zone, so a large base never repeats validateAlphabet's O(n) length/duplicate work per label"
metrics:
  duration_minutes: 10
  completed: 2026-09-29
---

# Phase 4 Plan 02: Label Schemes and Custom Alphabets Summary

Pure label-scheme library (no React, no DOM at module scope) implementing UI-03's zone-label rules: the engine's own numeral scheme by default, xenotation as an alternate mode, curated and free-typed custom alphabets with inline-ready validation and a canvas glyph-coverage heuristic, and the `labels=` URL codec — everything later Phase 4 UI plans will render, none of it re-implemented by them.

## What Was Built

**`app/lib/customAlphabet.ts`** — `MAX_ALPHABET = 1024`; four curated presets (`base62` 62 chars, `base64url` 64, `ascii` 94, `latin1` 188, built lazily and memoized so repeated `presetChars(id)` calls return the same frozen array object); `splitAlphabet` (NFC-normalize, then split by code point, so a combining sequence or an astral emoji each count as one character); `checkAlphabetChars`/`validateAlphabet` returning a typed `AlphabetCheck` (`empty` / `too-long` / `forbidden` / `duplicate` / `too-short`) with the UI-SPEC's exact copy, checked in that order so the length cap runs before any per-character work (T-04-06); `describeChar` for echoing an unsafe character as `U+XXXX` instead of the raw glyph (T-04-05).

**`app/lib/glyphCoverage.ts`** — an injectable `GlyphCanvas` interface (`measureWidth`/`pixels`) so the heuristic is unit-testable without a real DOM; `createCanvasGlyphCanvas(doc, font)` builds one from a real 32x32 offscreen canvas or returns `null` without a 2D context; `makeGlyphProbe(canvas)` compares a character's measured width and, when ambiguous, its rendered pixels against a lazily-measured Private-Use-Area reference (`U+E000`) — a match, or zero width, flags `'risk'`; results are memoized per character; a `null` canvas always answers `'ok'` (no coverage information, no warning). `glyphRisks` filters a character list down to the risky ones, in order.

**`app/lib/labelScheme.ts`** — `LabelScheme` (`digits` / `xeno` / `preset` / `custom`); `formatZoneLabel`/`zoneLabelsFor` built entirely on the engine's `formatNumeral` and `xenotation.ts`'s `formatXenotationForDisplay` (never re-implemented — the acceptance grep for a private copy of the engine's digit string returns 0 matches); a preset/custom alphabet only labels a zone when `validateAlphabet` accepts it for that base, otherwise the numeral fallback runs, so a short alphabet can never silently mislabel a zone; `formatLabelScheme`/`parseLabelScheme`/`labelSchemeKey` give `labels=` its URL form (`xeno`, `preset:<id>`, `custom:<chars>`, omitted for the default), lenient on read (any invalid or oversize value falls back to the default) and verified to round-trip through `URLSearchParams` for every mode.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed TDD RED (tests written and confirmed failing against a missing module) then GREEN (implementation written, all tests and `npm run typecheck` passing) before each single commit, matching the plan's own explicit action-text commit instructions.

## TDD Gate Compliance

Not applicable — this plan's frontmatter is `type: execute` (task-level `tdd="true"`, not a plan-level TDD gate). Both tasks were still run RED-then-GREEN as instructed: for each task, the test file was written and run (confirmed failing with "Cannot find module") before the implementation file was written and the same test run confirmed green, then one `feat(04-02): ...` commit per the plan's explicit instruction (not a separate `test(...)`/`feat(...)` commit split).

## Requirements Traceability

UI-03 spans six plans in this phase (04-02, 04-05, 04-06, 04-09, 04-10, 04-12, per `REQUIREMENTS.md`'s Phase 4 rows). This plan is a contributor, not the final covering plan, so the checkbox stays unmarked; `REQUIREMENTS.md` is left to the final covering plan (04-12) to flip, per this project's established pattern (e.g. Phase 3's `LAY-01`/`LAY-03`/`REN-01` rows).

## Verification

- `npx cross-env CCRUG_TZ=UTC vitest run tests/app/` — 3 files, 50 tests, all passing
- `npm run typecheck` (4x `tsc --noEmit` + `next lint`) — clean
- Acceptance-criteria greps (message text, `MAX_ALPHABET = 1024`, no typed unicode escape sequences, no top-level `document.` access, `formatNumeral`/`formatXenotationForDisplay` reuse counts, no private digit-set copy) all pass as specified in `04-02-PLAN.md`

## Self-Check: PASSED

- FOUND: app/lib/customAlphabet.ts
- FOUND: app/lib/glyphCoverage.ts
- FOUND: app/lib/labelScheme.ts
- FOUND: tests/app/customAlphabet.test.ts
- FOUND: tests/app/glyphCoverage.test.ts
- FOUND: tests/app/labelScheme.test.ts
- FOUND commit 6fe7a7e (feat(04-02): custom alphabet presets, validation and glyph-coverage heuristic)
- FOUND commit b9dd0e6 (feat(04-02): label schemes and the labels= URL form)

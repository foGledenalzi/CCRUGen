---
phase: 04-base-picker-and-generator-ui
verified: 2026-09-29T21:08:51Z
status: passed
score: 9/9 must-haves verified (5/5 ROADMAP success criteria, 9/9 requirement IDs)
overrides_applied: 0
---

# Phase 4: Base Picker and Generator UI Verification Report

**Phase Goal:** Users can pick any even base and explore its numogram in the interactive SVG viewer, with legible labels, a region legend, shareable URLs and full keyboard and screen-reader access
**Verified:** 2026-09-29T21:08:51Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a 16-plan, 10-wave phase (all self-reporting `Self-Check: PASSED`, no `Self-Check: FAILED` markers found in any of the 16 SUMMARY.md files despite three documented mid-phase interruptions from rate limits/a classifier outage). Rather than trust the summaries, verification:

1. Read all 16 PLAN frontmatters (must_haves) and all 16 SUMMARY.md files in full.
2. Read `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`'s Phase 4 entry, `04-CONTEXT.md` (D-01..D-24), `04-UI-SPEC.md` (the approved design contract), and `04-REVIEW.md` (code review, 3 warnings/2 info, non-blocking, `status: issues_found` but no criticals).
3. Ran the **full `npm run verify` gate** (`check:repo` → `typecheck` → unit tests in two timezones → e2e sub-path → build → page-weight → full e2e suite → clean-tree/static-out) on the actual committed tree — not a subset, not `--only`. Result: **exit 0**, 176 e2e tests passed (106 skipped by design — the TZ-duplicate project intentionally skips Phase 4 UI specs on `chromium-ny` per `test.beforeEach` in each new spec), 0 failed, `check-repo: OK` including the new `base-ten` grep gate, `clean-tree` and `static-out`.
4. Directly read the actual source (not summaries) for every artifact named in every plan's must_haves: `app/lib/basePicker.ts`, `app/lib/shareParams.ts`, `app/lib/labelScheme.ts`, `app/lib/customAlphabet.ts`, `app/lib/regions.ts`, `app/lib/baseSwitch.ts`, `app/components/numogram/{BasePicker,LabelSchemeControls,TextView,BigBaseSummary,ViewContext}.tsx`, `app/components/panels/RegionsPanel.tsx`, `app/components/projection/{Projection,PairGraphProjection}.tsx`, `app/NumogramClient.tsx`, `scripts/check-repo.mjs`, and confirmed the six base-10 data seams (`app/data/{zones,syzygies,currents,gates,demons,positions}.ts`) are actually deleted from disk.
5. Grepped for stub/placeholder anti-patterns (`TODO`/`FIXME`/`placeholder`/`not yet implemented`/empty returns) across every new Phase 4 file — none found outside comments referencing "todo 003"/"todo 005" (the folded todo IDs, not stub markers).

## Goal Achievement — ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Base picker (type/step/slide/click chip) with odd-input refusal; base 28 → 28 zones, Warp present, Torque [9,3], 378 demons; every even base 2-40 renders with no NaN/undefined; CI grep gate finds no hard-coded 10-zone constants | ✓ VERIFIED | `app/lib/basePicker.ts:9` `NOTABLE_BASES = [2,4,6,8,10,12,16,22,28,64,80,82,100,1024]` (matches D-07 exactly). `e2e/base-picker.spec.ts:56` asserts the live-summary text is literally `'28 zones · Warp yes · Torque [9,3] · 378 demons'` — passed. `e2e/smoke-bases.spec.ts` sweeps every even base 2..40 (20 bases) plus ladder/spiral/pairGraph at 2,4,6,28 for `NaN`/`undefined` — all passed (0 failed in the full run). `scripts/check-repo.mjs`'s `'base-ten'` check is now in `DEFAULT_CHECKS` (line 357) and `check-repo: OK` in the full verify run, meaning it runs and passes by default, not just opt-in. |
| 2 | `?base=28` reloads to the same view; existing base-10 share links keep working; an absurdly large base is refused with a message instead of freezing the tab; switching base leaves no stale selection/undo/animation | ✓ VERIFIED | `e2e/url-codec.spec.ts` — `?base=28` round trip/reload, `/numogram/?selected=5` and `/numogram/?layout=ladder&selected=5` (legacy base-10 links), `/?base=28` legacy redirect, `?base=99999999999`/`?base=27`/`?base=28abc` all refuse without freezing — all passed. `e2e/base-switch-reset.spec.ts` — switching base clears selection and the undo stack (undo cannot restore the old base), drops stale `region=`, clears pinned info, interrupts a mid-tween switch without mixing bases — all passed. Code: `app/lib/baseSwitch.ts`'s `sessionAfterBaseSwitch` is a real, unit-tested pure function (not a stub) wired into `NumogramClient.tsx`'s `commitBase` (lines 339-370), which batches history-stack clears, selection/region/TC/orbit resets and zoom/pan resets into one call. |
| 3 | Zone labels in-base digits up to base 36, decimal-with-separator beyond, custom-alphabet and xenotation options; URLs/JSON/demon keys keep integer identity | ✓ VERIFIED | `app/lib/labelScheme.ts` `formatZoneLabel`/`zoneLabelsFor` implement digits (engine `formatNumeral`)/xeno (falls back to numeral only at zone 0, D-09)/preset/custom modes exactly as specified, never re-implementing the engine's numeral logic. `app/lib/customAlphabet.ts` ships all 4 curated presets (`base62`, `base64url`, `ascii`, `latin1`) matching the UI-SPEC's locked table. `e2e/label-scheme.spec.ts` — Xeno at base 40, Base62 preset labelling zone 36 as `a`, a repeated custom char refused (D-12), a too-short alphabet falling back to numerals, and "zone identity in the URL stays the integer even under a letter label" — all passed. |
| 4 | Hovering/pinning a zone/syzygy/current/gate highlights it and opens detail panel; region legend table lists Plex/Warp/each Torque cycle with a stable id, isolate/mute; layers toggle; diagram zooms/pans/fits | ✓ VERIFIED | `e2e/hover-pin.spec.ts` (base 28 zone/syzygy/current/gate hover+click) and `e2e/region-legend.spec.ts` (`?base=64` one row per Torque cycle + Warp + Plex each with Isolate/Mute; multi-isolate/mute-wins/independence/reload persistence; stale ids silently dropped at base 12; base-10 legend text unchanged; pair-graph mute) and `e2e/layers-zoom.spec.ts` (layer toggles, zoom in/out/wheel, fit-to-view, alt-drag pan, panel collapse) — all passed. Code: `app/lib/regions.ts`'s `regionRows`/`RegionFilter` iterate the engine's real `Cycle[]` (never a single-Torque union), and `RegionsPanel.tsx` renders `aria-pressed` Isolate/Mute buttons per row. |
| 5 | Diagram usable without a mouse or colour vision: keyboard traversal, ARIA labelling, non-colour cues, reduced-motion, text view with copy button | ✓ VERIFIED | `e2e/accessibility.spec.ts` — Tab reaches the diagram as one stop, ArrowRight cycles through all 84 elements at base 28 and wraps, every focusable element has `role=button` and a non-empty `aria-label`, Enter selects, muted zones excluded from traversal, a visible focus outline, reduced-motion makes layout switches instant and disables the orbit control and particle carriers, and the base-10-only digit shortcut is confirmed not to leak to base 28 — all passed. `e2e/layers-zoom.spec.ts:164` confirms the Text panel shows numogram text with a working copy button. Code: `Projection.tsx` has real `role="button"`/`aria-pressed`/`aria-label`/`tabIndex` wiring on every zone/syzygy/current/gate element (not decorative), `TextView.tsx` calls `navigator.clipboard.writeText` and shows "Copied" for 1.5s. |

**Score:** 5/5 ROADMAP success criteria verified.

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| UI-01 | 04-06, 04-12, 04-16 | Base picker (chips, live summary) | ✓ SATISFIED | `NOTABLE_BASES` matches D-07; `e2e/base-picker.spec.ts` full coverage passed |
| UI-02 | 04-05, 04-07, 04-11, 04-12 | `?base=` URL state, legacy links, absurd-base refusal | ✓ SATISFIED | `e2e/url-codec.spec.ts` passed; see SC2 above |
| UI-03 | 04-02, 04-05, 04-06, 04-09, 04-10, 04-12 | In-base digit / decimal-separator / custom-alphabet / xenotation labels | ✓ SATISFIED | `e2e/label-scheme.spec.ts` passed; see SC3 above |
| UI-04 | 04-09, 04-10, 04-11 | Hover/pin zone/syzygy/current/gate + detail panel | ✓ SATISFIED | `e2e/hover-pin.spec.ts` passed |
| UI-05 | 04-03, 04-13 | Region legend, isolate/mute | ✓ SATISFIED | `e2e/region-legend.spec.ts` passed |
| UI-06 | 04-08, 04-11, 04-15 | Layer toggles, zoom/pan/fit | ✓ SATISFIED | `e2e/layers-zoom.spec.ts` passed |
| UI-07 | 04-07, 04-08, 04-14, 04-15 | Keyboard/ARIA/non-colour/reduced-motion/text view | ✓ SATISFIED | `e2e/accessibility.spec.ts`, `e2e/layers-zoom.spec.ts` passed |
| UI-08 | 04-12, 04-13 | Base-switch sanitation (no stale selection/history/animation) | ✓ SATISFIED | `e2e/base-switch-reset.spec.ts` passed |
| MIG-02 | 04-01, 04-04, 04-09, 04-10, 04-11, 04-16 | No hard-coded 10-zone constants; bases 2-40 smoke render | ✓ SATISFIED | `base-ten` is a `DEFAULT_CHECKS` entry, `check-repo: OK`; `e2e/smoke-bases.spec.ts` passed; six `app/data/*` seams confirmed deleted from disk |

**All 9 requirement IDs declared across the phase's plans are accounted for in `.planning/REQUIREMENTS.md`. No orphaned requirements found** (no Phase-4-mapped ID in REQUIREMENTS.md is absent from the plans' frontmatter, and no plan claims an ID REQUIREMENTS.md doesn't map to Phase 4).

### Documentation inconsistency (non-blocking, flagged for cleanup)

`.planning/REQUIREMENTS.md`'s **traceability table** (bottom section) still lists `UI-02`, `UI-03` and `UI-08` as `Pending`, while:
- The same file's own checkbox list (top section) already marks all three `[x]` complete (added in commit `ee3222b`, "docs(04-12): complete header-base-picker-and-generator-ui plan").
- `04-12-SUMMARY.md`'s frontmatter explicitly declares `requirements-completed: [UI-02, UI-03, UI-08]`.
- Commit `abbcb76` (04-16's closeout) updated the traceability table rows for `UI-01` and `MIG-02` to `Complete` but did not touch the `UI-02`/`UI-03`/`UI-08` rows, leaving them stale at `Pending` alongside the already-`Complete` `UI-04`/`UI-05`/`UI-06`/`UI-07` rows.
- Independent code/e2e verification above confirms UI-02, UI-03 and UI-08 are functionally complete — this is a **documentation bookkeeping gap only**, not a functional gap, and does not affect goal achievement. It does not block `passed` status but should be fixed (three one-line edits to the traceability table) before Phase 5 planning reads REQUIREMENTS.md.

Separately, the checkbox-list edits from commits `ee3222b`/`2e74196`/`abbcb76` introduced a stray literal newline inside each `**UI-NN` / `**:` bold-marker pair (e.g. `- [x] **UI-02\n**: The chosen base...`), a cosmetic Markdown-rendering artifact from whatever script performed the edit — harmless to tooling that greps for `[x]`/`[ ]`, but renders oddly. Not scored as a gap.

## Code Review Findings (from `04-REVIEW.md`, already on record)

`04-REVIEW.md` (`status: issues_found`, 0 critical / 3 warning / 2 info) reviewed all 89 phase-4-touched files and found no security issues, no crashes, and confirmed the project's hardest correctness rules held (in-base arithmetic via `digitsOf`/`formatNumeral`, `Cycle[]`-based regions never assuming one Torque, the `view === null` above-tier contract threaded consistently, MIG-02 gate correctly scoped). The 3 warnings are real but narrow, UX-consistency issues in newly added interactive chrome not yet exercised by the wave-0 e2e specs (confirmed by the reviewer reading the actual specs):

- **WR-01**: `LabelSchemeControls.tsx`'s `open`/`text` local state can visually desync from an externally-changed `scheme` (Undo/Redo, URL hydration) while the dropdown stays mounted.
- **WR-02**: `ShortcutsModal.tsx`'s "Layout: A original, S labyrinth, D ladder, F planetary" line is unconditionally base-10 wording even though the base-generic layout switcher (this phase's own work) assigns A/S/D/F to `ring, ladder, spiral, pairGraph` at every other base — confirmed by direct read of `ShortcutsModal.tsx:42` and cross-checked against `layoutIds.ts`. It also contradicts its own newly-added base-10-only caveat two lines below.
- **WR-03**: `BasePicker.tsx`'s debounced commit effect can evaluate against a stale `base` prop if the base changes externally (Undo/Redo) mid-debounce.
- IN-01/IN-02: minor, cosmetic/type-safety issues (slider misreading a typed "0"; `Demon.kind` as a bare `string` instead of a literal union).

These are real, narrowly-scoped gaps in edge-case robustness (external-state resync, one help-overlay line, a debounce staleness window), not gaps in the phase's core, roadmap-level deliverables — every roadmap success criterion and every UI-0x/MIG-02 requirement's primary interaction path is exercised green by e2e specs that don't hit these specific interleavings. They were already surfaced to the user via `04-REVIEW.md` as non-blocking and are appropriately left as follow-up rather than blocking phase sign-off.

## Full Verify Gate

Ran `MSYS_NO_PATHCONV=1 npm run verify` on the actual committed tree (not a plan's isolated test subset):

```
check:repo (base-ten, clean-tree, static-out, ...): OK
typecheck (4x tsc + engine lint): OK
test + test:tz (two timezones): OK
test:e2e:basepath: OK
build (static export): OK
check:weight: OK (2 routes, 30 golden states within tolerance)
test:e2e (full Playwright suite): 176 passed, 106 skipped by design, 0 failed
check-repo --clean-tree --static-out: OK
```

Exit code: 0. The 60 frozen DOM goldens (`e2e/golden.spec.ts`, both `chromium-utc` and `chromium-ny` projects) and the frozen behaviour baseline (`e2e/behaviour.spec.ts`) passed unregenerated, confirming base-10 stayed byte-identical throughout this phase's engine-generalization work — the CLAUDE.md "never regenerate with `-u`" rule was honored.

## Anti-Patterns Found

None blocking. No `TODO`/`FIXME`/`placeholder`/"not yet implemented" stub markers found in any Phase-4-authored file (comments referencing "todo 003"/"todo 005" are references to the folded todo IDs being resolved, not stub markers). No stray `console.log`. No empty-return stubs in the new label-scheme, base-picker, share-params, region or base-switch modules — every must_have artifact read during verification contained real, substantive logic matching its plan's contract, not a placeholder.

## Human Verification Required

None. Every observable truth in this phase has automated e2e coverage that was actually run (not just claimed) and passed, including the visual/interactive ones typically requiring a human (keyboard traversal, ARIA names, reduced-motion, hover/pin, isolate/mute visual state, zoom/pan/fit) — Playwright's real browser automation exercised these directly. No visual-only judgment call (e.g. "does this look good") remains that automated checks can't cover for this phase's scope.

## Gaps Summary

No functional gaps found. All 5 ROADMAP success criteria and all 9 requirement IDs (UI-01 through UI-08, MIG-02) are verified against actual, substantive, wired code — not summaries' claims — and the full `npm run verify` gate passes cleanly on the committed tree. The one issue worth the developer's attention is a **documentation-only** inconsistency in `.planning/REQUIREMENTS.md`'s traceability table (UI-02/UI-03/UI-08 rows still read "Pending" despite being functionally complete and despite the same file's own checkbox section and 04-12's SUMMARY marking them done) — recommended to fix in a trivial follow-up edit, not a reason to withhold phase sign-off. The three code-review warnings (WR-01..WR-03) are legitimate, narrowly-scoped follow-up items already on record in `04-REVIEW.md` and do not block any roadmap success criterion.

---

_Verified: 2026-09-29T21:08:51Z_
_Verifier: Claude (gsd-verifier)_

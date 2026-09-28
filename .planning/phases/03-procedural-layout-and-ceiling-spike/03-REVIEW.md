---
phase: 03-procedural-layout-and-ceiling-spike
reviewed: 2026-09-27T00:00:00Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - .gitignore
  - NOTICE
  - app/data/positions.ts
  - app/presets/base10/layout-tables.ts
  - app/presets/base10/layouts.ts
  - engine/index.ts
  - engine/layout/format.ts
  - engine/layout/frame.ts
  - engine/layout/index.ts
  - engine/layout/ladder.ts
  - engine/layout/pack.ts
  - engine/layout/pairgraph.ts
  - engine/layout/params.ts
  - engine/layout/registry.ts
  - engine/layout/ring.ts
  - engine/layout/routing.ts
  - engine/layout/spiral.ts
  - engine/layout/tween.ts
  - engine/layout/types.ts
  - engine/package.json
  - engine/scene/index.ts
  - engine/scene/svgString.ts
  - engine/scene/tier-table.json
  - engine/scene/tierTable.ts
  - engine/scene/tiers.ts
  - engine/test/layout.degenerate.test.ts
  - engine/test/layout.determinism.test.ts
  - engine/test/layout.digest.test.ts
  - engine/test/layout.format.test.ts
  - engine/test/layout.ladder.test.ts
  - engine/test/layout.pack.test.ts
  - engine/test/layout.pairgraph.test.ts
  - engine/test/layout.registry.test.ts
  - engine/test/layout.ring.test.ts
  - engine/test/layout.routing.test.ts
  - engine/test/layout.sizing.test.ts
  - engine/test/layout.spiral.test.ts
  - engine/test/scene.svgString.test.ts
  - engine/test/tiers.schema.test.ts
  - engine/test/tiers.select.test.ts
  - scripts/review-sheet.ts
  - scripts/review-sheet/build.ts
  - scripts/spike/driver.ts
  - scripts/spike/harness.mjs
  - scripts/spike/shape.ts
  - scripts/spike/write-table.ts
  - tests/presets/base10-layouts.test.ts
  - tests/presets/layout-registry.test.ts
  - tests/presets/review-sheet.smoke.test.ts
  - tests/spike/shape.test.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-27
**Depth:** standard
**Files Reviewed:** 50
**Status:** issues_found (info-level only)

## Summary

This phase adds the procedural layout engine (`engine/layout/`: ring, ladder, spiral, pair-graph, packing,
routing, frame-fit, tween), the SVG scene emitter and render-tier threshold table (`engine/scene/`), the
base-10 preset seam (`app/presets/base10/`), and two dev-only tools (the layout contact-sheet builder and the
Playwright ceiling-spike harness/driver/shaper under `scripts/`). The engine code is unusually well covered:
every layout builder has an exhaustive mismatch-collector sweep over every even base (2..400, plus large
outliers such as 666/1024/4096), a byte-identical determinism test, and — for the ten review-set bases — a
sha256 digest pinned to the user's 03-08 contact-sheet sign-off. `validateTierTable` is exercised both by a
schema test against the real committed table and by targeted mutation tests.

Per the review brief, three areas got focused attention:

- **XSS control (`engine/scene/svgString.ts`'s `escapeXml`)**: correct. It escapes `&`, `<`, `>`, `"`, `'` in
  that order (so a prior replacement is never re-escaped), and is applied to every free-text value that
  reaches the output — `<title>`, region-label text, gate-name labels, and pair-graph net-span labels. The
  `background` SVG option is validated with a fully-anchored regex (`^#[0-9a-fA-F]{3,8}$`) before use, which
  blocks attribute break-out payloads (verified against the test `layoutToSvg: background validation`).
  Numeric output goes through `fmt`, which throws on non-finite values rather than ever printing `NaN` /
  `Infinity` into an attribute or path. One inconsistency in this area is noted below (IN-01).
- **Engine purity**: no violations found. Every file under `engine/layout/` and `engine/scene/` uses only
  relative imports, no DOM or Node types, and no `Math.random` / `Date.now` / `new Date` / `Intl.` /
  `toLocaleString` (also independently confirmed by the project's own source-scan test,
  `engine/test/layout.determinism.test.ts`). No O(n²) materialization was introduced by this phase's runtime
  code: `packSpiral` uses a bucketed grid for its overlap test, `packShelf` tries a fixed 10 candidate widths
  each built in O(n), and every layout/routing function is O(n) or O(pairCount). (The few O(n²) loops that do
  exist are confined to *tests*, e.g. `layout.ring.test.ts`'s minimum-centre-distance check, which is
  explicitly bounded and documented as test-only.)
- **`DEFAULT_LAYOUT_PARAMS.packer`**: correctly `'shelf'` in `engine/layout/params.ts`, matching the user's
  03-08 contact-sheet sign-off (not `'spiral'`), and pinned by an explicit unit test
  (`engine/test/layout.format.test.ts`).

No Critical or Warning-level issues were found. The four items below are Info-level maintenance/robustness
notes.

## Info

### IN-01: Region-label opacity bypasses the emitter's own non-finite guard

**File:** `engine/scene/svgString.ts:114-125` (`regionLabelsBlock`)
**Issue:** Every other numeric value the emitter writes into an SVG attribute or path goes through `fmt`,
which throws `RangeError` rather than ever printing a non-finite value (the module's own stated invariant,
see the file's top-of-file trust-boundary comment and `T-03-01`). `label.opacity` is the one exception —
it is interpolated directly: `` opacity="${label.opacity}" ``. Today this is safe because every `RegionLabel`
built by the layout modules (`ring.ts`, `ladder.ts`, `pairgraph.ts`, and the base-10 `layout-tables.ts`) uses
a hardcoded literal (0.25–0.7). But the guarantee is not structural: if a future layout ever computed opacity
from a division or other derived expression, a `NaN`/`Infinity` could reach the output silently instead of
throwing, unlike every other numeric field.
**Fix:**
```ts
`fill="${clr}" opacity="${fmt(label.opacity)}">${escapeXml(label.text)}</text>`,
```
(`fmt` already accepts values like `0.35`; this just closes the gap for defense-in-depth.)

### IN-02: Duplicated layout-builder scaffolding across ring/ladder/spiral

**File:** `engine/layout/ladder.ts:79-91`, `engine/layout/spiral.ts:67-79`, `engine/layout/ring.ts:247-252`
**Issue:** `ladder.ts` and `spiral.ts` contain a byte-identical block that builds the "none"-glyph
`groups`/`zoneGroup` array from `g.cycles` (used only so every zone belongs to some group id), and an
identical two-line identity `drawOrder` builder appears in `ladder.ts`, `spiral.ts`, and `pairgraph.ts`.
Separately, `ring.ts` and `spiral.ts` compute the `nodeRadius`/`labelSize`/`strokeScale`/`scale`/`natural`
block from `fit.scale` with verbatim-identical code. No drift was found between the copies (all four layout
builders agree), but the duplication is a maintenance risk: a future formula change applied to one copy and
missed in another would not be caught by type-checking, only by the sizing/determinism sweeps.
**Fix:** Factor the shared blocks into small helpers (e.g. in `engine/layout/frame.ts` or a new
`engine/layout/scaffold.ts`): `identityDrawOrder(n)`, `noneGlyphGroups(g, center)`, and a
`sizingFromFit(fit, params)` helper returning `{ nodeRadius, labelSize, strokeScale, scale, natural }`.

### IN-03: `scripts/spike/driver.ts --ns` with a missing/unparseable value silently runs zero sizes

**File:** `scripts/spike/driver.ts:62-67`, `91-95`
**Issue:** If `--ns` is passed with no following value (or a value that parses to no positive finite
numbers), `parseArgs` sets `ns = []`. `nsFor` then does `if (args.ns) return args.ns`, and since `[]` is
truthy in JavaScript, the empty array is returned as-is rather than falling back to `QUICK_NS` or
`DEFAULT_NS`. The affected suite (`svg-rich`/`svg-lean`/`canvas`/`chords`/`headless`) silently runs over zero
sizes instead of erroring or using defaults. This is dev-only tooling that is never part of `npm run verify`,
so the practical impact is limited to a confusing local run, not a shipped defect.
**Fix:** `if (args.ns && args.ns.length > 0) return args.ns`, or throw in `parseArgs` when `--ns` yields no
usable numbers (mirroring the existing `throw new Error` used for an unknown `--profile`/`--suite`).

### IN-04: `scripts/spike/shape.ts` casts raw JSONL fields without runtime validation

**File:** `scripts/spike/shape.ts:59-73` (`toMeasurement`), and similarly in the chords/headless mapping
**Issue:** Fields read from the raw `.spike/raw/*.jsonl` records (produced by `driver.ts`) are cast directly
from `unknown` to their typed shape (`r.profile as DeviceProfile`, `r.suite as MeasuredSuite`, `r.n as
number`, etc.) with no runtime check. In practice this is safe today because `write-table.ts` gates the
actual write behind `validateTierTable(table)` and refuses to write on any problem (`T-03-28`), so a
malformed raw record can't corrupt the committed table — but it does mean a typo'd profile/suite string in a
raw record surfaces only as a generic downstream validator complaint (or a confusing `undefined`-shaped row)
rather than a clear error at the point the bad record was read.
**Fix:** Optional hardening only (this is internal dev tooling, not attacker-reachable): validate
`r.profile`/`r.suite` against `DEVICE_PROFILES`/`MEASURED_SUITES` in `toMeasurement` and throw a specific
"shape: unexpected profile/suite in raw record" error, so a bad spike run fails fast and close to the cause.

---

_Reviewed: 2026-09-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

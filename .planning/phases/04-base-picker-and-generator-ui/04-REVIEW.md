---
phase: 04-base-picker-and-generator-ui
reviewed: 2026-09-29T00:00:00Z
depth: standard
files_reviewed: 89
files_reviewed_list:
  - app/NumogramClient.tsx
  - app/components/info/InfoDisplay.tsx
  - app/components/info/PinnedBackground.tsx
  - app/components/numogram/BasePicker.tsx
  - app/components/numogram/BigBaseSummary.tsx
  - app/components/numogram/LabelSchemeControls.tsx
  - app/components/numogram/NumogramIcons.tsx
  - app/components/numogram/ShortcutsModal.tsx
  - app/components/numogram/TextView.tsx
  - app/components/numogram/ViewContext.tsx
  - app/components/numogram/ViewControls.tsx
  - app/components/panels/CurrentsPanel.tsx
  - app/components/panels/GatesPanel.tsx
  - app/components/panels/LabelsPanel.tsx
  - app/components/panels/LayersPanel.tsx
  - app/components/panels/RegionsPanel.tsx
  - app/components/panels/SyzygiesPanel.tsx
  - app/components/panels/ZonesPanel.tsx
  - app/components/panels/shared.tsx
  - app/components/projection/PairGraphProjection.tsx
  - app/components/projection/Projection.tsx
  - app/components/ui/CyberButton.tsx
  - app/components/ui/CyberPanel.tsx
  - app/globals.css
  - app/hooks/useLayoutTween.ts
  - app/hooks/useOrbitalAnimation.ts
  - app/hooks/usePanelDrag.ts
  - app/hooks/useReducedMotion.ts
  - app/lib/basePicker.ts
  - app/lib/baseSwitch.ts
  - app/lib/constants.ts
  - app/lib/customAlphabet.ts
  - app/lib/geometry.ts
  - app/lib/glyphCoverage.ts
  - app/lib/labelScheme.ts
  - app/lib/layoutIds.ts
  - app/lib/numogram.ts
  - app/lib/numogramText.ts
  - app/lib/numogramView.ts
  - app/lib/planetary.ts
  - app/lib/regions.ts
  - app/lib/renderData.ts
  - app/lib/shareParams.ts
  - app/lib/shareTitle.ts
  - app/lib/tierBounds.ts
  - app/lib/viewLayouts.ts
  - app/lib/xenotation.ts
  - app/presets/base10/layout-tables.ts
  - app/presets/base10/layouts.ts
  - app/presets/base10/routes.ts
  - e2e/accessibility.spec.ts
  - e2e/base-picker.spec.ts
  - e2e/base-switch-reset.spec.ts
  - e2e/behaviour-collect.ts
  - e2e/behaviour.spec.ts
  - e2e/hover-pin.spec.ts
  - e2e/label-scheme.spec.ts
  - e2e/layers-zoom.spec.ts
  - e2e/region-legend.spec.ts
  - e2e/row-click-regression.spec.ts
  - e2e/smoke-bases.spec.ts
  - e2e/url-codec.spec.ts
  - e2e/viewer-helpers.ts
  - engine/scene/tiers.ts
  - engine/test/guard.test.ts
  - perf/page-weight.baseline.json
  - scripts/capture-base10-oracle.ts
  - scripts/check-repo.mjs
  - tests/app/basePicker.test.ts
  - tests/app/baseSwitch.test.ts
  - tests/app/customAlphabet.test.ts
  - tests/app/glyphCoverage.test.ts
  - tests/app/labelScheme.test.ts
  - tests/app/layoutIds.test.ts
  - tests/app/numogramLib.test.ts
  - tests/app/numogramText.test.ts
  - tests/app/numogramView.test.ts
  - tests/app/projectionRender.test.ts
  - tests/app/regions.test.ts
  - tests/app/renderData.test.ts
  - tests/app/shareParams.test.ts
  - tests/app/tierBounds.test.ts
  - tests/app/viewLayouts.test.ts
  - tests/e2e-normalizer/behaviour-lore-coverage.test.ts
  - tests/oracle/deriveBase10.ts
  - tests/presets/base10-adapter.test.ts
  - tests/presets/base10-layouts.test.ts
  - tests/presets/base10-routes.test.ts
  - tests/repo/check-repo.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-29
**Depth:** standard
**Files Reviewed:** 89
**Status:** issues_found

## Summary

Phase 4 turns the base-10-only viewer into a base-generic generator (base picker, `?base=` codec, label schemes,
region legend, layer/zoom controls, keyboard/ARIA traversal) and finishes the MIG-02 hard-coded-10 cleanup. The
project's own hardest correctness rules held up well under review:

- **In-base arithmetic.** `app/lib/numogram.ts`'s `plexExpr` reduces using `digitsOf`/`formatNumeral` in the
  target base throughout, never a decimal digit sum; the `((T-1) % (n-1)) + 1` digital-root rule and the `T===0`
  guard live in `engine/core/base.ts`/`numogram.ts` and were not touched here.
- **Regions as `Cycle[]`.** `app/lib/regions.ts`, `app/lib/numogramView.ts`, `Projection.tsx` and
  `RegionsPanel.tsx` all iterate `g.torques`/`g.cycleAt(i)` and never assume a single Torque; the region-legend
  rows, isolate/mute filter and the particle/Time-Circuit overlays all map over every cycle (verified against
  base 28's three-cycle Torque and base 64's six).
- **Degenerate/huge bases.** The `view`-is-`null`-above-`svgRichMaxN` contract is threaded consistently through
  every panel (`PanelUnavailable` guards) and through `Projection`/`PairGraphProjection`; `view.demons === null`
  (bases 82–200, between `allChordsMaxN=80` and `svgRichMaxN=200`) is null-checked everywhere it's read
  (`LayersPanel`, `InfoDisplay`, `Projection`).
- **The MIG-02 grep gate** (`scripts/check-repo.mjs`'s `findHardcodedBaseTen`) and the base 2–40 smoke sweep
  (`e2e/smoke-bases.spec.ts`) are in place and correctly scoped, with `app/presets/base10/**`,
  `app/lib/planetary.ts`, `app/hooks/useOrbitalAnimation.ts` and `NumogramIcons.tsx` exempted for the base-10-only
  authored/planetary code paths that legitimately keep `0..9`/`9 - z` literals.
- **`pairStates` reuse of `zoneStateArr`** in `NumogramClient.tsx` (`zoneStateArr[q]` fed to
  `PairGraphProjection` as a per-pair state) looks like a zone/pair index mismatch at first read, but is correct:
  `engine/core/numogram.ts`'s `pair(q).lo === q` always, and the two zones of a pair are always in the same
  cycle, so `zoneStateArr[q]` (the state of the pair's own `lo` zone) is exactly the pair's state.

No security issues, no hard-coded secrets, no `eval`/`innerHTML` sinks, and no crashes were found. The issues
below are logic/UX-consistency gaps, mostly in newly added interactive chrome that isn't yet exercised by the
Wave-0 e2e specs (confirmed by reading `e2e/base-picker.spec.ts`, `e2e/label-scheme.spec.ts` and
`e2e/base-switch-reset.spec.ts`: none of the three exercise the specific interleavings below).

## Warnings

### WR-01: Label-scheme radio/text can visibly desync from the applied scheme

**File:** `app/components/numogram/LabelSchemeControls.tsx:25-36, 52-56`
**Issue:** `open` (whether the Custom section is expanded) and `text` (the custom-alphabet input's contents) are
both initialized once from `scheme` via `useState(() => ...)` and are never re-synced when `scheme` changes for a
reason other than this component's own `onChange` calls — e.g. Undo/Redo (`NumogramClient.tsx`'s `applySnapshot`)
or URL hydration restoring a previous `labelScheme` while the base-picker dropdown happens to stay mounted (it
only unmounts when the dropdown closes, not on every scheme change). `customChecked` is computed as
`scheme.mode === 'preset' || scheme.mode === 'custom' || open` (line 34), so if `scheme` flips back to `digits` or
`xeno` externally while `open` is still `true` from an earlier session, the **Custom** radio stays visually
selected and **Digits**/**Xeno** stay unselected even though the digits/xeno scheme is the one actually applied
to the diagram. The `text` field can similarly show a stale custom alphabet after such an external change.
**Fix:** Sync both from the prop instead of only initializing from it once, e.g.:
```tsx
React.useEffect(() => {
  setOpen(scheme.mode === 'preset' || scheme.mode === 'custom')
  setText(scheme.mode === 'custom' ? scheme.chars.join('') : '')
}, [scheme])
```
(or key `LabelSchemeControls` by `labelSchemeKey(scheme)` from the parent so an external change remounts it,
mirroring the `dirty`-guarded resync pattern `BasePicker.tsx` already uses for its own `candidate`/`refusal`
state at lines 65-73).

### WR-02: Shortcuts overlay's "Layout" line is base-10-only and contradicts its own "Gate keys" caveat

**File:** `app/components/numogram/ShortcutsModal.tsx:42, 44, 49`
**Issue:** Line 42 hard-codes `"Layout: A original, S labyrinth, D ladder, F planetary"`. That mapping is only
true at base 10; `app/lib/layoutIds.ts`'s `layoutShortcut`/`layoutIdsForBase` (which this very phase's base-generic
layout switcher now drives, per `NumogramClient.tsx`'s `layoutShortcut(id, g.base)`) assigns A/S/D/F to
`ring, ladder, spiral, pairGraph` at every other base. A user on base 28 pressing "D" (per this overlay) would
expect "ladder" but gets "spiral". Separately, line 44 ("Selection: digits 0-9 toggle corresponding gate")
directly contradicts the newly added line 49 ("Gate keys: digits 0-9 work at base 10 only") two lines below it —
the same help panel now asserts both an unqualified and a qualified version of the same shortcut.
**Fix:** Either qualify line 42 the same way line 49 already qualifies the digit shortcut (e.g. "Layout: A/S/D/F
map to this base's first four layouts — see the header switcher"), or generate the layout row dynamically from
`layoutIdsForBase(base)`/`LAYOUT_LABELS`. Fold line 44's claim into the existing base-10-only caveat so the panel
doesn't state two different things about the same shortcut in the same view.

### WR-03: Base-picker's debounced commit can evaluate against a stale `base`

**File:** `app/components/numogram/BasePicker.tsx:77-93`
**Issue:** The debounce effect's dependency array is `[candidate, dirty]` with
`// eslint-disable-next-line react-hooks/exhaustive-deps` suppressing the missing `evaluateNow`/`base`
dependency. `evaluateNow` closes over the `base` prop from the render in which the effect was scheduled. If the
committed `base` changes through a path other than this component while the visitor is still mid-typing
(`dirty === true`) — Undo/Redo, `applySnapshot`, or a programmatic base change — the pending `setTimeout` does not
get rescheduled (its deps didn't change) and fires `evaluateCandidate(candidate, staleBase)` against the old
base. The refusal message's "Showing base X" can then name a base that's no longer current, and the
`result.base !== base` check that decides whether to call `onCommitBase` compares against the stale value too,
so a same-value-as-stale-base candidate could fail to commit even though it differs from the *new* current base.
**Fix:** Include `base` in the effect's dependency array (and drop the eslint-disable), or read the latest base
from a ref (`baseRef.current`) inside the timeout callback instead of closing over the render-time value.

## Info

### IN-01: Base-picker slider misreads a typed "0" as the old base

**File:** `app/components/numogram/BasePicker.tsx:198`
**Issue:** `value={sliderPosition(Number(candidate) || base)}` — `Number("0")` is `0`, which is falsy, so `|| base`
substitutes the *previously committed* base instead of `0` whenever the visitor has typed exactly `"0"` (a
plausible intermediate/complete value while editing). The slider thumb visually jumps to the old base's position
instead of tracking towards the clamped low end. `sliderPosition` clamps to `SLIDER_MIN` regardless, so the
committed value is unaffected, but the live preview briefly shows a value inconsistent with what was typed.
**Fix:** `Number.isNaN(Number(candidate)) ? base : Number(candidate)` (or check `candidate.trim() === ''`
explicitly) instead of `||`.

### IN-02: `Demon.kind` is a bare `string`, not a literal union

**File:** `app/data/types.ts:37`
**Issue:** `export interface Demon { a: number; b: number; name: string; kind: string }`. Every consumer
(`app/components/projection/Projection.tsx:276`, `app/components/info/InfoDisplay.tsx:292-303,324-330`) branches
on `d.kind === 'chrono' | 'xeno' | 'amphi'` and falls through to an implicit "else = syzygy" with no
compiler-enforced exhaustiveness check. If `app/presets/base10/demons.ts`'s `legacyKind()` ever returns a typo'd
or a fifth value, every one of these call sites would silently mislabel the demon (wrong color, wrong
description) instead of failing to compile.
**Fix:** Narrow `kind` to `'chrono' | 'amphi' | 'xeno' | 'syzygy'` and use a `switch` with an
`assertNever`/exhaustiveness check at the one or two places that classify it, so a future subtype addition is a
compile error everywhere it isn't handled.

---

_Reviewed: 2026-09-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

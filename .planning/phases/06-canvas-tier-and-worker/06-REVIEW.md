---
phase: 06-canvas-tier-and-worker
reviewed: 2026-10-19T16:36:19Z
depth: deep
files_reviewed: 37
files_reviewed_list:
  - app/NumogramClient.tsx
  - app/components/canvas/CanvasDiagram.tsx
  - app/components/info/InfoDisplay.tsx
  - app/components/numogram/BasePicker.tsx
  - app/components/numogram/BigBaseSummary.tsx
  - app/components/numogram/ShortcutsModal.tsx
  - app/components/numogram/ViewContext.tsx
  - app/components/panels/CurrentsPanel.tsx
  - app/components/panels/GatesPanel.tsx
  - app/components/panels/LayersPanel.tsx
  - app/components/panels/RegionsPanel.tsx
  - app/components/panels/SyzygiesPanel.tsx
  - app/components/panels/ZonesPanel.tsx
  - app/components/panels/shared.tsx
  - app/lib/canvas/diagramModel.ts
  - app/lib/canvas/draw.ts
  - app/lib/canvas/interaction.ts
  - app/lib/canvas/keyboardModel.ts
  - app/lib/canvas/pickIndex.ts
  - app/lib/canvas/viewTransform.ts
  - app/lib/demonState.ts
  - app/lib/numogramText.ts
  - app/lib/numogramView.ts
  - app/lib/selectionList.ts
  - app/lib/shareParams.ts
  - app/lib/summary.ts
  - app/lib/tierBounds.ts
  - app/lib/worker/buildResult.ts
  - app/lib/worker/protocol.ts
  - app/lib/worker/useNumogramWorker.ts
  - app/lib/worker/workerClient.ts
  - engine/scene/canvasScene.ts
  - engine/scene/index.ts
  - engine/scene/tiers.ts
  - scripts/spike/shape.ts
  - scripts/worker-chunks.mjs
  - workers/numogram.worker.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-19T16:36:19Z
**Depth:** deep
**Files Reviewed:** 37
**Status:** issues_found

## Summary

The 37 files were read in full and cross-checked across the worker protocol, the swap logic in `NumogramClient.tsx`, the Canvas component and its pure modules, and the tier table. Several claims were checked by running code against the existing static export in `out/` (a throwaway local server and Playwright scripts kept in the scratchpad; no source file was changed).

The core of the phase holds up. The latest-wins protocol is correct (ten fake-worker scenarios passed, covering coalescing, supersede, error-to-fallback, post failure, no-Worker above the ceiling, dispose and StrictMode-style recreation). Every hostile base tried (2^26 alone and with `demonFocus`, `selected`, `region`, `isolate`, `mute`, `tier=canvas`, `tier=headless`) reached the headless view in about 1 to 2 s with no page error and no main-thread numogram. `buildResult` succeeded for all 1,654 offered (base, layout, packer) combinations from 2 to 4000, and the worker chunk is lean (17 KB, no tier-table rows, no lore). The pure modules (`pickIndex`, `viewTransform`, `canvasScene`, `tiers`, `shape.ts`) have no defect I could demonstrate.

Three real defects remain:

- **WR-01.** The `tier=svg` override still lets any base up to 2^26 be built on the main thread, contrary to the phase's own invariant.
- **WR-02.** A previously zoomed Canvas scene comes back blank, with a wrong zoom percentage, after the user visits another scene and returns.
- **WR-03.** SVG-tier wheel zoom stops working after the SVG diagram has unmounted once.

Five low-severity items follow. No security issue was found: there is no `innerHTML`, `eval` or `dangerouslySetInnerHTML` in scope, and every user-controlled string (custom alphabet labels, refusal echoes, announcements, callouts, the live region) reaches the DOM as a React text node or a canvas `fillText`.

## Warnings

### WR-01: `?tier=svg` (and a persisted override) builds the whole numogram and SVG on the main thread at any base up to 2^26

**File:** `app/lib/tierBounds.ts:31-33`, `engine/scene/tiers.ts:136-138`, `app/NumogramClient.tsx:153-155`, `:741`, `:759-775`, `:448-458`, `:471-481`, `:234-241`
**Issue:** `selectTier` returns the override unconditionally (`if (override !== undefined) return override`), and every caller goes through `tierFor`. `needsWorkerFor(base, layout, 'svg')` is therefore false at any base, so two paths take the synchronous branch.

- **Link hydration.** `?base=N&tier=svg` calls `setBase(N)` (line 759). The next render runs `createNumogram`, `buildNumogramView`, `zoneLabelsFor`, `layoutTarget` and the full `Projection` for N zones on the main thread.
- **Base picker.** `tierOverride` stays set for the session, so typing a huge base in the picker takes the same synchronous `commitBase` branch (lines 471-481).

This breaks the Phase 6 invariant "nothing builds a numogram on the main thread above the interactive ceiling". `parseShareParams` already worked around it for `region=`, `isolate=` and `mute=` by using the natural tier (shareParams.ts:196), but the base itself is still taken. T-04-37 in `04-SECURITY.md` accepted this as "only slows the opener's tab". That acceptance no longer fits: a shared link does force the state onto whoever opens it, and the cost is superlinear, so 2^26 will exhaust memory (several arrays of 67 million entries) rather than merely run slowly.

Measured on the current `out/` build with Playwright:

| URL | Result |
| --- | --- |
| `?base=16384` (no override) | ready in 0.17 s, 341 SVG nodes |
| `?base=16384&tier=svg` | ready after 11.4 s, 176,296 SVG nodes |
| `?base=4002&tier=svg` | 2.6 s, 42,148 SVG nodes |

At 2^26 the same path scales that 16384 case by about 4,000 times. This was not run, because it would crash the tab.

**Fix:** Clamp the SVG override at the ceiling in one place, so hydration, the picker and `needsWorkerFor` all get it. Keep `tier=svg` as a diagnostic between 202 and 4000.

```ts
// app/lib/tierBounds.ts
export function tierFor(n: number, override?: RenderTier | null): RenderTier {
  // An 'svg' override never lifts the main-thread ceiling (Phase 6 P6): above it the natural tier wins.
  const effective = override === 'svg' && n > INTERACTIVE_MAX_N ? undefined : (override ?? undefined)
  return selectTier(n, TIER_VIEW, effective)
}
```

Update the T-04-37 accepted-risk note and the `shareParamsHeadless` test that documents "the guard ignores the override" (06-09-SUMMARY) to assert the new behaviour. The kill switch cannot be a data edit, because `validateTierTable` requires `tierOverrideParam.enabled === true` (tiers.ts:404-410) and `shape.ts:271` hard-codes it. The change has to be in code.

### WR-02: Returning to a previously zoomed Canvas scene restores the stale committed zoom while the live view is reset, so the diagram shows blank and the toolbar lies

**File:** `app/components/canvas/CanvasDiagram.tsx:235-239`, `:691-693` (with `:296-299`)
**Issue:** The committed transform is derived as `box.key === sceneKey ? box.t : IDENTITY`. `box` is only replaced inside `commit()`, and the `sceneKey` layout effect only resets `liveRef`. Take the sequence scene A, zoom and commit (`box = {A, t}`), switch to scene B with no zoom committed there (`box` is still `{A, t}`; `committed` reads as identity because the keys differ), then switch back to A. Now `box.key === 'A'` again, so `committed = t` (the old zoom) while `liveRef` was reset to the identity. The layers are rastered at `t`. `applyGestureCss` then maps the committed bitmap to the live identity view, shrinking the old zoomed raster to a small patch on a blank window. `data-zoom` and the toolbar percentage (via `zoomReportRef`) report the stale zoom. Nothing corrects it until the next gesture, Fit, or toolbar zoom.

Any canvas-to-canvas change qualifies: base 202 to 204 and back, or ring to ladder and back. `CanvasDiagram` stays mounted across these swaps, because only the `scene` prop changes. It is reproduced on the current build (Playwright, base 202 then 204 then 202):

```
zoomed at 202 : data-zoom 2.4596031111569485, stack transform ""
at 204        : data-zoom 1,                  stack transform ""
back at 202   : data-zoom 2.4596031111569485, stack transform "translate(172.095px, 180.7px) scale(0.40657)"
```

The screenshot shows an empty diagram area and "246%" in the toolbar. The 06-10 browser checks covered "scene swap (zoom and ring reset)" for a single swap but not the return to a previous key.

**Fix:** Reset the stored box whenever the scene key changes, not only the live ref.

```tsx
useIsoLayoutEffect(() => {
  liveRef.current = IDENTITY_TRANSFORM
  setBox(prev => (prev.key === sceneKey ? prev : { key: sceneKey, t: IDENTITY_TRANSFORM }))
}, [sceneKey])
```

During the render before the effect, `committed` is already the identity because of the key mismatch, so there is no flash. Add an e2e step (zoom, change base or layout, change back, assert `data-zoom="1"` and an empty `stack.style.transform`).

### WR-03: SVG-tier wheel zoom stays dead after the SVG diagram has been unmounted once

**File:** `app/NumogramClient.tsx:273`, `:1578-1583` (with `app/hooks/useCanvasPan.ts:11-51`, outside the listed scope but the cause)
**Issue:** `useCanvasZoom(svgWrapRef)` attaches its non-passive wheel listener in an effect whose deps are `[wrapRef, clamp]`, so it binds once, to the element that exists at first mount. The SVG wrapper is `<div ref={svgWrapRef}>` inside `view && target ? … : renderTier === 'canvas' … ? <CanvasDiagram/> : <BigBaseSummary/>`. When the tree leaves the SVG branch (Canvas or headless) and comes back, React mounts a new wrapper element, but the listener stays on the old, detached element. Wheel zoom is then dead in the SVG tier.

The unmount existed since Phase 4's headless tier, but the Canvas tier makes the round trip routine: any visit to a base above 200 now ends with a Canvas swap. Reproduced on the current build:

```
fresh SVG wheel                  : scale(1) -> scale(1.16183)
SVG wheel after 10 -> 202 -> 10  : scale(1) -> scale(1)
```

The toolbar zoom buttons still work, so only wheel zoom breaks. This affects the base-10 viewer, whose behaviour is meant to stay unchanged.

**Fix:** Rebind when the wrapper remounts, without changing any markup (so the DOM goldens stay byte-identical). Pass a flag that is true while the SVG branch is rendered, and include it in the effect deps.

```tsx
// NumogramClient.tsx
const svgShown = !!(view && target) // as computed for the JSX branch
const { zoom, zoomOrigin, setZoom, setZoomOrigin } = useCanvasZoom(svgWrapRef, svgShown)

// useCanvasPan.ts
export function useCanvasZoom(wrapRef: RefObject<HTMLDivElement | null>, active = true) {
  useEffect(() => {
    const wrap = wrapRef.current
    if (!active || !wrap) return
    /* … unchanged … */
  }, [wrapRef, clamp, active])
}
```

`view` (line 241) and `target` (line 248) are both declared before the hook call at line 273, so the flag can be computed in place. Alternatively use a callback ref that stores the element in state and pass that element to the hook.

## Info

### IN-01: The label formatter re-validates the whole alphabet on every call, so the worker's text build is O(zones x alphabet length)

**File:** `app/lib/worker/buildResult.ts:66` (calling `formatZoneLabel` in `app/lib/labelScheme.ts`)
**Issue:** For `preset` and `custom` schemes, `formatZoneLabel` runs `validateAlphabet(alphabet, base)` on each call. That is a full per-character regex scan plus a duplicate Set, even to decide on the numeral fallback. `numogramText` calls it about 10 times per zone, inside the single worker, which cannot be cancelled. A newer request waits behind it. This is a performance concern, out of v1 scope on its own, but it measurably stretches latest-wins latency. Measured in the worker core with a 1,024-character custom alphabet:

| Base | Time |
| --- | --- |
| 512 | 208 ms |
| 1,024 | 417 ms |
| 2,048 | 836 ms |
| 4,000 | 1,630 ms |

For comparison, the digit scheme takes about 35 ms in total at 4,000.

**Fix:** Validate once and reuse the result. Build the formatter once per request (`const usable = validateAlphabet(alphabet, req.base).ok`) and return `alphabet[z]` or `formatNumeral(z, base)` from the closure, as `zoneLabelsFor` already does.

### IN-02: A Canvas rubber band leaves `suppressNextCanvasClickRef` set, so the first empty-space click in the SVG tier is swallowed

**File:** `app/NumogramClient.tsx:704`, `:1600-1606`
**Issue:** `finalizeSelection` sets `suppressNextCanvasClickRef.current = true` for every drag-like selection, including Canvas ones. Only the SVG wrapper's `onClick` ever consumes it. After a Canvas rubber band, the next switch to an SVG-tier base leaves the flag set, and the first background click skips `clearInfoFocus()` once.

**Fix:** Set it only in the SVG branch (`if (renderTier !== 'canvas') suppressNextCanvasClickRef.current = true`), or reset it when `renderTier` changes.

### IN-03: The debounced base commit can run with a stale `onCommitBase` and drop the user's typed base

**File:** `app/components/numogram/BasePicker.tsx:91-107`, `app/NumogramClient.tsx:448-485`
**Issue:** The debounce effect depends on `[candidate, dirty]` only. `evaluateNow`, with its `effectiveBase` and `onCommitBase` (`commitBase`), is captured from the render of the last keystroke. If a worker result lands inside the 200 ms window (so `base` and `pendingBase` change), the timer fires with the old `base` and `pendingBase`.

Example: base 10 displayed. The user commits 500 with Enter, then types 10 while the result lands. The timer runs with the old `base` of 10, `commitBase(10)` hits `if (n === base) return`, and the request is silently ignored while the app now shows 500. The window is narrow but real.

**Fix:** Read the latest props at fire time, for example `const commitRef = useRef(onCommitBase); commitRef.current = onCommitBase` (the same for `effectiveBase`), and call through the ref in the timer.

### IN-04: The worker client has no recovery for a reply that never arrives

**File:** `app/lib/worker/workerClient.ts:89-90`, `:110-120`
**Issue:** Only `onmessage` and `onerror` are wired. A `messageerror` event (a reply that cannot be deserialized) or a worker that dies without raising `error` leaves `inFlight` set forever. Every later request then sits in `pending`, and the picker stays "computing" with no fallback. The `id: -1` reply for a malformed request is also ignored by design (checked: the real client cannot produce one).

**Fix:** Add `worker.onmessageerror = () => this.onError()` so it takes the same kill-and-fall-back path. Optionally add a generous watchdog (for example 30 s) that does the same for the in-flight job.

### IN-05: `INTERACTIVE_MAX_N` is not asserted finite where it is read

**File:** `app/lib/tierBounds.ts:24`, `engine/scene/tiers.ts:131-133`
**Issue:** `interactiveCeiling` returns `Infinity` when the table has neither `canvasMaxN` nor `interactiveMaxN`. That is documented and unit-tested, and the shipped table is valid. The shipped table has `canvasMaxN: null` and `interactiveMaxN: 4000`, and `engine/test/tiers.schema.test.ts:88` pins it. If a future data edit or regenerated table dropped the field, the app would still build and ship. `sceneWanted` (`base <= Infinity`) would then build a Canvas scene for any base up to 2^26, and every tier decision would stop gating at the ceiling. `shape.ts:223-228` carries the field forward correctly, so this is defence in depth only.

**Fix:** Fail loudly at module load in the app: `if (!Number.isFinite(INTERACTIVE_MAX_N)) throw new Error('tier table has no interactive ceiling')`.

---

_Reviewed: 2026-10-19T16:36:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

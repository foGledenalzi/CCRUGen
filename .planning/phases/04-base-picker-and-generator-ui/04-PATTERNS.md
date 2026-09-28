# Phase 4: Base Picker and Generator UI - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 24 (5 new, 19 modified/generalized/fixed)
**Analogs found:** 22 / 24 (2 flagged "no close analog" — both are new browser-API/schema surfaces, see below)

Read alongside: `04-CONTEXT.md` (decisions D-01..D-24), `04-RESEARCH.md` (file-level generalization map, verified line numbers), `04-UI-SPEC.md` (approved visual/copy contract — this pattern map defers to UI-SPEC wherever the two could disagree, since UI-SPEC is the more recent, checker-approved source).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/components/numogram/BasePicker.tsx` (NEW) | component (composite control) | request-response (debounced validate-then-commit) | `app/NumogramClient.tsx` layout-switcher `ButtonSet` (lines 1352-1373) + `app/components/ui/CyberPopover.tsx` (dropdown/portal) + `app/components/ui/CyberPageHeader.tsx` (`actions` slot) | role-match (composite of 3 exact analogs) |
| `app/lib/customAlphabet.ts` (NEW) | utility (pure validation) | transform | `engine/core/base.ts` (`validateBase`/`BaseCheck` typed-reason shape) | role-match |
| `app/lib/glyphCoverage.ts` (NEW) | utility (browser-API heuristic) | transform | none in-repo (first canvas/Font-Loading-API consumer) | **no close analog** |
| `app/components/numogram/BigBaseSummary.tsx` (NEW) | component | request-response (render-only) | `app/components/ui/CyberCardContainer.tsx` + `app/components/ui/Figure.tsx` | role-match |
| `app/components/numogram/TextView.tsx` (NEW) | component | request-response + file-I/O (clipboard write) | `app/components/ui/CyberTextArea.tsx` (`.ui-terminal-field`/`.ui-terminal-input` styling, read-only variant) + `app/NumogramClient.tsx`'s `onShareExplanation` copy-success pattern (lines 907-954) | role-match |
| `app/components/panels/RegionsPanel.tsx` (GENERALIZED) | component (panel) | CRUD-like (toggle state) | itself (current 3-region version) + `app/components/panels/LayersPanel.tsx` (two-state-per-row shape) + `app/components/panels/HoverInfoList.tsx` (list primitive) | exact (self) |
| `app/components/projection/Projection.tsx` (GENERALIZED) | component (SVG renderer) | request-response + event-driven (hover/pin/keyboard) | itself (1061 lines, existing dim-opacity/hover/pin logic) | exact (self) |
| `app/NumogramClient.tsx` (GENERALIZED) | component (page/session controller) | event-driven + request-response | itself (1727 lines, existing URL-hydration/history/header logic) | exact (self) |
| `app/lib/shareParams.ts` (REVIVED+EXTENDED) | utility (URL codec) | transform | itself (existing allow-list `fail()` pattern, currently dead code at runtime) | exact (self) |
| `app/lib/numogram.ts` (`plexExpr` fix) | utility | transform | `engine/core/numerals.ts`'s `digitsOf` (the correct in-base digit-sum primitive to call instead) | exact (bug fix target already exists) |
| `app/lib/xenotation.ts` (`xenotationByZone` fix) | utility | transform | itself (`formatXenotationForDisplay`, already base-agnostic) | exact (self) |
| `app/lib/geometry.ts` (partner param) | utility | transform | itself (`syzMidBiased`/`syzTrianglePoints`, already take a `pos` record) | exact (self) |
| `app/hooks/useTween.ts` (GENERALIZED) | hook | event-driven (rAF animation) | `engine/layout/tween.ts`'s `lerpPositions` (base-generic Float64Array interpolation, already exists) | role-match (engine has the base-generic version to port app-side) |
| `app/hooks/useOrbitalAnimation.ts` (reduced-motion gate) | hook | event-driven (rAF animation) | itself + Pattern needed: `window.matchMedia('(prefers-reduced-motion: reduce)')` (no in-repo precedent — CSS-only today) | partial (structure exists, the specific matchMedia gate does not) |
| `app/data/types.ts` (`Region` type replaced) | model (types) | n/a | `engine/core/types.ts`'s `Cycle`/`RegionKind` (the base-agnostic replacement already exists in the engine) | exact (engine already has the right shape) |
| `app/lib/constants.ts` (`REGION_CLR` generalized) | config | n/a | `app/components/panels/LayersPanel.tsx`'s `LAYER_DEFS` (a `kind -> color` map that already tolerates an open-ended list) | role-match |
| `app/components/panels/ZonesPanel.tsx` (FIXED, todo 003) | component (panel) | CRUD (toggle selection) | `app/components/panels/HoverInfoList.tsx` (the itemDisplay function-prop form that does NOT have the remount bug) | exact (the fix target and the safe pattern are both in-repo) |
| `app/components/panels/SyzygiesPanel.tsx` (FIXED, todo 003) | component (panel) | CRUD | same as ZonesPanel | exact |
| `app/components/panels/CurrentsPanel.tsx` (FIXED, todo 003) | component (panel) | CRUD | same as ZonesPanel | exact |
| `app/components/panels/GatesPanel.tsx` (FIXED, todo 003) | component (panel) | CRUD | same as ZonesPanel | exact |
| `app/components/info/InfoDisplay.tsx` (`=9` literal fix) | component | request-response | `engine/core/types.ts`'s `GateInfo`/`PairInfo` (`base - 1` invariant already named there) | exact |
| `app/components/ui/CyberPanel.tsx` (`collapseDirection` wiring) | component (UI primitive) | n/a (prop wiring only) | itself (the collapse animation is already fully implemented behind `collapseDirection`, just never passed a non-`'none'` value from `NumogramClient.tsx`) | exact (self) |
| `scripts/check-repo.mjs` (new MIG-02 grep gate) | config/script (CI guard) | batch (static analysis) | itself — `findTrackedJunk`/`licenseProblems`/`workflowProblems` (pure `text/list -> problems[]` functions, zero deps) | exact (self, established pattern) |
| `?base=`/`labels=`/`isolate=`/`mute=`/`packer=` URL param wiring (inside `shareParams.ts` + `NumogramClient.tsx`) | transform | request-response | `shareParams.ts`'s existing `ALLOWED_LAYOUTS`/`ALLOWED_LAYERS`/`ALLOWED_REGIONS` allow-list sets | exact (self) |

## Pattern Assignments

### `app/components/numogram/BasePicker.tsx` (component, request-response)

**Analogs:** `app/components/ui/CyberPopover.tsx` (portal/dropdown mechanics), `app/NumogramClient.tsx` lines 1352-1373 (existing header-adjacent `ButtonSet` control), `app/components/ui/CyberInput.tsx` (labeled terminal-field input), `app/components/ui/CyberRadio.tsx` (packer toggle).

**Imports pattern** (from `CyberPopover.tsx` lines 1-4):
```typescript
'use client'
import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
```

**Dropdown/portal pattern** (`CyberPopover.tsx` lines 11-53) — reuse the `open` state + `createPortal` + fixed-position technique, but trigger on focus/click/Escape/outside-click per UI-SPEC's "Expanded" state (D-01/D-03), not on hover as `CyberPopover` does today (hover is wrong for a primary input — treat this as the shape to copy, not the exact trigger events):
```typescript
const [open, setOpen] = useState(false)
const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
const popover = useMemo(() => {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed z-[120] ..." style={{ left: pos.x, top: pos.y, border: '1px solid rgba(16,255,80,0.35)', background: '...' }}>
      {content}
    </div>,
    document.body
  )
}, [open, pos])
```

**Debounced live-preview + pure validator pattern** (from `04-RESEARCH.md` Pattern 1, built on `engine/core/base.ts`'s `validateBase`):
```typescript
import { validateBase } from '../../../engine/core/base'

const [candidate, setCandidate] = useState(String(base))
const [refusal, setRefusal] = useState<string | null>(null)

useEffect(() => {
  const id = setTimeout(() => {
    const n = Number(candidate)
    const check = validateBase(n)
    if (check.ok) { onCommitBase(check.base); setRefusal(null) }
    else { setRefusal(check.message) }   // last-good base UNCHANGED — D-06
  }, 200)
  return () => clearTimeout(id)
}, [candidate])
```
`validateBase` (source, `engine/core/base.ts` lines 36-49) already returns a typed `BaseCheck` — do not re-implement odd/too-large/non-integer checks in the component.

**Header integration point** (`app/NumogramClient.tsx` lines 1520-1574): `CyberPageHeader`'s `actions` prop already accepts arbitrary `ReactNode` — the base picker mounts here per UI-SPEC's resolution of the header-vs-ButtonSet ambiguity:
```tsx
<CyberPageHeader
  ...
  actions={(
    <div className="flex items-center gap-1">
      <BasePicker base={base} onCommitBase={handleBaseCommit} />
      {/* existing Undo/Redo/Share buttons unchanged, lines 1527-1572 */}
    </div>
  )}
/>
```

**Stepper icons / packer-toggle radios:** follow `app/components/numogram/NumogramIcons.tsx`'s exact visual convention (viewBox `0 0 24 24`, rendered 18x18, `strokeWidth 1.1-1.2`, `strokeLinecap round`, accent dot `opacity 0.6`, a `clr` prop) — see `OriginalIcon`/`LadderIcon` (lines 9-23, 34-47) as the two clearest templates for a new stepper/isolate/mute glyph. Packer toggle uses `CyberRadio` verbatim (`app/components/ui/CyberRadio.tsx`, unmodified, two instances for Spiral/Shelf).

---

### `app/lib/customAlphabet.ts` and `app/lib/glyphCoverage.ts` (utility, transform)

**Analog for `customAlphabet.ts`:** `engine/core/base.ts`'s typed-reason validation shape (lines 7-12, 31-49) — copy the "one problem type, one message-per-reason, never throws" idiom:
```typescript
// Source: engine/core/base.ts
export type BaseProblem = 'not-a-number' | 'infinite' | 'not-integer' | 'zero' | 'negative' | 'odd' | 'too-large'
export type BaseCheck =
  | { readonly ok: true; readonly base: number }
  | { readonly ok: false; readonly reason: BaseProblem; readonly message: string }
function problem(reason: BaseProblem, message: string): BaseCheck { return { ok: false, reason, message } }
```
Apply the same shape to alphabet validation: `type AlphabetProblem = 'duplicate' | 'too-short' | 'glyph-risk'`, one `problem()`-style helper, messages matching UI-SPEC's Copywriting Contract exactly (e.g. `"'{char}' repeats — every character must be unique."`).

**No close analog for `glyphCoverage.ts`:** this is the first consumer of `document.fonts`/`CanvasRenderingContext2D` in the app. Follow `04-RESEARCH.md` Priority 1's algorithm directly (render candidate glyph vs. a Private-Use-Area reference glyph on an off-screen canvas, compare `measureText().width` then pixel data) — there is no in-repo precedent to pattern-match against, so the planner should treat `04-RESEARCH.md`'s cited approach as the spec, not derive it from existing code.

---

### `app/components/numogram/BigBaseSummary.tsx` (component, request-response)

**Analog:** `app/components/ui/CyberCardContainer.tsx` (bordered chrome box) + `app/components/ui/Figure.tsx` (Display-role numeral).

**Card chrome pattern** (`CyberCardContainer.tsx` lines 24-51):
```tsx
<section className="border border-[#334155] bg-[#0a1018]">
  <CyberPanelHeader title={title} className="border-b border-[#334155] px-3 py-2" />
  <div className="px-3 py-3">{children}</div>
</section>
```

**Display-numeral pattern** (`Figure.tsx` lines 70-95, specifically the `font-semibold leading-none text-gray-100` treatment UI-SPEC also calls out as the one precedent for weight 600):
```tsx
<div className="mt-1 text-base font-semibold leading-none text-gray-100">{renderedValue}</div>
```
Feed it the same summary shape the base picker's collapsed state already computes from `createNumogram(base)` (`04-RESEARCH.md` Code Examples: `zoneCount`, `hasWarp`, `torqueCycleLengths`, `demonCount`) — do not recompute independently.

---

### `app/components/numogram/TextView.tsx` (component, request-response + file-I/O)

**Analog:** `app/components/ui/CyberTextArea.tsx`'s non-`pillCollection` branch (lines 113-127) for the `.ui-terminal-field`/`.ui-terminal-input` monospace presentation — adapt to a read-only `<pre>`/`<div>` (no `<textarea>`, no `onChange`), since UI-SPEC calls for "read-only... not an editable field."

**Copy-button success-state pattern** (`app/NumogramClient.tsx`'s `onShareExplanation`, lines 943-954 — the exact "write, flip a boolean, revert after ~1.2-1.5s" shape UI-SPEC's "Copy numogram text" button reuses):
```typescript
try {
  await navigator.clipboard.writeText(text)
  setCopied(true)
  window.setTimeout(() => setCopied(false), 1200)
} catch {
  // clipboard unavailable / permission denied — silently ignore, matches existing share button
}
```
Button label swap ("Copy numogram text" -> "Copied") is new copy, but the state-machine (boolean + `setTimeout`) is copied verbatim from this existing call site.

---

### `app/components/panels/RegionsPanel.tsx` (GENERALIZED panel, CRUD-like toggle state)

**Analog:** itself (current version, full file read above) + `app/components/panels/LayersPanel.tsx` for the two-affordance-per-row shape, both built on `app/components/panels/HoverInfoList.tsx`.

**Current single-action-per-row pattern to replace** (`RegionsPanel.tsx`, current file, lines 24-65): each `HoverInfoListItem` has exactly one `onClick`. The generalized version needs two independent booleans per row (isolate, mute) — `HoverInfoListItem`'s `right?: React.ReactNode` slot (already used by `LayersPanel.tsx` line 37 for an ON/OFF label, and by `RegionsPanel.tsx` line 42 for a zone list) is the correct place to put the two new icon buttons, not a new list primitive:
```tsx
// Pattern already proven in LayersPanel.tsx line 37 — `right` renders arbitrary content per row:
right: <span className="text-[8px] text-gray-700">{layers.has(l.id) ? 'ON' : 'OFF'}</span>
// Generalize to two buttons:
right: (
  <span className="ml-auto flex items-center gap-1">
    <IsolateButton engaged={isolateState[row.id]} onClick={() => toggleIsolate(row.id)} />
    <MuteButton engaged={muteState[row.id]} onClick={() => toggleMute(row.id)} />
  </span>
),
```

**Row-source pattern** (new, from `04-RESEARCH.md` Pattern 2 — `engine/core/types.ts`'s `Numogram.torques`/`.plex`/`.warp` are already in D-24's canonical order, no client sort needed):
```typescript
import { torqueLabel } from '../../../engine/core/numerals'
function regionRows(g: Numogram) {
  const rows = g.torques.map(cycle => ({ id: `torque:${cycle.torqueIndex}`, label: `Torque ${torqueLabel(cycle.torqueIndex)}`, kind: 'torque' as const }))
  rows.push({ id: 'plex', label: 'Plex', kind: 'plex' as const })
  if (g.warp) rows.push({ id: 'warp', label: 'Warp', kind: 'warp' as const })
  return rows
}
```

**List primitive to reuse unchanged:** `HoverInfoList.tsx`'s `itemDisplay` inline-**function**-prop form (lines 49-59) — NOT `SelectableListPanel`'s `ItemDisplayComponent` form. This is load-bearing: see Shared Patterns / Todo 003 below.

**Scrollable-list wiring** (D-20, "no grouping/collapsing at 6+ rows"): pass `scrollable` + `maxBodyHeight` to the parent `CyberPanel` exactly as `CyberPanel.tsx`'s existing `scrollable` prop already implements (lines 111-124) — no new scroll mechanism needed.

---

### `app/components/panels/{Zones,Syzygies,Currents,Gates}Panel.tsx` (FIXED, todo 003)

**Analog / confirmed bug + confirmed fix:** `app/components/panels/ZonesPanel.tsx` (full file read above) vs. `app/components/panels/HoverInfoList.tsx`.

**The bug, verbatim** (`ZonesPanel.tsx` lines 47-66 and 81): `ZoneItemDisplay` is declared *inside* the `ZonesPanel` function body, then passed as `ItemDisplayComponent={ZoneItemDisplay}` — a new function identity every render, which `shared.tsx`'s `SelectableListPanel` (lines 82-88) renders as a **component type** (`<ItemDisplay item={item} />`), causing React to unmount+remount the row subtree on every parent re-render (including the `mousedown` that starts a click gesture — `CyberPanel.tsx` line 106's `onMouseDownCapture={() => onActivate?.(id)}` fires on every mousedown).

**The fix, verbatim** (already proven safe in this repo, `HoverInfoList.tsx` lines 49-59): use the `itemDisplay` inline-**function**-prop form, which `shared.tsx`'s `renderItem` (lines 82-85) calls as a plain function within the same reconciliation pass — never a new component boundary:
```tsx
// BEFORE (buggy, ZonesPanel.tsx line 47):
const ZoneItemDisplay = ({ item }: SelectableListDisplayProps<ZoneItem>) => ( ... )
// ...
<SelectableListPanel ItemDisplayComponent={ZoneItemDisplay} ... />

// AFTER (safe, matches HoverInfoList.tsx's own pattern):
<SelectableListPanel
  itemDisplay={({ item }) => ( /* exact same JSX body */ )}
  ...
/>
```
Apply identically to `SyzygiesPanel.tsx`, `CurrentsPanel.tsx`, `GatesPanel.tsx` (not read in full this pass, but `04-RESEARCH.md` Pitfall 1 confirms all three share the exact same inline-`ItemDisplayComponent` shape as `ZonesPanel.tsx`).

**MIG-02 fix in the same file** (`ZonesPanel.tsx` lines 39, 72): `Array.from({ length: 10 }, ...)` and `total={10}` must become `Array.from({ length: base }, ...)` / `total={base}` (or `zoneCount`), sourced from the active `Numogram`, not a literal.

---

### `app/components/ui/CyberPanel.tsx` (`collapseDirection` wiring, todo 003's dead-code half)

**Confirmed root cause** (`CyberPanel.tsx` lines 47, 54, 61-62): `collapseDirection = 'none'` is the default, `isCollapsible = collapseDirection !== 'none'`, `canToggle = isCollapsible` — since `NumogramClient.tsx` (lines 1578-1608 and siblings) never passes `collapseDirection` on any `<Panel>` (`Panel` = `CyberPanel`, aliased), `showPanelToggle` is always `false` regardless of the `open`/`onToggle` props already being threaded through. No visual-language change needed — only add `collapseDirection="vertical"` to each `<Panel ...>` call site in `NumogramClient.tsx` (Zones/Syzygies/Currents/Gates/Layers/Labels/Regions):
```tsx
// Existing call site (NumogramClient.tsx line 1578), add one prop:
<Panel id="layers" title="Layers" ... collapseDirection="vertical"
  open={layersOpen} onToggle={() => setLayersOpen(o => !o)} onDragStart={startDrag}>
```
The collapse animation itself (`maxHeight`/`opacity` transition, lines 220-226) is already fully implemented and requires no changes.

---

### `app/NumogramClient.tsx` (GENERALIZED — URL codec, history sanitation, header, digit shortcut)

**URL hydration pattern to replace** (current inline parser, lines 459-529) — hand-rolled, lenient, does not call `shareParams.ts`. New pattern routes through the extended `canonicalizeShareParams`/a new `parseShareParams` counterpart instead of the ad hoc `params.get(...)` chain shown here. Keep the lenient-per-field behavior (`04-RESEARCH.md` Open Question 1's recommendation) for every param except `base`, which gets `base`'s own strict user-visible refusal (D-06).

**`buildShareParams` pattern to extend** (lines 190-210) — the existing shape (`if (condition) params.set(key, value)`, omit-when-default) is exactly right for the new keys; add `base` (omit when 10), `labels`, `isolate`, `mute`, `packer` following the same `if` chain, then still call `sortSearchParams` (line 209) unchanged.

**History-snapshot sanitation pattern to extend** (`HistorySnapshot` type, lines 75-86; `snapshotState`/`applySnapshot`, lines 212-259): add `base` to the snapshot shape, and per UI-08/`04-RESEARCH.md` Pattern 4, clear `undoStack`/`redoStack` (lines 135-136) and region isolate/mute state on every committed base change — this is new logic (Pattern 4 in `04-RESEARCH.md`), but the snapshot object shape and `applySnapshot`'s field-by-field restore idiom (lines 233-258) are the template to extend, not replace.

**Digit-key shortcut, base-10-gate only** (lines 755-763, `04-RESEARCH.md` Pitfall 4 / Assumption A4): wrap the existing `/^[0-9]$/` branch in `if (base === 10) { ... }` — do not remove or extend it.

**MIG-02 sites confirmed in this file** (grep-verified this session): `zonesForRegion` (lines 178-184, `for (let z = 0; z <= 9; z++)`), line 421 (same loop shape, second occurrence), line 522 (`[1, 2, 4, 5, 7, 8]` Torque literal used as a URL-hydration fallback), line 581 (`for (let z = 0; z <= 9; z++) all.add(z)` — select-all), line 842 (`new Set([1, 2, 4, 5, 7, 8])` for `tcActive`), line 845 (another `<= 9` loop), line 1002-1003 (`for (let z = 0; z <= 4; z++) addConnectionVector(z, 9 - z, 0.5)`). Each must read from the active `Numogram` (`g.zoneCount`, `g.torques.flatMap(t => Array.from(t.zones()))`, `g.partner(z)`) instead of a literal.

---

### `app/components/projection/Projection.tsx` (GENERALIZED — data source, dim opacity, ARIA)

**Base-10-only imports to replace** (lines 4-14): `SYZYGIES`/`CURRENTS`/`GATE_LIST`/`ALL_DEMONS` from `app/data/*` and `REGION_CLR, TC_EDGES, TC_CURRENTS, TC_SYZYGIES` from `app/lib/constants.ts` are all base-10-fixed. `Projection.tsx` must instead receive a `Numogram` (or a base-generic derived-data bundle built from it) as a prop.

**`9 - from` / `9 - z` partner literal to replace** (line 50, `getCurrentDestZone`, and elsewhere): replace with `g.partner(from)` (`engine/core/types.ts` line 45's `partner(zone: number): number`).

**Existing dim-opacity values to REUSE, not reinvent** (lines 48, 151, 176, 267, 280, 475, 527, 852 — `anyFocus`/`dimOpacity` pattern): the isolate (spotlight) behavior in UI-SPEC's Region Legend Contract explicitly says to reuse these exact numbers (`dimOpacity = isPlanetary ? 0.03 : 0.08`, the `anyFocus ? dimOpacity : ...` ternary chain) rather than inventing new dim levels:
```typescript
// Source: Projection.tsx line 48 and its use at lines 176, 280
const dimOpacity = isPlanetary ? 0.03 : 0.08
const opacity = fullHl ? 0.8 : anyFocus ? dimOpacity : (isPlanetary ? 0.25 : 0.5)
```

**ARIA/keyboard: zero existing precedent** — confirmed no `tabIndex`/`role`/`aria-*` anywhere in this file (grep-verified this session, matches `04-RESEARCH.md`'s own claim). Build from `04-RESEARCH.md` Pattern 3 (roving-tabindex) as the spec; there is no in-repo analog to copy for this specific piece.

---

### `app/lib/numogram.ts` (`plexExpr` fix)

**Analog:** `engine/core/numerals.ts`'s `digitsOf` (lines 52-64) — the correct in-base digit-sum primitive.

**Current decimal-only bug** (`numogram.ts` lines 7-24): `String(current).split('').map(d => Number(d))` is a decimal digit split regardless of the numogram's actual base.

**Fix pattern:**
```typescript
import { digitsOf } from '../../engine/core/numerals'
export function plexExpr(cum: number, base: number): string | null {
  if (cum < base) return null
  let current = cum
  let expr = ''
  let first = true
  while (current >= base) {
    const digits = digitsOf(current, base)   // in-base digits, not decimal
    const sum = digits.reduce((acc, d) => acc + d, 0)
    expr = first ? `${digits.join('+')}=${sum}` : `${expr}=${sum}`
    first = false
    current = sum
  }
  return expr
}
```
Must agree exactly with `GateInfo.to`'s own digital-root algorithm (already engine-computed and pinned by the frozen base-10 oracle) — do not let the two diverge.

---

### `app/lib/xenotation.ts` (`xenotationByZone` generalization)

**Current base-10-hard-coded wrapper** (lines 176-182): `for (let z = 0; z <= 9; z++)`. The underlying `formatXenotationForDisplay`/`xenotateNumber`/`factorInteger` (lines 82-174) are already pure number theory, base-agnostic — do not touch them.

**Fix pattern:**
```typescript
export function xenotationByZone(zoneCount: number): Record<number, string> {
  const out: Record<number, string> = {}
  for (let z = 0; z < zoneCount; z++) {
    out[z] = formatXenotationForDisplay(z)
  }
  return out
}
```

---

### `app/lib/geometry.ts` (partner parameter)

**Current hard-coded partner** (lines 8, 40): `9 - zone` appears in `syzMidBiased` and `syzTrianglePoints`. Both functions already take a `pos: Record<number, Pos>` parameter (base-agnostic in shape) — add a `partner: number` parameter at the call site instead of computing it inline:
```typescript
// BEFORE: export function syzMidBiased(zone: number, pos: Record<number, Pos>): Pos {
//           const a = pos[zone], b = pos[9 - zone]
// AFTER:
export function syzMidBiased(zone: number, partner: number, pos: Record<number, Pos>): Pos {
  const a = pos[zone], b = pos[partner]
  ...
}
// Call site (Projection.tsx or wherever): syzMidBiased(zone, g.partner(zone), pos)
```

---

### `app/hooks/useTween.ts` (GENERALIZED)

**Analog:** `engine/layout/tween.ts`'s `lerpPositions` (lines 16-40) — already base-generic (`Float64Array` sized to `from.base`), already throws `RangeError` on a base mismatch (guards against feeding it two different bases mid-tween, per UI-08).

**Current base-10-only shape to replace** (`useTween.ts` lines 3, 12-17, 37-42, 48): hard-coded `P_ORIGINAL`/`P_LABYRINTH`/`P_LADDER` position records as the only tween sources, `for (let z = 0; z <= 9; z++)` interpolation loop, literal frame heights (`940`/`880`/`870`/`800`). Port the loop to call `lerpPositions(from, to, t, outX, outY)` instead of the manual per-zone `Record<number, Pos>` loop, and source `from`/`to` from `resolveLayout(g, layoutId)` (`engine/layout/registry.ts`) rather than the fixed position tables — this file is the single largest "must become base-generic" hook target per `04-RESEARCH.md`.

**Reduced-motion gate to add** (Pitfall 3, no existing precedent — `app/globals.css`'s `@media (prefers-reduced-motion: reduce)` is CSS-only and does not reach `requestAnimationFrame`):
```typescript
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
// In switchLayout / the animate() rAF loop: if prefersReducedMotion(), setTweenProgress(1) immediately, skip the rAF loop entirely.
```

---

### `app/hooks/useOrbitalAnimation.ts` (reduced-motion gate only — NOT generalized to other bases, stays base-10-only per Phase 3 D-05)

Same `matchMedia('(prefers-reduced-motion: reduce)')` gate as `useTween.ts` above, applied to the `animate` rAF loop (lines 21-40): short-circuit to a static final angle when the media query matches, mirroring `tweenAllowed(n, table)`'s instant-switch precedent from Phase 3.

---

### `app/data/types.ts` (`Region` type) + `app/lib/constants.ts` (`REGION_CLR`)

**Analog:** `engine/core/types.ts`'s `Cycle`/`RegionKind` (lines 7, 10-21) already provide the correct base-agnostic shape — `RegionKind = 'plex' | 'warp' | 'torque'` plus `Cycle.torqueIndex`/`Cycle.id` for per-cycle identity. The app-layer `Region = 'torque' | 'warp' | 'plex'` union (a single-cycle assumption) should be replaced by a `RegionId` string type built on these (`` `torque:${number}` | 'plex' | 'warp' ``, exact shape given in `04-RESEARCH.md` Priority 4 and locked visually in `04-UI-SPEC.md`'s Data-Identity Palette section).

**`REGION_CLR` generalization pattern:** `app/lib/constants.ts` (lines 7-11) is a `Record<Region, string>` — becomes a `Record<RegionKind, string>` (3 entries, unchanged values: `torque: '#00ccff'`, `warp: '#44cc77'`, `plex: '#aa6633'`) per UI-SPEC's **locked** decision that all Torque cycles share one color family (no N-color scale). `LayersPanel.tsx`'s `LAYER_DEFS` (lines 14-23) is the closest existing precedent for a small `kind -> {label, color, info}` array feeding `HoverInfoList` — same shape applies to the new `regionRows(g)` generator.

---

### `scripts/check-repo.mjs` (new MIG-02 grep gate)

**Analog:** the file's own established pattern — pure functions taking text/file-list input and returning a `string[]` of problems, zero dependencies (`findTrackedJunk`, lines 70-74; `licenseProblems`, lines 89-95; `workflowProblems`, lines 115-120+).

**Pattern to copy:**
```javascript
/**
 * Hard-coded base-10 zone-count patterns outside the intentionally-base-10 app/presets/base10/** and
 * app/lib/planetary.ts / app/hooks/useOrbitalAnimation.ts (Phase 3 D-05: planetary stays base-10-only).
 * @param {{path: string, text: string}[]} files
 * @returns {string[]}
 */
export function findHardcodedBaseTen(files) {
  const problems = []
  const patterns = [/\bz\s*<=\s*9\b/, /\[1,\s*2,\s*4,\s*5,\s*7,\s*8\]/, /\bn\s*<=\s*9\b/, /\b9\s*-\s*(z|zone|from)\b/]
  for (const { path: p, text } of files) {
    if (p.startsWith('app/presets/base10/') || p === 'app/lib/planetary.ts' || p === 'app/hooks/useOrbitalAnimation.ts') continue
    for (const re of patterns) {
      if (re.test(text)) problems.push(`${p}: matches hard-coded base-10 pattern ${re}`)
    }
  }
  return problems
}
```
Wire into the same `--only` flag list and default-checks array the file already maintains (see `MANIFESTS`/`LORE_FILES`-style exported constants near the top of the file, lines 19-38) — one new named check alongside the existing twelve, not a separate script.

---

### `?base=`/`labels=`/`isolate=`/`mute=`/`packer=` (URL codec extension inside `app/lib/shareParams.ts`)

**Analog:** the file's own `ALLOWED_LAYOUTS`/`ALLOWED_LAYERS`/`ALLOWED_REGIONS` Set-based allow-list pattern (lines 16-18) plus its per-field `if (raw.has(key)) { ...validate...; params.key = value }` blocks (lines 118-168) and the single `fail()` throw helper (lines 95-97).

**Pattern to extend (new `base` field, omit-when-10 per UI-02 back-compat):**
```typescript
// New import needed: import { validateBase } from '../../engine/core/base'
if (raw.has('base')) {
  const n = Number(raw.get('base'))
  const check = validateBase(n)
  if (!check.ok) fail(`Invalid base value: ${check.message}`)
  if (check.base !== 10) params.base = String(check.base)   // omit when 10 — matches existing "omit layout=original" convention
}
```
**New `isolate=`/`mute=` fields** (comma-separated `RegionId` lists, D-21/A3's lenient-per-field recommendation — do NOT `fail()` the whole URL on one bad id, unlike the strict pattern above for `base`):
```typescript
if (raw.has('isolate')) {
  const ids = parseCsvTokens(raw.get('isolate') || '').filter(id => isKnownRegionId(id, currentBase))
  if (ids.length > 0) params.isolate = ids.sort().join(',')
}
```
Reuse `parseCsvTokens` (already exported-shape at lines 72-74) verbatim.

---

## Shared Patterns

### Pure, typed-reason validation (`{ ok: true, value } | { ok: false, reason, message }`)
**Source:** `engine/core/base.ts` lines 9-12, 31-49 (`BaseCheck`/`validateBase`/`problem()`)
**Apply to:** `app/lib/customAlphabet.ts` (new), and any other new validator this phase introduces. Never throw from a validator that a live-typing UI calls on every keystroke — return a typed result instead, exactly as `validateBase` already does.

### Allow-list URL param codec with one `fail()` throw
**Source:** `app/lib/shareParams.ts` lines 16-18, 95-186 (`ALLOWED_*` Sets, `fail()`, per-field `if (raw.has(...))` blocks)
**Apply to:** every new URL param this phase adds (`base`, `labels`, `isolate`, `mute`, `packer`). Keep `base` strict (`fail()`-worthy per D-06/UI-02), keep every other new field lenient (drop-on-invalid, per `04-RESEARCH.md` Open Question 1's resolution) — this is a deliberate split within one shared pattern, not an inconsistency.

### `itemDisplay` inline-function-prop (never `ItemDisplayComponent`)
**Source:** `app/components/panels/HoverInfoList.tsx` lines 49-59 (safe) vs. `app/components/panels/ZonesPanel.tsx` lines 47-81 (buggy, todo 003's confirmed root cause)
**Apply to:** the generalized `RegionsPanel.tsx` and the four fixed panels (Zones/Syzygies/Currents/Gates). This is the single most safety-critical shared pattern in this phase — any new per-row-component panel that does NOT use the `itemDisplay` function-prop form reintroduces a confirmed, testable regression.

### Reuse engine-measured dim-opacity values for isolate/spotlight
**Source:** `app/components/projection/Projection.tsx` line 48 (`dimOpacity`) and its use at lines 176, 280, 527
**Apply to:** the region legend's isolate (D-19) behavior in `Projection.tsx` — do not invent new opacity constants for the spotlight effect.

### Debounced candidate state -> pure validator -> committed state (never block on the validator)
**Source:** `04-RESEARCH.md` Pattern 1, built on `engine/core/base.ts`'s `validateBase`
**Apply to:** `BasePicker.tsx`'s numeric field/slider/stepper (D-04) — optimistic local text state updates immediately, a 200ms-debounced effect calls the pure validator and only then commits to the real `base` state that drives `createNumogram`.

### `CyberPanel`'s `collapseDirection` prop (already fully implemented, never wired)
**Source:** `app/components/ui/CyberPanel.tsx` lines 47, 54, 61-227 (the entire collapse animation)
**Apply to:** every `<Panel>` call site in `app/NumogramClient.tsx` (Layers/Labels/Zones/Syzygies/Currents/Gates/Regions) — add `collapseDirection="vertical"`, no other change needed to make the existing `open`/`onToggle` props finally functional (resolves todo 003's dead-code half).

### NumogramIcons.tsx hand-authored SVG icon convention
**Source:** `app/components/numogram/NumogramIcons.tsx` (whole file; `OriginalIcon`/`LadderIcon` lines 9-23, 34-47 as clearest templates)
**Apply to:** every new icon this phase needs (base-picker steppers, isolate, mute, copy, packer) — viewBox `0 0 24 24`, rendered 18x18, stroke-only `strokeWidth 1.1-1.2`, `strokeLinecap round`, accent dot at `opacity 0.6`, a `clr` prop. Do not introduce a new icon library or a different visual convention (UI-SPEC's Design System section makes this explicit).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/lib/glyphCoverage.ts` | utility | transform | First consumer of `document.fonts`/Canvas 2D glyph-measurement in this repo — no existing browser-API-heuristic module to pattern-match. Use `04-RESEARCH.md` Priority 1's cited algorithm (canvas width/pixel comparison vs. a Private-Use-Area reference glyph) as the spec directly. |
| Roving-tabindex keyboard traversal in `Projection.tsx` | component behavior | event-driven | Zero existing `tabIndex`/`role`/`aria-*` anywhere in the diagram (grep-verified this session) — `04-RESEARCH.md` Pattern 3 (W3C SVG-AAM-cited) is the spec to build from, not an in-repo pattern to copy. |

## Metadata

**Analog search scope:** `app/components/**`, `app/lib/**`, `app/hooks/**`, `app/data/types.ts`, `app/NumogramClient.tsx`, `engine/core/**`, `engine/layout/**`, `engine/scene/**`, `scripts/check-repo.mjs` — all read directly this session (not assumed from `04-RESEARCH.md` alone, though `04-RESEARCH.md`'s verified line numbers were used to target reads efficiently).
**Files scanned/read in full or by targeted range:** 27
**Pattern extraction date:** 2026-09-28

# Phase 6: Canvas Tier and Worker - Pattern Map

**Mapped:** 2026-10-05
**Files analyzed:** 52 new/modified (11 new pure modules and one worker shell, 2 new component trees, 14 modified source files, 9 new unit-test files, 6 modified/extended unit tests, 3 new e2e specs, 7 modified/extended e2e files, 2 data/config files)
**Analogs found:** 51 / 52 (only `workers/numogram.worker.ts` has no in-repo analog; four technique-level gaps with only partial analogs are listed under "No Analog Found")

Conventions used below: `file:line` ranges were read this session. "Frozen" means the file is an oracle and must not change. Names of new files that RESEARCH.md calls "the planner's call" are used as given in RESEARCH.md "Recommended Project Structure".

## File Classification

### Engine and data (pure, relative imports only)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/scene/canvasScene.ts` (new) | utility (scene builder) | transform (g + layout + routes to typed arrays) | `engine/scene/svgString.ts` | exact (same inputs, other output form) |
| `engine/scene/index.ts` (modified, barrel) | config (barrel) | n/a | itself (lines 4-37) | exact |
| `engine/scene/tiers.ts` (modified: `interactiveMaxN`, `selectTier`, validator) | model + utility | transform | itself (lines 83-135, 339-359, 408-451) | exact |
| `engine/scene/tier-table.json` (modified: one new field) | config (data) | n/a | itself (lines 4311-4337) | exact |
| `scripts/spike/shape.ts` (modified: carry the field forward) | utility (script) | transform | itself (lines 184-232) | exact |
| `engine/test/scene.canvasScene.test.ts` (new) | test | n/a | `engine/test/layout.routing.test.ts` + `engine/test/scene.svgString.test.ts` | role-match |
| `engine/test/tiers.select.test.ts`, `engine/test/tiers.schema.test.ts`, `tests/spike/shape.test.ts` (extended) | test | n/a | themselves | exact |

### App libs (pure, unit-testable in the node environment)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/tierBounds.ts` (modified: `INTERACTIVE_MAX_N` and friends) | utility | request-response (property read) | itself (lines 1-38) | exact |
| `app/lib/summary.ts` or similar (new; `summarize` moves out of `numogramView.ts`, re-exported) | utility | transform | `app/lib/numogramView.ts` lines 20-85 | exact (move) |
| `app/lib/worker/protocol.ts` (new) | model (message types, guards) | request-response | `app/lib/basePicker.ts` lines 21-28 (`CandidateResult` union) + `app/lib/demonState.ts` guards | role-match |
| `app/lib/worker/buildResult.ts` (new, pure core) | service | transform (batch) | `app/NumogramClient.tsx` lines 199-205, 1195-1207 (the code it replaces) + `app/lib/renderData.ts` | role-match |
| `app/lib/worker/workerClient.ts` (new) | service | event-driven (latest-wins) | `app/components/demons/DemonMatrix.tsx` generation counter (lines 90, 182-188, 206-208) | partial-match |
| `app/lib/worker/useNumogramWorker.ts` (new) | hook | event-driven | `app/hooks/useReducedMotion.ts` (thin hook) + `app/hooks/useLayoutTween.ts` | role-match |
| `workers/numogram.worker.ts` (new) | worker shell | request-response | none in repo (RESEARCH.md "Worker shell") | no analog |
| `app/lib/canvas/viewTransform.ts` (new) | utility | transform (fit, zoom, pan, DPR) | `app/lib/demonMatrix.ts` lines 5-138 | exact |
| `app/lib/canvas/pickIndex.ts` (new) | utility | transform (spatial query) | `app/lib/demonMatrix.ts` `cellAtPixel` lines 80-90 | partial-match |
| `app/lib/canvas/keyboardModel.ts` (new) | utility | transform (state, key to target + announcement) | `app/lib/demonMatrix.ts` `stepCursor` lines 104-119 + `Projection.tsx` lines 115-206 | role-match |
| `app/lib/canvas/interaction.ts` (new, pointer reducer) | utility | event-driven | `app/components/demons/DemonMatrix.tsx` lines 249-354 | role-match (logic is inline in the component today) |
| `app/lib/canvas/draw.ts` (new, injected 2D ctx) | utility | transform (scene to draw calls) | `app/components/projection/Projection.tsx` (palette, opacity, widths) | role-match |
| `app/lib/numogramText.ts` (modified: `bigBaseMessage`, limit) | utility | transform | itself (lines 10-15, 29-80) | exact |
| `app/lib/shareParams.ts` (modified: main-thread `createNumogram` at line 193) | utility | transform | itself (lines 186-197) | exact |

### Components

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/components/canvas/CanvasDiagram.tsx` (new, DOM shell) | component | event-driven + streaming redraw | `app/components/demons/DemonMatrix.tsx` | exact (canvas + role=application + tooltip + live region) |
| `app/components/numogram/ViewContext.tsx` (modified: `tier`, `interactiveMaxN`) | provider | n/a | itself (lines 9-22) | exact |
| `app/components/numogram/BigBaseSummary.tsx` (modified) | component | request-response | itself (lines 21-47) | exact |
| `app/components/numogram/BasePicker.tsx` (modified: requested base, status, sr-only status) | component | event-driven | itself (lines 29-101, 247-278) | exact |
| `app/components/panels/shared.tsx` `PanelUnavailable` + Zones/Syzygies/Currents/Gates panels (modified) | component | request-response | `ZonesPanel.tsx` lines 24-39 | exact |
| `app/components/panels/LayersPanel.tsx` (modified: gates info, Particles N/A) | component | request-response | itself (lines 32-84) | exact |
| `app/components/numogram/ShortcutsModal.tsx` (modified: one line, qualify one) | component | n/a | itself (lines 41-50) | exact |
| `app/components/demons/DemonsOverlay.tsx`, `DemonFocusView.tsx` (modified: `showDiagram` meaning) | component | n/a | themselves | exact |
| `app/NumogramClient.tsx` (modified: tier branch, worker request, canvas branch) | component (page controller) | event-driven / state orchestration | itself (lines 145-262, 357-392, 603-660, 1313-1403) | exact |

### Tests and e2e

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/app/canvasView.test.ts` (new) | test | n/a | `tests/app/demonMatrix.test.ts` | exact |
| `tests/app/canvasPick.test.ts` (new) | test | n/a | `tests/app/demonMatrix.test.ts` (fast-check, exact resolve) | exact |
| `tests/app/canvasKeyboard.test.ts`, `tests/app/canvasInteraction.test.ts` (new) | test | n/a | `tests/app/demonMatrix.test.ts` + `tests/app/baseSwitch.test.ts` | role-match |
| `tests/app/canvasDraw.test.ts` (new) | test | n/a | none for draw calls; `tests/app/projectionRender.test.ts` for the NaN scan | partial-match |
| `tests/app/canvasDiagramRender.test.ts`, `tests/app/bigBaseSummary.test.ts` (new) | test (SSR smoke) | n/a | `tests/app/demonMatrixRender.test.ts` | exact |
| `tests/app/workerCore.test.ts`, `tests/app/workerClient.test.ts` (new) | test | n/a | `tests/app/demonState.test.ts` | role-match |
| `tests/app/numogramText.test.ts`, `tests/app/tierBounds.test.ts` (rewritten/extended) | test | n/a | themselves | exact |
| `tests/app/demon{Browser,Focus,Matrix,RowList}Render.test.ts`, `demonsOverlayRender.test.ts` (touched only if the context type gains required fields) | test | n/a | themselves | exact |
| `e2e/viewer-helpers.ts` (modified: Canvas-aware wait) | test helper | n/a | itself (lines 47-60) | exact |
| `e2e/canvas-tier.spec.ts`, `e2e/canvas-interaction.spec.ts`, `e2e/worker.spec.ts` (new) | test (e2e) | n/a | `e2e/demons-matrix.spec.ts` + `e2e/accessibility.spec.ts` + `e2e/hover-pin.spec.ts` | role-match |
| `e2e/static-export.spec.ts` (extended; also runs under `/ccrug`) | test (e2e) | n/a | itself (lines 1-33) | exact |
| `e2e/url-codec.spec.ts`, `base-picker.spec.ts`, `demons-browser.spec.ts`, `demons-focus.spec.ts`, `demons-matrix.spec.ts` (rewritten assertions) | test (e2e) | n/a | themselves | exact |
| `perf/page-weight.baseline.json` (updated through the script only) | config | n/a | Phase 4 and 5 precedent: `node scripts/page-weight.mjs update --reason "..."` | exact |
| `next.config.js` (no change expected) | config | n/a | already lists `workers` (line 12) | exact |

---

## Pattern Assignments

### `engine/scene/canvasScene.ts` (utility, transform) [RESEARCH recommends it live in the engine, for reuse by the Phase 8 CLI]

**Analog:** `engine/scene/svgString.ts`: same inputs (`g`, `Layout`, optionally supplied `GateRoutes` / `CurrentRoutes`), per-layer loops over zones and pairs, trust-boundary header comment, relative imports only.

**Imports pattern** (`svgString.ts` lines 11-16):
```typescript
import { formatGateName, formatNetSpan, formatNumeral } from '../core/numerals'
import type { Numogram, RegionKind } from '../core/types'
import { fmt } from '../layout/format'
import { routePairGraph } from '../layout/pairgraph'
import { routeCurrents, routeGates } from '../layout/routing'
import type { CurrentRoutes, GateRoutes, Layout, PairGraphLayout, RegionLabel } from '../layout/types'
```
The engine ESLint override (`.eslintrc.json`) forbids non-relative imports, `window`/`document`/`navigator`/`process`/`fetch`, `Math.random`, `Date.now`, `new Date()`. Typed arrays (`Float64Array`, `Int32Array`, `Uint8Array`) are fine; `Path2D` and `HTMLCanvas*` are not (they are DOM): the scene returns numbers, the main thread builds `Path2D`.

**Core pattern: syzygy endpoints with per-node radius** (`svgString.ts` lines 192-214), copy this exact geometry (including the `dist <= 2 * r` straight-line case) for the syzygy segment arrays:
```typescript
for (let q = 0; q < P; q++) {
  const info = g.pair(q)
  const x1 = layout.x[info.lo] ?? 0
  const y1 = layout.y[info.lo] ?? 0
  const x2 = layout.x[info.hi] ?? 0
  const y2 = layout.y[info.hi] ?? 0
  const rLo = layout.nodeRadii?.[info.lo] ?? r
  const rHi = layout.nodeRadii?.[info.hi] ?? r
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)
  if (dist <= 2 * r) {
    // straight line between centres
  } else {
    const ux = dx / dist
    const uy = dy / dist
    const sx = x1 + ux * rLo
    const sy = y1 + uy * rLo
    const ex = x2 - ux * rHi
    const ey = y2 - uy * rHi
  }
}
```

**Route inputs: only `M`, `L`, `Q` for zone layouts** (`engine/layout/routing.ts` lines 19-32). The in-worker parser may therefore be exact for zone layouts; `routePairGraph` strings contain `A` arcs and go through `new Path2D(d)` instead (RESEARCH P14):
```typescript
function quad(fx: number, fy: number, tx: number, ty: number, bulge: number): string {
  if (Math.abs(bulge) < 0.5) return 'M' + pt(fx, fy) + 'L' + pt(tx, ty)
  // ...
  return 'M' + pt(fx, fy) + 'Q' + pt(cx, cy) + ' ' + pt(tx, ty)
}
```
Route containers to read (typed arrays already, `engine/layout/types.ts` lines 93-113): `GateRoutes { d, labelX, labelY, loop: Uint8Array, to: Int32Array, orientation, maxInDegree }`, `CurrentRoutes { kind: Uint8Array, legA, legB, stem, junctionX, junctionY, orientation }`, `PairGraphRoutes { arc, loop }` (both `(string | null)[]`).

**Identity rule (RESEARCH Pattern 4):** key edges by pair id `q` and zone `z`, never by view-array index. `buildStructuralSyzygies` lists pairs in descending id (`numogramView.ts` lines 157-164); `buildStructuralCurrents` lists Torque pairs in flow order, then Warp, then Plex (lines 144-155, 166-173); gates are by origin zone (lines 175-182). The main thread joins ids to view entries the way `engineRenderData` does (`app/lib/renderData.ts` lines 51-61): `const q = g.pairOf(c.from)`.

**Barrel:** add the export to `engine/scene/index.ts` next to `layoutToSvg` (line 4); engine tests import from `../scene/...` directly (`scene.svgString.test.ts` line 11), the app imports from `../../engine/index`.

---

### `engine/scene/tiers.ts` + `tier-table.json` + `scripts/spike/shape.ts` (shipped-ceiling datum `boundaries.interactiveMaxN`)

**Analog:** the file itself. Add one `Boundary` field, make it optional in the type (so existing synthetic tables in tests keep their meaning), require it for a measured table.

**Type and selection** (`tiers.ts` lines 83-100, 129-135), extend, do not rewrite:
```typescript
export interface Boundary {
  readonly n: number
  readonly basedOn: DeviceProfile
  readonly rule: string
}
export interface TierBoundaries {
  readonly svgRichMaxN: Boundary
  readonly svgLeanMaxN: Boundary
  readonly canvasMaxN: Boundary | null // null = no ceiling found in the measured range
  // ...
}
export function selectTier(n: number, table: Pick<TierTable, 'boundaries'>, override?: RenderTier): RenderTier {
  if (override !== undefined) return override
  if (n <= table.boundaries.svgRichMaxN.n) return 'svg'
  const canvasMax = table.boundaries.canvasMaxN
  if (canvasMax === null || n <= canvasMax.n) return 'canvas'
  return 'headless'
}
```
Target shape (RESEARCH "Shipped-ceiling selection"): ceiling = `Math.min(canvasMaxN?.n ?? Infinity, interactiveMaxN?.n ?? Infinity)`; `n <= ceiling` is `canvas`.

**Validator idiom, one `if` per rule, specific message** (`tiers.ts` lines 339-352 and 357-359). Add `['interactiveMaxN', t.boundaries.interactiveMaxN ?? null]` to the `namedBoundaries` loop (that gives the `basedOn === shippedProfile` and integer/non-empty-rule rules for free) and mirror the line-357 comparison:
```typescript
const namedBoundaries: ReadonlyArray<readonly [string, Boundary | null]> = [
  ['svgRichMaxN', t.boundaries.svgRichMaxN],
  ['svgLeanMaxN', t.boundaries.svgLeanMaxN],
  ['canvasMaxN', t.boundaries.canvasMaxN],
  ['layoutTweenMaxN', t.boundaries.layoutTweenMaxN],
]
for (const [name, b] of namedBoundaries) {
  if (b === null) continue
  if (b.basedOn !== t.shippedProfile) {
    problems.push(`boundary ${name} basedOn ${b.basedOn} differs from shippedProfile ${t.shippedProfile}`)
  }
  if (!Number.isInteger(b.n) || b.n < 0) problems.push(`boundary ${name}.n must be a non-negative integer`)
  if (!isNonEmptyString(b.rule)) problems.push(`boundary ${name}.rule must be non-empty`)
}
// ...
if (t.boundaries.canvasMaxN !== null && t.boundaries.canvasMaxN.n < t.boundaries.svgRichMaxN.n) {
  problems.push(`boundary canvasMaxN (${t.boundaries.canvasMaxN.n}) is below svgRichMaxN (${t.boundaries.svgRichMaxN.n})`)
}
```
Measured-only rules go inside the existing `if (t.status === 'measured')` block (lines 408-451) beside the `derived` comparisons; `derived.maxMeasuredN` already exists (line 172, computed at 230-231). Leave the `canvasMaxN` equality rule (lines 438-441) untouched.

**Data** (`tier-table.json` lines 4311-4337): insert the new field after `layoutTweenMaxN` (line 4323-4327), same object shape as its siblings:
```json
"layoutTweenMaxN": {
  "n": 28,
  "basedOn": "sw-6x",
  "rule": "highest n of the longest passing prefix of sw-6x tween frames (svg-rich up to svgRichMaxN, canvas above) with median <= 32 ms"
},
```
The file must stay LF-only with a final newline and parse equal to `TIER_TABLE` (`engine/test/tiers.schema.test.ts` lines 76-81). Do not touch the 144 measurement rows, the derived boundaries or `webglDecision`.

**`scripts/spike/shape.ts` carry-forward** (lines 221-232): `boundaries` is built field by field, so a re-measure would silently drop the new field. Follow the `labelVisibleMinRadiusPx` line:
```typescript
const boundaries: TierBoundaries = {
  svgRichMaxN,
  svgLeanMaxN,
  canvasMaxN,
  layoutTweenMaxN,
  allChordsMaxN,
  labelVisibleMinRadiusPx: previous.boundaries.labelVisibleMinRadiusPx,
  gatesFullMaxN: previous.boundaries.gatesFullMaxN,
  gatesThinMaxN: previous.boundaries.gatesThinMaxN,
  canvasAreaLimitPx: d.canvasAreaLimitPx,
  canvasDimensionNote,
}
```

> **Integration hazard (found while mapping):** `tests/spike/shape.test.ts` builds a synthetic measured run whose canvas rows reuse the svg-rich `n` values (10, 28, 64, 100; lines 46-51, 94-98), so `derived.maxMeasuredN` there is 100 and its `svgRichMaxN` is 64. `baseInput()` passes `previous: TIER_TABLE` (line 138). Carrying `interactiveMaxN.n = 4000` forward unchanged would violate the rule "interactiveMaxN.n <= derived.maxMeasuredN" and break `expect(validateTierTable(table)).toEqual([])` (line 172). The plan must decide between clamping the carried value to `min(previous, d.maxMeasuredN)` in `shape.ts` (and asserting that in the shape test) or loosening the validator rule; pick one explicitly and extend `shape.test.ts` lines 223-229 (the "carries ... over from the previous table unchanged" test) accordingly.

**Tests to extend (do not weaken):**
- `engine/test/tiers.select.test.ts`: the local `makeTable()` factory (lines 66-106) is the pattern; boundaries at 200, 202, ceiling, ceiling + 2 follow the existing `selectTier` cases (lines 142-157). Use the factory's `makeBoundary(n)` (line 51), never a literal 4000 from the shipped table.
- `engine/test/tiers.schema.test.ts`: add mutation tests with `brokenCopy(...)` (lines 16-20) and `hasProblemStartingWith(...)` (lines 22-24), shape of the existing ones (lines 91-96):
```typescript
it('a boundary basedOn a different profile than shippedProfile', () => {
  const broken = brokenCopy(t => {
    ;(t.boundaries.svgRichMaxN as { basedOn: string }).basedOn = 'gpu'
  })
  expect(hasProblemStartingWith(validateTierTable(broken), 'boundary svgRichMaxN basedOn gpu')).toBe(true)
})
```
- `tests/app/tierBounds.test.ts`: read the number through the table like lines 22-26 (`expect(SVG_RICH_MAX_N).toBe(TIER_TABLE.boundaries.svgRichMaxN.n)`), add `INTERACTIVE_MAX_N` the same way plus `tierFor(INTERACTIVE_MAX_N)` is canvas and `tierFor(INTERACTIVE_MAX_N + 2)` is headless.

---

### `app/lib/tierBounds.ts` (modified)

**Analog:** itself. Property access on `boundaries` only, never the whole JSON (keeps measurement rows out of the viewer bundle):
```typescript
import tierTableJson from '../../engine/scene/tier-table.json'
import { gateLayerMode, labelsVisible, parseTierOverride, selectTier, tweenAllowed, type RenderTier, type TierTable } from '../../engine/index'

export const TIER_VIEW: Pick<TierTable, 'boundaries' | 'tierOverrideParam'> = {
  boundaries: tierTableJson.boundaries as unknown as TierTable['boundaries'],
  tierOverrideParam: tierTableJson.tierOverrideParam as unknown as TierTable['tierOverrideParam'],
}

export const SVG_RICH_MAX_N: number = TIER_VIEW.boundaries.svgRichMaxN.n
export const ALL_CHORDS_MAX_N: number = TIER_VIEW.boundaries.allChordsMaxN.n
```
Add `INTERACTIVE_MAX_N` and, if needed, `CANVAS_AREA_LIMIT_PX` / `LABEL_MIN_RADIUS_PX` in this same style. `labelsShown(onScreenRadiusPx)` (lines 30-33) and `gateMode(n)` (lines 35-38) already exist and are what the Canvas draw module must call; `mayTween(n)` (lines 25-28) stays the layout-tween gate.

---

### `app/lib/worker/buildResult.ts` (service, pure core shared by the worker and the main-thread fallback)

**Analog:** the main-thread code it replaces, `app/NumogramClient.tsx` lines 199-205 and 1195-1207, plus `app/lib/numogramView.ts` `summarize` and `app/lib/numogramText.ts` `numogramText`.

**Today's inline computation** (`NumogramClient.tsx` lines 199-205, 1197-1207): the request handler must reproduce exactly these outputs for the same `(base, labelScheme)`, which is also the unit-test oracle (`summary` equals `summarize(g)`, `text` equals `numogramText(g, zoneLabel)`):
```typescript
const g = useMemo(() => createNumogram(base), [base])
const summary = useMemo(() => summarize(g), [g])
// ...
const bigBaseText = useMemo(
  () => (showDiagram ? '' : numogramText(g, z => formatZoneLabel(z, base, labelScheme))),
  [showDiagram, g, base, labelScheme],
)
```

**Input re-validation in the worker** (`engine/core/base.ts` lines 51-55): the worker is a trust boundary for `base`; use `assertBase` (exported from `engine/index.ts` line 4) and convert the throw into an `{ type: 'error' }` response (the shell must never throw):
```typescript
export function assertBase(n: unknown): asserts n is number {
  const check = validateBase(n)
  if (!check.ok) throw new RangeError(check.message)
}
```

**Layout for the scene** (`app/lib/viewLayouts.ts` lines 108-150, 158-166): reuse `layoutTarget`'s call shape (`resolveLayout(g, id, [], { packer })` and `pairGraphLayout(g, { packer })`) and its key format `${g.base}:${id}:${packer}` for the response `key`; do not call `layoutTarget` itself in the worker if it drags in `app/presets/base10/*` (RESEARCH P11, the worker chunk must stay lore-free).

**P11 dependency (do this first):** `numogramText.ts` line 4 imports `summarize` from `./numogramView`, which imports `app/presets/base10/*` (lines 6-11). Move `SUMMARY_TORQUE_LIMIT`, `NumogramSummary` (lines 20-30) and `summarize` (lines 65-85) to a lore-free module and re-export them from `numogramView.ts`, so these existing importers keep working unchanged: `app/lib/numogramText.ts:4`, `app/NumogramClient.tsx:16`, `app/components/numogram/BasePicker.tsx:24` (type), `app/components/numogram/BigBaseSummary.tsx:9` (type), `tests/app/demonMatrixRender.test.ts:10`.

**Lore-free label formatting:** `app/lib/labelScheme.ts` imports only engine, customAlphabet, xenotation (lines 3-12), so `formatZoneLabel` and `zoneLabelsFor` (lines 35-61) are safe in the worker.

**Guards** (RESEARCH Pattern 2): build the scene only when `base <= interactiveMaxN` (a `wantScene` request at 2^26 returns `scene: null`), give every output array its own buffer and list each `.buffer` in the transfer list exactly once (P15).

---

### `app/lib/worker/workerClient.ts` (service, latest-wins)

**Analog:** `app/components/demons/DemonMatrix.tsx`'s generation counter, the repo's only existing "a superseded job must never keep painting" implementation (lines 90, 182-188, 206-208):
```typescript
const genRef = useRef(0)
// ...
const gen = ++genRef.current
setRasterState('drawing')
// ...
function slice(): void {
  if (genRef.current !== gen) return      // a stale job stops here
  // ...
}
// effect cleanup:
return () => {
  genRef.current++
}
```
`WorkerClient.request` is this pattern with the counter moved into a class: `const id = ++this.latestId`, a response applies only when `resp.id === this.latestId`, and a synchronous (SVG-tier) commit calls `supersede()` which does `this.latestId++` (RESEARCH P2). Full skeleton: RESEARCH.md "Latest-wins client skeleton". Constructor takes an injected `makeWorker: () => WorkerLike | null` so the unit test (`tests/app/workerClient.test.ts`) uses a fake worker that replies out of order.

**The only place `new Worker` may appear** (RESEARCH "Worker factory", verified under Next 14.2.35 export at root and `/ccrug`):
```typescript
export const createNumogramWorker = (): Worker =>
  new Worker(new URL('../../../workers/numogram.worker.ts', import.meta.url))   // literal only; no options, no variable
```
Create the worker lazily at the first request (not in an effect: StrictMode double-spawn, P17); keep one long-lived worker (a respawn while offline fails).

### `app/lib/worker/useNumogramWorker.ts` (hook)

**Analog:** `app/hooks/useReducedMotion.ts`: a thin hook, effect plus cleanup, SSR-safe (nothing touches `window` at render time):
```typescript
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}
```
`dispose()` in the cleanup must be idempotent. Component-level logic stays in `WorkerClient`/`buildResult` because there is no jsdom (Vitest is `environment: 'node'`).

### `workers/numogram.worker.ts` (worker shell)

No in-repo analog (no worker exists yet). Use RESEARCH.md "Worker shell" verbatim; it type-checks under the root `tsconfig.json` (DOM lib). Constraints verified in the research: `self.postMessage(msg, { transfer })` (the array form fails TS2769), no `type: 'module'` option, `next lint --dir workers` is already wired (`package.json` `lint` script, `next.config.js` line 12). `workers/` is outside the engine purity guard by design (it is app-side glue).

---

### `app/lib/canvas/viewTransform.ts` (utility, transform)

**Analog:** `app/lib/demonMatrix.ts` lines 5-138, the closest existing "pure transform + clamp + zoom-at-point + ensure-visible" module, with its 0-safety and non-finite fallback conventions.

**Transform, clamp, zoom-about-point** (lines 5-9, 29-52, 58-78):
```typescript
export interface MatrixTransform {
  readonly scale: number // CSS px per cell
  readonly tx: number // screen = t + cell * scale
  readonly ty: number
}
function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
function isFiniteTransform(t: MatrixTransform): boolean {
  return Number.isFinite(t.scale) && Number.isFinite(t.tx) && Number.isFinite(t.ty)
}
export function clampTransform(t: MatrixTransform, base: number, w: number, h: number): MatrixTransform {
  if (!isFiniteTransform(t)) return fitTransform(base, w, h)   // T-05-06: never propagate NaN
  // ...
}
export function zoomAt(t, factor, px, py, base, w, h): MatrixTransform {
  if (!Number.isFinite(factor) || factor <= 0) return t
  const s2 = clampNum(t.scale * factor, fs, Math.max(MATRIX_MAX_CELL_PX, fs))
  const ratio = s2 / t.scale
  const tx2 = px - (px - t.tx) * ratio
  const ty2 = py - (py - t.ty) * ratio
  return clampTransform({ scale: s2, tx: tx2, ty: ty2 }, base, w, h)
}
```
`ensureCellVisible` (lines 121-138) is the model for the "auto-pan the ring target into the window with a 24 CSS px margin" rule.

**Deliberate deviation (RESEARCH P8, supersedes the UI-SPEC "Scale rule"):** fit is `min(W / layout.width, H / layout.height)` and zoom is relative to fit, `s = fitScale x zoom`; `fitScale` must be 0-safe like `fitScale(base, w, h)` (line 30: `Math.max(1e-12, ...)`). Zoom range: min 0.3, max `max(5, 2 x labelVisibleMinRadiusPx / R_px_at_fit)` clamped to 100, where `labelVisibleMinRadiusPx` comes from `TIER_VIEW.boundaries` and `R_px_at_fit` uses the fit-based radius. DPR: `min(devicePixelRatio, 3)` reduced so `cssW x cssH x dpr^2 <= boundaries.canvasAreaLimitPx` (read from the table, same property-access route as `tierBounds.ts`).

**Wheel factor to carry over** (`useCanvasPan.ts` lines 14-18, 40-43; same formula in `DemonMatrix.tsx` lines 228-229):
```typescript
const normalizeDeltaY = (e: WheelEvent): number => {
  if (e.deltaMode === 1) return e.deltaY * 16
  if (e.deltaMode === 2) return e.deltaY * 120
  return e.deltaY
}
// ...
const step = clamp(deltaPx, -100, 100)
const factor = Math.exp(-step * 0.0015)
```
Do NOT reuse `useCanvasZoom` itself: it clamps zoom to 0.3-5 (lines 43, 57) and is a CSS-scale plus percent-origin model; that range is part of the frozen SVG behaviour (RESEARCH P13).

**Test analog:** `tests/app/demonMatrix.test.ts` (header comment, `describe` per function, a fast-check property for the clamp invariant at lines 69-90, and the explicit "tiny epsilon absorbs 1-ULP misses" idiom at lines 81-89). Include a tall-frame case (ladder at n = 4000 is a 19 x 4096 frame) and an LOD-boundary case that reads the threshold from the table (`TIER_TABLE.boundaries.labelVisibleMinRadiusPx`), the way `tests/app/tierBounds.test.ts` lines 52-56 do.

---

### `app/lib/canvas/pickIndex.ts` (utility, transform)

**Analog:** `app/lib/demonMatrix.ts` `cellAtPixel` (lines 80-90), whose doc comment states the contract this module must keep: pointer, click and keyboard all resolve through ONE pure function, never from raster pixels.
```typescript
/**
 * Screen pixel -> the (a, b) grid cell it currently shows, or null outside the valid a > b triangle. This is the
 * ONLY way hover, click and keyboard resolve a cell — never from raster pixels (T-05-05).
 */
export function cellAtPixel(px: number, py: number, t: MatrixTransform, base: number): Cell | null {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !isFiniteTransform(t)) return null
  // ...
}
```
Copy the non-finite guard and the "returns null" convention. The spatial structure itself has no repo precedent (see "No Analog Found"); the algorithm is fully specified in RESEARCH Pattern 6 and the zone-grid sketch in "Code Examples" (CSR `cellStart: Int32Array` / `items: Int32Array`, metric `max(0, |cursor - centre| x s - R_px)`, 12 CSS px as a named constant `PICK_RADIUS_PX`, tie order zone, syzygy, current, gate, demon chord). Keep the 12 as a named constant (the base-ten grep gate scans `app/`: see Shared Patterns).

**Test analog:** `tests/app/demonMatrix.test.ts` (exact-resolve property tests with fast-check); add "grid equals brute force" as the fast-check property, plus points 5, 11 in and 13 out of the radius, nearest-wins, tie order, muted excluded, isolate-dimmed included.

---

### `app/lib/canvas/keyboardModel.ts` (utility, transform)

**Analog 1:** `app/lib/demonMatrix.ts` `stepCursor` (lines 104-119): a pure `(state, key) -> next state` function returning the input unchanged at a boundary.

**Analog 2:** the SVG tier's focus-key grammar and activation, which the Canvas must reproduce (`Projection.tsx` lines 117-139, 148-172; `PairGraphProjection.tsx` lines 57-67):
```typescript
const zoneFocusKeys = Array.from({ length: view.zoneCount }, (_, z) => z)
  .filter(z => zs(z) !== ZONE_HIDDEN)
  .map(z => `zone:${z}`)
// syzygy `syzygy:${s.a}:${s.b}`, current `current:${c.name}`, gate `gate:${gt.name}`, pair `pair:${q}`
const activateFocused = (key: string) => {
  if (key.startsWith('zone:')) {
    const z = Number(key.slice('zone:'.length))
    onPinInfo({ type: 'zone', zone: z })
    onZoneNodeClick(z)
    return
  }
  // syzygy / current / gate: look the entry up in view.* and call onPinInfo({ type: ..., data: ... })
}
```
Wiring contract: the Canvas calls exactly these callbacks (`onHoverInfo`, `onPinInfo`, `onZoneNodeClick`, and for pair pills `onTogglePair` after `onPinInfo`, `PairGraphProjection.tsx` lines 62-67). `data-focus-key` carries the same key grammar (UI-SPEC "Verification Hooks"); announcements reuse the SVG aria-label strings exactly:
- zone: `` `Zone ${zoneLabels[z]}, ${regionLabel(view.zoneRegion[z])}${act ? ', selected' : ''}` `` (`Projection.tsx` line 727)
- syzygy: `` `Syzygy ${zoneLabels[s.a]}::${zoneLabels[s.b]}` `` (zone layouts, line 683); pair graph `` `Syzygy ${zoneLabels[hi]}::${zoneLabels[lo]}` `` (`PairGraphProjection.tsx` line 195)
- current: `` `Current ${c.name}: ${c.label}` ``; gate: `` `Gate ${g.name}: zone ${zoneLabels[g.from]} to zone ${zoneLabels[g.to]}` `` (lines 344, 450)

Deliberate difference (RESEARCH Pattern 7, UI-SPEC D-08): the SVG tier is one flat roving order (arrows step through zones, then syzygies, currents, gates, lines 139-206); the Canvas model is arrows between zones and Tab through a zone's syzygy, current, gate. Do not change the SVG tier.

---

### `app/lib/canvas/interaction.ts` (utility, pointer state machine)

**Analog:** `app/components/demons/DemonMatrix.tsx` lines 249-354: the repo's only multi-pointer (drag, pinch, click-slop) handling, written inline against refs. Extract the logic into a pure reducer over plain event objects (RESEARCH Pattern 8) so `tests/app/canvasInteraction.test.ts` needs no DOM. Bookkeeping to preserve:
```typescript
const DRAG_THRESHOLD_PX = 3
interface DragState { readonly pointerId: number; startX: number; startY: number; lastX: number; lastY: number; moved: number }
// pointerdown: pointersRef.current.set(e.pointerId, { x, y }); size 1 -> drag state, size 2 -> pinch state
// pointermove (2 pointers):
const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
const factor = distance / pinchRef.current.distance
if (Number.isFinite(factor) && factor > 0) { /* zoomAt about the midpoint */ }
// pointerup: a release with <= DRAG_THRESHOLD_PX of total movement is a click, resolved from the live transform
// pointercancel: pointersRef.current.delete(e.pointerId); drop drag and pinch
```
Phase 6 constants (UI-SPEC): mouse click slop 3 px (the existing `DRAG_THRESHOLD_PX`), touch pan threshold and tap slop 8 CSS px, pinch about the midpoint. Wheel stays a native non-passive listener (`DemonMatrix.tsx` lines 219-247, `addEventListener('wheel', handleWheel, { passive: false })`).

---

### `app/lib/canvas/draw.ts` (utility, transform to ctx calls)

**Analog:** `app/components/projection/Projection.tsx` (and `PairGraphProjection.tsx` for the pair graph). The palette, widths and opacities below are parity requirements (the UI-SPEC lists them as byte-identical hexes); copy the numbers, not the JSX.

**Constants and derived values** (`Projection.tsx` lines 70-81):
```typescript
const k = nodeRadius / 21
const ss = strokeScale
const dimOpacity = isPlanetary ? 0.03 : 0.08          // Canvas always 0.08 (planetary is base-10 only)
const zs = (z: number): 0 | 1 | 2 => (zoneStates ? (zoneStates[z] as 0 | 1 | 2) : ZONE_NORMAL)
const stateOf = (zones: readonly number[]): 0 | 1 | 2 => (zoneStates ? elementState(zoneStates, zones) : ZONE_NORMAL)
```
**Gate opacity, width, dashes** (lines 331-335, 346, 358, 398-406): `opacity = (fullHl ? 0.8 : (anyFocus || st === ZONE_DIMMED) ? dimOpacity : 0.5) * (gateMode === 'thin' ? 0.5 : 1)`, `sw = (fullHl ? 1.2 : 0.7) * ss`, dash `${5 * ss} ${3 * ss}` for a single route, `${3 * ss} ${2 * ss}` for a loop, legs `sw * 0.8` with `3 ss / 3 ss` at opacity x 0.7.
**Current opacity, width** (lines 437-441, 548-559): `hl = tcActive || hlZones.has(c.from) || hlZones.has(c.to) || hlZones.has(partner)`, `opacity = fullHl ? 0.85 : (anyFocus || st === ZONE_DIMMED) ? dimOpacity : 0.6`, `sw = (fullHl ? 1.8 : 1.2) * ss`, legs `sw * 0.7` at opacity x 0.7, junction circle `r = (hl ? 5 : 3.5) * k`, fill `#ffffff`, stroke `#22ee66`, `0.8 * ss`.
**Syzygy** (lines 668-701): `numDots = Math.max(3, Math.min(10, Math.round(dist / (30 * k))))`, dot radius `(1.0 + (t - startT) / span * 1.5) * k`, fill `#e8e8e8`, opacity `fullHl ? 0.7 : (anyFocus || st === ZONE_DIMMED) ? 0.1 : 0.5`.
**Zone node** (lines 763-775, 814-821, 842-843):
```typescript
// selected outer ring: r = nodeR + 7 * k, stroke clr, 0.5 * ss, opacity 0.3
// disc: fill `${clr}18`, stroke act || hl ? clr : `${clr}44`, strokeWidth (act ? 1.6 : hl ? 1.2 : 0.7) * ss
// triangle (syzTrianglePoints), opacity act || hl ? 0.5 : 0.2
// label: fill act || hl ? clr : `${clr}aa`, fontSize labelSize, bold, monospace
// region dot: r 2 * k, REGION_CLR[region], opacity 0.3
```
**Demon focus chord** (lines 297-316): `curveAway(pos[d.a], pos[d.b], ctr.x, ctr.y, 0.25)`, width `1.2 * ss`, opacity `st === ZONE_DIMMED ? 0.15 : 0.75`, color `KIND_COLOR[d.kind]` (`app/lib/demonBrowser.ts` line 20).
**Pair pill** (`PairGraphProjection.tsx` lines 146, 208-219): `fill={clr}` at `fillOpacity` `sel ? 0.3 : 0.12`, `rx = H / 2`, stroke opacity `sel || hl ? 1 : 0.6`, width `(sel ? 1.6 : 0.9) * ss`; arc opacity `hl ? 0.85 : anyFocus || pairStates?.[q] === 1 ? 0.08 : 0.6`, width `1.4 * ss`, color `#22ee66`.
**Region colors**: `REGION_CLR` in `app/lib/constants.ts` (`torque '#00ccff'`, `warp '#44cc77'`, `plex '#aa6633'`).

Rules the draw module must obey (RESEARCH Pattern 5, P4): the static edge layers are drawn at alpha 1 and ambient-to-context dimming is a CSS `opacity` switch on per-kind edge canvases, never a repaint on hover; highlighted and on-demand edges draw on the overlay layer. Level of detail reads the threshold through `labelsShown(R_px)` from `app/lib/tierBounds.ts`, never a literal 7. The draw functions take an injected context-like interface so `tests/app/canvasDraw.test.ts` can assert against a recording `Proxy` (RESEARCH "Recording 2D context").

---

### `app/components/canvas/CanvasDiagram.tsx` (component, event-driven + redraw)

**Analog:** `app/components/demons/DemonMatrix.tsx`: a `<canvas>` shell with `role="application"`, one Tab stop, native wheel listener, pointer handlers, a 12 px-offset tooltip chip, an `aria-live` region, `ResizeObserver` sizing, and data attributes for e2e. Copy the shell, not the raster.

**Focusable root, data hooks, touch** (`DemonMatrix.tsx` lines 413-437):
```tsx
<div
  ref={containerRef}
  data-demon-matrix=""
  role="application"
  tabIndex={0}
  data-focus-key="demon-matrix"
  aria-label="Demon matrix: arrow keys move the cursor, Enter pins, plus and minus zoom, 0 fits"
  data-scale={String(live.scale)}
  data-tx={String(live.tx)}
  data-ty={String(live.ty)}
  className="relative flex-1 min-h-[400px] overflow-hidden select-none"
  style={{ touchAction: 'none', background: MATRIX_BG, outline: 'none' }}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerCancel}
  onPointerLeave={handlePointerLeave}
  onKeyDown={handleKeyDown}
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
>
```
Phase 6 differences: `touch-action: none` on the canvas element only; the focusable element is the overlay canvas; the clear-to-transparent rule (no background fill); `data-diagram="zones" | "pairs"`, `data-focus-key` in the SVG key grammar, `data-zoom`, `data-tx`, `data-ty`, `aria-busy` while pending; wrapper `data-render-tier="canvas"` and `data-canvas-state="ready" | "pending"`. The SVG tier's own attribute precedent for `data-diagram` and the aria-label strings: `Projection.tsx` lines 209-218 and `PairGraphProjection.tsx` lines 109-118 (Canvas labels per UI-SPEC "Copywriting Contract").

**Resize, wheel, pointer capture** (`DemonMatrix.tsx` lines 128-138, 219-247, 249-254): `ResizeObserver` on the container for CSS size, a non-passive native `wheel` listener with the 150 ms-style commit timer (`WHEEL_COMMIT_DELAY_MS`; Canvas uses 120 ms per RESEARCH Pattern 5), `containerRef.current?.setPointerCapture(e.pointerId)`.

**Callout chip and live region** (`DemonMatrix.tsx` lines 493-505): same markup and classes, plus `data-canvas-callout` / `data-canvas-live` and `data-post-baseline=""`:
```tsx
{tooltip !== null && (
  <div
    data-matrix-tooltip=""
    role="tooltip"
    className="pointer-events-none absolute whitespace-nowrap px-1.5 py-[2px] text-[10px]"
    style={{ left: tooltip.x, top: tooltip.y, background: 'rgba(8,8,15,0.95)', border: `1px solid ${tooltip.color}88`, color: '#e5e7eb' }}
  >
    {tooltip.text}
  </div>
)}
<div data-matrix-live="" aria-live="polite" className="sr-only">
  {cursorText}
</div>
```
Tooltip position is `x + 12, y + 12` from the cursor (line 308), the source of the UI-SPEC's 12 px callout offset.

**Gesture-time transform, redraw after the gesture** (`DemonMatrix.tsx` lines 211-214, 233-236): the committed-versus-live pair and `gestureTransform = translate(...) scale(k)` CSS transform is the precedent for "transform the static layers with CSS during a gesture and re-raster after it ends" (RESEARCH A2). Keep `{ tx, ty, zoom }` in a ref and mirror to `data-*` attributes at commit; do not `setState` per pointer move.

**Test analog:** `tests/app/demonMatrixRender.test.ts` (SSR smoke through `renderToStaticMarkup(createElement(NumogramViewContext.Provider, { value: ctx }, createElement(Component, props)))`, asserting `data-*` attributes, `role="application"`, and that no tooltip exists without a pointer event).

---

### `app/components/numogram/ViewContext.tsx` (modified)

**Analog:** itself (lines 9-22). Add `tier: RenderTier` and `interactiveMaxN: number`; `view` becomes non-null at the Canvas tier (`null` stays only for headless). `g` is typed non-null and read by seven components (RESEARCH P6, Open Question 1): keep it non-null at svg and canvas, resolve the headless case before the Demons overlay mounts or change the type.
```typescript
export interface NumogramViewContextValue {
  readonly base: number
  readonly g: Numogram
  readonly summary: NumogramSummary
  // null above the SVG tier (04-11): panels then show an availability note instead of reading a view model too
  // large to build.
  readonly view: NumogramView | null
  readonly zoneLabels: readonly string[] | null
  readonly labelScheme: LabelScheme
  zoneLabel(zone: number): string
  readonly svgRichMaxN: number
  readonly allChordsMaxN: number
  readonly gateMode: 'on' | 'thin' | 'off'
}
```
> **Integration hazard:** five existing test files build a literal `NumogramViewContextValue` (`tests/app/demonBrowserRender.test.ts`, `demonFocusRender.test.ts`, `demonMatrixRender.test.ts` lines 18-32, `demonRowListRender.test.ts`, `demonsOverlayRender.test.ts`). `tsc --noEmit` covers them (root `tsconfig.json` includes `**/*.ts`), so adding REQUIRED fields breaks `npm run typecheck` until each literal gains `tier` and `interactiveMaxN`. Either make the new fields optional with a default read in `useNumogramView`, or update all five in the same plan as the type change.

---

### `app/components/panels/*` list panels, `shared.tsx`, `LayersPanel.tsx`, `ShortcutsModal.tsx`

**Analog:** `ZonesPanel.tsx` early-return (lines 24-39) and `shared.tsx` `PanelUnavailable` (lines 107-112). The four list panels (Zones, Syzygies, Currents, Gates) all branch on `!view || !zoneLabels` today (`ZonesPanel.tsx:39`, `SyzygiesPanel.tsx:18`, `CurrentsPanel.tsx:17`, `GatesPanel.tsx:24`); at the Canvas tier `view` is non-null, so they would render 4000-row lists (RESEARCH P9). Add an earlier `tier === 'canvas'` return of the UI-SPEC note; `LabelsPanel.tsx:25`, `LayersPanel.tsx:34` and `RegionsPanel.tsx:56` use the same early return but must stay functional at Canvas.
```tsx
/** Shown by a panel instead of building a list it cannot afford: the context view is null above the SVG tier. */
export function PanelUnavailable({ max }: { max: number }) {
  return (
    <div data-post-baseline="" className="px-3 pb-2.5 text-[9px] text-gray-500">Available up to {max} zones.</div>
  )
}
```
Canvas copy (UI-SPEC "Copywriting Contract"): `Listed up to {svgRichMaxN} zones. Pick elements on the diagram.`; keep today's `Available up to {max} zones.` for headless. Checker recommendation 3: either keep the 9px style as an inherited exception or set the new note at 10px; it needs `data-post-baseline=""` like the existing line.

**LayersPanel** (`LayersPanel.tsx` lines 43-49, 63-67, 70-81): the gates info suffix is built from `gateMode`; at Canvas replace ` Hidden at this base: too dense to draw legibly.` with ` Drawn for the hovered or pinned zone only at this base.` The Particles row follows the existing `locked ? 'N/A'` right-label pattern (line 67) with info `Particles are drawn up to {svgRichMaxN} zones.`:
```tsx
const suffix = gateMode === 'thin'
  ? ' Drawn thin at this base.'
  : gateMode === 'off'
  ? ' Hidden at this base: too dense to draw legibly.'
  : ''
// ...
right: <span className="text-[8px] text-gray-700">{locked ? 'N/A' : (layers.has(l.id) ? 'ON' : 'OFF')}</span>,
```

**ShortcutsModal** (`ShortcutsModal.tsx` lines 47-50): all new copy lives inside the existing `data-post-baseline` block; qualify the existing "Diagram:" line with "Up to {svgRichMaxN} zones" and read the cutoff from a prop or context (never typed as prose); the new line's lead-in must NOT use the `#10ff50` span (checker recommendation 6):
```tsx
<div data-post-baseline="" className="grid gap-1.5">
  <div><span style={{ color: '#10ff50' }}>Diagram:</span> Tab moves into the diagram, arrow keys step through zones, syzygies, currents and gates, Home/End jump, Enter or Space selects</div>
  <div><span style={{ color: '#10ff50' }}>Gate keys:</span> digits 0-9 work at base 10 only</div>
</div>
```

**Demons overlay** (`DemonsOverlay.tsx` lines 26, 45, 212; `DemonFocusView.tsx` lines 26, 60, 264): `showDiagram` only gates a hint line; the prop's meaning becomes "a diagram exists" (`tier !== 'headless'`), set from `NumogramClient.tsx:1697`.

---

### `app/components/numogram/BigBaseSummary.tsx` + `app/lib/numogramText.ts` (modified)

**Analog:** themselves. Layout, `aria-label`, `data-post-baseline` and structure stay (UI-SPEC "Over-Limit Message"); only the message and the cutoff prop change.

**Current message and component** (`numogramText.ts` lines 12-15; `BigBaseSummary.tsx` lines 21-37):
```typescript
export function bigBaseMessage(base: number, zoneCount: number, svgRichMaxN: number): string {
  return `Base ${base} has ${zoneCount} zones — more than the interactive diagram supports live (over ${svgRichMaxN}). Showing the summary and text view.`
}
```
```tsx
export function BigBaseSummary({ summary, svgRichMaxN, text }: { summary: NumogramSummary; svgRichMaxN: number; text: string }) {
  // ...
  <section data-post-baseline="" aria-label="Numogram summary" className="w-[580px] max-w-[92vw] space-y-2 font-mono">
    <p role="status" className="text-[11px] text-[#f87171]">
      {bigBaseMessage(summary.base, summary.zoneCount, svgRichMaxN)}
    </p>
```
New copy (UI-SPEC): `Base {n} is above the interactive limit of {ceiling}. Showing the summary and text view. To draw it, use headless export.`; zone count dropped; plain integers; a second string for `tier=headless` within the limit, `Tier override active. Showing the summary and text view for base {n}.` The cutoff arrives as a prop read from `INTERACTIVE_MAX_N`, exactly as `svgRichMaxN` does today (`NumogramClient.tsx:1401`). Do not add a "show anyway" control, an export button or a link (D-02, Phase 4 D-18).

**Text limit** (`numogramText.ts` lines 10, 49-80): `TEXT_VIEW_ZONE_LIMIT = 1024`; UI-SPEC decision 4 and RESEARCH recommend the worker builds the full listing and the limit follows the ceiling (text at 4000 is 358 KB, 7 ms). If taken, `numogramText(g, zoneLabel, { zoneLimit })` already accepts an override (line 29), so the change is the default plus the two tests below.

**Tests that legitimately change** (rewrite, never skip): `tests/app/numogramText.test.ts` lines 99-105 (`bigBaseMessage`, verbatim string), lines 107-110 (`TEXT_VIEW_ZONE_LIMIT is 1024`, only if decision 4 is taken), and the "base 4096 (above TEXT_VIEW_ZONE_LIMIT)" describe at lines 77-90. Read the ceiling from the table in the new message test, as `tests/app/tierBounds.test.ts` does.

---

### `app/components/numogram/BasePicker.tsx` (modified)

**Analog:** itself. UI-SPEC wants the numeral to show the requested base and the summary span to read `Computing base {n}...` while pending, plus a persistent sr-only `role="status"` carrier (checker recommendation 1).

**The snap-back hazard (RESEARCH P19)**, the exact lines involved:
```typescript
// lines 63-67: re-sync visible text to the committed base whenever not mid-edit
React.useEffect(() => {
  if (!dirty) setCandidate(String(base))
}, [base, dirty])
// lines 84-93
function evaluateNow(text: string): void {
  const result = evaluateCandidate(text, base)
  if (result.kind === 'ok') {
    setRefusal(null)
    setDirty(false)
    if (result.base !== base) onCommitBase(result.base)
  } // ...
}
```
With a worker, `base` stays the old displayed base until the swap, so `setDirty(false)` then the effect at lines 65-67 would flicker the numeral back. Add props (requested base, status string, failure refusal) next to the existing ones (lines 29-39), keep the 200 ms debounce (`BASE_DEBOUNCE_MS`, `app/lib/basePicker.ts:19`) and the Enter/chip commit semantics.

**Status slot** (lines 269-277): the summary span is replaced in place; the refusal slot is the existing `role="status"` `#f87171` element and the portal dropdown's last row (lines 237-241). Keep every root carrying `data-post-baseline=""` (lines 161, 251):
```tsx
{refusal ? (
  <span id={summaryId} role="status" className="truncate text-[10px] text-[#f87171]">{refusal}</span>
) : (
  <span id={summaryId} className="truncate text-[10px] text-gray-400">{summaryLine(summary)}</span>
)}
```
Failure copy format is Phase 4's "problem, then `Showing base {lastValid}.`" (`app/lib/basePicker.ts` `refusalMessage`, lines 40-57). Note `SLIDER_MAX = 1024` and `NOTABLE_BASES` (lines 9, 15-16) need no change; the 1024 chip now lands on the Canvas tier.

---

### `app/NumogramClient.tsx` (modified; the integration point)

**Analog:** itself. Every edit site, with the lines to anchor on:

| Concern | Lines | Today | Change |
|---|---|---|---|
| Tier gating and main-thread engine | 199-205 | `g = useMemo(createNumogram(base))`; `showDiagram = tierFor(base, tierOverride) === 'svg'`; `view = showDiagram ? buildNumogramView(g) : null` | SVG tier: byte-for-byte unchanged. Canvas: `g`, `view`, `zoneLabels` still built on the main thread (cheap at n <= ceiling). Headless: no `g`, no `view` on commit (P6) |
| Layout tween hook | 211-217 | `useLayoutTween(target ?? FALLBACK_TARGET, mayTween(g.zoneCount) && !reducedMotion)` | Keep the call and its position (rules of hooks); `mayTween` is false above 28 so it stays instant |
| View context | 250-262 | `viewCtx` useMemo | Add `tier` and `interactiveMaxN`; `view` non-null at Canvas |
| Commit path | 357-392 | `commitBase`: one batched reset ending `setBase(n)`, calls `createNumogram(n)` at 366 | The reset body is also the worker-swap body (UI-08); remove the main-thread `createNumogram(n)` at 366 from the headless path (`demonsAfterBaseSwitch` needs `facetCount(g, filter)`: with a null filter it needs no `g`, RESEARCH P6) |
| `svg` DOM queries | 443, 527, 556 | `svgWrapRef.current?.querySelector('svg')` (Selection panel initial position, `fitSelectionToView`, `finalizeSelection` via `getScreenCTM`) | Generalize to "the diagram element" for the Selection panel position; add Canvas-transform variants for fit and rubber-band (P13) |
| URL hydration | 603-660 | `createNumogram(state.base)` at 639 and 651 | Do not build `g` for a headless base; hydration issues a worker request for the desired record |
| Selected infos | 1036-1073 | pushes gate, current, syzygy, zone entries for the selection | Cap the Selection list at Canvas ("and M more" row), keep selection a `Set` (P5); `InfoDisplay.tsx:493` has an O(k^2) `kept.includes` pass |
| Big-base text | 1195-1207 | `bigBaseText`/`panelText` via `numogramText(g, ...)` | Text comes from the worker above 200 |
| Render branch | 1313-1403 | `view && target ? <svg tier> : <BigBaseSummary .../>` | Add a `canvas` branch beside `svg`; wrapper carries `data-render-tier` |
| BasePicker | 1432-1442 | props `base`, `summary`, `onCommitBase` ... | Add requested base and status props |
| Text panel and toolbar mounts | 1600, 1665 | `{showDiagram && <Panel id="text" ...>}`, `{showDiagram && <ViewControls .../>}` | Widen to "a diagram exists" (`tier !== 'headless'`); the Text panel is D-08's fallback and must stay at Canvas |
| Demons overlay | 1697 | `showDiagram={showDiagram}` | Pass "a diagram exists" |

**The callbacks the Canvas must call, unchanged** (`NumogramClient.tsx` lines 476-488, 772-784):
```typescript
const onHoverInfo = useCallback((info: HoverInfo | null) => { setHoverInfo(info) }, [])
const onPinInfo = useCallback((info: HoverInfo) => {
  setPinnedInfo(info)
  if (info.type === 'gate') { setSelZones(new Set<number>([info.gate.from, info.gate.to])) }
}, [])
const clearInfoFocus = useCallback(() => { setHoverInfo(null); setPinnedInfo(null) }, [])
const onZoneNodeClick = useCallback((zone: number) => {
  if (demonFocusMode) { /* toggle zone focus and switch to the Focus tab */ return }
  setSelZones(prev => { const next = new Set(prev); if (next.has(zone)) next.delete(zone); else next.add(zone); return next })
}, [demonFocusMode])
```

**The SVG wrapper behaviours to mirror on Canvas** (lines 1313-1342): alt/middle-button drag starts canvas pan (`startCanvasDrag(e)`), a primary-button press on empty space starts the rubber-band (`setSelectionStart`, `selectionAdditiveRef.current = e.shiftKey`), and an empty-space click calls `clearInfoFocus()` unless `suppressNextCanvasClickRef` is set. The rubber-band rectangle (lines 1406-1418, `rgba(16,255,80,0.85)` border, `rgba(16,255,80,0.12)` fill) is reused unchanged.

**The desired-record and worker request** (RESEARCH Pattern 2): one `desired = { base, layout, packer, labels }`; every change needing recomputation re-issues the whole record; the response commits only when `id === latestId`; a synchronous (SVG-tier) commit calls `supersede()`. `isLayoutIdFor` / `layoutIdsForBase` validate the layout against the desired base (`app/lib/baseSwitch.ts` `nextLayoutForBase`, lines 13-15, is the existing rule).

**Do not touch:** `Projection.tsx` and `PairGraphProjection.tsx` output (frozen goldens). After the first `NumogramClient.tsx` edit run `npm run test:swap`.

---

### `app/lib/shareParams.ts` (modified)

**Analog:** itself (lines 186-197). A main-thread `createNumogram(base)` runs whenever `region=`, `isolate=` or `mute=` is present, which is a freeze above the ceiling:
```typescript
if (rawRegion !== null || rawIsolate !== null || rawMute !== null) {
  const g = createNumogram(base)
  if (rawRegion !== null) region = parseRegionId(rawRegion.trim(), g)
  isolate = parseRegionList(rawIsolate, g)
  mute = parseRegionList(rawMute, g)
}
```
Per RESEARCH P6: drop `region=`/`isolate=`/`mute=` before the codec's numogram branch for a base above the ceiling (they have no Canvas/regions meaning there), or move the branch behind a lazy getter. `tier=` already round-trips (line 205, `tierOverrideFrom(params.get('tier'))`; `tests/app/shareParams.test.ts:266`).

---

### `e2e/viewer-helpers.ts` + the three new Canvas/worker specs

**Analog for the helper:** `openViewer` (lines 47-60): resolves on the first `[data-diagram]` or summary, which at Canvas bases is the transient base-10 SVG (RESEARCH P7). Add a sibling, do not change `openViewer` for existing specs:
```typescript
export const DIAGRAM = '[data-diagram]'
export const SUMMARY = 'section[aria-label="Numogram summary"]'
export async function openViewer(page: Page, query = ''): Promise<void> {
  await page.goto(`/numogram/${query ? '?' + query : ''}`)
  const root = page.locator(`${DIAGRAM}, ${SUMMARY}`).first()
  await root.waitFor()
  // ... hydration check, then two rAFs
}
```
New helper waits for `[data-render-tier="canvas"][data-canvas-state="ready"]`.

**Analog for the specs:** `e2e/demons-matrix.spec.ts`. Copy: the UTC-only skip (line 12), reading live transform state from `data-*` attributes and computing page coordinates from the element's `boundingBox()` (the `matrixCellPoint` helper in `e2e/demons-helpers.ts` is the template for a "canvas world to page point" helper that reads `data-zoom`, `data-tx`, `data-ty`), and `page.mouse.move/click/wheel` plus `expect.poll(...)`:
```typescript
test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 5 UI specs run once (UTC context)'))
// ...
const p = await matrixCellPoint(page, 12, 3)
await page.mouse.move(p.x, p.y)
await expect(tooltip).toHaveText(cellText(g, 12, 3, 28))
const beforeScale = await liveScale(matrix)
await page.mouse.wheel(0, -400)
await expect.poll(() => liveScale(matrix)).toBeGreaterThan(beforeScale)
```
Expected values are computed independently from the engine in the spec (`createNumogram`, `formatNumeral`), never from the app's view model, the same discipline as `e2e/layers-zoom.spec.ts` lines 54-63.

**Keyboard traversal analog:** `e2e/accessibility.spec.ts` lines 15-51: `tabIntoDiagram` presses Tab until the active element carries `data-focus-key`; `activeFocusKey` reads it; assertions use `new Set(keys).size`. The Canvas version asserts `data-focus-key` on the ONE focusable canvas (`zone:15`, then `syzygy:`/`current:`/`gate:` keys after Tab), the `[data-canvas-live]` text equals the SVG aria-label string, and Enter pins. `trackErrors(page)` (`url-codec.spec.ts` lines 17-21: `page.on('pageerror', ...)`, asserted `toEqual([])`) closes each test.

**Hover/pin analog:** `e2e/hover-pin.spec.ts` lines 12-24 (hover changes a visual, a click shows `panel(page, 'Selection')` containing the label and the URL gains `selected=15`).

**Narrow windows:** no precedent for viewport-specific specs in the repo; use Playwright `test.use({ viewport: ... })` or `page.setViewportSize` for 375 x 667 and 768 x 1024 per UI-SPEC; touch uses a `hasTouch` context and the CDP recipe in RESEARCH "Two-finger pinch through CDP [VERIFIED recipe]".

**`e2e/static-export.spec.ts` (extended; the only spec that runs under `/ccrug`)** (lines 3-5, 18-33): reuse `BASE`, `esc`, and the request/failure tracking, then add the worker test from RESEARCH "Playwright: worker URL under basePath":
```typescript
const BASE = process.env.E2E_BASE_PATH ?? ''
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
// ...
page.on('request', r => seen.push(r.url()))
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) failed.push(`${r.status()} ${r.url()}`) })
```
Worker URL assertion: `page.on('worker', w => urls.push(w.url()))` then `expect(urls[0]).toMatch(new RegExp(`${esc(BASE)}/_next/static/chunks/[^/]+\\.js$`))`; offline reuse with `context.setOffline(true)` AFTER the worker exists.

**Deterministic staleness** (RESEARCH Pattern 3): `page.addInitScript` wrapping `Worker.prototype.postMessage` with a per-message delay, no production code. The in-repo precedent for `addInitScript` stubbing is `stubClipboard` (`viewer-helpers.ts` lines 36-45). The worker path at base 28 uses the existing `?tier=canvas` override, no new production flag.

**Existing e2e assertions that legitimately change** (rewrite, do not skip; also tracked in RESEARCH "Existing Tests That Legitimately Change"):

| File and lines | Today | Change |
|---|---|---|
| `e2e/url-codec.spec.ts:72-85` | `?base=1024` expects summary and `[data-diagram]` count 0 | 1024 is Canvas; move the summary assertions to a base above the ceiling (read from `tierTable.boundaries`, as line 15 reads `svgRichMaxN`), assert `[data-render-tier="canvas"]` at 1024 |
| `e2e/base-picker.spec.ts:126-130` | chip 1024 expects `SUMMARY` and `DIAGRAM` count 0 | Not listed in the UI-SPEC but same cause; assert Canvas after the chip |
| `e2e/demons-browser.spec.ts:54` and about `:231-234` | base 666 `DIAGRAM` count 0; base 1024 pager | Replace the no-diagram assertion with the Canvas assertion; keep the demon assertions |
| `e2e/demons-focus.spec.ts:81-86` | title "base 666 has no diagram but focus still works", `DIAGRAM` count 0 | Retitle; the Focus tab still works through its own zone input |
| `e2e/demons-matrix.spec.ts:110-114, :129` | base 666 `DIAGRAM` count 0; loop `[28, 666, 4096]` | Drop the no-diagram assertion; the timing loop stays valid (4096 is headless) |

---

### Unit-test files for the pure modules

**Analogs:** `tests/app/demonMatrix.test.ts` (structure: a header comment citing requirement and threat IDs, a `describe` per exported function, fast-check properties, named constants imported rather than literal numbers) for `canvasView`, `canvasPick`, `canvasKeyboard`, `canvasInteraction`; `tests/app/demonState.test.ts` and `tests/app/baseSwitch.test.ts` (plain `describe/it`, engine objects built with `createNumogram`) for `workerCore` and `workerClient`; `tests/app/demonMatrixRender.test.ts` for `canvasDiagramRender` and `bigBaseSummary`:
```typescript
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// ...
function buildCtx(g: Numogram): NumogramViewContextValue {
  const base = g.base
  return {
    base, g, summary: summarize(g), view: null, zoneLabels: null, labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME),
    svgRichMaxN: SVG_RICH_MAX_N, allChordsMaxN: ALL_CHORDS_MAX_N, gateMode: 'off',
  }
}
```
These tests use no JSX (plain `.ts`), `createElement`, and `renderToStaticMarkup` (no jsdom is installed; `vitest.config.mts` runs `environment: 'node'`, with `oxc: { jsx: { runtime: 'automatic' } }`).

`engine/test/scene.canvasScene.test.ts`: use the mismatch-collector sweep of `engine/test/layout.routing.test.ts` (lines 1-9: a sweep over every even base on `ringLayout`, short strings pushed to a capped `mismatches` array, checked once at the end) and its `hasBadNumber` scan (line 22-24: `NaN`, `Infinity`, `undefined`). Sweep 2..64 plus 202, 666, 1024, 4000 across ring, ladder, spiral, pairGraph; assert array lengths, finiteness, determinism, and that route endpoints equal the numbers parsed from the engine route strings (the file's `endpoints(d)` regex helper, lines 12-26, is reusable).

---

## Shared Patterns

### Pure module plus thin component (no jsdom)
**Source:** `app/lib/demonMatrix.ts` + `app/components/demons/DemonMatrix.tsx` (Phase 5 precedent, named in CLAUDE.md-adjacent RESEARCH constraints)
**Apply to:** every Canvas and worker module. Anything that must be unit-tested lives in `app/lib/**` or `engine/scene/**` as pure functions; components get `renderToStaticMarkup` smoke tests plus Playwright.

### Measured data is read by property access only
**Source:** `app/lib/tierBounds.ts` lines 4-13
**Apply to:** the ceiling, `labelVisibleMinRadiusPx`, `canvasAreaLimitPx`, `gatesFullMaxN`/`gatesThinMaxN`, `layoutTweenMaxN`, `allChordsMaxN`. Never `import` the whole table into a component or the worker (the worker chunk tree-shakes the rows, RESEARCH evidence table), never write 4000, 7, 200, 150 or 2^28 as a literal in a component or a test expectation. Pick radius 12, tap slop 8, click slop 3 and the 150 ms grace are UI-SPEC constants, not table values: name them as exported constants.

### `data-post-baseline=""` on all new DOM
**Source:** `BigBaseSummary.tsx` line 34, `BasePicker.tsx` lines 161 and 251, `ViewControls.tsx` line 61, `TextView.tsx` line 22, `shared.tsx` `PanelUnavailable` line 110
**Apply to:** the callout chip, live region, status span, tier wrapper attributes, new picker status carrier, new panel notes, the new ShortcutsModal line. The behaviour collector (`e2e/behaviour-collect.ts`) skips every node inside such a subtree, which is how the frozen behaviour baseline ignores new chrome.

### The hover, pin and select callback contract
**Source:** `app/data/types.ts` lines 40-45 (`HoverInfo` union) with `NumogramClient.tsx` lines 476-488 and 772-784
**Apply to:** `CanvasDiagram.tsx`, `keyboardModel.ts`. The Canvas never adds a parallel state path; it produces `HoverInfo` values and calls the same three handlers the SVG tier calls.

### Focus-key grammar and ARIA strings
**Source:** `Projection.tsx` lines 117-139, 344, 450, 683, 727; `PairGraphProjection.tsx` lines 59, 116, 195
**Apply to:** `data-focus-key`, the callout chip, the live region, the canvas `aria-label` for the pair graph (the existing SVG string verbatim). The zone-layout canvas `aria-label` is new copy (UI-SPEC "Copywriting Contract").

### Latest-wins stale guard
**Source:** `DemonMatrix.tsx` `genRef` (lines 90, 182-188, 206-208)
**Apply to:** `WorkerClient` (request ids), the Canvas re-raster-after-gesture scheduling, and any rAF-coalesced redraw: a superseded job returns immediately instead of painting.

### Base-ten grep gate and engine purity
**Source:** `scripts/check-repo.mjs` lines 244-257 (`BASE_TEN_PATTERNS`, scans tracked `app/**/*.ts(x)` outside the exempt list, line 244, `engine/` and `workers/` are not scanned); `.eslintrc.json` engine override
**Apply to:** every new `app/` file. Patterns that trip the gate: `x <= 4`, `x > 9`, `x <= 9`, `length: 10`, `9 - x`, `} = 9`, literal `[1, 2, ..., 9]` and `[0..9]`. Use named constants (`PAGE_STEP = 10` then `length: PAGE_STEP`). Run `node scripts/check-repo.mjs --only base-ten` after each module. `engine/scene/canvasScene.ts` falls under the engine ESLint/tsc guard (`engine/tsconfig.json` covers `engine/**`); `workers/` does not.

### Never edit the frozen oracles
**Source:** CLAUDE.md "The base-10 oracle is frozen"; `e2e/__golden__/**`, `e2e/__behaviour__/**`, `engine/test/fixtures/**`, `engine/test/layout.digest.test.ts` digests
**Apply to:** the whole phase. New Canvas tests are new files; `Projection.tsx`/`PairGraphProjection.tsx` output stays byte-identical; the SVG zoom range 0.3-5 in `useCanvasZoom` is unchanged. Gate: `npm run test:swap` after any `NumogramClient.tsx` edit.

### e2e conventions
**Source:** `e2e/demons-matrix.spec.ts` line 12, `e2e/url-codec.spec.ts` lines 12-21, `e2e/layers-zoom.spec.ts` lines 8, 54-63
**Apply to:** the new specs: UTC-only `test.skip` via `info.project.name`, `trackErrors` closing each test, expected values computed from the engine independently, no timing assertion tied to this machine's speed (the single exception per RESEARCH is the 2^26 heartbeat bound, chosen well above scheduling noise), read page points from `data-*` state and `boundingBox()`.

### Page-weight baseline
**Source:** `scripts/page-weight.mjs` (usage lines 4 and 139: `node scripts/page-weight.mjs update --reason "<why>"`)
**Apply to:** after the Canvas renderer and client code land on `/numogram/`; the worker chunk is not referenced from the HTML so `check:weight` never sees it (RESEARCH P10), record its size in the plan summary instead.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|---|---|---|---|
| `workers/numogram.worker.ts` | worker shell | request-response | No Web Worker exists in the repo (a search of `app`, `engine`, `scripts`, `tests` and `e2e` finds no `Worker` use; `engine/test/guard.test.ts:60` only mentions the `workers/` directory in a comment). Use RESEARCH "Worker shell" and "Worker factory", both verified under Next 14.2.35 export |
| Spatial index in `app/lib/canvas/pickIndex.ts` (zone grid, edge segment distance, flattened curves, analytic arc flattening for the pair graph) | utility | transform | `demonMatrix.cellAtPixel` is an O(1) grid-cell division, not a nearest-neighbour search. Use RESEARCH Pattern 6 and the zone-grid sketch |
| `Path2D` construction from typed arrays and layered canvases (CSS-opacity dimming, overlay canvas) | utility / component | streaming redraw | `DemonMatrix` rasterizes an `ImageData` buffer, it draws no vector paths and has one canvas. Use RESEARCH Pattern 4 and Pattern 5 |
| Recording-context draw test (`tests/app/canvasDraw.test.ts`) | test | n/a | No existing test asserts canvas draw calls. Use RESEARCH "Recording 2D context for draw tests" (a `Proxy` that logs `moveTo(...)`, `strokeStyle=...`) and the "no `NaN`/`undefined`" scan idiom from `tests/app/projectionRender.test.ts` |
| Worker and touch e2e techniques (`Worker.prototype.postMessage` delay wrapper, `context.setOffline`, CDP `Input.dispatchTouchEvent`, `page.on('worker')`) | test | n/a | No precedent; recipes are in RESEARCH "Code Examples" and were verified there. `stubClipboard` (`viewer-helpers.ts` 36-45) is the only `addInitScript` precedent for style |

---

## Integration Hazards Found While Mapping (for the planner)

1. **`shape.ts` carry-forward breaks `shape.test.ts` unless handled** (see the Data section): synthetic `maxMeasuredN` is 100, shipped `interactiveMaxN` is 4000.
2. **Required new fields on `NumogramViewContextValue` break five test literals** at typecheck (list above): decide required-versus-optional first.
3. **`summarize` must move before the worker lands** (P11), re-exported from `numogramView.ts` so `numogramText.ts:4`, `NumogramClient.tsx:16` and the Phase 5 render tests keep compiling.
4. **Five main-thread `createNumogram` call sites** stay on the commit path unless removed: `NumogramClient.tsx:199`, `:366`, `:639`, `:651`, and `app/lib/shareParams.ts:193`.
5. **`BasePicker`'s snap-back effect (lines 65-67)** will fight a pending worker request; the requested-base prop is not optional.
6. **`useLayoutTween` and `FALLBACK_TARGET`** (`NumogramClient.tsx:143, 217`) must keep their call order at every tier.
7. **Five e2e specs and two unit tests assert the old 202-4000 fallback** (tables above); they are rewrites, not skips, and one of them (`base-picker.spec.ts:126-130`) is not named in the UI-SPEC.
8. **`SELECTION` and `InfoDisplay` scale** (`NumogramClient.tsx:1036-1073`, `InfoDisplay.tsx:493`): up to about 14,000 entries on select-all at 4000.

## Metadata

**Analog search scope:** `engine/scene`, `engine/layout`, `engine/test`, `app/lib`, `app/components` (numogram, projection, panels, demons), `app/hooks`, `app/NumogramClient.tsx`, `tests/app`, `tests/spike`, `e2e`, `scripts`, `next.config.js`, `package.json`, `tsconfig*.json`, `.eslintrc.json`, `vitest.config.mts`, `playwright.config.ts`.
**Files scanned:** about 70 (read in full or by targeted range; `NumogramClient.tsx` and `Projection.tsx` read by the ranges cited, the rest of each file skipped).
**Pattern extraction date:** 2026-10-05

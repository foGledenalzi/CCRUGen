# Phase 7: Naming Builder - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 81 (new and modified, from CONTEXT.md, RESEARCH.md and the UI-SPEC Scope Map)
**Analogs found:** 81 / 81 (47 exact, 29 role-match, 5 partial; behaviours with no analog at all are listed under "No Analog Found")

Sources read for this map: CONTEXT, RESEARCH (all 799 lines), UI-SPEC (all 607 lines), CLAUDE.md, and every analog file cited below. No project skills directory exists (`.claude/` holds only `launch.json`). All line numbers refer to the working tree at mapping time.

## File Classification

Match quality: `exact` = the file is an edit to an existing file, or a near-clone of an existing one; `role-match` = same role, different data flow or domain; `partial` = only the shape or one mechanism transfers.

### Engine (pure; `engine/naming/` depends only on `engine/core`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `engine/naming/prng.ts` | utility | transform | `engine/core/arith.ts` | role-match |
| `engine/naming/feistel.ts` | utility | transform | `engine/core/arith.ts` + `engine/core/demons.ts` `rowOf` (exactness comments) | role-match |
| `engine/naming/banks.ts` | config (frozen data) | static | `engine/layout/params.ts` | exact |
| `engine/naming/generate.ts` | service | transform (lazy + batch) | `engine/core/numogram.ts` (frozen limits, cache) + `app/lib/worker/protocol.ts` L9 (versioned id const) | role-match |
| `engine/naming/text.ts` | utility | validation | `app/lib/customAlphabet.ts` + `engine/core/base.ts` | role-match |
| `engine/naming/euphony.ts` | utility | transform | `engine/core/numerals.ts` | role-match |
| `engine/naming/derive.ts` | service | request-response (O(1) lookup) | `engine/core/demons.ts` (`DemonSpaceImpl`) | role-match |
| `engine/naming/edit.ts` | utility | CRUD (immutable ops) | `app/lib/regions.ts` L116-137 | role-match |
| `engine/naming/collisions.ts` | service | batch (resumable, no clock) | `app/lib/demonMatrix.ts` `RasterJob`/`rasterizeRows` + `DemonMatrix.tsx` L182-209 | partial |
| `engine/naming/schema.ts` | config | static | `engine/scene/tiers.ts` (schema types + versioned table) | partial |
| `engine/naming/validate.ts` | utility | validation | `engine/scene/tiers.ts` `validateTierTable` + `app/lib/worker/protocol.ts` `isWorkerRequest` + `engine/core/base.ts` `validateBase` | role-match |
| `engine/naming/index.ts` | barrel | n/a | `engine/layout/index.ts` | exact |
| `engine/index.ts` (edit) | barrel | n/a | itself, L33-34 | exact |
| `engine/test/naming.prng.test.ts` | test | transform | `engine/test/arith.test.ts` (BigInt oracle) | role-match |
| `engine/test/naming.feistel.test.ts` | test | transform | `engine/test/arith.test.ts` | role-match |
| `engine/test/naming.generate.test.ts` | test | transform | `engine/test/arith.test.ts` (fast-check, fixed seeds) | role-match |
| `engine/test/naming.text.test.ts` | test | validation | `engine/test/arith.test.ts` (it.each reject tables) | role-match |
| `engine/test/naming.euphony.test.ts` | test | transform | `engine/test/numerals.test.ts` (vector tables; not read, same convention) | role-match |
| `engine/test/naming.derive.test.ts` | test | lookup | `engine/test/arith.test.ts` | role-match |
| `engine/test/naming.collisions.test.ts` | test | batch | `engine/test/arith.test.ts` (independent brute-force oracle) | role-match |
| `engine/test/naming.schema.test.ts` | test | validation | `engine/test/arith.test.ts` (reject tables) | role-match |
| `engine/test/naming.vectors.test.ts` | test | frozen vectors/digests | `engine/test/layout.digest.test.ts` | exact |
| `scripts/naming-sheet.ts` (+ `scripts/naming-sheet/build.ts`, optional) | script | batch / file-I/O | `scripts/review-sheet.ts` + `scripts/review-sheet/build.ts` | exact |

### App libraries and hooks

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `app/presets/base10/naming.ts` | config (preset adapter) | transform | `app/presets/base10/demons.ts` | exact |
| `app/lib/namingSession.ts` | store (pure reducer) | event-driven | `app/lib/baseSwitch.ts` + `app/lib/demonState.ts` L140-166 | role-match |
| `app/lib/namingStorage.ts` | utility (persistence) | storage I/O | `app/lib/glyphCoverage.ts` L8-36 (injected platform dependency) | partial |
| `app/lib/namingLimits.ts` | config | static | `app/lib/tierBounds.ts` + `app/lib/selectionList.ts` L4-5 | role-match |
| `app/lib/soundLabels.ts` | utility | transform (pure fit) | `app/lib/canvas/diagramModel.ts` (named constants, pure glue) | role-match |
| `app/lib/panelStack.ts` | utility | transform | `app/hooks/usePanelGroupLayout.ts` L30-38 + the old one-shot effect, `NumogramClient.tsx` L1220-1249 | exact |
| `app/lib/shareParams.ts` (edit) | codec | request-response | itself (`demonFocus` handling) + `app/lib/demonState.ts` L50-84 | exact |
| `app/lib/labelScheme.ts` (edit) | codec/formatter | transform | itself (the `xeno` branches) | exact |
| `app/lib/worker/protocol.ts` (edit) | guard | validation | itself L72-82 | exact |
| `app/lib/demonBrowser.ts` (edit) | service seam | lookup | itself L185-210 | exact |
| `app/lib/demonSearch.ts` (edit) | service | lookup | itself L103-116 | exact |
| `app/hooks/usePanelDrag.ts` (edit) | hook | event-driven | itself + `app/hooks/usePanelGroupLayout.ts` | exact |

### Components

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `app/components/names/NamesPanel.tsx` | component | request-response + event-driven | `app/components/numogram/BasePicker.tsx` + `LabelSchemeControls.tsx` | role-match |
| `app/components/names/ZoneList.tsx` | component | virtualized CRUD | `app/components/demons/DemonRowList.tsx` | role-match |
| `app/components/names/CollisionReport.tsx` | component | batch (sliced job) | `app/components/demons/DemonMatrix.tsx` L182-209 + `DemonBrowser.tsx` L82-93 | role-match |
| `app/components/names/DemonNameEditor.tsx` | component | CRUD | `app/components/ui/CyberInput.tsx` + `BasePicker.tsx` key handling | role-match |
| `app/components/names/NamingContext.tsx` | provider | pub-sub | `app/components/numogram/ViewContext.tsx` | exact |
| `app/components/ui/CyberButton.tsx` (edit) | component | n/a | itself L17-24 (additive tab props) | exact |
| `app/components/ui/CyberRadio.tsx` (edit) | component | n/a | `CyberButton.tsx` additive-prop pattern | exact |
| `app/components/ui/CyberCheckbox.tsx` (edit) | component | n/a | same | exact |
| `app/components/ui/CyberPanel.tsx` (no change expected, verify) | component | n/a | itself | exact |
| `app/components/numogram/NumogramIcons.tsx` (edit: `LockIcon`) | component | n/a | `DemonsIcon` L225-236 | exact |
| `app/components/numogram/LabelSchemeControls.tsx` (edit) | component | n/a | itself L67-74 | exact |
| `app/components/panels/LabelsPanel.tsx` (edit) | component | n/a | itself | exact |
| `app/components/info/InfoDisplay.tsx` (edit) | component | n/a | itself L291-360, L382-401 | exact |
| `app/components/demons/DemonRowList.tsx` (edit) | component | n/a | itself L242-244 | exact |
| `app/components/demons/DemonMatrix.tsx` (edit) | component | n/a | itself L74-77 | exact |
| `app/components/demons/DemonsOverlay.tsx` (edit) | component | n/a | itself L59-70, L220-232 | exact |
| `app/components/projection/Projection.tsx` (edit) | component | n/a | itself L814-821 | exact |
| `app/components/canvas/CanvasDiagram.tsx` (edit) | component | n/a | itself L268-270, L625-643, L708-721 | exact |
| `app/lib/canvas/draw.ts` (edit) | renderer | transform | itself L877-886, L1552-1561 | exact |
| `app/lib/canvas/keyboardModel.ts` (edit) | model | transform | itself L161-183 | exact |
| `app/lib/canvas/diagramModel.ts` (edit) | model | transform | itself L153-170 | exact |
| `app/components/numogram/ShortcutsModal.tsx` (edit) | component | n/a | itself L49-53 | exact |
| `app/NumogramClient.tsx` (edit) | page/orchestrator | event-driven | itself (see per-site anchors below) | exact |
| `app/globals.css` (edit) | style | n/a | itself L68-111 | exact |

### Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `tests/app/panelStack.test.ts` | test | transform | `tests/app/tierBoundsCeiling.test.ts` + a literal copy of the old formula | role-match |
| `tests/app/shareParamsNames.test.ts` | test | codec | `tests/app/shareParams.test.ts` + `shareParamsHeadless.test.ts` | exact |
| `tests/app/namingSession.test.ts` | test | reducer | `tests/app/baseSwitch.test.ts` (not read, same pure-rule shape) | role-match |
| `tests/app/namingStorage.test.ts` | test | storage | `tests/app/workerClient.test.ts` (injected fakes) | partial |
| `tests/app/soundLabels.test.ts` | test | transform | `tests/app/canvasView.test.ts` (not read) + the UI-SPEC worked example | role-match |
| `tests/app/cyberControlsMarkup.test.ts` | test | markup identity | `tests/app/demonsOverlayRender.test.ts` L49-68 | exact |
| `tests/app/namesPanelRender.test.ts` | test | server render | `tests/app/demonRowListRender.test.ts` | exact |
| `tests/app/shareParams.test.ts` (edit) | test | codec | itself L45-65 (`defaultShareState` literal) | exact |
| `tests/app/workerCore.test.ts` (edit) | test | guard | itself L90-102 | exact |
| `tests/app/demonNames.test.ts` (edit or keep) | test | lookup | itself | exact |
| `tests/app/demonRowListRender.test.ts` (edit) | test | server render | itself | exact |
| `tests/app/canvasDraw.test.ts` (edit) | test | recorded calls | itself L293-309, L910-939 | exact |
| `tests/app/demonsOverlayRender.test.ts` (edit) | test | server render | itself | exact |
| `tests/app/labelScheme.test.ts` (edit) | test | codec | itself | exact |
| `e2e/names-panel.spec.ts` | e2e | UI | `e2e/canvas-tier.spec.ts` + `e2e/demons-browser.spec.ts` | role-match |
| `e2e/names-io.spec.ts` | e2e | file I/O | `e2e/url-codec.spec.ts` (not read; closest "state round trip") | partial |
| `e2e/names-preview.spec.ts` | e2e | UI | `e2e/base-switch-reset.spec.ts` (not read) + `region-legend.spec.ts` L106 | role-match |
| `e2e/names-labels.spec.ts` | e2e | UI | `e2e/label-scheme.spec.ts` | exact |
| `e2e/panel-stack.spec.ts` | e2e | geometry | `e2e/behaviour.spec.ts` L197-222 (drag) + `e2e/canvas-interaction.spec.ts` L302, L402 (viewports) | role-match |
| `e2e/demons-browser.spec.ts` (rewrite one test) | e2e | UI | itself L172-182 | exact |
| `e2e/demons-matrix.spec.ts` (rewrite, NOT in RESEARCH) | e2e | UI | itself L14-20, L43-57, L96-99, L124-125 | exact |
| `e2e/region-legend.spec.ts` (add todo 008 assertion) | e2e | UI | itself | exact |

## Planner Alerts (found while mapping; each changes a plan)

1. **`e2e/demons-matrix.spec.ts` legitimately changes and is missing from RESEARCH's "Existing Tests" table and from the UI-SPEC Frozen Constraints list.** Its `cellText` helper (L16-20) builds `A::B · MESH · Subtype`; assertions at L43-44, L53, L57, L96, L99 and L124-125 (`'c::3 · 69 · Cyclic chrono'`, `'15::3 · 108 · Cross-Torque chrono'`) all break once the tooltip and the `data-matrix-live` text become `A::B · Name · MESH · Subtype` at every base (UI-SPEC Name Display Contract). Rewrite, do not skip: compute the name in the spec independently through the engine (`createNameResolver`) and keep the 32-grapheme cut in mind. `tests/app/demonMatrixRender.test.ts` is unaffected (it asserts no tooltip on the server and only the presence of `data-matrix-live`).
2. **`panel(page, 'Names')` from `e2e/viewer-helpers.ts` L16-22 will not match while a header tag is showing.** The helper filters `header` by `hasText: /^Names$/`, but `CyberPanelHeader` (L35-52) puts `headerRight` inside the same `<header>`, so `unsaved preview` or `edits not in links` breaks the match. Names specs must locate the panel through `[data-names-panel]` or a prefix regex, and the geometry specs need the fixed ancestor of that header (same `position:fixed` ancestor rule).
3. **Names mounts at every tier and base.** Do not copy the Text panel's `{hasDiagram && (...)}` guard (`NumogramClient.tsx` L1908). Copy only its props (L1909-1918).
4. **Three exhaustive lists must all gain `names`, or Names never reports a height:** `PANEL_GROUP_ORDER` (L92, mobile order puts `names` first), `PANEL_GROUP_DEFAULT_HEIGHTS: Record<PanelId, number>` (L94-104, TS forces it), and `onPanelHeight`'s guard `if (!(panelId in PANEL_GROUP_DEFAULT_HEIGHTS)) return` (L1212). `usePanelDrag.ts` has its own parallel `PanelId = keyof PanelPositions` (L15) and `INITIAL_Z_INDEX` (L17-27), also needing `names` (z 49).
5. **Names are baked into `HoverInfo.demon.name` at five `legacyDemon` call sites** (`DemonsOverlay.tsx` L60, L62, L66; `NumogramClient.tsx` L789, L854; `demonState.ts` L129, L135 via `focusChordList`). Render-time resolution must win over the baked field in `DemonInfo` and `selectedInfoMeta`, and `legacyDemon(d, base)` must keep working with no naming argument because `tests/app/demonNames.test.ts` L36-44, L57-61, `tests/app/demonState.test.ts` L185-194 and `tests/app/demonsOverlayRender.test.ts` L118-124 pin it (the net-span fallback `'c::3'`). `selectedInfoMeta` (InfoDisplay L382) is a plain function, so it cannot call a hook: `InfoDisplay` must read the naming context and pass it in as a third argument.
6. **RESEARCH and UI-SPEC disagree about `demonName`.** RESEARCH recommends keeping `demonName`/`demonNameTable` as the CCRU-lore seam (so `tests/app/demonNames.test.ts` stays untouched); UI-SPEC says `demonName is null at every base other than 10` is superseded. Recommended: follow RESEARCH (keep the seam, add the resolver beside it) and say so in the plan so the executor does not delete the test.
7. **`CyberPanel` needs no new props.** `headerRight` (L26), `onHeightChange` (L18), `postBaseline` (L28), `maxBodyHeight` (L22) and `collapseDirection="vertical"` already exist. Its collapsed wrapper (L227-237) renders children even when closed, so the Names body must mount itself conditionally on the open state while the always-mounted live carrier stays outside that conditional (RESEARCH Pitfall 13).
8. **New `app/` files are scanned by two gates.** The repo guard `base-ten` (`scripts/check-repo.mjs` L244-257) flags `<= 9`, `> 9`, `<= 4`, `length: 10`, `9 - x` and the 0..9 list literals in any tracked `app/**/*.ts(x)` line (exempt: `app/presets/base10/`, `planetary.ts`, `useOrbitalAnimation.ts`, `NumogramIcons.tsx`); run `git add` first because it scans tracked files only. The lore scanner (`tests/presets/base10-adapter.test.ts` L436-537) scans every `app/presets/base10/*.ts` except `lore.ts` and `routes.ts` for quoted demon names and lore prose, so `naming.ts` must import `DEMON_NAMES` and `ZONE_PARTICLE` by reference and never quote a canonical name.
9. **`NumogramClient.tsx` is touched by at least seven concerns** (state, history snapshot and key, base-switch reset, hydration, autosave, panel mount, desktop stack and drag, Share title, label mode, Names context provider). With `workflow.use_worktrees: false`, give it to one plan per wave, or split by clearly separate hunks, and re-run `npm run test:swap` after each.
10. **Unicode in new source and tests:** the file-write tooling decodes typed `\uXXXX` escapes (STATE Phase 2 P07). Existing code builds such characters as data: `String.fromCodePoint(0x2013)` (`DemonRowList.tsx` L23-25, `demonSearch.ts` L138-140, `diagramModel.ts` L23). Use the same for U+2026, U+00B7 and every non-ASCII test fixture, and scan new files for Cf characters afterwards.
11. **Test-file convention:** React render tests are plain `.ts` files using `createElement` and `renderToStaticMarkup` (no JSX), with a hand-built `NumogramViewContextValue` literal (`tests/app/demonsOverlayRender.test.ts` L26-47). Keep naming in a separate context so those seven literals stay valid.
12. **The `isLabelScheme` guard and the `sounds` union member ship in one commit** (RESEARCH Pitfall 5): `protocol.ts` L75 only accepts `digits` and `xeno` as bare modes, so without a `sounds` branch `isWorkerRequest` is false and selecting Sounds at a Canvas base becomes a `build-failed` revert.

## Pattern Assignments

### Engine

#### `engine/naming/prng.ts` and `engine/naming/feistel.ts` (utility, transform)

**Analog:** `engine/core/arith.ts` (header comment states the pitfall, typed `RangeError`, no dependencies) and `engine/core/demons.ts` L43-56 (exactness reasoning in comments).

**Header and error style** (`arith.ts` L1-18):
```typescript
// In-base arithmetic primitives (ENG-01). Pitfall 1: the digital root is taken in the numogram's own base, never as a
// decimal digit sum, and never as a bare modulus (which maps a multiple of base - 1 to 0 instead of base - 1).

import { checkIndex } from './index-check'

function show(x: unknown): string {
  return typeof x === 'number' ? String(x) : `<${typeof x}>`
}

/** The k-th triangular number T(k) = k(k+1)/2 (a gate's cumulation), exact. RangeError unless 0 <= k <= 94906264. */
export function triangular(k: number): number {
  const index = checkIndex('triangular index', k, MAX_TRIANGULAR_INDEX + 1) // -0 comes back as +0, so T(-0) is +0 too
  return (index * (index + 1)) / 2
}
```

**Exactness commentary to imitate** (`demons.ts` L43-50): state why every double stays below 2^53 (Feistel halves below 2^26, domain below 2^52, division by an exact power of two).

**Versioned id constant** (`app/lib/worker/protocol.ts` L9): `export const WORKER_PROTOCOL = 'ccrug-numogram-worker/1'`. Same shape for `PRNG_ALGO = 'sfc32-cyrb128@1'`, `GENERATOR_ID = 'names-gen@1'`, `EUPHONY_VERSION = 1`, `SCHEMA_ID = 'ccrug.naming/1'`.

**Body to copy:** RESEARCH Pattern 1 (`cyrb128`, `sfc32`) and Code Examples "Feistel permutation" verbatim; they are measured. Engine purity is automatic: the ESLint override in `.eslintrc.json` matches `engine/**` (excluding `engine/test/**`), forbids `Math.random`, `new Date()` and `Date.now()`, and `engine/tsconfig.json` (`lib: ["ES2022"]`, `types: []`) rejects `performance`, `crypto` and `window`.

**Test pattern** (`engine/test/arith.test.ts` L27-35): independent oracle (BigInt) plus a fixed-seed fast-check run:
```typescript
it('equals k(k+1)/2 computed in BigInt for a fixed-seed sample across the whole range', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 94906264 }), k => {
      const exact = (BigInt(k) * BigInt(k + 1)) / 2n
      return BigInt(triangular(k)) === exact
    }),
    { seed: 20260932, numRuns: 2000 },
  )
})
```
Use the same structure for an independent BigInt `sfc32` and Feistel (RESEARCH measured 0 mismatches over 20,000 seeds and 120,000 evaluations), then pin Appendix B as `it.each` tables.

#### `engine/naming/banks.ts` (config, frozen data)

**Analog:** `engine/layout/params.ts` L9-24 (frozen data, `as const`):
```typescript
export const DEFAULT_LAYOUT_PARAMS: LayoutParams = Object.freeze({
  r: 21,
  ...
  strokeBaseWidth: 800,
} as const)
```
Draft banks are RESEARCH Appendix A. They are **drafts needing a human sign-off** (RESEARCH Open Question 1, VALIDATION Manual-Only row 1); the plan must put the contact-sheet checkpoint before the digest pin.

#### `engine/naming/generate.ts` (service, lazy + batch)

**Analog:** `engine/core/numogram.ts` L18-22 (frozen limits constant, cache) for any per-depth permutation memo:
```typescript
export const NUMOGRAM_CACHE_LIMITS: Readonly<{ entries: 4; zones: 67108864 }> = Object.freeze({
  entries: 4,
  zones: MAX_BASE,
} as const)
```
Imports from siblings are relative (`demons.ts` L18-23): `import { clipEcho, MAX_BASE } from './base'`, `import type { ... } from './types'`. For `engine/naming` that means `../core/base`, `../core/demons` (`meshOf`, `netSpanOf`), `../core/index-check`.

**Body:** RESEARCH Pattern 2 + Code Examples "Tree decode". The locks and spare-stream rule (RESEARCH Pattern 2, final paragraph) is new logic with no analog; test it with fast-check "random locks, all sounds distinct when locks are distinct" (Pitfall 16).

**Digest pin:** `engine/test/layout.digest.test.ts` is the model (see `naming.vectors.test.ts` below).

#### `engine/naming/text.ts` (utility, validation)

**Analog:** `app/lib/customAlphabet.ts` (cannot be imported from `engine/`, so copy the shape).

**NFC split** (L67-70):
```typescript
/** Splits text into user-perceived characters: NFC-normalized, one entry per code point (an astral character is one entry). */
export function splitAlphabet(text: string): string[] {
  return Array.from(text.normalize('NFC'))
}
```

**Typed reason result** (L77-101):
```typescript
export type AlphabetProblem = 'empty' | 'too-long' | 'forbidden' | 'duplicate' | 'too-short'

export type AlphabetCheck =
  | { readonly ok: true; readonly chars: readonly string[] }
  | { readonly ok: false; readonly reason: AlphabetProblem; readonly message: string; readonly char?: string; readonly needed?: number }

function problem(reason: AlphabetProblem, message: string, extra?: { char?: string; needed?: number }): AlphabetCheck {
  return { ok: false, reason, message, ...extra }
}
```
Do **not** copy `FORBIDDEN` (L75): it bans `\p{M}`, while the Names rule is `^\p{L}[\p{L}\p{M}]*$` (RESEARCH Pattern 6). Copy only the "length check before any per-character work" ordering (L108-110) and the "never echo a raw control or bidi character" helper `describeChar` (L89-97). Echoes of user text in messages go through `clipEcho` (`engine/core/base.ts` L14-19; `demonSearch.ts` L3 imports it as `'../../engine/core/base'`).

Reason order is fixed by D-07 and the UI-SPEC: empty, space, digit, other, too long. Segmenter only when the string is longer than the limit in UTF-16 units (Pitfall 8); regex fallback per RESEARCH Pattern 6.

#### `engine/naming/euphony.ts` (utility, transform)

**Analog:** `engine/core/numerals.ts` L1-40: header states the contract and scheme, named constants for char codes (`CHAR_LOWER_A = 97` ...), an inverse-friendly pure function. `smooth(raw)` must use char codes, not per-character regex, for the 0.20 us figure RESEARCH measured. Rule set and vectors: RESEARCH Pattern 4 and Appendix B (do **not** test against `DEMON_NAMES`; there is no oracle).

#### `engine/naming/derive.ts` (service, O(1) lookup)

**Analog:** `engine/core/demons.ts` L168-182 and L195-199: a class whose instance is frozen, with O(1) accessors that validate through `checkIndex`:
```typescript
class DemonSpaceImpl implements DemonSpace {
  readonly base: number
  readonly count: number
  readonly #s: NumogramInternals
  constructor(base: number, s: NumogramInternals) {
    this.base = base
    this.count = (base * (base - 1)) / 2
    this.#s = s
    Object.freeze(this)
  }
  at(mesh: number): DemonRef {
    const m = checkIndex('mesh number', mesh, this.count)
    const a = rowOf(m)
    return buildDemon(this.#s, this.base - 1, a, m - (a * (a - 1)) / 2)
  }
```
Apply to `createNameResolver(naming, preset)` returning `{ soundOf, nameOf, stateOf }`. Key by `meshOf(a, b)` from `engine/core/demons.ts` L36-41 (order-normalising, exact to 2^26); override store is `ReadonlyMap<number, string>`. Layering: override, then preset (base 10 and source `ccru`), then derived (RESEARCH Pattern 3). The CCRU data enters as an **argument**, never imported (CLAUDE.md, Phase 2 D-06, Pitfall 14).

#### `engine/naming/edit.ts` (utility, immutable CRUD)

**Analog:** `app/lib/regions.ts` L116-137: every edit returns a new object and shares the unchanged part by reference:
```typescript
function toggled(set: ReadonlySet<RegionId>, id: RegionId): Set<RegionId> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
export function toggleIsolate(f: RegionFilter, id: RegionId): RegionFilter {
  return { isolate: toggled(f.isolate, id), mute: f.mute }
}
```
Same for `editSound` (copies the sounds array, shares `overrides`), `toggleLock`, `setOverride`. A `rev` integer from the session replaces the whole-naming JSON in the history key (Pitfall 7).

#### `engine/naming/collisions.ts` (service, resumable batch)

**Analog (partial):** `app/lib/demonMatrix.ts` L200-219 `RasterJob` + `rasterizeRows(job, rowStart, rowEnd)` returns the work count; the engine side of the collision scan is the same shape (a job object, a `step(shouldYield)` that returns resumable state, no clock because `performance` is not in lib ES2022). The app-side scheduler is `DemonMatrix.tsx` L182-209 (see CollisionReport).

**Certificate** (O(n log n), exact for generated tables) and **partitioned scan**: RESEARCH Pattern 5 and Code Examples. Differential-test the certificate against the scan and the scan against brute force at n <= 300 including non-ASCII.

#### `engine/naming/schema.ts`, `validate.ts` (validation)

**Analog 1:** `engine/scene/tiers.ts` L273-330 `validateTierTable`: "one `if` per rule, one specific message per rule", returns a list of strings; collect, do not stop at the first problem (the UI shows at most 5 then `And {k} more.`).

**Analog 2 (total guard, never throws)** `app/lib/worker/protocol.ts` L66-69 and L85-106:
```typescript
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
export function isWorkerRequest(v: unknown): v is WorkerRequest {
  try {
    if (!isRecord(v)) return false
    const { protocol, type, id, base, layout, packer, labels, wantScene } = v
    return (protocol === WORKER_PROTOCOL && type === 'build' && ... )
  } catch {
    return false
  }
}
```
**Analog 3 (typed reasons, base via the engine)** `engine/core/base.ts` L7-12, L31-33, L36-49: reuse `validateBase` for the file's `base`, and the `BaseProblem`/`BaseCheck` shape for `NamingProblem`/`NamingCheck`.

Prototype hazards: imported override keys go into a `Map` after `^(0|[1-9][0-9]{0,15})$`, never `copy[k] = v` (Pitfall 10).

#### `engine/naming/index.ts` and `engine/index.ts` (barrel)

**Analog:** `engine/layout/index.ts` L5-31: values and types are exported in separate statements so a type-only importer never pulls runtime.
```typescript
export { LAYOUT_IDS, PACKERS, CAPSULE_PLACEMENTS } from './types'
export type { LayoutId, Packer, ... } from './types'
```
**Edit:** add one line after `engine/index.ts` L34, beside `export * from './layout/index'` and `export * from './scene/index'`:
```typescript
export * from './naming/index'
```
The app imports from `'../../engine/index'` everywhere (`demonBrowser.ts` L10).

#### `engine/test/naming.vectors.test.ts` (frozen vectors and digests)

**Analog:** `engine/test/layout.digest.test.ts` L1-26 and L78-98: a header that states the sign-off date and "never update it to make a test pass", `createHash('sha256')` over a canonical text, a `SIGNED_OFF` record, and a count test.
```typescript
const SIGNED_OFF: Record<string, string> = { 'ring@2': '82bb...', ... }
describe('signed-off layout pin (plan 03-08 contact-sheet sign-off)', () => {
  for (const [key, expectedDigest] of Object.entries(SIGNED_OFF)) {
    it(`${key} matches its signed-off digest`, () => { ... expect(digest, `${key} digest changed; this needs a new contact-sheet sign-off, not a test update`).toBe(expectedDigest) })
  }
  it('covers exactly the 10 review bases x 4 layouts = 40 entries', ...)
})
```
`engine/test/**` may import `node:crypto` (`engine/tsconfig.test.json` adds Node types). The Appendix B PRNG, key, permutation and euphony tables are pinned inline (RESEARCH Validation Architecture); sound-table digests are added only after the contact-sheet sign-off.

**Purity probe:** extend or mirror `engine/test/guard.test.ts` L26-29 (`boundaryRules(code, 'engine/naming/__guard__.ts')` through `ESLint.lintText`) to prove a `Math.random` inside `engine/naming` is rejected; the override glob already covers it.

#### `scripts/naming-sheet.ts` (optional; the style-bank checkpoint)

**Analog:** `scripts/review-sheet.ts` L1-27 (CLI wrapper writing a gitignored dev sheet to `.review/`, sha256 printed, `buildReviewSheet` pure and deterministic) and `tests/presets/review-sheet.smoke.test.ts` L1-30 (determinism and structure smoke test). Contact sheet content: bases 10, 28, 64, 666, 4000, three styles, raw and smoothed.

### App libraries

#### `app/presets/base10/naming.ts` (config, preset adapter)

**Analog:** `app/presets/base10/demons.ts` L1-9 and L39-50: reads lore by mesh id, never copies text, throws on a gap.
```typescript
// Base-10 demons for the viewer (MIG-01, plan 02-12). Original CCRUG code (MIT, NOTICE section 1); the names are in lore.ts.
import { DEMON_NAMES } from './lore'
import { BASE10 } from './numogram'
...
    const name = DEMON_NAMES[mesh]
    if (name === undefined) throw new Error('base-10 lore missing for demon mesh ' + mesh)
```
Build the 10 sounds with a loop over `BASE10.zoneCount` reading `ZONE_PARTICLE[z]` (`lore.ts` L15-18), export `{ id: 'ccru', base, sounds, names: DEMON_NAMES }` by reference. The file lives in an exempt directory for `base-ten` but is **lore-scanned**: no quoted canonical name, no prose.

#### `app/lib/namingSession.ts` (pure reducer)

**Analog:** `app/lib/baseSwitch.ts` L1-46 (pure rules applied by `NumogramClient` in one batched update; the file header says so) and `app/lib/demonState.ts` L140-166 (`demonsAfterBaseSwitch`: state after a switch is computed by a pure function).
```typescript
export function sessionAfterBaseSwitch(prev: SessionResetState, base: number): SessionResetState {
  return { layout: nextLayoutForBase(prev.layout, base), selected: [], hlRegion: null, ... }
}
```
The preview/adopt rule is "a pure function of `(saved, link)`" (RESEARCH Pattern 8): compare the link form (`source`, seed, style, join, smoothing). `resetForBaseSwitch` (`NumogramClient.tsx` L417-438) is where the loaded slot or default is applied, so the SVG commit and the worker swap share it.

#### `app/lib/namingStorage.ts` (partial analog)

No storage code exists anywhere in `app/`, `engine/` or `workers/` (grep for `localStorage` found nothing). Use the repo's **injected platform dependency** pattern so it is testable without a DOM:
- `app/lib/glyphCoverage.ts` L8-36: an interface (`GlyphCanvas`) injected, `null` when unavailable.
- `app/lib/worker/workerClient.ts` L17-26: `WorkerClientOptions` with `makeWorker` and `schedule` injected.
Shape: `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }`, a `getStorage()` that wraps the `window.localStorage` getter in try/catch (it can throw `SecurityError`), key `ccrug.naming.v1.<base>`, value = the export JSON, read back through the same `validateNamingJson` (Pitfall 17). Debounce and `pagehide` flush live in the component.

#### `app/lib/namingLimits.ts` (config)

**Analog:** `app/lib/tierBounds.ts` L16-34 (property access on the tier table, never the whole JSON) and L28-30 (throw at load if a required value is absent), and `app/lib/selectionList.ts` L4-5 (a `[default]` constant with a doc comment):
```typescript
/** [default] Entries the Selection panel lists above the SVG tier; the rest collapse into an `and {M} more selected` line. */
export const SELECTION_LIST_MAX = 200
```
`NAMING_COLLISION_SCAN_MAX_N` (default 1024) is a measured constant with a unit test that it is `<= INTERACTIVE_MAX_N`. Never type 4000: import `INTERACTIVE_MAX_N` from `./tierBounds`. Unit-test pattern for table access: `tests/app/tierBoundsCeiling.test.ts` L11-33 (`vi.doMock` the JSON, `vi.resetModules`).

#### `app/lib/soundLabels.ts` (pure fit function)

**Analog:** `app/lib/canvas/diagramModel.ts` L1-24: header explains "everything it has to DECIDE lives here so it is unit-tested without a DOM", named constants, and ellipsis built as data (`const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)`). Level of detail is **not** re-derived here: SVG tier uses `target.nodeRadius * (DIAGRAM_CSS_WIDTH / svgWidth) * zoom` (`NumogramClient.tsx` L1438); Canvas uses `onScreenRadius(...)` (`draw.ts` L31). The function takes `R_px` as an argument. `LABEL_MIN_RADIUS_PX` is read from `app/lib/tierBounds.ts` L32 by property access only. Test it against the UI-SPEC worked example (`eiaoung` about 6.3 px, `gl` 12.3 px at R_px 15.2).

#### `app/lib/panelStack.ts` (pure desktop stack)

**Analog (exact formula):** the one-shot effect `NumogramClient.tsx` L1220-1249, which is also the **test oracle** to copy literally into `tests/app/panelStack.test.ts`:
```typescript
const labelsY = DESKTOP_PANEL_BASE_Y + layersH + DESKTOP_PANEL_GAP
const zonesY = labelsY + labelsH + DESKTOP_PANEL_GAP
const syzY = zonesY + zonesH + DESKTOP_PANEL_GAP
const currentsY = DESKTOP_PANEL_BASE_Y + regionsH + DESKTOP_PANEL_GAP
const gatesY = currentsY + currentsH + DESKTOP_PANEL_GAP
...
labels: { x: DESKTOP_PANEL_LEFT_X, y: Math.round(labelsY) },
text: { x: DESKTOP_PANEL_RIGHT_X, y: Math.round(gatesY + (desktopPanelHeights.gates ?? 34) + DESKTOP_PANEL_GAP) },
```
Association matters: `y = y + h + GAP` evaluated left to right (RESEARCH Pitfall 3, a one-ulp difference flipped `Math.round` ties in 17 of 120,000 comparisons). The mobile stack for comparison, `app/hooks/usePanelGroupLayout.ts` L30-38:
```typescript
let y = baseY
for (const id of order) { out[id] = { x: baseX, y }; y += (heights[id] ?? defaultHeights[id]) + gap }
```
(do not copy its `y += h + gap` for the desktop function). Constants (`DESKTOP_PANEL_BASE_Y`, `_GAP`, `_LEFT_X`, `_RIGHT_X`, `PANEL_WIDTH`, `INFO_PANEL_WIDTH`) are module-private in `NumogramClient.tsx` L105-110: move them into `panelStack.ts` and import them back, or export them; keep the values.

#### `app/lib/shareParams.ts` (edit: `names` codec)

**Analog:** the file's own per-field lenient parsing plus `app/lib/demonState.ts` L23-24, L50-84:
```typescript
export const DEMON_PARAM_MAX_LENGTH = 40
const ZONE_FOCUS_RE = /^z:(\d{1,10})$/
export function parseDemonFocus(raw: string | null, base: number): DemonFocus | null {
  if (raw === null) return null
  const t = raw.trim()
  if (t.length === 0 || t.length > DEMON_PARAM_MAX_LENGTH) return null
  ...  // anchored regexes only, never a property key, never reaches an engine call
```
**Edit sites in `shareParams.ts`:** `ShareState` L34-52 (add `names: NamesLink | null`), `defaultShareState` L69-89 (add `names: null`), `parseShareParams` L204-216 (a `parseNamesLink(params)` beside `parseLabelScheme`) and return literal L218-237, `buildShareParams` L281-295 (write `names`, `nstyle`, `njoin`, `nsmooth` only at non-default; base 10 default is CCRU so omitted, other bases omit the default seed). The natural-tier guard at L196-202 drops `region`/`isolate`/`mute` above the ceiling and **must not** drop `names` (seed-only is exactly what survives). `sortedParams` L248-250 re-sorts with `localeCompare` already.
**Callers that hold a `ShareState` literal:** `NumogramClient.currentShareState` L326-347 and `tests/app/shareParams.test.ts` L45-65 (`defaultShareState(10)` equality). The hostile-input and `vi.mock` spy style for "never builds a numogram" is `tests/app/shareParamsHeadless.test.ts` L9-33; the property test style is `tests/app/shareParams.test.ts` L467-490 (`fc.assert(..., { seed: 20260928, numRuns: 50 })`).

#### `app/lib/labelScheme.ts` (edit: `sounds` mode)

Add `{ readonly mode: 'sounds' }` at L14-18 and a `sounds` branch next to every `xeno` branch. Per RESEARCH Pattern 7, `formatZoneLabel` and `zoneLabelsFor` return the **digit** label in this mode:
```typescript
export function formatZoneLabel(zone: number, base: number, scheme: LabelScheme): string {
  if (scheme.mode === 'digits') return formatNumeral(zone, base)       // add: || scheme.mode === 'sounds'
  if (scheme.mode === 'xeno') return formatXenotationForDisplay(zone) || formatNumeral(zone, base)
```
Sites: `schemeAlphabet` L24-28 (returns `null`), `formatZoneLabel` L35-41, `zoneLabelsFor` L44-61 (digits fast path L45-49), `formatLabelScheme` L64-75 (`'sounds'`), `parseLabelScheme` L83-95 (`if (raw === 'sounds') return { mode: 'sounds' }`), `labelSchemeKey` L98-109. All three `switch` statements are exhaustive without a default, so TypeScript will point at each missing case.

#### `app/lib/worker/protocol.ts` (edit: guard)

L72-76, one token:
```typescript
function isLabelScheme(v: unknown): v is LabelScheme {
  if (!isRecord(v)) return false
  const mode = v.mode
  if (mode === 'digits' || mode === 'xeno') return true      // add: || mode === 'sounds'
```
Test: `tests/app/workerCore.test.ts` L94-100 (`schemes` array) gains `{ mode: 'sounds' }`; L75-88 `resultKey` tests gain a `sounds` difference. The pinned single `new Worker(` static test (`workerClient.test.ts` L701-711) stays untouched: no second worker.

#### `app/lib/demonBrowser.ts` and `app/lib/demonSearch.ts` (edit)

`demonBrowser.ts` L185-210 is the seam. Keep `demonNameTable`/`demonName` as the CCRU lookup; extend `legacyDemon` with an **optional** third argument (a resolver) so existing callers are unchanged:
```typescript
export function legacyDemon(d: DemonRef, base: number): Demon {
  return { a: d.a, b: d.b, name: demonName(base, d.mesh) ?? formatNetSpan(d.a, d.b, base), kind: legacyKind(d.subtype) }
}
```
`demonSearch.ts` L103-116 reads names through `demonNameTable(g.base)` (a 45-entry table at base 10, `count <= NAME_SEARCH_MAX_COUNT`). After this phase it must read the **live** names or `Lurgo` would still match after the user switches to generated names; parse signature change touches `parseDemonQuery(raw, g)` and `resolveDemonSearch(...)`, whose callers are `DemonBrowser.tsx` L36, so thread an optional resolver parameter and keep tests at `tests/app/demonSearch.test.ts` valid by default.

#### `app/hooks/usePanelDrag.ts` (edit)

Current shape (L3-27, L78-90, L101-105, L117-129): `PanelPositions` interface with nine panels, `INITIAL_Z_INDEX`, `startDrag` seeding from **stored** positions, `zCounterRef` growing without cap, dead `stackPanels`.
```typescript
const startDrag = useCallback((panel: string, e: React.MouseEvent) => {
  const pos = positions[panel as keyof PanelPositions]    // trap: for a derived panel this is not where it is drawn
  if (!pos) return
  ...
  dragRef.current = { panel, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
}, [positions])
```
Required changes (RESEARCH Pattern 9, UI-SPEC Desktop Panel Stack Rule): add `names` (position and z 49); accept `derived`; return `positions` = displayed (derived for unmoved, stored for moved) so the ten call sites need no change; seed drag from the displayed position; add `moved` on first mouse **move** not mouse down; z re-rank when the counter would pass 69 (onto 40..49, continue from 50); remove `stackPanels` (dead) and the two `setPanelPositions` callers. Extract the drag/z logic as pure reducers (RESEARCH "Drag seed and z re-rank") so it is unit-testable, because the hook has no jsdom test today.

### Components

#### `app/components/names/NamesPanel.tsx` (component)

**Analog:** `app/components/numogram/BasePicker.tsx` for control behaviour, `LabelSchemeControls.tsx` for radio rows.

**Every root carries `data-post-baseline`** (`BasePicker.tsx` L173-176, L263-267):
```tsx
<div ref={dropdownRef} data-post-baseline="" className="fixed z-[120] w-[340px] space-y-2 p-2 font-mono" ...>
```
(`CyberPanel` supplies it for the panel root through `postBaseline`, L28 and L100.)

**Commit on Enter, never per keystroke** (`BasePicker.tsx` L128-130):
```tsx
function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (e.key === 'Enter') evaluateNow(candidate)
}
```
**Do not clobber a draft with an external update** (L77-81): a `dirty` flag guards the re-sync effect; copy it for the seed field and for each sound field draft.

**Deferred blur** (L141-156): checking `document.activeElement` after a tick avoids closing or committing on the intermediate `relatedTarget = null` of a label-forwarded radio click. Needed for the radio rows inside the panel if blur commits the seed field.

**Inline refusal** (L251-255): `<p role="status" className="text-[10px] text-[#f87171]">`. For Names, visible status lines carry **no role** and the single persistent carrier does the announcing (UI-SPEC Accessibility Contract), so copy the carrier, not the role:
```tsx
{/* Persistent sr-only live carrier (checker recommendation 1): it exists before its text changes, so a
    computing line then the ready line are announced reliably. */}
<span role="status" data-picker-status="" className="sr-only">
  {announcement}
</span>
```
**Radio rows and eyebrows** (`LabelSchemeControls.tsx` L69-74):
```tsx
<div className="flex items-center gap-2">
  <span className="text-[8px] uppercase tracking-[0.3em] text-gray-400">Labels:</span>
  <CyberRadio name="ccrug-labels" label="Digits" checked={digitsChecked} onChange={selectDigits} />
```
Names rows use `flex flex-wrap gap-x-3 gap-y-1` with `min-h-[24px]` wrappers and the `name` values from the UI-SPEC (`ccrug-names-source`, `-style`, `-join`).

**Field markup** (`CyberInput.tsx` L14-24, `globals.css` L69-111): `ui-terminal-field` wrapping `<input className="ui-terminal-input w-full px-0 py-2 text-sm text-gray-100">`. Do **not** use `CyberInput` (no key handling, aria or id); build the same markup with the new modifier classes.

**Mount in `NumogramClient.tsx`** (copy props from the Text panel, L1909-1918, but not the `hasDiagram` guard):
```tsx
<Panel id="text" title="Text"
  postBaseline
  position={isMobile ? mobilePanelPositions.text : panelPositions.text}
  width={isMobile ? mobilePanelWidth : INFO_PANEL_WIDTH}
  zIndex={panelZ.text}
  draggable={!isMobile}
  collapseDirection="vertical"
  onHeightChange={onPanelHeight}
  onActivate={activatePanel}
  open={textOpen} onToggle={() => setTextOpen(o => !o)} onDragStart={startDrag}>
```
Add `headerRight` (the tag) and `maxBodyHeight={bodyMax}`; width is 240 on desktop (a new constant) and `mobilePanelWidth` on mobile. `CyberPanel` wraps its collapsed children at `maxHeight: isOpen ? maxBodyHeight || 500 : 0` (L227-237), so the inner scroller `data-names-scroll` takes `maxHeight: bodyMax - 12`, `overflowX: hidden`, `overscrollBehavior: contain`.

**Keyboard safety:** the app's global handler returns early for INPUT, TEXTAREA, SELECT and contenteditable (`NumogramClient.tsx` L1116-1126), so Names fields never trigger `A S D F` or digit shortcuts, and Ctrl/Cmd+Z in a field is the browser's text undo. `CyberButton`'s own shortcut listener has the same guard (L49-62).

#### `app/components/names/ZoneList.tsx` (virtualized list)

**Analog:** `app/components/demons/DemonRowList.tsx`.

**Virtualizer with a sticky header** (L77-83, L175-190):
```tsx
const virtualizer = useVirtualizer({
  count: win.size,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => ROW_HEIGHT_PX,
  overscan: 12,
  scrollMargin: ROW_HEIGHT_PX,
})
...
<div role="row" aria-rowindex={1}
  className="sticky top-0 z-[1] grid px-2 text-[8px] uppercase tracking-[0.12em] text-gray-500"
  style={{ height: ROW_HEIGHT_PX, gridTemplateColumns: COLUMNS, alignItems: 'center', background: 'rgba(8,8,15,0.97)' }}>
```
**Absolutely positioned rows** (L191-232): spacer `height: virtualizer.getTotalSize()`, each row `position: 'absolute', top: item.start - ROW_HEIGHT_PX`, selected token `background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)'` (the Phase 5 selected-row token the UI-SPEC reuses for the pinned zone).

**Reveal and scroll to an index** (L85-98): `virtualizer.scrollToIndex(i, { align: 'center' })` once per pin.

**Differences to respect:** rows hold inputs, so use a roving `tabIndex` and per-row focus (not `aria-activedescendant`, L168); the scroll container is the shared `data-names-scroll`, so `scrollMargin` = measured height of the controls block (UI-SPEC), fixed 28 px rows (`ROW_HEIGHT_PX` there is 22, `demonBrowser.ts` L231), overscan 8, no pager (4,000 rows, no windowing needed). The existing keyboard model (L115-134) is the vocabulary to adapt: Arrow, PageUp/PageDown by 10, Ctrl+Home/End.

#### `app/components/names/CollisionReport.tsx` (sliced job)

**Analog:** `app/components/demons/DemonMatrix.tsx` L182-209, the repo's one time-sliced, cancellable background job:
```tsx
const gen = ++genRef.current
setRasterState('drawing')
const t0 = performance.now()
function slice(): void {
  if (genRef.current !== gen) return
  const start = performance.now()
  while (row < height && performance.now() - start < 8) { ...rasterizeRows(job, row, next)... }
  if (row < height) requestAnimationFrame(slice)
  else { setRasterMs(Math.round(performance.now() - t0)); setRasterState('done') }
}
requestAnimationFrame(slice)
return () => { genRef.current++ }
```
Copy `genRef` cancellation and the `data-*-state` attribute idea (`data-names-collisions` with `aria-busy`). The engine stepper's `shouldYield` is `() => performance.now() > deadline` supplied here (the engine cannot read time). The 150 ms grace before `Checking...` is `PENDING_GRACE_MS` from `app/lib/canvas/diagramModel.ts` L21. Empty/status text styling: `DemonBrowser.tsx` L82-93 (`#f87171` is refusal only; collisions are gray-100 per UI-SPEC, not red).

#### `app/components/names/DemonNameEditor.tsx` (one component, three mounts)

**Analog:** `CyberInput.tsx` for the field, `BasePicker.tsx` L128-139 for Enter and Escape, and `InfoDisplay.tsx` `DemonInfo` for the mount point.

**Mount** (`InfoDisplay.tsx` L291-360): both variants of `DemonInfo` end with a `<SectionFrame color={kindClr}>` containing `DataRow`s. Add the editor as a sibling after the frame, inside the same `space-y-1.5` wrapper, with its own `data-post-baseline` root and `data-demon-name-context`. `DemonInfo` already resolves the authoritative demon through `g.demons.ref(d.a, d.b)` (L295), so the editor keys on `ref.mesh`.

**Binding to the demon, not to hover:** `DemonsOverlay.tsx` L69-70 decides what the detail pane shows:
```tsx
const selectedMesh = pinnedInfo?.type === 'demon' ? g.demons.meshOf(pinnedInfo.demon.a, pinnedInfo.demon.b) : null
const shown = hoverInfo?.type === 'demon' ? hoverInfo : pinnedInfo?.type === 'demon' ? pinnedInfo : null
```
While an editor is open the pane must keep showing the bound demon (UI-SPEC Editor binding). The aside is at L220-232. The overlay's `onDialogKeyDown` (L86-121) already lets INPUT targets type; typing targets are exempt from its letter-swallow.

**Selection panel mount is already stable:** it receives `hoverInfo={null}` (`NumogramClient.tsx` L1964).

**Name resolution at render time:** `useNaming()?.nameOf(a, b) ?? d.name` in `DemonInfo` (L314, L344) and as a third argument to `selectedInfoMeta` (L382-401, currently `title: info.demon.name`).

#### `app/components/names/NamingContext.tsx` (provider)

**Analog (near clone):** `app/components/numogram/ViewContext.tsx` L29-36:
```tsx
export const NumogramViewContext = createContext<NumogramViewContextValue | null>(null)
export function useNumogramView(): NumogramViewContextValue {
  const value = useContext(NumogramViewContext)
  if (value === null) throw new Error('useNumogramView outside NumogramViewContext.Provider')
  return value
}
```
**Deviation:** `useNaming()` must **return null** instead of throwing, so provider-less render tests (seven of them build the view context by hand) and the headless path stay valid. Mount the provider next to `NumogramViewContext.Provider` (`NumogramClient.tsx` L1480 and L2016), at every tier.

#### `app/components/ui/CyberButton.tsx`, `CyberRadio.tsx`, `CyberCheckbox.tsx` (additive props)

**Analog:** `CyberButton.tsx` L17-24 (the Phase 5 tab props: all default `undefined`, so React emits no attribute) and its render L82-99.
```tsx
/** Tab semantics (Phase 5 plan 09, T-05-31): all four default to undefined, so every existing call site emits
 * exactly the same DOM as before this change (the markup-identity test pins this). */
role?: 'tab'
...
aria-controls={controls}
```
Add `ariaLabel`, `title`, `ariaExpanded`, `ariaPressed`, `dataAttrs` (keys filtered to `data-` prefix) the same way. **Class-string trap for `CyberRadio`:** its class (L21) is `inline-flex cursor-pointer items-center gap-2 text-xs tracking-[0.12em] uppercase ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`; appending `${className}` unconditionally changes the trailing whitespace of default markup. Append `${className ? ` ${className}` : ''}` so the default string is byte-identical. `CyberCheckbox` already has `${className}` (default `''`) in its class (L30) and needs only `dataAttrs` (spread onto the `<input>` or `<label>`, decide and test).

**Test (exact analog):** `tests/app/demonsOverlayRender.test.ts` L49-68 pins the pre-change markup string verbatim and compares with `renderToStaticMarkup(createElement(CyberButton, { children: 'A' }))`:
```typescript
const DEFAULT_MARKUP = '<button type="button" class="relative uppercase transition-all px-2.5 py-2 text-[11px] tracking-[0.12em] bg-transparent hover:bg-white/[0.03]  ">A</button>'
```
Capture the `CyberRadio` and `CyberCheckbox` default strings from the **unmodified** components before editing, in `tests/app/cyberControlsMarkup.test.ts`.

#### `app/components/numogram/NumogramIcons.tsx` (edit: `LockIcon`)

**Analog:** `DemonsIcon` L225-236 (stroke paths at `opacity="0.6"` plus filled accent shapes, all taking `clr`) and `ShareIcon` L127-137:
```tsx
export function DemonsIcon({ clr }: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M7 7L17 7" stroke={clr} strokeWidth="1.1" opacity="0.6" />
      ...
      <circle cx="7" cy="7" r="2" fill={clr} />
```
`LockIcon({ clr, locked })`: body rectangle plus a shackle that is closed when locked and open (shifted up, unjoined) when not, one accent dot at opacity 0.6. Rendered 14x14 inside a 24x24 button. The file is exempt from the `base-ten` gate.

#### `app/components/numogram/LabelSchemeControls.tsx` (edit: fourth radio)

L34-36 compute the checked flags and L43-46 the handlers; mirror `xeno`:
```tsx
const customChecked = scheme.mode === 'preset' || scheme.mode === 'custom' || open
const xenoChecked = !customChecked && scheme.mode === 'xeno'
function selectXeno(): void { setOpen(false); onChange({ mode: 'xeno' }) }
```
Add `soundsChecked`, `selectSounds`, a `CyberRadio label="Sounds"` between Xeno and Custom (L72-73), `flex-wrap gap-y-1` on the row (L69 currently `flex items-center gap-2`), and the one-line note. The row is inside the `data-post-baseline` portal (`BasePicker.tsx` L173-176), so the wrap changes no baseline. Existing e2e finds radios by exact label text through `radioLabel` (`e2e/viewer-helpers.ts` L33-35), so a new `Sounds` radio cannot collide with `Digits`, `Xeno` or `Custom`.

#### `app/components/panels/LabelsPanel.tsx` (edit)

L14-18 `LABEL_META`, L27-30 `numbersInfo`, L34-43 items. `labelScheme` is already on `useNumogramView()` (`ViewContext.tsx` L17), so no context change. Only while `labelScheme.mode === 'sounds'` the `numbers` row label reads `Sounds` and its info reads the sounds copy; every other string stays byte-identical (the baseline records them at base 10).

#### `app/components/demons/DemonRowList.tsx` and `DemonMatrix.tsx` (name display)

`DemonRowList.tsx` L242-244:
```tsx
<div role="gridcell" data-col="name">
  {demonName(base, d.mesh) ?? ''}
</div>
```
becomes the resolved name (empty only while `pending`), with the `*` marker as a **sibling** `<span data-post-baseline="" data-name-overridden>` outside the truncating element; `useNumogramView()` (L65) supplies `base`, add `useNaming()`. Do not add attributes to the existing `role="gridcell"` element. Canonical names stay unmarked so `toHaveText('Lurgo')` and `toHaveText('Ummnu')` (`e2e/demons-browser.spec.ts` L155, L159) remain true.

`DemonMatrix.tsx` L74-77:
```tsx
function demonText(d: DemonRef, zoneLabel: (z: number) => string): string {
  return `${netSpanLabel(d.a, d.b, zoneLabel)}${SEP}${d.mesh}${SEP}${SUBTYPE_LABEL[d.subtype]}`
}
```
gains a name argument and an extra `${SEP}${name}` segment (omitted while pending; cut at 32 graphemes with the ellipsis built via `String.fromCodePoint(0x2026)`). Call sites: L308 (tooltip) and L397 (live text). `SEP` is at L48.

#### `app/components/projection/Projection.tsx` (edit: SVG label slot)

Props interface L17-57 gets an optional `zoneSounds` (or a lookup) so the default render is untouched. The zone node is at L719-846. Only the **non-planetary** label branch changes (L814-821):
```tsx
{showNumber && (
  <text x={p.x} y={p.y + 1}
    textAnchor="middle" dominantBaseline="central"
    fill={act || hl ? clr : `${clr}aa`}
    fontSize={labelSize} fontWeight="bold" fontFamily="monospace"
    style={{ pointerEvents: 'none' }}
  >{zoneLabels[z]}</text>
)}
```
In `sounds` mode: fitted `fontSize`, truncated text, plus `data-sound-label` and (when cut) `data-truncated="true"`, **only in `sounds` mode**. The accessible name at L727 (`const zoneAriaLabel = \`Zone ${zoneLabels[z]}, ${regionLabel(...)}${act ? ', selected' : ''}\``) becomes `Zone {digits}, sound {sound}, {Region}` only in `sounds` mode. The planetary branch (L776-811) and `PairGraphProjection` keep numerals. The 60 goldens capture the default path, so nothing outside the `sounds` condition may change; `Projection` is `React.memo`, so a new optional prop is safe.

#### `app/lib/canvas/draw.ts`, `CanvasDiagram.tsx`, `keyboardModel.ts`, `diagramModel.ts` (edit: Canvas label passes)

`DrawState` (L69-83) carries `zoneLabels: readonly string[]`; `OverlayState` extends the same data (CanvasDiagram builds both: L625-643 overlay, L708-721 static, with `zoneLabels` in each dependency list L729-746). Add an optional sound lookup to both.

**Static node pass** (L877-886):
```typescript
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
if (showNumber) {
  ctx.font = `bold ${scene.labelSize * geo.s}px monospace`
  for (const v of visible) {
    ctx.fillStyle = `${v.color}${ZONE_LABEL_SUFFIX}`
    ctx.globalAlpha = v.dim ? ZONE_DIMMED_ALPHA : 1
    ctx.fillText(st.zoneLabels[v.z] ?? '', v.cx, v.cy + LABEL_BASELINE_NUDGE * geo.s)
  }
}
```
**Highlight overlay pass** (L1552-1561): same shape with `e.color` and `e.dim`. In `sounds` mode the font is set **per label** (or per distinct fitted size) inside the loop, and both passes must call the **same pure fit function** so the highlighted label never ghosts over the static one (UI-SPEC). Both stay behind `if (!geo.lod) return` (L839, L1550). The digits path stays byte-identical.

**Accessible names:** `keyboardModel.ts` L179-183 is the single builder:
```typescript
function zoneText(zone: number, text: TargetText, withSelected: boolean): string {
  const region = regionLabel(text.zoneRegion[zone] as RegionId)
  return `Zone ${text.zoneLabels[zone]}, ${region}${withSelected ? SELECTED : ''}`
}
```
`TargetText` (L162-173) gains an optional `zoneSounds`; `diagramModel.ts` L153-170 `targetTextFor(view, zoneLabels, index, scene, selZones)` builds it, called at `CanvasDiagram.tsx` L269-270. The e2e twin of this string is `zoneText()` in `e2e/canvas-tier.spec.ts` L97-99.

**Test analog:** `tests/app/canvasDraw.test.ts` builds a recording 2D context (L63-160), `stateFor(fx, over)` (L293-309) and asserts per-label `fillText` args and `style.font` (L910-939). Add: static pass and overlay pass emit identical text and font size for one highlighted node in `sounds` mode; no text below `labelsShown(rPx)` (L895-908 is the template).

#### `app/components/numogram/ShortcutsModal.tsx` (edit)

One line inside the existing post-baseline block (L49-53), whole line `text-gray-400` with **no accent lead-in**:
```tsx
<div data-post-baseline="" className="grid gap-1.5">
  <div><span style={{ color: '#10ff50' }}>Diagram:</span> Up to {svgRichMaxN} zones: ...</div>
  <div className="text-gray-400">Above {svgRichMaxN} zones: ...</div>
```
Add `<div className="text-gray-400">Names panel: ...</div>` with the UI-SPEC copy.

#### `app/globals.css` (edit: two modifier classes)

New classes only, placed **after** `.ui-terminal-field` (L69-90) so equal specificity resolves by order:
```css
.ui-terminal-field {
  position: relative; display: block; padding-right: 14px;
  border-bottom: 1px solid rgba(16, 255, 80, 0.35);
}
.ui-terminal-field::after { ... background: linear-gradient(90deg, rgba(16,255,80,0.7), rgba(16,255,80,0.08)); opacity: 0; ... }
.ui-terminal-field:focus-within::after { opacity: 1; }
```
`.ui-terminal-field--quiet { border-bottom-color: rgba(255,255,255,0.12); padding-right: 0; }` and `.ui-terminal-field--invalid { border-bottom-color: #f87171; }` plus `.ui-terminal-field--invalid::after { background: #f87171; opacity: 1; }` (must also beat the `:focus-within::after` rule, so write it with equal or higher specificity and later in the file).

#### `app/NumogramClient.tsx` (edit; anchors for each concern)

| Concern | Anchor | What changes |
|---|---|---|
| Panel ids, order, heights, widths | L91-110 | add `names` first to `PANEL_GROUP_ORDER`; `names: 34` in defaults; add `NAMES_PANEL_WIDTH = 240` |
| Naming state and session | after L218 (the `useState` block) | working naming, saved flag, preview, `rev`; `namesOpen` (default false) |
| `ShareState` literal | `currentShareState` L326-347 | add `names` and its dependency |
| History | `HistorySnapshot` L113-129, `snapshotState` L349-369, `snapshotKey` L371-373, `applySnapshot` L375-412 | add `naming` (immutable) and key by `rev`: replace `JSON.stringify(snapshot)` with a replacer that maps `naming` to `rev` (Pitfall 7); `applySnapshot` already refuses another base (L379) |
| Base switch | `resetForBaseSwitch` L417-438 | load that base's slot or the default here, so SVG commit and worker swap behave alike; history clearing exists |
| Hydration | URL effect L729-807, worker path L745-761, `applyHydratedState` L839-858, `applyWorkerResponse` L863-898 | apply the `names` link (preview rule); at worker bases stash with `pendingHydrationRef` |
| Desktop stack | one-shot effect L1220-1249, `infoPanelInitRef` effect L529-549, `onPanelHeight` L1206-1218, `usePanelDrag` destructure L256-265 | replace with a derived stack; `selectionX` into state; add `names` to the height guard |
| Panel mount | after the Selection panel L1971 | `<Panel id="names" ...>` at every tier |
| Provider | L1480 / L2016 | wrap with `NamingContext.Provider` beside `NumogramViewContext.Provider` |
| Share button | L1789-1794 (`title` and `aria-label` both `"Share current state"`) | only the `title` changes while uncarried edits exist; `aria-label` stays |
| Labels | `labelsOn` L1438; mounts L1630-1665 (Projection), L1669-1698 (CanvasDiagram) | pass sounds only when `labelScheme.mode === 'sounds'` and the base is within the ceiling |
| Keyboard | handler L1115-1175 | no change (typing targets already ignored, L1116-1126) |

`Panel` is the local alias `CyberPanel as Panel` (L59). `usePanelGroupLayout` stays as is (mobile).

### Tests (new)

#### `tests/app/panelStack.test.ts`

Copy the old formula literally (the L1231-1246 snippet above) as the oracle and compare against `computeDesktopStack` at the measured base-10 heights (RESEARCH Pattern 9: Layers 146, Labels 101, Zones 270, Regions 145, Syzygies 143, Currents 143, Gates 270, Text 30, Selection 296.5) and over fast-check random heights (`{ seed: ..., numRuns: ... }` as `arith.test.ts` L27-35). Also: follow on collapse, moved panels keep their slot reserved, names `x = min(max(selectionX, 548), vw - 252)`, `bodyMax = clamp(80, vh - (y + 34) - 96, 560)`, drag seed (mouse down without move leaves position unchanged), z cap (80 activations, max 69, activated panel on top).

#### `tests/app/namesPanelRender.test.ts`, `tests/app/cyberControlsMarkup.test.ts`

Server-render, plain `createElement` (no JSX) with a hand-built context. Template: `tests/app/demonRowListRender.test.ts` L19-53:
```typescript
function buildCtx(g: Numogram): NumogramViewContextValue {
  const base = g.base
  return { base, g, summary: summarize(g), view: null, zoneLabels: null, labelScheme: DEFAULT_LABEL_SCHEME,
    zoneLabel: (z: number) => formatZoneLabel(z, base, DEFAULT_LABEL_SCHEME), svgRichMaxN: SVG_RICH_MAX_N,
    allChordsMaxN: ALL_CHORDS_MAX_N, gateMode: 'off', tier: 'headless', interactiveMaxN: INTERACTIVE_MAX_N }
}
```
Assert the always-mounted `[data-names-live]` carrier (`role="status"`, `aria-live="polite"`) renders while collapsed, the body does not (page-weight Pitfall 13), the seed-only state at `INTERACTIVE_MAX_N + 2`, and the row cap (virtualizer renders a minimal range on the server, so assert only the upper bound as `demonRowListRender.test.ts` L79-86 does).

#### `tests/app/namingSession.test.ts`, `namingStorage.test.ts`, `soundLabels.test.ts`, `shareParamsNames.test.ts`

Session and storage: pure functions plus injected fakes (the `workerClient.test.ts` approach: a fake worker with driven callbacks, no jsdom). Storage must cover a throwing `localStorage` getter, `QuotaExceededError`, and a corrupt slot. Codec: round-trip with `fc.assert` as `shareParams.test.ts` L467-490, hostile inputs, and a spy proving no numogram is built above the ceiling (`shareParamsHeadless.test.ts` L9-33). The 40-URL baseline corpus round trip (read-only, `shareParams.test.ts` header) must stay byte for byte because `names` is omitted at its default.

### E2E

All specs follow the repo preamble (`e2e/canvas-tier.spec.ts` L45-60, `e2e/demons-browser.spec.ts` L11):
```typescript
test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-utc', 'Phase 6 UI specs run once (UTC context)'))
test.use({ viewport: { width: 1280, height: 800 } })
function trackErrors(page: Page): string[] { const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); return errors }
```
Bases and ceilings come from `app/lib/tierBounds` (`INTERACTIVE_MAX_N`, `SVG_RICH_MAX_N`), never typed (`canvas-tier.spec.ts` L50-51). Expected values are computed through the engine, never read back from the app.

- **Opening the viewer:** `openViewer`, `openCanvas`, `openHeadless`, `openFor(page, base)` in `e2e/viewer-helpers.ts` L54-117 (`openFor` picks the right one from `tierFor`).
- **Demons overlay:** `openDemons`, `demonRow`, `demonList` in `e2e/demons-helpers.ts`.
- **`e2e/names-labels.spec.ts`:** `e2e/label-scheme.spec.ts` L14-37 (`openDropdown`, `radioLabel(page, 'Sounds').click()`, `boldLabel` = `[data-zone="z"] text[font-weight="bold"]`, URL assertion `toHaveURL(/labels=sounds/)`, reload round trip, `trackErrors`).
- **`e2e/panel-stack.spec.ts`:** drag test at `e2e/behaviour.spec.ts` L197-222 (header `span` box, `mouse.move/down/move(steps: 6)/up`, `left/top/zIndex` read from `style`), viewport changes at `canvas-interaction.spec.ts` L302 (`test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })`) and L402 (`setViewportSize`). Todo 008's regression (base 10 then 28 through the picker, `openBaseDropdown` pattern from `region-legend.spec.ts` L21-23) closes the todo and goes into `region-legend.spec.ts` next to a real mouse click on a Warp or Plex Isolate/Mute button.
- **`e2e/demons-browser.spec.ts` L172-182** (`other bases keep an empty NAME column`): rewrite to assert non-empty, capitalised, engine-computed names at base 28; keep L151-170 (the base-10 canonical checks) unchanged.
- **Layout-sensitive specs to re-run:** `canvas-interaction`, `layers-zoom`, `canvas-tier`, `row-click-regression`, `region-legend`, plus `npm run test:swap`.

## Shared Patterns

### Post-baseline marker (frozen baseline and 60 goldens)
**Source:** `e2e/behaviour-collect.ts` L9-27 (`postBaseline = el.closest('[data-post-baseline]') !== null`) and `app/components/ui/CyberPanel.tsx` L100.
**Apply to:** every new DOM root: the Names panel (`postBaseline` prop), the preview notice, the demon name editor, the browser's overridden marker span, the sounds-mode note, the Shortcuts line, the live carrier. A new attribute on an **existing** element in a default render is forbidden; hooks live on new elements. Existing precedent: `BasePicker.tsx` L173-176, `DemonsOverlay.tsx` L134, `CanvasDiagram.tsx` L953 (`data-canvas-live="" data-post-baseline=""`).

### Typed, never-throwing validation with a `reason`
**Source:** `engine/core/base.ts` L7-12, L36-49; `app/lib/customAlphabet.ts` L77-101; `app/lib/worker/protocol.ts` L85-106.
**Apply to:** `engine/naming/text.ts`, `validate.ts`, the `names` URL parser, the storage reader. Echoes of user text go through `clipEcho` (`base.ts` L14-19).
```typescript
export type BaseCheck =
  | { readonly ok: true; readonly base: number }
  | { readonly ok: false; readonly reason: BaseProblem; readonly message: string }
```

### Lenient per-field URL parsing, strict only where the contract says so
**Source:** `app/lib/shareParams.ts` L170-176 doc and L204-216; `app/lib/demonState.ts` L58-84.
**Apply to:** `names`, `nstyle`, `njoin`, `nsmooth`: unknown values fall back to the default without invalidating the seed; length bound before any regex; anchored regexes; the raw string is never an object key.

### Named constants, tier numbers by property access
**Source:** `app/lib/tierBounds.ts` L16-34; `app/lib/canvas/diagramModel.ts` L19-24; `scripts/check-repo.mjs` L244-257.
**Apply to:** all new `app/` files (loops over `.length`, `MAX_DEPTH`, `SOUND_MAX_LENGTH`, never `<= 9`, `<= 4`, `length: 10`). `INTERACTIVE_MAX_N` and `LABEL_MIN_RADIUS_PX` are imported, never typed.

### Injected platform dependencies for testability
**Source:** `app/lib/glyphCoverage.ts` L8-36; `app/lib/worker/workerClient.ts` L17-26.
**Apply to:** `namingStorage.ts` (storage), the collision job (`shouldYield`), any `crypto.getRandomValues` for Reroll (UI code only, never `engine/`).

### Cancellable time-sliced work
**Source:** `app/components/demons/DemonMatrix.tsx` L182-209.
**Apply to:** the collision scan (generation counter, 8 ms slices, `requestAnimationFrame`).

### Persistent sr-only live carrier
**Source:** `app/components/numogram/BasePicker.tsx` L298-302; `CanvasDiagram.tsx` L953; `DemonMatrix.tsx` L503.
**Apply to:** the Names panel (always mounted, announcements user-initiated only), the editor, undo/redo and Share announcements.

### Immutable edits sharing unchanged parts
**Source:** `app/lib/regions.ts` L116-137.
**Apply to:** `engine/naming/edit.ts`, the session reducer, history snapshots (replace the whole naming by its `rev` in the key).

### Frozen oracles and sign-off pins
**Source:** `engine/test/layout.digest.test.ts` L1-8 (header), CLAUDE.md "base-10 oracle is frozen".
**Apply to:** Appendix B vectors and the post-sign-off sound-table digests. Never `-u`, never edit a digest to turn a test green; the 60 DOM goldens, `e2e/__behaviour__/`, `engine/test/fixtures/**` stay byte-identical (`npm run test:swap` after any `NumogramClient`, `usePanelDrag`, `shareParams` edit).

### Unicode as data, not typed escapes
**Source:** `app/lib/demonSearch.ts` L135-140, `DemonRowList.tsx` L23-25, `diagramModel.ts` L23, `base10-adapter.test.ts` L466 (`BACKSLASH = String.fromCharCode(92)`).
**Apply to:** `…` (U+2026), `·` (U+00B7), the key-schedule separator (`String.fromCharCode(0)`), every non-ASCII fixture (`String.fromCodePoint`).

### File header convention
Every `app/` file opens with a one-line purpose and `Original CCRUG code (MIT, NOTICE section 1).` (`customAlphabet.ts` L1, `selectionList.ts` L1, `workerClient.ts` L1); components begin with `'use client'` (`CyberButton.tsx` L1) or place it after the header comment (`DemonRowList.tsx` L2). `app/presets/base10/*.ts` headers say `the names are in lore.ts` (`demons.ts` L1). No upstream branding anywhere, and no new file may reintroduce the old names (CLAUDE.md).

## No Analog Found

| File / behaviour | Role | Data Flow | Reason |
|---|---|---|---|
| `app/lib/namingStorage.ts` (storage access itself) | utility | storage I/O | No `localStorage` or `sessionStorage` use anywhere in `app/`, `engine/` or `workers/`; use RESEARCH Pattern 8 plus the injected-dependency pattern above |
| Export download and import file read (`Blob` + anchor, `<input type=file>`, `File.size`, `File.text()`) in `NamesPanel.tsx` and `e2e/names-io.spec.ts` | component / e2e | file I/O | grep for `createObjectURL`, `type="file"`, `FileReader`, `.text()` in `app/`, `engine/`, `workers/`, `scripts/` found nothing; Playwright `setInputFiles` and `waitForEvent('download')` are new to the suite |
| `Intl.Segmenter` grapheme counting in `engine/naming/text.ts` | utility | transform | No usage in the repo; RESEARCH Pattern 6 gives the code and the regex fallback (typed under `lib: ES2022`, verified) |
| `crypto.getRandomValues` for the Reroll seed | UI code | n/a | Not used anywhere yet; RESEARCH "Standard Stack" |
| PRNG and Feistel bodies (`prng.ts`, `feistel.ts`) | utility | transform | No randomness or permutation code exists; style analog is `arith.ts`, algorithm is RESEARCH Pattern 1 and Code Examples with the Appendix B vectors |
| Inline result status with `Undo this change` calling the app's `onUndo` | component | event-driven | No existing inline-undo UI; the history stack (`NumogramClient.tsx` L1083-1113) is the engine behind it |
| Roving-tabindex editable virtual list | component | CRUD | `DemonRowList` is a read-only grid with `aria-activedescendant`; only the virtualizer, sticky header and scroll-to-index patterns transfer |
| Drag/z-index pure reducers | hook | event-driven | Only the current `usePanelDrag.ts` exists; RESEARCH "Drag seed and z re-rank" sketches the reducers |

## Metadata

**Analog search scope:** `engine/` (core, layout, scene, test), `app/` (NumogramClient, hooks, lib, lib/worker, lib/canvas, components/*, presets/base10, globals.css), `tests/app`, `tests/presets`, `e2e/`, `scripts/`, `.eslintrc.json`, `vitest.config.mts`, `playwright.config.ts`, `package.json`, `engine/tsconfig*.json`.
**Files read for excerpts:** about 60 (every file cited above); greps for `localStorage`, file I/O, `Intl.Segmenter`, `legacyDemon`, `demonName`, `post-baseline`, `aria-live`.
**Not read (cited by name only, convention inferred from siblings):** `engine/test/numerals.test.ts`, `tests/app/baseSwitch.test.ts`, `tests/app/canvasView.test.ts`, `e2e/url-codec.spec.ts`, `e2e/base-switch-reset.spec.ts`, `engine/layout/registry.ts`.
**Pattern extraction date:** 2026-10-20

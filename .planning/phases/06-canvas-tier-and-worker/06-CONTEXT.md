# Phase 6: Canvas Tier and Worker - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Large bases stay interactive: the Canvas tier takes over from rich SVG above `svgRichMaxN` (200) and carries the same features, all engine work above that size runs in a Web Worker so the page never freezes (and a stale result never shows), and past the interactive ceiling the page shows a short message with the summary and text view instead of a diagram (REN-02, REN-03; ROADMAP Phase 6 success criteria 1-5).

Built here: a Canvas renderer behind the same view contract as the SVG tier, selected from data in `engine/scene/tier-table.json`; Canvas hit-testing (zones and edges) with level-of-detail labels; a same-origin Web Worker that works in the Next 14 static export with and without `basePath`; stale-result handling for rapid base changes; the interactive-ceiling message.

Not built here: the real export files and CLI (Phase 8: EXP-01..EXP-04), the naming builder (Phase 7), WebGL (the Phase 3 spike decided no), a user-facing "show it anyway" override (Phase 4 D-18 still holds), and any change to the frozen base-10 oracles.

</domain>

<decisions>
## Implementation Decisions

### Interactive ceiling and the over-limit offer
- **D-01:** The shipped interactive ceiling is **n = 4000**, the largest measured size (`budgets.canvasTargetN` in `tier-table.json`: Canvas stayed inside budget on every profile to 4000). Bases from 202 up to 4000 draw on Canvas; above 4000 the page shows the message plus the summary and text view (the same fallback Phase 4 D-14 built, now moved from above 200 to above 4000). Raising the ceiling later is a data change after re-measuring, not a code change. The table currently records `boundaries.canvasMaxN: null` ("no ceiling found in the measured range") and `validateTierTable` forces a measured table's `canvasMaxN` to equal what the measurements derive, so the shipped ceiling must live as its own data field (planner's call on name and schema) and must not be hard-coded in a component.
- **D-02:** The message follows Phase 4 D-15/D-16/D-18: short and factual, the cutoff number read live from the table, no apology, no "show anyway" button, and the `tier=` URL override stays diagnostic-only. It also **names headless export as the route** for larger bases. The real export button and CLI command are Phase 8 work, so ROADMAP criterion 4 ("offers headless export") is split: Phase 6 delivers the message and the pointer, Phase 8 delivers the export it points at. No JSON download is pulled forward (Phase 8 EXP-03 owns that format).

### What Canvas draws and what is pickable
- **D-03:** **The SVG-lean tier is dropped.** Canvas takes over immediately after `svgRichMaxN` (200). Phase 3's measured `svgLeanMaxN` row stays in the table as measurement history, but no lean renderer is designed or built (this closes the deferral in Phase 4 D-17).
- **D-04:** **Edges follow the table and are drawn on demand for a selection.** Syzygies and currents are always drawn and pickable. The gate layer follows `gateLayerMode` (full up to `gatesFullMaxN` 40, thin up to `gatesThinMaxN` 150, off above). Hovering or pinning a zone always draws that zone's own gate, syzygy partner and current even when the gate layer is off, so no edge becomes unreachable at large n.
- **D-05:** **Canvas carries the whole viewer surface, not a reduced subset.** All four layouts draw on Canvas (ring, ladder, Barker spiral, pair-graph view) and Phase 5's demon focus mode draws a zone's or a demon's chords. Both consume the same coordinate arrays, routes and demon API the SVG tier already uses, so the Canvas tier is not second-class. Existing caps still apply: the all-chords web stays at `allChordsMaxN` 80 (Phase 5 D-04) and layout-switch animation stays at `layoutTweenMaxN` 28, instant above.

### Worker scope and loading experience
- **D-06:** **The worker owns all engine work above `svgRichMaxN` (200); at or below 200 everything stays synchronous exactly as today.** Above 200 the worker builds the numogram, the summary, the text-view data and the Canvas scene (including bases above the 4000 ceiling, where the summary and text view are still shown and `createNumogram` at 2^26 measured about 0.6 s and +271 MiB). Base 10 and every SVG-tier base never become asynchronous, so the 60 DOM goldens, the behaviour baseline and the Phase 4 and 5 interactions see no new timing.
- **D-07:** **While the worker computes, the last result stays visible.** The previous diagram stays on screen slightly dimmed, with a short inline "computing base N" status next to the base picker, and swaps in when the result arrives (the same keep-the-last-valid-base pattern as Phase 4 D-06). Results for bases that were superseded in the meantime are discarded, so rapid base changes (typing, dragging, stepping) never show a stale result.

### Canvas accessibility, touch and small windows
- **D-08:** **The Canvas tier keeps UI-07's promise.** One focusable canvas: arrow keys and Tab move a visible focus ring between zones and along a zone's syzygy, current and gate, Enter pins, and an `aria-live` region announces the focused zone. The Phase 4 text view stays as the fallback route. Reduced-motion and non-colour cues carry over to the Canvas drawing.
- **D-09:** **Hit-testing is forgiving and shared by mouse and touch.** Pinch zooms, one finger pans, a tap pins (there is no hover on touch, so tap does what pin does today). Every pick uses a minimum hit radius of about 12 CSS px whatever the zoom and the nearest zone or edge wins; mouse hover uses the same rule so tiny nodes stay reachable without zooming first. No disambiguation list or magnifier in this phase.

### Carried forward (not re-discussed)
- Label visibility by on-screen node size (about a 7 px radius, `labelVisibleMinRadiusPx` in the table) applies to the Canvas tier as level of detail (Phase 3 D-07).
- Tier selection stays data-driven through the table (`selectTier`, `tierFor`); the `tier=svg|canvas|headless` override stays diagnostic-only (Phase 3 D-13, Phase 4 D-18).
- The frozen oracles never change: the 60 DOM goldens, `e2e/__behaviour__` and the numeric oracle stay green and are never regenerated to make a test pass. Canvas adds new tests, it does not touch the base-10 SVG path.
- The engine stays pure (no DOM or Node types, relative imports only, no O(n^2) materialization); the worker is app-side glue around engine functions.
- Static-first on Next 14.2.35 (exact pin), no server routes; the worker must also run in the exported site with and without `NEXT_PUBLIC_BASE_PATH`, offline (ROADMAP criterion 5).

### Claude's Discretion
How Canvas picking is implemented (uniform-grid zone picking, id-buffer or geometric edge picking: ROADMAP research item), the worker bundling approach under Next 14 webpack in an export build (`trailingSlash`, `basePath`, same-origin worker), the worker message protocol and transferable typed arrays, request ids and cancellation, the fallback when `Worker` is unavailable (for example run on the main thread up to the ceiling), the schema name and file location of the shipped-ceiling datum (D-01), the exact dim opacity and wording of the "computing" status and the over-ceiling message, the focus-ring styling and the announcement wording, how the Canvas scene is cached or redrawn on zoom and pan, and the plan and wave breakdown.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (section "Phase 6: Canvas Tier and Worker") - goal, five success criteria, research flag (Canvas picking, worker bundling in an export build) and notes
- `.planning/REQUIREMENTS.md` - REN-02 and REN-03 (this phase); UI-07 (the accessibility promise D-08 extends to Canvas); REN-01 (the table this phase reads)
- `.planning/PROJECT.md` - core value, scope, key decisions
- `CLAUDE.md` - project rules (frozen oracles, engine purity, static-first, Next 14.2.35 pin, no upstream branding)

### Measured limits and tier selection (data, not constants)
- `engine/scene/tier-table.json` - boundaries (`svgRichMaxN` 200, `svgLeanMaxN` 300, `canvasMaxN` null, `layoutTweenMaxN` 28, `allChordsMaxN` 80, `gatesFullMaxN` 40, `gatesThinMaxN` 150, `labelVisibleMinRadiusPx` 7, `canvasAreaLimitPx` 2^28), `budgets.canvasTargetN` 4000, `webglDecision.adopt: false`, `tierOverrideParam`
- `engine/scene/tiers.ts` - `selectTier`, `gateLayerMode`, `labelsVisible`, `tweenAllowed`, `deriveBoundaries`, `validateTierTable` (the invariants any new shipped-ceiling field must satisfy)
- `engine/scene/tierTable.ts` - the typed `TIER_TABLE`
- `app/lib/tierBounds.ts` - the app's only reader of the table (property access on boundaries only, never the whole JSON, so measurement rows stay out of the viewer bundle)

### Prior decisions this phase builds on
- `.planning/phases/03-procedural-layout-and-ceiling-spike/03-CONTEXT.md` - D-06/D-07 (growing space, label threshold), D-09 (tween cutoff), D-11..D-14 (table, WebGL decision, `tier=` override, conservative hardware profile)
- `.planning/phases/04-base-picker-and-generator-ui/04-CONTEXT.md` - D-04/D-06 (live preview, keep last valid base), D-14..D-18 (over-limit fallback, message wording, no override, lean tier deferred)
- `.planning/phases/05-demons-layer/05-CONTEXT.md` - D-03 (focus mode), D-04 (all-chords cap 80), D-06 (matrix and tooltip interaction model)
- `.planning/phases/03-procedural-layout-and-ceiling-spike/03-08-SUMMARY.md` and `03-10-SUMMARY.md` - what the spike measured and how the table was reviewed

### Code this phase builds on or replaces
- `app/NumogramClient.tsx` - tier gating (`showDiagram = tierFor(base, tierOverride) === 'svg'`), `createNumogram` on the main thread, `viewCtx`, `tierOverride` state (the integration point for the Canvas tier and the worker)
- `app/components/numogram/ViewContext.tsx` - `NumogramViewContextValue` (the shared view contract; `view` is null above the SVG tier today)
- `app/lib/numogramView.ts`, `app/lib/renderData.ts`, `app/lib/viewLayouts.ts` - the view model and layout inputs the Canvas tier must also consume
- `app/components/projection/Projection.tsx`, `app/components/projection/PairGraphProjection.tsx` - the SVG drawing the Canvas tier must match in features
- `app/hooks/useCanvasPan.ts`, `app/hooks/useLayoutTween.ts` - zoom, pan and layout-switch behaviour to mirror
- `app/lib/numogramText.ts` and the text-view component - the accessibility fallback D-08 keeps
- `next.config.js` - static export, `trailingSlash`, optional `basePath`, `eslint.dirs` already lists a `workers` directory
- `engine/layout/*`, `engine/core/*`, `engine/index.ts` - pure layout, routing and numogram functions the worker calls

### Frozen oracles (never regenerate)
- `e2e/__golden__/**`, `e2e/__behaviour__/**` (with their manifests), `engine/test/fixtures/**` - must stay green; the base-10 SVG path is not edited for Canvas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/scene/tiers.ts` already implements data-driven tier selection (`selectTier` svg to canvas to headless), the gate layer modes and the label threshold; Phase 6 consumes them and adds a shipped-ceiling field rather than inventing new selection logic.
- `engine/layout/*` returns typed coordinate arrays (`Float64Array` x and y by zone) and routes; a Canvas renderer and a worker can both use them directly and transfer the arrays without copying.
- `app/lib/numogramView.ts` and `renderData.ts` hold the view model the SVG tier renders; the Canvas tier should read the same model so SVG and Canvas stay in parity.
- `NumogramViewContext` (Phase 4) is the shared state the panels, demon focus and info display already read; the Canvas tier plugs into it instead of adding a parallel state path.
- `next.config.js` already lists a `workers` ESLint directory, anticipating this phase.

### Established Patterns
- Above the SVG tier no view, layout or render structure is built (`view` is null, T-04-08): the same discipline now applies above the Canvas ceiling, and the worker makes the over-ceiling summary and text view safe too.
- "Keep the last valid result, show an inline message next to the picker" (Phase 4 D-06) is the pattern for both the over-limit message and the worker's computing state.
- Measured data lives in the table and is read by property access only (`tierBounds.ts`), never copied into components; new thresholds follow the same route.
- Frozen oracles have strict manifests; new Canvas tests are new files and new dated sets, never edits to frozen ones.

### Integration Points
- `NumogramClient.tsx` is where `tierFor` result decides what renders: Phase 6 adds a `canvas` branch beside `svg` and routes the heavy computation above 200 through a worker client.
- The base picker and over-limit message area (Phase 4) host the inline "computing" status and the ceiling message.
- Phase 5's demon focus state (`demonFocus`, `demonFilter`) already lives in the client and `ViewContext`; Canvas focus chords read it the same way the SVG tier does.

</code_context>

<specifics>
## Specific Ideas

- The ceiling is the measured 4000, not a guess; the user chose this over measuring further or capping lower.
- Typing a very large base (up to 2^26) must never freeze the page: the worker owning the over-ceiling summary and text view is a core requirement, not a nicety.
- Base 28 is the reference for the offline-worker check in ROADMAP criterion 5 (the exported site, with and without `basePath`, computes base 28 through the worker offline). Note that base 28 is below 200, so under D-06 it would normally stay synchronous; the planner must make the worker path testable at base 28 (for example through a diagnostic switch or a lowered test threshold) without changing production behaviour.
- The user recently reported narrow-window layout problems in the viewer (fixed in `43760fb`); Canvas behaviour in small windows should be checked in the browser pane at narrow widths, not only at desktop size.

</specifics>

<deferred>
## Deferred Ideas

- A user-facing "show it anyway" override above the ceiling: declined again (Phase 4 D-18).
- A disambiguation list or magnifier for crowded hit areas: not in this phase (D-09 chose nearest-wins).
- A minimal JSON download pulled forward from Phase 8: declined (D-02); the export format belongs to EXP-03.
- Extending the ceiling past 4000 by measuring further: possible later as a table re-measure, not planned here.

### Reviewed Todos (not folded)
`todo.match-phase 6` returned no matches. Pending todos 002 and 004 (deferred review findings from Phases 1 and 2) and 006 (base 10's drawn shape should match the CCRU numogram) were not folded in: 006 touches the frozen base-10 oracle and needs the user's sign-off before any change, and it concerns the SVG base-10 presets rather than the Canvas tier.

</deferred>

---

*Phase: 06-canvas-tier-and-worker*
*Context gathered: 2026-10-05*

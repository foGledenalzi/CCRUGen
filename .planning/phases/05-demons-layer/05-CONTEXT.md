# Phase 5: Demons Layer - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see, count, browse and inspect every demon of any base without the page freezing: type facets with closed-form counts (including the cross-Torque sub-facet), a virtualized browser over up to C(n,2) rows (221,445 at base 666), a focus mode that draws one zone's or one demon's chords, a triangular pick-by-pixel matrix, and base 10's 45 canonical CCRU demon names surfaced in the browser and detail panel.

Out of scope, belongs elsewhere: worker offload of compute for very large n (Phase 6), Canvas tier for the main diagram (Phase 6), naming builder / user-assigned demon names (Phase 7), export (Phase 8). The engine's `DemonSpace` (virtual, O(1) `at(mesh)`, closed-form `counts()`/`typeCounts()`) already exists from Phase 2 — this phase is UI and rendering work on top of it, not engine work.

</domain>

<decisions>
## Implementation Decisions

### UI Placement
- **D-01:** The demons layer gets a dedicated large panel/overlay, separate from the existing small fixed-width side panels (Zones, Syzygies, Currents, Gates, Regions, Layers, Labels). It needs real estate a ~300px `CyberPanel` can't give a virtualized 221,445-row browser and a triangular matrix.

### Demon Browser (DEM-02, DEM-05)
- **D-02:** Browser columns: `a::b`, mesh number, type/subtype, and a name column. The name column is always present in the table shape — it shows the CCRU name at base 10 and stays empty (not hidden) at every other base, so switching base never changes the table's column layout.
- **D-05:** Type facets (closed-form counts per type/subtype, e.g. base 28: 378 demons, 108 cross-Torque chrono) are presented as clickable filter chips directly above the browser. The facet display and the filter control are the same UI element — clicking a chip filters the browser to that type/subtype, there is no separate read-only summary plus independent filter control.

### Focus Mode (DEM-03)
- **D-03:** Focus mode has two entry points feeding one shared state: clicking a zone in the SVG diagram shows all n-1 of that zone's demons as chords; clicking a demon row in the browser shows that single demon's chord and highlights its two zones in the diagram. Both directions must work — diagram-to-browser and browser-to-diagram.

### Triangular Matrix (DEM-04)
- **D-06:** The matrix is color-coded by demon type/subtype, using the same palette as the diagram's existing kind colors (chrono/amphi/xeno/syzygy). Hovering a cell shows `a::b` / mesh number / type in a tooltip; clicking pins it to the detail panel — mirrors the diagram's existing hover/pin interaction pattern from Phase 4 (`InfoDisplay.tsx`'s pin/hover model). Must support zoom/pan so no cell is ever un-inspectable at large n — the LOD/tiling mechanics for n >= ~4k are for research to determine (flagged as this phase's research task in ROADMAP.md), but the color-by-type encoding and hover/click interaction model are locked now.

### All-Chords Web Ceiling (from Phase 3's ceiling spike)
- **D-04:** Accept `allChordsMaxN = 80` (measured in Phase 3, `engine/scene/tier-table.json`) as a hard cutoff for the all-chords "web" view — no edge-bundling implementation in this phase. Above n=80, users rely on focus mode + matrix + search instead of the full web. This matches the precedent Phase 3 already set when the user declined gate-edge-bundling for a similar web view at the 03-08 checkpoint (2026-09-27) — same call, same reasoning, applied to the demon web this time.

### URL State / Shareability
- **D-07:** Demon-browser state partially follows Phase 4's shareable-URL precedent (`app/lib/shareParams.ts`): the active type/subtype filter and a focused/pinned demon or zone are shareable via URL, consistent with how `isolate=`/`mute=`/`selected=` already work. Matrix pan/zoom position is local-only, not part of the URL — matching how the main diagram's own zoom/pan state isn't in the URL either. Whether the demon panel's open/closed state itself is part of the URL is Claude's discretion during planning.

### Claude's Discretion
- Exact chip ordering/styling for type facets, matrix LOD/tiling algorithm at n >= 4k (explicitly the research task for this phase), exact column widths and sort-affordance styling in the browser, whether the demon panel's open/closed state is itself part of the URL (see D-07).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine contract (authoritative, do not re-derive)
- `engine/core/types.ts` — the `DemonSpace` interface: `at(mesh)`, `ref(a,b)`, `counts()`, `typeCounts()`, `incident(zone)`, `numodemons()`, `group(type)`, `subtype(name)`. All virtual, O(1) or O(log C(n,2)) — never enumerate.
- `engine/core/demons.ts` — the `DemonSpace` implementation, `meshOf`/`netSpanOf` helpers, and the demon classification logic (chrono/amphi/xeno/syzygy, cross-Torque subtype).

### Measured limits (do not re-measure or override without re-running the spike)
- `engine/scene/tier-table.json` — `allChordsMaxN.n = 80` ("last n of the longest prefix where under 30% of inked pixels are crossed by 4 or more chords (legibility, not speed)"). This is the number D-04 accepts as the web-view cutoff.
- `.planning/phases/03-procedural-layout-and-ceiling-spike/03-08-SUMMARY.md` — the prior, directly analogous decision (gate-edge-bundling declined for a similar web view) that D-04 follows.

### Existing UI to extend, not duplicate
- `app/components/projection/Projection.tsx` (~line 271, "Pandemonium layer") — the existing base-10-only all-chords web rendering already gated by `demons !== null` (i.e., already respects the tier's demon-null-above-ceiling contract from Phase 4). Generalize this, don't rebuild it.
- `app/components/info/InfoDisplay.tsx` (`DemonInfo` function, ~line 288) — the existing per-demon hover/pin detail rendering. The matrix's click-to-pin (D-06) and browser row selection should feed into this same detail-panel mechanism.
- `app/components/ui/CyberPanel.tsx` — the collapsible panel component with `collapseDirection`; even though D-01 says demons gets a *dedicated large* panel rather than a small side panel, it should still likely build on this same component for visual consistency (planner's call on exact sizing/variant).
- `app/lib/shareParams.ts` — the unified URL codec (D-07 extends this, doesn't replace it).
- `app/presets/base10/lore.ts` — the single source of the 45 canonical CCRU demon names (DEM-05), keyed by numeric id per Phase 2's D-06.

### Project-level math reference
- `.planning/PROJECT.md` §"Verified numogram math" — demon definitions (`T(n-1) = n(n-1)/2`, mesh number formula) already verified and should not be re-derived from `reference/` (gitignored, may be absent in a fresh clone).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DemonSpace` (engine/core/demons.ts, types.ts): fully built, virtual, closed-form. Phase 5 is a consumer, not a builder, of this API.
- `Projection.tsx`'s Pandemonium layer: base-10-only today, already null-guarded above the tier ceiling — the starting point for the all-chords web at any base.
- `InfoDisplay.tsx`'s `DemonInfo`: existing per-demon detail rendering (name, kind, color-by-kind) to extend for browser/matrix-driven selection, not replace.
- `CyberPanel.tsx`'s `collapseDirection` system: the established panel primitive from Phase 4.
- `app/lib/shareParams.ts`: the single URL codec Phase 4 built — new demon-related params extend this file.

### Established Patterns
- Hover-to-preview / click-to-pin is the interaction model used everywhere else in the viewer (zones, syzygies, currents, gates) — D-06 explicitly continues it for the matrix rather than inventing a new interaction model.
- Tier-gated rendering (`view.demons` null above a measured ceiling) is the existing pattern for "don't materialize what would freeze the page" — the same discipline applies to the virtualized browser (never one DOM/canvas primitive per demon, per ROADMAP.md's explicit note).
- Data and lore are separate and joined by id (Phase 2's `D-06`): the demon browser's name column follows this same separation — CCRU names come from `lore.ts` by id, never duplicated into engine data.

### Integration Points
- The demons panel/overlay needs an entry point from the existing header/toolbar area (alongside the base picker, zoom/fit controls, etc. from Phase 4) — exact placement is a planning-level UI detail, not decided here.
- Focus-mode's diagram-to-browser and browser-to-diagram links need a shared piece of state, likely via `NumogramViewContext` (introduced in Phase 4's 04-09) or a sibling context — architecture is for research/planning to determine.

</code_context>

<specifics>
## Specific Ideas

- Base 28 example used throughout discussion: 378 demons, 108 of them cross-Torque chronodemons — a concrete number the type-facet UI should be able to reproduce exactly.
- Base 666 example: 221,445 demons, 99.4% chronodemons (per ROADMAP.md's note) — the browser and facets must handle this density without a type filter alone being sufficient (hence focus mode + matrix + search all being necessary, not redundant).
- Base 10: 45 canonical CCRU demon names, already fully defined in `app/presets/base10/lore.ts` — nothing new to author, just a new place (browser + detail panel) to surface them.
- `allChordsMaxN = 80` is a specific, non-negotiable-without-new-research number from the measured tier table — D-04 locks the product decision (accept it) but the number itself is not up for debate here.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No todos matched this phase (`gsd-sdk query todo.match-phase 5` returned zero matches).

</deferred>

---

*Phase: 05-demons-layer*
*Context gathered: 2026-09-29*

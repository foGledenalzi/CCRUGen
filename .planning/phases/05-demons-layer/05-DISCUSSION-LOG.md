# Phase 5: Demons Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 5-demons-layer
**Areas discussed:** UI Placement, Browser Design, Focus Mode Entry, All-Chords Web Ceiling, Type Facets, Matrix Design, URL State

---

## UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated large panel/overlay | A new, bigger surface separate from the small side panels, sized for real data-browsing. | ✓ |
| New side panel, same pattern as the others | A "Demons" entry using the existing CyberPanel collapse pattern, same width as Zones/Syzygies/Currents/Gates. | |
| Replaces the diagram in a mode toggle | Clicking into "Demons" swaps the SVG diagram itself for the browser/matrix. | |

**User's choice:** Dedicated large panel/overlay (recommended option).
**Notes:** Rationale given: a browser with up to 221,445 rows and a triangular matrix need more room than the ~300px side panels can give.

---

## Browser Design

| Option | Description | Selected |
|--------|-------------|----------|
| a::b, mesh #, type/subtype, name column always present | Name column shows the CCRU name at base 10 and stays empty (not hidden) at other bases. | ✓ |
| Name column only exists at base 10 | The column itself appears/disappears depending on base. | |
| Claude's discretion | Let the planner/researcher decide column layout. | |

**User's choice:** Name column always present, empty at non-base-10 (recommended option).

---

## Focus Mode Entry

| Option | Description | Selected |
|--------|-------------|----------|
| Both: click a zone in the diagram OR a demon in the browser | Two entry points feeding one shared focus-mode state. | ✓ |
| Diagram only | Only clicking a zone in the SVG enters focus mode. | |
| Browser only | Only selecting a demon row triggers the chord view. | |

**User's choice:** Both (recommended option).

---

## All-Chords Web Ceiling

| Option | Description | Selected |
|--------|-------------|----------|
| Accept n=80 as a hard cutoff | Above 80, rely on focus mode + matrix + search. Matches Phase 3's precedent for gates. | ✓ |
| Implement edge-bundling for the demon web | Group chords to try to extend legible density past 80. More engineering scope, unproven benefit. | |

**User's choice:** Accept n=80 as a hard cutoff (recommended option).
**Notes:** ROADMAP.md explicitly flagged this as unresolved from Phase 3's 2026-09-27 ceiling-spike discussion, where the user declined gate-edge-bundling for an analogous web view. Same reasoning applied here.

---

## Type Facets

| Option | Description | Selected |
|--------|-------------|----------|
| Clickable filter chips above the browser | Facet display and filter control are the same UI element. | ✓ |
| Separate read-only summary + independent filter controls | More UI surface, clearer separation of concerns. | |

**User's choice:** Clickable filter chips (recommended option).

---

## Matrix Design

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded by type, hover for tooltip + click to pin | Mirrors the diagram's existing hover/pin pattern from Phase 4. | ✓ |
| Claude's discretion on visual encoding, but must support zoom/pan | Only locks that zoom/pan is required. | |

**User's choice:** Color-coded by type, hover/click-to-pin (recommended option).
**Notes:** LOD/tiling mechanics at n >= 4k remain for the research task explicitly flagged in ROADMAP.md — only the color encoding and interaction model are locked here.

---

## URL State

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — filter and focus/pin are shareable, matrix pan/zoom is not | Consistent with Phase 4's isolate=/mute= precedent; camera state stays local like the diagram's own zoom/pan. | ✓ |
| Yes, everything including matrix pan/zoom | Full reproducibility, more codec surface. | |
| No — demon browser state is local-only | Simpler codec, no shareable demon views. | |

**User's choice:** Filter and focus/pin shareable, matrix pan/zoom local-only (recommended option).

---

## Claude's Discretion

- Exact chip ordering/styling for type facets
- Matrix LOD/tiling algorithm at n >= 4k (this phase's flagged research task)
- Exact column widths and sort-affordance styling in the browser
- Whether the demon panel's open/closed state itself is part of the URL

## Deferred Ideas

None — discussion stayed within phase scope.

# Phase 6: Canvas Tier and Worker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-05
**Phase:** 6-Canvas Tier and Worker
**Areas discussed:** Interactive ceiling and the over-limit offer; What Canvas draws and what is pickable at large n; Worker scope and loading experience; Canvas accessibility, touch and small windows

---

## Interactive ceiling and the over-limit offer

### Where the interactive ceiling sits

| Option | Description | Selected |
|--------|-------------|----------|
| n = 4000, the largest measured (Recommended) | Matches `canvasTargetN`; Canvas stayed inside budget on every profile to 4000. Raising it later is a data change. | ✓ |
| Measure further in this phase's research | Push probes to 16k or 64k on sw-6x and ship whatever passes; extra research time, untested layout, picking and worker costs. | |
| A smaller, safer cap (say 1000) | Keeps weak machines comfortable but discards measured headroom. | |

**User's choice:** n = 4000, the largest measured.

### What the over-limit message offers (export lands in Phase 8)

| Option | Description | Selected |
|--------|-------------|----------|
| Message now, export wired in Phase 8 (Recommended) | Factual message names headless export; the real button and CLI are Phase 8; criterion 4 is split across phases. | ✓ |
| Pull a minimal JSON download forward | Satisfies criterion 4 literally but defines an export format Phase 8 would have to honour or replace. | |
| Message only, no mention of export yet | Never promises something that doesn't exist; criterion 4 stays unmet until Phase 8. | |

**User's choice:** Message now, export wired in Phase 8.

---

## What Canvas draws and what is pickable at large n

### The SVG-lean tier (about 200-300 zones)

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it: Canvas takes over right after 200 (Recommended) | One handoff point and one fewer renderer; the lean measurement stays as history. | ✓ |
| Build lean as a middle tier | Three renderers to keep in parity plus an unspecified visual design. | |

**User's choice:** Drop it.

### Edges at large n

| Option | Description | Selected |
|--------|-------------|----------|
| Follow the table, and draw a selected zone's own edges on demand (Recommended) | Syzygies and currents always drawn and pickable; gate layer per `gateLayerMode`; selection always draws its own edges. | ✓ |
| Draw every edge type at every size | Fast enough to paint, but unreadable noise. | |
| Follow the table strictly, no on-demand edges | Gates vanish above 150 even for a selected zone. | |

**User's choice:** Follow the table, and draw a selected zone's own edges on demand.

### Parity with the SVG viewer

| Option | Description | Selected |
|--------|-------------|----------|
| All layouts plus demon focus chords (Recommended) | Ring, ladder, spiral, pair-graph and Phase 5 focus chords all draw on Canvas. | ✓ |
| All layouts, but no demon focus chords on Canvas | Browser-to-diagram link would work only up to 200. | |
| Ring layout only at first | Layout switcher partly disabled above 200. | |

**User's choice:** All layouts plus demon focus chords.

---

## Worker scope and loading experience

### Which engine work the worker owns

| Option | Description | Selected |
|--------|-------------|----------|
| All engine work above 200, synchronous at or below (Recommended) | Worker builds numogram, summary, text-view data and Canvas scene above 200; base 10 and the SVG tier stay synchronous so frozen oracles see no async. | ✓ |
| Worker only for the Canvas scene | Bases above 4000 still compute their summary on the main thread (about a second stall at 2^26). | |
| Every base through the worker | One path, but base 10 becomes asynchronous and puts the frozen oracles at risk. | |

**User's choice:** All engine work above 200, synchronous at or below.

### What the page shows while computing

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the last result visible, with an inline status (Recommended) | Previous base stays dimmed with a "computing base N" note; superseded results discarded. | ✓ |
| Blank the diagram with a spinner | Flashes empty on every debounced keystroke. | |
| Show the summary immediately, diagram when ready | Needs a second, earlier worker message type. | |

**User's choice:** Keep the last result visible, with an inline status.

---

## Canvas accessibility, touch and small windows

### Keyboard and screen-reader use of the Canvas

| Option | Description | Selected |
|--------|-------------|----------|
| One focusable canvas with keyboard traversal and live announcements (Recommended) | Arrow keys and Tab move a focus ring, Enter pins, aria-live announces; text view stays as fallback. | ✓ |
| Text view only, with a note | Cheapest; keyboard-only users lose the diagram above 200. | |
| Mirror a hidden DOM list of visible zones | Familiar to screen readers but a second structure to sync, heavy at 4000 zones. | |

**User's choice:** One focusable canvas with keyboard traversal and live announcements.

### Hit-testing and gestures on touch and small windows

| Option | Description | Selected |
|--------|-------------|----------|
| Forgiving hit radius, nearest wins, pinch and drag (Recommended) | About 12 CSS px minimum hit radius at any zoom, nearest wins, tap pins; mouse hover uses the same rule. | ✓ |
| Exact hits only | Predictable but forces zooming before anything is tappable at n=1000. | |
| Nearest-wins plus a disambiguation list in crowded areas | Most precise in dense regions but new UI with its own accessibility and layout work. | |

**User's choice:** Forgiving hit radius, nearest wins, pinch and drag.

**Notes:** The app quit mid-discussion (during this last question); the first three areas had been saved to a checkpoint file before the question was re-asked, and the answer above was captured after resuming.

---

## Claude's Discretion

Canvas picking implementation, worker bundling under Next 14 export builds, the worker message protocol and cancellation, the no-`Worker` fallback, the schema of the shipped-ceiling datum, the exact wording and styling of the computing status, the over-ceiling message and focus announcements, Canvas redraw and caching strategy, and the plan and wave breakdown.

## Deferred Ideas

- User-facing "show it anyway" override above the ceiling (declined again).
- Disambiguation list or magnifier for crowded hit areas.
- A minimal JSON download pulled forward from Phase 8.
- Extending the ceiling past 4000 by measuring further.

# Phase 4: Base Picker and Generator UI - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the base-10-only viewer into an interactive generator for any even base: a base picker with a live summary, `?base=` URL state, zone labels beyond base 36 (decimal-with-separator, custom alphabet, xenotation), a region legend with isolate/mute, layer toggles, zoom/pan/fit, and full keyboard/screen-reader access including a text view. Also removes the remaining hard-coded 10-zone constants (MIG-02). New capabilities (two-base comparison, base atlas, flow tracer) are v2 and stay out of scope.

</domain>

<decisions>
## Implementation Decisions

### Base Picker

- **D-01:** The numeric type-in field is the primary, most visually prominent input; stepping, sliding and the notable-base chips (all required by UI-01) sit alongside it, not competing for primacy.
- **D-02:** The live summary (zones, Warp yes/no, Torque cycle lengths, demon count) is built into the picker control itself, not folded into the existing Selection/Info panel.
- **D-03:** The base picker is a new standalone control in the header, alongside the existing layout switcher (undo/redo/share/layout) — a first-class always-visible action, not one more panel in the panel group.
- **D-04:** Changing the base previews live as you type or drag, debounced (not gated behind an Enter/confirm step). Odd/too-large bases are still refused per UI-02 — the debounce doesn't wait for the refusal check.
- **D-05:** The stepper (+/-) steps by 2 only (next/previous even base). No larger-jump modifier is required; Claude may add one (e.g. a shift-click x10 jump) at its discretion if it feels natural.
- **D-06:** On an odd or refused (too-large) base, the diagram keeps showing the last valid base — it never goes blank or greys out — while an inline message (appearing right next to the picker, not a toast/banner elsewhere) explains the refusal.
- **D-07:** The notable-base chip set specified by UI-01 (`2, 4, 6, 8, 10, 12, 16, 22, 28, 80, 82`) is amended by the user to add `64`, `100` and `1024`. **Final chip set: `2, 4, 6, 8, 10, 12, 16, 22, 28, 64, 80, 82, 100, 1024`.** REQUIREMENTS.md's UI-01 wording must be updated to this list during planning/execution.

### Zone Labels Beyond Base 36

- **D-08:** The default label style at any base is decimal-with-separator (matches the engine's existing numeral formatter from Phase 2) — not a custom alphabet by default. Custom alphabet and xenotation are opt-in.
- **D-09:** Xenotation (today's prime-factor notation, `app/lib/xenotation.ts`) is an alternate label mode that occupies the same display slot as the zone's numeral — switching to it replaces the shown text, it does not add a secondary annotation alongside the number.
- **D-10:** Custom alphabet supports **both** a small set of curated presets (2-4 to start) **and** a fully user-defined character set — not either/or.
- **D-11:** A custom alphabet is one reusable ordered list of characters, applied to however many digits a given base needs — not configured separately per base.
- **D-12:** Custom-alphabet validation (font/glyph coverage, uniqueness, sufficient length for the current base) surfaces inline as the user types, before it's applied to the diagram.
- **D-13:** The chosen label scheme (which mode — decimal/custom/xenotation — plus which preset or custom character set) is part of the shareable URL codec, so a share link reproduces exactly how zone labels looked for the sender.

### Big-Base Degradation UX

- **D-14:** Above the measured SVG limit (Phase 3's `tier-table.json`, currently `svgRichMaxN: 200`), the page automatically shows the numeric summary and the accessible text view instead of the interactive diagram — this happens the moment an over-limit base is picked, not behind an extra "load it anyway" click.
- **D-15:** The refusal/fallback message is short and factual: states the fact plainly (base too large for the interactive diagram, showing summary and text view instead), no apology, no jargon.
- **D-16:** The message shows the actual measured cutoff number, sourced live from `tier-table.json` (not hard-coded prose) — transparent about exactly where the line is, and stays correct if the table is re-measured later.
- **D-17:** Phase 4 implements only two effective render tiers for now: full rich SVG, or the summary/text-view fallback. Phase 3's measured intermediate "SVG-lean" tier (which buys headroom to ~300 zones) is **deferred** — its visual design was never decided (Phase 3 only measured its performance, not its look), so designing and building it is out of scope here (see Deferred Ideas).
- **D-18:** The `tier=` URL override (already built in Phase 3, D-13 there) stays diagnostic-only. No user-facing "show it anyway" button is offered when a base is refused — this avoids people accidentally freezing their own tab.

### Region Legend

- **D-19:** **Isolate** = spotlight: shows only that region, dims (but keeps present) everything else. **Mute** = hard hide: that region's zones/lines disappear from view entirely. These are two distinct, complementary actions — not a single 3-state toggle per region.
- **D-20:** Every Torque cycle gets its own row (with a stable id) in one scrollable legend list, regardless of how many there are (base 64 needs 6, larger bases may need more) — no grouping/collapsing behind a summary row.
- **D-21:** Isolate/mute state extends the existing URL codec (alongside `region=`), so a share link reproduces exactly which regions were isolated/muted.
- **D-22:** Multiple regions can be isolated and/or muted at the same time — each region's state is independent, any combination is valid (not a single spotlight slot that clears on a new pick).
- **D-23:** Isolate/mute apply uniformly to **all** regions, including Plex and Warp, not just Torque cycles — every row in the legend behaves the same way.
- **D-24:** Torque cycle rows are ordered by cycle length descending, matching the engine's own canonical cycle order (Phase 2) — not by stable id/alphabetical order. This mirrors the diagram's own visual hierarchy and doesn't reshuffle between base switches.

### Folded Todos

- **Todo 003** (`.planning/todos/pending/003-fix-dropped-row-clicks-and-mobile-overlap.md`): real mouse clicks are dropped on Zones/Syzygies/Currents/Gates row text in Chromium (suspected `CyberPanel` remount-on-mousedown); the shell already overlaps below ~390px width; panel-collapse-toggle code is dead (never wired up — decide whether to delete it or make panels genuinely collapsible, which would also help the mobile-overlap finding). Folded into Phase 4 scope per the todo's own acceptance criteria, since Phase 4 is rebuilding this exact panel-based UI.
- **Todo 005** (`.planning/todos/pending/005-expose-packer-choice-in-phase4-ui.md`): expose the shelf-vs-spiral packer choice (Phase 3's `engine/layout/params.ts`, user sign-off on plan 03-08) as a user-facing toggle/setting in the live viewer — there is currently no way to pick spiral except at the engine/dev-review-sheet level.

### Claude's Discretion

- Exact visual styling/polish of the header base-picker control.
- Whether to add a larger-jump stepper modifier (not required; may be added if it feels natural, per D-05).
- Exact wording of the refusal/fallback message beyond "short and factual, shows the measured number" (D-15/D-16).
- The specific 2-4 curated alphabet presets' actual character sets — subject to this phase's own targeted research task (font/glyph coverage).
- Visual treatment (exact dim opacity/style) distinguishing an isolated-out region from a muted one.
- Where/how todo 003's dead panel-collapse code gets resolved (delete vs. wire up for real) — the todo defers this exact call to this phase's planning.
- Where and how the packer-choice toggle from todo 005 fits visually (e.g. part of the base picker, part of an existing panel, or a new setting).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and prior decisions
- `.planning/REQUIREMENTS.md` — UI-01 through UI-08 and MIG-02 (this phase's requirements; UI-01's chip list needs updating per D-07)
- `.planning/ROADMAP.md` §"Phase 4: Base Picker and Generator UI" — goal, success criteria, notes on the URL codec and label-scheme settling
- `.planning/phases/03-procedural-layout-and-ceiling-spike/03-CONTEXT.md` — D-01 (anticlockwise), D-02 (Plex/Warp placement), D-07 (label visibility threshold), D-08 (pair-graph), D-09 (layout-switch tween), D-13 (`tier=` override) all carry forward
- `engine/scene/tier-table.json` — the measured `svgRichMaxN`, `svgLeanMaxN`, `labelVisibleMinRadiusPx` this phase's degradation UX (D-14..D-17) reads directly, not a copy

### Todos folded into this phase
- `.planning/todos/pending/003-fix-dropped-row-clicks-and-mobile-overlap.md`
- `.planning/todos/pending/005-expose-packer-choice-in-phase4-ui.md`

### Existing code this phase generalizes or replaces
- `app/lib/shareParams.ts` — current URL-param codec (`layout`, `region`, `tc`, etc.) that the single unified codec (ROADMAP note) replaces/extends
- `app/components/panels/RegionsPanel.tsx` — today's hard-coded 3-region panel that the generalized region legend (D-19..D-24) replaces
- `app/lib/xenotation.ts` — existing prime-factor notation helper (D-09)
- `app/lib/numogram.ts`, `app/lib/constants.ts` — likely locations of remaining hard-coded 10-zone assumptions (MIG-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/xenotation.ts` (182 lines) — prime-factor notation logic already exists and is base-agnostic; Phase 4 wires it in as a label mode (D-09), not reimplementing.
- `app/components/panels/HoverInfoList.tsx` — the list/row primitive `RegionsPanel.tsx` already builds on; likely reusable for the generalized, many-row region legend.
- Engine's `formatNumeral`/`formatGateName`/`formatNetSpan` (Phase 2) — already implement the decimal-with-separator default (D-08) for any base.

### Established Patterns
- `app/lib/shareParams.ts` — canonical allow-listed URL param pattern (`SHARE_PARAM_KEYS`, `ALLOWED_*` sets) that the unified `base`-aware codec should extend rather than replace wholesale.
- `RegionsPanel.tsx`'s click-to-toggle-highlight is the closest existing analog to isolate/mute, but only has one action per region today — the generalization needs a second, distinct control per row.

### Integration Points
- Header, next to the existing layout switcher (undo/redo/share/layout) — where the new base-picker control lands (D-03).
- `engine/scene/tier-table.json` — read directly (not copied) for the degradation thresholds (D-14/D-16) and label-visibility threshold.

</code_context>

<specifics>
## Specific Ideas

No particular visual references beyond what's captured in Decisions above — open to standard approaches for styling.

</specifics>

<deferred>
## Deferred Ideas

- Phase 3's measured SVG-lean intermediate tier's visual design (D-17) — not built now; a future phase could design and add it to buy the extra ~100 zones of interactive headroom Phase 3 measured but didn't design for.
- A user-facing "try anyway past the limit" override (D-18) — declined for now; the `tier=` diagnostic flag remains available for anyone technical enough to use it directly.
- A larger-jump stepper modifier (D-05) — left to Claude's discretion, not a locked requirement; may not land in this phase.

### Reviewed Todos (not folded)
None — the two todos matched to this phase (003, 005) were both folded into scope.

</deferred>

---

*Phase: 04-base-picker-and-generator-ui*
*Context gathered: 2026-09-28*

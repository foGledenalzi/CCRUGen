# Phase 4: Base Picker and Generator UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 4 - Base Picker and Generator UI
**Areas discussed:** Base-picker layout & live summary, Zone-label scheme beyond base 36, Big-base degradation UX, Region legend (isolate/mute, scaling to many rings)

Gray areas offered: the four above (all selected). Todo cross-reference: the automated matcher returned zero matches; two clearly relevant pending todos (003, 005) were surfaced manually and both folded into scope.

---

## Folded Todos

**Q: Which pending todos should be folded into Phase 4's scope?**

| Option | Description | Selected |
|--------|-------------|----------|
| 003: row-click bug + mobile overlap + dead code (Recommended) | Dropped real mouse clicks on Zones/Syzygies/Currents/Gates rows in Chromium; ~390px shell overlap; dead panel-collapse-toggle code | ✓ |
| 005: expose packer choice in the UI (Recommended) | Shelf vs. spiral packing has no end-user toggle yet, only engine/dev-review-sheet level | ✓ |

Both folded.

---

## Base-picker layout & live summary

**Q: Which input mode should feel primary?**

| Option | Description | Selected |
|--------|-------------|----------|
| Notable-base chips (Recommended) | One-click jump to interesting bases, others sit alongside | |
| A numeric type-in field | Text input as primary, chips as quick-jump shortcuts | ✓ |
| A slider/stepper | Continuous/steppable control primary, chips as tick marks | |

**Q: Where should the live summary live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Built into the picker itself (Recommended) | Summary appears next to/under the picker control | ✓ |
| Folded into the existing Selection/Info panel | Reuses today's InfoDisplay pattern | |

**Q: New standalone control or merge into existing UI?**

| Option | Description | Selected |
|--------|-------------|----------|
| New standalone control in the header (Recommended) | Alongside the existing layout switcher | ✓ |
| A new panel, like the other toggle panels | Joins the existing panel group | |

**Q: Live preview or confirm step?**

| Option | Description | Selected |
|--------|-------------|----------|
| Live preview, debounced (Recommended) | Diagram updates as you type/drag, refusal still shown per UI-02 | ✓ |
| Require an explicit confirm (Enter / button) | Nothing changes until committed | |

**Follow-up round:**

**Q: Stepper granularity?**

| Option | Description | Selected |
|--------|-------------|----------|
| Step by 2 only (Recommended) | Simple, always lands on a valid base | ✓ |
| Step by 2, plus a bigger jump modifier | Adds a shift-click x10 jump | |

**Q: Diagram behavior on invalid state?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep showing the last valid base (Recommended) | Diagram never goes blank | ✓ |
| Clear/dim the diagram until corrected | Visibly greys out | |

**Q: Notable-base chip set — final or amend?**

| Option | Description | Selected |
|--------|-------------|----------|
| Final as specified (Recommended) | Keep the UI-01 set exactly | |
| Add a couple more | User specifies which to add | ✓ |

**Q: Which bases to add?**

| Option | Description | Selected |
|--------|-------------|----------|
| 64 (Recommended) | Six separate Torque rings, Phase 3's headline test case | ✓ |
| 100 (Recommended) | The other multi-ring headline case | ✓ |
| 1024 | Near the practical high end of the measured Canvas range | ✓ |

**Q: Where should the error message appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline, right next to the picker (Recommended) | Close to where the user is already looking | ✓ |
| A toast/banner elsewhere on screen | Fixed-location notification | |

**User's choice:** Numeric type-in field is primary; live summary built into the picker; new standalone header control; live-preview with debounce; step by 2 only; keep showing last valid base on invalid input; chip set amended to add 64, 100, 1024; inline error message.

---

## Zone-label scheme beyond base 36

**Q: Default label style at a base above 36?**

| Option | Description | Selected |
|--------|-------------|----------|
| Decimal with a separator (Recommended) | Matches today's engine numeral formatter | ✓ |
| Custom alphabet by default | Denser glyph set as default | |

**Q: How does xenotation relate to the numeral label?**

| Option | Description | Selected |
|--------|-------------|----------|
| An alternate label mode, same slot (Recommended) | Replaces the displayed text | ✓ |
| A secondary annotation alongside the number | Appears as a subtitle/tooltip | |

**Q: Custom alphabet — presets or user-defined?**

| Option | Description | Selected |
|--------|-------------|----------|
| A few curated presets (Recommended) | Simpler, avoids arbitrary-input validation work | |
| User can type their own character set | More flexible, more validation | |
| (free text) We need both | User wants both presets and custom input | ✓ |

**Q: Label scheme persistence — URL or local?**

| Option | Description | Selected |
|--------|-------------|----------|
| Shareable via URL (Recommended) | Part of the URL codec like layout/region today | ✓ |
| Local preference only, not in the URL | Keeps URLs shorter | |

**Follow-up round:**

**Q: Custom alphabet scope — one reusable list or per-base?**

| Option | Description | Selected |
|--------|-------------|----------|
| One reusable ordered alphabet (Recommended) | Define once, used up to however many digits needed | ✓ |
| Configured per base | Separate mapping per base | |

**Q: Custom-alphabet error handling?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline validation as they type (Recommended) | Immediate feedback before applying | ✓ |
| Silently fall back to decimal | No explicit error | |

**Q: How many curated presets to start?**

| Option | Description | Selected |
|--------|-------------|----------|
| A small handful, 2-4 (Recommended) | Enough for real choice without a big curation project | ✓ |
| You decide the exact set/count | Left to Claude's discretion | |

**User's choice:** Decimal-with-separator default; xenotation replaces the label in-place; both curated presets (2-4) and full custom character sets supported; one reusable ordered alphabet per custom set; inline validation; label scheme is part of the URL codec.

---

## Big-base degradation UX

**Q: What replaces the interactive diagram above the measured SVG limit?**

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + text view, shown automatically (Recommended) | Shown the moment an over-limit base is picked | ✓ |
| Summary only, with a button to load the text view | Text view is an explicit extra action | |

**Q: Message tone?**

| Option | Description | Selected |
|--------|-------------|----------|
| Short and factual (Recommended) | States the fact, no apology/jargon | ✓ |
| More detailed, explains why | Mentions Phase 6's Canvas tier as the future fix | |

**Q: Show the exact cutoff number?**

| Option | Description | Selected |
|--------|-------------|----------|
| Show the actual number (Recommended) | Sourced live from tier-table.json | ✓ |
| Keep it qualitative, no exact number | Avoids needing an update if thresholds change | |

**Follow-up round:**

**Q: Use Phase 3's measured SVG-lean intermediate tier?**

| Option | Description | Selected |
|--------|-------------|----------|
| Rich SVG or text view only, for now (Recommended) | Lean tier's visual design isn't decided yet | ✓ |
| Use all three tiers now (rich, lean, text) | Squeezes out extra headroom, more design work | |

**Q: User-facing "show it anyway" override?**

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep the override diagnostic-only (Recommended) | `tier=` stays a hidden/advanced flag | ✓ |
| Yes, offer a visible "try anyway" option | Explicit opt-in with a risk warning | |

**User's choice:** Automatic summary + text-view fallback; short factual message; shows the actual measured number; only two effective tiers (rich SVG / text view) for now; no user-facing override button.

---

## Region legend: isolate vs. mute, and scaling to many rings

**Q: What should isolate and mute actually do?**

| Option | Description | Selected |
|--------|-------------|----------|
| Isolate = show only, dim the rest; mute = hard hide (Recommended) | Two distinct, complementary actions | ✓ |
| Isolate and mute are opposite toggles of the same state | One 3-state cycle per region | |

**Q: How to handle many Torque cycles?**

| Option | Description | Selected |
|--------|-------------|----------|
| Scrollable list, same row style throughout (Recommended) | Every cycle gets its own row | ✓ |
| Group/collapse behind one summary row | Compact default view | |

**Q: Shareable isolate/mute state?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, extend the URL codec (Recommended) | Reproduces exact isolate/mute state | ✓ |
| No, session-only | Keeps URLs simpler | |

**Follow-up round:**

**Q: Multiple regions isolated/muted at once?**

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple at once (Recommended) | Independent per-region state | ✓ |
| One isolated at a time (mute can still be multiple) | True single spotlight | |

**Q: Do isolate/mute apply to Plex and Warp too?**

| Option | Description | Selected |
|--------|-------------|----------|
| All regions, including Plex and Warp (Recommended) | Consistent behavior everywhere | ✓ |
| Torque cycles only | Plex/Warp keep today's simpler highlight | |

**Q: Torque cycle row order?**

| Option | Description | Selected |
|--------|-------------|----------|
| By cycle length, longest first (Recommended) | Matches the engine's canonical cycle order | ✓ |
| By stable id (A, B, C...) | Alphabetical/id order | |

**User's choice:** Isolate = spotlight, mute = hard hide, two distinct actions; scrollable list, one row per cycle, no grouping; isolate/mute state in the URL codec; multiple regions isolatable/mutable simultaneously; applies to all regions including Plex/Warp; rows ordered by cycle length descending.

---

## Claude's Discretion

- Exact visual styling/polish of the header base-picker control
- Whether to add a larger-jump stepper modifier
- Exact wording of the refusal/fallback message beyond "short and factual, shows the number"
- The specific 2-4 curated alphabet presets' actual character sets
- Visual treatment distinguishing an isolated-out region from a muted one
- Resolution of todo 003's dead panel-collapse code (delete vs. wire up for real)
- Where/how the packer-choice toggle from todo 005 fits visually

## Deferred Ideas

- Phase 3's measured SVG-lean intermediate tier's visual design — not built now, no visual design exists for it yet
- A user-facing "try anyway past the limit" override — declined, `tier=` stays diagnostic-only
- A larger-jump stepper modifier — left to Claude's discretion, may not land this phase

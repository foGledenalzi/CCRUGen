# Phase 7: Naming Builder - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can name the zones of any base and get derived demon names, edit and share them, and load the canonical CCRU names for base 10 (NAM-01..NAM-04; ROADMAP Phase 7 success criteria 1-4): a per-zone sound table that is typed, pasted or generated from a seed with per-zone locks; demon names derived on demand from the two zones' sounds (high-then-low by default, low-then-high as an option) with sparse per-demon overrides; versioned JSON export and import, a URL that carries only a preset or seed, and a visible name-collision report; and a base-10 CCRU preset (the 10 zone sounds plus the 45 canonical demon names).

Built here: a pure naming module under `engine/naming/` (PRNG, seeded generator, euphony pass, name derivation, JSON schema and hand-written validator), the naming panel and its wiring, name display in the demon browser, the Selection demon detail and the matrix tooltip, a `sounds` diagram label mode, per-base browser autosave, import and export, and the base-10 CCRU preset.

Not built here: image or file export of the diagram (Phase 8), planet/zodiac/tarot correspondences and other mythos layers (out of scope for v1), audio or IPA synthesis of the sounds, a server of any kind.

</domain>

<decisions>
## Implementation Decisions

### Where the builder lives and where names show up
- **D-01:** The naming builder is **a compact side panel in the existing panel stack** (the user chose this over a fourth tab in the Demons overlay or a separate large overlay). It must stay within roughly a 240 px width, report its real height so the stack adapts (see the related, still-pending todo 008 about the desktop stack keeping base-10 heights after a base change), and work in the mobile stack below the 820 px breakpoint. Everything it adds to the DOM carries `data-post-baseline=""`, as the Text panel did, so the frozen behaviour baseline (`e2e/__behaviour__`) and the 60 DOM goldens do not change.
- **D-02:** The panel is **one self-contained surface**: global controls on top (preset, seed, style, join order, the smoothing toggle, the collision summary, import and export), then a virtualized scrolling list of zones with an editable sound and a lock toggle per row that still works at 4,000 zones. Demons are renamed from the existing Selection demon detail when one is pinned (overridden names are marked, with "reset to generated").
- **D-03:** Names always fill the demon browser's name column (Phase 5 D-02: present at every base, empty today above base 10), the demon detail in the Selection panel, and the matrix tooltip. In addition, **zone sounds are a diagram label mode**: `sounds` joins digits, xenotation and the alphabet modes in the existing label scheme and its URL param (and must work on the Canvas tier as well as the SVG tier, with the same legibility rules as long numerals). Not chosen for v1: showing a zone's sound in the Zones panel rows, and names drawn along demon chords in focus mode.

### Generator, sounds and names
- **D-04:** Generated zone sounds are **CCRU-flavoured consonant clusters by default** (the base-10 originals are `eiaoung, gl, dt, zx, skr, ktt, tch, pb, mnm, tn`), with **three selectable styles**: a harsh, CCRU-like default, a soft style and a syllabic style. The style is part of the stored seed record, so a shared seed link reproduces the same names.
- **D-05:** Generated tables are **always distinct** at any base: sounds get longer as needed rather than repeating (a base-4000 sound may be 6-8 letters). Distinctness is by construction, not by retry. A generated table uses plain Latin letters.
- **D-06:** Derived demon names are the plain join of the two zone sounds by default. **Smoothing (euphony) is optional and off by default**, implemented as deterministic vowel-insertion rules behind a version number, and the panel shows the raw and the smoothed form side by side. The canonical CCRU names are not derivable by rule (the roadmap notes this), so smoothing is a convenience, not a reproduction of them.
- **D-07:** **A valid zone sound is** letters of any script (Unicode letter characters, normalized to NFC and counted in user-perceived characters), no whitespace, digits or punctuation, **length 1 to 16**. Typed, pasted and imported sounds are checked against this with inline messages that name the problem and the row.
- **D-08:** **Derived names are written with their first letter capitalised** ('Tnmnm', 'Ummnu'), whatever case the sounds were typed in, matching the look of the canonical names. Overrides are shown exactly as typed. There is no case setting in v1.

### Saving, undo and base switching
- **D-09:** Naming work is **autosaved in the browser, one slot per base** (local storage), plus explicit JSON export for moving or backing up. Static-first still holds (no server). A shared link never overwrites a saved slot without the user's say-so (D-13).
- **D-10:** Switching base loads **that base's own saved naming**, or a fresh seeded one when none is saved; a new base never inherits another base's per-zone edits (zone ids differ). Zone-sound and demon-name edits join the **existing undo and redo history**, and history from another base is never restored (Phase 4 UI-08).

### Scale, collisions, canonical names, shared links
- **D-11:** **Full editing (the zone list, locks, autosave, per-zone JSON export) runs up to the interactive ceiling**, read from the tier table as `INTERACTIVE_MAX_N` (4,000 today), never typed as a number. **Above it naming is seed-only**: no per-zone list, a style and a seed still apply, names are derived lazily in the demon browser and detail panel (the browser handles bases to 2^26), and export is seed-only without a per-zone sound list.
- **D-12:** **Collisions are reported, not repaired.** The panel shows a summary (count, and the colliding names with their `a::b` pairs) and jumps to each colliding demon so the user can override by hand. Nothing is changed automatically, and the report works for typed, generated and imported tables. Not chosen for v1: a "regenerate to reduce collisions" action and automatic disambiguating suffixes.
- **D-13:** **A shared link opens as an unsaved preview.** A link carries only a preset or seed (with style, join order and the smoothing flag), never edits. If the recipient already has a saved naming for that base, the link's naming is shown without being saved, with a small inline notice offering "Keep this naming" (replaces the slot, undoable) or "Back to my saved naming". Nothing is ever lost silently.
- **D-14:** **The CCRU preset exists only at base 10** (NAM-04): the 10 zone sounds plus the 45 canonical names as overrides. Every other base uses the generator or the user's own sounds. Canonical names are never applied to demons of other bases.

### Locked earlier (carried forward, not re-discussed)
- **From the roadmap notes and research:** the PRNG is `sfc32-cyrb128@1` with frozen test vectors (never `Math.random`, no `Date`); the seeded generator uses Feistel plus cycle-walking as a proposal to validate (fallback seeded Fisher-Yates over a lazily extended syllable inventory); join order defaults to high-then-low with low-then-high as an option; names are derived on demand and never stored per demon, overrides are sparse (at 221,445 demons nothing per-demon exists); override keys are decimal zone numbers (the roadmap writes `"a:b"` and the research sketch `"a::b"`, while `app/presets/base10/lore.ts` keys the 45 names by mesh number `a(a-1)/2 + b`: the researcher reconciles these and fixes one canonical key form); zone-sound distinctness does not imply demon-name distinctness (concatenation is not injective), hence the collision report; the validator is hand-written, rejects a file for the wrong base with a message (optionally offering "regenerate from seed"), caps size, lists unknown keys; JSON is versioned (the research sketch uses schema id `ccrug.naming/1`); the URL carries only `names=ccru|seed:<s>`-style data; text handling is NFC-normalized and grapheme-safe.
- **From earlier phases:** the engine stays pure (`engine/naming` depends only on `engine/core`: no DOM or Node types, relative imports only, deterministic, no O(n^2) materialization); the 60 DOM goldens, `e2e/__behaviour__`, the numeric oracle and the derived fixtures are never regenerated with `-u`; the CCRU lore stays in `app/presets/base10/lore.ts` joined by id (Phase 2 D-06), so the CCRU preset reads the 45 names and 10 sounds from there, never duplicated into engine data; tier boundaries and ceilings come from `engine/scene/tier-table.json` through `app/lib/tierBounds.ts`, never hard-coded; Next 14.2.35 exact pin, no new dependency, no server routes; no upstream branding.

### Claude's Discretion
The PRNG and Feistel construction details (and the fallback decision once validated), the phoneme inventories and tuning for the three styles, the euphony rules and their versioning, the exact JSON schema field names, import size cap and error wording, the panel's layout, labels and copy within the D-01/D-02 constraints, the local-storage key format and quota handling, undo granularity (per edit or per gesture), how the zone list is virtualized, how the browser name column and matrix tooltip read the naming without per-demon storage, the `sounds` label-mode wording and its legibility cutoffs, whether the worker is involved in building seeded tables at large bases, and the plan and wave breakdown.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (section "Phase 7: Naming Builder") - goal, four success criteria, the research flag (euphony rules, phoneme-bank sizing, prefix-free or separator-aware inventory, generator quality) and the notes on the PRNG, Feistel proposal, override keys, collisions and validator
- `.planning/REQUIREMENTS.md` - NAM-01..NAM-04 (this phase); DEM-05 (the base-10 names already shown, which this phase generalises)
- `.planning/PROJECT.md` - core value, scope, key decisions (v1 covers naming builder; no mythos layers)
- `CLAUDE.md` - project rules (frozen oracles, engine purity, static-first, no upstream branding, Windows environment)

### Design research for naming
- `.planning/research/ARCHITECTURE.md` - "Naming Builder Data Model" (the `SoundMap` shape, derived-never-stored, Feistel proposal, euphony as a deterministic pass, validation, persistence and sharing) and the `engine/naming/` layout and dependency rule (`core <- naming`)
- `.planning/research/FEATURES.md` - "Naming builder UX" (sounds table, seeded generator, join rule, euphony pass, live preview, per-demon override, collision report, import and export, sharing, undo) and the guide's worked examples
- `.planning/research/PITFALLS.md` - read before touching any naming math, determinism or base-10 data

### Prior decisions this phase builds on
- `.planning/phases/05-demons-layer/05-CONTEXT.md` - D-02 (name column always present, empty above base 10), D-07 (URL state via `app/lib/shareParams.ts`)
- `.planning/phases/04-base-picker-and-generator-ui/04-CONTEXT.md` - label schemes and their URL codec (D-08..D-13), D-14..D-18 (over-limit behaviour), history and UI-08 sanitising
- `.planning/phases/06-canvas-tier-and-worker/06-CONTEXT.md` and `06-VERIFICATION.md` - the interactive ceiling as data, the worker, the Canvas tier a `sounds` label mode must also support
- `.planning/phases/02-engine-core-and-base-10-migration/02-CONTEXT.md` - D-06 (lore joined by id, never duplicated into engine data)
- `.planning/todos/pending/008-regions-panel-overlaps-currents-at-large-bases.md` - the desktop panel stack keeps base-10 heights after a base change; a new panel in the stack interacts with it

### Code this phase extends
- `app/presets/base10/lore.ts` - `ZONE_PARTICLE` (the 10 CCRU zone sounds) and `DEMON_NAMES` (the 45 canonical names, keyed by mesh number)
- `app/presets/base10/demons.ts` and `app/lib/demonBrowser.ts` - `demonName(base, mesh)`, the name column source and the net-span fallback (`formatNetSpan`)
- `app/components/demons/DemonBrowser.tsx`, `DemonRowList.tsx`, `DemonMatrix.tsx`, `DemonFocusView.tsx` and `app/components/info/InfoDisplay.tsx` (`DemonInfo`) - where names are displayed today
- `app/lib/labelScheme.ts` and `app/components/numogram/LabelSchemeControls.tsx` - the label modes (`digits`, `xeno`, `preset`, `custom`) the `sounds` mode joins, and their URL codec in `app/lib/shareParams.ts`
- `app/components/panels/*` and `app/NumogramClient.tsx` (panel group layout, `usePanelGroupLayout`, `CyberPanel`, the history snapshot and `applySnapshot`) - where the new panel and the undo integration land
- `engine/core/numerals.ts` (`formatNetSpan`, numeral formatting) and `engine/core/demons.ts` (`DemonSpace`, `meshOf`) - the engine API names are derived from
- `engine/scene/tier-table.json` and `app/lib/tierBounds.ts` - `INTERACTIVE_MAX_N`

### Frozen oracles (never regenerate)
- `e2e/__golden__/**`, `e2e/__behaviour__/**` (with their manifests), `engine/test/fixtures/**` - must stay green; new DOM is `data-post-baseline`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/presets/base10/lore.ts`: `ZONE_PARTICLE` and `DEMON_NAMES` already hold exactly the CCRU preset's data; the preset adapter only has to read them.
- `app/lib/demonBrowser.ts`: a single `demonName(base, mesh)` seam (base 10 only today) feeding the browser name column and the legacy `Demon` shape InfoDisplay consumes; the natural place to resolve names through the new naming model.
- `app/lib/labelScheme.ts` plus its URL codec: a discriminated-union label scheme with one formatter, so a `sounds` mode is a new union member and a lookup, not a new rendering path.
- `usePanelGroupLayout` and `CyberPanel` (`onHeightChange`): the established way a new panel joins the stack and reports its real height.
- The snapshot-based undo history in `NumogramClient.tsx` (`snapshotState`, `applySnapshot`, base-guarded restore): the integration point for naming edits.
- Phase 6's `INTERACTIVE_MAX_N` and the worker request/response protocol (`app/lib/worker/*`): a model for any off-main-thread work and for the "seed-only above the ceiling" rule.

### Established Patterns
- Data and lore are separate and joined by id (Phase 2 D-06): the CCRU preset follows it.
- New DOM that must not disturb the frozen baseline carries `data-post-baseline=""` (the Text panel, the Canvas chrome).
- URL state goes through one allow-listed codec (`app/lib/shareParams.ts`, `SHARE_PARAM_KEYS`) with natural-tier guards for huge bases.
- Pure modules under `engine/` and `app/lib/` with fast-check properties and mutation checks, then a thin component (the Phase 5 and Phase 6 pattern); tier thresholds read from the table by property access.

### Integration Points
- `engine/index.ts` exports the new `engine/naming` barrel; `app/` consumes it through a small adapter beside `app/presets/base10/`.
- The new panel mounts in `NumogramClient.tsx` with the other panels (SVG, Canvas and headless tiers all show the demon name column, so naming state must reach the Demons overlay at every tier).
- The Selection demon detail (`InfoDisplay.tsx` `DemonInfo`) gains the rename affordance; `shareParams.ts` gains the `names` param and the `sounds` label mode value.

</code_context>

<specifics>
## Specific Ideas

- Base-10 reference sounds: 0 `eiaoung`, 1 `gl`, 2 `dt`, 3 `zx`, 4 `skr`, 5 `ktt`, 6 `tch`, 7 `pb`, 8 `mnm`, 9 `tn`. Canonical joins are visibly smoothed: 9::8 `Ummnu` from `tn` + `mnm`; 5::2 `Kuttadid` from `ktt` + `dt`. The guide's own smoothing example is "Xthnlghth" to "Xathnalgaheth": a target shape, not a spec.
- The user prefers the panel stack for the builder even though it is the tightest option; the design has to make a compact, scrollable panel feel complete (global controls on top, the zone list inside).
- Generated names should feel like the same mythos by default (harsh clusters), with softer and syllabic styles for users who want to read names aloud.
- Nothing is lost silently: shared links preview before replacing, autosave is per base, import of a wrong-base file is refused with an explanation.

</specifics>

<deferred>
## Deferred Ideas

- A zone's sound shown in the Zones panel rows and the zone detail, and names drawn along demon chords in focus mode: not chosen for v1.
- A larger table window for big edits: declined in favour of the compact panel (D-01).
- Canonical-name inheritance outside base 10 (a toggle applying the 45 names to demons between zones 0-9 in other bases): declined (D-14).
- Collision repair (a "regenerate to reduce collisions" action, automatic disambiguating suffixes): declined (D-12).
- A user case setting for derived names, and punctuation-rich or spaced sounds: declined (D-07, D-08).

### Reviewed Todos (not folded)
`todo.match-phase 7` returned no matches. Todo 008 (desktop panel stack keeps base-10 heights after a base change) is not folded but is directly relevant to D-01 and is cited in the canonical references; todo 007 (lazy-load the Canvas and worker code), 006 (base 10's drawn shape) and 009 (Phase 6 review info items) belong elsewhere.

</deferred>

---

*Phase: 07-naming-builder*
*Context gathered: 2026-10-19*

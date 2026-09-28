# Phase 4: Base Picker and Generator UI - Research

**Researched:** 2026-09-28
**Domain:** React/TypeScript SVG diagram generalization, URL state codecs, Unicode glyph-coverage detection, accessibility (keyboard/ARIA) for a data visualization
**Confidence:** MEDIUM-HIGH (all core findings verified by direct code reads of this repo; the glyph-detection and a11y-pattern claims are WebSearch-verified against 2026 sources; a few UX-shape decisions are flagged `[ASSUMED]` for discuss-phase/planner confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Base Picker**
- **D-01:** The numeric type-in field is the primary, most visually prominent input; stepping, sliding and the notable-base chips (all required by UI-01) sit alongside it, not competing for primacy.
- **D-02:** The live summary (zones, Warp yes/no, Torque cycle lengths, demon count) is built into the picker control itself, not folded into the existing Selection/Info panel.
- **D-03:** The base picker is a new standalone control in the header, alongside the existing layout switcher (undo/redo/share/layout) — a first-class always-visible action, not one more panel in the panel group.
- **D-04:** Changing the base previews live as you type or drag, debounced (not gated behind an Enter/confirm step). Odd/too-large bases are still refused per UI-02 — the debounce doesn't wait for the refusal check.
- **D-05:** The stepper (+/-) steps by 2 only (next/previous even base). No larger-jump modifier is required; Claude may add one (e.g. a shift-click x10 jump) at its discretion if it feels natural.
- **D-06:** On an odd or refused (too-large) base, the diagram keeps showing the last valid base — it never goes blank or greys out — while an inline message (appearing right next to the picker, not a toast/banner elsewhere) explains the refusal.
- **D-07:** The notable-base chip set specified by UI-01 (`2, 4, 6, 8, 10, 12, 16, 22, 28, 80, 82`) is amended by the user to add `64`, `100` and `1024`. **Final chip set: `2, 4, 6, 8, 10, 12, 16, 22, 28, 64, 80, 82, 100, 1024`.** REQUIREMENTS.md's UI-01 wording must be updated to this list during planning/execution.

**Zone Labels Beyond Base 36**
- **D-08:** The default label style at any base is decimal-with-separator (matches the engine's existing numeral formatter from Phase 2) — not a custom alphabet by default. Custom alphabet and xenotation are opt-in.
- **D-09:** Xenotation (today's prime-factor notation, `app/lib/xenotation.ts`) is an alternate label mode that occupies the same display slot as the zone's numeral — switching to it replaces the shown text, it does not add a secondary annotation alongside the number.
- **D-10:** Custom alphabet supports **both** a small set of curated presets (2-4 to start) **and** a fully user-defined character set — not either/or.
- **D-11:** A custom alphabet is one reusable ordered list of characters, applied to however many digits a given base needs — not configured separately per base.
- **D-12:** Custom-alphabet validation (font/glyph coverage, uniqueness, sufficient length for the current base) surfaces inline as the user types, before it's applied to the diagram.
- **D-13:** The chosen label scheme (which mode — decimal/custom/xenotation — plus which preset or custom character set) is part of the shareable URL codec, so a share link reproduces exactly how zone labels looked for the sender.

**Big-Base Degradation UX**
- **D-14:** Above the measured SVG limit (Phase 3's `tier-table.json`, currently `svgRichMaxN: 200`), the page automatically shows the numeric summary and the accessible text view instead of the interactive diagram — this happens the moment an over-limit base is picked, not behind an extra "load it anyway" click.
- **D-15:** The refusal/fallback message is short and factual: states the fact plainly (base too large for the interactive diagram, showing summary and text view instead), no apology, no jargon.
- **D-16:** The message shows the actual measured cutoff number, sourced live from `tier-table.json` (not hard-coded prose) — transparent about exactly where the line is, and stays correct if the table is re-measured later.
- **D-17:** Phase 4 implements only two effective render tiers for now: full rich SVG, or the summary/text-view fallback. Phase 3's measured intermediate "SVG-lean" tier (which buys headroom to ~300 zones) is **deferred** — its visual design was never decided, so designing and building it is out of scope here.
- **D-18:** The `tier=` URL override (already built in Phase 3, D-13 there) stays diagnostic-only. No user-facing "show it anyway" button is offered when a base is refused.

**Region Legend**
- **D-19:** **Isolate** = spotlight: shows only that region, dims (but keeps present) everything else. **Mute** = hard hide: that region's zones/lines disappear from view entirely. These are two distinct, complementary actions — not a single 3-state toggle per region.
- **D-20:** Every Torque cycle gets its own row (with a stable id) in one scrollable legend list, regardless of how many there are (base 64 needs 6, larger bases may need more) — no grouping/collapsing behind a summary row.
- **D-21:** Isolate/mute state extends the existing URL codec (alongside `region=`), so a share link reproduces exactly which regions were isolated/muted.
- **D-22:** Multiple regions can be isolated and/or muted at the same time — each region's state is independent, any combination is valid.
- **D-23:** Isolate/mute apply uniformly to **all** regions, including Plex and Warp, not just Torque cycles.
- **D-24:** Torque cycle rows are ordered by cycle length descending, matching the engine's own canonical cycle order (Phase 2) — not by stable id/alphabetical order.

**Folded Todos**
- **Todo 003:** real mouse clicks are dropped on Zones/Syzygies/Currents/Gates row text in Chromium (suspected `CyberPanel` remount-on-mousedown); the shell already overlaps below ~390px width; panel-collapse-toggle code is dead — decide whether to delete it or make panels genuinely collapsible.
- **Todo 005:** expose the shelf-vs-spiral packer choice (`engine/layout/params.ts`) as a user-facing toggle/setting in the live viewer.

### Claude's Discretion
- Exact visual styling/polish of the header base-picker control.
- Whether to add a larger-jump stepper modifier (not required; may be added if it feels natural, per D-05).
- Exact wording of the refusal/fallback message beyond "short and factual, shows the measured number" (D-15/D-16).
- The specific 2-4 curated alphabet presets' actual character sets — subject to this phase's own targeted research (below).
- Visual treatment (exact dim opacity/style) distinguishing an isolated-out region from a muted one.
- Where/how todo 003's dead panel-collapse code gets resolved (delete vs. wire up for real).
- Where and how the packer-choice toggle from todo 005 fits visually.

### Deferred Ideas (OUT OF SCOPE)
- Phase 3's measured SVG-lean intermediate tier's visual design (D-17) — not built now.
- A user-facing "try anyway past the limit" override (D-18) — declined; `tier=` diagnostic flag remains for technical users.
- A larger-jump stepper modifier (D-05) — Claude's discretion, may not land in this phase.
- New capabilities out of this phase's boundary entirely: two-base comparison, base atlas, flow tracer (all v2, CMP-01/02, FLW-01).
- **Scope guard found during research:** the project's `REQUIREMENTS.md` Out-of-Scope table explicitly excludes "Planet / zodiac / tarot / I Ching correspondence packs for arbitrary bases." This rules out zodiac/tarot/alchemical glyph sets as curated custom-alphabet presets even though they would visually fit a "numogram" theme — see Priority 1 below, presets are drawn from plain Unicode letter/symbol blocks instead.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Base picker: type/step/slide/chip, odd refused with explanation, live summary | D-01..D-07 confirmed against engine API (`Numogram.zoneCount`, `.warp`, `.torques[].lengthInPairs`, `.demons.count` are all O(1)/cached — see Architecture Patterns, Code Examples). Chip set corrected per D-07. |
| UI-02 | `?base=` in URL, back-compat with existing base-10 links, absurd bases refused | Three existing URL-param code paths found and documented (Priority 2). `validateBase`/`assertBase` in `engine/core/base.ts` already reject odd/too-large/non-integer bases with typed reasons — reuse directly, do not re-implement. |
| UI-03 | In-base digits to base 36, decimal-with-separator beyond, custom-alphabet + xenotation options, integer stays the URL/JSON/demon-key identity | `engine/core/numerals.ts` (`formatNumeral`/`parseNumeral`) already implements D-08's default scheme exactly. Xenotation (`app/lib/xenotation.ts`) is base-agnostic already but its `xenotationByZone()` wrapper is base-10-hard-coded (MIG-02 site, Priority 3). Custom-alphabet glyph-coverage detection researched in Priority 1. |
| UI-04 | Hover/pin zone, syzygy, current, gate to highlight + detail panel | Existing pattern in `InfoDisplay.tsx`/`Projection.tsx`/`HoverInfo` union type (`app/data/types.ts`) is sound in shape but every data source it reads (`SYZYGIES`, `GATE_LIST`, `ALL_DEMONS`, `plexExpr`) is base-10-hard-coded — this is the same generalization surface as MIG-02, not a separate mechanism. |
| UI-05 | Region legend: Plex, Warp, every Torque cycle, stable id, isolate/mute | `Numogram.torques`/`.plex`/`.warp`/`Cycle.id` (engine/core/types.ts) already provide exactly the canonical-order, stable-id structure D-20/D-24 need. Existing `Region` type (`'torque'\|'warp'\|'plex'`) is a **single-Torque-cycle assumption** that must be replaced — Priority 4. |
| UI-06 | Layer toggles, zoom/pan/fit | `useCanvasPan.ts`'s `useCanvasZoom` already exists and is base-agnostic (operates on the SVG wrapper, not zone data) — reusable as-is. Layer toggle set (`Layer` type) is already generic enough (`syzygies\|currents\|gates\|pandemonium`), no change needed for the toggle mechanism itself, only for what each layer reads. |
| UI-07 | Keyboard traversal, ARIA, non-colour cues, reduced-motion, text view + copy | Zero existing ARIA/`tabIndex`/`role` on the diagram today (grep-verified). Existing keyboard shortcuts are digit-key (`0-9`) gate shortcuts, structurally incompatible with n > 10 zones. Reduced-motion is CSS-only today (`globals.css`), does not gate the JS `requestAnimationFrame` tweens (`useTween.ts`, `useOrbitalAnimation.ts`, `engine/layout/tween.ts`). Priority: keyboard/ARIA research below (WebSearch-verified, 2026 sources). |
| UI-08 | Changing base sanitizes selection/history/animation, no stale state | `HistorySnapshot` (NumogramClient.tsx) and `MAX_HISTORY_ENTRIES` undo/redo stack are entirely `Layout`/`Layer`/zone-id shaped for base 10; base-switch must clear or re-key this stack (a snapshot from base 28 is meaningless once base 12 is loaded). No existing hook does this — new logic needed. |
| MIG-02 | No hard-coded 10-zone constants; CI grep gate; bases 2-40 smoke-render clean | Concrete file-by-file list and verified grep patterns in Priority 3 below. |
</phase_requirements>

## Summary

Phase 4 turns a base-10-only, hand-authored React SVG viewer into a base-generic generator. The engine (Phase 2) and layout/tier system (Phase 3) already expose everything the UI needs in base-agnostic form — `createNumogram(base)`, `Cycle[]` in canonical order, `formatNumeral`/`parseNumeral`, `resolveLayout`/`lerpPositions`/`tweenAllowed`/`selectTier` — none of that needs to be built. **The entire phase is app-layer work**: no new npm dependency is needed anywhere in this phase's scope.

Direct code reading (not assumption) turned up four load-bearing findings the planner must account for:

1. **`app/lib/shareParams.ts` is dead code at runtime.** Its `canonicalizeShareParams()` was written for `app/api/share-image/route.ts`, a Vercel serverless route that no longer exists in this static export (removed per FND-03/CLAUDE.md's static-first rule). `NumogramClient.tsx` has its own two hand-rolled, unvalidated URL parsers that duplicate (and diverge from) `shareParams.ts`'s allow-lists. "One codec replaces three parsers" means resurrecting `shareParams.ts` into the thing that's actually imported, not just extending an already-wired module.
2. **The `Region` type (`'torque' | 'warp' | 'plex'`)** used throughout `app/data/types.ts`, `RegionsPanel.tsx`, `app/lib/constants.ts`'s `REGION_CLR`, and `shareParams.ts`'s `ALLOWED_REGIONS` hard-codes the base-10 assumption of **exactly one** Torque cycle. Base 64 needs 6 Torque-cycle rows (D-20); this type cannot represent that today. The engine's own `Cycle.id`/`torqueIndex`/`torqueLabel()` already provide the stable per-cycle identity the region legend needs — the region-id concept must be rebuilt on top of those, not the old `Region` union.
3. **The Zones/Syzygies/Currents/Gates row-click bug (todo 003) has a confirmed root cause**, verified by reading `shared.tsx`, `CyberPanel.tsx`, `ZonesPanel.tsx`, `SyzygiesPanel.tsx`, `CurrentsPanel.tsx`, `GatesPanel.tsx`, `LayersPanel.tsx`, `RegionsPanel.tsx`, and `HoverInfoList.tsx` side by side. See Common Pitfalls / Pitfall 1.
4. **`Projection.tsx` (1061 lines) and `NumogramClient.tsx` (1727 lines)** are the two files that actually need to become base-generic; the layout/tier engine work from Phase 3 was explicitly *not* wired into them yet ("`NumogramClient.tsx` / `Projection.tsx` are not edited" — Phase 3 CONTEXT.md). This phase is where that wiring finally happens, and it is the largest single risk surface for breaking the 60 frozen DOM goldens (which capture only the base-10 `<svg>` — CLAUDE.md).

**Primary recommendation:** Treat this phase as "generalize two files (`Projection.tsx`, `NumogramClient.tsx`) plus retire one dead file into service (`shareParams.ts`)," with the base picker, region legend, and label-scheme UI as new, mostly-additive components layered on top of the engine's already-generic API. Do not design new math or new libraries; every numeric/structural primitive already exists in `engine/`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Base validation (odd/too-large refusal) | Browser/Client (React state) | Engine (`validateBase`) | UI must show the refusal message live (D-06) without waiting on a server; `engine/core/base.ts` already does the pure validation, the client just calls it per keystroke. |
| Numogram structure (zones/pairs/cycles/demons) | Browser/Client (in-page, via `engine/`) | — | Static export, no backend (CLAUDE.md); `createNumogram` runs client-side, cached (LRU 4). |
| Layout/coordinates for a base | Browser/Client (`engine/layout`) | — | Pure, deterministic, already built in Phase 3; consumed directly by the React tree. |
| SVG rendering + interaction (hover/pin/keyboard) | Browser/Client (`Projection.tsx`) | — | Must stay React (not the `engine/scene/svgString.ts` string emitter) because only React can attach `onClick`/`onMouseEnter`/`tabIndex`/`aria-*` per node; the string emitter is for the future headless export path (Phase 8), a separate consumer of the same engine. |
| URL state (share links, `?base=`, label scheme, region isolate/mute) | Browser/Client | — | Static site, `URLSearchParams`/`history.replaceState` only; no server round-trip exists or should exist. |
| Big-base degradation (tier selection) | Browser/Client, reading committed data (`tier-table.json`) | — | `engine/scene/tiers.ts`'s `selectTier`/`tweenAllowed` are pure functions over a committed JSON table (not a live measurement) — read at build or runtime, still client-side. |
| CI grep gate for MIG-02 | Build/CI (`scripts/check-repo.mjs`) | — | A static-analysis guard, not a runtime concern; belongs beside the project's existing `check:repo` checks. |

## Standard Stack

### Core

No new runtime dependency is needed for this phase. Everything required is either already in `package.json` or already implemented in `engine/`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 14.2.35 (pinned, exact) | App shell, static export | CLAUDE.md: exact pin, no upgrade phase. `npm view next version` reports 21.0.0 as latest [VERIFIED: npm registry], irrelevant here — this project is deliberately frozen on 14.2.35. |
| `react` / `react-dom` | ^18.3.0 | UI | Already the whole app; `Projection.tsx`/`NumogramClient.tsx` generalization stays inside this. |
| (native) `URLSearchParams`, `URL`, `history.replaceState` | browser built-in | URL codec | Already the pattern in both `shareParams.ts` and `NumogramClient.tsx`; no query-string library needed at this scale (8-10 keys, flat values). |
| (native) `document.fonts`, `CanvasRenderingContext2D` | browser built-in | Glyph-coverage heuristic for custom alphabets | See Priority 1 / Don't Hand-Roll below — no light-weight npm package solves this better than a ~30-line canvas heuristic for this project's scale. |
| `engine/core/numerals.ts`, `engine/core/base.ts` | in-repo (Phase 2) | Numeral formatting, base validation | Already implements D-08's exact contract; do not reimplement. |
| `engine/layout/*`, `engine/scene/tiers.ts` | in-repo (Phase 3) | Layout, tween cutoff, tier selection | Already implements D-09 (Phase 3)/D-14..D-18 (Phase 4) mechanics; Phase 4 wires it into the live component tree for the first time. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | 1.63.0 (pinned) | e2e, including new real-mouse regression test for todo 003 and new keyboard-traversal tests | Already the project's only e2e tool; `locator.click()`/`page.mouse` needed for todo 003's test per its own acceptance criteria (a DOM-level `.click()` cannot reproduce the bug). |
| `vitest` | 5.0.2 | Unit tests for the URL codec, glyph-coverage heuristic, region-legend state reducer | Already the project's only unit test runner. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled canvas glyph-coverage heuristic | `opentype.js` / `fontkit` to parse actual font files and read `cmap` | These parse a specific font **file** (e.g. a shipped webfont's `.woff2` bytes); they cannot inspect whichever system font a visitor's OS/browser actually substitutes for an arbitrary Unicode character, which is exactly the unknown this project has (no webfont is shipped — the app uses `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`, confirmed in `app/globals.css`). Not adopted: wrong tool for "does this visitor's real font stack render this glyph," adds a real dependency for a problem the canvas heuristic already solves approximately. |
| Hand-rolled URL codec extension | A schema/validation library (e.g. `zod`) for the unified codec | Would be a genuinely reasonable choice for the growing param surface (base, layout, label scheme, region isolate/mute, layers, selection...), but adds a new dependency the project doesn't otherwise need; the existing `shareParams.ts` allow-list pattern (`ALLOWED_LAYOUTS`/`ALLOWED_LAYERS`/`ALLOWED_REGIONS` sets, one `fail()` helper) already reads cleanly and scales to a few more keys. Recommend extending the existing hand-rolled pattern; flag as a future candidate only if the codec's field count roughly doubles again in a later phase. |
| React state soup (`useState` x 20+ in `NumogramClient.tsx`) | `useReducer` or split into a dedicated `useNumogramSession` hook | Not a hard requirement of any UI-0x requirement, but `NumogramClient.tsx` is already 1727 lines and this phase adds base, layout params (packer), label scheme, and per-region isolate/mute state on top. Recommend the planner budget a refactor task (extract a reducer or a few cohesive hooks) rather than adding more flat `useState` calls to the same function — this is a maintainability call, not a correctness one, so it's `[ASSUMED]`-tier judgment, not a locked requirement. |

**Installation:** none required — no `npm install` needed for this phase's known scope.

**Version verification:**
```
$ npm view next version
21.0.0   [VERIFIED: npm registry, 2026-09-28 — informational only; CLAUDE.md pins this project to 14.2.35]
$ node -v && npm -v
v22.16.0 / 11.6.2   [VERIFIED: local environment matches CLAUDE.md's stated Node 22 / npm 11 baseline]
```

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │   Header (D-03: new standalone control)     │
                         │   ┌───────────────┐  ┌──────────────────┐   │
   user types/steps/     │   │  Base Picker  │  │ Layout switcher   │  │
   drags/clicks a chip ─▶│   │ (numeric field│  │ (existing: undo/  │  │
                         │   │  + stepper +  │  │  redo/share/      │  │
                         │   │  slider+chips)│  │  layout buttons)  │  │
                         │   └───────┬───────┘  └──────────────────┘  │
                         └───────────┼───────────────────────────────┘
                                     │ debounced (D-04) candidate base N
                                     ▼
                    ┌────────────────────────────────┐
                    │ validateBase(N)  (engine/core)  │──fail──▶ inline refusal
                    │  odd / too-large / non-integer  │          message (D-06),
                    └────────────────┬─────────────────┘         diagram unchanged
                                     │ ok
                                     ▼
                    ┌────────────────────────────────┐
                    │ createNumogram(N)  (cached LRU) │
                    └────────────────┬─────────────────┘
                                     │ Numogram (zones/pairs/cycles/demons)
                     ┌───────────────┼────────────────────────┐
                     ▼                                         ▼
        ┌────────────────────────┐                ┌─────────────────────────┐
        │ resolveLayout(g, id)   │                │ live summary computed   │
        │ (engine/layout)        │                │ directly from Numogram: │
        │  -> Layout (x,y arrays)│                │ zoneCount, warp!=null,  │
        └───────────┬────────────┘                │ torques[].lengthInPairs,│
                     │                             │ demons.count            │
                     ▼                             └─────────────────────────┘
        ┌────────────────────────┐
        │ selectTier(N, table)   │──"svg"──▶ ┌───────────────────────────────┐
        │ (engine/scene/tiers)   │           │ Projection.tsx (React SVG)    │
        └───────────┬────────────┘           │  generalized: reads Numogram  │
                     │                        │  + Layout instead of app/data │
             "headless"/over limit            │  hover/pin -> HoverInfo ->    │
                     ▼                        │  InfoDisplay detail panel     │
        ┌────────────────────────┐            │  region isolate/mute (D-19)  │
        │ Summary + text view    │            │  keyboard traversal + ARIA   │
        │ (D-14..D-18) with a    │            └───────────────┬───────────────┘
        │ copy button (UI-07)   │                            │
        └────────────────────────┘                            ▼
                                                   ┌─────────────────────────┐
                                                   │ Region legend (UI-05)   │
                                                   │ rows from g.torques     │
                                                   │ (canonical order) +     │
                                                   │ g.plex + g.warp         │
                                                   └─────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ URL codec (single module, extends app/lib/shareParams.ts):               │
  │  read on mount: ?base, ?layout, ?labels(scheme), ?region(isolate/mute),  │
  │                 ?layers, ?selected, ?packer, legacy ?tc/?date/?orbits    │
  │  write on change: same keys, `base` omitted when 10 (back-compat, UI-02)│
  └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No wholesale restructure is required or recommended; extend the existing tree:

```
app/
├── components/
│   ├── numogram/
│   │   └── BasePicker.tsx          # NEW — D-01..D-07, sits in the header (D-03)
│   ├── panels/
│   │   ├── RegionsPanel.tsx        # GENERALIZED — N Torque rows + Plex/Warp, isolate+mute (D-19..D-24)
│   │   ├── ZonesPanel.tsx          # FIXED (todo 003) — hoist ItemDisplayComponent out of render
│   │   ├── SyzygiesPanel.tsx       # FIXED (todo 003) — same
│   │   ├── CurrentsPanel.tsx       # FIXED (todo 003) — same
│   │   └── GatesPanel.tsx          # FIXED (todo 003) — same
│   └── projection/
│       └── Projection.tsx          # GENERALIZED — reads Numogram+Layout, adds ARIA/tabIndex/keyboard
├── lib/
│   ├── shareParams.ts              # REVIVED + EXTENDED — becomes the one URL codec (base, labels, region isolate/mute, packer)
│   ├── numogram.ts                 # GENERALIZED — plexExpr must take `base`, use in-base digit sum not decimal
│   ├── xenotation.ts               # GENERALIZED — xenotationByZone() must take `base`/zoneCount, not hard-coded 0..9
│   ├── customAlphabet.ts           # NEW — glyph-coverage + uniqueness + length validation (D-12), curated presets (D-10)
│   └── glyphCoverage.ts            # NEW — canvas heuristic (Don't Hand-Roll section)
├── data/*.ts                        # UNCHANGED SHAPE, now must be produced for ANY base, not just 10 (via app/presets or a generic adapter — see MIG-02)
scripts/
└── check-repo.mjs                   # EXTENDED — new MIG-02 grep gate (patterns verified below)
```

### Pattern 1: Debounced live-preview base input driving a pure validator

**What:** The numeric field/slider/stepper updates a local "candidate" state on every keystroke/drag tick; a debounced effect (150-300ms is typical for this kind of live-preview field) calls `validateBase()` and only commits to the real `base` state (which drives `createNumogram` and the whole render tree) on success. On failure, the last-good `base` is untouched and the `BaseCheck.message` is shown inline (D-06).
**When to use:** Exactly the base picker (D-04).
**Example:**
```typescript
// Source: engine/core/base.ts (already in this repo, Phase 2)
import { validateBase } from '../../engine/core/base'

const [candidate, setCandidate] = useState('10')     // raw text, may be invalid mid-type
const [base, setBase] = useState(10)                  // last committed, valid, even base
const [refusal, setRefusal] = useState<string | null>(null)

useEffect(() => {
  const id = setTimeout(() => {
    const n = Number(candidate)
    const check = validateBase(n)
    if (check.ok) { setBase(check.base); setRefusal(null) }
    else { setRefusal(check.message) }   // base state UNCHANGED — D-06
  }, 200)
  return () => clearTimeout(id)
}, [candidate])
```

### Pattern 2: Region identity built on `Cycle`, not the old `Region` union

**What:** Every region row's stable id should be derived from the engine's own `Cycle`, not a hand-typed string union.
**When to use:** Region legend (UI-05), region isolate/mute state, and the `region=` URL param.
**Example:**
```typescript
// Source: engine/core/types.ts (Phase 2, this repo) + engine/core/numerals.ts's torqueLabel
import { torqueLabel } from '../../engine/core/numerals'
import type { Numogram, Cycle } from '../../engine/core/types'

// D-24: g.torques is ALREADY in canonical order (length descending, then smallest zone ascending)
// — no client-side sort needed.
function regionRows(g: Numogram) {
  const rows = g.torques.map(cycle => ({
    id: `torque:${cycle.torqueIndex}`,       // stable within this base's session
    label: `Torque ${torqueLabel(cycle.torqueIndex)}`,  // 'Torque A', 'Torque B', ...
    lengthInPairs: cycle.lengthInPairs,
    kind: 'torque' as const,
  }))
  rows.push({ id: 'plex', label: 'Plex', lengthInPairs: g.plex.lengthInPairs, kind: 'plex' })
  if (g.warp) rows.push({ id: 'warp', label: 'Warp', lengthInPairs: g.warp.lengthInPairs, kind: 'warp' })
  return rows   // D-23: every row gets the same isolate/mute controls, uniformly
}
```

### Pattern 3: Roving-tabindex keyboard traversal for the SVG diagram (UI-07)

**What:** The diagram is one tab stop; arrow keys move a single logical focus among zone (then syzygy/current/gate) elements; the focused element gets `tabindex="0"`, all others `tabindex="-1"`; each interactive SVG element carries `role` + an accessible name (`aria-label` or a nested `<title>`).
**When to use:** Any composite widget where Tab should not visit every one of `n` (up to hundreds of) elements individually — the W3C SVG Accessibility API Mappings spec [CITED: w3.org/TR/svg-aam-1.0] confirms `tabindex` + `role` + accessible name is the supported mapping for making arbitrary SVG elements focusable and announced; the roving-tabindex pattern itself is standard WAI-ARIA APG guidance for composite widgets (grids, toolbars, trees) [CITED: multiple 2026 sources cross-verified, see Sources].
**Example:**
```tsx
// Illustrative shape, not existing code — Projection.tsx has zero tabIndex/role/aria-* today (grep-verified).
<g
  role="group"
  aria-label={`Numogram, base ${base}, ${zoneCount} zones`}
>
  {zoneOrder.map(z => (
    <g
      key={z}
      role="button"
      tabIndex={focusedZone === z ? 0 : -1}
      aria-label={`Zone ${formatNumeral(z, base)}${isSelected(z) ? ', selected' : ''}`}
      aria-pressed={isSelected(z)}
      onKeyDown={e => handleArrowNav(e, z)}
    >
      {/* existing circle/label rendering */}
    </g>
  ))}
</g>
```

### Pattern 4: Base-switch state sanitation (UI-08)

**What:** On every committed base change, clear or re-derive everything that is base-shaped: selection (`selZones`), undo/redo stacks (`HistorySnapshot[]`), in-flight tweens, and region isolate/mute state (since region ids like `torque:3` may not exist at the new base).
**When to use:** The `setBase`/commit path from Pattern 1.
**Example:**
```typescript
function onBaseCommitted(newBase: number) {
  setBase(newBase)
  setSelZones(new Set())          // UI-08: no stale zone ids from the old base
  setUndoStack([]); setRedoStack([])   // UI-08: a base-28 snapshot is meaningless at base 12
  setRegionState({})              // region ids are base-relative (Pattern 2) — must reset
  // tween: engine/layout/tween.ts's lerpPositions already throws RangeError on a base mismatch
  // (T-03 guard from Phase 3) — treat any in-flight tween as complete/cancelled before this point,
  // never feed it a from/to pair across two different bases.
}
```

### Anti-Patterns to Avoid
- **Reusing `engine/scene/svgString.ts` for the live viewer:** that emitter is a pure string builder for the dev review-sheet/future headless export (Phase 8). It cannot carry `onClick`/keyboard handlers/live ARIA state. The live viewer must stay a React component tree (`Projection.tsx`, generalized).
- **Defining a `SelectableListPanel`'s `ItemDisplayComponent` inline inside a panel's render function:** this is the confirmed root cause of todo 003 (Pitfall 1 below) — always use the `itemDisplay` inline-**function**-prop form (as `HoverInfoList.tsx` already does), or hoist the component to module scope.
- **Treating `region=` as a single value:** the old `shareParams.ts`/`NumogramClient.tsx` both model `region` as one optional single string (`torque | warp | plex`). D-22 requires independent multi-select isolate/mute state — this needs a new serialization (Priority 2 below), not a bigger enum.
- **Computing digit sums in decimal for the gate "plex expression" display:** `app/lib/numogram.ts`'s `plexExpr()` does `String(current).split('')` — a **decimal** digit sum. CLAUDE.md is explicit that "all arithmetic is in the numogram's own base... never decimal digit sums." This is a real correctness bug waiting to surface the moment `InfoDisplay.tsx`/`Projection.tsx` are generalized to non-10 bases; it must be rewritten in terms of `digitsOf(value, base)` from `engine/core/numerals.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Base validation (odd/too-large/non-integer) | A new regex/range check in the UI layer | `validateBase`/`assertBase` (`engine/core/base.ts`) | Already returns a typed `BaseProblem` reason and a ready-to-display message; re-implementing risks a second source of truth that drifts from ENG-04's frozen behavior. |
| Numeral formatting beyond base 36 | A new decimal-with-separator formatter | `formatNumeral`/`parseNumeral` (`engine/core/numerals.ts`) | D-08's exact scheme is already implemented, tested, and frozen as the Phase 4 contract per the file's own header comment ("the contract Phase 4 consumes for zone labels beyond base 36"). |
| Tier/render-mode selection, tween-allowed cutoff | New thresholds hard-coded in a component | `selectTier`/`tweenAllowed`/`labelsVisible` (`engine/scene/tiers.ts`) reading `tier-table.json` | These are exactly D-14..D-18's mechanism, already measured on real hardware (Phase 3) and schema-validated; hard-coding a new number in `NumogramClient.tsx` would violate D-16 ("sourced live from tier-table.json, not hard-coded prose"). |
| Layout coordinates / animated layout switch | New coordinate math or a new tween formula | `resolveLayout`, `lerpPositions` (`engine/layout/*`) | Already deterministic, O(n), base-agnostic, and specifically designed so "two layouts of the same base are two equal-length coordinate arrays" — exactly what a base-generic tween needs. |
| Font/glyph coverage detection for custom alphabets | A full font-parsing library (`opentype.js`, `fontkit`) reading a shipped font file | A small canvas width/bounding-box heuristic against a Private-Use-Area "known-missing" reference glyph | This project ships no webfont (`app/globals.css` uses the OS system-font stack only) — there is no font *file* to parse. The real question is "what will THIS VISITOR's OS substitute," which only a canvas render-and-compare can approximate. See Priority 1 findings below. |
| Region isolate/mute + URL serialization | A generic "visualization state" library | Extend `app/lib/shareParams.ts`'s existing allow-list pattern | The existing pattern (a `Set` of allowed values, one `fail()` helper, canonicalized sorted output) already fits an "id:state" pair list; introducing a schema library for ~10 keys is disproportionate (see Alternatives Considered). |

**Key insight:** Every mathematical or structural primitive this phase needs was already built, tested, and frozen in Phases 2-3. The actual net-new work is UI composition (base picker, region legend, label-scheme controls), state plumbing (URL codec, base-switch sanitation), accessibility (ARIA/keyboard/reduced-motion/text view), and fixing two real, verified bugs (todo 003's remount, `plexExpr`'s decimal-only math). Treat any temptation to "just compute this base's numerals/layout locally in the component" as a sign the engine API is being bypassed.

## Runtime State Inventory

Not applicable in the traditional sense (no databases, external services, OS registrations, or secrets exist in this project — CLAUDE.md: static-first, no server routes, no backend). Included for completeness since MIG-02 is a "remove hard-coded constants" migration:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — static export, no database, no persisted server-side state. | None. |
| Live service config | None — no external services are configured for this app (CLAUDE.md explicitly forbids Vercel Blob/Analytics/server routes). | None. |
| OS-registered state | None — the app is a static site with no installed services, scheduled tasks, or daemons. | None. |
| Secrets/env vars | `NEXT_PUBLIC_BASE_PATH` is the only env var this app reads (static-export sub-path support, Phase 1). Unaffected by this phase. | None. |
| Build artifacts | The 60 frozen DOM goldens (`e2e/__golden__/**`) and the behaviour baseline (`e2e/__behaviour__/**`) capture the **base-10** `<svg>` only. Generalizing `Projection.tsx`/`NumogramClient.tsx` for other bases must not change base-10's rendered output byte-for-byte — this is the one "artifact" this phase must protect, not migrate. | Verify unchanged after every task touching shared render code; never regenerate with `-u` (CLAUDE.md). |

## Common Pitfalls

### Pitfall 1: Inline `ItemDisplayComponent` causes remount-on-mousedown, dropping real clicks (todo 003 root cause, CONFIRMED)
**What goes wrong:** Real mouse clicks (mousedown-then-mouseup) on the text of Zones/Syzygies/Currents/Gates rows are silently dropped in Chromium; clicks on row padding, keyboard activation, and `element.click()` all work fine.
**Why it happens:** Verified by reading the full chain:
- `ZonesPanel.tsx`, `SyzygiesPanel.tsx`, `CurrentsPanel.tsx`, `GatesPanel.tsx` each define `const XxxItemDisplay = ({item}) => (...)` **inside** their component function body, then pass it as `<SelectableListPanel ItemDisplayComponent={XxxItemDisplay} ...>`.
- `shared.tsx`'s `SelectableListPanel` renders this as `const ItemDisplay = props.ItemDisplayComponent; return <ItemDisplay item={item} index={index} />` — i.e. as a **component type**, not inline JSX.
- Because `XxxItemDisplay` is a **new function identity on every render** of its parent panel, React treats every render's `<ItemDisplay/>` as a different component type than the last, and **unmounts + remounts the entire row subtree** on every re-render of that panel — not only on click.
- `CyberPanel.tsx`'s root div has `onMouseDownCapture={() => onActivate?.(id)}`, which calls `activatePanel` (from `usePanelDrag`), a state setter — so the very first `mousedown` of a click gesture triggers a re-render of `NumogramPage`, which re-renders the child panel, which recreates `XxxItemDisplay`, which remounts the DOM node the mousedown just landed on, **before** `mouseup` fires. Chromium suppresses the `click` event when the `mousedown` target is removed from the DOM before `mouseup` — hence "clicks on row text are dropped."
- **Layers/Labels/Regions panels are unaffected** because they all go through `HoverInfoList.tsx`, which always uses the `itemDisplay={({item}) => (...)}` inline-**function**-prop form — `renderItem` calls `props.itemDisplay({item, index})` directly as a plain function call within the same reconciliation pass, never introducing a new component boundary, so nothing remounts.
**How to avoid:** Hoist `ZoneItemDisplay`/`SyzygyItemDisplay`/`CurrentItemDisplay`/`GateItemDisplay` to module scope (stable identity across renders), or convert all four panels to the same `itemDisplay` function-prop pattern `HoverInfoList` already uses. Either fix is small and localized to the four panel files plus (optionally) tightening `shared.tsx`'s type to discourage the inline-component form in the future.
**Warning signs:** Any new panel built during this phase (e.g. the region legend, Priority 4) that needs a distinct per-row component MUST NOT define that component inline in the parent's render function if the parent's own render can be triggered by the click gesture itself (e.g. via `onActivate`).
**Regression test:** todo 003's own acceptance criteria require a **real-mouse** Playwright test (`locator.click()` or `page.mouse.down()`/`up()`), first failing on current code, then passing after the fix — a DOM-level `.click()` won't reproduce this bug (it dispatches a synthetic click without a real mousedown/mouseup pair).

### Pitfall 2: `plexExpr`'s decimal digit-sum is a live correctness bug once non-base-10 zones reach `InfoDisplay`/`Projection`
**What goes wrong:** `app/lib/numogram.ts`'s `plexExpr(cum)` does `String(current).split('').map(Number)` — a base-10 (decimal) digit sum, used today only because base-10 zones' cumulation values happen to be displayed in decimal already. The moment `InfoDisplay.tsx`/`Projection.tsx` are generalized to any other base, this function will silently compute the WRONG digital root for that base (CLAUDE.md's core rule: `T===0 ? 0 : ((T-1) % (n-1)) + 1`, "never decimal digit sums").
**Why it happens:** The function predates the engine and was never migrated in Phase 2 because `GateInfo.to` (the correct in-base digital root) already comes from the engine — `plexExpr` is a separate, decorative "show your work" string (e.g. `"4+5=9"`) that was never rewired to the engine's own digit-sum definition.
**How to avoid:** Rewrite `plexExpr` to take `base` and use `digitsOf(value, base)` (already exported from `engine/core/numerals.ts`) for each reduction step, matching `GateInfo.to`'s own algorithm exactly (both must agree, since the frozen base-10 oracle already pins `GateInfo.to`).
**Warning signs:** Any base-28/64/etc. smoke test that pins the "gate explanation" string in `InfoDisplay.tsx`/`Projection.tsx` and finds it doesn't match `formatNumeral(gate.to, base)`.

### Pitfall 3: JS `requestAnimationFrame` tweens are not covered by the existing `prefers-reduced-motion` handling
**What goes wrong:** `app/globals.css` already has a `@media (prefers-reduced-motion: reduce)` block, but it only disables CSS transitions ("the only motion left in the shell is short hover/expand transitions"). The layout-switch tween (`useTween.ts`, and Phase 3's `engine/layout/tween.ts` `lerpPositions`) and the planetary orbit animation (`useOrbitalAnimation.ts`) are driven by `requestAnimationFrame`, which CSS media queries cannot touch.
**Why it happens:** The CSS rule was written before any JS-driven animation existed in scope for accessibility; UI-07's "reduced-motion support" requirement is new to this phase.
**How to avoid:** Read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (with a `change` listener) in the tween/orbit hooks and short-circuit to the end state instantly (`tweenProgress = 1`) when true, mirroring how `tweenAllowed(n, table)` already short-circuits large bases to an instant switch (Phase 3, D-09).
**Warning signs:** A reduced-motion e2e test (Wave 0 gap, see Validation Architecture) that toggles the OS/browser preference and asserts the layout switch completes in one frame.

### Pitfall 4: Digit-key (`0`-`9`) gate shortcuts cannot generalize past base 10
**What goes wrong:** The existing global keydown handler (`NumogramClient.tsx`, confirmed at the `/^[0-9]$/` regex test) maps a single digit keypress directly to "select the gate whose origin zone is that digit." This is structurally incapable of addressing zone 10+ with a single keypress.
**Why it happens:** It predates any base other than 10.
**How to avoid:** Scope the digit-shortcut convenience to base 10 only (`if (base === 10) { ...existing behavior... }`), and build the base-generic keyboard story around Pattern 3's roving-tabindex traversal (Tab into the diagram, arrow keys move focus, Enter/Space selects) for UI-07, which works identically at any base.
**Warning signs:** A base-28 keyboard e2e test that presses `2` expecting to reach zone 2 and instead needs Tab+Arrow+Enter — confirms the two mechanisms are intentionally different, not a partial migration.

### Pitfall 5: `Region` type / `REGION_CLR` / `ALLOWED_REGIONS` are all singular-Torque-cycle typed
**What goes wrong:** `Region = 'torque' | 'warp' | 'plex'` (app/data/types.ts), `REGION_CLR: Record<Region, string>` (app/lib/constants.ts), and `ALLOWED_REGIONS` (shareParams.ts) all assume there is exactly one "torque" region. Any code that pattern-matches on this type (switch statements, object literal keys) will not compile — or worse, will silently collapse all Torque cycles into one color/state — once a base with 2+ Torque cycles reaches these paths.
**Why it happens:** Base 10 has exactly one Torque cycle, so this was never wrong until now.
**How to avoid:** Introduce a new region-id concept keyed by `Cycle.id` (Pattern 2), and grep every consumer of the old `Region` type before deleting it, to confirm nothing still assumes cardinality 1.
**Warning signs:** TypeScript will catch most of this at compile time once the type changes (a real advantage of doing the type change early in the phase) — but `REGION_CLR`'s color-per-kind mapping (torque/warp/plex, 3 colors total) is still valid as a *kind*-level color scheme (all Torque cycles can share one color family, individually distinguished some other way, e.g. dimming/pattern) — decide this before generalizing, since D-24's canonical order plus D-20's "no grouping/collapsing" implies visually distinct Torque cycles are wanted, not just N copies of the same blue.

## Code Examples

### Base validation and live summary (UI-01)
```typescript
// Source: engine/core/base.ts, engine/core/types.ts (this repo, Phase 2) — all O(1)/cached, safe to call on every keystroke
import { validateBase } from '../../engine/core/base'
import { createNumogram } from '../../engine/core/numogram'

const check = validateBase(candidateNumber)
if (check.ok) {
  const g = createNumogram(check.base)   // LRU-cached (4 entries) — cheap even at base 1024
  const summary = {
    zoneCount: g.zoneCount,
    hasWarp: g.warp !== null,
    torqueCycleLengths: g.torques.map(t => t.lengthInPairs),   // e.g. [9, 3] for base 28
    demonCount: g.demons.count,                                 // e.g. 378 for base 28
  }
}
```

### Reading the tier boundary live (D-16), not hard-coded
```typescript
// Source: engine/scene/tierTable.ts (exports TIER_TABLE), engine/scene/tiers.ts (this repo, Phase 3)
import { TIER_TABLE } from '../../engine/scene/tierTable'
import { selectTier } from '../../engine/scene/tiers'

const tier = selectTier(base, TIER_TABLE)   // 'svg' | 'canvas' | 'headless'
// D-17: Phase 4 only builds two effective outcomes — treat anything not 'svg' as "show summary + text view".
// D-16: the message must read TIER_TABLE.boundaries.svgRichMaxN.n live (currently 200), never a literal "200" string.
const cutoff = TIER_TABLE.boundaries.svgRichMaxN.n
```

### The one already-correct in-base numeral formatter (D-08 default)
```typescript
// Source: engine/core/numerals.ts (this repo, Phase 2)
import { formatNumeral } from '../../engine/core/numerals'
formatNumeral(15, 16)     // 'f'      (base <= 36: single char)
formatNumeral(3601, 60)   // '1.0.1'  (base > 36: decimal groups joined by '.')
formatNumeral(5, 10, 2)   // '05'     (minDigits padding)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `app/lib/shareParams.ts`'s `canonicalizeShareParams()` consumed by `app/api/share-image/route.ts` | The share-image API route was removed (static-first, FND-03); `shareParams.ts` has been dead code at runtime ever since, only referenced by `.planning/codebase/INTEGRATIONS.md` (a pre-refactor snapshot) and tests. `NumogramClient.tsx` independently hand-rolled its own URL read/write logic. | Sometime before/during Phase 1 (static-export conversion) | The "single URL codec" ROADMAP note is a **revival + extension**, not a pure extension — the planner should budget a task to delete the duplicated inline logic in `NumogramClient.tsx` and route both directions (read-on-mount, write-on-change) through `shareParams.ts`. |
| Base-10-only `Region` single-cycle model | Engine's `Cycle`/canonical-order model (Phase 2) already supports N Torque cycles, but no app-layer consumer uses it yet | Phase 2 (engine), never wired into `app/` until this phase | The region legend (UI-05) is the first real consumer of multi-cycle regions; expect every file importing `Region` from `app/data/types.ts` to need a look. |
| Base-10-only reduced-motion (CSS transitions only) | UI-07 requires reduced-motion to also gate JS `requestAnimationFrame` tweens | This phase | New `matchMedia` listener needed in `useTween.ts`/`useOrbitalAnimation.ts`/wherever the generalized tween logic lands. |

**Deprecated/outdated:**
- The single-digit-key (`0`-`9`) gate-selection keyboard shortcut: kept only as a base-10 convenience per Pitfall 4, superseded by roving-tabindex traversal for the general case.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Curated custom-alphabet presets should be drawn from plain, near-universal Unicode blocks (Base62, Base64-URL-safe, ASCII-printable, Latin-1 Supplement) rather than themed/exotic symbol sets, because this app ships no webfont and relies entirely on OS-substituted system fonts. | Priority 1 (below) / Standard Stack | If the planner/user actually wants a themed preset (e.g. Greek letters, box-drawing), font coverage on some visitor's OS may be worse than assumed — mitigated by D-12's inline validation catching it live regardless of which preset is chosen. |
| A2 | A canvas width/bounding-box comparison against a Private-Use-Area reference codepoint is an acceptable glyph-coverage heuristic (approximate, not exact) for this project's needs. | Priority 1 / Don't Hand-Roll | False negatives possible if the OS's font-substitution system finds a fallback font that renders SOME box-shaped glyph resembling the PUA reference; false positives are rarer. This is a heuristic, not a guarantee — D-12 only asks for "inline feedback," not perfect detection, so this is judged acceptable, but the planner should phrase the UI copy as "may not render" rather than a hard guarantee. |
| A3 | `region=` URL syntax should be a comma-separated list of `id:state` pairs (e.g. `region=torqueA:isolate,warp:mute`), with unknown/malformed entries silently dropped rather than rejecting the whole URL. | Priority 2 (below) | If the intended UX is actually "reject the whole share link on any malformed region entry" (matching `shareParams.ts`'s existing strict `fail()`-throwing style rather than `NumogramClient.tsx`'s existing lenient style), the codec's error-handling shape would need to flip — low risk either way since both are simple to implement, but the choice affects whether a slightly-hand-edited URL still loads. |
| A4 | The base-10 digit-key (`0`-`9`) gate shortcut should be preserved unchanged at base 10 and simply not extended to other bases (rather than removed entirely). | Common Pitfalls / Pitfall 4 | If removed instead of base-10-gated, `ShortcutsModal.tsx`'s documented shortcut list and any existing base-10 muscle-memory workflow break; if kept exactly as-is this is zero-risk since it's an additive `if (base === 10)` guard. |
| A5 | `NumogramClient.tsx`'s flat `useState` collection should be left alone architecturally (only base-switch sanitation and new fields added) rather than refactored into a reducer, unless the planner explicitly budgets that as separate cleanup work. | Standard Stack / Alternatives Considered | If left unrefactored, the file grows past 1727 lines and future phases (Phase 5 demon browser, Phase 7 naming builder) inherit an even larger single component — a maintainability risk, not a correctness one. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should the unified URL codec be strict (reject the whole link on one bad param, like today's orphaned `shareParams.ts`) or lenient (drop the one bad field, like today's live `NumogramClient.tsx`)?**
   - What we know: the two existing implementations disagree with each other today, and neither is currently exercised by both a "read" and a "write" path consistently.
   - What's unclear: CONTEXT.md locks the *content* of the codec (base, label scheme, region isolate/mute) but not this error-handling shape.
   - Recommendation: lenient-per-field for hydration (matches "existing base-10 share links keep working," UI-02, and avoids a hand-edited URL nuking the whole session over one typo), but keep the explicit user-visible refusal message for `base` specifically (D-06/UI-02's own success criterion) — i.e., `base` is special-cased, everything else fails soft. Flag for discuss-phase/planner confirmation if this reads as ambiguous.

2. **Does the region legend's isolate/mute visually distinguish Torque cycles from each other (color per cycle), or do all Torque cycles share one visual "kind" color and rely on isolate/mute + labels to tell them apart?**
   - What we know: `REGION_CLR` today is a 3-color kind-level map (torque/warp/plex); D-20 requires every Torque cycle to have "its own row... with a stable id," which is a legend/state requirement, not explicitly a color requirement.
   - What's unclear: whether base 64's 6 Torque-cycle rows need 6 distinct colors in the diagram itself, or just 6 distinct legend rows over a shared visual "torque" color family.
   - Recommendation: start with one shared "torque" color family (matches existing base-10 palette, avoids inventing a 6+-color scale that must stay legible and colorblind-safe — UI-07's "non-colour cues" requirement already implies color alone shouldn't carry the distinction anyway), and let isolate/mute + hover be the primary way to tell cycles apart. Flag as Claude's discretion territory, not a locked decision either way.

3. **What are the final 2-4 curated custom-alphabet character sets?**
   - What we know: D-10 requires 2-4 curated presets; A1 above proposes Base62, Base64-URL-safe, ASCII-printable, Latin-1-printable as options that cover the notable-base chip set's needs (up to 100; 1024 auto-falls-back to decimal per D-08).
   - What's unclear: exact final list is explicitly "Claude's Discretion" per CONTEXT.md, so this is not blocking, but the planner should pick concrete names/character lists during planning rather than leaving it fully open at execution time.
   - Recommendation: adopt A1's four candidates as the starting proposal (see Priority 1 below for the exact character lists), trim to 2-3 if scope needs it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, dev, scripts | Yes | v22.16.0 [VERIFIED: local] | — (CLAUDE.md requires Node 22) |
| npm | Install, lockfile | Yes | 11.6.2 [VERIFIED: local] | CI uses npm 10 per CLAUDE.md — lockfile already regenerated with `npx npm@10.9.3` per existing project convention; no new package is added this phase, so no lockfile change is expected. |
| Playwright + Chromium | e2e (goldens, behaviour baseline, new todo-003 regression test, new keyboard/reduced-motion tests) | Assumed present per CLAUDE.md ("Playwright Chromium (~700 MB cache, 1.63.0) is needed... `npx playwright install chromium`") — not independently re-verified this session (no e2e run was executed as part of research). | 1.63.0 (pinned in `package.json`) | If missing in a fresh clone, `npx playwright install chromium` per CLAUDE.md's own documented step; no code fallback needed, this is a one-time environment setup. |
| `document.fonts` / Canvas API | Glyph-coverage heuristic (Priority 1) | Universal in evergreen browsers (Chromium, Firefox, Safari all support the Font Loading API and Canvas 2D) — not independently tested against a specific old-browser matrix this session. | — | If `document.fonts` is unavailable (very old browser), the heuristic can degrade to the canvas-only width-comparison check, which needs no Font Loading API at all — recommend the implementation not hard-depend on `document.fonts.check()` as a blocking gate, only as a fast pre-filter. |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** Playwright Chromium (documented one-time install step, not a code-level concern).

## Validation Architecture

`workflow.nyquist_validation` is enabled (`.planning/config.json` does not set it to `false`), so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | Vitest 5.0.2 [VERIFIED: `package.json`] |
| Framework (e2e) | `@playwright/test` 1.63.0, Chromium only [VERIFIED: `package.json`, CLAUDE.md] |
| Config files | `vitest.config.mts` (unit, both timezones via `CCRUG_TZ`), `playwright.config.ts` (e2e) [VERIFIED: found at repo root] |
| Quick run command (unit) | `npx vitest run <path-to-new-test-file>` (single file, fast loop) |
| Quick run command (e2e) | `npx playwright test e2e/<new-file>.spec.ts` |
| Full suite command | `npm run verify` (~4-4.5 min per STATE.md history: check-repo, typecheck, vitest x2 timezones, sub-path e2e, build, page-weight, full e2e including the 60 DOM goldens, clean-tree/static-out guard) |

Existing e2e spec files (all pre-Phase-4): `e2e/golden.spec.ts` (60 frozen DOM goldens), `e2e/behaviour.spec.ts` (frozen behaviour/text baseline), `e2e/static-export.spec.ts` (sub-path build). No spec file for live interactive UI (base picker, region legend, keyboard traversal, todo-003 real-mouse regression) exists yet — all net-new for this phase (Wave 0 gaps below).

No accessibility-audit tool (`axe-core`, `@axe-core/playwright`, `jest-axe`) is installed [VERIFIED: not in `package.json`]. HRD-01 (Phase 8) is where "an accessibility audit passes" is the formal gate; Phase 4 builds the actual a11y features UI-07 requires. Recommend targeted Playwright assertions against the accessibility tree (`page.locator(...).getByRole()`, keyboard-driven focus assertions, `page.emulateMedia`) for this phase's own tests rather than installing a full audit tool now — that decision belongs to Phase 8, not here.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| UI-01 | Typing/stepping/sliding/clicking a chip changes the base; odd input refused with a message next to the picker; live summary matches engine output (e.g. base 28 → 28 zones, cycles [9,3], 378 demons) | unit + e2e | unit: `npx vitest run app/components/numogram/BasePicker.test.tsx` (summary math against `createNumogram`); e2e: `npx playwright test e2e/base-picker.spec.ts -g "base 28"` | ❌ Wave 0 |
| UI-02 | `?base=28` reloads to the same view; `?base=` omitted for 10 still loads; an absurd base (e.g. `?base=99999999999`) is refused with a message, not a frozen tab | e2e | `npx playwright test e2e/url-codec.spec.ts` | ❌ Wave 0 |
| UI-03 | Zone labels are in-base digits ≤ base 36, decimal-with-separator beyond; custom alphabet + xenotation modes render and round-trip through the URL; integer identity preserved in URL/JSON/demon keys | unit + e2e | unit: `npx vitest run app/lib/customAlphabet.test.ts`; e2e: `npx playwright test e2e/label-scheme.spec.ts` | ❌ Wave 0 |
| UI-04 | Hover/pin a zone/syzygy/current/gate highlights it and opens the detail panel, at a non-base-10 base | e2e | `npx playwright test e2e/hover-pin.spec.ts -g "base 28"` | ❌ Wave 0 (existing `behaviour.spec.ts` only covers base 10) |
| UI-05 | Region legend lists Plex, Warp, every Torque cycle (e.g. 6 rows at base 64) with a stable id; isolate and mute are independent, multi-select, apply uniformly to all rows | unit + e2e | unit: `npx vitest run app/components/panels/RegionsPanel.test.tsx`; e2e: `npx playwright test e2e/region-legend.spec.ts -g "base 64"` | ❌ Wave 0 |
| UI-06 | Layer toggles show/hide the right elements; zoom/pan/fit work at a generated base | e2e | `npx playwright test e2e/layers-zoom.spec.ts` | ❌ Wave 0 (zoom/pan hook `useCanvasPan.ts` has no existing test file found) |
| UI-07 | Keyboard-only traversal reaches every zone/syzygy/current/gate; ARIA labels present; reduced-motion skips the tween; text view renders and its copy button works | e2e | `npx playwright test e2e/accessibility.spec.ts` (real keyboard events via `page.keyboard`, `page.emulateMedia({ reducedMotion: 'reduce' })`) | ❌ Wave 0 |
| UI-08 | Switching base clears selection, undo/redo stacks, and any in-flight tween/animation | unit + e2e | unit: a `HistorySnapshot`-reset test in whatever module owns base-switch sanitation (Pattern 4); e2e: `npx playwright test e2e/base-switch-reset.spec.ts` | ❌ Wave 0 |
| MIG-02 | CI grep gate finds none of the named hard-coded-10 patterns outside `app/presets/base10/**`; bases 2-40 smoke-render with no NaN/undefined | static + e2e | static: a new check in `node scripts/check-repo.mjs`; e2e/smoke: `npx playwright test e2e/smoke-bases.spec.ts` (loop `?base=2..40` step 2, assert no `NaN`/`undefined` text nodes) | ❌ Wave 0 (both the grep gate and the smoke test are new) |
| Todo 003 | Real mouse click (mousedown+mouseup, not `.click()`) on Zones/Syzygies/Currents/Gates row text selects the row, first failing on current code | e2e | `npx playwright test e2e/row-click-regression.spec.ts` using `page.mouse.down()`/`page.mouse.up()` at row-text coordinates, per the todo's own acceptance criteria | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the relevant quick-run unit test file (`npx vitest run <file>`) plus, for any task touching `Projection.tsx`/`NumogramClient.tsx`/panel components, `npx playwright test e2e/golden.spec.ts e2e/behaviour.spec.ts` to catch a base-10 regression immediately (these are the frozen oracles most at risk from this phase's generalization work, per the Summary).
- **Per wave merge:** `npm run test` (both timezones is only required by `verify`, a single-timezone run is sufficient mid-wave) plus the full new Phase 4 e2e spec set once each exists.
- **Phase gate:** `npm run verify` green (full suite, both timezones, 60 goldens, behaviour baseline, MIG-02 grep gate, smoke-bases) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `e2e/base-picker.spec.ts` — covers UI-01 (type/step/slide/chip, odd refusal, live summary correctness against `createNumogram`)
- [ ] `e2e/url-codec.spec.ts` — covers UI-02 (round-trip `?base=`, back-compat with `base` omitted, absurd-base refusal)
- [ ] `app/lib/customAlphabet.test.ts` + `e2e/label-scheme.spec.ts` — covers UI-03 (decimal/custom/xenotation modes, glyph-coverage validation, URL round-trip)
- [ ] `e2e/hover-pin.spec.ts` — covers UI-04 at a non-base-10 base
- [ ] `app/components/panels/RegionsPanel.test.tsx` + `e2e/region-legend.spec.ts` — covers UI-05 (N-row legend, isolate/mute independence and multi-select)
- [ ] `e2e/layers-zoom.spec.ts` — covers UI-06
- [ ] `e2e/accessibility.spec.ts` — covers UI-07 (keyboard traversal, ARIA, reduced-motion, text view + copy)
- [ ] A base-switch-sanitation unit test + `e2e/base-switch-reset.spec.ts` — covers UI-08
- [ ] A new MIG-02 grep-gate function inside `scripts/check-repo.mjs` (with a failing-input test, matching the project's existing `check-repo` convention of testing each gate against deliberately-bad input) + `e2e/smoke-bases.spec.ts` — covers MIG-02
- [ ] `e2e/row-click-regression.spec.ts` — covers todo 003, using real `page.mouse` events per its own acceptance criteria, first failing on current code
- [ ] No framework install needed — Vitest and Playwright are already configured; only new spec/test files are missing.

---

## Targeted Research Priorities (detailed findings)

### Priority 1: Zone-label scheme beyond base 36 — glyph coverage and curated presets

**Glyph-coverage detection approach [CITED: multiple 2026 sources, cross-verified]:**

This app ships **no webfont** — `app/globals.css` sets `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` everywhere (verified, both usages in the file are identical). This means glyph coverage for a user-typed custom alphabet is entirely a function of the **visitor's own OS/browser font substitution**, which cannot be inspected by parsing a font file (there is no shipped file to parse) [VERIFIED: no `@font-face`/`next/font` anywhere in `app/`].

The practical, browser-only heuristic (confirmed via WebSearch against SimpleLocalize's tofu explainer, CharacterCodes' rendering guide, and a GitHub issue discussing `opentype.js`-based coverage checks) is:
1. Render the candidate character to an off-screen `<canvas>` at a fixed font/size using the actual page font stack.
2. Render a Unicode Private-Use-Area codepoint (e.g. `U+F8FF` or `U+E000`, guaranteed by the Unicode standard to have no assigned meaning or standard glyph in any conformant font) at the same font/size, as a "known-missing" reference.
3. Compare `measureText().width` (fast pre-filter) and, if ambiguous, compare rendered pixel data (`getImageData`) between the two. If the candidate's rendering is pixel-identical (or width-identical, as a cheaper proxy) to the PUA reference's rendering, the candidate is very likely falling back to a generic ".notdef" box — flag it as "may not render" in the inline validation UI (D-12).
4. `document.fonts.check(font, text)` (Font Loading API) can be used as a **fast pre-filter** to confirm a font-family string is at least loaded/available, but it does not report per-glyph `cmap` coverage — do not rely on it alone; it answers "is this font loaded," not "does this font have this glyph" [CITED: cross-referenced across search results — this is a well-documented limitation of the Font Loading API].
This is a heuristic, not a guarantee (browsers/OSes commonly substitute a *different* installed font that DOES have the glyph, which is normal and not a failure) — phrase any UI copy accordingly (Assumption A2).

**Curated alphabet presets — concrete recommendation [ASSUMED, Claude's Discretion per D-10/CONTEXT.md]:**

Given the notable-base chip set needing full custom-label coverage tops out at 100 (1024 auto-falls-back to decimal per D-08), and given the "no themed/exotic Unicode block" constraint (no webfont shipped, plus the project's explicit scope exclusion of zodiac/tarot/occult correspondence packs — REQUIREMENTS.md Out-of-Scope table), propose:

| Preset name | Character set | Length | Base coverage | Font-coverage risk |
|---|---|---|---|---|
| Base62 | `0-9A-Za-z` (digits, uppercase, lowercase) | 62 | up to base 62 | Near-zero — pure ASCII, every font/OS renders this. |
| Base64 (URL-safe) | `0-9A-Za-z-_` (RFC 4648 URL/filename-safe alphabet) | 64 | up to base 64 exactly — matches the `64` notable-base chip | Near-zero — pure ASCII. |
| ASCII Printable | `!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~` (all 94 visible non-space ASCII codepoints) | 94 | up to base 94 | Near-zero — pure ASCII, though visually some symbols are easy to confuse (`l`/`1`/`I`, `O`/`0`) — worth a "confusable characters" warning in D-12's inline validation, separate from font coverage. |
| Latin-1 Printable | ASCII Printable + Latin-1 Supplement printable range (`U+00A1`-`U+00FF`, e.g. `¡¢£...ÿ`) | ~190 | comfortably covers the `100` chip and beyond | Low — Latin-1 Supplement is one of the most universally available Unicode blocks in any system font on any OS, but accented-letter legibility at small SVG label sizes should be sanity-checked visually (LAY-03's node/label scaling applies here too). |

Recommend shipping 2-3 of these (Base62, Base64-URL-safe, ASCII-Printable) as the initial curated set per D-10's "2-4 to start," with Latin-1 Printable as a natural 4th if the `100` chip's full custom-alphabet coverage is wanted without falling back to decimal.

### Priority 2: Unified URL codec — the three existing parsers, verified

Grep-verified (`app/`, no matches outside these three locations):

1. **`app/lib/shareParams.ts`'s `canonicalizeShareParams()`** — the only one with a real allow-list pattern (`SHARE_PARAM_KEYS`, `ALLOWED_LAYOUTS`/`ALLOWED_LAYERS`/`ALLOWED_REGIONS`, strict validation that `fail()`-throws on any unknown key or invalid value). **Confirmed dead at runtime**: its only real caller was `app/api/share-image/route.ts` (per `.planning/codebase/INTEGRATIONS.md`, a pre-refactor snapshot — "Canonicalizes params via `canonicalizeShareParams()`"), a Vercel serverless route this static-export project no longer has (FND-03). No file under `app/` imports it today.
2. **`NumogramClient.tsx`'s URL-hydration effect** (`useEffect` reading `new URLSearchParams(window.location.search)`, roughly lines 459-529) — runs once on mount, hand-parses each param independently with inline allow-lists (e.g. `layoutParam === 'original' || ... === 'planetary'`), silently ignores anything invalid (lenient, no user-visible error), and does NOT call into `shareParams.ts` at all.
3. **`NumogramClient.tsx`'s `buildShareParams()` + the `onShareExplanation()`/auto-URL-sync effect** (roughly lines 186-210 and 542-557, 907-941) — hand-builds a `URLSearchParams` from current component state for both (a) the auto-syncing address bar (`history.replaceState`) and (b) the explicit "Share" button's copied link, again without calling into `shareParams.ts`.

**Unified design recommendation:**
- Extend `shareParams.ts`'s existing allow-list pattern with new keys: `base` (numeral string, validated via `validateBase` after `Number()` — omit when the value is `10`, satisfying UI-02's back-compat requirement for free, since omitting a key is exactly what already happens for `layout=original` today), `labels` (label-scheme: `mode` + preset-id-or-custom-string, D-13), `region` (new multi-entry syntax, see Assumption A3: `region=torqueA:isolate,warp:mute`), and optionally `packer` (todo 005's shelf/spiral toggle, since the todo explicitly suggests "a candidate for URL state per the project's existing conventions").
- Delete `NumogramClient.tsx`'s duplicated inline hydration/build logic; route both directions through the extended `shareParams.ts` module. This finally makes the "canonical" codec the *actual* codec, resolving the current split-brain.
- Preserve the legacy `tc=1` convention exactly as today (union of Torque-cycle zones) for back-compat with existing shared links, but do not extend it — new region state uses the new `region=` syntax exclusively.

### Priority 3: MIG-02 — verified hard-coded 10-zone sites

Grep-verified against the requirement's own named patterns (`9 - z`, `[1, 2, 4, 5, 7, 8]`, `n <= 9`) plus related `<= 9`/`length: 10` sweeps. **Not** included below: `app/presets/base10/*` (these are the Phase 2/3 base-10 **preset** files, intentionally base-10-only by design — hard-coding 10 there is correct, not a violation) and `app/lib/planetary.ts`/`app/hooks/useOrbitalAnimation.ts` (drive the `planetary` layout, which Phase 3 D-05 confirms "stays a base-10-only preset, not generalized" — these are also correctly base-10-only, not violations, though the planner should confirm they're never reached for other bases).

**Real MIG-02 sites (must become base-parametric):**

| File | Pattern found | Fix direction |
|---|---|---|
| `app/NumogramClient.tsx` | `for (let z = 0; z <= 9; z++)` (×3, e.g. `zonesForRegion`), `[1, 2, 4, 5, 7, 8]` (Torque zone literal, ×2), `n <= 9` (selection-param bounds check), `9 - z` (partner computation), digit-key `/^[0-9]$/` keyboard shortcut | Replace `<= 9` loops with `g.zoneCount`; replace `[1,2,4,5,7,8]` with `g.torques.flatMap(t => Array.from(t.zones()))`; replace `9 - z` with `g.partner(z)`; bound selection parsing by `g.zoneCount`; gate the digit-key shortcut to `base === 10` (Pitfall 4). |
| `app/hooks/useTween.ts` | `for (let z = 0; z <= 9; z++)` (tween interpolation loop), hard-coded `P_ORIGINAL`/`P_LABYRINTH`/`P_LADDER` base-10 position records as the only tween sources, frame heights `940`/`880`/`870`/`800` as literals | Must be replaced or supplemented by a base-generic tween path built on `engine/layout/tween.ts`'s `lerpPositions` (already handles arbitrary base via `Float64Array`s sized to `base`) — this file is the clearest single "must become base-generic" target in the whole phase. |
| `app/lib/geometry.ts` | `9 - zone` (×2, in `syzMidBiased`/`syzTrianglePoints`) | These are generic-shaped functions (take `pos: Record<number, Pos>`) already reusable for any base — just need `partner: number` passed in instead of hard-coding `9 - zone` (i.e., add a parameter, call site passes `g.partner(zone)`). |
| `app/lib/xenotation.ts` | `xenotationByZone()`'s `for (let z = 0; z <= 9; z++)` | Needs a `zoneCount`/`base` parameter instead of the hard-coded `<= 9` loop. The core `xenotateNumber`/`factorInteger` functions are already base-agnostic (pure number theory) — only this one wrapper is base-10-hard-coded. |
| `app/lib/numogram.ts` | `plexExpr`'s decimal digit-sum (`String(current).split('')`) | Not a "10-zone" literal per se, but a decimal-arithmetic correctness bug per CLAUDE.md's core rule — see Pitfall 2. Must take `base` and use `digitsOf(value, base)`. |
| `app/components/panels/ZonesPanel.tsx` | `Array.from({ length: 10 }, ...)`, `total={10}` in `PanelCountToggleButton` | Replace `10` with the current base/zoneCount. |
| `app/components/info/InfoDisplay.tsx` | `` `${syz.a}+${syz.b}=9 (${syz.demon})` `` (literal `=9`) | Replace `9` with `base - 1` (the syzygy sum-to invariant is `a + b = base - 1`, not literally 9). |
| `app/components/projection/Projection.tsx` | `getCurrentDestZone`'s `Math.min(from, 9 - from)`, plus its direct imports of `SYZYGIES`/`CURRENTS`/`GATE_LIST`/`ALL_DEMONS`/`TC_EDGES`/`TC_CURRENTS`/`TC_SYZYGIES` from the base-10-only `app/data/*`/`app/lib/constants.ts` seams | `9 - from` → `g.partner(from)`. The data imports are the deeper issue: `Projection.tsx` must receive a `Numogram` (or a base-generic derived-data bundle) as a prop instead of importing fixed base-10 modules — this is the single largest generalization task in the phase (1061-line file). |

**CI grep gate:** No existing gate covers this (`scripts/check-repo.mjs` grepped for MIG-02-style patterns — none found). Recommend a new check in `scripts/check-repo.mjs` that greps `app/**/*.{ts,tsx}` (excluding `app/presets/base10/**`, which is intentionally base-10-only) for the patterns above, verified against real current code in this session — the requirement's own example patterns (`9 - z`, `[1, 2, 4, 5, 7, 8]`, `n <= 9`) all had real, findable matches as of this research, confirming they're the right patterns to gate on, not hypothetical examples.

**Smoke-render requirement:** "bases 2-40 smoke-render with no NaN or undefined" — Phase 3 already proved layout/routing math is NaN-safe for degenerate bases 2/4/6 through base 128+ (`engine/test/layout.degenerate.test.ts`, Phase 3 P06 notes). The remaining risk is entirely in the **app layer** (the files above), not the engine — a Phase 4 smoke test should render the live component tree (not just the engine) at each even base 2-40 and assert no `NaN`/`undefined` reaches the DOM.

### Priority 4: Region legend generalization

Confirmed via `engine/core/types.ts`: `Numogram.torques` is already **exactly** in D-24's required order ("canonical order: lengthInPairs descending, then smallest zone ascending... Torque cycles first"), and `Numogram.plex`/`Numogram.warp` are already separately exposed. No client-side sorting or re-derivation is needed — the region legend can map directly over `g.torques` (for the scrollable list of N rows, D-20) plus append `g.plex` and, if non-null, `g.warp` (D-23's uniform treatment).

**Recommended state shape** (extends today's single `hlRegion: Region | null` into per-region isolate/mute, D-19/D-22):
```typescript
type RegionId = `torque:${number}` | 'plex' | 'warp'   // torque:${cycle.torqueIndex}
type RegionState = Partial<Record<RegionId, { isolate: boolean; mute: boolean }>>
// D-22: any combination valid, independent per row — a plain sparse map, not a single "active region" scalar.
```
**Recommended component structure:** `RegionsPanel.tsx` maps `regionRows(g)` (Pattern 2) to two-action rows (a spotlight/isolate toggle + a hard-hide/mute toggle per row, D-19), reusing `HoverInfoList`'s existing `itemDisplay` inline-function-prop pattern (NOT `ItemDisplayComponent`, per Pitfall 1) to avoid reintroducing the remount bug in a brand-new panel.

### Priority 5: Todo 003 — see Common Pitfalls / Pitfall 1 (root cause fully confirmed above) and Priority 4's note on avoiding recurrence in the new region legend. Additional scope items from the todo, confirmed by code read:
- **Dead panel-collapse code, confirmed:** `NumogramClient.tsx` passes `open={layersOpen} onToggle={() => setLayersOpen(o => !o)}` etc. to every `<Panel>`, but `CyberPanel.tsx`'s `showPanelToggle = showToggle && canToggle` and `canToggle = isCollapsible = collapseDirection !== 'none'` — since `NumogramClient.tsx` never passes `collapseDirection` (defaults to `'none'`), `isCollapsible` is always `false`, so the `open`/`onToggle` props have **zero visual effect** regardless of state changes. This is exactly the todo's claim, now code-confirmed line-by-line. The planner's choice (delete vs. wire up for real) is unblocked by this confirmation — wiring it up for real is a one-line change (`collapseDirection="vertical"` or `"side"` on each `<Panel>`), which may also help the ~390px mobile-overlap finding (collapsed panels take less space).
- **~390px mobile overlap:** not independently re-measured this session (would require a live viewport test), but is plausible given seven always-open, non-collapsible panels plus the header stack in a `flex flex-col` — consistent with the todo's own description.

### Priority 6: Base-picker component design — header integration point

Confirmed: the existing header is `CyberPageHeader` (`app/components/ui/CyberPageHeader.tsx`), rendered once in `NumogramClient.tsx` (~line 1520) with an `actions` slot currently holding Undo/Redo/Share buttons. The **layout switcher** (original/labyrinth/ladder/planetary buttons) is a *separate*, differently-positioned element — a fixed-position `ButtonSet` at the top of the screen (~line 1352), NOT inside `CyberPageHeader`. D-03 says the base picker sits "in the header, alongside the existing layout switcher (undo/redo/share/layout)" — since undo/redo/share are in `CyberPageHeader`'s `actions` slot while the layout buttons are a visually-separate fixed `ButtonSet`, the planner should clarify/decide which of these two existing header-area elements the base picker visually joins (most likely: a new slot in `CyberPageHeader` itself, given D-02's "built into the picker control" language suggests a self-contained widget, not spread across the existing fixed-position button row). This is a concrete integration ambiguity worth flagging, not a blocker — `CyberPageHeader`'s `actions?: ReactNode` prop already accepts arbitrary content, so adding the base picker there is mechanically trivial either way.

### Priority 7: Big-base degradation — tier-table.json values (verified, live)

Read directly from `engine/scene/tier-table.json` (schemaVersion 1, status "measured", shippedProfile "sw-6x"):
- `boundaries.svgRichMaxN.n = 200` — this is the D-14 cutoff ("Above the measured SVG limit... currently svgRichMaxN: 200" in CONTEXT.md, confirmed matching the live file).
- `boundaries.svgLeanMaxN.n = 300` — the deferred (D-17) intermediate tier, not used by Phase 4.
- `boundaries.canvasMaxN = null` (no ceiling found to n=4000) — irrelevant to Phase 4 (D-17: only SVG-rich or summary/text-view, no Canvas tier yet — that's Phase 6/REN-02).
- `boundaries.layoutTweenMaxN.n = 28` — the Phase 3 D-09 tween-instant-switch cutoff, still relevant (Pattern 4).
- `boundaries.labelVisibleMinRadiusPx = 7` — Phase 3 D-07's label-visibility threshold, carries forward unchanged.
- `webglDecision.adopt = false` — confirmed, no WebGL work needed.
- `tierOverrideParam = { enabled: true, name: 'tier', values: ['svg','canvas','headless'] }` — the existing `?tier=` diagnostic override (D-18), already schema-validated by `engine/scene/tiers.ts`'s `parseTierOverride`.

**Recommendation:** import `TIER_TABLE` from `engine/scene/tierTable.ts` (the typed export over the committed JSON) and call `selectTier`/`tweenAllowed` directly — do not re-parse the JSON file or duplicate the boundary numbers anywhere in app code (D-16's explicit requirement).

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is included. This is a static, client-only, no-auth, no-backend application (CLAUDE.md); most ASVS categories that assume a server trust boundary do not apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts, no login, static export with no backend. |
| V3 Session Management | No | No sessions; all state lives in URL/component state, not cookies. |
| V4 Access Control | No | No privilege levels; every visitor sees the same static app. |
| V5 Input Validation | Yes | `validateBase`/`assertBase` (engine/core/base.ts) for the `base` field; the new unified URL codec (Priority 2) must validate every param it reads (base, layout, label-scheme, region ids, packer) against explicit allow-lists/ranges before using it, exactly as `shareParams.ts`'s existing pattern already does — never trust `window.location.search` directly into render state without validation (today's `NumogramClient.tsx` inline parser already does per-field allow-list checks, but inconsistently; the unified codec should make this uniform). Custom-alphabet user input (D-10/D-12) must be length-bounded (the engine's own `parseNumeral`/`formatNumeral` already cap numeral text at 64 characters / `MAX_MIN_DIGITS` — reuse that ceiling rather than accepting unbounded user text) before being stored in URL state or used to build labels. |
| V6 Cryptography | No | No cryptographic operations in this phase; the `share-image` route's SHA-256 signing (mentioned in `.planning/codebase/INTEGRATIONS.md`) belonged to the removed server route and is not relevant here. |

### Known Threat Patterns for this stack (client-only React/SVG, static export)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected content via URL params rendered into the page (custom-alphabet text, region ids) becoming an XSS vector | Tampering / Elevation of Privilege (DOM-based XSS) | React's default JSX text-content escaping already neutralizes this for any value rendered as `{value}` text (not `dangerouslySetInnerHTML`) — confirmed no `dangerouslySetInnerHTML` exists in the reviewed files. The one place raw string interpolation into SVG happens is `engine/scene/svgString.ts` (the dev-only/export emitter), which already has `escapeXml` applied at every free-text interpolation point (Phase 3, T-03-16) — the **live** React viewer (`Projection.tsx`) does not use that emitter (Architectural Responsibility Map) and relies on React's own escaping instead; keep it that way — do not introduce raw string SVG building into the live viewer. |
| Unbounded/huge `base` value causing excessive memory/CPU (denial of service against the visitor's own tab) | Denial of Service | Already mitigated: `MAX_BASE = 2^26` in `engine/core/base.ts` rejects anything larger with a typed `'too-large'` reason; D-14's practical SVG-rich cutoff (200) and the summary/text-view fallback (D-17) mean even a "large but valid" base like 1024 never attempts the expensive SVG render path. The `createNumogram` LRU cache (4 entries) also bounds memory from base-switching churn. |
| Malformed/hostile custom-alphabet strings (extremely long text, control characters, RTL/bidi override characters) breaking layout or enabling spoofing in labels | Spoofing / Denial of Service | Length-bound via the existing `MAX_MIN_DIGITS` (64 char) ceiling (V5 above); strip or reject non-printable/control/bidi-control codepoints during D-12's inline validation (this is a real, if minor, gap the glyph-coverage heuristic alone does not address — recommend an explicit character-class check, e.g. reject `\p{Cc}`/`\p{Cf}` Unicode categories, alongside the glyph-coverage check). |

## Sources

### Primary (HIGH confidence — direct code reads of this repository)
- `app/lib/shareParams.ts`, `app/NumogramClient.tsx`, `app/components/projection/Projection.tsx`, `app/components/panels/{shared,CyberPanel,ZonesPanel,SyzygiesPanel,CurrentsPanel,GatesPanel,LayersPanel,LabelsPanel,RegionsPanel,HoverInfoList,PanelGroup}.tsx`, `app/components/info/InfoDisplay.tsx`, `app/components/ui/{CyberPageHeader,CyberInput,Pill}.tsx`, `app/lib/{numogram,xenotation,geometry,planetary,constants}.ts`, `app/hooks/{useTween,useOrbitalAnimation}.ts`, `app/data/types.ts`, `engine/core/{types,base,numerals}.ts`, `engine/scene/{tiers.ts,tier-table.json}`, `engine/layout/{tween,registry,params}.ts`, `package.json`, `.planning/codebase/INTEGRATIONS.md`, `.planning/todos/pending/{003,005}-*.md`.
- `npm view next version`, `node -v`, `npm -v` — run in this session (2026-09-28).

### Secondary (MEDIUM confidence — WebSearch verified against multiple sources)
- Glyph/tofu detection: [Why Some Characters Don't Display in Your Browser or Font — CharacterCodes](https://www.charactercodes.net/blog/why-some-characters-dont-display-in-your-browser-or-font/), [The Tofu Symbol: When fonts get confused — SimpleLocalize](https://simplelocalize.io/blog/posts/tofu-symbol/), [Glyph and font compatibility pass — GitHub issue](https://github.com/derekwisong/datui/issues/325).
- SVG accessibility / roving tabindex: [SVG Accessibility API Mappings — W3C](https://www.w3.org/TR/svg-aam-1.0/), [SVG Accessibility API Mappings — W3C 2026 draft](https://www.w3.org/TR/2026/WD-svg-aam-1.0-20260302), [Keyboard Navigation Patterns for Complex Widgets — UXPin 2026](https://www.uxpin.com/studio/blog/keyboard-navigation-patterns-complex-widgets/), [Implementing Accessible SVG Elements — The A11Y Collective](https://www.a11y-collective.com/blog/svg-accessibility/), [Reliable and Valid SVG Accessibility — Fizz Studio](https://fizz.studio/blog/reliable-valid-svg-accessibility/).

### Tertiary (LOW confidence — not independently verified this session)
- Playwright Chromium's actual installed presence in the execution environment (documented as a prerequisite in CLAUDE.md; not run this session).
- Cross-browser/cross-OS behavior of the canvas glyph-coverage heuristic (reasoned from general Unicode/font-substitution principles and WebSearch sources, not empirically tested against a real browser matrix in this session).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every existing engine API cited was read directly from source in this repo.
- Architecture: HIGH for the generalization targets and bug root-causes (all verified by direct code reads across the full call chain); MEDIUM for the specific UX shapes proposed (region-id state, URL syntax) since CONTEXT.md leaves the exact shape to the planner.
- Pitfalls: HIGH for Pitfalls 1, 2, 4, 5 (each confirmed by reading the actual source, not inferred); MEDIUM for Pitfall 3 (reduced-motion gap is confirmed by reading `globals.css` and the tween hooks, but the recommended fix pattern is standard practice, not verified against this specific codebase's future implementation).

**Research date:** 2026-09-28
**Valid until:** 30 days for the app-layer findings (stable, tied to this repo's current commit); the glyph-detection/accessibility WebSearch findings are general web-platform knowledge and should remain valid well beyond 30 days, but re-check if Next.js or the target browser matrix changes.

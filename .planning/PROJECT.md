# CCRUG — Arbitrary-Base Numogram Generator

## What This Is

A static web app plus a typed engine library that generates CCRU-style **numograms for any even base** — base-2 up to however
high the measured processing ceiling allows (base-32, 64, 666, beyond) — instead of only the canonical base-10 one. Pick a base
and it derives the zones, syzygies, currents (major flows), gates (minor flows), the Plex/Warp/Torque regions and the demon set,
then draws the diagram as SVG and lets you name the demons. It is built on top of `github.com/lumpenspace/ccru`, an interactive
Next.js/SVG viewer of the base-10 numogram, whose hand-authored base-10 data becomes one preset of the new engine.

Audience: CCRU / numogrammatics researchers and hobbyists exploring "numograms as a class of objects, not a single diagram"
(the framing of the source guides), plus anyone who wants a poster-quality SVG of an arbitrary-base numogram.

## Core Value

For any even base n, derive the numogram **correctly** (base-10 must reproduce the canonical numogram exactly) and draw it legibly.
If the math is wrong or the diagram is unreadable, nothing else matters.

## Requirements

### Validated

<!-- Inferred from the existing lumpenspace/ccru codebase (see .planning/codebase/). -->

- ✓ Interactive base-10 numogram viewer: zones, syzygies, currents, gates, Plex/Warp/Torque regions — existing (`app/NumogramClient.tsx`, `app/components/projection/Projection.tsx`)
- ✓ Four hand-authored base-10 layouts (original, labyrinth, ladder, planetary) with animated switching — existing (`app/data/positions.ts`, `app/hooks/useTween.ts`)
- ✓ Layer toggles, hover/selection detail panels, undo/redo, URL-shareable state — existing (`app/components/panels/`, `app/lib/shareParams.ts`)
- ✓ Generic SVG geometry for gates/currents (concave Bezier gate paths, Y-shaped current routing) that works for any zone coordinates — existing (`app/lib/geometry.ts`)
- ✓ Xenotation (prime-factor notation) helper, base-agnostic — existing (`app/lib/xenotation.ts`)
- ✓ Cyber-styled UI primitives, share-image export (Vercel Blob dependent) — existing (`app/components/ui/`, `app/api/share-image/route.ts`)
- ✓ (Untouched by this project) Gematria cyphers page, Chrome gematria plugin, installable component library — existing

### Active

- [ ] **Engine**: pure, dependency-free, typed TS module that, for even base n >= 2, computes zones, syzygy pairs (hi::lo, sum n-1), currents, gates, regions (Plex / Warp / one-or-more Torque cycles), demons (net-span a::b, mesh number, chrono/amphi/xeno type and subtypes, Numodemons) — all arithmetic done in-base
- [ ] **Golden tests**: base-10 engine output equals the existing hand-authored data (`app/data/{syzygies,currents,gates,demons}.ts`); engine reproduces the source guide's facts (base-12 example, base-28 torques [9,3], base-82 [27,9,3], base-80 [39], warp exists iff n = 3o+1 with o odd, demon count T(n-1)); property tests over all even bases 2..N. No test framework exists today — add one.
- [ ] **Procedural layout** for arbitrary n (no hand-placed coordinates): deterministic, legible layouts that expose syzygy pairing and Torque cycles; base-10 keeps its authored layouts as a preset
- [ ] **Renderer generalization**: replace the 10-zone assumptions in Projection/NumogramClient with engine-driven rendering; tiered by size (rich interactive SVG for small bases, Canvas/LOD for large, headless SVG/JSON for huge), thresholds set by measurement
- [ ] **Base picker + generator UI**: choose an even base, see summary (zones, regions, torque cycle lengths, demon count), live diagram, URL-shareable `?base=`
- [ ] **Zone labelling for large bases**: in-base digits (0-9,a-z) up to base-36, a defined scheme beyond (decimal / glyph set), plus xenotation option
- [ ] **Demons layer**: all T(n-1) demons with net-span, mesh number and type (including an explicit cross-Torque chronodemon subtype); virtualized/on-demand so it never freezes the page at high base
- [ ] **Legibility and access**: region legend table with stable Torque ids and isolate/mute, syzygy-collapsed pair-graph view (each Torque cycle a clean ring), and a text view with keyboard traversal, ARIA and non-colour cues
- [ ] **Naming builder**: user assigns a sound/phoneme per zone (seeded auto-generator for any base; CCRU zone phonemes for base-10 preset), demon names derived from net-span sounds, editable, importable/exportable as JSON
- [ ] **Export**: self-contained SVG file, PNG, and engine-data JSON for the current numogram
- [ ] **Static/offline deployability**: decouple `@vercel/blob`, `@vercel/analytics`, and the `/api/share-image` route so the generator works as a static export with no server
- [ ] **Ceiling spike**: benchmark zones/paths/demons vs frame time and memory per renderer tier; document the measured thresholds and degrade gracefully past them (no arbitrary hard cap)

### Out of Scope

- Pitch (Ana/Cth), Decadence/Subdecadence card game, rites/omens, and other mythos layers — user decision ("don't bother with any mythos/card game stuff"); the guide itself says these are hand-tuned per base and rites blow up combinatorially at high bases
- Correspondence packs (planets, zodiac, tarot, I Ching) for arbitrary bases — deferred; the existing base-10 planetary layout/lore stays only as the base-10 preset and is not generalized
- Gematria plugin, cyphers page, installable component library — untouched, outside this project's scope
- Odd bases — no valid numogram (a self-paired zone, which the CCRU rejects); UI restricts to even bases and explains why
- Server-side persistence, accounts, analytics — static-first
- Rewriting git history to drop the 41 MB `demo.mov` — noted as debt, not addressed here

## Context

**Prior art / sources** (all local, gitignored, indexed in `reference/INDEX.md`):
- `reference/genius-guide-diy-numogram-demonology.txt` — the 3-part guide to generalizing the numogram and its demonology to any even base. The most direct spec.
- Ccru: Writings 1997-2003 (PDF + extracted text). Part-8 "Pandemonium" starts at PDF p.173; zones p.178-230; Pandemonium Matrix p.231-254; commentary p.255+; glossary p.326+. (User pointed at "p.241", which lands mid-Matrix at Mesh-18.)
- `reference/web/`: gramculator "DIY numogram" (calculate by hand; "all arithmetic in the base of the #-gram"), the archived /x/ thread (hand-built tables for bases 2-36, "pandemonic pyramid" to base 36, base-256 numogram lore), doomcrypt hub, gematria research blog.
- `reference/nonarian-numogram-*.svg` — earlier scratch renderings, visual reference only.

**Verified numogram math** (prototyped and checked; even base n, zones 0..n-1):
- Syzygy pairs {lo, n-1-lo}; current: pair hi::lo flows to zone hi-lo, equivalent to multiplying by 2 mod (n-1) up to sign. The pair->pair map is a **permutation**, so regions are exactly its cycles and are computable in O(n) (base 100,000 in ~30 ms).
- Plex = fixed pair {0, n-1}, always present. Warp = fixed pair {o, 2o}, exists iff n = 3o+1 with o odd (4, 10, 16, 22, 28, ...). Torque = every other cycle; there can be several (base 16 -> [4,2]; 28 -> [9,3]; 82 -> [27,9,3]).
- Gate (minor flow): zone k -> in-base digital root of T(k) = k(k+1)/2, i.e. T==0 ? 0 : ((T-1) mod (n-1)) + 1. Base-10 matches `app/data/gates.ts` exactly.
- Demons: all unordered zone pairs, T(n-1) = n(n-1)/2 (45, 66, 28, 1 for bases 10, 12, 8, 2). Mesh number of a::b = a(a-1)/2 + b.
- The math is not the ceiling. Demons are O(n^2) (base 666 = 221,445; base 1000 = 499,500) and rites are exponential; rendering and the demon layer are the real limits.

**Existing codebase** (mapped in `.planning/codebase/`): Next.js 14 + React 18 + TS + Tailwind viewer, 1,943-line `NumogramClient.tsx` coordinating state, `Projection.tsx` rendering, hand-authored base-10 constants in `app/data/`, zero tests, Vercel Blob/Analytics coupling, 41 MB `demo.mov` and committed `dist/`. See `.planning/codebase/CONCERNS.md` for the base-10 hard-coding inventory.

**Environment**: Windows 10, Node 22, npm 11. `origin` currently points at `lumpenspace/ccru` (repoint before pushing). Git author is configured as `csysp <(old identity email removed)>` on this machine.

## Constraints

- **Tech stack**: keep Next.js 14 / React 18 / TypeScript / Tailwind as the base — the request is to build off this repo; revisit only if the ceiling spike shows a renderer tier needs something else
- **Deployment**: must run as a static export with no server or network dependency — a generator should work offline and be hostable anywhere
- **Correctness**: all arithmetic in the numogram's own base; even bases only; base-10 output must equal the existing canonical data (golden tests gate every phase)
- **Performance**: no fixed cap; thresholds are measured, and every layer must degrade gracefully (virtualize demons, LOD, or fall back to headless export) rather than freeze the browser
- **Licensing**: `reference/` (copyrighted book text, scraped pages) stays gitignored; tracked docs cite file+page, never paste long passages
- **Compatibility**: base-10 URLs/share links from the existing viewer should keep working where practical

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Engine is a separate pure TS module with golden tests | Math is instant at any base; correctness is the core value and the repo has no tests | — Pending |
| Base-10 becomes a preset of the new engine | User choice; hand-authored data replaced by derived data proven equal by tests, hand layouts kept as base-10 preset | — Pending |
| v1 covers core diagram + demons + naming builder only | User choice: no mythos/card-game layers (pitch, Decadence, rites, correspondences) | ✓ Good |
| Ceiling is measured, not assumed; tiered renderers | User choice; math is O(n) but demons O(n^2) and SVG node count limit interactivity | — Pending |
| Static web app + engine lib as the deliverable | User choice; keeps engine usable from tests/CLI and the app hostable anywhere | — Pending |
| Even bases only | Odd bases force a self-paired zone, which the CCRU rejects (source guide, part 1) | ✓ Good |
| Keep Next.js base rather than rewriting | "Base repo to build off"; revisit after ceiling spike | — Pending |
| Zone labels beyond base-36 need a defined scheme | Digits 0-9,a-z run out; default is decimal with a separator, plus custom alphabet; integer stays the identity in URLs/JSON | — Pending |
| Explicit cross-Torque chronodemon subtype | User choice; in multi-Torque bases most chronodemons span different cycles (base 28: 108 of 378) and the guide names none of them; freezes the demon taxonomy in the engine phase | ✓ Good |
| Text view/a11y, region legend and pair-graph view are v1 | User choice; expensive to retrofit, and bases like 64 have 6+ Torque cycles that a flat legend cannot show | ✓ Good |
| Stay on Next 14.2.35, no upgrade phase | User choice; static export removes the server exposure that makes an unsupported Next major risky; revisit only if something forces it (tracked as UPG-01 in v2) | ✓ Good |
| Poster-quality SVG export deferred to v2 | User choice; plain SVG/PNG/JSON export is v1 | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-25 after requirements approval*

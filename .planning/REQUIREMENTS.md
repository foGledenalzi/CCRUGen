# Requirements: CCRUG — Arbitrary-Base Numogram Generator

**Defined:** 2026-09-25
**Core Value:** For any even base n, derive the numogram correctly (base-10 must reproduce the canonical numogram exactly) and draw it legibly.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundations

- [ ] **FND-01**: The project builds and type-checks on Windows and Linux with a single `npm run build` (no `zip` binary needed, ES2022 root target, LF line endings enforced via `.gitattributes`)
- [ ] **FND-02**: A frozen base-10 oracle (numeric golden JSON plus normalized SVG DOM goldens of the untouched viewer) exists before any refactor and stays green in every later phase
- [ ] **FND-03**: The app builds as a fully static export (`output: 'export'`) with no server route, Vercel Blob or Vercel Analytics dependency
- [ ] **FND-04**: `engine/` is enforced pure (no DOM or Node types, relative imports only) by `tsc -p engine` and ESLint restricted-imports, run via one `typecheck` script
- [ ] **FND-05**: Licensing and upstream attribution are decided, `origin` is repointed away from `lumpenspace/ccru`, and a guard fails if anything under `reference/` is ever tracked

### Engine

- [ ] **ENG-01**: For any even base n >= 2 the engine returns the zones, syzygy pairs (`hi::lo`, sum n-1), currents (pair -> `hi-lo`), and gates (zone k -> in-base digital root of T(k), with T(0) -> 0)
- [ ] **ENG-02**: Regions are Plex (always), Warp (iff n = 3o+1 with o odd), and one or more Torque cycles in a canonical order (length descending, then smallest zone id), each cycle reported in pairs and zones
- [ ] **ENG-03**: Demons are virtual: mesh number <-> net-span `a::b` in O(1), type classification with the guide's subtypes plus an explicit **cross-Torque chronodemon** subtype (cyclic = same-Torque only), closed-form counts per type, and Numodemons (n/2 - 1)
- [ ] **ENG-04**: Base-10 engine output equals the frozen oracle; the guide's verified facts hold (base 12 example, base 16 = [4,2], 28 = [9,3], 80 = [39], 82 = [27,9,3]); property sweeps pass for every even n up to 2000; odd or invalid bases are rejected
- [ ] **ENG-05**: Computing any base up to the safe ceiling (2^26) never materializes an O(n^2) structure

### Migration

- [ ] **MIG-01**: The base-10 viewer's syzygies, currents, gates, demons and regions are derived from the engine and joined with lore by id, with DOM goldens byte-identical to the pre-refactor viewer
- [ ] **MIG-02**: No hard-coded 10-zone constants remain (CI grep gate for `9 - z`, `[1, 2, 4, 5, 7, 8]`, `n <= 9`), and bases 2-40 smoke-render with no NaN or undefined

### Layout

- [ ] **LAY-01**: Any even base gets a deterministic procedural layout in which syzygy pairs are adjacent and each Torque cycle is drawn as a legible ring
- [ ] **LAY-02**: Base 10 keeps its four authored layouts (original, labyrinth, ladder, planetary) as presets
- [ ] **LAY-03**: Node size, fonts, strokes and loop sizes scale with n so the diagram stays legible across the supported range
- [ ] **LAY-04**: A syzygy-collapsed pair-graph view is available in which every Torque cycle is a clean ring

### UI

- [ ] **UI-01**: The user can choose an even base via a base picker (odd input is refused with an explanation), notable-base chips (2, 4, 6, 8, 10, 12, 16, 22, 28, 80, 82), and sees a live summary (zones, Warp yes/no, Torque cycle lengths, demon counts)
- [ ] **UI-02**: The chosen base is carried in the URL as `?base=`; existing base-10 share links keep working; absurdly large bases are refused with a message instead of freezing the tab
- [ ] **UI-03**: Zone labels are in-base digits up to base 36 and decimal with a separator beyond, with custom-alphabet and xenotation options; the integer stays the identity in URLs, JSON and demon keys
- [ ] **UI-04**: The user can hover or pin a zone, syzygy, current or gate to highlight it and read its detail panel
- [ ] **UI-05**: A region legend table lists Plex, Warp and each Torque cycle with a stable id, and lets the user isolate or mute a region
- [ ] **UI-06**: The user can toggle layers (syzygies, currents, gates, demons) and zoom, pan and fit the diagram
- [ ] **UI-07**: The diagram is usable without a mouse or colour vision: keyboard traversal, ARIA labelling, non-colour cues, reduced-motion support, and a text view of the numogram with copy
- [ ] **UI-08**: Changing base sanitizes selection, history and animations (no stale zones from the previous base)

### Demons

- [ ] **DEM-01**: The demons layer shows type facets with closed-form counts at any base, including cross-Torque sub-facets
- [ ] **DEM-02**: A virtualized demon browser supports sort, filter, and search by `a::b` or mesh number over C(n,2) rows without rendering them all
- [ ] **DEM-03**: Focus mode draws one zone's n-1 demons as chords, and a selected demon draws its own chord
- [ ] **DEM-04**: A triangular demon matrix with pick-by-pixel lets the user see and inspect every demon at large n
- [ ] **DEM-05**: Base 10 shows its 45 canonical CCRU demon names

### Rendering and Ceiling

- [ ] **REN-01**: A ceiling spike measures frame time and memory per render tier against n and yields a threshold table stored as data, not hard-coded
- [ ] **REN-02**: An SVG tier serves small bases and a Canvas tier serves large bases, selected from the threshold table, behind one shared view contract
- [ ] **REN-03**: Heavy computation runs in a Web Worker at large n so the UI never freezes; beyond the measured ceiling the app degrades to headless export with a visible message

### Naming

- [ ] **NAM-01**: The user can edit a per-zone sound table and can generate one for any base from a seed, with per-zone locks
- [ ] **NAM-02**: Demon names derive from net-span sounds (high-then-low by default, low-then-high as an option), with sparse per-demon overrides
- [ ] **NAM-03**: Naming data imports and exports as versioned JSON; the URL carries only a preset or seed; name collisions are reported to the user
- [ ] **NAM-04**: Base 10 ships a CCRU preset (the 10 zone phonemes plus the 45 canonical names)

### Export

- [ ] **EXP-01**: The user can export the current numogram as a self-contained SVG file
- [ ] **EXP-02**: The user can export the current numogram as a PNG, with size clamped to browser canvas limits
- [ ] **EXP-03**: The user can export the engine data (base, zones, pairs, currents, gates, regions) as JSON
- [ ] **EXP-04**: A CLI generates SVG or JSON for a given base headlessly

### Hardening

- [ ] **HRD-01**: Performance regression checks run against the spike table, an accessibility audit passes, a glossary states the guide-vs-thread region terminology choice, and CI runs build, tests and all `tsc` invocations on Windows and Linux

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Comparison and Discovery

- **CMP-01**: Two-base side-by-side comparison (summary table first; needs `NumogramClient` split into per-pane state)
- **CMP-02**: Base atlas overview of many bases at a glance

### Export

- **EXP-05**: Poster-quality SVG (outlined text from a glyph table, named layer groups, paper sizes and print theme)

### Exploration

- **FLW-01**: Single-path flow tracer and region-crossing flow classification
- **UPG-01**: Upgrade to a supported Next.js major (revisit only if Next 14 forces it)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Pitch (Ana/Cth), Decadence/Subdecadence cards, rites/omens, other mythos layers | User decision; the guide says they are hand-tuned per base and rites blow up combinatorially at high bases |
| Planet / zodiac / tarot / I Ching correspondence packs for arbitrary bases | Deferred by user; base-10 planetary layout and lore stay only as the base-10 preset |
| Gematria plugin, cyphers page, installable component library | Untouched and outside this project's scope |
| Odd bases | No valid numogram (a self-paired zone, which the CCRU rejects); UI explains why |
| Server-side share images, accounts, analytics, any backend | Static-first; per-share OG images cannot exist in a static export |
| Manual drag layout, editing derived data (pairs, currents, gates) | Anti-features: derived structure must always match the math |
| Drawing every demon as a chord at high base | Saturates into a solid blob; the matrix and focus modes replace it |
| Importing the /x/ thread's fictional base-256 lore | Fiction; only its structural tables are used as reference |
| Rewriting git history to drop the 41 MB `demo.mov` | Noted as debt, not addressed here |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 ⚠️

---
*Requirements defined: 2026-09-25*
*Last updated: 2026-09-25 after requirements approval*

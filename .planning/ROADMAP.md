# Roadmap: CCRUG - Arbitrary-Base Numogram Generator

## Overview

The journey runs from a repo that cannot build today to a static, offline-capable generator that derives and draws a correct CCRU numogram for any even base. Correctness gates everything, so the work starts by freezing the untouched base-10 viewer as an oracle and fixing the toolchain and static-export blockers (Phase 1), then builds the pure engine with golden tests and migrates the base-10 data onto it with zero visible change (Phase 2). Procedural layout and the ceiling spike follow, because legibility is half the core value and every renderer threshold is a measurement, not an assumption (Phase 3). The generator UI, the demons layer, the Canvas tier plus worker, the naming builder, and finally export, CLI and hardening then build on those proven foundations (Phases 4-8). Base 10 is a preset of the new engine throughout, and the base-10 goldens stay green in every phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundations and Safety Net** - Buildable static-export toolchain, frozen base-10 oracle, enforced engine boundary, licensing and repo hygiene
- [ ] **Phase 2: Engine Core and Base-10 Migration** - Pure tested engine for any even base, then the base-10 viewer re-derived from it with byte-identical output
- [ ] **Phase 3: Procedural Layout and Ceiling Spike** - Deterministic legible layouts for any base, base-10 presets, pair-graph view, and the measured renderer threshold table
- [ ] **Phase 4: Base Picker and Generator UI** - Interactive SVG viewer for any even base with URL state, labels, region legend, accessibility and text view
- [ ] **Phase 5: Demons Layer** - Facets, virtualized browser, focus chords, triangular matrix and canonical base-10 names for all C(n,2) demons
- [ ] **Phase 6: Canvas Tier and Worker** - Canvas rendering for large bases, worker-offloaded computation and graceful degradation past the measured ceiling
- [ ] **Phase 7: Naming Builder** - Per-zone sound table, seeded generator, derived demon names, JSON import/export and the CCRU base-10 preset
- [ ] **Phase 8: Export, CLI and Hardening** - SVG/PNG/JSON export, headless CLI, performance and accessibility checks, cross-platform CI and glossary

## Phase Details

### Phase 1: Foundations and Safety Net
**Goal**: The project builds, type-checks and exports as a static site on this machine, and the untouched base-10 viewer's behavior is frozen as an oracle before anything is refactored
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05
**Success Criteria** (what must be TRUE):
  1. `npm run build` succeeds on Windows with no `zip` binary installed, leaves no tracked file modified, and emits a fully static `out/` site; LF endings are enforced by `.gitattributes`, and a CI workflow file runs the same build and `typecheck` commands on Windows and Ubuntu
  2. The exported site serves the base-10 viewer offline with no request to Vercel Blob or Vercel Analytics and no server route, and old `/?...` and `/numogram/?...` share links still land on the numogram
  3. A numeric `base10.golden.json` (covering all four layouts, planetary numerically) and normalized-SVG DOM goldens of the three non-planetary layouts (original, labyrinth, ladder) x 10 states, captured from the untouched viewer, pass against the static build and give identical results on repeated runs under two different `TZ` values
  4. `npm run typecheck` runs every `tsc` invocation plus the engine lint rules, and deliberately adding a DOM/Node type or a non-relative import inside `engine/` makes it fail
  5. A guard fails if any file under `reference/` is tracked, `origin` no longer points at `lumpenspace/ccru`, and the licensing and upstream-attribution decision is recorded in the repo
**Plans**: 8 plans in 5 waves

Plans:
- [x] 01-01-PLAN.md - Toolchain: .gitattributes, exact npm pins + lockfile, ES2022 target, engine scaffold, Vitest with TZ canary, golden-manifest freeze tool (wave 1)
- [x] 01-02-PLAN.md - Engine boundary: ESLint override + guard test proving tsc/ESLint reject DOM/Node types and non-relative imports (wave 2)
- [x] 01-03-PLAN.md - Numeric base-10 oracle from untouched app/data, frozen, with Gt-15/Gt-03 and definition-derived regressions (wave 2)
- [x] 01-04-PLAN.md - DOM oracle: 30 visual-DOM goldens (3 layouts x 10 states) captured from the untouched viewer on next dev, frozen (wave 2)
- [x] 01-05-PLAN.md - Static export change list, client redirect, @vercel removal; goldens proven 60/60 on serve out, root and /ccrug e2e (wave 3)
- [x] 01-06-PLAN.md - Page-weight baseline + budget, dormant Windows/Ubuntu CI calling npm run verify, deterministic fflate plugin ZIP (wave 4)
- [ ] 01-07-PLAN.md - LICENSE (MIT), NOTICE (upstream credit, lore exclusion), lore headers, CCRUG README, npm launch config (wave 4)
- [ ] 01-08-PLAN.md - check-repo guard, user-approved git mutations (untrack dist/demo.mov, origin -> upstream + new origin foGledenalzi/CCRUGen (no push)), full verify gate, licensing confirmation (wave 5)
**Research**: Standard (skip `/gsd-research-phase`), but verify empirically in the first export build: root `target: ES2022` vs class-field diagnostics, `redirect()` in `app/gematria/saved`, `sitemap.ts`/`robots.ts` under `force-static`, `searchParams` pages, `engine/package.json` without `type: module`, Vite 8 with Vitest 5 (fallback Vite 7.3.6), `process.env.TZ` behavior on Windows, fflate zip byte-identity across `TZ`, `npm ls next` resolving to 14.2.35.
**Notes**: Hard sequencing inside the phase: `.gitattributes` lands before the first fixture; the numeric oracle and DOM goldens are captured from the untouched viewer (against `next dev`) before static-export decoupling and before any edit to `NumogramClient.tsx`; only then is the Playwright web server switched to `serve out`. Next.js stays pinned at 14.2.35 (UPG-01 is v2).

### Phase 2: Engine Core and Base-10 Migration
**Goal**: For any even base the correct numogram is derived by a pure, tested engine, and the base-10 viewer runs on that engine with no visible change
**Depends on**: Phase 1
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, MIG-01
**Success Criteria** (what must be TRUE):
  1. The engine's base-10 output equals the frozen oracle: 10 zones, 5 syzygy pairs, currents, gates (including the named Gt-15 = 5->6 and Gt-03 = 2->3 regressions), regions, and 45 demons split 12 cyclic + 3 syzygetic chrono, 12 Plex + 12 Warp amphi, 4 chaotic + 2 syzygetic xeno
  2. The guide's verified facts hold: the base-12 example, Torque cycles [4,2] at base 16, [9,3] at 28, [39] at 80 and [27,9,3] at 82, and Warp present exactly when n = 3o+1 with o odd; a sweep over every even n up to 2000 passes; odd, zero, negative and non-integer bases are rejected with an error
  3. Base 28 reports 378 demons of which 108 are cross-Torque chronodemons; any demon converts between mesh number and net-span `a::b` and back in O(1); per-type counts always sum to C(n,2); Numodemons number n/2 - 1
  4. Base 2^26 computes its zones, pairs and cycles without materializing any O(n^2) structure, and bases beyond the safe ceiling are refused
  5. The base-10 viewer's syzygies, currents, gates, demons and regions come from the engine joined with lore by id, and the DOM goldens are byte-identical, with layouts, hover, undo and share links behaving exactly as before
**Plans**: TBD
**Research**: Standard (math verified in research; strangler migration guarded by the frozen oracle).
**Notes**: Sequencing: engine core with golden tests is complete before any base-10 data source is swapped; gate/current routing is extracted verbatim first, generalized later. Decisions frozen here because retrofitting is expensive: cross-Torque chronodemon subtype (ENG-03, decided; cyclic = same-Torque only), Gate 0->0 draw/omit policy (engine emits n gates, renderer decides once), Torque canonical order (length descending, then smallest zone id; rotate each cycle to its smallest pair), Torque identity is a numeric index with letters as display up to 26 then numbers, units always stated as pairs vs zones, mesh-number display base. Regions are modeled as `Cycle[]`, never "one Torque". Fixtures are derived from definitions, never from `reference/` and never with `vitest -u`; the guide's errors (47-vs-45 subtype sum, "only 3^N+1 bases have several Torques") are not inherited.

### Phase 3: Procedural Layout and Ceiling Spike
**Goal**: Any even base gets a deterministic, legible layout, base 10 keeps its authored layouts as presets, and the renderer thresholds are measured and stored as data
**Depends on**: Phase 2
**Requirements**: LAY-01, LAY-02, LAY-03, LAY-04, REN-01
**Success Criteria** (what must be TRUE):
  1. For every even base from 2 to 100 the layout is deterministic (same base gives identical coordinates), every syzygy pair is adjacent and every Torque cycle is a legible ring; base 28 shows two Torque rings of 9 and 3 pairs
  2. Base 10 still offers its four authored layouts (original, labyrinth, ladder, planetary) as presets that match the Phase 2 goldens, while every other base falls back to a procedural layout
  3. On a generated review sheet for bases 2, 4, 6, 8, 12, 16, 28, 64, 82 and 100, nodes, labels, strokes and loops scale with n so nothing overlaps or clips, and the user signs off on the result
  4. A syzygy-collapsed pair-graph view exists in which every Torque cycle is a clean ring, including base 64's six or more cycles
  5. A threshold table stored as data (not hard-coded) records measured frame time and memory per render tier against n, the all-chords density limit, and explicit yes/no decisions on the WebGL contingency and on a `tier=` override
**Plans**: TBD
**UI hint**: yes
**Research**: YES, run `/gsd-research-phase`. Layout legibility at 10-60 cycles (multi-ring vs spiral vs Fermat-spiral glyph packing), label collision, Y-junction routing, edge bundling for gates at n >= 100; the spike itself is measurement on real hardware (Safari canvas-area probe if a device is available), not literature.
**Notes**: Layout plans come first; spike plans come last because the harness needs real routes. The spike table is the exit gate for Phases 4, 5 and 6 (SVG-tier limit, matrix resolution, Canvas/worker scope); ship the conservative research placeholders in the tier table until measurements replace them. A dev-only review harness (scene-to-SVG string emitter plus a minimal tsx script) is built here so layouts can be judged before the UI exists; it is promoted to the deliverables EXP-01 and EXP-04 in Phase 8. User taste is needed on flow direction (anticlockwise per existing lore) and Plex placement (center vs bottom).

### Phase 4: Base Picker and Generator UI
**Goal**: Users can pick any even base and explore its numogram in the interactive SVG viewer, with legible labels, a region legend, shareable URLs and full keyboard and screen-reader access
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, MIG-02
**Success Criteria** (what must be TRUE):
  1. The user picks a base by typing, stepping, sliding or clicking a notable-base chip (2, 4, 6, 8, 10, 12, 16, 22, 28, 80, 82); odd input is refused with an explanation; picking 28 shows 28 zones, Warp present, Torque cycles [9,3] and 378 demons; every even base from 2 to 40 renders with no NaN or undefined and a CI grep gate finds no hard-coded 10-zone constants
  2. `?base=28` reloads to the same view, existing base-10 share links keep working, an absurdly large base is refused with a message instead of freezing the tab, and switching base leaves no stale selection, undo history or animation from the previous base
  3. Zone labels are in-base digits up to base 36 and decimal with a separator beyond, with custom-alphabet and xenotation options, while URLs, JSON and demon keys keep the integer identity
  4. Hovering or pinning a zone, syzygy, current or gate highlights it and opens its detail panel; a region legend table lists Plex, Warp and each Torque cycle with a stable id and lets the user isolate or mute a region; layers toggle and the diagram zooms, pans and fits
  5. The diagram is usable without a mouse or colour vision: keyboard traversal, ARIA labelling, non-colour cues, reduced-motion support, and a text view of the numogram with a copy button
**Plans**: TBD
**UI hint**: yes
**Research**: Targeted, run `/gsd-research-phase` for the label scheme beyond base 36 (decision plus font/glyph coverage tests). The URL codec is standard.
**Notes**: `base` becomes a required argument everywhere so unmigrated call sites fail to compile; a single URL codec replaces the three existing parsers (omit `base` when 10, strict even-integer validation, layout validated against base, legacy-URL fixture corpus, `tc=1` maps to the union of Torque zones). Bases above the SVG tier's measured limit show the summary and text view plus a visible message until the Canvas tier arrives in Phase 6. Settle once here: label separator, `region=` URL syntax, `digits` scheme values, Torque letter/number display. Text view, region legend and pair-graph toggle are confirmed v1 scope.

### Phase 5: Demons Layer
**Goal**: Users can see, count, browse and inspect every demon of any base without the page freezing
**Depends on**: Phase 3 (threshold table), Phase 4
**Requirements**: DEM-01, DEM-02, DEM-03, DEM-04, DEM-05
**Success Criteria** (what must be TRUE):
  1. Picking base 28 shows demon type facets with closed-form counts including the cross-Torque sub-facet (108 of 378), and base 666 shows its 221,445-demon facets instantly
  2. At base 666 the demon browser scrolls smoothly over 221,445 rows while the DOM holds only the visible ones, and sort, filter, and search by `a::b` or mesh number all work
  3. Choosing a zone in focus mode draws its n-1 demons as chords, and selecting a demon draws its own chord
  4. The triangular demon matrix shows every demon at large n, and clicking or hovering a cell identifies its `a::b`, mesh number and type
  5. Base 10 shows its 45 canonical CCRU demon names in the browser and detail panel
**Plans**: TBD
**UI hint**: yes
**Research**: YES, run `/gsd-research-phase` for the demon matrix LOD and tiling at n >= ~4k (viewport-resolution raster with dominant-subtype binning).
**Notes**: Never one DOM or canvas primitive per demon; all-chords "web" mode is offered only below the spike's density limit, with opacity scaled to edge density. At base 666, 99.4% of demons are chronodemons, so a type filter alone does not make the set browsable; hence focus mode, matrix and search. The virtualized browser uses TanStack Virtual over `at(mesh)`; name-based search only when the count is at most ~50k. Compute here runs inline; worker offload for very large n lands in Phase 6.

### Phase 6: Canvas Tier and Worker
**Goal**: Large bases stay interactive because the Canvas tier takes over from SVG where the measured thresholds say so, heavy work runs off the main thread, and the app degrades gracefully past the ceiling
**Depends on**: Phase 5 (hard prerequisites are the Phase 3 threshold table and the Phase 4 view contract)
**Requirements**: REN-02, REN-03
**Success Criteria** (what must be TRUE):
  1. At a base above the SVG threshold from the spike table, the diagram renders in the Canvas tier with the same features as the SVG tier (zones, syzygies, currents, gates, regions, hover, pin, legend, isolate), and the tier is chosen automatically from the threshold table
  2. Hovering and clicking at a large base picks the correct zone or edge, and labels appear or hide by level of detail as the user zooms
  3. Switching to a large base keeps the page responsive because computation runs in a Web Worker, and rapid base changes never show a stale result
  4. Beyond the measured ceiling the app shows a visible message and offers headless export instead of freezing
  5. The exported static site, with and without a `basePath`, computes base 28 through the worker offline
**Plans**: TBD
**UI hint**: yes
**Research**: YES, run `/gsd-research-phase` for Canvas picking (uniform-grid zone picking, id-buffer edge picking) and for worker bundling under Next 14 webpack in an export build (`trailingSlash`, `basePath`, same-origin worker).
**Notes**: Both tiers sit behind one `NumogramViewProps` contract selected from the data table, not from hard-coded numbers. A WebGL (PixiJS 8) tier is built only if the Phase 3 spike said yes. This phase is independent of Phase 7 and the two may run in either order or in parallel.

### Phase 7: Naming Builder
**Goal**: Users can name the zones of any base and get derived demon names, edit and share them, and load the canonical CCRU names for base 10
**Depends on**: Phase 5 (demon browser to display names); the pure naming module needs only Phase 2 and its plans may start early
**Requirements**: NAM-01, NAM-02, NAM-03, NAM-04
**Success Criteria** (what must be TRUE):
  1. The user edits a per-zone sound table or generates one for any base from a seed; the same seed always gives the same table, and locked zones survive regeneration
  2. Demon names derive from net-span sounds, high-then-low by default with low-then-high as an option, and the user can override individual demon names without affecting the rest
  3. Naming data exports and imports as versioned JSON, a file for the wrong base is rejected with a message, the URL carries only a preset or seed, and name collisions are listed visibly
  4. Base 10 offers a CCRU preset that supplies the 10 zone phonemes and the 45 canonical demon names
**Plans**: TBD
**UI hint**: yes
**Research**: YES, run `/gsd-research-phase` for the naming generator: euphony rules, phoneme-bank sizing, prefix-free or separator-aware inventory, and generator quality (little prior art).
**Notes**: PRNG is `sfc32-cyrb128@1` with frozen test vectors; the seeded generator uses Feistel plus cycle-walking as a proposal to validate (fallback seeded Fisher-Yates). Zone-sound distinctness does not imply demon-name distinctness (concatenation is not injective), hence the collision report. Override keys are decimal `"a:b"`; verify against `app/data/demons.ts`. The CCRU preset uses the 45 names as overrides, not derivations. Validator is hand-written, rejects wrong base and caps size; text handling is NFC-normalized and grapheme-safe.

### Phase 8: Export, CLI and Hardening
**Goal**: Users can take a numogram out of the app as SVG, PNG or JSON or generate it headlessly, and the whole project is verified for performance, accessibility and cross-platform builds
**Depends on**: Phase 6, Phase 7
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, HRD-01
**Success Criteria** (what must be TRUE):
  1. The user downloads the current numogram as a self-contained SVG file that opens standalone in a browser with the same look, with no scripts or external references
  2. The user downloads a PNG, and an oversized request is clamped to browser canvas limits with a message instead of producing a blank image
  3. The user downloads the engine data (base, zones, pairs, currents, gates, regions) as JSON
  4. Running the CLI with a base and a format (for example `--base 28 --format svg`) writes an SVG or JSON file headlessly with no browser
  5. CI runs build, tests and every `tsc` invocation on Windows and Linux; performance regression checks run against the spike table; the accessibility audit passes; and a glossary states the guide-vs-thread region terminology choice
**Plans**: TBD
**Research**: YES, run `/gsd-research-phase` for the cross-browser PNG matrix including Safari canvas-area limits and SVG-as-image font behavior. Poster-quality export and its glyph-table/opentype.js research are v2 (EXP-05) and out of scope here.
**Notes**: SVG comes from the scene model via a string builder, never DOM capture (literal attributes, rounded coordinates, XML escaping, named layer groups, explicit width/height/viewBox); the Phase 3 dev harness is promoted to the CLI. The Vercel share-image flow is replaced by copy-URL plus PNG download. Hosting checklist covers `basePath`, `.nojekyll`, `withBasePath()`. Accessibility audit targets WCAG 1.4.1, 1.4.11, 2.1.1 and 4.1.2; the release checklist includes `git ls-files reference` = 0 and a Node 20/22 determinism run.

## Ordering Constraints

These come from the research and are hard rules for planning and execution:

1. The base-10 oracle and the static-export/toolchain fixes (Phase 1) precede any edit to `NumogramClient.tsx`.
2. Engine core with golden tests precedes the strangler migration of base-10 data (both in Phase 2, in that order).
3. Procedural layout precedes the ceiling spike, because the spike needs real routes (both in Phase 3, in that order).
4. The ceiling spike precedes committing to the Canvas tier and worker (Phase 3 before Phase 6).
5. The demons layer follows the spike (Phase 5 after Phase 3).
6. The naming module is pure and depends only on the engine; its UI needs Phases 4 and 5.

## Deferred to v2

CMP-01 and CMP-02 (two-base comparison, base atlas), EXP-05 (poster-quality SVG), FLW-01 (flow tracer), UPG-01 (Next.js major upgrade, revisit only if Next 14 forces it). The optional Next 16 upgrade phase from the research is dropped.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 (Phases 6 and 7 are independent and may run in parallel)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations and Safety Net | 6/8 | In Progress | - |
| 2. Engine Core and Base-10 Migration | 0/TBD | Not started | - |
| 3. Procedural Layout and Ceiling Spike | 0/TBD | Not started | - |
| 4. Base Picker and Generator UI | 0/TBD | Not started | - |
| 5. Demons Layer | 0/TBD | Not started | - |
| 6. Canvas Tier and Worker | 0/TBD | Not started | - |
| 7. Naming Builder | 0/TBD | Not started | - |
| 8. Export, CLI and Hardening | 0/TBD | Not started | - |

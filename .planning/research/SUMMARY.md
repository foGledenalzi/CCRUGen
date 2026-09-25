# Project Research Summary

**Project:** CCRUG - Arbitrary-Base Numogram Generator
**Domain:** Pure-TS math engine + procedural layout + tiered renderers, added to an existing base-10 Next.js 14 numogram viewer and shipped as a static export
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH (math and toolchain findings HIGH; renderer-tier thresholds LOW by design, the ceiling spike must measure them)

Detail lives in `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (same folder). This file synthesizes them, surfaces where they disagree, and turns them into phase guidance.

## Executive Summary

This is a brownfield generator: given any even base n, derive a CCRU numogram (zones, syzygy pairs, currents, gates, Plex/Warp/Torque regions, demons), draw it legibly, and let the user name the demons and export the result. The math is not the hard part. The pair->pair current map is a permutation, so regions are its cycles and everything except demons is O(n) (about 30 ms at n = 100,000). Demons are O(n^2) (221,445 at base 666; 499,500 at 1000) and are the real ceiling, so they must stay virtual (index math, never materialized). The proven way to build this class of tool (Watabou/Azgaar-style seeded generators, large graph viewers) is a pure deterministic core, cached/LOD renderers chosen by measured size tiers, heavy work off the main thread, and sharing via URL/JSON with no server. Nothing comparable exists: gramculator prints three text lists, and every other web numogram is base-10 only, so the risk is table-stakes breadth, not competition.

Recommended approach: a strangler migration behind a frozen oracle. Freeze the untouched base-10 viewer's outputs first (numeric golden JSON plus normalized-SVG DOM goldens), build the engine in a lint- and tsc-enforced `engine/` folder (relative imports, no DOM/Node types), swap the base-10 data sources behind unchanged component props, then generalize layout, UI, demons, Canvas/worker tiers, naming, and export. Stack: stay on Next 14.2.35 (exact pin) for v1, TypeScript 5.9.3, ESLint 8.57.1, Vitest 5.0.2 + fast-check + Playwright (Chromium, text goldens), hand-rolled layout / PRNG (sfc32) / Canvas2D (no WebGL in v1), fflate for the plugin zip. v1 scope is fixed by the user (PROJECT.md): core diagram + demons + naming builder + export; no pitch/Decadence/rites/correspondences; measured ceiling (no arbitrary cap); static app plus engine library; base-10 is a preset.

Key risks and mitigations: (1) The source guide is wrong in places (demon subtype counts sum to 47, not 45; the "only 3^N+1 bases have several Torques" claim is false) and multi-Torque is the norm (about 110 of 150 even bases up to 300), so fixtures must be derived from definitions, and regions modeled as `Cycle[]`, never "one Torque". (2) The repo does not build on this machine today (es5 target, missing `zip`, CRLF without `.gitattributes`, yarn/npm split) and static export conflicts with the POST share route, `searchParams` pages and `redirect()`; fix in the first phase. (3) A 1,943-line zero-test client plus base-10 literals TypeScript cannot flag (`9 - z`, `[1,2,4,5,7,8]`, `n <= 9`) demand a golden master before any edit. (4) Rendering thresholds are unmeasured and the demon layer is 99.4% chronodemons at base 666, so a spike must precede Canvas/worker commitments.

## Key Findings

### Recommended Stack (STACK.md)

Everything is pinned from npm registry data of 2026-09-25. Direction is MEDIUM-HIGH; render-tier thresholds are LOW.

**Core technologies:**
- Next.js 14.2.35 (exact pin, `output: 'export'` unconditional, `trailingSlash: true`): project constraint; static export removes the server-side exposure that makes "Unsupported" matter. Next 15 is a dead end (Maintenance LTS ends 2026-10-21); Next 16 is an optional late phase, not v1.
- TypeScript 5.9.3 (not 7.x: no stable JS API until 7.1, breaks Next's type-check and typescript-eslint) and ESLint 8.57.1 (forced by `eslint-config-next@14`).
- Vitest 5.0.2 (node env, `test.projects`, explicit imports) + Vite 8.3.1 (test-time only; fallback 7.3.6) + fast-check 4.10.2 (large-domain properties only; exhaustive even-n sweeps are plain loops) + @playwright/test 1.63.0 (Chromium only, normalized `svg.outerHTML` text goldens, `page.clock.setFixedTime`, `TZ=UTC`). `@types/node` must move ^20 -> ^22.
- Rendering: React SVG (T1, existing) -> hand-rolled Canvas2D (T2: cached layers, `Path2D`, grid + id-buffer picking, LOD) -> headless string SVG/JSON (T3). Demon matrix = one `ImageData` raster at viewport resolution. No WebGL/PixiJS in v1; PixiJS 8.21.0 is the named contingency if the spike demands it.
- Layout hand-rolled in `engine/layout` (ring / spiral / ladder / diameters + Fermat-spiral glyph packing); d3-force deferred.
- Export: SVG from the model via string builder (never DOM capture); PNG via native `Image` -> `canvas.toBlob` with size clamping (default 4096^2 area); poster text as outlined paths from a build-time glyph table (opentype.js dev-only); `@resvg/resvg-wasm` deferred behind one `rasterizeSvg()` interface.
- Worker: `new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' })` under Next 14 webpack; hand-rolled protocol, transferables, no Comlink, no OffscreenCanvas in v1.
- PRNG: hand-rolled sfc32 + cyrb128 (pinned id `sfc32-cyrb128@1`, frozen test vectors copied from bryc's public-domain reference). Zip: fflate `zipSync` with fixed mtime. Tooling: tsx (CLI), cross-env, serve, TanStack Virtual (demon browser only).

### Expected Features (FEATURES.md)

**Must have (table stakes):**
- Even-only base picker with instant summary (zones, pairs, Warp yes/no, Torque cycle lengths, demon counts) and notable-base presets (2, 4, 6, 8, 10, 12, 16, 22, 28, 80, 82).
- Live diagram: zones, syzygies, currents, gates, Plex/Warp/Torque colouring, layers, zoom/pan/fit; base-10 keeps its four authored layouts as a preset.
- In-base labels to base 36; a defined scheme beyond (decimal with separator, custom alphabet, xenotation). Integer is identity (decimal in URLs/JSON); labels are display only.
- Hover/pin highlight (one delegated pointer handler), detail panel, region legend as a table with stable Torque ids and isolate, text view with copy, keyboard traversal + ARIA + non-colour cues + reduced-motion.
- Demon facets (closed-form counts), virtualized demon list with search by `a::b`/mesh, selected-demon chord; naming builder (sounds table, seeded generator with locks, join order, overrides, JSON import/export); SVG/PNG/JSON export; permalink with `?base=` (old base-10 URLs unchanged); static/offline build.

**Should have (competitive):**
- Syzygy-collapsed pair-graph view (only view legible at 6+ cycles; likely default at large n); demon triangular matrix (Canvas/ImageData, O(1) picking); seeded lockable euphony-smoothed name generator; custom-alphabet presets; poster-quality export; canonical name inheritance by net-span; provenance badges.

**Defer (v1.x / v2+):**
- v1.x: two-base compare (summary table first), base atlas, poster extras (paper sizes, print theme, PDF via print stylesheet), region-crossing flow classification, bundle export.
- v2+: single-path flow tracer, odd bases (different structure). Out of scope by user decision: pitch, Decadence/Subdecadence, rites/omens, planet/zodiac/tarot correspondences, any mythos or card layer; also no server share image, no manual zone dragging, no editing of derived data.

Note: text view, keyboard/ARIA, region legend and pair-graph view are FEATURES.md recommendations that go beyond PROJECT.md's Active list; the roadmapper should confirm them as v1.

### Architecture Approach (ARCHITECTURE.md)

Eager O(n) core, virtual O(n^2) periphery. `engine/` is a pure, dependency-free folder (relative imports, `lib: ES2022`, `types: []`) consumed one-way by `app/`, the worker, tests and a tsx CLI; a workspace is deferred until something is published. Base-10 hand art, lore, CCRU phonemes and the 45 names move to `app/presets/base10` and plug in through the same `LayoutSpec`/lore/naming interfaces, which makes "base 10 is a preset" literally true. One `NumogramViewProps` contract has three interchangeable tiers, selected by a data table (`engine/scene/tiers.ts`) filled by the spike. Render data is keyed by numeric ids (`cycle.kind`, pair id, zone), never by lore names.

**Major components:**
1. `engine/core` - base, digits, pairs, cycles/regions (`Cycle[]`), currents, gates, lazy `DemonSpace` (mesh <-> a::b, type classifier, closed-form counts, unranking), label identity/display.
2. `engine/layout` - layout registry, ring/spiral/ladder/diameters, cycle-glyph packing, pure routing (`buildRoutes` with explicit `orientationCache`), bounds.
3. `engine/scene` - SVG string emitter, demon-matrix raster, LOD + tier table. `engine/naming` - SoundMap schema, seeded generator, euphony, derive names (sparse overrides). `engine/cli` - tsx entry.
4. `app/model` (`useNumogramModel`, inline vs worker, stale-reply drop), `app/render/*` (SVG rich view, Canvas view), `app/lib/urlState.ts` (single URL codec replacing three parsers), `app/presets/base10`, `workers/engine.worker.ts`.
5. `NumogramClient` shrinks by strangler extraction (url state, model, selection, history) to interaction state only.

Verified facts that drive the design: a current always lands on the odd zone of the next pair, so a Torque cycle is an alternating syzygy/current `2L`-gon (the ring layout follows by construction); cycle counts are large at big n (n=1024: 54, n=4096: 178), so glyph packing, not concentric rings; mesh number inverts in O(1); everything stays under 2^53 up to n = 2^26 (`assertSafeBase`).

### Critical Pitfalls (PITFALLS.md)

1. **Poisoned or tautological golden fixtures** - guide typos (47 vs 45; "6::3, 6::9" should be 6::3 and 9::0; odd zones "1,3,5,7,8,b" should end 9,b; the two mislabelled diagram gates Gt-15 = 5->6 and Gt-03 = 2->3) and `app/data/*` being replaced by engine output. Freeze numeric-only `base10.golden.json` (currents normalized to pair + destination) BEFORE any refactor, add named regression tests, recompute counts from definitions, never read `reference/`, never `vitest -u`.
2. **One-Torque assumption and missing cross-Torque demon category** - regions must be `torque: Cycle[]` with a canonical order (length desc, smallest zone id asc; rotate to smallest pair; freeze bases 16, 18, 28, 32, 82); cross-Torque chronodemons (base 28: 108 of 378; base 82: 1,404 of 3,321) need an explicit category; units always "pairs" vs "zones"; do not invent an "archetypal" region.
3. **In-base arithmetic slips** - use `digitalRoot(v, base) = v === 0 ? 0 : ((v-1) % (base-1)) + 1` (base 2 breaks without the `T === 0` guard), never decimal reduction; Numodemons = n/2 - 1; mesh = a(a-1)/2 + b with integer correction on the inverse; name `base` vs `top = base - 1` distinctly. Verify against a `toString(radix)` oracle for n <= 36.
4. **Refactoring a 1,943-line zero-test client with hidden base-10 constants** - capture a Playwright golden master of the untouched viewer first (pinned date, TZ=UTC, orbits=0, particles=0, wait for tween settle); extract routing verbatim, then generalize; make `base` a required argument so unmigrated call sites fail to compile; CI grep gate for `9 -`, `[1, 2, 4, 5, 7, 8]`, `<= 9`; smoke-render bases 2..40 with no NaN/undefined; sanitize history/selection/tween on base change.
5. **Rendering scale and the demon layer** - never one DOM/canvas primitive per demon; event delegation; opacity saturates (0.15 alpha reaches a solid blob by about 15 overlaps); hit-testing needs nearest-edge picking; thresholds come from the spike.
6. **Toolchain and static-export blockers** - see next section. Also: determinism (`Math.sin/cos` last-bit differences, `Math.random`, `localeCompare`), naming collisions (concatenation is not injective), export limits (canvas area caps, SVG-as-image fonts, XML escaping), and licensing (`reference/` must stay untracked; no LICENSE file; `origin` still points at upstream).

## Cross-Cutting Findings the Roadmapper Must Carry

**Source guide errors (do not inherit into fixtures, tests or copy):**
- Demon subtype counts sum to 47, not 45. Correct base-10 split: 12 cyclic + 3 syzygetic chrono, 12 Plex + 12 Warp amphi, 4 chaotic + 2 syzygetic xeno (9::0, 6::3) = 45. The guide's "4 Syzygetic Xenodemons" is wrong.
- Multi-Torque is the norm, not a 3^N+1 curiosity: about 110 of 150 even bases up to 300 have several Torque cycles (38 have exactly one; only bases 2 and 4 have none; 71 have tied lengths); 31 of 50 even bases up to 100. Examples: 16 = [4,2], 18 = [4,4], 32 = [5,5,5], 36 = [12,3,2], 64 = [6,6,6,6,3,3], 100 = [15,15,5,5,5,3]; base 666 has 14 cycles. The 3^N+1 shell pattern (4, 10, 28, 82, 244, ...) is a valid property test and nothing more.
- Part 3's worked name example concatenates low-then-high; canonical names are high-then-low (Ummnu = 9 + 8). Its "12::0" net-span example is really base-13. The "archetypal" region is not a region. Guide vs /x/ thread disagree on base-16 region terminology; the project follows the guide (PROJECT.md) and the glossary must say so.
- At base 666, 99.4% of demons are chronodemons (220,116 of 221,445; amphi 1,328; xeno 1); a type filter alone does not make the set browsable.

**Toolchain blockers (Windows 10, Node 22.16, npm 11):**
- Root `tsconfig.json` has `target: es5`: `for..of`/spread over `Set`/`Map`/generators is TS2802, BigInt literals TS2737. Vitest (esbuild) will pass while `next build` fails.
- `npm run build` = `build:plugin-zip && next build`; `zip` is not installed, so the build fails before Next starts; the script also dirties tracked `app/gematria/plugin/zipInfo.ts` every build.
- `core.autocrlf=true` with no `.gitattributes`: golden text fixtures check out CRLF on Windows. `yarn.lock` beside npm 11. `prepare` rewrites tracked `dist/` on install. `tsconfig.components.json` compiles `xenotation.ts` separately: the engine must not be imported there.
- `next lint`/`next build` lint skips `engine/` and `workers/` by default; without `--dir` and `eslint.dirs` the boundary rules never run. Root `tsc --noEmit` does not enforce the engine boundary; `tsc -p engine --noEmit` is mandatory in CI.

**Static-export conflicts (beyond the Blob import):**
- `app/api/share-image/route.ts` is a POST handler using `req.json()`: delete the whole directory (plus its self-check script and `test:share-image`), not only the import.
- `app/page.tsx` (redirect on query string) and `app/numogram/page.tsx` (`generateMetadata({ searchParams })`) read request-time data: replace with a client redirect (`location.replace`, not `useSearchParams`, which needs Suspense) and static metadata. Per-share OG images cannot exist in a static site.
- `app/gematria/saved/page.tsx` calls `redirect()` unconditionally (behavior unverified); `sitemap.ts`/`robots.ts` need `force-static` and an env-sourced host; `@vercel/analytics` 404s off-Vercel; plain `<img>`/icon paths need `withBasePath()` on sub-path hosting; add `public/.nojekyll` for GitHub Pages; workers must be same-origin (no CDN `assetPrefix`).

**Hidden base-10 surface (worse than CONCERNS.md says):** `9 - z` at 10+ sites, `[1, 2, 4, 5, 7, 8]` at 3 extra sites, `n <= 9` clamps in 3 files (`shareParams.ts`, `numogram/page.tsx`, `NumogramClient.tsx`), `0..9` object-literal initializers that throw at n > 10, `zoneRadius` 21 vs 22, and `Record<number, X>` typing that hides `undefined`. `NumogramClient.tsx` is 1,943 lines (PROJECT.md says about 1,500); its gate/current geometry sits inside `useMemo`, so it cannot be golden-tested until extracted.

## Where the Research Files Disagree (and what this summary adopts)

| # | Topic | Files disagree | Adopted here | Confirm where |
|---|-------|----------------|--------------|---------------|
| 1 | Root `tsconfig` target | STACK: ES2022. ARCHITECTURE: ES2017 (PITFALLS: es2017 or `downlevelIteration`) | **ES2022.** Any target >= ES2015 clears TS2802; config is `noEmit` (SWC transpiles); ES2022 matches `engine/tsconfig.json` and also permits BigInt literals. Fallback ES2017 (or `useDefineForClassFields: false`) if `tsc --noEmit` shows class-field diagnostics. Leave `tsconfig.components.json` (ES2019/CJS) alone. | Phase 1 (run `tsc`) |
| 2 | `engine/package.json` | ARCHITECTURE: `name`, `private`, `"type": "module"`, `exports` from day one. STACK: omit `"type": "module"` until promoted to a workspace | **STACK:** minimal `package.json` (name, private), no `type: module`, no `exports`. `type: module` buys nothing pre-publication (tsx and Vite resolve extensionless TS imports either way) and adds a webpack variable. Both agree: folder + alias, not a workspace. | Phase 1 (real `next build`) |
| 3 | Next.js version | STACK: pin 14.2.35, skip 15, Next 16 as its own late phase gated by Playwright goldens. ARCHITECTURE/PITFALLS assume Next 14 with no upgrade. PROJECT.md constraint: keep Next 14 unless the spike says otherwise | **Pin 14.2.35 for all of v1.** Carry the Next 16 upgrade as an OPTIONAL final phase (Phase 12). It revisits a stated PROJECT.md constraint, so it needs explicit user sign-off. Pull earlier only if a dependency drops Next 14, a build-time advisory hits the export pipeline, or React 19 is wanted (none identified). | User sign-off; roadmap |
| 4 | Vitest path alias | PITFALLS: `vite-tsconfig-paths`. STACK/ARCHITECTURE: none | **No plugin.** Engine uses relative imports; one regex alias only if app-side tests need `@/`. | Phase 1 |
| 5 | Lint scope | ARCHITECTURE: add ESLint `overrides` for `engine/**`. STACK: also needs `--dir engine --dir workers` and `eslint.dirs` | **Both**; the override alone never runs. | Phase 1 |
| 6 | Cross-Torque chronodemons | ARCHITECTURE: six subtypes plus `torqueA/torqueB`; its closed form lumps cross-Torque into `cyclic-chrono`. PITFALLS/FEATURES: explicit `crossTorque` category | **Add an explicit cross-Torque chrono subtype** (6 guide subtypes stay as the base taxonomy; cyclic = same-Torque only). Counts stay O(#cycles): same-Torque non-syzygetic = sum(C(2L,2) - L), cross = C(T,2) - sum C(2L,2). Legacy `kind` adapter keeps `syzygy` separate. **Product decision needed before Phase 2 freezes types.** | Phase 2 start |
| 7 | Torque naming | FEATURES: Torque-A, B, ... then AA. PITFALLS: numeric T1..Tk (letters run out at the 27th cycle, first at base 512). ARCHITECTURE: numeric `torqueIndex` | **Numeric index is identity in the engine; display is letters (guide convention) up to 26, numbers beyond.** Sort order agreed by all: length desc, then smallest zone id asc. | Phase 2 / 6 |
| 8 | Demon matrix raster | ARCHITECTURE: n x n up to 2048 px, then bin. STACK: always viewport resolution (n=10^4 full raster = 400 MB) | **STACK:** viewport-resolution raster, dominant-subtype binning. | Phase 7 |
| 9 | Virtual lists | FEATURES: TanStack Virtual. ARCHITECTURE: hand-roll (~40 lines) | Hand-roll fixed-height panels first; TanStack for the 221k-row demon browser. | Phase 6 / 7 |
| 10 | Tier thresholds | T1 full-effects: ARCHITECTURE ~64 zones vs STACK ~32; reduced to ~150 (both). All-chords "web" mode: STACK <= ~300 chords (n <= ~24); ARCHITECTURE Canvas n <= ~150 (~11k chords); FEATURES <= ~150 chords (base <= 16); PITFALLS: alpha blob by ~15 overlaps | **All LOW placeholders.** Ship the conservative numbers (STACK/FEATURES) in the tier data table until the spike replaces them. ARCHITECTURE's n ~150 web mode contradicts PITFALLS' saturation finding unless opacity scales with edge density. | Phase 5 |
| 11 | Spike ordering | PITFALLS lists the spike (P2) before layout (P3). ARCHITECTURE places it after layout (3b): the harness needs routes | **After layout**, before Canvas/worker commitments. If schedule pressure exists, a "spike-lite" on synthetic point/edge scenes can start earlier. | Roadmap |
| 12 | PRNG and naming schema | FEATURES sketch: `mulberry32-cyrb128@1`, `"schema": 1`, override keys `"a:b"`. ARCHITECTURE: `ccrug.naming/1`, keys `"a::b"`. STACK: sfc32 + cyrb128 | **sfc32-cyrb128@1.** Override keys **`"a:b"` decimal**, per FEATURES' claim that this matches the existing `DEMON_NAMES` keys (verify against `app/data/demons.ts`). Schema id string settled in requirements. | Phase 9 |
| 13 | Plugin zip | PITFALLS: archiver/adm-zip or skip when `zip` missing. STACK: fflate `zipSync`, sorted entries, fixed mtime (adm-zip stamps FS mtimes) | **fflate.** Verify byte-identity under two `TZ` values. | Phase 1 |
| 14 | Build scripts | ARCHITECTURE/PITFALLS: `build:static`. STACK: `build` = `next build`, plus `build:all` for the plugin zip | **STACK.** Keep `prepare`/`build:components` untouched. | Phase 1 |
| 15 | DOM golden format | PITFALLS: hashes + a few PNG diffs. STACK/ARCHITECTURE: normalized `svg.outerHTML` text, Chromium only | **Normalized text goldens** (diffable, OS-independent); no cross-OS PNG goldens. Fixtures live in `engine/test/fixtures/` (not `tests/`). | Phase 1 |
| 16 | Client redirect | STACK: `location.replace('/numogram/' + search)` with a `base` key in `KEYS`. ARCHITECTURE: without trailing slash. PITFALLS: `router.replace` | **STACK** (matches `trailingSlash: true`; `base` must be in `NUMOGRAM_QUERY_KEYS` or `/?base=16` never redirects). | Phase 1 |
| 17 | Naming distinctness | ARCHITECTURE's Feistel gives distinct ZONE sounds "by construction". PITFALLS: concatenated DEMON names are not injective and euphony is many-to-one | Both true; not a conflict but a gap. Zone-sound distinctness does not imply demon-name distinctness. Needs a prefix-free or separator-aware inventory and a visible collision report. | Phase 9 |

Smaller syntax deltas to settle in requirements, not research: multi-digit label separator (comma in FEATURES, period in PITFALLS); `region=torque.N` (ARCHITECTURE) vs `torque-<i>` (PITFALLS); `digits` values `alnum|dec|glyph` vs FEATURES' `digits|decimal|alphabet`; mesh number display (decimal by default, in-base optional); Gate 0->0 draw/omit policy (engine emits n gates; renderer decides once).

## Implications for Roadmap

Correctness gates everything, so foundations and the engine come first, and the base-10 golden stays green at every step. The suggested build order carries the user's eight groups (foundations, engine, ceiling spike, UI generalization, demons, Canvas/worker, naming/export/CLI, hardening) with ARCHITECTURE's layout/migration steps made explicit. Eleven phases plus one optional; a coarser roadmap can merge 2+3, 4+5, and 10+11.

### Phase 1: Foundations and Safety Net
**Rationale:** Every later phase is gated by golden tests; the oracle and DOM goldens must be captured from the untouched viewer before any edit, and the project cannot build on this machine today.
**Delivers (in this order):**
- Repo hygiene: `.gitattributes` (`* text=auto eol=lf`) BEFORE the first fixture; npm only (delete `yarn.lock`, `packageManager`, `engines >=22.12`); Next 14.2.35, TS 5.9.3, ESLint 8.57.1 exact pins; root target ES2022; `@types/node ^22`; `build` decoupled from the zip step (fflate, fixed mtime).
- Test infra: Vitest 5 with TZ pin at three layers (config, `cross-env`, canary test), fast-check, Playwright config.
- Freeze the oracle: numeric `base10.golden.json` (pairs, currents by pair + destination, gates k -> to with T(k), demon net-spans + kinds, regions, `TC_*`) with named Gt-15 (5->6) and Gt-03 (2->3) regressions; Playwright normalized-SVG goldens of the pre-refactor viewer (4 layouts x ~5 states; `date=2000-01-01`, `orbits=0`, `particles=0`, wait for settle) against `next dev`.
- Only after the capture: static-export decoupling (delete share-image dir/script, remove Blob/Analytics, client redirect, static metadata, sitemap/robots `force-static`, `output: 'export'`); switch the Playwright web server to `serve out`.
- Engine scaffold with `engine/tsconfig.json`, ESLint boundary override, `typecheck` script running all three `tsc` invocations, hard-coded-constant grep gate, base 2..40 smoke skeleton, `git ls-files reference` = 0 guard, LICENSE/attribution decision and `origin` repoint as tracked tasks.
**Addresses:** static/offline deployability (prerequisite for export/share).
**Avoids:** Pitfalls 3, 6 (gate), 7, 11, 12, 17.

### Phase 2: Engine Core and Golden Tests
**Rationale:** Core value; math is verified and cheap; everything else consumes it.
**Delivers:** `engine/core` with `digitalRoot`/`toDigits` (formatting separate), pairs, `Cycle[]` regions with canonical order (Warp found as a fixed pair, formula only as test oracle), currents, gates, lazy `DemonSpace` (mesh, isqrt correction, type classifier including cross-Torque, closed-form counts, unranking, Numodemons = n/2 - 1), label identity/display core, `assertSafeBase(2^26)`. Tests: equals oracle at base 10; guide facts (12, 16, 28 = [9,3], 80 = [39], 82 = [27,9,3]); warp iff n = 3o+1 with o odd; exhaustive sweeps for even n 2..2000 as plain loops; enumeration vs closed form for n <= 200; `toString(radix)` oracle for n <= 36; bases 2/4/6 literals; counts sum to C(n,2).
**Decisions needed first:** cross-Torque subtype (row 6), Gate 0->0 policy, Torque ordering/naming (row 7).
**Avoids:** Pitfalls 1, 2, 3, 4, 5, 10, 15. **Research flag:** standard.

### Phase 3: Base-10 Strangler Migration
**Rationale:** The only way to generalize a 1,943-line component while keeping base 10 byte-identical.
**Delivers:** `app/data/{syzygies,currents,gates,demons}.ts` become views over the engine joined with lore by id; `TC`, `ZONE_REGION`, `TC_*` derived; `legacyKind()` adapter (note the old layer filter hides the 3 syzygetic chronodemons); `ALL_DEMONS` from `demons.at(0..44)` (no module-level materialization); gate/current routing extracted verbatim to `engine/layout/routing.ts` with an explicit `orientationCache`, then generalized to numeric keys; `NumogramClient` about 350 lines lighter. Exit: DOM goldens identical, zero UI diff.
**Avoids:** Pitfalls 3 (tautology), 5, 6, 7. **Research flag:** standard.

### Phase 4: Procedural Layout and Preset Registry
**Rationale:** Legibility is half the core value, and both the spike and the UI need real layouts. The alternating odd/even structure makes the ring layout correct by construction.
**Delivers:** `LayoutSpec` registry with `resolveLayout` (preset match, then procedural, then default); ring (default for n >= 6; nested for <= 3 cycles; Fermat-spiral glyph packing beyond; Plex/Warp capsules), spiral, ladder (test `ladder(g10) == P_LADDER`), diameters; base-10 `original`/`labyrinth`/`planetary` as presets; node radius, font, stroke, loop size as functions of `(n, layout)`; syzygy-collapsed pair-graph view; invariants (finite coordinates, syzygy adjacency, `2L`-gon, no overlap, rounded deterministic output); degenerate bases 2/4/6. Recommend pulling `sceneToSvg` plus a minimal tsx CLI into this phase as the visual-review harness for bases 2, 4, 6, 8, 12, 16, 28, 82, 100.
**Avoids:** Pitfalls 9, 10, 15. **Research flag: YES** (multi-ring/spiral legibility at 10-60 cycles, label collision, Y-junction routing, edge bundling for gates at n >= 100; needs visual iteration and user taste on flow direction and Plex placement).

### Phase 5: Ceiling Spike
**Rationale:** All tier thresholds are hypotheses; the output decides Canvas and worker scope and must come before those commitments.
**Delivers:** harness on synthetic scenes and real ring layouts; frame time and memory per tier vs n (SVG rich/reduced, Canvas cached layers, matrix raster, worker offload); all-chords limit with density-scaled opacity; a Safari canvas-area probe if a device is available; `engine/scene/tiers.ts` data table; explicit yes/no on the WebGL contingency (PixiJS 8) and on `tier=` override.
**Avoids:** Pitfall 8 (by measuring), informs 9 and 14. **Research flag:** measurement, not literature.

### Phase 6: UI Generalization (SVG tier)
**Rationale:** Turns the engine and layouts into the product; sweeps the hidden base-10 constants with a compile-time forcing function.
**Delivers:** `base` required everywhere (grep gate clean, `Projection` takes `model`, viewBox from `layout.bounds`); `urlState` single codec (omit `base` when 10; strict `/^[1-9]\d*$/` + even + `isSafeInteger`; huge-base size guard; layout validated against base; legacy-URL fixture corpus; `tc=1` = union of Torque zones); `useNumogramModel` with stale-drop; base picker (typed + stepper + slider, odd-input explanation, preset chips, live summary with cycle lengths in pairs and zones); label schemes (digits <= 36, decimal with separator, custom alphabet with presets, xenotation capped at about 1e6); region legend table, isolate, hide Warp control when none; delegated hover/pin, detail panel, text view + copy, layer toggles; hand-rolled virtualized panels; keyboard traversal, ARIA, non-colour cues, reduced motion; history/selection/tween sanitized on base change (crossfade, not tween); glossary; large-base messaging.
**Addresses:** most FEATURES table stakes. **Avoids:** Pitfalls 4 (UI), 6, 7, 9, 10, 13.
**Research flag:** label scheme beyond base 36 (decision plus font/glyph coverage tests); URL codec is standard.

### Phase 7: Demons Layer
**Rationale:** Needs the engine's `DemonSpace` and the UI shell; it is the true ceiling, so it follows the spike.
**Delivers:** closed-form facets (with cross-Torque sub-facets); focus mode (n-1 chords per zone, capped); zone-centric slice; TanStack-virtualized browser over C(n,2) rows via `at(mesh)` with sort by mesh/type, filters, search by `a::b`/mesh (name search only when count <= about 50k, via a worker-built index); Numodemon list; selected-demon chord; matrix raster at viewport resolution with O(1) picking; all-chords "web" mode only below the spike limit; base-10 keeps its 45 canonical names.
**Avoids:** Pitfalls 5, 8. **Research flag:** matrix tiling/LOD at n >= ~4k.

### Phase 8: Canvas Tier and Worker
**Rationale:** Implements the tiers the spike justified; can trail Phase 7 and overlap with Phase 9.
**Delivers:** `CanvasView` (cached static layers, `Path2D` per route, overlay canvas, uniform-grid zone picking, id-buffer edge picking, label LOD at node radius > ~7 px); `computeClient` (InlineClient for tests/SSR/small n, WorkerClient), `workers/engine.worker.ts` (typed-array transfer, monotonically increasing request id, worker created only in the browser); `selectTier` from the data table; over-ceiling degrade to headless with a visible message; one Playwright smoke test computing base 28 through the worker in the exported build (with and without `basePath`). Conditional: WebGL tier only if the spike says so.
**Avoids:** Pitfalls 8, 9. **Research flag: YES** (picking approach; worker bundling under Next 14 webpack in an export build).

### Phase 9: Naming Builder
**Rationale:** Pure module depends only on the engine (can start after Phase 2, in parallel with 3-6); UI needs Phases 6-7.
**Delivers:** versioned SoundMap schema and hand-written validator (`Map`/null-prototype, reject wrong base, size cap); sfc32-cyrb128 PRNG with frozen vectors; seeded generator with locks (Feistel + cycle-walking is a proposal to validate; fallback seeded Fisher-Yates); prefix-free or separator-aware sound inventory; euphony pass; join order default high-then-low with low-then-high option; sparse overrides; collision report; CCRU base-10 preset (10 phonemes + 45 names as overrides, not derivations); JSON import/export; URL carries only `names=ccru|seed:<s>`; NFC normalization and `Intl.Segmenter` for grapheme-safe handling.
**Avoids:** Pitfalls 15, 16. **Research flag: YES** (euphony rules, phoneme-bank sizing, generator quality; little external prior art).

### Phase 10: Export and CLI
**Delivers:** `sceneToSvg` (string builder, literal attributes, coordinates rounded to 2-3 decimals, XML escape plus illegal-character stripping, named layer groups, explicit width/height/viewBox, no script/foreignObject/external refs, tested); `sceneToJson` (schemaVersion, base, seed, numeric only, no lore); PNG via `Image` -> `canvas.toBlob` with area clamp and `"data:,"`/null failure detection; poster text as outlined paths from a build-time glyph table (fall back to live text with a warning for custom alphabets); replace the Vercel share flow with copy-URL + PNG download; tsx CLI (`--base --layout --format svg|json`); streaming demon export in worker chunks (P2); hosting checklist (`basePath`, `.nojekyll`, `withBasePath`).
**Avoids:** Pitfall 14. **Research flag: YES** (cross-browser PNG matrix incl. Safari; opentype.js 2.0 API and OFL font license; resvg-wasm only if limits are hit).

### Phase 11: Hardening
**Delivers:** perf regression checks against the spike table; history across bases; a11y audit (WCAG 1.4.1, 1.4.11, 2.1.1, 4.1.2); docs and glossary (state the guide-vs-thread region terminology choice); LICENSE/NOTICE and upstream attribution; Windows + Linux CI running `next build`, `vitest run`, `tsc` x3, `build:components`; Node 20/22 determinism run; release checklist (`git ls-files reference` = 0).
**Research flag:** standard.

### Phase 12 (optional, own phase): Next 16 Upgrade
**Rationale:** Only after goldens are green; needs user sign-off (row 3).
**Delivers:** codemod upgrade; `next-lint-to-eslint-cli` and flat ESLint config; `next build --webpack` first, Turbopack only after the worker smoke test and DOM goldens pass on it.
**Research flag:** YES (Turbopack worker bundling and flat-config migration unverified).

### Phase Ordering Rationale

- Dependency chain: oracle -> engine -> strangler swap -> layout -> spike -> UI -> demons -> Canvas/worker -> naming/export -> hardening. Naming's pure module can start right after Phase 2; `sceneToSvg` plus a minimal CLI only need Phase 4 and double as the layout review harness.
- Phase 1 has parallel tracks (toolchain, static decoupling, engine scaffold) but the golden capture must precede any edit of `NumogramClient`, and `.gitattributes` must precede the first fixture.
- The region model (`Cycle[]`), the taxonomy and the integer-identity/label-scheme split are retrofit-expensive (Pitfall recovery cost HIGH), so they are frozen in Phase 2 before URLs, JSON and UI depend on them.
- Static deployability is delivered early (Phase 1) because export, share and offline all depend on it, and `output: 'export'` unconditional acts as a guardrail against reintroducing servers.

### Research Flags

Phases likely needing deeper research (`/gsd-research-phase`) during planning:
- **Phase 4 (Layout):** legibility at many cycles is subjective; multi-ring/spiral and gate bundling options.
- **Phase 5 (Spike):** real measurement on target hardware and browsers.
- **Phase 6 (labels only):** scheme beyond base 36, glyph coverage.
- **Phase 7 (matrix LOD at n >= ~4k), Phase 8 (picking, worker bundling), Phase 9 (naming generator), Phase 10 (Safari export, glyph table).**
- **Phase 12 (if approved).**

Phases with standard patterns (skip research-phase):
- **Phase 1** (but verify empirically in the first export build), **Phase 2** (math verified), **Phase 3** (strangler with frozen oracle), **Phase 11.**

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions, engines and peer ranges from the npm registry and official Next docs (HIGH). Playwright golden workflow, worker bundling, byte-determinism of fflate across TZ, and TS 7 incompatibility (secondary sources) are MEDIUM. Render thresholds LOW. |
| Features | MEDIUM-HIGH | Numogram math and local sources HIGH; competitor landscape thin (numogram.xyz unreachable, LOW); generator-pattern research MEDIUM. |
| Architecture | MEDIUM-HIGH | Engine math and static-export constraints prototyped and verified (HIGH); layout, worker and canvas design MEDIUM (own design, not visually validated); tier thresholds LOW. |
| Pitfalls | MEDIUM-HIGH | Math and toolchain pitfalls recomputed or reproduced (HIGH); canvas limits MEDIUM (secondary sources); performance thresholds LOW-MEDIUM. |

**Overall confidence:** MEDIUM-HIGH. The correctness spine (engine, oracle, migration) is well grounded; the rendering and export tiers are directionally sound but numerically unmeasured.

### Gaps to Address

- **Renderer thresholds:** SVG/Canvas/matrix/all-chords limits differ across files and are unmeasured; resolve in Phase 5; keep them in a data table.
- **Cross-Torque taxonomy and Torque naming/order:** product decisions (rows 6 and 7) before Phase 2 freezes fixtures.
- **Gate 0->0 policy, mesh-number display base, label separator, region URL syntax:** decide once in requirements; recorded in the engine data contract.
- **Label scheme beyond base 36:** decimal-with-separator is the recommendation; needs font/glyph coverage tests and a decision on custom-alphabet export fallback.
- **Next 14.2 export behavior** for `redirect()` in `app/gematria/saved/page.tsx`, `sitemap.ts`, `robots.ts` and `searchParams` pages is from docs, not a build; confirm in the first Phase 1 export build. Also confirm `npm ls next` resolves to 14.2.35.
- **Windows specifics:** `process.env.TZ` runtime behavior (canary test), fflate zip determinism across TZ, Vite 8 with Vitest 5 (fallback Vite 7.3.6).
- **Worker chunk in an exported site** with `trailingSlash` and `basePath`: Phase 8 smoke test.
- **Naming generator quality:** Feistel/cycle-walking is a proposal; demon-name collisions are inevitable at scale; inventory sizing needs prototyping.
- **Export:** Safari canvas area limit (secondary sources), SVG-as-image font behavior, opentype.js 2.0 `getPath().toPathData()` existence, OFL font license, design-tool support for embedded `@font-face` (contradictory sources).
- **Licensing/provenance:** no LICENSE file; `origin` points at upstream; prose in `app/data/zones.ts`/`gates.ts` has unverified provenance; the base-10 preset carries it, new fixtures/JSON/SVG metadata must not.
- **Aesthetic choices for the user:** flow direction (anticlockwise per existing lore), Plex at center vs bottom, theme set, default label case (guide lowercase, /x/ thread uppercase).
- **PROJECT.md scope check:** confirm text view, keyboard/ARIA, region legend and pair-graph view as v1; confirm compare/base atlas as v1.x.
- **Stale figure:** PROJECT.md says about 1,500 lines for `NumogramClient`; use 1,943.

## Sources

### Primary (HIGH confidence)
- npm registry queries of 2026-09-25 (versions, dist-tags, engines, peer ranges, sizes) - STACK.md.
- Next.js docs: static exports (v14.2.35), ESLint config (v14.2.35), support policy, Next 16 upgrade guide - STACK.md, ARCHITECTURE.md.
- Context7 `/vitest-dev/vitest`, `/microsoft/playwright` - test projects, TZ pin, `page.clock`, snapshot paths.
- Local verification: `tsc` reproduction of TS2802/TS2737 under `target: es5`; `which zip` (absent); git config `core.autocrlf=true`, no `.gitattributes`/LICENSE; throwaway scripts over even n <= 5000 (permutation, warp-iff, cycle statistics, demon type closed forms vs enumeration, mesh round-trip, gate table vs `GATE_LIST`, ring/packing timings).
- `reference/genius-guide-diy-numogram-demonology.txt`, `reference/INDEX.md`, `.planning/PROJECT.md`, `.planning/codebase/*`, `app/data/*`, `app/lib/*`, `app/NumogramClient.tsx`, `package.json`, `tsconfig*.json`, `next.config.js`.
- gramculator page source and `base.js` (read directly).

### Secondary (MEDIUM confidence)
- Cytoscape.js WebGL preview post (Canvas vs WebGL frame rates); webpack web-workers guide and App Router field notes; Canvas size limit write-ups (pqina.nl, html2canvas issue, canvas-size); SVG-font-embedding write-ups; Mozilla bug 700533; cross-engine `Math.*` divergence write-ups; fflate README; resvg-wasm `index.d.ts`; Watabou/Azgaar/Mermaid Live design references; CCRU Research Archive provenance tiers; Okabe-Ito palette guidance; TypeScript 7 compatibility statements from secondary write-ups.

### Tertiary (LOW confidence, needs validation)
- SVG-vs-Canvas node-count guidance ("a few thousand SVG nodes"); yWorks comparison (no numeric thresholds); design-tool support for embedded SVG fonts; numogram.xyz (unreachable); `.nojekyll` requirement (general knowledge); the /x/ thread's lore (fiction, structural tables only).

---
*Research completed: 2026-09-25*
*Ready for roadmap: yes (pending user confirmation on rows 3 and 6, and on the PROJECT.md scope additions noted under Gaps)*

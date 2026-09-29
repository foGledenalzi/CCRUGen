# CCRUG - Arbitrary-Base Numogram Generator

A tool for **constructing and visualizing numograms in any even base**: base 2 up to however high the measured processing ceiling allows (base 32, 64, 666 and beyond), instead of only the canonical base-10 diagram. It is a static web app backed by a pure TypeScript engine.

Pick a base and CCRUG derives the zones, syzygies, currents, gates, the Plex / Warp / Torque regions and the demon set, draws the result as SVG, and lets you name the demons and export the diagram. Base 10 is the reference preset: the engine must reproduce it exactly.

Based on lumpenspace/ccru (https://github.com/lumpenspace/ccru). The upstream repository ships no license, so the files inherited from it are not relicensed here, and the CCRU-derived base-10 lore text is a third-party pack (see [NOTICE](NOTICE) and [Licensing](#licensing-and-credits)).

> **Status: early development.** The generator is being built phase by phase (see the [roadmap](#roadmap)): Phases 1 through 4 are complete and independently verified. The repository is now a fully static site with an interactive numogram viewer that works for any even base, not just base 10. Pick a base by typing, stepping, sliding or clicking a notable-base chip; the diagram, a region legend (Plex, Warp and each Torque cycle, independently isolated or muted), and zone labels (in-base digits, decimal with a separator, xenotation, or a custom alphabet) all update live, the view round-trips through a shareable `?base=` URL, and the whole thing works without a mouse or colour vision (keyboard traversal, ARIA labelling, reduced motion, and a text view with a copy button). Base 10 stays byte-identical to a frozen pre-refactor oracle throughout, and layouts above it are deterministic and procedural (ring, ladder or Barker spiral, plus a syzygy-collapsed pair-graph view). The renderer's threshold table is measured, not assumed: a real four-device-profile spike (native GPU, software raster, and two CPU-throttled profiles emulating weaker hardware) on the maintainer's machine, reviewed and approved before it shipped. Past that measured SVG-tier ceiling, a text summary takes over rather than freezing the tab; the Canvas tier for larger bases (Phase 6) is still to come.

## The idea

A numogram is usually shown as one diagram, the ten-zone base-10 one. It is really a construction that works in any even base, so CCRUG treats numograms as a class of objects rather than a single picture.

For an even base `n` (zones `0 .. n-1`), all arithmetic done in that base:

- **Syzygies:** zones pair up so that each pair sums to `n-1` (a pair is written `hi::lo`). There are `n/2` pairs. Odd bases are excluded: they force a zone to pair with itself.
- **Currents (major flows):** the pair `hi::lo` flows to the zone `hi-lo`.
- **Gates (minor flows):** zone `k` flows to the in-base digital root of the triangular number `k(k+1)/2`.
- **Regions:** the **Plex** is the pair `0::(n-1)` and is always present. The **Warp** is a pair that flows to itself and exists only when `n = 3o + 1` with `o` odd (bases 4, 10, 16, 22, 28, ...). Every remaining cycle of currents is a **Torque**, and there can be several.
- **Demons:** every unordered pair of zones `a::b` is a demon, so there are `n(n-1)/2` of them (45 in base 10, 66 in base 12).

Torque cycles by base (lengths counted in syzygy pairs):

| Base | Warp | Torque cycles |
|------|------|---------------|
| 10 | yes | 3 |
| 12 | no | 5 |
| 16 | yes | 4, 2 |
| 28 | yes | 9, 3 |
| 80 | no | 39 |
| 82 | yes | 27, 9, 3 |

The arithmetic itself is instant, even at base 100,000. The real limits are drawing that many nodes and the quadratic demon layer (base 666 has 221,445 demons), which is why the renderer is tiered and the ceiling is measured rather than assumed: a real four-device-profile ceiling spike (Phase 3) found the interactive SVG tier legible to roughly 200-300 zones, the Canvas tier (Phase 6) comfortably interactive through at least 4,000 with no ceiling found in the measured range, and the full demon "web" of every pairwise connection at once legible only to about 60-80 zones regardless of speed (an overlap limit, not a performance one). The engine's own mathematical ceiling is base 2^26.

## What v1 covers

- The core diagram: zones, syzygies, currents, gates, Plex / Warp / Torque regions, and a generated layout for any even base.
- All demons, with net-span, mesh number and type, kept virtual so they never freeze the page.
- A naming builder: a sound per zone, demon names derived from net-spans, editable and shareable as JSON.
- Export to SVG, PNG and JSON, plus a headless CLI.
- A fully static site: no server, no accounts, no analytics.

Out of scope for now: pitch, the Decadence card games, rites and omens, and planet / zodiac / tarot correspondence packs for other bases.

## Roadmap

Planning documents live in [`.planning/`](.planning/): start with [`PROJECT.md`](.planning/PROJECT.md), [`REQUIREMENTS.md`](.planning/REQUIREMENTS.md) and [`ROADMAP.md`](.planning/ROADMAP.md).

| Phase | Goal | Status |
|-------|------|--------|
| 1. Foundations and Safety Net | Static-export toolchain, the base-10 viewer frozen as a test oracle, enforced engine boundary, licensing | Complete (verified) |
| 2. Engine Core and Base-10 Migration | Pure tested engine for any even base; the base-10 viewer re-derived from it | Complete (verified) |
| 3. Procedural Layout and Ceiling Spike | Legible layouts for any base and a measured renderer threshold table | Complete (verified) |
| 4. Base Picker and Generator UI | Interactive viewer for any even base, URL state, accessibility | Complete (verified) |
| 5. Demons Layer | Browse, count and inspect every demon at any base | Not started |
| 6. Canvas Tier and Worker | Large bases stay interactive; graceful degradation | Not started |
| 7. Naming Builder | Zone sounds, derived demon names, JSON import / export | Not started |
| 8. Export, CLI and Hardening | SVG / PNG / JSON export, headless CLI, cross-platform CI | Not started |

## Requirements

- Node >= 22.12
- npm 10 or 11 (this project does not use yarn). CI runs Node 22, which ships npm 10, so `package-lock.json` must stay valid for both versions: regenerate it with `npx npm@10.9.3 install --package-lock-only --ignore-scripts`.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/numogram/`. The site root `/` is a client-side redirect to `/numogram/`.

## Static build

```bash
npm run build   # next build: writes a fully static site to out/ (no server needed)
npm start       # previews out/ with `serve out`
```

The export is host-agnostic: it builds for the site root by default. To host it under a sub-path, set `NEXT_PUBLIC_BASE_PATH` (it must start with `/` and not end with one) through `cross-env` or an npm script, for example `npx cross-env NEXT_PUBLIC_BASE_PATH=/your-path next build`. Git Bash rewrites values that start with `/` into Windows paths, so in Git Bash prefix the command with `MSYS_NO_PATHCONV=1`. Old `/?layout=...` share links redirect to `/numogram/` and keep their query string.

## Checks

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | `tsc` for the app, the engine and its tests, and the component library, then ESLint (which enforces the engine boundary) |
| `npm run test` | Vitest under `TZ=UTC`: the engine tests (including the independent brute-force cross-check and the 2^26 ceiling test), the base-10 numeric oracle, golden manifests, page-weight and guard tests |
| `npm run test:tz` | the same suite under `America/New_York` |
| `npm run test:e2e` | Playwright (Chromium only) against the static export in `out/`: the 30 DOM goldens under two time zones, the static-export specs and the frozen behaviour baseline |
| `npm run test:swap` | the gate run after each base-10 data-source swap: a fresh build, the 60 DOM-golden comparisons, the behaviour baseline, then Vitest (about 3 minutes) |
| `npm run test:e2e:basepath` | builds with `NEXT_PUBLIC_BASE_PATH=/ccrug`, stages it and runs the static-export specs under that sub-path |
| `npm run check:repo` | repository hygiene guards, for example that nothing under `reference/` is tracked |
| `npm run check:weight` | the page-weight budget, against a fresh `npm run build` |
| `npm run verify` | the single CI entry point that runs all of the above; `.github/workflows/ci.yml` calls it on Ubuntu and Windows |

On a fresh machine, install the browser once before the first e2e run: `npx playwright install chromium`.

## Base-10 oracle

The base-10 viewer's behaviour is frozen before anything is refactored. The numeric oracle `engine/test/fixtures/base10.golden.json` and the 30 DOM goldens under `e2e/__golden__/` (three layouts times ten states) are locked by sha256 manifests (`node scripts/golden-manifest.mjs verify ...`). Never run Vitest with `-u` or Playwright with `--update-snapshots` to make a test pass. An intentional visual change adds a new dated golden set with `node scripts/golden-manifest.mjs freeze ... --reason "..."`; the pre-refactor set is never overwritten.

Two more frozen sets sit beside them. `engine/test/fixtures/derived/notable-bases.golden.json` holds the Torque structure and demon-subtype counts of notable bases (up to 1024), computed by the independent reference. `e2e/__behaviour__/` is a behaviour and text baseline of the base-10 viewer (panel text, hover popovers, Selection-panel detail text, URL state and undo/redo, in four layouts plus a phone-width view); it covers the lore text that the DOM goldens, which capture only the projection SVG, cannot see. Each has its own sha256 manifest and the same never-regenerate rule.

## Page-weight budget

`perf/page-weight.baseline.json` records the static export's per-route HTML, JS and CSS sizes (raw and gzip) and the DOM node count of each golden state. `npm run check:weight` fails on growth beyond the baseline plus `max(1 KiB, 5%)` for bytes, or the baseline plus `max(2, 2%)` for DOM elements. Raise the budget only with `node scripts/page-weight.mjs update --reason "..."`, which keeps a written history.

## The engine

`engine/` (pure TypeScript, no dependencies) derives the numogram for any even base from 2 to 2^26 (67,108,864). Its public API is `createNumogram(base)`: a frozen, cached object with the zones, syzygy pairs, currents, gates, the Plex / Warp / Torque cycles in canonical order, and a virtual demon space (`demons`). Invalid bases (odd, zero, negative, non-integer, NaN, Infinity or above the ceiling) throw a `RangeError`; `validateBase(n)` reports the reason without throwing. Numerals are written in the numogram's own base by `formatNumeral`, `formatGateName` and `formatNetSpan`: in base 12 the gate for zone 11 is `Gt-56` and a net-span reads `b::3`.

- **O(n) memory, never O(n^2).** Cycles live in typed arrays, so base 2^26 (1,290,872 cycles) builds in about 0.6 s and roughly 300 MB. Demons are never materialized: a mesh number converts to and from a net-span `a::b` in O(1), exactly up to the ceiling; per-type counts are closed-form; `group(type)` and `subtype(name)` unrank the k-th demon in mesh order.
- **Cross-Torque chronodemons are an explicit subtype.** Base 28, for example, has 378 demons, 108 of them cross-Torque chronodemons; base 10 splits 12 + 3 chrono, 12 + 12 amphi and 4 + 2 xeno.
- **Checked against an independent reference.** `tests/bruteforce/` is a slow module written straight from the definitions (it shares no code with the engine). The engine matches it for every even base up to 2000 structurally and for every demon of every even base up to 300, with fixed-seed samples beyond, and it reproduces the frozen base-10 oracle.
- **Status:** complete and verified. The base-10 viewer's syzygies, currents, gates, demons and regions are derived from the engine and joined with the CCRU lore by id (adapters in `app/presets/base10/`), with the DOM goldens and the frozen behaviour baseline unchanged.

## Engine boundary

`engine/` is pure TypeScript: no DOM or Node types, relative imports only. `npm run typecheck` enforces this with its own `tsconfig` and an ESLint override, and a guard test proves the rules still fire.

## Component library

`component-library/` is inherited from upstream and kept on disk; it is out of scope for the generator. `npm install` runs the `prepare` script, which compiles it into `dist/` (generated and untracked). The package name is `ccrug`, so its exports are imported as `ccrug/components`.

## Repository layout

- `app/` - the Next.js viewer (`app/numogram/`, `app/NumogramClient.tsx`, `app/components/`, `app/hooks/`, `app/lib/`).
- `app/data/` - just `types.ts` now; the six base-10 data seams and the re-export in `app/lib/constants.ts` were deleted in Phase 4 once every consumer moved to `app/presets/base10/*` or the engine directly.
- `app/presets/base10/` - the base-10 adapters (engine output joined with lore by id) and `lore.ts`, the single CCRU-lore module (third-party text, see `NOTICE`).
- `engine/` - the pure TypeScript numogram engine (`engine/core/`), its tests, and the frozen numeric oracle and derived fixtures.
- `tests/` - Vitest suites (oracle, manifests, page-weight, e2e normalizer, repository guards) and the independent brute-force reference in `tests/bruteforce/`.
- `e2e/` - Playwright specs, the visual-DOM normalizer, the 30 frozen DOM goldens and the frozen behaviour baseline (`e2e/__behaviour__/`).
- `perf/` - the page-weight baseline.
- `scripts/` - oracle capture, golden manifests, page-weight check, repository guards and the sub-path staging helper.
- `component-library/` - inherited from upstream and out of scope for this project; kept on disk unchanged.
- `.planning/` - project, requirements, roadmap, research, per-phase plans, notes and the open follow-up todos in `.planning/todos/pending/`.
- `CLAUDE.md` - notes for AI-assisted sessions (project rules and how to resume).
- `reference/` - local-only reference material; gitignored and not part of the repository.

## Licensing and credits

- New original code (the engine, layout, naming, export, tests and scripts written for this project) is **MIT**: see [`LICENSE`](LICENSE). [`NOTICE`](NOTICE) is authoritative on which files fall under which terms.
- The viewer inherited from **lumpenspace/ccru** is not relicensed by this project (upstream ships no license), and the base-10 lore text (zone, syzygy, current, gate and demon names and descriptions in `app/presets/base10/lore.ts`) is third-party material derived from the CCRU writings and is excluded from the MIT grant; both are listed in `NOTICE`.

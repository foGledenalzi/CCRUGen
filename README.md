# CCRUG - Arbitrary-Base Numogram Generator

A tool for **constructing and visualizing numograms in any even base**: base 2 up to however high the measured processing ceiling allows (base 32, 64, 666 and beyond), instead of only the canonical base-10 diagram. It is a static web app backed by a pure TypeScript engine.

Pick a base and CCRUG derives the zones, syzygies, currents, gates, the Plex / Warp / Torque regions and the demon set, draws the result as SVG, and lets you name the demons and export the diagram. Base 10 is the reference preset: the engine must reproduce it exactly.

Based on lumpenspace/ccru (https://github.com/lumpenspace/ccru). The upstream repository ships no license, so the files inherited from it are not relicensed here, and the CCRU-derived base-10 lore text is a third-party pack (see [NOTICE](NOTICE) and [Licensing](#licensing-and-credits)).

> **Status: early development.** The repository still runs the inherited base-10 viewer, now built as a fully static site and frozen behind a base-10 test oracle. The generator is being built phase by phase (see the [roadmap](#roadmap)); Phase 1 is executed and awaiting verification.

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

The arithmetic itself is instant, even at base 100,000. The real limits are drawing that many nodes and the quadratic demon layer (base 666 has 221,445 demons), which is why the renderer is tiered and the ceiling is measured rather than assumed.

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
| 1. Foundations and Safety Net | Static-export toolchain, the base-10 viewer frozen as a test oracle, enforced engine boundary, licensing | Executed (verification pending) |
| 2. Engine Core and Base-10 Migration | Pure tested engine for any even base; the base-10 viewer re-derived from it | Not started |
| 3. Procedural Layout and Ceiling Spike | Legible layouts for any base and a measured renderer threshold table | Not started |
| 4. Base Picker and Generator UI | Interactive viewer for any even base, URL state, accessibility | Not started |
| 5. Demons Layer | Browse, count and inspect every demon at any base | Not started |
| 6. Canvas Tier and Worker | Large bases stay interactive; graceful degradation | Not started |
| 7. Naming Builder | Zone sounds, derived demon names, JSON import / export | Not started |
| 8. Export, CLI and Hardening | SVG / PNG / JSON export, headless CLI, cross-platform CI | Not started |

## Requirements

- Node >= 22.12
- npm (this project does not use yarn)

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
| `npm run test` | Vitest under `TZ=UTC`: base-10 numeric oracle, golden manifests, page-weight and guard tests |
| `npm run test:tz` | the same suite under `America/New_York` |
| `npm run test:e2e` | Playwright (Chromium only) against the static export in `out/`: the 30 DOM goldens under two time zones plus the static-export specs |
| `npm run test:e2e:basepath` | builds with `NEXT_PUBLIC_BASE_PATH=/ccrug`, stages it and runs the static-export specs under that sub-path |
| `npm run check:repo` | repository hygiene guards, for example that nothing under `reference/` is tracked |
| `npm run check:weight` | the page-weight budget, against a fresh `npm run build` |
| `npm run verify` | the single CI entry point that runs all of the above; `.github/workflows/ci.yml` calls it on Ubuntu and Windows |

On a fresh machine, install the browser once before the first e2e run: `npx playwright install chromium`.

## Base-10 oracle

The base-10 viewer's behaviour is frozen before anything is refactored. The numeric oracle `engine/test/fixtures/base10.golden.json` and the 30 DOM goldens under `e2e/__golden__/` (three layouts times ten states) are locked by sha256 manifests (`node scripts/golden-manifest.mjs verify ...`). Never run Vitest with `-u` or Playwright with `--update-snapshots` to make a test pass. An intentional visual change adds a new dated golden set with `node scripts/golden-manifest.mjs freeze ... --reason "..."`; the pre-refactor set is never overwritten.

## Page-weight budget

`perf/page-weight.baseline.json` records the static export's per-route HTML, JS and CSS sizes (raw and gzip) and the DOM node count of each golden state. `npm run check:weight` fails on growth beyond the baseline plus `max(1 KiB, 5%)` for bytes, or the baseline plus `max(2, 2%)` for DOM elements. Raise the budget only with `node scripts/page-weight.mjs update --reason "..."`, which keeps a written history.

## Engine boundary

`engine/` is pure TypeScript: no DOM or Node types, relative imports only. `npm run typecheck` enforces this with its own `tsconfig` and an ESLint override, and a guard test proves the rules still fire.

## Component library

`component-library/` is inherited from upstream and kept on disk; it is out of scope for the generator. `npm install` runs the `prepare` script, which compiles it into `dist/` (generated and untracked). The package name is `ccrug`, so its exports are imported as `ccrug/components`.

## Repository layout

- `app/` - the Next.js viewer (`app/numogram/`, `app/NumogramClient.tsx`, `app/components/`, `app/hooks/`, `app/lib/`).
- `app/data/` - the hand-authored base-10 data and CCRU-derived lore (to be replaced by engine output in Phase 2).
- `engine/` - the pure TypeScript numogram engine (scaffold now, filled in from Phase 2) and the frozen numeric oracle fixture.
- `tests/` - Vitest suites (oracle, manifests, page-weight, e2e normalizer).
- `e2e/` - Playwright specs, the visual-DOM normalizer and the 30 frozen DOM goldens.
- `perf/` - the page-weight baseline.
- `scripts/` - oracle capture, golden manifests, page-weight check, repository guards and the sub-path staging helper.
- `component-library/` - inherited from upstream and out of scope for this project; kept on disk unchanged.
- `.planning/` - project, requirements, roadmap, research and per-phase plans.
- `CLAUDE.md` - notes for AI-assisted sessions (project rules and how to resume).
- `reference/` - local-only reference material; gitignored and not part of the repository.

## Licensing and credits

- New original code (the engine, layout, naming, export, tests and scripts written for this project) is **MIT**: see [`LICENSE`](LICENSE). [`NOTICE`](NOTICE) is authoritative on which files fall under which terms.
- The viewer inherited from **lumpenspace/ccru** is not relicensed by this project (upstream ships no license), and the base-10 lore text (zone and gate names and descriptions in `app/data/`) is third-party material derived from the CCRU writings and is excluded from the MIT grant; both are listed in `NOTICE`.

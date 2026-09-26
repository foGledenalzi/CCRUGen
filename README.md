# CCRUG - Arbitrary-Base Numogram Generator

A tool for **constructing and visualizing numograms in any even base**: base 2 up to however high the measured processing ceiling allows (base 32, 64, 666 and beyond), instead of only the canonical base-10 diagram. It is a static web app backed by a pure TypeScript engine.

Pick a base and CCRUG derives the zones, syzygies, currents, gates, the Plex / Warp / Torque regions and the demon set, draws the result as SVG, and lets you name the demons and export the diagram. Base 10 is the reference preset: the engine must reproduce it exactly.

Based on lumpenspace/ccru (https://github.com/lumpenspace/ccru). The upstream repository ships no license, so the files inherited from it are not relicensed here, and the CCRU-derived base-10 lore text is a third-party pack (see [Licensing](#licensing-and-credits)).

> **Status: early development.** The repository still runs the inherited base-10 viewer. The generator is being built phase by phase (see the [roadmap](#roadmap)); Phase 1 is planned but not yet executed.

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
| 1. Foundations and Safety Net | Static-export toolchain, the base-10 viewer frozen as a test oracle, enforced engine boundary, licensing | Planned (8 plans) |
| 2. Engine Core and Base-10 Migration | Pure tested engine for any even base; the base-10 viewer re-derived from it | Not started |
| 3. Procedural Layout and Ceiling Spike | Legible layouts for any base and a measured renderer threshold table | Not started |
| 4. Base Picker and Generator UI | Interactive viewer for any even base, URL state, accessibility | Not started |
| 5. Demons Layer | Browse, count and inspect every demon at any base | Not started |
| 6. Canvas Tier and Worker | Large bases stay interactive; graceful degradation | Not started |
| 7. Naming Builder | Zone sounds, derived demon names, JSON import / export | Not started |
| 8. Export, CLI and Hardening | SVG / PNG / JSON export, headless CLI, cross-platform CI | Not started |

## Running locally

Requires Node 22 and npm (this project does not use yarn).

```bash
npm install --ignore-scripts
npm run dev
```

Then open `http://localhost:3000/numogram`. The `--ignore-scripts` flag is temporary: until Phase 1 lands, the `prepare` script rebuilds a tracked `dist/` folder on every install.

## Repository layout (current)

- `app/` - the Next.js viewer (`app/numogram/`, `app/NumogramClient.tsx`, `app/components/`, `app/hooks/`, `app/lib/`).
- `app/data/` - the hand-authored base-10 data and CCRU-derived lore (to be replaced by engine output in Phase 2).
- `component-library/` - inherited from upstream and out of scope for this project; kept on disk unchanged.
- `.planning/` - project, requirements, roadmap, research and per-phase plans.
- `CLAUDE.md` - notes for AI-assisted sessions (project rules and how to resume).
- `reference/` - local-only reference material; gitignored and not part of the repository.

## Licensing and credits

- New original code (the engine, layout, naming, export, tests and scripts written for this project) is intended to be **MIT**. The `LICENSE` and `NOTICE` files land in Phase 1; until then, treat the repository as not yet licensed.
- The viewer inherited from **lumpenspace/ccru** is not relicensed by this project, and the base-10 lore text (zone and gate names and descriptions) is third-party material derived from the CCRU writings and is excluded from the MIT grant.

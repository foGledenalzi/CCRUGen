# Phase 2: Engine Core and Base-10 Migration - Context

**Gathered:** 2026-09-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a pure, tested engine (`engine/`) that derives the correct numogram for any even base up to the safe ceiling 2^26, then re-derive the base-10 viewer's syzygies, currents, gates, demons and regions from that engine, joined with the CCRU lore by id. The viewer must show no visible change: the 60 DOM goldens stay byte-identical and layouts, hover, undo and share links behave exactly as before.

In scope: ENG-01..ENG-05 and MIG-01 (ROADMAP Phase 2 success criteria 1-5). Out of scope, belongs elsewhere: procedural layouts and the ceiling spike (Phase 3), base picker, labels UI and removal of the hard-coded 10-zone logic in components (Phase 4, MIG-02), demon browser (Phase 5), canvas tier and worker (Phase 6), naming builder (Phase 7), export and CLI (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Migration shape (how the viewer consumes the engine)
- **D-01:** **Adapter, components untouched.** A base-10 adapter under `app/presets/base10/` rebuilds today's exact shapes (`SyzygyData`, `CurrentData`, `GateData`, `Demon`, `Region`) from engine output plus lore. `NumogramClient.tsx`, the components and `app/components/projection/**` are not edited (only the data seam where they import `app/data/*` may change). Phase 4 replaces the adapter when components become engine-driven.
- **D-02:** **One data source at a time**, each swap its own commit: syzygies, then currents, gates, regions/zones, demons. The full gate (60 DOM goldens, numeric oracle, static-export specs, `npm run verify`) must be green after each swap before the old hand-authored data for that source is deleted.
- **D-03:** **Hard-coded 10-zone logic in components stays for Phase 4** (partner = `9 - z`, the Torque zone set, `ZONE_REGION`, about 29 sites outside `app/data`): that is MIG-02 (Phase 4's CI grep gate). Phase 2 changes only the data seam and the new adapter.

### Numerals (display in the numogram's own base)
- **D-04:** Gate names (`Gt-NN`), mesh numbers, net-spans and demon indexes are **written in the numogram's own base**. Example, base 12: the gate for zone 11 is T(11) = 66 decimal, written `Gt-56` (5+6 = 11 = zone b); net-span reads `b::3`. Identical at base 10, so the viewer does not change. Numeric ids stay canonical in JSON, URLs and the engine's data.
- **D-05:** **The numeral formatter is built now, in `engine/`** (value to string in a base, plus its inverse for parsing): digits 0-9 then a-z up to base 36, and a defined separated-groups scheme beyond 36 (exact scheme decided in research; it must be pure, reversible and tested). The base-10 adapter's `Gt-NN` names use it, so the rule is exercised from day one. Phase 4 only consumes it (zone labels beyond base 36).

### Lore and the old data files
- **D-06:** **One lore file**, `app/presets/base10/lore.ts`, text unchanged (CCRU-derived, third-party, excluded from MIT), keyed by numeric ids (zone, pair id, gate origin, mesh number). It replaces the five lore files `app/data/{zones,syzygies,currents,gates,demons}.ts`. NOTICE section 3 and the licence header comment are updated to name the single file. A test proves every engine base-10 id has lore and no lore entry is orphaned.
- **D-07:** The lore file is a **typed TypeScript module** (not JSON), with the licence-marking header comment.
- **D-08:** **Old hand-authored structure is deleted after each swap** (from/to/cum/label/kind, the Torque zone set, the `ALL_DEMONS` import-time builder). The frozen numeric oracle (`base10.golden.json`) and the DOM goldens guard the values; no `tests/legacy` copies. `app/data/positions.ts` (hand-drawn layouts, the base-10 preset for Phase 3) and `app/data/types.ts` stay where they are for now. `zones.ts` mixes lore (`ZoneMeta`) with structure (regions): separate them, lore moves, structure is derived.

### Engine verification (correctness is the core value)
- **D-09:** **Tiered independent cross-check.** A slow, obviously-correct reference module written straight from the definitions (not from the engine's formulas, and not from `reference/`) checks: full enumeration including every demon for every even n up to 300; structural brute force (zones, pairs, currents, gates, cycles, per-type counts) for every even n up to 2000, matching the roadmap sweep; closed-form and spot-unranking checks beyond that.
- **D-10:** **Fixed seeds, deterministic.** Property tests (fast-check) use fixed seeds and run counts written in the test, so every run checks the same cases and failures reproduce. Larger random even bases are sampled from a fixed seed.
- **D-11:** **The Base 2^26 test runs in `npm run verify` with an explicit time and memory ceiling.** If measurement shows it too heavy for the CI runners it moves to an opt-in `test:heavy` script and the decision is recorded.

### Engine API and behaviour
- **D-12:** **Invalid bases throw `RangeError`** with a message that says why (odd, zero, negative, non-integer, NaN, Infinity, above 2^26), and a pure `validateBase(n)` returns the reason without throwing (for the Phase 4 base picker to show inline).
- **D-13:** **Public API is `createNumogram(base)`**: one immutable object with read-only fields and methods (zones, pairs, currents, gates, cycles, and a lazy `demons` space with `at(mesh)`, `ref(a, b)`, `counts()` and the other operations sketched in `ARCHITECTURE.md`), cached per base with a bounded cache so huge bases do not pile up.
- **D-14:** **Eager typed arrays, O(n) memory** for the cycle decomposition and per-zone lookups at every base up to 2^26 (a few hundred MB and roughly a second or two at the cap; every later query O(1)). Only the demon space is virtual (mesh-number index math), as the roadmap requires. No O(n^2) structure is ever built.

### Locked earlier (carried forward, not re-discussed)
- Regions are `Cycle[]` in canonical order (length descending, then smallest zone id; each cycle rotated to its smallest pair); never assume a single Torque. Torque identity is a numeric index, letters as display up to 26, then numbers. Units are always stated as pairs vs zones.
- Cross-Torque chronodemon is an explicit subtype (`cyclic` = same-Torque only). Type/subtype counts are closed-form (base 10: 12 cyclic + 3 syzygetic chrono, 12 Plex + 12 Warp amphi, 4 chaotic + 2 syzygetic xeno = 45). Numodemons number n/2 - 1.
- The engine emits all n gates including Gate 0 to 0; the renderer decides once whether to draw it. The base-10 viewer keeps drawing what it draws today.
- Safe ceiling 2^26 (mesh arithmetic stays below 2^53, no BigInt path); larger bases are refused.
- The base-10 viewer's own `kind` classification (a separate `syzygy` kind of 5 demons alongside `chrono`, `amphi`, `xeno`) must be reproduced by the adapter from the engine's subtypes: syzygy kind = the 3 syzygetic chrono + 2 syzygetic xeno (a + b = 9).
- Fixtures and the reference are derived from definitions, never from `reference/` and never regenerated with `vitest -u`; the source guide's errors (47-vs-45 subtype sum, "only 3^N+1 bases have several Torques") are not inherited.
- Engine purity (Phase 1): no DOM or Node types, relative imports only, nothing may import from outside `engine/` (enforced by tsc and ESLint).

### Verification gap found while planning (Claude's addition, consistent with D-02)
- **D-15:** The 60 DOM goldens capture only the projection `<svg>`, so they do NOT cover the lore text that the info panels, hover popovers and Selection panel show, which is exactly what this migration moves (a wrong lore key would pass every golden). MIG-01's "no visible change, hover/undo/share behave exactly as before" therefore also needs a **frozen behaviour and text baseline** of the viewer (interactive elements, panel text, hover popovers, Selection-panel detail text, URL state after each action, undo/redo, for the 4 layouts), captured from the current viewer BEFORE the first data-source swap and compared after every swap (D-02). Seed: `.planning/phases/02-engine-core-and-base-10-migration/seed/inventory.mjs` (deterministic; two runs on an unchanged app gave identical output; about 177 behaviour rows and 682 region texts). It must be turned into a committed, parametrized, frozen check (manifest-protected like the other oracles, never regenerated to make a test pass).
- **D-16:** `scripts/check-repo.mjs` (its lore and NOTICE checks) and `tests/repo/check-repo.test.ts` currently name the five `app/data/*` lore files and their header line; the lore consolidation (D-06) must update the guard, its tests, NOTICE section 3 and the header in the same change, or `npm run verify` goes red.

### Claude's Discretion
Module layout inside `engine/`, exact type and field names beyond the architecture sketch, typed-array layouts, wording of error messages, the cache policy, the exact beyond-36 numeral scheme (subject to D-05), adapter internals, how tests are organised, the order of adapter lists (must preserve today's panel order exactly), and the plan/wave breakdown (engine core first with golden tests complete before any data source is swapped; gate/current routing extracted verbatim first, generalized later).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (section "Phase 2: Engine Core and Base-10 Migration") - goal, five success criteria, sequencing notes
- `.planning/REQUIREMENTS.md` - ENG-01..ENG-05 and MIG-01 (this phase); MIG-02 is Phase 4
- `.planning/PROJECT.md` - core value, verified numogram math, key decisions, out-of-scope list
- `CLAUDE.md` - project rules (correctness in own base, frozen oracle, engine purity, no upstream branding)

### Design and pitfalls
- `.planning/research/ARCHITECTURE.md` - engine structure, `Numogram` and `DemonSpace` data model, closed-form type counts, unranking, migration plan ("strangler with the base-10 golden as the net")
- `.planning/research/PITFALLS.md` - read before touching numogram math or the base-10 data
- `.planning/research/SUMMARY.md`, `.planning/research/STACK.md` - pinned stack and build order
- `.planning/codebase/CONCERNS.md` - inventory of base-10 hard-coding in the viewer

### Frozen oracle and guards (Phase 1)
- `.planning/phases/01-foundations-and-safety-net/01-CONTEXT.md` - locked decisions D-01..D-17 (oracle, licensing, static export)
- `engine/test/fixtures/base10.golden.json` and its `MANIFEST.json` - frozen numeric oracle; never regenerated
- `e2e/__golden__/**` and its `MANIFEST.json` - 30 frozen DOM goldens (x2 timezones = 60 comparisons)
- `tests/oracle/deriveBase10.ts`, `tests/oracle/base10.oracle.test.ts` - the definition-based derivation used at capture and its test
- `engine/test/guard.test.ts`, `.eslintrc.json`, `engine/tsconfig.json` - the engine purity boundary the new code must satisfy
- `NOTICE`, `LICENSE` - lore consolidation (D-06) must update NOTICE section 3 and the file header

### Current base-10 data and its consumers
- `app/data/{zones,syzygies,currents,gates,demons}.ts`, `app/data/types.ts`, `app/data/positions.ts` - what gets replaced (lore and structure) or kept (positions, types)
- `.planning/notes/2026-09-25-ui-declutter-inventory.md` - before/after inventory technique and the current shell behaviours that must not change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/` scaffold from Phase 1 (`index.ts`, `package.json`, `tsconfig.json`, `tsconfig.test.json`, `test/guard.test.ts`, `test/tz.test.ts`): the boundary is already enforced by tsc and ESLint.
- `tests/oracle/deriveBase10.ts`: a definition-based derivation of the base-10 facts; a model for the independent brute-force reference (which must stay independent of the engine).
- fast-check 4.10.2, Vitest 5 with the `CCRUG_TZ` pin, the golden-manifest and check-repo guards, and the Playwright golden suites (60 comparisons) are all in place.
- `app/lib/xenotation.ts` is base-agnostic (a helper the later phases reuse).

### Established Patterns
- Engine files use relative imports only and no DOM/Node types; anything that imports outside `engine/` fails lint.
- The DOM goldens capture only the projection `<svg>` (class and style attributes included), so the data seam can change freely as long as output is byte-identical.
- Frozen fixtures are never edited; changes to expected values are a defect in the code.

### Integration Points
- `app/data/*` is imported from about 30 sites: `types` (17), `zones` (8), `syzygies` (4), `gates` (4), `positions` (3), `demons` (2), `currents` (2). The new adapter under `app/presets/base10/` becomes the single seam; the current import sites are redirected there one data source at a time (D-02).
- The viewer's `kind` for demons and its single-Torque `Region` type (`'torque' | 'warp' | 'plex'`) are adapter outputs derived from `Cycle[]` and subtypes.
- Gate/current labels use specific characters (for example the minus sign U+2212 in `8−1=7`); the adapter must reproduce them exactly.

</code_context>

<specifics>
## Specific Ideas

- The own-base gate name works as an invariant: `Gt-56` in base 12 reads 5+6 = 11, so the name itself shows the in-base digital root. Use this kind of example in the tests for D-04/D-05.
- Independence is the point of D-09: if the reference and the engine share a formula, they can share a bug.

</specifics>

<deferred>
## Deferred Ideas

- Removing the hard-coded 10-zone constants from components and making components read the engine model: Phase 4 (MIG-02).
- Moving `app/data/positions.ts` (hand-drawn layouts) under `app/presets/base10/`: with the Phase 3 layout work.
- Name search over all demons (needs n^2 names) limited to about 50k demons via a worker index: Phase 5/6.
- Real numeral labels beyond base 36 in the UI, zone label options: Phase 4 (uses the formatter built here).

### Reviewed Todos (not folded)
None matched Phase 2. Pending todos 002 (deferred Phase 1 review findings) and 003 (dropped row clicks and mobile overlap) belong to hardening and Phase 4.

</deferred>

---

*Phase: 02-engine-core-and-base-10-migration*
*Context gathered: 2026-09-26*

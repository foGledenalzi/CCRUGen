# Phase 2: Engine Core and Base-10 Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-26
**Phase:** 2 - Engine Core and Base-10 Migration
**Areas discussed:** Migration shape, Numerals in own base, Lore + old data files, Engine verification depth, plus a second round on the engine as a library (errors, API, huge-base storage)

Gray areas offered: the four above (all selected). Todo cross-reference: none matched.

---

## Migration shape

**Q: How should the base-10 viewer consume the engine in Phase 2?**

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter, components untouched (Recommended) | Small base-10 adapter rebuilds today's exact shapes from engine + lore; components and projection svg not edited; lowest risk for the goldens | ✓ |
| Components read the engine model | Rewrite ~30 import sites to take the engine's Numogram directly now; less rework later, risk lands in Phase 2 | |

**Q: In what steps do the data sources switch over?**

| Option | Description | Selected |
|--------|-------------|----------|
| One source at a time (Recommended) | Syzygies, currents, gates, regions/zones, demons; each its own commit with the full gate green before the old data is deleted | ✓ |
| All at once | Single change, gate run once | |

**Q: How much of the hard-coded 10-zone logic in components (about 29 sites) may Phase 2 touch?**

| Option | Description | Selected |
|--------|-------------|----------|
| Leave for Phase 4 (Recommended) | Phase 2 swaps data sources only; MIG-02 is Phase 4's CI grep gate | ✓ |
| Clean up the trivial ones now | Replace obvious constants where a one-liner | |

---

## Numerals in own base

**Q: For bases other than 10, how are gate names (Gt-NN), mesh numbers and net-spans written?**

| Option | Description | Selected |
|--------|-------------|----------|
| In the numogram's own base (Recommended) | Base 12: Gt-56 for zone 11 (T(11)=66), net-span b::3; identical at base 10; numeric ids canonical | ✓ |
| Always decimal | Gt-66 in base 12; loses the visible in-base digit-sum relation | |

**Q: Does Phase 2 build the numeral formatter or leave it to Phase 4?**

| Option | Description | Selected |
|--------|-------------|----------|
| Build it now in engine/ (Recommended) | Pure tested function: 0-9a-z to base 36, separated-groups scheme beyond; adapter names use it | ✓ |
| Phase 4 builds it | Engine stays numbers-only; base-10 names hard-written | |

---

## Lore + old data files

**Q: What is the end state of the CCRU-derived lore?**

| Option | Description | Selected |
|--------|-------------|----------|
| One file, keyed by numeric ids (Recommended) | app/presets/base10/lore.ts; NOTICE names one file; coverage test | ✓ |
| Keep the five files, re-keyed | Five lore files moved under presets/base10 | |

**Q: What format is the lore file?**

| Option | Description | Selected |
|--------|-------------|----------|
| Typed TypeScript module (Recommended) | Compile-time types, plain import, header comment | ✓ |
| JSON data file | Text separated from code; typing glue needed | |

**Q: What happens to the old hand-authored structure once each source is swapped?**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete after each swap (Recommended) | Frozen numeric oracle and DOM goldens already guard the values | ✓ |
| Keep as tests/legacy | Second independent cross-check kept forever; drifts from the oracle | |

---

## Engine verification depth

**Q: How deep should the independent brute-force cross-check go?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered (Recommended) | Full enumeration incl. demons every even n <= 300; structural brute force every even n <= 2000; closed-form and spot unranking beyond | ✓ |
| Everything to 2000 | Enumerate all C(n,2) demons for every even n <= 2000 (about 650 million; a minute or more per run) | |
| Lighter | Brute force only to about n=100 plus the structural sweep | |

**Q: How are property tests seeded?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed seeds, deterministic (Recommended) | Same cases every run, reproducible failures | ✓ |
| Random each run | More coverage over time; unreproducible reds unless the seed is replayed | |

**Q: Where does the Base 2^26 test run?**

| Option | Description | Selected |
|--------|-------------|----------|
| In verify with a budget (Recommended) | Explicit time and memory ceiling; moves to opt-in test:heavy if too heavy for CI | ✓ |
| Opt-in heavy script | Not part of verify or CI | |

---

## Second round: the engine as a library (user chose "Explore more gray areas")

**Q: What does the engine do with an invalid base?**

| Option | Description | Selected |
|--------|-------------|----------|
| Throw RangeError, plus a checker (Recommended) | createNumogram(n) throws with the reason; pure validateBase(n) returns the reason | ✓ |
| Return a result object | { ok, value } or { ok: false, reason } everywhere | |

**Q: What shape is the public API?**

| Option | Description | Selected |
|--------|-------------|----------|
| createNumogram(base) object (Recommended) | One immutable object with fields and methods, lazy demon space, cached per base | ✓ |
| Stateless functions | pairsOf(n), gateOf(n, z), ...; nothing retained | |

**Q: How are cycles stored at very large bases?**

| Option | Description | Selected |
|--------|-------------|----------|
| Eager typed arrays, O(n) (Recommended) | One O(n) pass, a few hundred MB at 2^26; later queries O(1) | ✓ |
| Lazy per query | Nothing built up front; region queries can cost O(cycle length) | |

---

## Claude's Discretion

Module layout inside engine/, type and field names beyond the architecture sketch, typed-array layouts, error-message wording, cache policy, the exact beyond-36 numeral scheme, adapter internals, test organisation, adapter list order (must match today's panel order), and the plan/wave breakdown.

## Deferred Ideas

Removing hard-coded 10-zone constants and engine-driven components (Phase 4, MIG-02); moving positions.ts under presets/base10 (Phase 3); name search over all demons (Phase 5/6); numeral labels beyond base 36 in the UI (Phase 4).

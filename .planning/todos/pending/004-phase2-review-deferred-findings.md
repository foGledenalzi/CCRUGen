---
title: "Phase 2 code review: findings deferred (not fixed in Phase 2)"
status: pending
priority: P3
source: "02-REVIEW.md (2026-09-27)"
created: 2026-09-27
theme: hardening
---

## Goal

Track the Phase 2 review findings that were consciously not fixed before closing Phase 2. Detail, failure scenarios and suggested fixes are in `.planning/phases/02-engine-core-and-base-10-migration/02-REVIEW.md`. Fixed before close: WR-01, IN-01, IN-04, IN-06, IN-08, IN-09, IN-10.

## Deferred, with where each belongs

- **IN-02** (`engine/core/unrank.ts`): `at(k)` of the `cyclic-chrono` and `cross-torque-chrono` selectors costs 2 to 3 s per call at base 2^26 (about 0.17 s at 2^22), because the first call builds a 128 MiB sorted copy of the Torque pairs that is not counted in `storageBytes` or the cache budget. It only matters for a demon browser at very large bases with many Torque cycles. Belongs to Phase 5 (Demons Layer): page those two selectors by group or add per-cycle prefix sums, and count the sorted copy in the budget.
- **IN-03** (`engine/core/numogram.ts`): `cycleAt(id)` returns a new frozen view per call until `cycles` has been read, then shared ones, so identity depends on call history. Harmless (views compare by id); decide in Phase 3/4 when the layout consumes cycles.
- **IN-05** (`engine/core/numogram.ts`): `numogramInternals` and its WeakMap are exported for engine siblings and tests only. Revisit if it stays unused outside tests.
- **IN-07** (`e2e/behaviour.spec.ts`): all behaviour tests silently skip (exit 0) if the Playwright project `chromium-utc` is renamed. Add a guard that fails when zero behaviour tests ran, next time the Playwright config is touched.
- **MIG-02** stays a Phase 4 requirement (remove the hard-coded 10-zone logic in components); the five thin pass-through files `app/data/*.ts` and the `app/lib/constants.ts` seam remain until then. `legacyCurrentFrom` keeps upstream's drawing convention so the SVG stays byte-identical; Phase 4 replaces it.

## Acceptance Criteria

- [ ] Each item above is fixed, or explicitly dropped with a reason, before the phase that names it closes

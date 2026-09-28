---
phase: 03-procedural-layout-and-ceiling-spike
plan: 10
subsystem: rendering
tags: [ceiling-spike, tier-table, ren-01, d09, d11, d12, d13, d14, measurement]

# Dependency graph
requires:
  - phase: 03-procedural-layout-and-ceiling-spike
    provides: "03-02: the tier-table schema, deriveBoundaries and validateTierTable (engine/scene/tiers.ts); 03-09: the Playwright/CDP driver and harness that produced the raw .spike/raw/*.jsonl records this plan shapes"
provides:
  - "scripts/spike/shape.ts: pure parseJsonl/shapeTierTable turning raw spike records + env metadata into a validator-clean, measured TierTable with boundaries always computed via the engine's own deriveBoundaries"
  - "scripts/spike/write-table.ts: CLI that reads .spike/raw/*, shapes it against the current committed table as 'previous', and writes engine/scene/tier-table.json only when validateTierTable is clean, plus a readable .spike/report.txt"
  - "engine/scene/tier-table.json: the measured threshold table (status 'measured', shippedProfile 'sw-6x') that is the exit gate for Phases 4, 5 and 6"
affects: [04, 05, 06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shaping is pure and file-I/O-free (shapeTierTable takes records/envs/headless/previous as plain data and returns a TierTable); only write-table.ts touches the filesystem, and only after validateTierTable(table) === []"
    - "Boundaries are never hand-set: shape.ts always calls the engine's own deriveBoundaries and copies its output into the table, so the validator's measured-status equality check (boundaries === deriveBoundaries(rows)) can never drift from the derivation rule"
    - "Schema tests must stay data-independent: a test written against one table's specific row count/shape (the interim placeholder's 22 sw-6x-only rows) is a latent coupling bug that surfaces the moment real multi-profile data lands; the fix generalizes the assertion to the schema's actual invariant (every profile has rows for every measured suite) rather than a snapshot of one dataset"

key-files:
  created:
    - scripts/spike/shape.ts
    - scripts/spike/write-table.ts
    - tests/spike/shape.test.ts
  modified:
    - engine/scene/tier-table.json
    - engine/test/tiers.schema.test.ts

key-decisions:
  - "Rule 1 (auto-fixed bug, commit b0b62e6): engine/test/tiers.schema.test.ts's 'is stored as sw-6x-only rows: 22 measurements total' assertion was written for the interim placeholder table's specific shape and fails against any real measured table (which spans all four profiles). Replaced with a data-independent check that every device profile has rows for every measured suite, matching the test file's own stated data-independent intent; one mutation-test case also needed its placeholder flag reset now that the base table it clones is measured, not placeholder. No other schema assertion changed."
  - "User approved the measured table as-is in chat review (equivalent to typing 'approved' per the plan's resume-signal): no budget changes requested (mount 500ms, interaction 100ms, pan 32ms, tween 32ms, one-time paint 500ms, canvasTargetN 4000 all stand as shipped), no re-measurement requested. No fix(03-10) follow-up commit was needed."

# Metrics
duration: 153min
completed: 2026-09-28
---

# Phase 3 Plan 10: Measured Renderer Threshold Table Summary

**The ceiling spike run for real on this PC in four device profiles (native GPU, software raster, and 4x/6x CPU-throttled software raster), shaped into the committed `engine/scene/tier-table.json` and approved by the user as the exit gate for Phases 4-6.**

## Performance

- **Duration:** ~153 min (Task 1 pure shaper + CLI + tests ~modest; Task 2 four real Playwright device-profile runs, shaping, full `npm run verify` ~2h23m between commits; Task 3 checkpoint, chat review and this bookkeeping resumption ~10min)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 5 (`scripts/spike/shape.ts`, `scripts/spike/write-table.ts`, `tests/spike/shape.test.ts`, `engine/scene/tier-table.json`, `engine/test/tiers.schema.test.ts`)

## Accomplishments

- **Pure shaper + CLI** (`scripts/spike/shape.ts`, `scripts/spike/write-table.ts`): `parseJsonl`/`shapeTierTable` turn raw `.spike/raw/*.jsonl` records and `env-*.json` metadata into a validator-clean `TierTable`, deduplicating by last-record-wins per `(profile, suite, n)`, excluding `error`/`skipped` rows, and always deriving boundaries via the engine's own `deriveBoundaries` (never hand-set). 22 shaping/derivation tests on synthetic records (no browser) cover environments, dedup/error-exclusion, boundary derivation, the WebGL decision, memory medians, `canvasDimensionNote` and JSON-stringify determinism.
- **Real four-profile spike run**: gpu (native), sw (software raster), sw-4x and sw-6x (CPU-throttled, measured 4.1x/6.3x against nominal 4x/6x) on this PC (AMD Ryzen 9 3900X, 12c/24t, 68.7 GB RAM, Windows 10, Chromium 153.0.8010.12 / Playwright 1.63.0). 144 measurement rows across svg-rich/svg-lean/canvas for all four profiles, plus headless (n up to 100,000) and all-chords legibility rows.
- **Measured table committed**: `engine/scene/tier-table.json` now has `status: 'measured'`, `shippedProfile: 'sw-6x'`, environments for all four profiles with `placeholder: false`, and boundaries derived from the conservative sw-6x profile (D-14d) with native gpu/sw rows kept visible in the table for reference (D-14).
- **Contact sheet re-verified unchanged**: regenerating `npx tsx scripts/review-sheet.ts` after the table swap produced sha256 `0d9cd5c0cb3a`, 806,667 bytes — identical to plan 03-08's signed-off digest, confirming the label/gate thresholds carried over from the previous table unchanged.
- **Full phase gate green**: `MSYS_NO_PATHCONV=1 npm run verify` exit 0 on the committed tree (`b0b62e6`) — 60 DOM goldens, behaviour baseline and numeric oracle unregenerated, page-weight baseline unchanged, the spike itself absent from any npm script (`grep -n "spike" package.json` prints nothing, so CI never depends on this PC's speed).
- **User review and approval** (Task 3, D-11/D-12/D-14): the user was shown a condensed summary of `.spike/report.txt` in chat (environments, shipped boundaries all `basedOn` sw-6x, the WebGL=No decision and its reasoning, the `tier=` override, native gpu/sw rows sitting next to throttled rows for every tier) and separately asked for a tier-by-tier realistic base cap, answered from the measured data (SVG-rich ~200, SVG-lean ~300, Canvas at least 4000 with no ceiling found in the measured range, all-chords legibility ~60-80, headless tested to 100,000 with a flagged Phase-8 memory-scaling caveat, engine hard cap 2^26). The user replied "everything seems good" — approval of the measured table as-is, no budget changes, no re-measurement requested.

## Key measured numbers (shipped boundaries, all `basedOn: "sw-6x"` per D-14)

| Boundary | Value | Rule |
|---|---|---|
| `svgRichMaxN` | **200** | highest n of the longest passing prefix of sw-6x svg-rich rows with mount <= 500 ms, interaction <= 100 ms and pan <= 32 ms (medians) |
| `svgLeanMaxN` | **300** | same rule over sw-6x svg-lean rows |
| `canvasMaxN` | **null** | no ceiling found in the measured range (up to n=4000) |
| `layoutTweenMaxN` | **28** | highest n of the longest passing prefix of sw-6x tween frames with median <= 32 ms (D-09) |
| `allChordsMaxN` | **80** | last n of the longest prefix where under 30% of inked pixels are crossed by >=4 chords (legibility, not speed) |
| `canvasAreaLimitPx` | **268,435,456** (2^28) | no standalone per-dimension cap reproduced up to 65,535 px; clamp on area only |
| `labelVisibleMinRadiusPx` / `gatesFullMaxN` / `gatesThinMaxN` | 7 / 40 / 150 | carried over unchanged from the previous (03-02 interim) table |

**WebGL decision (D-12): `adopt: false`.** Reason (verbatim, from the table): "Measured 2026-09-28 on sw-6x: the Canvas tier stays within budget over every measured n up to 4000 (canvasTargetN 4000); the all-chords layer is legibility-limited at n = 80. No WebGL tier." `reviewedAt: "2026-09-28"`.

**`tier=` diagnostic override (D-13): `enabled: true`**, values `["svg", "canvas", "headless"]`.

**Memory** (gpu profile, CPU throttling does not change memory): `svgRichDomBytesPerZone` = 4,447 bytes, `svgRichJsHeapBytesPerZone` = 5,131 bytes, `canvasFixedBytes` = -106,052 (GC-noise-dominated at this sample size; the Canvas tier's own fixed overhead is small relative to heap sampling jitter).

**Headless** (Node-only, real engine): n=100,000 in layoutMs=27.8, routeMs=427.5, emitMs=487.3 (about 940 ms total, well under any interactive budget since headless is an export path, not a live render); `rssDeltaBytes` grew from 36 MB at n=10,000 to 305 MB at n=100,000 — noted as a Phase-8 memory-scaling caveat rather than a hard boundary, since headless has no interactivity budget to violate.

**Environments** (all four profiles on the same machine, so throttle ratios are directly comparable): gpu (native, throttle 1x/1x measured), sw (software raster, no throttle, 0.98x measured), sw-4x (software raster + CDP 4x throttle, 4.1x measured), sw-6x (software raster + CDP 6x throttle, 6.3x measured, shipped profile). Full CPU/GPU/OS/browser strings are recorded per profile in the table for provenance (T-03-29).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure shaper and the write-table CLI** - `74bfab4` (feat)
2. **Task 2: Full four-profile spike run, measured table, and the phase gate** - `b0b62e6` (feat) — completed by the orchestrator after the prior executor was killed by a rate limit right after confirming the contact-sheet sha matched; the orchestrator finished this commit and ran a full green `npm run verify` on the committed tree.
3. **Task 3: User review of the measured threshold table** - checkpoint, no code commit (the user approved the table as measured in Task 2; no `fix(03-10)` follow-up was needed).

**Plan metadata:** (this commit) `docs(03-10): complete measured threshold-table plan`

## Files Created/Modified

- `scripts/spike/shape.ts` - pure `parseJsonl(text)` and `shapeTierTable({ records, envs, headless, previous })`; builds environments (with `cpuThrottleMeasured` from calib ratios), measurements (deduped, sorted by profile/suite/n), chords, canvasProbes, headless rows, memory medians (gpu svg-rich rows with n>=500, gpu canvas rows), boundaries (via `deriveBoundaries`), the WebGL decision and the `tier=` override block
- `scripts/spike/write-table.ts` - CLI: reads `.spike/raw/{gpu,sw,sw-4x,sw-6x}.jsonl`, `.spike/raw/env-*.json`, `.spike/raw/headless.jsonl` and the current committed table as `previous`; shapes, validates with `validateTierTable`, writes `engine/scene/tier-table.json` only on a clean validation and always writes a human-readable `.spike/report.txt` (gitignored)
- `tests/spike/shape.test.ts` - 22 tests against synthetic four-profile records (no browser): environments/throttle ratios, dedup/error-exclusion/sort order, boundary derivation equal to `deriveBoundaries`, WebGL decision logic, memory medians, `canvasDimensionNote`, determinism, missing-environment error
- `engine/scene/tier-table.json` - the measured table: `status: 'measured'`, four full environments, 144 measurement rows, chord rows, canvas probes, 4 headless rows, derived boundaries, WebGL decision, `tier=` override
- `engine/test/tiers.schema.test.ts` - one assertion generalized from a placeholder-table-specific row count to a data-independent per-profile/per-suite coverage check (see Deviations); one mutation-test case's placeholder flag reset

## Decisions Made

See `key-decisions` in the frontmatter above (the Rule 1 schema-test fix, and the user's unconditional approval of the measured table with no budget changes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tiers.schema.test.ts` pinned the interim placeholder table's specific row shape**

- **Found during:** Task 2, after writing the real measured table
- **Issue:** The schema test's "is stored as sw-6x-only rows: 22 measurements total" assertion was written against the 03-02 interim placeholder table (22 sw-6x-only rows) and genuinely fails against any real measured table, which spans all four device profiles by design (144 rows here) — this is exactly what a measured table is supposed to look like, so the test's coupling to one dataset's shape was the bug, not the new data.
- **Fix:** Replaced the row-count assertion with a data-independent check that every device profile (`gpu`, `sw`, `sw-4x`, `sw-6x`) has measurement rows for every measured suite (`svg-rich`, `svg-lean`, `canvas`) — matching the test file's own stated intent (data-independent, PC-speed-independent) rather than a snapshot of the placeholder dataset. One mutation-test case that clones the base table also needed its `placeholder` flag reset explicitly now that the base table it clones is measured, not placeholder.
- **Files modified:** `engine/test/tiers.schema.test.ts`
- **Verification:** `npx cross-env CCRUG_TZ=UTC vitest run engine/test/tiers.schema.test.ts` green in both timezones; full `npm run verify` green on the committed tree.
- **Commit:** `b0b62e6`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix restored the schema test to its own stated data-independent purpose; no scope creep, no change to the derivation rules, boundaries or validator invariants.

## Checkpoint: User Review (Task 3, D-11/D-12/D-14)

- **What was shown:** A condensed summary of `.spike/report.txt` directly in chat — environments for all four profiles, the shipped boundaries (all `basedOn: "sw-6x"`), the WebGL=No decision with its numeric reasoning, the `tier=` override, and confirmation that native gpu/sw rows sit next to the throttled rows for every tier (satisfying the user's earlier request to see the full table, not just the shipped profile).
- **Follow-up question asked by the user:** "so what is our realistic base cap?" — answered tier-by-tier from the measured data: SVG-rich ~200, SVG-lean ~300, Canvas at least 4000 with no ceiling found in the measured range, all-chords legibility ~60-80, headless tested to 100,000 with a flagged Phase-8 memory-scaling caveat, engine hard cap 2^26 (unrelated to rendering, from the Phase 2 engine).
- **User response:** "everything seems good" — treated as the plan's resume-signal equivalent of "approved". No budget changes requested (mount 500ms, interaction 100ms, pan 32ms, tween 32ms, one-time paint 500ms, canvasTargetN 4000 all stand as shipped). No re-measurement requested.
- **Result:** `engine/scene/tier-table.json` remains committed at `b0b62e6` with `status: 'measured'` and `validateTierTable` returning no problems (confirmed by re-checking the schema test below). Nothing changed after Task 2, so `npm run verify` was not rerun — the orchestrator's green run on this exact committed tree at `b0b62e6` is reused rather than repeated.

## Issues Encountered

- The Task 2 executor was killed by a rate limit immediately after confirming the contact-sheet sha matched the 03-08 signed-off digest. The orchestrator resumed and finished commit `b0b62e6` plus a full green `npm run verify` on the same committed tree, so no work was lost or redone.

## User Setup Required

None — no external service configuration required. The spike ran entirely on this PC's existing Playwright/Chromium install.

## Next Phase Readiness

- `engine/scene/tier-table.json` is the measured, user-approved exit gate for Phases 4 (SVG tier limits, tween cutoff), 5 (all-chords legibility, gate density thresholds) and 6 (Canvas tier scope, WebGL contingency = No, so Phase 6 builds Canvas + worker only, no WebGL tier).
- REN-01 is fully covered by this plan (its third and final covering plan after 03-02 and 03-09) and is marked Complete in `REQUIREMENTS.md`.
- This was the last plan in Phase 3 (10/10). Phase 3 execution is complete; phase-level verification (`/gsd-verify-work 3`) and the phase-list completion tick are the orchestrator's next step, not this plan's own bookkeeping.
- `.spike/` (raw records, `.spike/report.txt`) stays gitignored and untracked, as designed — the committed table is the only durable artifact.

## Self-Check: PASSED

- FOUND: `scripts/spike/shape.ts`
- FOUND: `scripts/spike/write-table.ts`
- FOUND: `tests/spike/shape.test.ts`
- FOUND: `engine/scene/tier-table.json` contains `"status": "measured"`
- FOUND: `engine/test/tiers.schema.test.ts` (generalized assertion)
- FOUND commit `74bfab4` (Task 1)
- FOUND commit `b0b62e6` (Task 2)
- FOUND: working tree clean at HEAD `b0b62e6` prior to this plan's bookkeeping commit
- FOUND: `grep -n "spike" package.json` prints nothing (spike excluded from all npm scripts)

---
*Phase: 03-procedural-layout-and-ceiling-spike*
*Completed: 2026-09-28*

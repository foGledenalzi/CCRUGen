---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 01-08-PLAN.md Tasks 1-2 (Task 3 licensing confirmation pending user confirmation)
last_updated: "2026-09-26T04:29:39.593Z"
last_activity: 2026-09-26
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-25)

**Core value:** For any even base n, derive the numogram correctly (base-10 must reproduce the canonical numogram exactly) and draw it legibly.
**Current focus:** Phase 1 — Foundations and Safety Net

## Current Position

Phase: 1 (Foundations and Safety Net) — EXECUTED, verification pending
Plan: 8 of 8
Status: Executed, verification pending (01-08 Task 3, the LICENSE holder / NOTICE scope confirmation, is pending user confirmation)
Last activity: 2026-09-26

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 1 P01 | 6min | 3 tasks | 13 files |
| Phase 1 P02 | 3min | 2 tasks | 2 files |
| Phase 1 P03 | 5min | 2 tasks | 5 files |
| Phase 1 P04 | 14min | 2 tasks | 36 files |
| Phase 1 P05 | 7min | 3 tasks | 24 files |
| Phase 1 P06 | 8min | 3 tasks | 5 files |
| Phase 1 P07 | 12min | 2 tasks | 8 files |
| Phase 1 P08 | 9min | 2 tasks | 63 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8 phases (standard granularity); research merges 2+3, 4+5, 10+11 applied; Next 16 upgrade phase dropped
- [Roadmap]: Next.js pinned at 14.2.35 for all of v1; UPG-01 is v2
- [Roadmap]: Explicit cross-Torque chronodemon subtype (ENG-03); text view, region legend and pair-graph view are v1
- [Roadmap]: Poster export is v2; EXP-01..04 are plain SVG/PNG/JSON plus CLI
- [Roadmap]: Gate 0->0 draw/omit policy and Torque ordering/naming are frozen in Phase 2
- [Phase 1 P01]: TZ pinned by runtime process.env.TZ assignment in vitest.config.mts from CCRUG_TZ (process-start TZ= is ignored by Node on Windows); tz.test.ts is the canary
- [Phase 1 P01]: golden-manifest resolves paths against the repo root, stores repo-relative forward-slash paths, refuses CR files, and never overwrites a frozen file (new dated set with a written reason)
- [Phase 1 P01]: until plan 01-08, every npm install must be followed by git checkout -- dist and git checkout -- yarn.lock (prepare and npm rewrite tracked files)
- [Phase 1 P02]: engine boundary = tsc (lib ES2022, types []) plus ESLint no-restricted-syntax/globals/paths override; guard.test.ts uses lintText on a virtual engine/ path (no in-repo probe) and a temp tsconfig extending engine/tsconfig.json
- [Phase 1 P03] Numeric base-10 oracle frozen as engine/test/fixtures/base10.golden.json (sha256 in MANIFEST.json, set 2026-09-26-base10-numeric); capture script refuses to overwrite; oracle test asserts definitions (T(k), base-n digital root, current cycles, 12+3/12+12/4+2 demon split) independently of the JSON
- [Phase 1 P04] DOM oracle frozen: 30 visual-DOM goldens (original/labyrinth/ladder x 10 states) in e2e/__golden__ captured once from the untouched viewer on next dev, sha256 in e2e/__golden__/MANIFEST.json (set 2026-09-26-baseline, strictDir); capture only with GOLDEN_CAPTURE=1 (exits 1 by design), every other run is updateSnapshots none; settle signal = viewBox + __reactFiber$ + 2 rAF + 300 ms stable; aria/data/role/tabindex ignored, numbers rounded to 3 decimals
- [Phase 1 P05] Static export live: output 'export' unconditional, NEXT_PUBLIC_BASE_PATH validated sub-path, / is a client location.replace redirect keeping query+hash; 30 frozen DOM goldens pass unchanged on serve out (60/60, no golden touched); capture page-weight baseline from a root build (basePath build reports different route sizes)
- [Phase 1 P06] Page-weight budget: baseline perf/page-weight.baseline.json from a root build (/ and /numogram/ bytes raw+gzip, 30 golden DOM counts 6405 total), tolerance max(1 KiB, 5%) bytes and max(2, 2%) nodes stored in the file; raising it only via update --reason (history ledger); check reads counts from the frozen goldens, no browser
- [Phase 1] Branding scrub (user order, 2026-09-25): removed the "(c) qliphoth.systems / delight nexus" footer text, the upstream logo and Aleph0.svg (new original `public/ccrug-mark.svg`, also the favicon), the "Numogram" wordmarks (now "CCRUG"), and the whole inherited gematria plugin with its build:plugin/build:plugin-zip scripts, scripts/build-plugin-zip.mjs and the fflate dependency (this supersedes the plugin-ZIP part of 01-06). Attribution to lumpenspace/ccru in README + NOTICE is kept on purpose. Goldens unaffected (they capture only the projection svg): 60/60 + static-export 68/68 + sub-path 8/8 green.
- [Phase 1 P06] Dormant CI ci.yml (ubuntu+windows, read-only token, calls npm run verify; verify needs scripts/check-repo.mjs from 01-08 to run end to end); plugin ZIP is fflate, sha256 e1370547... identical under UTC/Tokyo/New_York, written to gitignored artifacts/
- [Phase 1 P07] LICENSE is canonical MIT (holder foGledenalzi); NOTICE is authoritative on scope: only post-fork files (plus the original CCRUG mark) are MIT, every file inherited from upstream 7c38ad9 is not relicensed, and the five app/data lore files are excluded as CCRU-derived (header comment only, oracle and manifests unchanged)
- [Phase 1 P08] check-repo guard (12 checks, --only, --clean-tree, --static-out) with failing-input tests; static-out forbids Vercel markers, api/share-image and the old upstream branding case-insensitively (user scrub order); pre-mutation run failed with 61 junk problems, post-mutation and npm run verify green (68 e2e, 60 goldens unchanged, 122 s); hygiene commit = 61 deletions (dist/ untracked and kept on disk, yarn.lock, 2 .DS_Store), remotes asserted already final, nothing pushed; Task 3 (LICENSE holder foGledenalzi and NOTICE scope) pending user confirmation

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: RESOLVED in 01-05: the static export builds (`next build` exit 0) and the client redirect is proven at the root and under `/ccrug`
- [Phase 1]: RESOLVED: Windows specifics verified (`process.env.TZ` runtime pin and canary in 01-01, Vite 8 with Vitest 5 runs green, fflate plugin ZIP sha256 identical under UTC / Asia/Tokyo / America/New_York in 01-06)
- [Phase 1]: RESOLVED in 01-07: LICENSE and NOTICE exist and the five lore files are marked CCRU-derived (prose provenance recorded, text unchanged). Still open: the user has NOT yet confirmed the LICENSE holder (`foGledenalzi`, a Claude default) or the NOTICE scope; that is the non-blocking 01-08 Task 3 checkpoint, handled by the orchestrator (pending user confirmation; 01-08 Tasks 1-2 are done and `npm run verify` is green). The remotes were already set (origin = foGledenalzi/CCRUGen, upstream push disabled); 01-08 only asserted them.
- [Phase 3]: Renderer thresholds are unmeasured (research figures conflict); Phases 4-6 wait on the spike's threshold table
- [Phase 3]: Aesthetic choices need the user: flow direction, Plex placement, default label case
- [Phase 4]: Label scheme beyond base 36 needs a decision plus font/glyph coverage tests
- [Phase 6]: Worker chunk loading in an exported site with `trailingSlash` and `basePath` is unverified
- [Phase 7]: Naming generator quality and demon-name collisions at scale need prototyping
- [Phase 8]: Safari canvas-area limit and SVG-as-image font behavior rest on secondary sources

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | CMP-01, CMP-02 two-base comparison and base atlas | Deferred | Requirements 2026-09-25 |
| v2 | EXP-05 poster-quality SVG | Deferred | Requirements 2026-09-25 |
| v2 | FLW-01 flow tracer | Deferred | Requirements 2026-09-25 |
| v2 | UPG-01 Next.js major upgrade | Deferred | Requirements 2026-09-25 |

## Session Continuity

Last session: 2026-09-26T04:29:39.585Z
Stopped at: Completed 01-08-PLAN.md Tasks 1-2 (Task 3 licensing confirmation pending user confirmation)
Resume file: None

**Planned Phase:** 1 (Foundations and Safety Net) — 8 plans — 2026-09-25T22:07:49.564Z

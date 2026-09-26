---
phase: 01-foundations-and-safety-net
plan: 07
subsystem: docs
tags: [license, mit, notice, attribution, lore-provenance, readme]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: package.json with "license": "SEE LICENSE IN LICENSE", npm scripts referenced by the README
  - phase: 01-foundations-and-safety-net (plan 03)
    provides: frozen numeric oracle and its manifest (re-verified here after the lore header edits)
  - phase: 01-foundations-and-safety-net (plan 04)
    provides: 30 frozen DOM goldens and their manifest (re-verified here)
  - phase: 01-foundations-and-safety-net (plan 05)
    provides: static export, sub-path build and legacy-query redirect that the README documents
  - phase: 01-foundations-and-safety-net (plan 06)
    provides: page-weight budget and dormant CI documented in the README
provides:
  - LICENSE (canonical MIT text, holder foGledenalzi)
  - NOTICE (authoritative license scope, lumpenspace/ccru credit, lore exclusion list, reference/ statement)
  - one-line CCRU-lore header comments on the five app/data lore files (comment only)
  - README.md completed for the CCRUG identity with build, check, oracle, budget and layout sections
affects: [01-08, phase-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "License scope lives in NOTICE, LICENSE stays the unmodified MIT text so GitHub detects it"
    - "Third-party lore is marked in place by a header comment and listed in NOTICE, never edited"

key-files:
  created:
    - LICENSE
    - NOTICE
  modified:
    - app/data/zones.ts
    - app/data/gates.ts
    - app/data/currents.ts
    - app/data/syzygies.ts
    - app/data/demons.ts
    - README.md

key-decisions:
  - "NOTICE section 2 is the conservative reading of D-01 (RESEARCH A10): every file that was at upstream commit 7c38ad9 and still exists is not relicensed, including later edits; only files created after the fork point (plus the original CCRUG mark) are MIT"
  - "Lore header comments are written with the working-tree line ending (CRLF in this checkout) so the files stay uniform; git normalizes to LF, so each file diff is exactly 1 insertion"
  - "README status wording reflects Phase 1 as executed with verification pending, as the plan directs, although plan 01-08 was still to run"

patterns-established:
  - "Any file added later that derives from upstream must be listed in NOTICE section 2; any new CCRU-derived lore file must be added to section 3 with the header comment"

requirements-completed: [FND-05]

# Metrics
duration: 12min
completed: 2026-09-26
---

# Phase 1 Plan 07: License, NOTICE, Lore Headers and CCRUG README Summary

**Canonical MIT `LICENSE` plus an authoritative `NOTICE` (upstream `lumpenspace/ccru` credited and not relicensed, five CCRU-derived lore files excluded), one-line header comments on those five files with no other byte changed, and the README completed as the CCRUG entry point with npm, static build, checks, oracle, page-weight and engine-boundary sections.**

## Performance

- **Duration:** about 12 min (2026-09-26T04:05Z to 04:17Z)
- **Tasks:** 2 (2 commits)
- **Files:** 2 created, 6 modified; no golden, fixture, `dist/`, `yarn.lock` or `.claude/launch.json` change

## Accomplishments

- **Task 1 (bc2a832), LICENSE, NOTICE, lore headers:**
  - `LICENSE` is the canonical MIT text, `Copyright (c) 2026 foGledenalzi` (D-02 default chosen by Claude; confirmed by the user on 2026-09-25 at the plan 01-08 Task 3 checkpoint (LICENSE holder `foGledenalzi`, NOTICE scope right as written)).
  - `NOTICE` has four sections: (1) original MIT code (files created after fork point `7c38ad9`: `engine/`, `tests/`, `e2e/` spec and helper code, `perf/`, `.github/`, `vitest.config.mts`, `playwright.config.ts`, `.gitattributes`, everything under `scripts/`, `app/lib/basePath.ts`, `app/components/navigation/LegacyQueryRedirect.tsx`, `public/ccrug-mark.svg` also used as `app/icon.svg`, `README.md`); (2) upstream-derived files NOT relicensed, with the `Based on lumpenspace/ccru (https://github.com/lumpenspace/ccru)` credit (every file present at `7c38ad9` and still present, notably `app/**`, `component-library/`, `tsconfig.components.json`, plus `next.config.js`, `tsconfig.json`, `package.json`, `postcss.config.js`, `tailwind.config.ts`, `.eslintrc.json`, `.gitignore`, `.claude/launch.json`; generated `dist/` follows their terms); (3) the five CCRU-derived lore files excluded from MIT (`app/data/zones.ts`, `gates.ts`, `currents.ts`, `syzygies.ts`, `demons.ts`) and the frozen fixtures/goldens for any lore text they carry; (4) `reference/` is local, untracked, never distributed.
  - Per the amended scope, `NOTICE` does not list `gematria/plugin/`, `public/*.svg` upstream assets or `scripts/build-plugin-zip.mjs` (all deleted in the branding scrub). Every path named in `NOTICE` was checked to exist. It contains none of the removed upstream branding strings.
  - Each of the five lore files now starts with `// CCRU-derived lore. Not covered by the MIT license; see NOTICE.`. `git diff --numstat HEAD~1 HEAD -- app/data` lists exactly 5 files, each `1 0`.
  - Proof that nothing observable changed: `npm run test` 6 files / 125 tests passed, `npm run test:tz` 6 files / 125 passed, both manifests verify (`OK 30 files in 1 sets`, `OK 1 files in 1 sets`).
- **Task 2 (f1e08f2), README:** the pre-written README was extended, not replaced. Kept: title, exact credit line, `The idea`, `What v1 covers`, `Roadmap`. Changed: status note (Phase 1 executed, verification pending) and Phase 1 roadmap row `Executed (verification pending)`; `Running locally` now plain `npm install` / `npm run dev` with `http://localhost:3000/numogram/`; new `Requirements` (Node >= 22.12, npm, no yarn), `Static build` (`out/`, `npm start`, `NEXT_PUBLIC_BASE_PATH`, `MSYS_NO_PATHCONV=1`, legacy `/?layout=` redirect), `Checks` table (typecheck, test, test:tz, test:e2e, test:e2e:basepath, check:repo, check:weight, verify, `npx playwright install chromium`), `Base-10 oracle` (sha256 manifests, never `-u` or `--update-snapshots`, new dated set via `freeze ... --reason`), `Page-weight budget` (`max(1 KiB, 5%)`, `max(2, 2%)`, `update --reason`), `Engine boundary`, `Component library` (`prepare` builds untracked `dist/`, import as `ccrug/components`); `Repository layout` (renamed, now with `engine/`, `tests/`, `e2e/`, `perf/`, `scripts/`); `Licensing and credits` now links `LICENSE` and `NOTICE`. Verified: no upstream domain or credit-text branding, no `demo.mov`, no `github:lumpenspace/ccru`, no plugin or gematria mention (the only `zip` hit is the word `gzip`).
  - `.claude/launch.json` already had `"runtimeExecutable": "npm"`, `"runtimeArgs": ["run", "dev", "--", "--port", "3007"]` and no `yarn`: verified and left untouched (nothing to commit).
  - Empirical check behind the README's Git Bash note: `npx cross-env NEXT_PUBLIC_BASE_PATH=/your-path node -p ...` printed `C:/Program Files/Git/your-path`; with `MSYS_NO_PATHCONV=1` it printed `/your-path`.

## Task Commits

1. **Task 1: LICENSE, NOTICE and lore header comments** - `bc2a832` (docs)
2. **Task 2: README rewrite for the CCRUG identity** - `f1e08f2` (docs)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Verification (final, exact results)

| Command | Result |
|---------|--------|
| `npm run typecheck` (tsc x4 + `next lint`) | exit 0, "No ESLint warnings or errors" |
| `npm run test` (CCRUG_TZ=UTC) | 6 files, 125 tests passed |
| `npm run test:tz` (America/New_York) | 6 files, 125 tests passed |
| `npm run build` | exit 0 (6 static pages; `/` 1.15 kB, `/numogram` 45 kB, first load 132 kB) |
| `npm run check:weight` | `page-weight: OK (2 routes, 30 golden states within tolerance)`, exit 0 (the comments are stripped from the bundle) |
| `npx playwright test e2e/golden.spec.ts` | 60 passed (44.0s), no `-u`, no `GOLDEN_CAPTURE` |
| `node scripts/golden-manifest.mjs verify e2e/__golden__/MANIFEST.json engine/test/fixtures/MANIFEST.json` | exit 0 (`OK 30 files in 1 sets`, `OK 1 files in 1 sets`), run before and after the golden spec |
| `git status --short` | clean; `git diff HEAD -- e2e/__golden__ engine/test/fixtures` empty; `dist/` and `yarn.lock` unmodified |
| listeners on 3000, 3111, 3112, 3113, 3007; `.e2e-basepath/` | none; absent |

## Files Created/Modified

- `LICENSE` - canonical MIT text
- `NOTICE` - license scope, upstream credit, lore exclusion list
- `app/data/zones.ts`, `gates.ts`, `currents.ts`, `syzygies.ts`, `demons.ts` - header comment only (+1 line each)
- `README.md` - CCRUG README (58 insertions, 10 deletions)

## Decisions Made

- NOTICE section 2 states the general rule ("every file present at `7c38ad9` and still present") and lists the notable files, so it stays correct as later phases replace inherited files; anything that stops being derived must be moved to section 1 deliberately.
- `scripts/` is described as "everything under `scripts/`" in section 1: both upstream scripts were deleted, so every remaining script is original, including `scripts/check-repo.mjs` that plan 01-08 adds.
- The CCRUG mark `public/ccrug-mark.svg` and `app/icon.svg` are listed as original MIT (per the user's scrub order), carved out of the `app/**` line.

## Deviations from Plan

**1. [Scope amendment, ordered by the user 2026-09-25] Plugin and branding references dropped**
- **Found during:** Task 1 and Task 2 (per the orchestrator's instruction and the amended plan text)
- **Change:** NOTICE lists no `gematria/plugin/`, `public/*.svg` upstream assets or `scripts/build-plugin-zip.mjs`; README component section is `## Component library` with no plugin or ZIP script mention; `no zip binary` phrase from the plan's Static build text was reworded to `no server needed`, so the README carries no ZIP wording at all.
- **Files:** `NOTICE`, `README.md`

**2. [Detail] Lore header line endings**
- **Issue:** the plan says "Keep LF endings", but the five lore files are CRLF in this working tree (checked out before `.gitattributes`, index is LF via `eol=lf`). Prepending an LF line would have left mixed endings on disk.
- **Fix:** the header is written with the file's own working-tree ending (CRLF); git normalizes to LF, so the committed blob and `git diff --numstat` (`1 0` per file) match the plan's acceptance. The plan's own verify command strips `\r` from line 1, which anticipates this.

No Rule 1-4 fixes were needed.

## Issues Encountered

- **README ahead of plan 01-08 in two places (flag for the orchestrator):** it says `npm install` (plain) and calls `dist/` untracked, and the roadmap row says `Executed (verification pending)`. Both are what this plan prescribes, but until 01-08 untracks `dist/` and adds `scripts/check-repo.mjs` they are slightly early: `npm install` still rewrites tracked `dist/` files, and `npm run check:repo` / `npm run verify` do not exist end to end yet.
- Two unrelated docs commits landed on `main` while this plan ran (`e9ac7f2`, `18e3dc3`, `923ff1d`: a todo note about stripping upstream UI clutter and the CRT overlay). They touch one note file only, no conflict with this plan.
- Cosmetic: git prints `CRLF will be replaced by LF` warnings for the five lore files (expected, the index is LF).

## User Setup Required

None. Requesting a permissive license from lumpenspace remains a user action (D-01); nothing was sent on the user's behalf.

## Next Phase Readiness

- Plan 01-08 must: untrack `dist/` and `yarn.lock`, add `scripts/check-repo.mjs` (guard: `reference/` untracked, gitattributes, LF, LICENSE/NOTICE present, tracked baseline and workflow), rename remotes without pushing, and treat the LICENSE holder as settled (`foGledenalzi`, confirmed by the user, D-02).
- Phase 2 (MIG-01) moves the five lore files into one clearly marked base-10 lore file; the header comments and the NOTICE section 3 list must move with them.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-01-18 mitigated (NOTICE authoritative: MIT only for original post-fork code, upstream files not relicensed, five lore files excluded, holder foGledenalzi), T-01-19 mitigated (only file names and the upstream URL cited, nothing from `reference/`), T-01-19b mitigated (comment-only lore edits; numeric oracle, both manifests and the 60 DOM comparisons re-verified green).

## Self-Check: PASSED

- FOUND: `LICENSE`, `NOTICE`, `README.md`, the five `app/data/*.ts` headers (line 1 exact)
- FOUND commits: `bc2a832`, `f1e08f2`
- Frozen oracle untouched: no path under `e2e/__golden__` or `engine/test/fixtures` in either commit; `dist/`, `yarn.lock`, `.claude/launch.json` unchanged

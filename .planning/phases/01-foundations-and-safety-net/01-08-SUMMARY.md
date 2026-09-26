---
phase: 01-foundations-and-safety-net
plan: 08
subsystem: infra
tags: [repo-policy, guard, git-hygiene, verify-gate, static-export, remotes]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: golden-manifest.mjs (verifyManifestFile, ROOT), package.json scripts check:repo and verify, .gitattributes
  - phase: 01-foundations-and-safety-net (plan 03, 04)
    provides: frozen numeric oracle and 30 DOM goldens with manifests (verified by the guard, never touched)
  - phase: 01-foundations-and-safety-net (plan 05, 06)
    provides: static export, sub-path e2e, page-weight budget, CI workflow (the guard asserts it exists)
  - phase: 01-foundations-and-safety-net (plan 07)
    provides: LICENSE, NOTICE, lore headers (the guard asserts them)
provides:
  - scripts/check-repo.mjs, the repository policy guard (12 checks, --only, --clean-tree, --static-out)
  - tests/repo/check-repo.test.ts, failure-path tests of every guard helper
  - a hygienic tree: dist/ untracked (still on disk), yarn.lock and both .DS_Store files deleted
  - the phase gate: npm run verify green end to end on this machine
affects: [phase-02 (every later plan runs npm run verify), ci]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Policy guard = pure exported helpers (tested with failing inputs) plus a thin runner; git only via execFileSync, local read commands only"
    - "Static-export scan forbids Vercel markers, the deleted share-image route and the old upstream branding, so the branding scrub cannot regress"

key-files:
  created:
    - scripts/check-repo.mjs
    - tests/repo/check-repo.test.ts
  modified: []
  deleted:
    - dist/ (58 files, untracked with git rm --cached, still on disk and ignored)
    - yarn.lock
    - public/.DS_Store
    - .claude/.DS_Store

key-decisions:
  - "Guard forbids the upstream branding markers case-insensitively in out/ (the upstream host name and the credit text), broader than the planned single host pattern, per the user's 2026-09-25 scrub order"
  - "The guard never runs a shell and never uses a network-touching git subcommand; a test greps its own source for both"
  - "A check that throws is reported as a failure (never a silent pass); unknown --only names and unknown flags exit 1"

patterns-established:
  - "Every new policy goes into check-repo.mjs as an exported pure helper plus a failing-input test before it is wired into a check"
  - "History is never rewritten: demo.mov stays in old commits (debt), dist/ removal is a plain index deletion"

requirements-completed: []  # intentionally empty: FND-05 / FND-01 / FND-02 are marked at phase level by the orchestrator; FND-05 also waits on the Task 3 user confirmation

# Metrics
duration: 9min
completed: 2026-09-26
---

# Phase 1 Plan 08: Repository Guard, Git Hygiene and the Verify Gate Summary

**A tested, dependency-free `check-repo` guard (reference/ never tracked, origin not upstream, junk untracked, LICENSE/NOTICE/lore headers, frozen goldens and LF, CI present, clean tree, clean static export), the dist/yarn.lock/.DS_Store hygiene commit, and a green `npm run verify` (68 e2e, 60 goldens unchanged) in 122 s. Task 3 (licensing confirmation) is pending user confirmation (Task 3 checkpoint).**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-09-26T04:19Z (approx.)
- **Completed:** 2026-09-26T04:29Z
- **Tasks:** 2 of 3 (Task 3 is the human-verify checkpoint, deliberately not run; see "Pending checkpoint")
- **Files modified:** 63 (2 created, 61 deleted)

## Accomplishments

- `scripts/check-repo.mjs` with the ten default checks (`reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow`) plus `--clean-tree` and `--static-out`, and `--only` to restrict. Every helper is exported and covered by failing-input tests (57 `expect(` lines; the `tests/repo` project is 85 tests, all green).
- Proof the guard fails: on the pre-mutation tree the full run exited 1 with 61 junk problems (see below), so a green run after the mutation is meaningful.
- The hygiene commit (61 deletions only, no history rewrite): `dist/` untracked, `yarn.lock`, `public/.DS_Store`, `.claude/.DS_Store` deleted.
- Remotes asserted (not changed): the state was already final.
- The phase gate `npm run verify` exits 0 on the committed tree.

## Task Commits

1. **Task 1: repository policy guard with tested failure paths**
   - RED: `65009b7` (test) — `tests/repo/check-repo.test.ts`; run failed with "Cannot find module '../../scripts/check-repo.mjs'" (no tests ran)
   - GREEN: `3aba310` (feat) — `scripts/check-repo.mjs`; 85/85 in `tests/repo`, `npm run typecheck` exit 0
2. **Task 2: user-approved git mutations, then the full verify gate** — `3fcac7a` (chore) — `git show --stat HEAD`: 61 files changed, 4819 deletions, all deletions (58 `dist/`, `yarn.lock`, 2 `.DS_Store`); nothing under `.planning` staged
3. **Task 3: confirm licensing defaults** — NOT RUN, pending user confirmation (Task 3 checkpoint)

**Plan metadata:** the docs commit (SUMMARY, STATE, ROADMAP) follows this file.

## Guard failure proof (before Task 2 mutations)

`node scripts/check-repo.mjs --only reference,license,notice,lore,goldens,lf,gitattributes,workflow` exited 0. The full default run exited 1:

```
check-repo: FAIL junk: tracked: .claude/.DS_Store
check-repo: FAIL junk: tracked: dist/components/app/components/cyphers/CypherHoverText.d.ts
  ... (58 dist/ lines in total)
check-repo: FAIL junk: tracked: public/.DS_Store
check-repo: FAIL junk: tracked: yarn.lock
check-repo: FAILED (junk)
```

61 problems = 58 `dist/` files + `yarn.lock` + 2 `.DS_Store`; `demo.mov` was no longer tracked. The `origin` check passed because the remotes were already in their final state (its failure path is proven by the `isUpstreamOrigin` unit tests). After the mutations: `check-repo: OK (reference, origin, junk, license, notice, lore, goldens, lf, gitattributes, workflow)`.

## Remote handling (D-05 amended): already final, nothing changed

Git remote commands run (all local, read-only): `git remote -v`, `git remote get-url origin`, `git remote get-url upstream`, `git remote get-url --push upstream`. The check-then-set sub-steps `rename`, `add`, `set-url` did NOT run because the state was already final:

- `origin` = `https://foGledenalzi@github.com/foGledenalzi/CCRUGen.git` (accepted userinfo variant; with `foGledenalzi@` removed it equals `https://github.com/foGledenalzi/CCRUGen.git`)
- `upstream` fetch = `https://github.com/lumpenspace/ccru.git`
- `upstream` push = `DISABLED_NO_PUSH`

No `git push`, `fetch`, `pull`, `ls-remote` or `clone` was run; the guard's source is tested to contain none of them. No git config was changed.

## `npm run verify` on the committed tree: exit 0

One run, `npm run verify`, wall clock 122 s (timestamps from the run log):

| Stage | Result | Time |
|-------|--------|------|
| check:repo | OK (10 default checks) | <1 s |
| typecheck (4x tsc + lint) | exit 0, "No ESLint warnings or errors" | 11 s |
| test (TZ=UTC) | 7 files, 187 tests passed | 5 s |
| test:tz (America/New_York) | 7 files, 187 tests passed | 5 s |
| test:e2e:basepath (build at /ccrug + stage + Playwright) | 8 passed | 29 s |
| build | `next build` OK (`/` 1.15 kB, `/numogram` 45 kB) | 23 s |
| check:weight | `page-weight: OK (2 routes, 30 golden states within tolerance)` | 1 s |
| test:e2e | 68 passed (60 goldens + 8 static-export), zero golden diffs, no `-u` | 48 s |
| check-repo --clean-tree --static-out | `OK (... clean-tree, static-out)` | <2 s |

Afterwards: `git status --porcelain -- . ':(exclude).planning'` empty; `git ls-files reference` = 0; `git ls-files dist` = 0; `out/.DS_Store` absent; no listeners on ports 3000, 3111, 3112, 3113, 3007; `.e2e-basepath/` removed. `e2e/__golden__` and `engine/test/fixtures` show no diff.

## Files Created/Modified

- `scripts/check-repo.mjs` - the guard (330 lines, zero dependencies, ESM)
- `tests/repo/check-repo.test.ts` - failing-input tests of every helper, the static-out scan, and the CLI
- Deleted (`3fcac7a`): `dist/` (index only, files kept on disk), `yarn.lock`, `public/.DS_Store`, `.claude/.DS_Store`

## Decisions Made

- Static-out forbidden patterns: `_vercel`, `vercel-scripts`, `vercel-storage`, `@vercel/`, `api/share-image` plus the upstream host name and the credit text, both case-insensitive, per the user's order (2026-09-25) to scrub all old branding. This supersedes the plan's single host pattern.
- Only local git read commands are used in the guard; the test suite greps the source so a later edit cannot add a shell or a remote-touching call unnoticed.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 2 - Missing critical: user order] Broader branding patterns in the static-out scan**
- **Found during:** Task 1 (orchestrator instruction; user scrub order of 2026-09-25, already applied in 7cb00d3/6de25a6)
- **Issue:** the plan's `FORBIDDEN_OUT` only forbade the upstream host name in one exact form; the user ordered all old branding gone.
- **Fix:** the patterns are case-insensitive markers for the upstream host name and the credit text; matching test cases (each text file type, upper case, an image file is not scanned) added. Plan text about a footer credit or the gematria plugin is obsolete and ignored; the plan's `findTrackedJunk` example naming a plugin path was replaced by neutral look-alikes (`distance/a.js`, `component-library/index.ts`, `demo.mov.txt`).
- **Files modified:** `scripts/check-repo.mjs`, `tests/repo/check-repo.test.ts`
- **Committed in:** `65009b7`, `3aba310`
- **Result:** the only tracked mentions outside `.planning/` are the CLAUDE.md rule and this guard with its test (`git grep` confirmed).

**2. [Rule 2 - Hardening] Guard robustness beyond the planned surface**
- **Issue:** the plan's runner could crash or pass silently in edge cases.
- **Fix (all tested):** extra pure helpers `loreProblems(read)` and `findCarriageReturns(dir)`; `run(argv)` exported; an unknown `--only` name or unknown flag exits 1; a check that throws is reported as `check crashed` (a failure); `isUpstreamOrigin` is anchored to a path boundary and the `reference` check is case-insensitive (Windows); `.svg` added to the scanned text extensions; `scanStaticOut` reports one problem per file naming every matching pattern, and a missing `out/` is one problem.
- **Files modified:** `scripts/check-repo.mjs`, `tests/repo/check-repo.test.ts`
- **Committed in:** `65009b7`, `3aba310`

**3. [Adaptation] TDD as two commits**
- The plan said "Commit both files"; the task is `tdd="true"`, so the test was committed RED (`65009b7`, HEAD then has a failing suite by design) and the guard GREEN (`3aba310`).

**4. [Rule 3 - Blocking prevention] Stale ignored build artifact removed by hand**
- **Found during:** Task 2, before `verify`
- **Issue:** `out/.DS_Store` (git-ignored build output) survived from a build made while `public/.DS_Store` still existed; the `--static-out` check would fail on it.
- **Fix:** deleted that one ignored file with `rm -f out/.DS_Store` (no `git clean`). Whether `next build` would have cleaned it by itself was therefore not observed; the subsequent build produced no `.DS_Store`.

---

**Total deviations:** 4 (2 Rule 2, 1 Rule 3, 1 process adaptation). **Impact:** none on the plan's goal; all strengthen the guard or follow a user order. No golden, fixture or baseline was touched.

## Issues Encountered

- An aborted shell command of mine (a python heredoc used as a file-edit shortcut) left a stray `python.exe` and a delayed `node -e` fallback that later added a duplicate import line to the working-tree copy of the test file after it was committed. Detected by `git status`, restored with `git checkout -- tests/repo/check-repo.test.ts`, tests re-run (85/85). The committed and verified files were never affected; the stray process was killed (only my own process).

## User Setup Required

None. Parallel user actions (not done by Claude): ask lumpenspace for a permissive license; revoke any old Vercel Blob token if one was ever issued to this machine. Pushing the phase commits (and thus running CI) happens only when the user approves it, outside all plans.

## Pending checkpoint (Task 3)

Task 3 (`checkpoint:human-verify`) was intentionally NOT executed and NOT answered. The LICENSE holder (`foGledenalzi`, a Claude default under CONTEXT "Claude's Discretion") and the NOTICE scope are pending user confirmation (Task 3 checkpoint). Until then FND-05 must not be considered closed. `node scripts/check-repo.mjs --only license,notice` currently passes.

## Known Stubs

None.

## Threat Flags

None: the guard only reads local files and runs local read-only git commands; no new endpoint, auth path or trust-boundary file access.

## Next Phase Readiness

- Phase 1 is executed: `npm run verify` is green locally; CI stays dormant until the user pushes.
- Blocker for closing FND-05: the Task 3 user confirmation. Phase-level verification (`/gsd-verify-work 1`) and requirement marking are for the orchestrator.

---
*Phase: 01-foundations-and-safety-net*
*Completed: 2026-09-26 (Tasks 1-2; Task 3 pending user confirmation)*

## Self-Check: PASSED

Verified after writing: `scripts/check-repo.mjs` (330 lines) and `tests/repo/check-repo.test.ts` exist; commits `65009b7`, `3aba310`, `3fcac7a` exist; `git ls-files dist yarn.lock demo.mov public/.DS_Store .claude/.DS_Store` is empty while `dist/` is on disk; the upstream push URL is still `DISABLED_NO_PUSH`; the old branding markers appear in tracked files only in `CLAUDE.md` and the guard with its test. Task 3 is NOT self-checked because it was not run.

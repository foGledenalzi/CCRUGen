---
phase: 01-foundations-and-safety-net
verified: 2026-09-26T04:47:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification: false
verified_at_commit: 66e8ef0
---

# Phase 1: Foundations and Safety Net Verification Report

**Phase Goal:** The project builds, type-checks and exports as a static site on this machine, and the untouched base-10 viewer's behavior is frozen as an oracle before anything is refactored
**Verified:** 2026-09-26T04:47:00Z (HEAD `66e8ef0`, working tree clean)
**Status:** passed
**Re-verification:** No, initial verification

Method: every ROADMAP success criterion was checked against the code and against commands I ran myself. SUMMARY claims were not used as evidence. The five negative-path proofs (SC4, SC5, and the two oracle mutation tests) ran in a scratch copy of the repo under the session scratchpad, never in the real tree. The real tree stayed clean (`git status --porcelain` empty), no `-u` or `GOLDEN_CAPTURE=1` was used, nothing was pushed, fetched or committed, ports 3000/3111/3112/3113/3007 are free, and `.e2e-basepath/` was removed after the sub-path run.

## Goal Achievement

### Observable Truths

ROADMAP success criteria (the contract) first, then plan-level truths that add detail.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: `npm run build` succeeds on Windows with no `zip`, leaves no tracked file modified, emits a fully static `out/`; LF enforced by `.gitattributes`; CI file runs the same build and typecheck on Windows and Ubuntu | VERIFIED | `zip` is not on PATH (`which zip`, `where zip` both empty). `rm -rf out .next && npm run build` exit 0 (Next 14.2.35, 6 static pages). `git status --porcelain` empty afterwards. `out/` holds only `index.html`, `numogram/index.html`, `404`, `icon.svg`, `ccrug-mark.svg`, `_next/static` (no `api` dir, no server files, no `.map`). `build` = `next build` only; `grep zip\|fflate` over package.json/scripts/config finds nothing. `.gitattributes` has `* text=auto eol=lf`; `git ls-files --eol` shows every text file `i/lf` in the index; no CR bytes in `e2e/__golden__`, `engine/test/fixtures`, `perf`. `.github/workflows/ci.yml` runs `npm ci`, installs Chromium, then `npm run verify` on `ubuntu-latest` and `windows-latest` with `permissions: contents: read`; `verify` contains `npm run typecheck` and `npm run build`. |
| 2 | SC2: exported site serves the base-10 viewer offline, no Vercel Blob/Analytics request, no server route; old `/?...` and `/numogram/?...` links land on the numogram | VERIFIED | Ran `npm run test:e2e` twice: 68/68 passed each time, including in both timezone projects: legacy `/?layout=ladder&selected=5` redirects to `/numogram/?layout=ladder&selected=5` and shows the 870-high ladder SVG; `/numogram/?layout=labyrinth` shows the 880-high SVG; a test records every request and asserts all are same-origin, none match `vercel\|/api/\|blob`, none fail. Grep of `out/` (case-insensitive) finds no `vercel`, `share-image`, `qliphoth`, `delight nexus`. HTML has zero external `<link>/<script>/<img>` sources; the only external URLs are four clickable citation `<a href>` in the sources footer; the `use.typekit.net` strings are Next's internal font-provider list, not requests. `package.json` and `package-lock.json` contain no `@vercel` (lock count 0). `git ls-files app` has no `route.ts`; only `layout.tsx`, `page.tsx`, `numogram/page.tsx`. Sub-path run (`npm run test:e2e:basepath`, build with `/ccrug`): 8/8 passed; built HTML prefixes `/ccrug/...`. |
| 3 | SC3: numeric `base10.golden.json` (all four layouts, planetary numerically) plus normalized-SVG DOM goldens (original, labyrinth, ladder x 10 states) captured from the untouched viewer, pass on the static build, identical on repeated runs under two TZ values | VERIFIED | Numeric oracle contains `layouts` original/labyrinth/ladder and a `planetary` block (radius, angles, sizes, positions at default angle). 30 DOM goldens on disk = 30 in `e2e/__golden__/MANIFEST.json`; I recomputed all 30 sha256 with my own script (0 mismatches, 0 CR). Two full `npm run test:e2e` runs against `serve out`: 68/68 each, covering `chromium-utc` and `chromium-ny` (60 golden comparisons per run, no `-u`). `npm run test` (TZ UTC) and `npm run test:tz` (America/New_York): 7 files, 187/187 each. Capture provenance: `git diff --quiet 7c38ad9 <commit> -- app public next.config.js postcss.config.js tailwind.config.ts` exits 0 for both oracle commits (`1858d05`, `70984f8`), so the oracle came from the upstream-identical viewer. |
| 4 | SC4: `npm run typecheck` runs every `tsc` invocation plus the engine lint rules; adding a DOM/Node type or a non-relative import in `engine/` makes it fail | VERIFIED | `typecheck` = root `tsc --noEmit --incremental false` && `tsc -p engine/tsconfig.json` && `tsc -p engine/tsconfig.test.json` && `tsc -p tsconfig.components.json` && `npm run lint` (`next lint --dir app --dir engine --dir workers`); exit 0 on the real tree. Independent end-to-end proof in a scratch copy (real `npm run typecheck`, one probe file `engine/__probe__.ts` at a time): baseline exit 0; `document.title` exit 2 (TS2584); `process.env.X` exit 2 (TS2591); `import 'node:fs'` exit 2 (TS2307); `import React from 'react'` exit 1 (ESLint "engine/ uses relative imports only"); `import '@/app/data/zones'` exit 2 (TS2307); `import '../app/data/zones'` exit 1 (ESLint "engine/ must not import app/"). Controls: a clean module with a relative import exits 0, and a file under `engine/test/` using `node:fs` and `process` exits 0 (override scope correct). `engine/test/guard.test.ts` uses the real `ESLint` class (`lintText` with a path inside `engine/`) and a real `tsc` child process with 12 violation cases plus clean and scope cases, so it can fail; it is part of the 187 passing tests. |
| 5 | SC5: guard fails if any `reference/` file is tracked or `origin` points at `lumpenspace/ccru`; licensing and upstream-attribution decision recorded in the repo | VERIFIED | `npm run check:repo` exit 0 on the real tree (10 checks). End-to-end failure proof in a scratch git repo running the real `scripts/check-repo.mjs`: tracking `reference/book.txt` gives exit 1 `FAIL reference: tracked: reference/book.txt`; `origin` = `https://github.com/lumpenspace/ccru.git` gives exit 1; `origin` = `git@github.com:lumpenspace/ccru.git` gives exit 1; tracked `dist/a.js` and `yarn.lock` give exit 1; each returns to exit 0 when fixed and with origin `.../foGledenalzi/CCRUGen.git`. Real repo: `git ls-files reference` = 0; `origin` = `https://foGledenalzi@github.com/foGledenalzi/CCRUGen.git`, `upstream` = `lumpenspace/ccru.git` with push URL `DISABLED_NO_PUSH`. Decision recorded: `LICENSE` (MIT, holder foGledenalzi), `NOTICE` (MIT for original code; upstream-derived files not relicensed; five CCRU-derived lore files excluded; `reference/` never distributed), lore headers on all five `app/data/*` files (guard `lore` check), README credit line. The user confirmed holder and NOTICE scope on 2026-09-25. |
| 6 | Exact pins and a committed lockfile, npm only, `next` resolves to 14.2.35 | VERIFIED | Lockfile versions: next 14.2.35, vitest 5.0.2, vite 8.3.1, @playwright/test 1.63.0, typescript 5.9.3, eslint 8.57.1, eslint-config-next 14.2.35, tsx 4.23.15, cross-env 10.1.0, serve 14.2.6, fast-check 4.10.2. `npm ls next` shows only `next@14.2.35`. Lockfile root deps equal `package.json` deps; `npm ci --dry-run --ignore-scripts` exits 0. `yarn.lock` not tracked. `packageManager` npm@11.6.2, `engines.node` >=22.12. |
| 7 | TZ pin is real: canary proves the zone in both runs | VERIFIED | `vitest.config.mts` assigns `process.env.TZ = process.env.CCRUG_TZ ?? 'UTC'`; `engine/test/tz.test.ts` asserts offset 0 (UTC) and 300 (America/New_York); both `npm run test` and `npm run test:tz` pass 187/187, so the pin took effect in both zones on Windows. |
| 8 | Frozen oracle cannot be silently regenerated | VERIFIED | `git log` shows exactly two commits ever touched `e2e/__golden__` and `engine/test/fixtures` (`1858d05` numeric, `70984f8` DOM). `scripts/golden-manifest.mjs verify` on both manifests: OK 30 files / OK 1 file. My independent sha256 recomputation matches the manifests. `scripts/capture-base10-oracle.ts` exits 1 if the fixture exists. `strictDir` on the DOM manifest makes any unfrozen file in `e2e/__golden__` a failure; `check:repo` runs it. `playwright.config.ts` sets `updateSnapshots` to `'none'` unless `GOLDEN_CAPTURE=1`. |
| 9 | Oracle captured before any render-path edit (sequencing rule) | VERIFIED | Oracle commits 20:21 and 20:33 (-0600); first edit of `app/NumogramClient.tsx` and `next.config.js` is `a62b0d8` at 20:40; `git diff --quiet 7c38ad9 70984f8 -- app public next.config.js ...` exits 0. `app/data/*` differs from upstream only by one lore-header line each (5 insertions total). |
| 10 | Numeric oracle is correct against definitions and sensitive to data changes | VERIFIED | My own script (independent of the repo's tests) re-derived from the JSON alone: gate `k` goes to `dr(T(k))` with `T===0 ? 0 : ((T-1)%(n-1))+1` for all 10 gates (Gt-15 = 5->6, Gt-03 = 2->3), 5 pairs each summing to 9, currents land on `|a-b|`, 45 demons with kinds recomputed from the Time Circuit zones matching, split chrono 12 + 3 syzygetic, amphi 24 (12 Plex + 12 Warp), xeno 4 + 2 syzygetic, sha256 equals the manifest. Mutation: in a scratch copy, changing Gt-15 to `to: 7` makes `tests/oracle/base10.oracle.test.ts` fail (1 failed / 37 passed; control 38/38). |
| 11 | DOM goldens catch visual change and ignore accessibility attributes | VERIFIED | Mutation: a one-character colour change (`#cc44ff` -> `#cc44fe`) in a scratch copy of `out/`, served via `E2E_STATIC_DIR`, makes `original / layer-gates` fail with `toMatchSnapshot failed` (exit 1); the same test on the real `out/` passes. Ignore-list behaviour (`aria-*`, `data-*`, `role`, `tabindex`) is covered by `tests/e2e-normalizer/visual-dom.test.ts` (part of the 187 passing tests). Goldens are 12-30 KB each (660 KB total) of real normalized SVG (paths, coordinates, fills, text), not stubs. |
| 12 | Sub-path hosting works (D-06) | VERIFIED | `NEXT_PUBLIC_BASE_PATH=/ccrug` build: assets prefixed `/ccrug/...`; the four static-export tests pass 8/8 under it (legacy redirect, share link, no foreign requests, logo via `withBasePath`). `next.config.js` validates the value and throws a clear error on a bad one. |
| 13 | Page-weight baseline and budget (D-17) | VERIFIED | `perf/page-weight.baseline.json` records per-route html/js/css raw and gzip for `/` and `/numogram/` and DOM node counts for 30 states, with tolerance (5% or 1 KiB bytes, 2% or 2 nodes). `npm run check:weight` on my fresh build: `OK (2 routes, 30 golden states within tolerance)`. Unit tests in `tests/perf/page-weight.test.ts` pass. |
| 14 | Licensing files, lore headers, README credit (01-07) | VERIFIED | Read `LICENSE` (canonical MIT text) and `NOTICE` (four sections). Guard checks `license`, `notice` (names all five lore files and `lumpenspace/ccru`) and `lore` (line-1 header on all five) pass. README opens with the "Based on lumpenspace/ccru" credit; no `demo.mov` or upstream host reference in tracked non-planning files (only the guard, its test, `.gitignore` and the CLAUDE.md rule mention the markers, by design). |
| 15 | Repo hygiene and remote handling (01-08, D-05, D-10) | VERIFIED | `git ls-files` finds no `dist/`, `demo.mov`, `yarn.lock`, `.DS_Store`; all four are ignored (`git check-ignore -v`); `dist/` is still on disk and `npm run build:components` exits 0 leaving the tree clean. Remotes as stated in truth 5. The guard source uses `execFileSync` with local read-only git commands only. Local `origin/main` is at `0d6ee6d` (40 commits behind HEAD), consistent with "no push from any plan". `check-repo --clean-tree --static-out` passes after my rebuild. |

**Score:** 15/15 truths verified

### Superseded by user amendment (not scored, not gaps)

| Item | Why |
|------|-----|
| Plan 01-06 truth "optional plugin ZIP built with fflate into `artifacts/`" | The gematria plugin, `build-plugin-zip.mjs` and `fflate` were removed in the 2026-09-25 branding scrub by user order; the ROADMAP plan line already records this. No `zip`/`fflate` reference remains in scripts or config. |
| ROADMAP SC3 wording "four layouts" for DOM goldens | Locked decision D-14 excludes planetary from the DOM oracle and checks it numerically; the numeric JSON covers it (truth 3). |
| Plan 01-05 "no qliphoth.systems URL in metadata" and the plan text about the footer credit and upstream logo | Strengthened by the scrub: the guard now forbids the branding markers anywhere in `out/`; `out/` is clean (truth 2). |

### Deferred Items

None. No Phase 1 concern is scheduled for a later phase (Step 9b: nothing to defer).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.gitattributes` | LF normalization | VERIFIED | `* text=auto eol=lf` present; attrs resolve for app and golden files |
| `package.json` / `package-lock.json` | exact pins, `ccrug`, every script | VERIFIED | all scripts run; lock consistent with package.json |
| `tsconfig.json` (ES2022), `engine/tsconfig.json` (`lib` ES2022, `types: []`), `engine/tsconfig.test.json` | compiler boundary | VERIFIED | exercised by the probes above |
| `.eslintrc.json` engine override | `no-restricted-syntax`, `-globals`, `import/no-restricted-paths` | VERIFIED | scoped to `engine/**` minus `test`/`cli`; probes fail as designed |
| `engine/index.ts`, `engine/package.json` | scaffold | VERIFIED | intentionally `export {}` (Phase 2 fills it); no `"type"` key |
| `vitest.config.mts`, `engine/test/tz.test.ts`, `engine/test/guard.test.ts` | TZ pin, canary, boundary guard | VERIFIED | 187 tests green in two zones |
| `scripts/golden-manifest.mjs` (+ tests) | freeze/verify, never overwrite | VERIFIED | verify OK on both manifests |
| `engine/test/fixtures/base10.golden.json` + MANIFEST | frozen numeric oracle | VERIFIED | truths 8, 10 |
| `tests/oracle/deriveBase10.ts`, `base10.oracle.test.ts`, `scripts/capture-base10-oracle.ts` | derive, guard, one-shot capture | VERIFIED | 38 oracle tests; mutation-proven |
| `e2e/visual-dom.ts`, `e2e/golden.spec.ts`, `playwright.config.ts`, 30 goldens + MANIFEST | DOM oracle | VERIFIED | truths 3, 8, 11 |
| `next.config.js`, `app/page.tsx`, `LegacyQueryRedirect.tsx`, `app/lib/basePath.ts`, `app/layout.tsx`, `app/numogram/page.tsx` | static export, client redirect, static metadata | VERIFIED | build output and e2e |
| `e2e/static-export.spec.ts`, `scripts/stage-basepath.mjs` | SC2 proof, sub-path staging | VERIFIED | 8/8 at root and at `/ccrug` |
| `scripts/page-weight.mjs`, `perf/page-weight.baseline.json`, `tests/perf/page-weight.test.ts` | budget | VERIFIED | truth 13 |
| `.github/workflows/ci.yml` | dormant Windows + Ubuntu `verify` | VERIFIED | content checked; never executed (see notes) |
| `LICENSE`, `NOTICE`, `README.md`, lore headers | FND-05 record | VERIFIED | truth 14 |
| `scripts/check-repo.mjs` + `tests/repo/check-repo.test.ts` | policy guard | VERIFIED | truth 5; 85 tests in `tests/repo` |
| `public/ccrug-mark.svg`, `app/icon.svg` | original mark | VERIFIED | emitted in `out/`; logo test asserts `withBasePath` URL |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` `typecheck` | `.eslintrc.json` engine override | `npm run lint` with `--dir engine` | WIRED | probes `react` and `../app` fail inside `npm run typecheck` |
| `package.json` `test` / `test:tz` | `vitest.config.mts` TZ assignment | `cross-env CCRUG_TZ=...` | WIRED | canary passes in both zones |
| `engine/test/guard.test.ts` | `engine/tsconfig.json` | temp tsconfig that extends it, real `tsc` | WIRED | file read in full |
| `app/page.tsx` | `LegacyQueryRedirect` | `<LegacyQueryRedirect />` | WIRED | legacy-link e2e passes |
| `NumogramClient.tsx` | `app/lib/basePath.ts` | `withBasePath('/ccrug-mark.svg')` at both logo sites | WIRED | diff reviewed; logo e2e passes at root and `/ccrug` |
| `playwright.config.ts` | `serve out` / `next dev` | `E2E_SERVER`, `E2E_STATIC_DIR`, `E2E_BASE_PATH` | WIRED | used by every run above |
| `check-repo.mjs` | `golden-manifest.mjs` `verifyManifestFile` | import | WIRED | `goldens` check runs both manifests |
| `package.json` `verify` | every gate | `npm run ...` chain, also called by `ci.yml` | WIRED | orchestrator ran it green; I re-ran each stage except the sub-path build inside it (ran that separately) |

### Data-Flow Trace (Level 4)

Not applicable: Phase 1 adds no new dynamic-data component. The viewer's rendering is unchanged (projection `<svg>` byte-identical against the frozen goldens); the oracle files are static data compared against `app/data/*` by tests that fail on mutation (truths 10, 11).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Static build, no zip | `rm -rf out .next && npm run build` | exit 0, 6 static pages, tree clean | PASS |
| Full typecheck | `npm run typecheck` | exit 0, no ESLint warnings | PASS |
| Unit + oracle tests, TZ UTC | `npm run test` | 7 files, 187/187 | PASS |
| Same, TZ America/New_York | `npm run test:tz` | 7 files, 187/187 | PASS |
| Goldens + static-export e2e (run 1) | `npm run test:e2e` | 68 passed, 47.5 s | PASS |
| Same (run 2, repeatability) | `npm run test:e2e` | 68 passed, 47.6 s | PASS |
| Sub-path build + e2e | `npm run test:e2e:basepath` | 8 passed | PASS |
| Page-weight budget | `npm run check:weight` | OK, 2 routes, 30 states | PASS |
| Repo guard | `npm run check:repo`; `check-repo --clean-tree --static-out` | OK (12 checks) | PASS |
| Manifests | `golden-manifest verify` (both) | OK 30 files, OK 1 file | PASS |
| Component build | `npm run build:components` | exit 0, tree clean | PASS |
| Lockfile validity | `npm ci --dry-run --ignore-scripts` | exit 0 | PASS |
| Engine boundary (6 negatives, 2 controls) | scratch copy, `npm run typecheck` | negatives non-zero, controls zero | PASS |
| Guard negatives (5) | scratch git repo, `check-repo.mjs` | each exit 1, each fixed exit 0 | PASS |
| DOM oracle mutation | scratch `out/` with one colour digit changed | 1 failed; control passes | PASS |
| Numeric oracle mutation | scratch `app/data/gates.ts` Gt-15 -> 7 | 1 failed; control 38/38 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| FND-01 | 01-01, 01-05, 01-06, 01-08 | Builds and type-checks on Windows and Linux with one `npm run build` (no `zip`, ES2022 root target, LF via `.gitattributes`) | SATISFIED | Truths 1, 4, 6. Windows build and typecheck proven locally; Linux is covered by the CI file only (never run, see notes). |
| FND-02 | 01-01, 01-03, 01-04, 01-05, 01-06, 01-08 | Frozen base-10 oracle (numeric JSON plus normalized DOM goldens) before any refactor, stays green | SATISFIED | Truths 3, 8, 9, 10, 11; both suites green, both TZ values. |
| FND-03 | 01-05 | Fully static export, no server route, Vercel Blob or Analytics | SATISFIED | Truth 2; `output: 'export'` unconditional, no `route.ts`, no `@vercel` in package or lock or `out/`. |
| FND-04 | 01-01, 01-02 | `engine/` enforced pure by `tsc -p engine` and ESLint, via one `typecheck` script | SATISFIED | Truth 4 with six failing probes and two passing controls. |
| FND-05 | 01-07, 01-08 | Licensing and attribution decided, `origin` repointed, guard fails if `reference/` tracked | SATISFIED | Truths 5, 14, 15; user confirmation 2026-09-25. |

All five IDs appear in plan frontmatter (01-01: FND-01/02/04; 01-02: FND-04; 01-03, 01-04: FND-02; 01-05: FND-03/02/01; 01-06: FND-01/02; 01-07: FND-05; 01-08: FND-05/01/02) and all five map to Phase 1 in REQUIREMENTS.md. No orphaned requirements. REQUIREMENTS.md still shows them Pending/unchecked by design (the plan summaries defer marking to phase level); the orchestrator should mark FND-01..05 complete now.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase files: engine, scripts, tests, e2e, redirect, layout, config, CI) | - | `TODO/FIXME/PLACEHOLDER/not yet implemented` grep | none | No hits. |
| `engine/index.ts` | 1-5 | `export {}` | Info | Intentional scaffold; Phase 1 only enforces the boundary, Phase 2 fills the engine. Not a stub of any Phase 1 deliverable. |
| `app/lib/shareParams.ts`, `app/hooks/useGlitchNavigate.ts`, `app/lib/cyberColors.ts` | - | orphaned modules | Info | Left in place by decision (Phase 4 URL codec and MIG-02 grep replace them). |

No blockers, no warnings.

### Human Verification Required

None. Everything the phase goal and the five success criteria assert is machine-checkable and was checked. (The user-owned items, licensing confirmation and the ordered branding scrub, are already recorded as done.)

### Gaps Summary

No gaps. All five roadmap success criteria hold against evidence gathered independently of the SUMMARY files, and the two oracles are proven both immutable (hash manifests, single-commit history, refusing capture script) and live (mutation tests fail as they should).

### Notes for the orchestrator (non-blocking, not gaps)

1. **CI has never executed.** `origin/main` locally is `0d6ee6d`, 40 commits behind HEAD, so `ci.yml` has not run anywhere. Its action majors (`checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`) were flagged `[ASSUMED]` in the research and I could not verify them offline. SC1 asks for the workflow file to run the same commands on Windows and Ubuntu, and it does by content; the first real run after the user pushes is the true Linux proof. If an action version is wrong the fix is a one-line edit. I found no Windows-only dependence in the verify chain (DOM goldens contain no text-measurement-derived attributes; all scripts are Node; paths use forward slashes).
2. **`CLAUDE.md` "Resuming in a fresh or cloud session" is stale.** It still says execution has not started, recommends `npm install --ignore-scripts --no-package-lock`, and says `yarn.lock` is to be removed. Refresh it when the phase is closed.
3. **Local `node_modules` has an extraneous `fflate` (and `@emnapi/wasi-threads`)** left from the removal; it is not in `package.json` or the lockfile, and `npm ci` drops it. No tracked-state effect.
4. **ROADMAP SC5 wording is garbled** ("`origin` no longer points at `lumpenspace/ccru`" listed as a guard condition); the implemented and tested behavior, "fails if `origin` points at upstream", matches REQUIREMENTS FND-05.
5. `out/` was rebuilt as the root (non-basePath) export at the end of my run; it and `test-results/` are gitignored.

---

_Verified: 2026-09-26T04:47:00Z_
_Verifier: Claude (gsd-verifier)_

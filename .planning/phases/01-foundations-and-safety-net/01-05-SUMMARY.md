---
phase: 01-foundations-and-safety-net
plan: 05
subsystem: infra
tags: [static-export, next-export, base-path, client-redirect, playwright, serve, golden-comparison, vercel-removal, share-image-removal]

# Dependency graph
requires:
  - phase: 01-foundations-and-safety-net (plan 01)
    provides: package.json scripts (build = next build, test:e2e:basepath), cross-env, serve, Playwright 1.63.0, golden-manifest tool
  - phase: 01-foundations-and-safety-net (plan 03)
    provides: frozen numeric oracle (engine/test/fixtures), the gate that had to exist before any render-path edit
  - phase: 01-foundations-and-safety-net (plan 04)
    provides: 30 frozen DOM goldens, e2e/golden.spec.ts, playwright.config.ts (E2E_SERVER / E2E_STATIC_DIR / E2E_BASE_PATH / E2E_PORT)
provides:
  - next.config.js with output 'export' unconditional, trailingSlash, and a validated optional NEXT_PUBLIC_BASE_PATH basePath
  - a static, numogram-only out/ (routes /, /_not-found, /icon.svg, /numogram) with no Vercel or API string anywhere
  - LegacyQueryRedirect (client location.replace to BASE_PATH + /numogram/ + search + hash) and app/lib/basePath.ts (withBasePath)
  - static CCRUG metadata (title "CCRUG - Numogram Generator", numogram page "Numogram | CCRUG"), no qliphoth.systems URL in metadata
  - NumogramClient without the share-image upload flow (share = copy URL / navigator.share)
  - e2e/static-export.spec.ts (SC2) and scripts/stage-basepath.mjs (sub-path e2e), both run at the root and under /ccrug
  - proof that the 30 frozen DOM goldens pass unchanged on the static export in chromium-utc and chromium-ny (60/60)
affects: [01-06, 01-07, 01-08, phase-04-url-codec, phase-06-worker-chunks]

# Tech tracking
tech-stack:
  added: []
  removed: ["@vercel/analytics", "@vercel/blob"]
  patterns:
    - "Static export with an env-driven sub-path: one variable (NEXT_PUBLIC_BASE_PATH), validated at build time, mirrored by withBasePath() for plain <img> URLs"
    - "Client redirect via useEffect + location.replace with a fixed destination path (no open redirect, no useSearchParams/Suspense)"
    - "Goldens are the judge: the render-path edits land after the oracle is frozen and are proven only by an unchanged golden run, never by regeneration"

key-files:
  created:
    - app/lib/basePath.ts
    - app/components/navigation/LegacyQueryRedirect.tsx
    - e2e/static-export.spec.ts
    - scripts/stage-basepath.mjs
  modified:
    - app/page.tsx
    - app/layout.tsx
    - app/numogram/page.tsx
    - app/NumogramClient.tsx
    - next.config.js
    - package.json
    - package-lock.json
  deleted:
    - app/api/share-image/route.ts
    - app/sitemap.ts
    - app/robots.ts
    - app/gematria/page.tsx
    - app/gematria/GematriaHomeClient.tsx
    - app/gematria/saved/page.tsx
    - app/gematria/plugin/page.tsx
    - app/gematria/plugin/GematriaPluginClient.tsx
    - app/gematria/plugin/zipInfo.ts
    - app/cyphers/page.tsx
    - app/cyphers/CyphersClient.tsx
    - app/components/page.tsx
    - scripts/share-image-self-check.mjs

key-decisions:
  - "The sitemap/robots files are dropped (D-11) and not replaced; re-add once a host exists"
  - "The three orphans (app/lib/shareParams.ts, app/hooks/useGlitchNavigate.ts, app/lib/cyberColors.ts) are left in place as decided in RESEARCH Open Question 5"
  - "app/components/numogram/SourcesFooter.tsx keeps its visible text '(c) qliphoth.systems / delight nexus' (D-12: the on-page sources footer stays); it is a text credit, not a URL and not metadata"
  - "Page-weight baselines for plan 01-06 must come from the root build: the /ccrug build reports slightly different route sizes (see Issues Encountered)"

patterns-established:
  - "Run the sub-path e2e through npm (cross-env) only; it consumes out/, so rebuild at the root afterwards before any root check"

requirements-completed: [FND-03, FND-02, FND-01]

# Metrics
duration: 7min
completed: 2026-09-26
---

# Phase 1 Plan 05: Static Export, Numogram-only Site and the Golden Proof on `serve out` Summary

**`output: 'export'` is now unconditional with an optional validated `NEXT_PUBLIC_BASE_PATH`, the non-numogram routes, the Vercel Blob/Analytics code and the share-image upload flow are gone, `/` is a client redirect that keeps the query, and the 30 frozen DOM goldens pass byte-for-byte on `serve out` in both timezones (60/60, no golden touched).**

## Performance

- **Duration:** about 7 min (2026-09-26T02:37Z to 02:44Z)
- **Tasks:** 3 (3 commits, no TDD task)
- **Files:** 4 created, 7 modified, 13 deleted; no golden, fixture or manifest touched

## Accomplishments

- **Oracle gate held (Task 1 step 0):** both manifests verified (`OK 30 files in 1 sets`, `OK 1 files in 1 sets`) and their commits exist (`70984f8`, `1858d05`) before any edit.
- **Import graph re-checked before deleting (D-08):** the plan's grep found nothing; a wider basename grep (`GematriaHomeClient|GematriaPluginClient|zipInfo|CyphersClient|share-image|...`) hit only files being deleted, plus two intended non-imports: `scripts/build-plugin-zip.mjs` names `app/gematria/plugin/zipInfo.ts` as a string path (plan 01-06 rewrites that script per D-09) and the two `/api/share-image` fetches in `NumogramClient.tsx` (removed in Task 2).
- **Task 1 (5c3a930):** 13 files deleted with `git rm` (`app/api/`, `app/gematria/`, `sitemap.ts`, `robots.ts`, `cyphers/page.tsx`, `CyphersClient.tsx`, `components/page.tsx`, `share-image-self-check.mjs`); `app/cyphers/ccruCiphers.ts`, `gematria.ts`, `gematria/plugin/**`, `component-library/**` and the three orphans kept. New `app/lib/basePath.ts`, `LegacyQueryRedirect.tsx`; `app/page.tsx`, `app/layout.tsx`, `app/numogram/page.tsx` replaced verbatim from the plan. Root tsc, components tsc and `npm run lint` all exit 0; every acceptance grep passed (`<LegacyQueryRedirect />` present, no `searchParams`/`redirect(`/`qliphoth` in `app/page.tsx`, no `useSearchParams`, no `@vercel/analytics`/`metadataBase`/`openGraph` in the layout, no `generateMetadata`).
- **Task 2 (a62b0d8):** `NumogramClient.tsx` diff is 5 insertions and 145 deletions: `withBasePath` import; `getShareFocusZones` and `captureShareDataUrl` blocks deleted; the `focusZones` line and the whole `try { fetch('/api/share-image') ... } catch` deleted (both fetch calls); `onShareExplanation` deps now exactly `[layout, selZones, layers, hlRegion, tcActive, particlesOn, planetDate, showOrbits, buildShareParams, sortSearchParams]`; intro logo and `CyberPageHeader icon` go through `withBasePath('/numogram-logo.svg')` (2 sites); `showHomeLink={false}` added once. Nothing inside the projection `<svg>` was touched. `npm uninstall @vercel/blob @vercel/analytics` ran once; `package.json` and `package-lock.json` contain no `@vercel`, `npm ls next` shows only 14.2.35. `npm run build` exits 0 in about 21 s: routes `/` 1.15 kB, `/_not-found` 873 B, `/icon.svg`, `/numogram` 45.1 kB (133 kB first load); `out/index.html` and `out/numogram/index.html` exist; `out/api`, `sitemap.xml`, `robots.txt`, `gematria`, `cyphers`, `components` do not; `grep -rli vercel out` prints nothing and the plan's Vercel/share-image/`num.qliphoth.systems` grep prints nothing; `out/numogram/index.html` has `<title>Numogram | CCRUG</title>`, `out/index.html` has `<title>CCRUG - Numogram Generator</title>`.
- **Task 3 (23d54df), SC3 proof, the core of this plan:** `npx playwright test e2e/golden.spec.ts` (no `E2E_SERVER`, no `GOLDEN_CAPTURE`, no `-u`) against `serve out`: **60 passed (45.6 s wall time reported by Playwright, 47 s including startup), exit 0.** `git status --porcelain -- e2e/__golden__ engine/test/fixtures` is empty and both manifests verify after every run.
- **SC2 root run:** `npx playwright test e2e/static-export.spec.ts`: 8 passed (6.4 s), exit 0.
- **Sub-path run (D-06):** `npm run test:e2e:basepath` (build with `NEXT_PUBLIC_BASE_PATH=/ccrug` through cross-env, `stage-basepath` moved `out/` to `.e2e-basepath/ccrug/`, `serve` on 3112): 8 passed (6.4 s), exit 0, 28 s in total including the build. `.e2e-basepath/ccrug/numogram/index.html` has 12 occurrences of `/ccrug/_next/static` and contains `/ccrug/numogram-logo.svg` twice (both logo sites).
- **Full default e2e after a root rebuild:** `npm run build` then `npm run test:e2e`: **68 passed (47.0 s)**, exit 0 (60 goldens + 8 static-export). `npm run typecheck`, `npm run test` and `npm run test:tz` exit 0 (5 files, 107 tests in UTC and in America/New_York).

## Task Commits

1. **Task 1: Delete non-numogram routes and replace the server-only pages** - `5c3a930` (feat)
2. **Task 2: Strip the share-image flow, enable output: 'export', drop @vercel/\*, build out/** - `a62b0d8` (feat)
3. **Task 3: Prove the frozen goldens on the static export; add the static-export and sub-path e2e** - `23d54df` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Files Created/Modified

- `next.config.js` - `output: 'export'`, `trailingSlash: true`, `basePath` from a validated `NEXT_PUBLIC_BASE_PATH`, `eslint.dirs`
- `app/lib/basePath.ts` - `withBasePath()` for plain URLs Next does not rewrite
- `app/components/navigation/LegacyQueryRedirect.tsx` - client `location.replace` with fixed destination, forwards `search` and `hash`
- `app/page.tsx`, `app/layout.tsx`, `app/numogram/page.tsx` - client-redirect landing, static CCRUG metadata, no Analytics
- `app/NumogramClient.tsx` - share-image flow removed, basePath-aware logos, no Home link
- `package.json`, `package-lock.json` - `@vercel/*` removed (lockfile also re-hoisted three nested optional `@emnapi/*` packages and dropped stale flags; no version of any project dependency changed)
- `e2e/static-export.spec.ts`, `scripts/stage-basepath.mjs` - SC2 proof and the sub-path staging helper

## Decisions Made

- Kept `SourcesFooter.tsx` unchanged: after the build the strings `qliphoth.systems` remain in `out/numogram/index.html` and the numogram page chunk only because of its visible text `(c) qliphoth.systems / delight nexus`. D-12 keeps the on-page sources footer, and the plan's truth is limited to metadata URLs (none remain). Flagged for the user to decide later whether that credit line should change.
- Followed the plan's task order strictly (delete and edit, build, then the golden comparison); the goldens passed on the first run, so no revert or code fix was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm uninstall` rewrote the tracked `yarn.lock`**
- **Found during:** Task 2 (step 3)
- **Issue:** the same npm side effect as in plan 01-01; `git status` showed ` M yarn.lock`. `dist/` was not dirtied this time (uninstall did not trigger `prepare`).
- **Fix:** `git checkout -- yarn.lock` (specific file); never staged.
- **Files modified:** none (restored)
- **Verification:** `git status --porcelain --untracked-files=no` listed only `app/NumogramClient.tsx`, `next.config.js`, `package.json`, `package-lock.json` before the Task 2 commit.

**2. [Tooling choice, not a plan change] `NumogramClient.tsx` edited with a one-off Node script**
- The working copy of `NumogramClient.tsx` is CRLF (autocrlf) while the index is LF; multi-line block deletions were done by a script in the session scratchpad that matches on unique start/end markers and fails on any ambiguous or missing marker. The result is exactly the plan's diff (see Accomplishments); the file is now LF on disk, consistent with `.gitattributes`.

**Total deviations:** 1 auto-fixed (Rule 3), 1 tooling note. No plan behavior changed.

## Issues Encountered

- **Route sizes differ between the root build and the `/ccrug` build.** Root: `/` 1.15 kB, `/numogram` 45.1 kB (133 kB first load), repeatable across two builds. Sub-path build: `/` 306 B, `/numogram` 44.3 kB (132 kB). The research lab quoted 1.14 kB and 44.3 kB / 132 kB. Cause not investigated (same code; only the inlined base path and chunk splitting differ); the goldens and e2e are unaffected. **Plan 01-06's page-weight baseline should be captured from a root `npm run build`** (the numbers `check:weight` will guard), not from a basePath build.
- `out/.DS_Store` still ships (from tracked `public/.DS_Store`); plan 01-08 removes it, as the plan states.
- Process hygiene: Playwright started and stopped its own `serve` each run; `netstat` showed nothing listening on 3111 or 3112 after every run and at the end. `.e2e-basepath/` was removed after the sub-path run; `out/` is left as the root export and is gitignored. `git status --short` is clean.
- `npm run build` did not dirty any tracked file, and `next-env.d.ts`/`tsconfig.json` were not modified.

## User Setup Required

None. Security note (not an action taken): the Vercel Blob route and its self-check script are gone, so any `BLOB_READ_WRITE_TOKEN` in a local `.env*` file is now unused. If one was ever issued to this machine, the user may revoke it on the Vercel side (T-01-13, accepted).

## Next Phase Readiness

- Plan 01-06 (page weight, CI, plugin ZIP) can build on a static `out/`: capture the baseline from a root `npm run build`. It must also rewrite `scripts/build-plugin-zip.mjs`, which still points at the now-deleted `app/gematria/plugin/zipInfo.ts` (`npm run build:plugin-zip` would fail until then; it is not part of `npm run build`).
- Plan 01-08 must still remove `yarn.lock`, untrack `dist/`, `public/.DS_Store` and `demo.mov`; until then every `npm install`/`uninstall` must be followed by `git checkout -- dist yarn.lock`.
- Phase 4's URL codec replaces `app/lib/shareParams.ts` (orphan, kept for MIG-02's clamp grep); `NUMOGRAM_QUERY_KEYS` no longer exists in `app/page.tsx` because every query string is forwarded (a future `base=` parameter passes through automatically).
- The blocker "Next 14.2 static-export behavior for redirect()/sitemap/robots/searchParams is from docs, not a build" is resolved: the export build passes and the redirect is proven at the root and under `/ccrug`.

## Requirements Note

`requirements-completed` lists FND-03, FND-02 and FND-01 because this plan's frontmatter carries them. Per the orchestrator's instruction FND-* checkboxes are marked at phase level, so `requirements.mark-complete` was not run and REQUIREMENTS.md was not edited. This plan delivers FND-03 (fully static, numogram-only export, no Vercel dependency) and the "goldens still match on the static build" half of FND-02; FND-01 progress is the static build and `npm run build` = `next build` only.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-01-10 (open redirect) mitigated: fixed destination `BASE_PATH + '/numogram/'`, only `location.search`/`location.hash` appended, landing URL asserted by e2e. T-01-11 (basePath tampering) mitigated by the build-time regex and error message. T-01-12 mitigated: `@vercel/*` uninstalled, route and `<Analytics />` removed, e2e asserts zero foreign-origin and zero `vercel`/`/api/`/`blob` requests, and `out/` contains no `vercel` string. T-01-13 and T-01-14 accepted as planned.

## Self-Check: PASSED

- FOUND: `app/lib/basePath.ts`, `app/components/navigation/LegacyQueryRedirect.tsx`, `e2e/static-export.spec.ts`, `scripts/stage-basepath.mjs`, `next.config.js` (contains `output: 'export'`)
- FOUND: deletions confirmed (`app/api`, `app/gematria`, `app/sitemap.ts`, `app/robots.ts`, `app/cyphers/page.tsx`, `app/cyphers/CyphersClient.tsx`, `app/components/page.tsx`, `scripts/share-image-self-check.mjs` absent; `ccruCiphers.ts`, `gematria.ts`, `shareParams.ts`, `useGlitchNavigate.ts`, `cyberColors.ts`, `gematria/plugin/manifest.json`, `component-library/index.ts` present)
- FOUND commits: `5c3a930`, `a62b0d8`, `23d54df`
- Goldens: 60/60 on `serve out`, `git status --porcelain -- e2e/__golden__ engine/test/fixtures` empty, both manifests verify (exit 0)

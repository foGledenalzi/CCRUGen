---
title: "Phase 1 code review: findings deferred (not fixed in Phase 1)"
status: pending
priority: P3
source: "01-REVIEW.md (2026-09-25)"
created: 2026-09-25
theme: hardening
---

## Goal

Track the Phase 1 review findings that were consciously not fixed before closing Phase 1. Full detail, failure scenarios and suggested fixes are in `.planning/phases/01-foundations-and-safety-net/01-REVIEW.md`. Fixed before close: WR-02, WR-03, WR-04, IN-07. Fixed afterwards: WR-01 (todo 001, 2026-09-26).

## Deferred, with where each belongs

- **WR-01** (double base path on the header-title click under a sub-path): CLOSED by todo 001 (2026-09-26): the route-transition provider that caused it is removed and the click case is in `e2e/static-export.spec.ts` (passes at the root and under `/ccrug`).
- **WR-05** (frozen-oracle manifests do not protect themselves against a deliberate two-file edit): pin the frozen set digests in `check-repo.mjs` or add an append-only merge-base comparison; set `strictDir` for `engine/test/fixtures`. Do before the first Phase 2 commit that touches the oracle.
- **IN-02** (page-weight DOM budget counts the frozen goldens, not the live app, so it cannot fail on real growth): measure live DOM node counts in Phase 3, where the high-base bloat concern actually bites. Also make the check fail on a referenced-but-missing asset.
- **IN-06** (CI): the action majors (`checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`) could NOT be verified from this machine (no network for the executor, and github.com was blocked in the browser pane). If the first CI run fails at "Set up job", check the tags first. Consider SHA pinning; `cancel-in-progress` on `main` can hide an earlier commit's failure.
- **IN-01** (`gitattributesProblems` presence-only), **IN-03** (Windows EPERM/EBUSY retry in `stage-basepath.mjs`), **IN-04** (relative noscript link, `LegacyQueryRedirect` re-reads the env instead of `withBasePath`), **IN-05** (origin check ignores the push URL), **IN-08** (weak tests: ISO output test cannot fail, the remote-contact grep only matches single quotes, the page-weight CLI test would write the real baseline if the reason check regressed), **IN-09** (manifest set dates use UTC; `freeze` ignores `--strict-dir` when the manifest exists): low-risk hardening, batch into one small task when convenient.
- **IN-10** (share fails silently without `navigator.clipboard`, redundant `finalParams` copy): the share flow is reworked in Phase 4.

## Acceptance Criteria

- [ ] Each item above is either fixed, or explicitly dropped with a reason, before the phase that names it closes

---
phase: 1
slug: foundations-and-safety-net
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (node env, `test.projects`: `engine`, `oracle`) + Playwright 1.63.0 (Chromium only, projects `chromium-utc`, `chromium-ny`) |
| **Config file** | `vitest.config.mts`, `playwright.config.ts` (none exist yet — Wave 0 installs) |
| **Quick run command** | `npm run test` (Vitest, about 1-3 s), then `npm run typecheck` (about 12 s) when TS/config changed |
| **Full suite command** | `npm run verify` (build + vitest + all `tsc` invocations + engine lint + Playwright against `out/`; needs Chromium) |
| **Estimated runtime** | quick ~15 s; full ~5-8 min (Playwright goldens dominate) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (+ `npm run typecheck` when TS or config changed)
- **After every plan wave:** Run the wave-specific commands in its plans plus `npm run test` and `npm run typecheck`; the full `npm run verify` chain first becomes runnable in Wave 5 (`check-repo.mjs`, `check:weight` and `test:e2e:basepath` arrive in 01-08, 01-06 and 01-05) and is the phase gate
- **Before `/gsd-verify-work`:** Full `npm run verify` green on this machine
- **Max feedback latency:** 30 seconds for the per-task quick run

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is the requirement-level contract each task must map into. The plan checker fills the Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|----------|-----------|-------------------|-------------|--------|
| 01-01 T1; 01-05 T2; 01-08 T2 | 01-01, 01-05, 01-08 | 1, 3, 5 | FND-01 | `npm run build` succeeds with no `zip`, emits static `out/`, leaves no tracked file modified | build + script | `npm run build && node scripts/check-repo.mjs --clean-tree` | ❌ W0 | ⬜ pending |
| 01-01 T2 | 01-01 | 1 | FND-01 | ES2022 root target and every `tsc` invocation pass | typecheck | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 01-01 T1; 01-06 T3; 01-08 T1 | 01-01, 01-06, 01-08 | 1, 4, 5 | FND-01 | LF endings in fixtures/goldens; `.gitattributes` present; CI workflow exists and calls `npm run verify` | script | `node scripts/check-repo.mjs` | ❌ W0 | ⬜ pending |
| 01-03 T1, T2 | 01-03 | 2 | FND-02 | Numeric oracle equals `app/data/*` derivation (Gt-15 = 5->6, Gt-03 = 2->3, 45 demons; kinds chrono 12 / amphi 24 / xeno 4 / syzygy 5; planetary constants) | unit | `npx vitest run --project oracle` | ❌ W0 | ⬜ pending |
| 01-04 T1, T2; 01-05 T3 | 01-04, 01-05 | 2, 3 | FND-02 | Visual-DOM goldens (3 non-planetary layouts x states) match against `next dev` (capture) and `serve out` | e2e | `npx playwright test e2e/golden.spec.ts` | ❌ W0 | ⬜ pending |
| 01-01 T2; 01-03 T2; 01-04 T2 | 01-01, 01-03, 01-04 | 1, 2 | FND-02 | Goldens identical under two TZ values | e2e + unit | `npm run test:tz`; Playwright `chromium-ny` project | ❌ W0 | ⬜ pending |
| 01-01 T3; 01-08 T1 | 01-01, 01-08 | 1, 5 | FND-02 | Baseline never overwritten (manifest hashes unchanged; clean `git diff` over goldens after tests) | script | `node scripts/check-repo.mjs` | ❌ W0 | ⬜ pending |
| 01-06 T1, T2 | 01-06 | 4 | FND-02 | Page-weight baseline within budget; DOM node counts per golden state | script | `npm run check:weight` | ❌ W0 | ⬜ pending |
| 01-05 T1-T3; 01-08 T1 | 01-05, 01-08 | 3, 5 | FND-03 | Export has no server route, no `vercel` or `api/share-image` strings, no foreign requests; `/?...` and `/numogram/?...` land on the numogram (also under the basePath env var) | e2e + script | `npx playwright test e2e/static-export.spec.ts`; `node scripts/check-repo.mjs --static-out` | ❌ W0 | ⬜ pending |
| 01-01 T2; 01-02 T1, T2 | 01-01, 01-02 | 1, 2 | FND-04 | `typecheck` fails when a DOM/Node type, bare import or `../app` import is added to `engine/` | unit (guard) | `npx vitest run engine/test/guard.test.ts` | ❌ W0 | ⬜ pending |
| 01-07 T1, T2; 01-08 T1-T3 | 01-07, 01-08 | 4, 5 | FND-05 | `git ls-files reference` empty; `origin` not `lumpenspace/ccru`; LICENSE + NOTICE (5 lore files listed); guard's failure paths | script + unit | `node scripts/check-repo.mjs`; `npx vitest run tests/repo` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts`, `playwright.config.ts`, `engine/tsconfig.json`, `engine/tsconfig.test.json`, `engine/index.ts`, `.eslintrc.json` engine override
- [ ] `engine/test/tz.test.ts` (canary), `engine/test/guard.test.ts`, `tests/oracle/base10.oracle.test.ts`, `tests/repo/check-repo.test.ts`
- [ ] `scripts/capture-base10-oracle.ts`, `scripts/page-weight.mjs`, `scripts/check-repo.mjs`
- [ ] `e2e/golden.spec.ts`, `e2e/static-export.spec.ts`
- [ ] Framework install at exact pins, `package-lock.json` committed, `npx playwright install chromium` (user approved 2026-09-25)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows + Ubuntu CI matrix actually runs green | FND-01 | CI runs only after the user pushes to `origin` (`https://github.com/foGledenalzi/CCRUGen.git`); no plan task pushes (CONTEXT D-05, D-07 as amended), so the workflow stays dormant during execution | After the user-approved push of the Phase 1 commits, confirm both matrix legs pass on GitHub; until then only the file's existence and `npm run verify` locally are checked |
| Licensing decision reads correctly (LICENSE holder line, NOTICE scope) | FND-05 | Legal wording is the user's call | User confirms the copyright holder (default `foGledenalzi`) and NOTICE scope wording |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (per-task quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

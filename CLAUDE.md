# CCRUG — Arbitrary-Base Numogram Generator

Static web app + pure TS engine that generates CCRU numograms for any even base (2 up to a measured ceiling), built on the
`lumpenspace/ccru` base-10 viewer. Base 10 becomes a preset of the new engine.

## Where the context lives (read before planning or coding)

- `.planning/PROJECT.md` — what/why, core value, scope, key decisions. `.planning/REQUIREMENTS.md` — 41 v1 requirements (traceability to phases).
- `.planning/ROADMAP.md` + `.planning/STATE.md` — 8 phases and current position. Next step is always `/gsd-progress` or `/gsd-next`.
- `.planning/research/SUMMARY.md` (+ STACK / FEATURES / ARCHITECTURE / PITFALLS) — pinned stack, build order, and pitfalls. Read PITFALLS before touching math or the base-10 data.
- `.planning/codebase/` — map of the pre-refactor repo (base-10 hard-coding inventory in CONCERNS.md). It is a snapshot of the starting point, not the target design.
- `reference/` — GITIGNORED local sources (CCRU book PDF/text, scraped web pages, the DIY-numogram guide). `reference/INDEX.md` maps it and holds the verified math. Never commit it, never paste long passages into tracked files, never read it from tests. Use Read with explicit paths (Grep may skip ignored dirs).

## Rules that matter

- **Correctness is the core value.** All arithmetic is in the numogram's own base (digital root of T(k) is `T===0 ? 0 : ((T-1) % (n-1)) + 1`, never decimal digit sums). Even bases only. Regions are `Cycle[]` — never assume a single Torque.
- **The base-10 oracle is frozen.** Once captured (Phase 1), the numeric golden JSON and DOM goldens are never regenerated with `-u` to make a test pass. Derive fixtures from definitions, not from the guide's prose (its demon subtype counts are wrong: 45 = 12+3 chrono, 12+12 amphi, 4+2 xeno).
- **`engine/` is pure**: no DOM or Node types, relative imports only, no O(n²) materialization (demons are virtual via mesh-number index math).
- **Static-first**: no server routes, Vercel Blob or Analytics. Stay on Next 14.2.35 (exact pin); no upgrade phase.
- **Scope**: v1 = core diagram + demons + naming builder + export. No pitch/Decadence/rites/correspondences.
- Do not edit `NumogramClient.tsx` before the Phase 1 oracle exists.

## Workflow

Use the GSD commands for project work (`/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N` → `/gsd-verify-work N`). Small fixes may go through `/gsd-fast` or `/gsd-quick`. Keep `.planning/` docs in sync via the GSD commands rather than hand edits.

## Environment

Windows 10, Node 22, npm 11 (npm only; `yarn.lock` is to be removed in Phase 1). Git identity for this repo is `foGledenalzi` (repo-local config; the global identity belongs to a different account, leave it alone). Remotes: `origin` = `https://github.com/foGledenalzi/CCRUGen.git`, `upstream` = `lumpenspace/ccru` with its push URL disabled. The user authorized ONE initial push of `main` on 2026-09-25 so a cloud session can continue. **Never `git push` again (any remote, any branch) unless the user explicitly says to**; pushing is user-approved and separate from all plans. Commits end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Resuming in a fresh or cloud session

- **Where we are:** Phase 1 is planned and verified (8 plans, 5 waves, `.planning/phases/01-foundations-and-safety-net/01-0N-PLAN.md`); execution has not started. Next step: `/gsd-execute-phase 1`, or `/gsd-progress` to re-orient. Read `.planning/STATE.md`, `ROADMAP.md` and `01-CONTEXT.md` (locked decisions D-01..D-17) first.
- **GSD** (v1.38.1) lives in the user's `~/.claude`, not in this repo. If the `/gsd-*` skills are missing in the new environment, follow the plan files by hand in wave order (01-01, then 01-02/03/04, 01-05, 01-06/07, 01-08); each task lists its own read_first, action and acceptance criteria.
- **`workflow.use_worktrees` is `false` on purpose:** plans assume one shared working tree (shared `node_modules`, and 01-08's `git rm --cached` of `dist/` and `demo.mov` would become real deletions if merged from a worktree). Do not turn it on for Phase 1.
- **`reference/` is absent in a fresh clone** (gitignored: CCRU book, guide, scraped pages). The verified math is in `.planning/PROJECT.md` and `.planning/research/`. Never recreate or commit it.
- **Install carefully until plan 01-01/01-08 land:** use `npm install --ignore-scripts --no-package-lock`; the `prepare` script rewrites tracked `dist/` files. Plan 01-01 introduces exact pins and `package-lock.json`.
- **Playwright Chromium** (~700 MB cache, 1.63.0) is needed for the DOM oracle: `npx playwright install chromium`, through the environment's normal permission prompt. Goldens are captured once from the untouched viewer and never regenerated with `-u`.

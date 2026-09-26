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
- The Phase 1 oracle exists, so `NumogramClient.tsx` may now be edited, but the DOM goldens capture only the projection `<svg>`: keep it byte-identical until the engine migration proves parity.
- **No upstream branding, ever.** The user ordered all old branding scrubbed (2026-09-25): no `qliphoth.systems` / "delight nexus" text or URLs, no upstream logo/wordmark, no gematria plugin. The identity is CCRUG (`public/ccrug-mark.svg`). The one deliberate exception is attribution: the README credit line and `NOTICE` for `lumpenspace/ccru` stay (the user kept it on purpose, since upstream has no license). Do not add new files that reintroduce the old names.

## Workflow

Use the GSD commands for project work (`/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N` → `/gsd-verify-work N`). Small fixes may go through `/gsd-fast` or `/gsd-quick`. Keep `.planning/` docs in sync via the GSD commands rather than hand edits.

## Environment

Windows 10, Node 22, npm 11 (npm only; there is no `yarn.lock`). Git identity for this repo is `foGledenalzi` with the GitHub no-reply email `333976650+foGledenalzi@users.noreply.github.com` (repo-local config, which is NOT cloned: set it in every fresh clone; GitHub rejects pushes that expose a private email, error GH007; never use a machine's global identity). Remotes: `origin` = `https://github.com/foGledenalzi/CCRUGen.git`, `upstream` = `lumpenspace/ccru` with its push URL disabled. Pushes happen only when the user explicitly asks (so far, all on 2026-09-25: the initial push, then the README and the handoff, then the Phase 1 completion commit 52fc8df; the user authorized that last one as "push after phase completion", so pushes at later phase completions still need a fresh OK unless the user says it is standing). **Never `git push` on your own initiative (any remote, any branch)**; pushing is user-approved and separate from all plans. Commits end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Resuming in a fresh or cloud session

- **Read first:** `.planning/STATE.md` (position and decisions), `.planning/ROADMAP.md`, and the open todos in `.planning/todos/pending/` (001 = UI declutter, 002 = deferred Phase 1 review findings). `/gsd-progress` re-orients. There is no pause handoff file at the moment; `/gsd-pause-work` writes one when needed.
- **Where we are:** Phase 1 (Foundations and Safety Net) is executed and independently verified (`.planning/phases/01-foundations-and-safety-net/01-VERIFICATION.md`, passed 15/15): frozen base-10 oracle, static export, engine boundary guard, licensing and repo guard. Next per STATE.md: todo 001 (strip the CRT overlay, intro splash and panel clutter without removing any functionality), then `/gsd-discuss-phase 2` (Engine Core and Base-10 Migration).
- **The full gate is `npm run verify`** (about 2 minutes): repo guard, typecheck (4x tsc + engine lint), unit tests in two timezones, sub-path e2e, build, page-weight budget, the e2e suite including the 60 DOM goldens, then the clean-tree/static-out guard. Run it before claiming anything is done. On Windows Git Bash prefix `MSYS_NO_PATHCONV=1`; the timezone is pinned with `CCRUG_TZ`, not `TZ`.
- **GSD** (v1.38.1) lives in the user's `~/.claude`, not in this repo. If the `/gsd-*` skills are missing in the new environment, follow the plan files by hand; each task lists its own read_first, action and acceptance criteria.
- **`workflow.use_worktrees` is `false` on purpose:** plans assume one shared working tree (shared `node_modules`, and git mutations such as untracking files would be lost or become real deletions if merged from a worktree).
- **`reference/` is absent in a fresh clone** (gitignored: CCRU book, guide, scraped pages). The verified math is in `.planning/PROJECT.md` and `.planning/research/`. Never recreate or commit it.
- **Install:** plain `npm install` (the `prepare` script builds the gitignored `dist/`).
- **Playwright Chromium** (~700 MB cache, 1.63.0) is needed for the DOM oracle: `npx playwright install chromium`, through the environment's normal permission prompt. The goldens were captured once from the untouched viewer and are never regenerated with `-u`.

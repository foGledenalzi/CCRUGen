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

Windows 10, Node 22, npm 11 (npm only; `yarn.lock` is to be removed in Phase 1). Git identity on this machine is `csysp`; `origin` still points at `lumpenspace/ccru` until repointed (FND-05). Commits end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

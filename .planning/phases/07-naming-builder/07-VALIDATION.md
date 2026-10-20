---
phase: 7
slug: naming-builder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `07-RESEARCH.md` section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (projects `engine` = `engine/**/*.test.ts` and `oracle` = `tests/**/*.test.ts`), fast-check 4.10.2, Playwright 1.63.0 (projects `chromium-utc`, `chromium-ny`) |
| **Config file** | `vitest.config.mts`, `playwright.config.ts` |
| **Quick run command** | `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming` and `npx cross-env CCRUG_TZ=UTC vitest run tests/app/panelStack tests/app/names`; `npm run typecheck` when types change; `node scripts/check-repo.mjs --only base-ten` after each new `app/` module (and `git add` new files first, the gate scans tracked files only) |
| **Full suite command** | `MSYS_NO_PATHCONV=1 npm run verify` (about 7 minutes) |
| **Estimated runtime** | about 10 seconds per unit file, 30 to 60 seconds per e2e spec, about 7 minutes for the full gate |

---

## Sampling Rate

- **After every task commit:** the quick commands for the touched module, plus `npm run typecheck` when types or exports change
- **After every plan wave:** `npm run typecheck`, `npm run check:repo`, `npm test` and `npm run test:tz`; after any `NumogramClient.tsx`, `usePanelDrag.ts` or `shareParams.ts` edit also `npm run test:swap`
- **Before `/gsd-verify-work`:** `MSYS_NO_PATHCONV=1 npm run verify` green
- **Max feedback latency:** about 10 seconds (unit), 30 to 60 seconds (touched e2e spec)

Sampling bases: 2, 4, 10, 12, 28, 64, 202, 666, 1024, 4000, 4002 (first seed-only base), 65536, 2^26. Exhaustive checks (distinct sounds, collisions, bijection) at 1024 and below plus one 4000 raw scan inside `verify`; lazy sampling (`soundAt`, `nameOf`, left-inverse parse) at 4002, 65536 and 2^26 - 1; e2e at 10, 28, 64 (SVG), 666 (Canvas), 4000 and 4002 (seed-only).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Populated from the plans once they exist. The requirement-to-test map in `07-RESEARCH.md` (NAM-01: PRNG vectors, Feistel bijection, distinct and prefix-stable sounds, locks, zone list at 4,000; NAM-02: derivation, hi-lo and lo-hi, layering, mesh keys, euphony, name display; NAM-03: validator, export and import identity, collision certificate and scan, `names=` codec, preview and autosave; NAM-04: the CCRU preset; plus the desktop panel stack that closes todo 008, and the `sounds` label fit) is the source for every row.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `engine/test/naming.{prng,feistel,generate,text,euphony,derive,collisions,schema,vectors}.test.ts`
- [ ] `tests/app/{panelStack,shareParamsNames,namingSession,namingStorage,soundLabels,cyberControlsMarkup,namesPanelRender}.test.ts`
- [ ] `e2e/{names-panel,names-io,names-preview,names-labels,panel-stack}.spec.ts`
- [ ] No framework install needed (no new dependency)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Style banks contact-sheet sign-off (harsh, soft, syllabic at bases 10, 28, 64, 666, 4000, raw and smoothed) | NAM-01 (D-04) | Whether generated sounds look and feel right is a taste judgement; the structure and capacity are measured, the look is not | Open the contact sheet the plan produces, judge the three styles, approve or request bank changes; only after approval are sha256 digests of the sound tables pinned (never update a digest to make a test pass) |
| Screen-reader pass on the Names panel (zone list, lock toggles, generation and import announcements, collision jump into the inline editor) | NAM-01..NAM-03 (UI-SPEC accessibility) | Live-region behaviour differs per screen reader and cannot be automated here | With NVDA or VoiceOver at base 28, Tab through the panel, edit a sound, lock a zone, reroll, import a file, jump from a collision; each action should be announced once |
| The desktop panel stack by eye at larger bases | Stack (todo 008) | The e2e geometry hooks assert boxes, not how it feels | At 1280 x 800 open `/numogram/`, type 28 in the picker, collapse and expand panels, drag one, open Names: no panel covers another, the zoom toolbar and shortcuts button stay clear |
| Narrow windows (375 x 667 and 768 x 1024) with the Names panel first in the mobile stack | NAM-01 (UI-SPEC) | Reachability and the look of the stack are judged by eye | Open `?base=28` at both widths: Names is first and reachable with default panels, no panel overlaps another or the zoom toolbar, no horizontal scroll |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per touched spec
- [ ] `nyquist_compliant` is set to true in the frontmatter

**Approval:** pending

---
phase: 7
slug: naming-builder
status: approved
nyquist_compliant: true
wave_0_complete: true
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

`V` below abbreviates `npx cross-env CCRUG_TZ=UTC vitest run`; `PW` abbreviates `npm run build && npx playwright test`. "Created by 07-NN" means the test file does not exist yet and is written (test first) by that plan's task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 01 | 1 | NAM-01 | T-07-01 | Integer-only PRNG and Feistel frozen by Appendix B vectors and BigInt oracles | unit | `V engine/test/naming.prng.test.ts engine/test/naming.feistel.test.ts --project engine` | created by 07-01 | ✅ green |
| 07-01-T2 | 01 | 1 | NAM-01 | T-07-01, T-07-02 | Distinct, prefix-stable, lazy sounds; bounded indices; locks + spare stream, no retry | unit | `V engine/test/naming.generate.test.ts --project engine` | created by 07-01 | ✅ green |
| 07-02-T1 | 02 | 1 | NAM-01 | T-07-03, T-07-18 | Letters-and-marks rule refuses Cf/controls; seeds refuse Cc/Zl/Zp; anchored regexes | unit | `V engine/test/naming.text.test.ts --project engine` | created by 07-02 | ✅ green |
| 07-02-T2 | 02 | 1 | NAM-02 | T-07-18 | euphony@1 linear, idempotent, insert-only; smoothingInert property | unit | `V engine/test/naming.euphony.test.ts --project engine` | created by 07-02 | ✅ green |
| 07-03-T1 | 03 | 1 | NAM-01 | T-07-21 | Live stack equals the old formula (20,000 random height sets); Names slot and body room | unit | `V tests/app/panelStack.test.ts --project oracle` | created by 07-03 | ✅ green |
| 07-03-T2 | 03 | 1 | NAM-01 | T-07-16 | z cap 69 keeps panels under toolbar/overlay/dropdown; drag seed from displayed position | unit | `V tests/app/panelDrag.test.ts --project oracle` | created by 07-03 | ✅ green |
| 07-04-T1 | 04 | 1 | NAM-01 | T-07-22, T-07-13 | dataAttrs passes only data- keys; default Cyber markup byte-identical | unit | `V tests/app/cyberControlsMarkup.test.ts tests/app/demonsOverlayRender.test.ts --project oracle` | created by 07-04 (cyberControlsMarkup); demonsOverlayRender exists | ✅ green |
| 07-04-T2 | 04 | 1 | NAM-01 | — | LockIcon shapes; CSS modifiers added without editing existing rules | unit | `V tests/app/cyberControlsMarkup.test.ts --project oracle` | created by 07-04 | ✅ green |
| 07-05-T1 | 05 | 2 | NAM-02 | T-07-12, T-07-02b | Preset is an argument (no lore in engine); O(1) lazy resolver; mesh keys | unit | `V engine/test/naming.derive.test.ts --project engine` | created by 07-05 | ✅ green |
| 07-05-T2 | 05 | 2 | NAM-01 | T-07-03b, T-07-20 | Edit ops re-validate text; shared unchanged parts; purity probe under engine/naming | unit | `V engine/test/naming.edit.test.ts engine/test/guard.test.ts --project engine` | created by 07-05 (naming.edit); guard exists | ✅ green |
| 07-06-T1 | 06 | 2 | NAM-01 | T-07-12b | Contact sheet deterministic, gitignored, no canonical names | unit | `V tests/presets/naming-sheet.smoke.test.ts --project oracle` | created by 07-06 | ✅ green |
| 07-06-T2 | 06 | 2 | NAM-01 | T-07-15 | User sign-off on the banks (incl. keep or drop the eight CCRU clusters) before any digest; pauses wave 2 (blocking checkpoint) | manual + unit | `V engine/test/naming.generate.test.ts --project engine` | exists after 07-01 (sizes edited only if banks change) | ✅ green |
| 07-06-T3 | 06 | 2 | NAM-01 | T-07-01b | 30 table digests + 12 lazy samples pinned, never updated to pass | unit | `V engine/test/naming.vectors.test.ts --project engine` | created by 07-06 | ✅ green |
| 07-07-T1 | 07 | 2 | NAM-01 | T-07-13b | Live stack in the viewer; frozen baseline and goldens unchanged | swap | `npm run typecheck && npm run test:swap` | exists | ✅ green |
| 07-07-T2 | 07 | 2 | NAM-01 | T-07-16b | Todo 008 regression (every Torque row, Warp, Plex clickable at base 202), drag no-jump, collapse follow, z cap in the browser | e2e | `PW e2e/panel-stack.spec.ts e2e/region-legend.spec.ts e2e/canvas-interaction.spec.ts e2e/layers-zoom.spec.ts e2e/canvas-tier.spec.ts e2e/row-click-regression.spec.ts` | created by 07-07 (panel-stack); others exist | ✅ green |
| 07-08-T1 | 08 | 3 | NAM-03 | — | Deterministic versioned JSON, no clock | unit | `V engine/test/naming.schema.test.ts --project engine` | created by 07-08 | ✅ green |
| 07-08-T2 | 08 | 3 | NAM-03 | T-07-04, T-07-05, T-07-08, T-07-03c | Prototype-safe Map overrides, byte and count caps, non-recursive, never throws | unit | `V engine/test/naming.schema.test.ts --project engine` | created by 07-08 | ✅ green |
| 07-09-T1 | 09 | 3 | NAM-03 | T-07-07, T-07-02c | Hostile names= falls back; kept above the ceiling with no numogram built | unit + swap | `V tests/app/shareParamsNames.test.ts tests/app/shareParams.test.ts tests/app/shareParamsHeadless.test.ts --project oracle && npm run test:swap` | created by 07-09 (shareParamsNames); others exist | ✅ green |
| 07-09-T2 | 09 | 3 | NAM-01 | T-07-14 | Worker guard accepts sounds (no build-failed revert) | unit | `V tests/app/labelScheme.test.ts tests/app/workerCore.test.ts tests/app/shareParams.test.ts --project oracle && npm run typecheck` | exists | ✅ green |
| 07-10-T1 | 10 | 4 | NAM-03 | T-07-06, T-07-23 | Exact counts, bounded lists, resumable scan without a clock, scan refused above COLLISION_SCAN_MAX_N (bounded no-O(n^2) exception); brute-force differential | unit | `V engine/test/naming.collisions.test.ts --project engine` | created by 07-10 | ✅ green |
| 07-11-T1 | 11 | 4 | NAM-04 | T-07-12c, T-07-06b | CCRU preset by reference; scan limit capped by the tier table | unit | `V tests/presets/namingPreset.test.ts tests/presets/base10-adapter.test.ts tests/app/namingLimits.test.ts --project oracle` | created by 07-11 (namingPreset, namingLimits) | ✅ green |
| 07-11-T2 | 11 | 4 | NAM-03 | T-07-19 | Echoes clipped; copy equals the UI-SPEC; no em dash | unit | `V tests/app/namingCopy.test.ts --project oracle` | created by 07-11 | ✅ green |
| 07-12-T1 | 12 | 5 | NAM-01 | T-07-10, T-07-13c, T-07-19b | Sounds as text nodes; SVG default path byte-identical | unit + swap | `V tests/app/soundLabels.test.ts tests/app/projectionRender.test.ts --project oracle && npm run test:swap` | created by 07-12 (soundLabels); projectionRender exists | ✅ green |
| 07-12-T2 | 12 | 5 | NAM-01 | — | Sounds radio and Labels-panel wording; default strings unchanged | unit | `V tests/app/labelsPanelSounds.test.ts tests/app/basePickerRender.test.ts --project oracle && npm run typecheck` | created by 07-12 (labelsPanelSounds) | ✅ green |
| 07-13-T1 | 13 | 5 | NAM-03 | T-07-17 | Preview refuses actions; nothing saved before the first edit | unit | `V tests/app/namingSession.test.ts --project oracle` | created by 07-13 | ✅ green |
| 07-13-T2 | 13 | 5 | NAM-03 | T-07-08b, T-07-09 | Slot read/write never throws; corrupt/foreign/oversized slot ignored | unit | `V tests/app/namingStorage.test.ts --project oracle && npm run typecheck` | created by 07-13 | ✅ green |
| 07-14-T1 | 14 | 6 | NAM-01 | T-07-13d | Both Canvas passes use one fit (no ghosting); digits path unchanged | unit | `V tests/app/canvasDraw.test.ts --project oracle` | exists (extended) | ✅ green |
| 07-14-T2 | 14 | 6 | NAM-02 | T-07-19c | Text-only announcements; chord callout `a::b · Name` (net-span kept) | unit | `V tests/app --project oracle && npm run typecheck` | exists (canvasKeyboard, canvasDiagramModel extended) | ✅ green |
| 07-15-T1 | 15 | 6 | NAM-02 | T-07-10b, T-07-03d | Render-time names as text nodes; provider-less output unchanged | unit | `V tests/app --project oracle && npm run typecheck` | created by 07-15 (namesDisplayRender) | ✅ green |
| 07-15-T2 | 15 | 6 | NAM-02 | T-07-06c | Live-name search within the 50,000 cap | unit | `V tests/app/demonSearch.test.ts tests/app/demonBrowserRender.test.ts --project oracle && npm run typecheck` | exists (extended) | ✅ green |
| 07-17-T1 | 17 | 6 | NAM-01 | — | Panel states derived from the base; carrier always mounted; body only when open | unit | `V tests/app/namesPanelRender.test.ts --project oracle && npm run typecheck` | created by 07-17 | ✅ green |
| 07-17-T2 | 17 | 6 | NAM-03 | T-07-05b, T-07-04b, T-07-17c | File size checked before reading; all-or-nothing import; inline Undo | unit | `V tests/app/namesPanelRender.test.ts --project oracle && npm run typecheck` | created by 07-17 | ✅ green |
| 07-16-T1 | 16 | 7 | NAM-02 | T-07-03e | Rename validated (letters, 1..32, NFC) | unit | `V tests/app/demonNameEditorRender.test.ts --project oracle && npm run typecheck` | created by 07-16 | ✅ green |
| 07-16-T2 | 16 | 7 | NAM-02 | T-07-17b | Editor disabled in preview; overlay pane bound while editing | unit | `V tests/app --project oracle && npm run typecheck` | created by 07-16 | ✅ green |
| 07-19-T1 | 19 | 7 | NAM-01 | T-07-17e | All-or-nothing paste plan | unit | `V tests/app/zoneListModel.test.ts --project oracle` | created by 07-19 | ✅ green |
| 07-19-T2 | 19 | 7 | NAM-01 | T-07-03f, T-07-02d | Validated commits; virtualized rows at the ceiling | unit | `V tests/app --project oracle && npm run typecheck` | exists after 07-17 (extended) | ✅ green |
| 07-18-T1 | 18 | 8 | NAM-03 | T-07-20c, T-07-11 | rev history key; actions from sessionRef (no updater-side flag); short undo for heavy namings; batched base-switch load; provider at every tier | swap + e2e | `npm run typecheck && npm run test:swap`; behaviour: `PW e2e/names-session.spec.ts` (07-18-T3) | exists; names-session created by 07-18 | ✅ green |
| 07-18-T2 | 18 | 8 | NAM-03 | T-07-17d, T-07-08c | Preview never overwrites; bare-URL and query loads restore the slot; hydrated naming never undoable (historyNamingAdoptRef) while the frozen post-load entry stays; autosave after the first edit only | unit + swap + e2e | `V tests/app/historyHydration.test.ts --project oracle && npm run typecheck && npm run test:swap`; behaviour: `PW e2e/names-session.spec.ts` (07-18-T3 cases c, d, e) | created by 07-18 (historyHydration) | ✅ green |
| 07-18-T3 | 18 | 8 | NAM-02 | T-07-13e | Pre-naming e2e assertions rewritten, not skipped; rename, undo/redo, base switch and reload restore proven | e2e | `PW e2e/demons-browser.spec.ts e2e/demons-matrix.spec.ts e2e/demons-focus.spec.ts e2e/hover-pin.spec.ts e2e/names-session.spec.ts` | exists (rewritten); names-session created by 07-18 | ✅ green |
| 07-20-T1 | 20 | 8 | NAM-03 | T-07-11b | Cancellable sliced scheduling; plan certify/scan/skip; app scan limit <= engine COLLISION_SCAN_MAX_N | unit | `V tests/app/collisionSchedule.test.ts --project oracle` | created by 07-20 | ✅ green |
| 07-20-T2 | 20 | 8 | NAM-03 | T-07-06d, T-07-10e | No worker; stale results impossible; jump never pins | unit | `V tests/app --project oracle && npm run typecheck` | exists after 07-17 (extended) | ✅ green |
| 07-21-T1 | 21 | 9 | NAM-01 | T-07-13f, T-07-16c | Names mount post-baseline; Share title unchanged without uncarried edits | swap | `npm run typecheck && npm run test:swap` | exists | ✅ green |
| 07-21-T2 | 21 | 9 | NAM-01 | T-07-02e | Mount at every tier; seed-only by base | e2e | `PW e2e/names-smoke.spec.ts` | created by 07-21 | ✅ green |
| 07-22-T1 | 22 | 10 | NAM-01, NAM-02 | T-07-24 | Expectations computed through the engine | e2e | `PW e2e/names-panel.spec.ts` | created by 07-22 | ✅ green |
| 07-22-T2 | 22 | 10 | NAM-01 | T-07-24 | Sounds labels on both tiers, LOD, URL round trip | e2e | `PW e2e/names-labels.spec.ts` | created by 07-22 | ✅ green |
| 07-23-T1 | 23 | 10 | NAM-03, NAM-04 | T-07-04d, T-07-05c, T-07-09b | Hostile files refused; quota failure handled; reload restore (query and bare URL); CCRU preset only at base 10 | e2e | `PW e2e/names-io.spec.ts` | created by 07-23 | ✅ green |
| 07-23-T2 | 23 | 10 | NAM-03 | T-07-17f | Preview keeps the slot byte-identical; Keep undoable | e2e | `PW e2e/names-preview.spec.ts` | created by 07-23 | ✅ green |
| 07-24-T1 | 24 | 10 | NAM-01 | T-07-16d | No-overlap matrix (bases 10, 28, 64, Canvas 202), toolbar and planetary clearance, mobile geometry | e2e | `PW e2e/panel-stack.spec.ts e2e/canvas-interaction.spec.ts e2e/layers-zoom.spec.ts e2e/canvas-tier.spec.ts e2e/row-click-regression.spec.ts e2e/region-legend.spec.ts` | exists after 07-07 (extended) | ✅ green |
| 07-24-T2 | 24 | 10 | NAM-01 | T-07-25 | Budget raised only via `update --reason`; domNodes unchanged | budget | `npm run build && node scripts/page-weight.mjs check` | exists | ✅ green |
| 07-25-T1 | 25 | 11 | NAM-01..04 | T-07-13g, T-07-12d | Full gate with every frozen oracle untouched; todo 008 closed | full gate | `MSYS_NO_PATHCONV=1 npm run verify` | exists | ✅ green |
| 07-25-T2 | 25 | 11 | NAM-01..04 | T-07-15b | Manual-only checks signed off (blocking checkpoint) | manual | `grep -c "Manual-Only Verifications" .planning/phases/07-naming-builder/07-VALIDATION.md` | exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files that do not exist yet; each is written test-first by the task that needs it (no separate scaffold wave is needed because every task creates its own tests before the implementation).

- [x] `engine/test/naming.prng.test.ts`, `naming.feistel.test.ts`, `naming.generate.test.ts` (07-01)
- [x] `engine/test/naming.text.test.ts`, `naming.euphony.test.ts` (07-02)
- [x] `tests/app/panelStack.test.ts`, `tests/app/panelDrag.test.ts` (07-03)
- [x] `tests/app/cyberControlsMarkup.test.ts` (07-04)
- [x] `engine/test/naming.derive.test.ts`, `naming.edit.test.ts` (07-05)
- [x] `tests/presets/naming-sheet.smoke.test.ts`, `engine/test/naming.vectors.test.ts` (07-06)
- [x] `e2e/panel-stack.spec.ts` (07-07)
- [x] `engine/test/naming.schema.test.ts` (07-08)
- [x] `tests/app/shareParamsNames.test.ts` (07-09)
- [x] `engine/test/naming.collisions.test.ts` (07-10)
- [x] `tests/presets/namingPreset.test.ts`, `tests/app/namingLimits.test.ts`, `tests/app/namingCopy.test.ts` (07-11)
- [x] `tests/app/soundLabels.test.ts`, `tests/app/labelsPanelSounds.test.ts` (07-12)
- [x] `tests/app/namingSession.test.ts`, `tests/app/namingStorage.test.ts` (07-13)
- [x] `tests/app/namesDisplayRender.test.ts` (07-15)
- [x] `tests/app/demonNameEditorRender.test.ts` (07-16)
- [x] `tests/app/namesPanelRender.test.ts` (07-17)
- [x] `tests/app/zoneListModel.test.ts` (07-19)
- [x] `tests/app/collisionSchedule.test.ts` (07-20)
- [x] `e2e/names-session.spec.ts`, `tests/app/historyHydration.test.ts` (07-18)
- [x] `e2e/names-smoke.spec.ts` (07-21)
- [x] `e2e/names-panel.spec.ts`, `e2e/names-labels.spec.ts` (07-22)
- [x] `e2e/names-io.spec.ts`, `e2e/names-preview.spec.ts` (07-23)
- [x] No framework install needed (no new dependency)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Style banks contact-sheet sign-off (harsh, soft, syllabic at bases 10, 28, 64, 666, 4000, raw and smoothed) | NAM-01 (D-04) | Whether generated sounds look and feel right is a taste judgement; the structure and capacity are measured, the look is not | Plan 07-06 Task 2: open `.review/naming-sheet.html`, judge the three styles, approve or request bank changes; only after approval are sha256 digests of the sound tables pinned (never update a digest to make a test pass). **Outcome: approved 2026-11-09 (plan 07-06, two rounds: the harsh bank revised once to drop the eight verbatim CCRU zone sounds, then approved; soft and syllabic approved as shown).** |
| Screen-reader pass on the Names panel (zone list, lock toggles, generation and import announcements, collision jump into the inline editor) | NAM-01..NAM-03 (UI-SPEC accessibility) | Live-region behaviour differs per screen reader and cannot be automated here | Plan 07-25 Task 2 check 1: with NVDA or VoiceOver at base 28, Tab through the panel, edit a sound, lock a zone, reroll, import a file, jump from a collision; each action should be announced once **Outcome: not reported by the user (2026-11-23: the user directed the phase to close and the push); carried to `07-VERIFICATION.md` human_verification item 1. After this check was written the live carrier was changed to re-announce identical texts (review WR-08).** |
| The desktop panel stack by eye at larger bases | Stack (todo 008) | The e2e geometry hooks assert boxes, not how it feels | Plan 07-25 Task 2 check 2: at 1280 x 800 open `/numogram/`, type 28 in the picker, collapse and expand panels, drag one, open Names: no panel covers another, the zoom toolbar and shortcuts button stay clear **Outcome: the user reviewed the viewer by eye on 2026-11-15 (base 666, a 2000 px wide window) and reported two defects, a hard box clipping the zoomed Canvas diagram and a crowded header with clashing type; both fixed (commits 1425bd4 and e7071e8 to f10c305) and re-verified in the browser pane. No panel overlap was reported. A look at the 68 px Names minimum in a short window remains in `07-VERIFICATION.md`.** |
| Narrow windows (375 x 667 and 768 x 1024) with the Names panel first in the mobile stack | NAM-01 (UI-SPEC) | Reachability and the look of the stack are judged by eye | Plan 07-25 Task 2 check 3: open `?base=28` at both widths: Names is first and reachable with default panels, no panel overlaps another or the zoom toolbar, no horizontal scroll **Outcome: while diagnosing the user's header report the orchestrator found the Undo, Redo, Share and Filter buttons pushed off the right edge of a 375 px window and fixed it (1425bd4), plus the Base dropdown clamp (review WR-09); the 375 x 667 and 768 x 1024 geometry is proven by `e2e/panel-stack.spec.ts`. An eye check on a real phone width remains in `07-VERIFICATION.md`.** |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every one of the 51 rows has an automated command; the two manual rows, 07-06-T2 and 07-25-T2, also carry one)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (every file in the list exists; checked 2026-11-11)
- [x] No watch-mode flags (every command uses `vitest run` or `playwright test`)
- [x] Feedback latency < 60s per touched spec (measured in the 07-25 gate, chromium-utc project: every touched spec runs in under 60 s except `e2e/panel-stack.spec.ts`, 62 geometry cases that take 144 s together (1 to 5 s each, so a filtered run with `-g` is seconds), and the frozen `e2e/behaviour.spec.ts` at 124 s, which is Phase 1 and was not touched)
- [x] `nyquist_compliant` is set to true in the frontmatter

**Approval:** approved 2026-11-23 by the user's direction to push and begin the next phase after the two reported defects were fixed (the user did not answer the screen-reader check or the [default] decisions individually); the outstanding human checks are carried in `07-VERIFICATION.md`.

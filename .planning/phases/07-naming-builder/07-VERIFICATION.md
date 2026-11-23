---
phase: 07-naming-builder
verified: 2026-11-23T00:00:00Z
status: human_needed
score: 15/15 must-haves verified (automated and by code reading); 6 human checks outstanding, 0 blocking gaps
overrides_applied: 0
re_verification: false
gaps: []
deferred: []
advisories:
  - id: A1
    severity: low-medium
    what: "The collision report scans typed, imported and CCRU tables only up to 1,024 zones (NAMING_COLLISION_SCAN_MAX_N); between 1,025 and the 4,000 ceiling a table the certificate cannot prove unique shows 'Not checked above 1024 zones.' Generated tables are certified at every base."
  - id: A2
    severity: low
    what: "07-REVIEW-FIX.md and todo 010 say 12 info items were fixed and 15 left; the commits and the table show 10 fixed (IN-01, 04, 05, 16, 17, 19, 20, 21, 22, 26) and todo 010 lists 17. All 27 are accounted for (10 + 17), so nothing is lost, but the counts in both documents are wrong."
  - id: A3
    severity: low
    what: "Paint-surface fix (e7071e8..f10c305, files CanvasDiagram.tsx, draw.ts, viewTransform.ts) was excluded from the Phase 7 code review while it was being edited; it is covered by its own unit, e2e and mutation checks only."
  - id: A4
    severity: info
    what: "CANVAS_SURFACE_AREA_LIMIT_PX = 8_388_608 is a literal in app/lib/canvas/viewTransform.ts, not a tier-table field (it is a memory bound, not a tier boundary)."
  - id: A5
    severity: info
    what: "The Names body can be 68 px, not the 80 px the UI-SPEC states, when the clamp binds (Selection at its 52vh cap in a window under about 708 px tall); logged in deferred-items.md, awaiting the user's call."
  - id: A6
    severity: info
    what: "Bookkeeping still open: ROADMAP 07-25 box, REQUIREMENTS NAM-01..04 rows, 07-VALIDATION status draft and CLAUDE.md (still lists todo 008 as open and Phase 7 as next, no mention of todo 010)."
human_verification:
  - test: "Screen-reader pass on the Names panel (NVDA or VoiceOver) at ?base=28 on the built app (npm run build, npm start): expand Names, Tab through the controls and the zone list, edit a sound (Enter), lock a zone, press Reroll unlocked sounds, export then import the file, type the same sound into two zones and jump from the collision line into the inline editor, rename a demon, press Undo twice."
    expected: "Each action is announced once with the visible wording; two identical consecutive announcements (second Undo, second Export) are read again (WR-08, nonce-keyed node inside the single role=status carrier); the rename burst ('N repeated names.' / 'Renamed ...' / new count) is audible and not silently dropped; focus order is sensible and the focused sound row keeps focus while scrolling (WR-06)."
    why_human: "Live-region behaviour differs per screen reader and cannot be automated here; the user has never reported this pass (07-VALIDATION Manual-Only row 2, 07-25 Task 2 check 1)."
  - test: "Desktop panel stack by eye at 1280 x 800: open /numogram/, type 28 in the base picker, collapse and expand panels, drag one, open Names (also try a short window about 700 px tall with a demon pinned)."
    expected: "No panel covers another, collapsing pulls the panels below it up, a dragged panel does not jump on the first move, Names opens under Selection without moving anything, the zoom toolbar and the shortcuts button stay clear and clickable. In the short window the Names body is about 68 px (header plus about 1.6 rows): decide whether that is acceptable (advisory A5)."
    why_human: "The e2e geometry hooks (62 cases in e2e/panel-stack.spec.ts plus 3 todo-008 tests) assert boxes, not how the stack feels (07-VALIDATION Manual-Only row 3, 07-25 Task 2 check 2)."
  - test: "Narrow windows: open ?base=28 at 375 x 667 and 768 x 1024; open the Base picker dropdown at 375 wide."
    expected: "Names is first in the stack and reachable with the default panels, no panel overlaps another or the zoom toolbar, no horizontal scroll, the dropdown stays inside the screen (WR-09), the header keeps the brand and the Undo, Redo, Share and Filter buttons on screen (commit 1425bd4)."
    why_human: "Reachability and the look of the mobile stack are judged by eye (07-VALIDATION Manual-Only row 4, 07-25 Task 2 check 3)."
  - test: "Header against the layout switcher between 821 and about 1300 px: measure at 900, 1100 and 1280 px wide with a base-10 and a base-28 layout bar."
    expected: "The fixed 480 px header (left 12, z 46) does not cover the leftmost layout-switcher buttons (a 7-button bar centred at z 40). CSS arithmetic suggests the header reaches x 492 and an overlap is possible below about 1264 px; the geometry is unchanged since 0f25f1b, so this is pre-existing, but it was estimated and never measured (todo 010 IN-25)."
    why_human: "Needs a real layout measurement in a browser; the review's figure came from CSS arithmetic."
  - test: "Sounds label mode by eye: Labels panel, Sounds radio, at base 28 (SVG), 202 and 666 (Canvas), zoom in and out, pan, then open the URL round trip (labels=sounds)."
    expected: "Sounds are legible inside the nodes, long sounds shrink then end in an ellipsis (6 px floor), a highlighted node's label does not ghost over the static one, a zoomed diagram fills the viewport with no clipped box (paint-surface fix), digits stay on the pair graph and the planetary layout."
    why_human: "Legibility and visual fit are taste judgements; the user reviewed base 666 on 2026-11-15, found the header and the zoom box, both since fixed and re-checked in the browser pane, but has not seen the final tree."
  - test: "IME composition and the decisions list: type Japanese or Chinese through an IME into the seed field and a zone sound (WR-07); then answer the [default] decisions of 07-25-SUMMARY (items 5, 13, 21, 27, 28) plus advisory A1 (collision scan limit 1,024 against the 4,000 ceiling) and the Canvas chord callout that now reads 'a::b · Name' (decision 12)."
    expected: "Enter and Escape during composition neither commit nor revert; the user confirms or changes each default (bank licensing choice, name-search extension, refused-Undo behaviour, 68 px minimum, page-weight raise of 22.7% raw over the pre-Phase-6 baseline with todo 007 as the alternative)."
    why_human: "A real IME is not simulated by the tests; the defaults are product decisions, not facts."
---

# Phase 7: Naming Builder Verification Report

**Phase Goal:** Users can name the zones of any base and get derived demon names, edit and share them, and load the canonical CCRU names for base 10
**Verified:** 2026-11-23 (HEAD 38c2faa; the last source change is fb9ae32, HEAD adds only 07-REVIEW-FIX.md)
**Status:** human_needed
**Re-verification:** No, initial verification

The automated and code-level checks all pass and no blocking gap was found. The status is `human_needed` because the Phase 7 manual checkpoint (plan 07-25 Task 2: screen reader, desktop stack by eye, narrow windows, review of the [default] decisions) was never signed off (07-VALIDATION.md still says `status: draft`, approval pending; ROADMAP still shows 07-25 unticked). The decision tree makes any outstanding human item win over `passed`.

## How this was verified

I did not rely on the SUMMARY files. I read the engine and app code, re-ran focused unit suites, and wrote three throwaway scripts (kept in the session scratchpad, nothing written to the repo) that drive the real engine and app modules through `tsx`.

- Focused re-runs on this tree, UTC: `engine/test/naming*` + `engine/test/guard.test.ts` = 11 files, 672 tests passed; 14 app and preset files (naming session, storage, links, panel stack and drag, history, copy, demon search, zone list, panel render, sound labels, CCRU preset, banks-lore, demon names) = 760 passed; 17 cross-phase files (Canvas draw, view, surface, diagram model, keyboard, worker core, base picker, labels, projection render, overlay, row list, names display, name editor, collision schedule, label scheme, share params) = 776 passed. `node scripts/check-repo.mjs` = OK (all 11 checks incl. goldens, lore, base-ten, origin).
- The full gate log (`verify-review-fix.log`) was read: exit 0, `Test Files 119 passed`, `Tests 4098 passed` in both timezones, sub-path e2e 12 passed, `page-weight: OK`, e2e `368 skipped`, `440 passed (10.5m)`, final `check-repo ... clean-tree, static-out` OK, `EXIT=0`. `git diff --stat f756fb3 38c2faa` shows one file, the docs-only REVIEW-FIX report, so the gated tree equals HEAD for source.
- Independent engine checks (scratch script 1): for each of the three styles at bases 28, 64, 202 and 666, both join orders and both smoothing values (48 combinations), a brute-force pass over every demon found 0 duplicate names, and `provablyUnique` was true every time. The same seed gave the same 300-zone table twice. Editing zone 5 and locking zone 7, then changing seed and style, kept both locked sounds. A saved file round-trips to the same sounds, and the same file at base 30 is refused with a `wrong-base` issue that carries an `offerSeed`.
- Independent app checks (scratch script 2): the base-10 default naming reproduces all 45 canonical names (`CCRU_NAMING_PRESET.names === DEMON_NAMES`, same object, so by reference); 9::8 is `Ummnu` and 1::0 is `Lurgo` with state `preset`; base 12 defaults to the generated source, `presetNameOf` is null and no canonical name appears; one override changed exactly one demon of 45; `names=ccru` parses to `null` at base 12 and `{kind:'ccru'}` at base 10; a `names=seed:` link against a different saved slot opens as a preview that keeps the slot object and refuses every edit; a base-4002 naming has `sounds === null` and still names 4001::4000, and base 2^26 names 67108863::5 with no table.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: the user edits a per-zone sound table or generates one for any base from a seed; the same seed gives the same table; locked zones survive regeneration | VERIFIED | `engine/naming/generate.ts:100` `generateSounds` (lock map kept, spare sounds from outside [0, base)); `engine/naming/edit.ts:69` `editSound` (locks the zone), `:113` `setSeed`, `:120` `setStyle`, both regenerate through `lockedMap`. Scratch script 1: determinism true, locks survived a reseed and a restyle. UI: `app/components/names/ZoneList.tsx` (virtualized rows, lock toggle, paste), `NamesPanel.tsx` (seed field, Reroll via `rerollSeed` which only picks the new seed, the engine stays deterministic). Tests: `naming.generate`, `naming.edit`, `naming.vectors` (30 pinned table digests + 12 lazy samples, never regenerated), `zoneListModel`, `namesPanelRender`; e2e `names-panel.spec.ts` (20). |
| 2 | SC2: demon names derive from net-span sounds, high-then-low by default with low-then-high as an option, and the user can override one demon without touching the rest | VERIFIED | `engine/naming/derive.ts:30` `deriveName`, `:93` `createNameResolver` (override > preset > rule; O(1); mesh-number keys; zones checked against the base first). `types.ts:11` `JoinOrder = 'hi-lo' | 'lo-hi'`, default `'hi-lo'` (`derive.ts:49`). `edit.ts:159` `setOverride` (sparse Map; an override equal to what the rule gives removes itself). Scratch script 2: one override changed exactly 1 of 45 demons, state `overridden`. UI: `DemonNameEditor.tsx` mounted from `InfoDisplay.tsx` and `CollisionReport.tsx`, with reset to generated. |
| 3 | SC3: naming data exports and imports as versioned JSON, a wrong-base file is rejected with a message, the URL carries only a preset or seed, and collisions are listed visibly | VERIFIED (see advisory A1) | `engine/naming/schema.ts:18` `ccrug.naming/1`, `:50` `serializeNaming` (deterministic, seed-only bases write the seed record alone); `engine/naming/validate.ts:376` `validateNamingJson` (hand-written, own-property reads, decimal-key Map for overrides so `__proto__` cannot land, 8 MiB and 250,000-override caps, `wrong-base` at `:190` with a seed offer). `app/lib/namesLink.ts` (`names=ccru` or `names=seed:` plus `nstyle`, `njoin`, `nsmooth`; never sounds, locks or overrides); `NamesPanel.tsx:281` `readImportFile` checks `file.size` before reading, all-or-nothing, inline Undo. `CollisionReport.tsx` + `collisionSchedule.ts` (certificate or sliced scan, jumps to the inline editor, nothing repaired). Scratch script 1 round trip and wrong base confirmed. e2e `names-io.spec.ts` (32), `names-preview.spec.ts` (19). Limit: non-certifiable tables above 1,024 zones show "Not checked above 1024 zones." (visible, not silent). |
| 4 | SC4: base 10 offers a CCRU preset supplying the 10 zone sounds and the 45 canonical names | VERIFIED | `app/presets/base10/naming.ts:16` `CCRU_NAMING_PRESET` reads `ZONE_PARTICLE` and `DEMON_NAMES` from `app/presets/base10/lore.ts` by reference; the engine takes it only as an argument (`NamingPreset`, `types.ts:48`). Scratch script 2: 45 of 45 match, base 12 gets none. `NamesPanel.tsx:740-749` (the radio group is at `:745`) source radios at the base that has a preset; `NAMES_COPY.ccruHint` "CCRU names exist for base 10 only". Tests: `tests/presets/namingPreset.test.ts`, e2e `names-io.spec.ts` (base 10 opens on the 45 names, base 12 shows none). |
| 5 | NAM-01: editable per-zone sound table, generated by seed and style, per-zone locks, edits, undo | VERIFIED | As truth 1, plus three styles (`engine/naming/banks.ts`, signed off 2026-11-09 and pinned), D-05 distinct by construction (Feistel permutation over a prefix-code tree, no retry), validation inline (`engine/naming/text.ts:18` limits 16 / 32 / 64). Undo: snapshots carry `naming` and `namingRev` (`NumogramClient.tsx:130-149`, `:415-437`), key excludes the naming (`historyHydration.ts` `historySnapshotKey`), base-guarded restore (`namingSession.ts:247` `restoreNaming`), depth 8 above 5,000 overrides. Autosave debounce 400 ms (`NumogramClient.tsx:944-955`). |
| 6 | NAM-02: names derive from the zone sounds with the join rule and optional euphony smoothing, shown at render time in the demon browser, matrix, Selection detail, pinned background and the Sounds label mode | VERIFIED | Smoothing: `engine/naming/euphony.ts` (`euphony@1`, insert-only, off by default; the panel shows raw and smoothed side by side, `NamesPanel.tsx` preview table). Display through `NamingContext` (resolver by reference): `DemonRowList.tsx:60-102,280` (name cell, overridden marker), `DemonBrowser.tsx:40` (live-name search), `DemonMatrix.tsx:105,328,418` (tooltip and keyboard text), `InfoDisplay.tsx:25,314,509` (Selection detail), `PinnedBackground.tsx:85`, Canvas chord callout `CanvasDiagram.tsx:901`. Sounds mode: `labelScheme.ts` (`mode: 'sounds'`), `soundLabels.ts` `fitSoundLabel` shared by `Projection.tsx:737-840` (SVG) and `canvas/draw.ts:935-947,1626-1638` (both Canvas passes), worker guard accepts it (`worker/protocol.ts:77`). e2e `demons-browser`, `demons-matrix`, `names-labels` (12). |
| 7 | NAM-03: JSON import/export with the all-or-nothing validator, `names=` share links as unsaved previews, per-base autosave, collision report | VERIFIED (advisory A1) | Validator and link as truth 3. Previews: `namingSession.ts:126` `sessionForBase` (link + differing slot = preview that keeps the slot; every action refused, `:211`), `keepPreview` / `revertPreview`; `NamesHeaderTag`, Names auto-opens once for a preview (`NumogramClient.tsx:876`). Autosave: `namingStorage.ts` (slot read and write guarded, key `ccrug.naming.v1.<base>`), written only after a first edit, never in preview, never above the ceiling (`namingSession.ts:278`), flushed at a base switch, on `pagehide` and when hidden (`NumogramClient.tsx:957-968`). Scratch script 2 confirmed preview behaviour. |
| 8 | NAM-04: the CCRU preset layer for base 10 only, read by reference from `app/presets/base10/lore.ts`, never copied into `engine/` | VERIFIED | Scan of all 87 files under `engine/` including tests: no canonical demon name and no CCRU zone sound outside the frozen Phase 1 numeric oracle `engine/test/fixtures/base10.golden.json` (captured 2026-09-25, commit 1858d05, byte-identical since). `engine/naming/euphony.ts:2` only names `DEMON_NAMES` in a comment. `naming.derive.test.ts:18` uses made-up sounds. `tests/presets/naming-banks-lore.test.ts` imports the lore to prove no bank syllable equals a zone sound (the harsh bank dropped the eight verbatim clusters, signed off 67e3002). `engine/test/guard.test.ts` extended (additive) to cover `engine/naming/`. |
| 9 | Decisions D-01..D-14 | VERIFIED | D-01 side panel in the stack, 240 px (`panelStack.ts:14`), `postBaseline` Panel and `data-post-baseline` roots; D-02 one surface (controls, virtualized list, rename from Selection); D-03 names in browser, detail and matrix tooltip plus the `sounds` label mode on both tiers (the Canvas chord hover callout also shows the name, a small extension of D-03, recorded as default 12); D-04 three styles, style stored in the seed record and link (`nstyle`); D-05 distinct tables (script 1); D-06 plain join default, smoothing off by default, raw and smoothed shown; D-07 letters of any script, NFC, 1..16 graphemes (`text.ts`); D-08 `upperFirst`, overrides shown as typed; D-09 per-base slot; D-10 base switch loads that base's slot or default, history cleared on a base switch (`resetForBaseSwitch`, `NumogramClient.tsx:496-510`) and `restoreNaming` refuses another base; D-11 ceiling is `INTERACTIVE_MAX_N` from the tier table (`NumogramClient.tsx:19,128`), seed-only above it (`sounds === null`, no slot, seed-only export); D-12 report, no repair (the 1,024 scan limit is advisory A1); D-13 preview with Keep and Back, Share title honest about uncarried edits; D-14 preset at base 10 only. |
| 10 | UI-SPEC Desktop Panel Stack Rule and todo 008 closed | VERIFIED | `app/lib/panelStack.ts:68` `computeDesktopStack` derives every slot from measured heights (first panel y 64, then `y + h + 18`, unrounded chain, `Math.round` at the end; `names` directly under Selection); `usePanelDrag.ts:60-66` seeds a drag from the DISPLAYED position and only moved panels keep stored positions (`panelDrag.ts`); `names` first in the mobile `PANEL_GROUP_ORDER` (`NumogramClient.tsx:110`); z cap 69. `panelStack.test.ts` (live stack equals the old formula over 20,000 random height sets), `panelDrag.test.ts`, e2e `panel-stack.spec.ts` (62 cases in the gate) and three `todo 008` tests in `region-legend.spec.ts:129,165`. `todo 008` is in `.planning/todos/completed/` with its resolution. |
| 11 | Project rules: engine purity, no new dependency, static-first, no upstream branding | VERIFIED | Purity: `grep` of `engine/naming` finds no `app` import, `document`, `window`, `process`, `Math.random` or `Date`; every import is relative and only `../core/*`; the ESLint boundary test passes. `git diff 0f25f1b HEAD -- package.json package-lock.json` is empty. No `route.ts`, no `fetch`, no analytics in the Phase 7 modules; `next.config`, workflows, tsconfig, vitest and playwright configs unchanged; `grep -rn "new Worker("` finds exactly one site (`app/lib/worker/workerClient.ts:177`). Branding: only two negative assertions (`not.toMatch(/qliphoth\|delight nexus/i)`) in new tests; `NOTICE`, `README.md`, `LICENSE`, `public/` unchanged. `Math.random` and `Date.now` do not appear anywhere under `app/`; Reroll uses `crypto.getRandomValues` and stores the resulting seed. |
| 12 | Frozen sets untouched | VERIFIED | `git diff --stat 0f25f1b HEAD -- e2e/__golden__ e2e/__behaviour__ engine/test/fixtures engine/test/layout.digest.test.ts` empty; `git log 0f25f1b..HEAD` over those paths has 0 commits; `check-repo --only goldens` OK; numeric-oracle dirs (`tests/oracle`, `tests/e2e-normalizer`, `tests/bruteforce`) unchanged. `engine/naming/banks.ts` last touched by 67e3002 (the approved revision) and `engine/test/naming.vectors.test.ts` by fb00ada (digest pin), both in plan 07-06, nothing after. Existing tests modified (19 files) were checked line by line: deleted lines are rewrites forced by deliberate changes (NAME column now shows generated names at other bases, matrix text carries the name, the header and paint-surface fixes, an import rewrite); `engine/test/guard.test.ts` is additive. |
| 13 | Orphan and stub check | VERIFIED | Every Phase 7 module has an importer on a live path: `namingStorage`, `namesLink` (also `shareParams`), `historyHydration`, `panelStack`, `NamesPanel`, `NamingContext` -> `NumogramClient.tsx`; `collisionSchedule` -> `CollisionReport.tsx` -> `NamesPanel.tsx`; `soundLabels` -> `Projection.tsx` and `canvas/draw.ts`; `panelDrag` -> `usePanelDrag.ts`; `zoneListModel` -> `ZoneList.tsx`; `DemonNameEditor` -> `InfoDisplay.tsx` and `CollisionReport.tsx`; `presets/base10/naming` -> `NumogramClient.tsx`. `grep` for TODO, FIXME, XXX, HACK, "not yet implemented", "coming soon" over the Phase 7 files: none (the one `placeholder=` is the Go-to input). Level 4: the context value is built from live state (`NumogramClient.tsx:1314-1335`) and the resolver from `namingSession.working`, not from static data. |
| 14 | Cross-phase integration | VERIFIED | Phase 6: Canvas tier and the single worker keep working with Sounds mode (worker guard accepts `sounds`, both Canvas passes use one fit so no ghosting) and the paint surface (`viewTransform.ts` `surfaceOf` / `surfaceStore`; window stays the logical frame); `canvas-interaction.spec.ts` was strengthened, not weakened (surface contains the window and covers the viewport); Canvas e2e in the gate passed. Phase 4: base picker and header fix (1425bd4; `basePickerRender.test.ts` updated with a comment, the dropdown clamp WR-09). Phase 5: demon browser, matrix and focus read live names, `demons-browser` and `demons-matrix` rewritten (not skipped), the base-10 `Lurgo` and `Ummnu` assertions unchanged. Base-10 oracle path: 60 DOM goldens (30 per timezone project) and 5 behaviour stages passed in the gate with nothing regenerated; new DOM carries `data-post-baseline`. |
| 15 | Review outcome | VERIFIED (advisory A2) | 22 `fix(07-review)` commits; all 10 warnings (WR-01..WR-10) fixed, each commit touches a regression test (unit, e2e or both; checked per commit with `git show --stat`). Spot-checked in the code: WR-05 `undoRestoresNaming` (`historyHydration.ts:48`) used by `undoNaming` (`NumogramClient.tsx:1303-1308`); WR-06 `rangeExtractor: ... withFocusedRow` (`ZoneList.tsx:248`, `zoneListModel.ts:103`); WR-08 nonce-keyed `<span key={naming.announcementNonce}>` inside the single `role="status"` carrier (`NamesPanel.tsx:331-334`, `namingSession.ts:290-300`); also WR-04 `NAME_RE = /^[\p{L}\p{M}]{1,32}$/u` (`demonSearch.ts:30`), WR-09 `w-[min(340px,calc(100vw-16px))]` (`BasePicker.tsx:181`), IN-04 flush result handled (`NumogramClient.tsx:501-505`), IN-16 the only `sessionRef.current =` is in `commitSession` (`:239`), IN-21 `flushOnVisibility` (`:957-968`). Info items: 10 fixed (IN-01, 04, 05, 16, 17, 19, 20, 21, 22, 26) and 17 in `.planning/todos/pending/010-phase7-review-info-followups.md` (IN-02, 03, 06..15, 18, 23, 24, 25, 27): 10 + 17 = 27, none missing. The documents say 12 and 15, which is wrong (advisory A2). |

**Score:** 15/15 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `engine/naming/{prng,feistel,banks,generate,text,euphony,types,derive,edit,schema,validate,collisions,index}.ts` | pure naming module | VERIFIED | 13 files, only `../core/*` imports, barrel re-exported by `engine/index.ts`; 10 test files under `engine/test/naming.*` |
| `app/presets/base10/naming.ts` | CCRU preset adapter by reference | VERIFIED | 23 lines, wired in `NumogramClient.tsx:59,128` |
| `app/lib/{namingSession,namingStorage,namesLink,namingCopy,namingLimits,zoneListModel,collisionSchedule,soundLabels,historyHydration,panelStack,panelDrag}.ts` | session rules, storage, link codec, copy, limits, list model, scheduling, fit, history helpers, stack | VERIFIED | all imported and used (see truth 13) |
| `app/components/names/{NamesPanel,ZoneList,CollisionReport,DemonNameEditor,NamingContext}.tsx` | panel, list, report, editor, context | VERIFIED | 994 / 538 / 438 / 424 / 50 lines, substantive, mounted at every tier (`NumogramClient.tsx:2191-2206`) |
| `e2e/names-{smoke,panel,labels,io,preview,session}.spec.ts`, `e2e/panel-stack.spec.ts`, `e2e/names-helpers.ts` | browser proof | VERIFIED | present; counts per the gate log |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NumogramClient` | naming session | `sessionForBase` / `applyNamingAction` / `commitSession` | WIRED | base switch (`:502`), hydration (`:873`), worker swap (`:975`), actions (`:1286`) |
| `NumogramClient` | browser slot | `readSlot`, debounced `writeSlot`, `flushSlot` on switch, `pagehide`, hidden | WIRED | `:821, :946-968, :501` |
| `NumogramClient` | URL | `linkFormOf` into `ShareState.names`, `parseNamesLink` on load | WIRED | `:407`, `shareParams.ts` (`parseShareParams` / `buildShareParams`) |
| `NumogramClient` | undo history | `namingRev` in the snapshot, `restoreNaming`, `undoRestoresNaming`, `historyStepFor` | WIRED | `:415-456, :1204-1240, :1303` |
| `NamingContext` | browser, matrix, detail, pinned, Canvas callout, Names panel | `useNaming().resolver` | WIRED | see truth 6 |
| `labelScheme.mode === 'sounds'` | SVG and both Canvas passes | `zoneSounds` prop from `namingSession.working.sounds` (null above the ceiling) | WIRED | `NumogramClient.tsx:1677`, `Projection.tsx:80`, `draw.ts:935,1626` |
| `usePanelDrag` | live stack | `derivedStack` from `computeDesktopStack`, drag seeded from displayed position | WIRED | `NumogramClient.tsx:309-322`, `usePanelDrag.ts:23-66` |
| `NamesPanel` | `CollisionReport` / `ZoneList` / `DemonNameEditor` | direct mounts | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|----------|---------------|--------|--------------------|--------|
| `DemonRowList` name cell | `resolver.nameOf(a, b)` | `createNameResolver(namingSession.working, preset)` (`NumogramClient.tsx:1311`) | Yes (verified through the engine: 45 of 45 canonical at base 10, generated names elsewhere, lazy names at 4002 and 2^26) | FLOWING |
| `ZoneList` rows | `naming.sounds`, `naming.locks` | session `working` naming, edited by `editSound` / `pasteSounds` / `toggleLock` | Yes | FLOWING |
| Sounds node labels | `zoneSounds` | `namingSession.working.sounds` | Yes | FLOWING |
| `CollisionReport` | report | certificate (`canCertify`) or sliced scan over `nameOf` | Yes; brute-force differential in the engine tests and in my script | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine naming and purity suites | `vitest run engine/test/naming engine/test/guard.test.ts --project engine` | 11 files, 672 tests passed | PASS |
| App naming suites | `vitest run <14 files> --project oracle` | 760 passed | PASS |
| Cross-phase suites (Canvas, picker, overlay, labels, share params) | `vitest run <17 files> --project oracle` | 776 passed | PASS |
| Generated tables never collide (3 styles x 4 bases x 2 joins x 2 smoothing) | scratch script via `tsx` | 0 duplicate names, certificate true in all 48 | PASS |
| Determinism, lock survival, export/import round trip, wrong base refused | scratch script via `tsx` | all true; `wrong-base` with `offerSeed` | PASS |
| CCRU preset, override independence, link gating, preview, seed-only and 2^26 names | scratch script via `tsx` | 45/45 match, 1 of 45 changed by 1 override, `names=ccru` null at base 12, preview refuses edits, lazy names resolve | PASS |
| Repo guard | `node scripts/check-repo.mjs` | OK (11 checks) | PASS |
| Full gate | log of `npm run verify` | EXIT=0; 4,098 unit tests x 2 timezones, 440 e2e passed, 0 failed, 368 skipped by design | PASS (read from log, not re-run) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| NAM-01 | 07-01..07-04, 07-06, 07-07, 07-09, 07-12..07-14, 07-17, 07-19, 07-21, 07-22, 07-24 | editable per-zone sound table, seeded generation, locks, undo | SATISFIED | truths 1, 5 |
| NAM-02 | 07-02, 07-05, 07-14..07-16, 07-18, 07-22 | derived names, join rule, optional smoothing, shown at render time | SATISFIED | truths 2, 6 |
| NAM-03 | 07-08..07-11, 07-13, 07-17, 07-18, 07-20, 07-23 | JSON in and out, preview links, autosave, collisions | SATISFIED (advisory A1) | truths 3, 7 |
| NAM-04 | 07-11, 07-18, 07-23 | CCRU preset, base 10 only, by reference | SATISFIED | truths 4, 8 |

No orphaned requirements: `grep` of REQUIREMENTS.md maps only NAM-01..NAM-04 to Phase 7 and every plan claims at least one. REQUIREMENTS.md still shows them unchecked and "Pending" (bookkeeping, advisory A6).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none in Phase 7 shipped code) | | TODO, FIXME, stubs, empty handlers, hard-coded empty data | none | |
| `engine/naming/banks.ts` | header | still says DRAFT / unsigned (todo 010 IN-10) | info | signed off and digest-pinned; changing the comment needs a new sign-off, so correctly left |
| `app/lib/canvas/viewTransform.ts` | 260 | literal `8_388_608` memory bound (advisory A4) | info | not a tier boundary |
| `app/NumogramClient.tsx` | whole | about 2,230 lines (IN-27) | info | refactor note in todo 010 |

### Human Verification Required

See the `human_verification` list in the frontmatter (6 items): the screen-reader pass (never reported by the user), the desktop stack by eye, narrow windows, the header against the layout switcher between 821 and about 1300 px (never measured), Sounds label mode by eye on the final tree, and IME composition plus the pending [default] decisions.

### Gaps Summary

No blocking gap. Every roadmap success criterion, the four requirements, the fourteen locked decisions, the UI-SPEC stack rule (todo 008) and the project rules are delivered in code and covered by tests that I re-ran or read in the gate log.

Findings worth the orchestrator's and the user's attention, none of which fails a truth:

1. **A1, collision report coverage (low-medium).** The panel says so visibly, but typed, imported and CCRU tables between 1,025 and 4,000 zones are not checked unless the certificate can prove them unique (one non-lowercase-ASCII or prefix-related typed sound is enough to lose the certificate at a large base). Engine cost at 4,000 is 3.3 s raw and 7.0 s smoothed with about 84 MB (07-10); the limit is a data value (`NAMING_COLLISION_SCAN_MAX_N`). This is default 8 of the 07-25 list but was not among the five decisions the user was asked to review.
2. **A2, wrong counts in two documents (low).** Fix the wording in `07-REVIEW-FIX.md` (frontmatter `fixed: 22`, `deferred_to_todo: 15`, and "twelve of the 27 info items") and in `.planning/todos/pending/010-phase7-review-info-followups.md` ("twelve of the info items were fixed"). The true figures are: all 10 warnings and 10 info items fixed (22 commits, because WR-02 and WR-03 took extra commits), 17 info items open.
3. **A3, unreviewed canvas code (low).** `CanvasDiagram.tsx`, `canvas/draw.ts` and `canvas/viewTransform.ts` were outside the Phase 7 review. I read the `viewTransform.ts` diff and found nothing wrong (finite-input guards, window stays the logical frame, area bound), and the Canvas unit and e2e suites pass; a short review of `ecd8caf` would close it.
4. **A5, 68 px Names body minimum** against the UI-SPEC's 80 px (documented in `deferred-items.md`, one-line fix noted there).
5. **A6, bookkeeping for the orchestrator after the user signs off the manual checkpoint:** tick 07-25 and Phase 7 in ROADMAP.md, mark NAM-01..NAM-04 complete in REQUIREMENTS.md, set `07-VALIDATION.md` to `status: approved` with the outcomes of the manual rows, and update CLAUDE.md (todo 008 is closed, todo 010 exists, Phase 7 is no longer the next phase, the Phase 7 modules and the `names=` / `labels=sounds` parameters are new).

Two things I could not judge from code and list as human work: how the Names panel sounds with a screen reader, and how the header sits against the layout bar between 821 and about 1300 px.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_

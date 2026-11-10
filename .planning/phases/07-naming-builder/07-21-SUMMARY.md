---
phase: 07-naming-builder
plan: 21
subsystem: viewer-names-panel-mount
tags: [naming, viewer, panel-stack, mobile-stack, sounds-labels, share-title, history, e2e, mutation-testing, typescript, playwright]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: plan 07-03 and 07-07 (namesBodyMax, NAMES_PANEL_WIDTH, the derived desktop stack, usePanelDrag with names), 07-11 (NAMES_COPY), 07-12 (Projection zoneSounds and labelPxPerUnit, BasePicker numeralsLayout), 07-14 (CanvasDiagram zoneSounds), 07-17 and 07-19 and 07-20 (NamesPanel and NamesHeaderTag with every block), 07-18 (the naming session, namingCtx, namesOpen)
provides:
  - the Names panel mounted in app/NumogramClient.tsx at every tier and base, collapsed by default, directly under Selection on desktop and first in the mobile stack, its measured height reaching both stacks
  - labels=sounds end to end: zoneSounds to Projection (with labelPxPerUnit) and to CanvasDiagram, numeralsLayout to BasePicker, nothing to PairGraphProjection
  - the honest Share title and announcement (uncarried edits)
  - e2e/names-helpers.ts and e2e/names-smoke.spec.ts (7 tests)
  - the two collision announcement sentences moved into app/lib/namingCopy.ts (extra task A)
  - the residual of the undo-history bug fixed: a refused Undo or Redo leaves the history alone (extra task B)
affects: [07-22, 07-23, 07-24, 07-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The panel's slot and body room are computed once per render (namesPos, namesBodyRoom) and used for both the Panel and its content, on both stacks; the stack itself needed only `names` in PANEL_GROUP_ORDER and PANEL_GROUP_DEFAULT_HEIGHTS (PanelId and the onPanelHeight guard follow from the record)"
    - "The Names box is located in e2e as the position:fixed ancestor of the always-mounted live carrier, never by the header-text helper (the header tag shares the header text)"
    - "A refused snapshot apply returns false and the history callbacks apply FIRST, setting the flag and the current-snapshot ref only on success, because a refusal renders nothing and so nothing would clear a flag set for it"

key-files:
  created:
    - e2e/names-helpers.ts
    - e2e/names-smoke.spec.ts
  modified:
    - app/NumogramClient.tsx
    - app/lib/namingCopy.ts
    - app/components/names/CollisionReport.tsx
    - tests/app/namingCopy.test.ts
    - e2e/names-session.spec.ts
    - .planning/phases/07-naming-builder/deferred-items.md

key-decisions:
  - "The Share handler and title read `namingUncarried` and `announceNaming` (the values `namingCtx` is built from, both declared above) instead of `namingCtx.uncarried` and `namingCtx.announce`: the same behaviour with a narrower dependency list (the handler is not rebuilt on every naming edit), no temporal-dead-zone risk"
  - "The plain Share title comes from NAMES_COPY.shareTitle (the string is unchanged, 'Share current state'); aria-label stays the literal"
  - "A refused Undo or Redo (extra task B) still drops its dead entry from the stack it came from, exactly as before, but no longer puts the current state on the other stack: before, a refused Undo left Redo enabled with nothing to redo, and a Redo of that entry would have set the flag again with no render to clear it. The orchestrator left 'popped or not' open; popped keeps today's observable Undo-button behaviour (the dead entry is consumed by one click)"
  - "The Canvas-tier smoke base is SVG_RICH_MAX_N + 2 (not a typed 666): the first base the tier table sends to the Canvas tier, like canvas-tier.spec.ts"
  - "One extra smoke case beyond the plan's list: a saved naming with one edited sound (seeded from the engine) proves the one header tag, the uncarried Share title and the Share announcement, because those are must_haves of this plan that the listed cases did not exercise"
  - "names-smoke.spec.ts seeds its saved slot with the same addInitScript pattern as names-session.spec.ts (which keeps its own local helpers) and imports only the new names-helpers.ts, so neither spec depends on the other"

patterns-established:
  - "Mutants for a mount are judged against the smoke spec after a rebuild: a mount guarded by hasDiagram, a panel body not rendered headless, a default-open panel, a missing zoneSounds pass-through, an always-plain Share title and a removed announcement are each killed by exactly the case that names them"

requirements-completed: []  # NAM-01 and NAM-03 stay Pending at the orchestrator's phase gate: the panel is mounted and smoke-tested, the full behavioural e2e is 07-22 and 07-23, the gate is 07-25

# Metrics
duration: about 40min (start was not stamped; estimated from the first commit at 15:16 MST to the last at 15:43, plus reading), including 12 mutant builds and two test:swap runs
completed: 2026-11-10
---

# Phase 7 Plan 21: Names Panel Mount, Sounds Pass-through and Honest Share Title Summary

**The Names panel is now in the app: a collapsed 240 px panel directly under Selection on desktop and first in the mobile stack at every tier and base (SVG, Canvas, headless, and under a `?tier=` override), reporting its measured height to both stacks with a body room that keeps an open box above the zoom toolbar; labels=sounds shows the naming's sounds on the zone nodes of both diagram tiers; the Share button explains and announces edits a link cannot carry; and a refused Undo no longer swallows the next edit.**

## Performance

- **Duration:** about 40 min (estimate, see Metrics)
- **Completed:** 2026-11-10
- **Tasks:** 2 of 2, plus the orchestrator's extra tasks A and B
- **Files created:** 2; **modified:** 6
- **`$PLAN_BASE`:** `587330a6010666061da58c8afb89a2277a11aeb7`

## Accomplishments

- **Mount (Task 1).** `names` is first in `PANEL_GROUP_ORDER` and `names: 34` is in `PANEL_GROUP_DEFAULT_HEIGHTS`, so the mobile stack lists it at y 64 and the desktop stack (and `onPanelHeight`, whose guard is the same record) takes its measured height. `<Panel id="names" title="Names" postBaseline ...>` sits after Selection with no `hasDiagram` guard: width `NAMES_PANEL_WIDTH` (240) on desktop and `mobilePanelWidth` at 820 px and below, `panelZ.names`, `draggable={!isMobile}`, `maxBodyHeight` = `namesBodyMax(y, viewport.h)` (the same value is the `bodyMax` of `NamesPanel`), `headerRight={<NamesHeaderTag />}`, controlled by `namesOpen` (collapsed by default). The `eslint-disable` on `namesOpen` is gone. `pinnedZone` and `pinnedDemonMesh` (`meshOf(a, b)`) come from `pinnedInfo`.
- **Sounds pass-through (Task 1).** `zoneSounds = labelScheme.mode === 'sounds' && base <= INTERACTIVE_MAX_N ? namingSession.working.sounds : null`. `Projection` gets `zoneSounds` and `labelPxPerUnit` (`(DIAGRAM_CSS_WIDTH / svgWidth) * zoom`, only when sounds are on), `CanvasDiagram` gets `zoneSounds`, `PairGraphProjection` gets nothing, and `BasePicker` gets `numeralsLayout={layout === 'pairGraph' || layout === 'planetary'}`. In every other mode the props are `null` and `undefined`, so default renders are unchanged.
- **Honest Share (Task 1).** The button's `title` is `NAMES_COPY.shareTitleUncarried` while the naming holds edits a link cannot carry, else `NAMES_COPY.shareTitle`; pressing Share announces the uncarried sentence into the Names live carrier first. `aria-label="Share current state"` and the sharing itself are unchanged.
- **E2E (Task 2).** `e2e/names-helpers.ts` (`namesBox`, `namesBody`, `namesScroll`, `namesToggle`, `namesHeaderTag`, `openNames`, `namesState`, `defaultResolver`, `NAMES_LIVE`) and `e2e/names-smoke.spec.ts` (7 tests).
- **Extra task A.** `NAMES_COPY.collisionsAnnounceNone` and `collisionsAnnounceSome(groups)` in `app/lib/namingCopy.ts`; `collisionAnnouncement` in `CollisionReport.tsx` reads both (no literal left, `plural` import dropped); `tests/app/namingCopy.test.ts` pins the new key (77 keys) and the sentence; all 178 panel render tests unchanged and green.
- **Extra task B.** `applySnapshot` returns a boolean; `onUndo` and `onRedo` apply first and set `historyApplyingRef` and `historyCurrentRef` only when the snapshot was applied. A refused one only drops its dead entry. New case in `e2e/names-session.spec.ts`.

## Task Commits

1. **Extra task A: collision announcement strings into the copy module** - `ed91355` (refactor)
2. **Task 1: mount, sounds pass-through, Share title** - `54e7db1` (feat)
3. **Task 2: helpers and the smoke spec** - `226a30d` (test); extended with the saved-edit case in `fb7e354` (test)
4. **Extra task B:** RED `5872c01` (test), GREEN `4bf1fce` (fix, also marks the residual resolved in `deferred-items.md`)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md and ROADMAP.md (hash in the final report).

## The smoke spec (7 tests, chromium-utc, 1280 x 800)

Base 10: mounted, collapsed, no header tag, state `ready`, opens with the CCRU source radio checked, collapses again with the live carrier still mounted. Base 28: `ready`, no Source row, seed field equals `DEFAULT_SEED`, plain Share title. A saved edited sound (`editSound`, slot seeded before load): the one header tag `edits not in links`, the uncarried Share title, empty live carrier, then the same sentence in the carrier after pressing Share. A Canvas-tier base (`SVG_RICH_MAX_N + 2`): `ready`, base attribute matches. The first base above the ceiling (`INTERACTIVE_MAX_N + 2`, headless): `seed-only` with the seed-only note. Base 28 under `tier=headless`: `ready` (the base decides). `labels=sounds` at base 28: `[data-zone="12"] [data-sound-label]` equals the engine's default sound for zone 12 and all 28 zone nodes carry one; the pair graph has none. No page error in any case. No base is typed (4002 appears nowhere).

## Verification Results

- **`MSYS_NO_PATHCONV=1 npm run test:swap`** exit 0 twice (after Task 1, and again after the history fix): 65 Playwright passed, 5 skipped by design (the 60 DOM goldens and the behaviour baseline in both timezone projects), 118 files and 3,916 unit tests. `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` empty both times. `npm run test:tz` (America/New_York): 118 files, 3,916 tests. `npm run typecheck` exit 0 (the one lint warning in DemonMatrix.tsx is older). `node scripts/check-repo.mjs --only base-ten` OK after `git add`.
- **Panel-related specs, run one invocation at a time against the Task 1 build** (`--project=chromium-utc`): panel-stack 9, region-legend 9, layers-zoom 11, canvas-tier 15, demons-browser and demons-focus 18, demons-matrix and hover-pin 11, accessibility and base-picker 22, base-switch-reset and names-session 17, canvas-interaction (375 x 667 touch and 768 x 1024 included) and label-scheme 17, and row-click-regression, smoke-bases, worker and url-codec 62: all passed. After the history fix and the last rebuild, base-switch-reset, panel-stack, names-session (14) and names-smoke (7) were run again: 34 passed.
- **Overlap and clearance (a temporary Playwright geometry probe, 24 states, not committed):** widths 375 x 667, 768 x 1024, 820 x 1180, 821 x 900, 1024 x 768 and 1280 x 800, base 10 and base 28, Names collapsed and open. Every fixed panel box was compared pairwise and with the shortcuts button: no overlap in any of the 24 states. At 820 px and below Names sits at (8, 64), 240 wide, first in the stack, and every other panel starts below it (at 375 x 667 base 28 open: Names 64 to 555, Layers at 561); above 820 it sits at x 548 to 942 (1280: x 942) under Selection (base 10 at 1280 x 800: y 379, open bottom 688 against 704, which is `vh - 96`; 1024 x 768: bottom 656 against 672; 821 x 900: 788 against 804; base 28 at 1280: y 302, bottom 688). Screenshots of the open panel at 1280 and 375 and a Canvas base in sounds mode were looked at: the panel renders its blocks, sounds replace the numerals on the SVG nodes and letters appear on the Canvas nodes once zoomed past the label threshold.
- **`npm run check:weight` (FAILS, as known since 07-18; the baseline file was not touched):** `/numogram/` jsBytes **890,987** raw (limit 849,278, baseline 808,836) and jsGzip **273,143** (limit 258,168, baseline 245,874). It was 260,596 gzip after 07-18, so mounting the panel added about 12.5 kB gzip (the panel, the zone list and the collision report now sit in the page's chunk). 07-24's reasoned `update --reason` must use these numbers or the later ones. `npm run verify` was not run.

## Mutation Checks

Each mutant: a scratchpad script refuses a find text that is absent, repeated, or a no-op; a rebuild of `out/`; the named spec run in the foreground; the source restored from a saved copy and checked (`git diff --quiet` or `cmp`, clean every time). One at a time, none in the background. All **killed**:

| Mutant | Killed by |
|---|---|
| A: `collisionAnnouncement` returns the two sentences swapped (the copy move) | the collisionAnnouncement test (1 failed) |
| M1: Projection gets `zoneSounds={null}` | the sounds test (`[data-sound-label]` not found) |
| M2: `NamesPanel` not rendered when headless | the base-above-ceiling and tier=headless cases (live carrier missing) |
| M3: `namesOpen` starts true | the five panel cases that expect the collapsed toggle |
| S1: Share title always the plain one | the saved-edit case (title is `Share current state`) |
| S2: the Share announcement removed | the saved-edit case (live carrier stays empty) |
| B1: a refused Undo sets the flag and the ref again (the old behaviour) | the new refused-Undo case (the first rename is swallowed, Undo disabled after it) |
| B3: a refused Undo keeps its dead entry | the refused-Undo case (Undo still enabled after the click) |

The refused-Undo case also failed on the unfixed code (the RED run: Redo was enabled after the refusal). The Redo refusal branch is the same code as the Undo one but cannot be reached in a browser (a base switch clears both stacks), so it is covered by reading only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Line numbers in the plan's anchors were stale**
- **Found during:** Task 1. **Issue:** NumogramClient had grown since the plan was written (the anchors L92, L1347, L1909 were off by 200 lines or more). **Fix:** located every anchor by content; no behavioural effect.

**2. [Rule 2 - Missing critical functionality] The smoke list did not exercise two must_haves**
- **Found during:** Task 2. **Issue:** the plan's list has the header tag only as absent, and nothing proved the Share title or its announcement. **Fix:** one extra case (see above) and two mutants; the plan's listed cases are all present.
- **Commit:** `fb7e354`

**3. [Rule 1 - Bug] Extra task B changed what a refused Undo does to Redo**
- **Issue:** besides the swallowed edit, a refused Undo pushed the current state onto the Redo stack, so Redo was enabled with nothing to redo (the new RED case failed there first). **Fix:** a refusal drops only its dead entry (Undo is consumed as before) and touches nothing else. No frozen file changed; `names-session` test (c) is untouched and still passes.

**Other small departures:** the Share handler reads `namingUncarried` and `announceNaming` rather than `namingCtx.*` (decision above); the `npm run build` in the plan's verify line for the smoke spec was not repeated before its first run because `test:swap` had just built the identical source.

## Issues Encountered

None beyond the above. The mobile 375 px and the 24 geometry states needed no layout change.

## Known Stubs

None.

## Threat Flags

None: no new endpoint, storage key, file access or trust boundary. T-07-13f (the Names root is post-baseline, sounds props only in sounds mode, plain Share title unchanged without uncarried edits: `test:swap` green), T-07-16c (z-index from the capped `panelZ`, the 96 px bottom reserve measured above, `panel-stack` z-cap test green) and T-07-02e (no sounds above the ceiling, `seed-only` proven at `INTERACTIVE_MAX_N + 2`) are mitigated.

## Next Phase Readiness

07-22 (editing, locks, generation, derivation, renaming, scale, undo, sounds on both tiers), 07-23 (import and export, autosave, storage failure, collisions, CCRU preset, link previews) and 07-24 (geometry at every viewport including a pinned Selection at its 52vh cap, mobile and planetary clearance, layout re-runs, page weight) can now drive the panel with `e2e/names-helpers.ts`. Things they should know: `namesBox` is the fixed ancestor of `[data-names-live]`, never the `panel` helper; the toggle's label is `Expand Names` or `Collapse Names`; the sounds label is `[data-sound-label]` on SVG nodes only (the Canvas labels are drawn pixels, check them through the canvas target text or a screenshot).

## Self-Check: PASSED

- Files: `e2e/names-helpers.ts`, `e2e/names-smoke.spec.ts` and this summary exist; `app/NumogramClient.tsx`, `app/lib/namingCopy.ts`, `app/components/names/CollisionReport.tsx`, `tests/app/namingCopy.test.ts` and `e2e/names-session.spec.ts` carry the changes.
- Commits `ed91355`, `54e7db1`, `226a30d`, `5872c01`, `4bf1fce` and `fb7e354` exist on `main`, each ending with the `Co-Authored-By: Claude Sonnet 5` trailer.
- `git status --porcelain e2e/__golden__ e2e/__behaviour__ engine/test/fixtures` is empty; nothing was pushed.

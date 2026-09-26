---
todo: 001-declutter-ui-after-phase-1
completed: 2026-09-26
base: 52fc8df
commits: [1316ca7, 006bb44, a8d4336, c5aa256, 06d0a30, "step 6 (this commit)"]
---

# Todo 001 Summary: UI declutter after Phase 1

Removed the CRT overlays, glitch effects, route-transition provider and intro splash, and flattened the panel and shell chrome (no glows, shadows, cut corners, gradients or dividers), with no control, readout, shortcut, drag, URL-state or panel behaviour changed. Verified mechanically: a before/after Playwright inventory (51 desktop snapshots plus 390px, 3425 control lines, 682 region texts, 177 behaviour rows) shows zero functional difference, and the 60 DOM goldens pass unchanged after every step.

Full detail, tables and the line-by-line diff explanation: `.planning/notes/2026-09-25-ui-declutter-inventory.md`.

## Commits

| step | commit | what |
|------|--------|------|
| 1 | 1316ca7 | before-inventory note |
| 2 | 006bb44 | CRT overlays, glitch effects, route-transition provider removed |
| 3 | a8d4336 | intro splash and `useIntro` removed |
| 4 | c5aa256 | panel and shell chrome flattened |
| 5 | 06d0a30 | after-inventory diff added to the note |
| 6 | this commit | WR-01 e2e test, page-weight baseline lowered, todo closed, SUMMARY |

## Removed

Files deleted (5): `app/components/navigation/CrtNavigationTransition.tsx`, `app/hooks/useGlitchNavigate.ts`, `app/components/ui/GlitchTransition.tsx`, `app/hooks/useIntro.ts`, `app/components/ui/NeonDivider.tsx`. `component-library/index.ts` lost the `GlitchTransition` and `NeonDivider` re-exports.

`app/globals.css` (421 -> 151 lines):

- `body::after` scanline overlay (z 9999) and `@keyframes crt-flicker`; `body::before` vignette (z 9998)
- `.layout-switch-glitch`, `.layout-switch-glitch-overlay`, `.page-nav-crt-glitch-content`, `.page-nav-crt-glitch-overlay` and the shared `:where(h1..tspan)` text-glitch rule
- keyframes `page-nav-crt-shift`, `page-nav-crt-overlay`, `page-nav-crt-text-glitch`, `layout-glitch-shift`, `layout-glitch-overlay`, `ui-glitch-transition`, `pulse-dot`
- the `@media (prefers-reduced-motion: reduce)` block that only existed for those effects (replaced by one generic guard that shortens every remaining transition to ~0 under reduced motion)
- `.ui-glitch-text`, `.ui-glitch-transition`
- scrollbar colours changed from neon green to neutral grey (a restyle, not a removal)
- kept: the date-picker indicator override, `.ui-terminal-*` and `.ui-pill-input-*` (component library), `body` base colours

`app/NumogramClient.tsx`: `triggerLayoutGlitch`, `layoutGlitching` / `layoutGlitchRun` state, the timer ref and its cleanup effect, `LAYOUT_GLITCH_DURATION_MS`, the glitch overlay and glitch class on the content wrapper; `useIntro()`, `introPhase`, the splash layer (logo + wordmark, z-70, which also lingered at 4% opacity forever) and the opacity gating on the projection wrapper (it now renders at full opacity from the first paint; the goldens confirm). `PinnedBackground` no longer takes `introPhase`. `app/layout.tsx` renders `{children}` directly.

## Panel and shell styling changed (commit c5aa256)

Single quiet flat style: surfaces `rgba(8,8,15,0.94)`, hairline border `rgba(255,255,255,0.08)`, neon-green kept only as the title/accent colour.

- `CyberPanel`: no gradient, no cut corners (clip-path), no green corner marks, no title text-shadow
- `CyberPageHeader` (three boxes): flat, no gradient, neutral border, no logo drop-shadow, no title glow
- `CyberButtonGroup`: plain `border-white/10` group (cut corners and the `cornerSize` prop removed); planetary date field: no clipped corners
- `PanelGroup` (Selection accordion): flat hairline cards, no corner marks, no dot glow
- `PanelColorBar`: no glow (prop `glow` removed); `SidePopover` hover card: flat, no glow, no backdrop blur
- `RegionsPanel`: no active-label glow, neutral separator; `LayersPanel` separator untouched
- `InfoDisplay`: all `NeonDivider`s removed (intro paragraphs get 6 px spacing instead); `SectionFrame` keeps title and body without corner marks; `DataRow` keeps label and value without the colour tick and the 30-dot leader (value right-aligned); `StatusDot` is a plain dot (no glow, no pulse); `GlitchText` renders the same static text with the same weight, case, tracking and colour, minus the scramble and the glow
- `ShortcutsModal`, `SourcesFooter`, selection marquee, hovered-layout label, Selection panel header: no glow or inset shadow, neutral hairlines

Not touched: everything under `app/components/projection/**` and the projection `<svg>` subtree, `e2e/__golden__/**`, `engine/test/fixtures/**`.

## Verification (at the time of this commit)

| check | result |
|-------|--------|
| 60 DOM goldens (`npx playwright test`) | 60/60 unchanged after steps 2, 3 and 4 and again at the end; `git status --porcelain -- e2e/__golden__ engine/test/fixtures` empty; never `-u`, never `GOLDEN_CAPTURE` |
| static-export specs, root run | 5/5 per project, 70 e2e total green |
| static-export specs, `/ccrug` run (`MSYS_NO_PATHCONV=1 npm run test:e2e:basepath`) | 10/10 (5 per project, includes the new WR-01 case) |
| `npm run typecheck` (tsc x4 + lint) | clean after steps 2, 3, 4 |
| `npm test`, `npm run test:tz` | 236/236 each |
| `npm run check:weight` | OK; baseline lowered (below) |
| before/after inventory | zero lost, added, renamed, reordered, disabled or hidden controls; all 177 behaviour rows identical; only decorations differ (6 explained rows in the note) |

The full gate `MSYS_NO_PATHCONV=1 npm run verify` requires a clean tracked tree (it runs `check-repo --clean-tree`), so it is run after this commit; its result is in the orchestrator report.

## WR-01

New test in `e2e/static-export.spec.ts`: "the header title link keeps a single base path and drops the query". From `${BASE}/numogram/?selected=5` it waits for the link to hydrate, clicks the header title link (`header a[href$="/numogram/"]`), waits for `${BASE}/numogram/` with no query, and (when `BASE` is set) asserts that no main-frame URL ever contained `${BASE}${BASE}`. It passes at the root and under `/ccrug`. The cause was the removed route-transition provider (it re-navigated to an href that already carried the base path). I could not show the test red against the pre-declutter app: checking out the old `app/` over the working tree was blocked by the permission system, so I did not do it. The reasoning (provider deleted in 006bb44; the click now goes through Next's own `<Link>`) and the passing run are the evidence.

## Page weight (baseline lowered; every byte metric went down)

| route | metric | baseline | now | delta |
|-------|--------|----------|-----|-------|
| `/` | htmlBytes | 4934 | 4688 | -246 |
| `/` | htmlGzip | 1843 | 1769 | -74 |
| `/` | jsBytes | 419127 | 416830 | -2297 |
| `/` | jsGzip | 129167 | 128120 | -1047 |
| `/` | cssBytes | 23230 | 18377 | -4853 |
| `/` | cssGzip | 5570 | 4603 | -967 |
| `/numogram/` | htmlBytes | 76766 | 70662 | -6104 |
| `/numogram/` | htmlGzip | 11484 | 10719 | -765 |
| `/numogram/` | jsBytes | 572056 | 563909 | -8147 |
| `/numogram/` | jsGzip | 173091 | 170556 | -2535 |
| `/numogram/` | cssBytes | 23230 | 18377 | -4853 |
| `/numogram/` | cssGzip | 5570 | 4603 | -967 |

DOM node counts (from the frozen goldens) are unchanged at 6405. Ledger entry: "UI declutter removed overlay, glitch and splash code".

## Deviations and things worth knowing

1. **Panel open/close toggles do not exist in the shipped shell.** `CyberPanel` only renders its chevron when `collapseDirection !== 'none'` and `NumogramClient.tsx` never passes it, so the `layersOpen` ... `gatesOpen` state and the mobile start-collapsed effect are dead code. This is pre-existing, not something the declutter removed. The dead toggle branches and unused state were left in place (unused code is out of scope; Phase 4 decides the panels). Step 1(c) "click each panel's toggle" therefore recorded "no toggle" for every panel.
2. Inventory covered four layouts (planetary with the date pinned was added, because its Z/X/C/V controls and the date field only exist there) plus 390x800, and added drag, marquee, share, header-link and shortcut behaviours. The capture is deterministic (two runs on the unchanged app produced identical JSON).
3. `app/NumogramClient.tsx` is LF in the working tree here (the brief expected CRLF); every other edited file kept its own ending (CRLF files stayed CRLF, git normalises to LF). No mixed endings.
4. Public component-library surface changed: `GlitchTransition` and `NeonDivider` are no longer exported, `StatusDot` lost its `pulse` prop, `CyberButtonGroup` its `cornerSize` prop, `PanelColorBar` its `glow` prop. None is used outside the shell in this repo.
5. Because the rate limit interrupted the run between steps 4 and 5, step 5 was committed after the resume; the note's commit references were changed from "commit N" to hashes at that point.
6. Todo 002 (`WR-01` bullet) and the original note's "Tracked as" line were updated to point at the completed todo.

## Kept because unsure (or deliberately)

- The faint `PinnedBackground` text (pinned element shown large at 3 to 6% opacity behind the diagram): a readout, kept; it now renders as soon as something is pinned instead of after the intro.
- The top-bar gradient fade behind the layout buttons and the active layout button's inset underline: legibility and state cues, kept.
- Neon-green as the accent colour for titles, active states and borders on active items: identity colour, not a glow.
- The unused collapse code paths in `CyberPanel` and `PanelGroup`, the `open` state in `NumogramClient`, `shareParams.ts`, `cyberColors.ts`, and the glows/clip-paths still present in components the shell does not render (`CyberCheckbox`, `CyberRadio`, `CyberPopover`, `CypherHoverText`, ...): unused or out-of-shell code, left alone as instructed.
- The Selection accordion's "x" remove and expand/collapse buttons, all panel row hover popovers ("one isn't real" included): functionality, untouched.

## Pre-existing findings, not fixed (flagged for the user)

1. **Real mouse clicks on the text of Zones, Syzygies, Currents and Gates rows are dropped in Chromium** (a click on the row's padding, or the same actions from the canvas, keyboard or DOM `click()` work; Layers, Labels and Regions rows are fine). Likely cause: those lists define `ItemDisplayComponent` inline, and `CyberPanel`'s `onMouseDownCapture` re-renders the page on every mousedown, so the row's child element is remounted between mousedown and mouseup and Chrome then fires no `click`. Fix would be to hoist the item components or call them as functions (as `HoverInfoList` does). Unchanged by this work (recorded as a behaviour row before and after). Worth a todo.
2. At 390 px the header overlaps the layout buttons and the seven always-open panels stack over each other and over the Selection panel (unchanged; Phase 4 structural work).

## Self-Check

- present on disk: `.planning/notes/2026-09-25-ui-declutter-inventory.md`, this summary, `.planning/todos/completed/001-declutter-ui-after-phase-1.md` (moved with `git mv`; nothing left in `todos/pending/001-*`)
- commits 1316ca7, 006bb44, a8d4336, c5aa256, 06d0a30 exist on `main` (`git log`); nothing was pushed; no server left running

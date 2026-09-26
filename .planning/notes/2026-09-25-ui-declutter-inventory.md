---
date: "2026-09-25"
updated: "2026-09-25 (before and after inventory)"
---

# UI declutter inventory (todo 001)

Before-inventory of the shell at HEAD `52fc8df` (Phase 1 closed), captured mechanically from the built static export (`npm run build`, served from `out/` on loopback) with Playwright Chromium at 1440x900, for the layouts `original`, `labyrinth`, `ladder` and (extra) `planetary` with the date pinned, plus 390x800 for the original layout. Every interactive element (`button`, `a`, `input`, `select`, `textarea`, `[role=button]`, `[tabindex]`, and the clickable list rows carrying `cursor-pointer`) is listed with its accessible name; each region's visible text excludes clipped and invisible nodes and the projection `<svg>` (oracle territory). The capture ran twice on the unchanged app and produced identical JSON (zero noise), so any after-difference is real. The capture script and the raw JSON stay in the scratchpad (not committed).

## Findings that shape the task

1. **The panels have no open/close toggle in the rendered app.** `CyberPanel` only shows its chevron when `collapseDirection !== 'none'`, and `NumogramClient.tsx` never passes it, so the `layersOpen`/`labelsOpen`/... state (and the mobile "start collapsed" effect) is dead. The Selection panel already sets `showToggle={false}`. The only collapsible things are the items inside the Selection panel (`PanelGroup`). This is a pre-existing fact about the untouched app (the panels were never collapsible in the shipped shell), not something this declutter removed: there was no toggle to preserve, and the dead toggle branches and unused open state stay as they are (unused code is out of scope, Phase 4 decides the panels).
2. **Real mouse clicks on the text of Zones, Syzygies, Currents and Gates rows are dropped by Chromium in the untouched app.** The cause, inferred from the code and consistent with the padding-click experiment: those lists build their row body with an inline component (`ItemDisplayComponent`), and `CyberPanel`'s `onMouseDownCapture` re-renders the page on every mousedown, so the row's child span is remounted between mousedown and mouseup and Chrome does not fire `click`. A click on the row's own padding, a DOM `click()`, and the keyboard/canvas paths all work; the Layers, Labels and Regions rows (which call `itemDisplay` directly) are fine. This is pre-existing and unrelated to the declutter; it is recorded (behaviour "real mouse click on Zones row 5 centre") so that the after-inventory proves it is unchanged, and it is flagged for the user rather than fixed here.
3. **The intro splash leaves a residue.** After the fade the title layer (logo + "CCRUG" wordmark, `z-[70]`) stays mounted at opacity 0.04, blurred, over the whole page, i.e. it is a permanent full-viewport overlay.
4. **At 390px the shell is already overlapping** (header over the layout buttons, all seven panels open and stacked on top of each other and the Selection panel). This is upstream behaviour; structural fixes are Phase 4. The declutter must not make it worse and must not add horizontal overflow.
5. **Always-on motion and overlays before the change:** `body::after` scanlines (`z 9999`, `crt-flicker 0.08s infinite alternate`), `body::before` vignette (`z 9998`), the splash residue above, 51 elements with a text-shadow, 8 with a box-shadow, 3 with a filter and 16 with a gradient background in the shell (outside the `<svg>`); one running animation (`crt-flicker`).

## Controls (original layout, desktop, initial state)

Same on `labyrinth` and `ladder`; `planetary` adds the controls listed below.

**topbar**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | button[button] | A |  |
| 2 | button[button] | S |  |
| 3 | button[button] | D |  |
| 4 | button[button] | F |  |

**header**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | a | CCRUGDecimal Labyrinth | href=/numogram/ |
| 2 | button | Undo | title="Undo (Cmd/Ctrl+Z)"; disabled |
| 3 | button | Redo | title="Redo (Shift+Cmd/Ctrl+Z)"; disabled |
| 4 | button | Share current state | title="Share current state" |

**Layers**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | div | SyzygiesON |  |
| 2 | div | CurrentsON |  |
| 3 | div | GatesON |  |
| 4 | div | PandemoniumOFF |  |
| 5 | div | ParticlesOFF |  |

**Labels**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | div | NumbersON |  |
| 2 | div | Tic XenotationOFF |  |
| 3 | div | PlanetsON |  |

**Zones**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | button | none |  |
| 2 | div | 0Solplex |  |
| 3 | div | 1Mercuryn/atorque |  |
| 4 | div | 2Venus:torque |  |
| 5 | div | 3Earth(:)warp |  |
| 6 | div | 4Mars::torque |  |
| 7 | div | 5Jupiter((:))torque |  |
| 8 | div | 6Saturn:(:)warp |  |
| 9 | div | 7Uranus(::)torque |  |
| 10 | div | 8Neptune:::torque |  |
| 11 | div | 9Pluto(:)(:)plex |  |

**Regions**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | div | Torque1 2 4 5 7 8 |  |
| 2 | div | Warp3 6 |  |
| 3 | div | Plex0 9 |  |
| 4 | div | Time Circuit |  |

**Syzygies**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | div | 4::5Katak1 |  |
| 2 | div | 3::6Djynxx3 |  |
| 3 | div | 2::7Oddubb5 |  |
| 4 | div | 1::8Murrumur7 |  |
| 5 | div | 0::9Uttunul9 |  |

**Currents**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | div | Surge8→78−1=7 |  |
| 2 | div | Hold2→57−2=5 |  |
| 3 | div | Sink4→15−4=1 |  |
| 4 | div | Warp6→36−3=3 |  |
| 5 | div | Plex9→99−0=9 |  |

**Gates**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | button | none |  |
| 2 | div | Gt-000↻00 |  |
| 3 | div | Gt-011↻11 |  |
| 4 | div | Gt-032→33 |  |
| 5 | div | Gt-063→66 |  |
| 6 | div | Gt-104→110 |  |
| 7 | div | Gt-155→615 |  |
| 8 | div | Gt-216→321 |  |
| 9 | div | Gt-287→128 |  |
| 10 | div | Gt-368→936 |  |
| 11 | div | Gt-459↻945 |  |

**Selection**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | button | clear | disabled |
| 2 | button | Numogram |  |
| 3 | button | Collapse item |  |

**shortcutsTrigger**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | button | shortcuts |  |

**footer**

| # | element | accessible name / text | notes |
|---|---------|------------------------|-------|
| 1 | a | Source 1 | href=http://www.ccru.net/declab.htm |
| 2 | a | Source 2 | href=https://socialecologies.wordpress.com/2025/08/17/the-numogram-diagram-time-circuits-and-acceleration/ |
| 3 | a | Source 3 | href=https://oh4.co/site/numogrammaticism.html |
| 4 | a | Source 4 | href=https://drive.google.com/file/d/1ReZnkaZxsdNgEFghEZqDvpDoxhhTWHQ6/view?usp=drive_link |

Interactive elements inside the projection `<svg>`: 0 (node/edge hover and click handlers are attached without `tabindex`; they belong to the frozen oracle subtree and are not touched).

**Extra controls in the planetary layout (with a date set)**

| region | element | name | notes |
|--------|---------|------|-------|
| topbar | button[button] | Z |  |
| topbar | button[button] | X |  |
| topbar | button[button] | C |  |
| topbar | button[button] | V |  |
| topbar | input[date] |  | value=DATE |

## Readouts (visible text, original layout, initial state)

Text nodes are joined with `|`. Regions not listed here were empty.

- **header**: CCRUG \| Decimal Labyrinth
- **topbar**: A \| S \| D \| F
- **Layers**: Layers \| Syzygies \| ON \| Currents \| ON \| Gates \| ON \| Pandemonium \| OFF \| Particles \| OFF
- **Labels**: Labels \| Numbers \| ON \| Tic Xenotation \| OFF \| Planets \| ON
- **Zones**: Zones \| none \| 0 \| Sol \| plex \| 1 \| Mercury \| n/a \| torque \| 2 \| Venus \| : \| torque \| 3 \| Earth \| (:) \| warp \| 4 \| Mars \| :: \| torque \| 5 \| Jupiter \| ((:)) \| torque \| 6 \| Saturn \| :(:) \| warp \| 7 \| Uranus \| (::) \| torque \| 8 \| Neptune \| ::: \| torque \| 9 \| Pluto \| (:)(:) \| plex
- **Regions**: Regions \| Torque \| 1 2 4 5 7 8 \| Warp \| 3 6 \| Plex \| 0 9 \| Time Circuit
- **Syzygies**: Syzygies \| 4 \| :: \| 5 \| Katak \| 1 \| 3 \| :: \| 6 \| Djynxx \| 3 \| 2 \| :: \| 7 \| Oddubb \| 5 \| 1 \| :: \| 8 \| Murrumur \| 7 \| 0 \| :: \| 9 \| Uttunul \| 9
- **Currents**: Currents \| Surge \| 8 \| → \| 7 \| 8−1=7 \| Hold \| 2 \| → \| 5 \| 7−2=5 \| Sink \| 4 \| → \| 1 \| 5−4=1 \| Warp \| 6 \| → \| 3 \| 6−3=3 \| Plex \| 9 \| → \| 9 \| 9−0=9
- **Gates**: Gates \| none \| Gt-00 \| 0 \| ↻ \| 0 \| 0 \| Gt-01 \| 1 \| ↻ \| 1 \| 1 \| Gt-03 \| 2 \| → \| 3 \| 3 \| Gt-06 \| 3 \| → \| 6 \| 6 \| Gt-10 \| 4 \| → \| 1 \| 10 \| Gt-15 \| 5 \| → \| 6 \| 15 \| Gt-21 \| 6 \| → \| 3 \| 21 \| Gt-28 \| 7 \| → \| 1 \| 28 \| Gt-36 \| 8 \| → \| 9 \| 36 \| Gt-45 \| 9 \| ↻ \| 9 \| 45
- **Selection**: Selection \| Selected Elements \| clear \| Numogram \| ▾ \| The Numogram is a decimal labyrinth: ten zones (0-9), paired syzygies that sum to nine, and pathways that map transitions through the system. \| Currents track differential flows across syzygetic pairs. Gates track culminations (triangular sums), then reduce multi-digit values by summation to determine the connecting source. \| Use hover and selection to inspect zones, currents, gates, and demons as a navigational map of recursive time and drift between torque, warp, and plex. \| Controls: click + drag to select, alt + drag to move, scroll to zoom, digits to toggle gates, ASDF to change view. \| Click empty space to return here.
- **shortcutsTrigger**: shortcuts
- **footer**: sources \| [ \| 1 \| ] \| [ \| 2 \| ] \| [ \| 3 \| ] \| [ \| 4 \| ]
- **splash**: CCRUG

## Selection detail (after selecting zone 5 through the Zones row)

- **Selection**: Selection \| Selected Elements (1) \| clear \| Numogram \| ▸ \| Zone 5 \| x \| ▾ \| Zone 5 \| torque \| Jupiter (Sol-5) \| Hyperborean or Wendigo mythology. Missing time and alien abduction. Inner-eye of the Barker spiral. \| SYZ \| ······························ \| 4+5=9 (Katak) \| PARTICLE \| ······························ \| ktt \| MESH_TAG \| ······························ \| 0031 \| PHASE_CT \| ······························ \| 32 \| DOOR \| Tokhatto — the Hyperborean Door \| GATE \| Gt-15 \| → \| Zone \| 6 \| Fifth Gate \| LEMURIAN ETHNOGRAPHY \| Upland rain forests of the Tak Nma. Hybrid bird-reptile forms — flying worms, bat-monsters and barking snakes. \| PHASE-5 LEMURS (32) \| 5::0 Tokhatto \| 5::1 Tukkamu \| 5::2 Kuttadid \| 5::3 Tikkitix \| 5::4 Katak \| 9 \| DEMONS IN PANDEMONIUM
- Controls in the Selection panel: clear; Numogram; Expand item; Zone 5; Remove Zone 5; Collapse item
- Header undo/redo: CCRUGDecimal Labyrinth (href=/numogram/); Undo (title="Undo (Cmd/Ctrl+Z)"); Redo (title="Redo (Shift+Cmd/Ctrl+Z)", disabled); Share current state (title="Share current state")

Expanded item (second item of the Selection accordion) reads:

> Selection \| Selected Elements (1) \| clear \| Numogram \| ▸ \| Zone 5 \| x \| ▸

## Hover readouts, keyboard shortcuts and other behaviours (observed, original layout)

| behaviour | observed |
|-----------|----------|
| layout-button hover labels | `["original","labyrinth","ladder","planetary"]` |
| hover Layers first row: popover text | `"Five nine-sum twinnings (0+9, 1+8, 2+7, 3+6, 4+5). Each zone pairs with its complement to 9, generating the Barker spiral’s fundamental architecture."` |
| hover Zones row 1 xenotation: popover text | `"one isn't real"` |
| hover Zones row 5: svg still present | `true` |
| panel Layers: has NO open/close toggle in the rendered DOM | `true` |
| panel Labels: has NO open/close toggle in the rendered DOM | `true` |
| panel Zones: has NO open/close toggle in the rendered DOM | `true` |
| panel Regions: has NO open/close toggle in the rendered DOM | `true` |
| panel Syzygies: has NO open/close toggle in the rendered DOM | `true` |
| panel Currents: has NO open/close toggle in the rendered DOM | `true` |
| panel Gates: has NO open/close toggle in the rendered DOM | `true` |
| drag Layers header by (+60,+40): left/top delta | `[60,40]` |
| drag Layers header raises z-index | `true` |
| undo/redo disabled at start | `[true,true]` |
| real mouse click on Zones row 5 centre (child span): selection heading | `"Selected Elements"` |
| after selecting zone 5: url | `"?selected=5"` |
| after selecting zone 5: undo enabled | `true` |
| after toggling Syzygies layer: url | `"?layers=currents%2Cgates&selected=5"` |
| undo: url | `"?selected=5"` |
| redo: url | `"?layers=currents%2Cgates&selected=5"` |
| Selection panel expand/collapse buttons | `2` |
| Selection panel remove buttons | `1` |
| clear: url | `"?layers=currents%2Cgates"` |
| Regions: Torque url | `"?layers=currents%2Cgates&region=torque"` |
| Regions: Time Circuit url | `"?layers=currents%2Cgates&tc=1"` |
| Particles on: url | `"?layers=currents%2Cgates&particles=1"` |
| Gates panel count-toggle click: selection heading | `"Selected Elements (25)"` |
| after Gates toggle-all + Currents/Syzygies row clicks: selection heading | `"Selected Elements (12)"` |
| key Escape clears selection: heading | `"Selected Elements"` |
| key S -> labyrinth: viewBox | `"0 0 800 880"` |
| key D -> ladder: viewBox | `"0 0 800 870"` |
| key A -> original: viewBox | `"0 0 800 940"` |
| key F -> planetary: url + viewBox | `["?layers=currents%2Cgates&layout=planetary&particles=1","0 0 800 800"]` |
| key A back -> original: viewBox | `"0 0 800 940"` |
| key 5 toggles gate 5: url | `"?layers=currents%2Cgates&particles=1&selected=5%2C6"` |
| key digit then Escape: heading | `"Selected Elements"` |
| Ctrl+Z after Escape: heading | `"Selected Elements (3)"` |
| Ctrl+Y: heading | `"Selected Elements"` |
| key Shift+/ opens shortcuts modal | `1` |
| Escape closes modal | `0` |
| shortcuts trigger opens modal | `1` |
| modal close button closes | `0` |
| modal backdrop click closes | `0` |
| share button: clipboard text | `"http://127.0.0.1:3777/numogram/?layers=currents%2Cgates&layout=original&particles=1&selected=5%2C6"` |
| header title link href | `"/numogram/"` |
| header title link click: pathname+search | `"/numogram/"` |
| page errors | `[]` |

Behaviour differences between layouts (before):

- `labyrinth`: 13 rows differ from the original layout, all because the start layout (query string, undo history, planetary date field) differs: undo/redo disabled at start = [false,true]; after selecting zone 5: url = "?layout=labyrinth&selected=5"; after toggling Syzygies layer: url = "?layers=currents%2Cgates&layout=labyrinth&selected=5"; undo: url = "?layout=labyrinth&selected=5"; redo: url = "?layers=currents%2Cgates&layout=labyrinth&selected=5"; clear: url = "?layers=currents%2Cgates&layout=labyrinth"; Regions: Torque url = "?layers=currents%2Cgates&layout=labyrinth&region=torque"; Regions: Time Circuit url = "?layers=currents%2Cgates&layout=labyrinth&tc=1"; Particles on: url = "?layers=currents%2Cgates&layout=labyrinth&particles=1"; page errors = []; (missing); (missing); (missing)
- `ladder`: 13 rows differ from the original layout, all because the start layout (query string, undo history, planetary date field) differs: undo/redo disabled at start = [false,true]; after selecting zone 5: url = "?layout=ladder&selected=5"; after toggling Syzygies layer: url = "?layers=currents%2Cgates&layout=ladder&selected=5"; undo: url = "?layout=ladder&selected=5"; redo: url = "?layers=currents%2Cgates&layout=ladder&selected=5"; clear: url = "?layers=currents%2Cgates&layout=ladder"; Regions: Torque url = "?layers=currents%2Cgates&layout=ladder&region=torque"; Regions: Time Circuit url = "?layers=currents%2Cgates&layout=ladder&tc=1"; Particles on: url = "?layers=currents%2Cgates&layout=ladder&particles=1"; page errors = []; (missing); (missing); (missing)
- `planetary`: 27 rows differ from the original layout, all because the start layout (query string, undo history, planetary date field) differs: undo/redo disabled at start = [false,true]; after selecting zone 5: url = "?date=DATE&layout=planetary&selected=5"; after toggling Syzygies layer: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&selected=5"; undo: url = "?date=DATE&layout=planetary&selected=5"; redo: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&selected=5"; clear: url = "?date=DATE&layers=currents%2Cgates&layout=planetary"; Regions: Torque url = "?date=DATE&layers=currents%2Cgates&layout=planetary&region=torque"; Regions: Time Circuit url = "?date=DATE&layers=currents%2Cgates&layout=planetary&tc=1"; Particles on: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&particles=1"; planetary key v: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&orbits=0&particles=1"; planetary key c: url = "?layers=currents%2Cgates&layout=planetary&orbits=0&particles=1"; planetary key x: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&orbits=0&particles=1"; key 5 toggles gate 5: url = "?date=DATE&layers=currents%2Cgates&layout=planetary&orbits=0&particles=1"; key digit then Escape: heading = "Selected Elements"; Ctrl+Z after Escape: heading = "Selected Elements"; Ctrl+Y: heading = "Selected Elements"; key Shift+/ opens shortcuts modal = 0; Escape closes modal = 0; shortcuts trigger opens modal = 1; modal close button closes = 0; modal backdrop click closes = 0; page errors = []; (missing); (missing); (missing); (missing); (missing)

## Other captured stages (kept in the scratch JSON, compared again in the after-inventory)

Stages captured for every layout (only `original` and `planetary` are tabulated; `labyrinth` and `ladder` have the same counts as `original` at each stage): initial, one per panel-toggle attempt (none exist, see finding 1), zone5-selected, zone5+syzygies-layer-toggled, after-undo, after-redo, selection-item-expanded, selection-cleared, labels-xenotation-on, many-selected, planetary-via-key (planetary: one per key), shortcuts-modal-open, final.

| stage | interactive elements | visible | note |
|-------|---------------------|---------|------|
| original / initial | 60 | 60 | selection: Selected Elements  |
| original / zone5-selected | 63 | 63 | selection: Selected Elements (1)  |
| original / zone5+syzygies-layer-toggled | 63 | 63 | selection: Selected Elements (1)  |
| original / after-undo | 63 | 63 | selection: Selected Elements (1)  |
| original / after-redo | 63 | 63 | selection: Selected Elements (1)  |
| original / selection-item-expanded | 63 | 63 | selection: Selected Elements (1)  |
| original / selection-cleared | 60 | 60 | selection: Selected Elements  |
| original / labels-xenotation-on | 60 | 60 | selection: Selected Elements  |
| original / many-selected | 96 | 96 | selection: Selected Elements (12)  |
| original / planetary-via-key | 64 | 64 | selection: Selected Elements  |
| original / shortcuts-modal-open | 62 | 62 | selection: Selected Elements  |
| original / final | 69 | 69 | selection: Selected Elements (3)  |
| planetary / initial | 65 | 65 | selection: Selected Elements  |
| planetary / zone5-selected | 68 | 68 | selection: Selected Elements (1)  |
| planetary / zone5+syzygies-layer-toggled | 68 | 68 | selection: Selected Elements (1)  |
| planetary / after-undo | 68 | 68 | selection: Selected Elements (1)  |
| planetary / after-redo | 68 | 68 | selection: Selected Elements (1)  |
| planetary / selection-item-expanded | 68 | 68 | selection: Selected Elements (1)  |
| planetary / selection-cleared | 65 | 65 | selection: Selected Elements  |
| planetary / labels-xenotation-on | 65 | 65 | selection: Selected Elements  |
| planetary / many-selected | 101 | 101 | selection: Selected Elements (12)  |
| planetary / planetary-key-v | 65 | 65 | selection: Selected Elements  |
| planetary / planetary-key-c | 64 | 64 | selection: Selected Elements  |
| planetary / planetary-key-x | 65 | 65 | selection: Selected Elements  |
| planetary / planetary-key-z | 65 | 65 | selection: Selected Elements  |
| planetary / shortcuts-modal-open | 65 | 65 | selection: Selected Elements  |
| planetary / final | 65 | 65 | selection: Selected Elements  |

## Mobile 390x800 (original layout)

- Interactive elements: 60; horizontal overflow: 0px; regions off-screen horizontally: [].
- Panel geometry (x, y, w, h): Layers 8,64,240,146; Labels 8,216,240,101; Zones 8,323,240,270; Regions 8,599,240,131; Syzygies 8,736,240,143; Currents 8,885,240,143; Gates 8,1034,240,270; Selection 8,480,360,305; header 8,14,240,30; topbar 0,0,390,68; footer 115,770,159,22; shortcutsTrigger 304,766,74,22; splash 0,0,390,800.
- Panel open/close toggle present on mobile: false.

## Overlays and motion (before)

```json
{
 "fixedFullViewportOverlays": [
  {
   "cls": "fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-[7",
   "z": "70",
   "pe": "none",
   "opacity": "0.04",
   "text": "CCRUG"
  }
 ],
 "bodyPseudo": {
  "body::before": {
   "content": "\"\"",
   "z": "9998",
   "animation": "none"
  },
  "body::after": {
   "content": "\"\"",
   "z": "9999",
   "animation": "crt-flicker"
  }
 },
 "runningAnimations": [
  "crt-flicker"
 ],
 "shellStyleCounts": {
  "shadowEls": 8,
  "textShadowEls": 51,
  "filterEls": 3,
  "clipPathEls": 9,
  "gradientEls": 16
 }
}
```

Panel geometry at 1440x900 (x, y, w, h, z): Layers 12,64,180,146,z40; Labels 12,228,180,101,z41; Zones 12,347,180,270,z43; Regions 216,64,180,131,z42; Syzygies 12,635,180,143,z45; Currents 216,213,180,143,z44; Gates 216,374,180,270,z46; Selection 1022,64,320,318,z47; header 12,14,384,30,z46; topbar 0,0,1440,68,z40; footer 634,869,172,24,z62; shortcutsTrigger 1354,866,74,22,z74; splash 0,0,1440,900,z70.

## After-inventory and diff (commits 006bb44, a8d4336 and c5aa256 applied)

The same capture script ran against the rebuilt export (`npm run build`, `out/`, loopback) and was diffed against the before capture: 51 desktop snapshots (4 layouts, every stage above) plus the 390x800 snapshot, 3425 interactive-element lines, 682 region texts and 177 behaviour rows compared. Any difference is listed below; nothing else differs.

**Result: zero lost, added, renamed, reordered, disabled or hidden controls in any snapshot, and all 177 behaviour rows identical** (hover labels and popovers, drag delta and z-index raise, undo/redo state, URL after every action, selection headings, keyboard shortcuts including the digit/Escape/Shift+/ paths, modal open/close via key, trigger, close button and backdrop, share clipboard text, header title link, layout viewBoxes, page errors, mobile horizontal overflow 0 px and no region off-screen). That includes the pre-existing dropped click on the centre of a Zones row (finding 2), which is unchanged.

| # | difference (before -> after) | where | why it is intended |
|---|------------------------------|-------|--------------------|
| 1 | `splash` region text `CCRUG` -> absent; one full-viewport fixed overlay (`z-70`, opacity 0.04, logo mark + wordmark) -> none | all 52 snapshots | intro splash and its residual title layer removed (a8d4336) |
| 2 | `body::before` and `body::after` `content: ""` (z 9998 / 9999) -> `none` | all 52 | vignette and scanline overlays removed (006bb44) |
| 3 | running animations `crt-flicker` (always) and `pulse-dot` (whenever an info block is shown) -> none | all 52 | flicker animation removed (006bb44); status-dot pulse removed (c5aa256). No animation is running in the shell at rest any more |
| 4 | shell style census (elements outside the `<svg>`): text-shadow 51 -> 0, filter 3 -> 0, clip-path 9 -> 0, gradient background 16 -> 1, box-shadow 8 -> 1 in the original layout (with a selection open 16 -> 1 and 22 -> 1) | all 52 | glows, drop shadows and text shadows removed (006bb44, c5aa256); cut corners and gradient surfaces removed (c5aa256). The one remaining gradient is the top-bar fade behind the layout buttons; the one remaining box-shadow is the active layout button's inset underline (state cue), both kept on purpose |
| 5 | Selection panel text: `DataRow` used to render a 2 px coloured tick, the label, a `flex-1` span holding 30 middle-dot characters (`·` x 30, font-size 7, letter-spacing 0.15em, clipped) and then the value. The tick (no text) and the dot-leader span are gone; the value is now right-aligned with `ml-auto`. In the text dump this shows as one text node of 30 `·` characters disappearing after each row label, in the 21 of 51 desktop snapshots where an expanded detail item contains data rows (zone: SYZ, PARTICLE, MU_TANTRA, MESH_TAG, PHASE_CT; syzygy: TWINNING, DEMON, CURRENT_DIFF; current: FORMULA; gate: CUMULATION, PLEX, CHANNEL) | Selection panel | decorative leader and tick. Every label and every value text is unchanged: the word-diff of all 21 differences contains only the leader token and its separator |
| 6 | Selection panel height 318 -> 297 px at 1440x900 (305 -> 284 at 390 px); the "Numogram" intro block lost its three neon dividers and its paragraphs got 6 px margins | Selection geometry | divider removal (c5aa256) |

Every other region (Layers, Labels, Zones, Regions, Syzygies, Currents, Gates, header, top bar, footer, shortcuts trigger) has identical x, y, width, height and z-index.

**Tick-off against the before-inventory (all identical after)**

- [x] Top bar: layout buttons A S D F with hover label; planetary Z X C V and the date field (with its shortcut guard)
- [x] Header: title link, Undo, Redo, Share (clipboard URL), disabled states
- [x] Layers (4 layers + Particles) and Labels (3) toggles with ON/OFF text and hover popovers
- [x] Zones: count toggle plus 10 rows with planet, xenotation, region, "one isn't real" hover card
- [x] Regions (Torque, Warp, Plex, Time Circuit), Syzygies (5), Currents (5), Gates (count toggle plus 10)
- [x] Selection panel: clear, accordion open/close, per-item remove, all zone/syzygy/current/gate/demon detail text, intro text and controls line
- [x] Shortcuts trigger and modal (all six lines, Shift+/, Escape, close button, backdrop)
- [x] Sources footer (4 links)
- [x] Keyboard: A S D F, Z X C V, digits 0-9, Escape, Shift+/, Ctrl+Z, Ctrl+Y
- [x] Panel drag (delta and z-index raise) and URL state (layout, layers, region, tc, particles, date, orbits, selected), both in the before/after capture
- [x] Canvas marquee selection and node-click pinning: not in the before capture (their code is untouched, and they sit in the oracle-adjacent subtree); verified after the change with a scripted drag across the diagram (marquee box shown while dragging, then all 10 zones selected, `?selected=0,...,9`) and a click on the zone 5 node (Selection heading `(1)`, pinned background readout shows the Zone 5 text)
- [x] Pinned background readout (renders as soon as an element is pinned; before, it waited for the intro to finish)
- [ ] Panel open/close toggles: none existed before and none exist now (finding 1); nothing to preserve, so nothing to tick

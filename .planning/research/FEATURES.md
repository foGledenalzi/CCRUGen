# Feature Research

**Domain:** Arbitrary-base (even n) numogram generator: typed engine + static interactive viewer + demon layer + naming builder + export. Brownfield on `lumpenspace/ccru` (base-10 only).
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH. Numogram math and local-source findings are HIGH (read directly, cross-checked with a scratch computation). The numogram-tool competitor landscape is thin and one target (numogram.xyz) could not be reached (LOW for that item). Generic-generator patterns are MEDIUM (WebSearch, multiple sources agree, few primary docs).

v1 scope is fixed by the user (core diagram + demons + naming builder + export). Out: pitch, Decadence/Subdecadence, rites/omens, planetary/zodiac/tarot correspondences, any mythos or card-game layer. Nothing below re-opens that; items touching those areas are listed as anti-features.

## Key Findings

1. **Nothing comparable exists.** The only arbitrary-base numogram tool is gramculator, and it prints three text lists (no diagram, regions, demons, export or sharing). Every other web numogram is base-10 only. The 2018 /x/ "General Numogrammatics" effort hand-built Excel tables (bases 2-36) and hand-drawn diagrams (4, 6, 8, 16, 22) and its author says software is the missing piece. The whole differentiator space is open; the risk is table-stakes breadth, not competition.
2. **Multi-Torque is the norm, not an exotic case.** The guide implies multiple Torque cycles belong to bases 3^N+1. The engine math shows otherwise: 31 of the 50 even bases in 2..100 have two or more cycles (e.g. 18, 26, 32 = [5,5,5], 36 = [12,3,2], 64 = [6,6,6,6,3,3], 100 = [15,15,5,5,5,3]). Base 666 has 14 cycles, and no even base up to 1000 exceeds 38. The region UI must scale past 3 cycles and cannot assume distinct lengths.
3. **At base 666, 99.4% of demons are chronodemons** (220,116 of 221,445; amphi 1,328; xeno 1). A type filter alone does not make the set browsable. The scalable design is implicit demons (mesh index and type computed in O(1)), a Canvas triangular matrix (the "pandemonic pyramid" idea), zone-centric slices (always n-1 demons per zone) and search, never one DOM node per demon.
4. **Zone labels: separate identity from display.** Keep the integer 0..n-1 as identity (decimal in URLs/JSON); make the display token a pluggable scheme. gramculator already established the convention of a user-supplied "numerical alphabet" (up to 231 chars, presets for Hebrew, Greek, Elder Futhark, Base62, Base64). Default: 0-9a-z up to 36, decimal above, custom alphabet on request. Multi-digit values (gate values T(k) are always 2 digits in-base) need a separator once tokens exceed one character.
5. **The guide has two spec slips the engine and tests must not inherit:** its demon subtype counts sum to 47, not 45 (Syzygetic Xenodemons are 2, not 4), and its Part-3 naming example concatenates low-then-high while canonical CCRU names are high-then-low (see "Open Decisions").
6. **Naming builder has no precedent**; seeded, lockable, editable, JSON-portable generators are standard in map/city generators (Watabou, Azgaar). Determinism across releases (pinned PRNG algorithm + version in the JSON) is the hidden requirement.
7. **Poster export needs decisions the browser hides:** text as outlines vs embedded subset font (sources disagree on design-tool support of `@font-face` in SVG), no CSS variables or filters in the poster theme, PNG canvas area limits (Chrome 268,435,456 px; Safari 16,777,216 px), and fonts must be embedded or outlined before rasterizing.
8. **Compare is cheap where it matters:** the mesh number `a(a-1)/2 + b` is base-independent, so the demon set of a smaller base is literally the top-left sub-triangle of a larger base's set. That gives a real "nesting" comparison and a type-drift diff essentially for free.

## Landscape: What Comparable Tools Do

| Tool | What it is | Features observed | Gaps relative to this project | Confidence |
|------|-----------|-------------------|-------------------------------|------------|
| gramculator (alektryon.github.io/gramculator) | Arbitrary-base numogram calculator | Text field for a custom digit alphabet (up to 231 chars); 19 preset alphabets (binary, 4, 8, 10, 12, 16, Hebrew 22, Greek 24, Elder Futhark 24, English 26, Greek numerals 27, Arabic 28, RFC 4648 32, z-base-32, alphanumeric 36, Bitcoin 58, Base62, Base64 url-safe and standard); live recompute on each keystroke (`input` listener); outputs three text lists: `Zn-x`, `hi::lo => current`, `Gt-<T(k) in base>`; shows alphabet length | No diagram, no regions (Plex/Warp/Torque), no demons, no export, no share, no copy of results; syzygy list uses `hi::lo` which matches guide notation | HIGH (read page source and `base.js`) |
| gramculator DIY page | Static "calculate by hand" guide | Explains zones, syzygies (`9::0`), currents, gates, "plex it"; states "all arithmetic must be done in the base of that #-gram" | Not a tool | HIGH (local copy) |
| numogram.xyz | Link hub ("More resources" from gramculator; described as collating numogrammatic resources) | Unknown | Domain did not resolve from this environment on 2026-09-25 (DNS failure); Wayback blocked | LOW, unverified |
| lumpenspace/ccru viewer (and qliphoth.systems/numogram deployment) | Base-10 interactive viewer (the codebase being extended) | Layers (syzygies, currents, gates, pandemonium, particles, colours); label toggles (numbers, tic xenotation, planets); layouts (original, labyrinth, ladder, planetary); hover/select details; click-drag multi-select and "Selected Elements" panel; panels (Zones, Regions, Time Circuit, Currents, Gates); shortcuts (digits toggle gates, A/S/D/F views, Alt+drag pan, scroll zoom, `?` help, Ctrl+Z/Y undo/redo, Esc); URL share; server share-image | Base-10 hard-coded; digit-key shortcuts cannot scale past 9; needs Vercel for share image | HIGH (repo + architecture docs), MEDIUM (deployment feature list) |
| CCRU Research Archive "Numogram (Public)" (nothinghuman.org) | Sourced base-10 reference tool | Zone selector, legend (syzygies, currents, regions, gates), Cmd-K search, **three-tier provenance labels** (primary-local / derived / unverified); refuses to render the unattested Pandemonium Matrix (shows only the 5 syzygetic demons) | Base-10; no export/share documented | MEDIUM (single fetch) |
| numogram-oracle, TheScrawl/numogram | Toy oracle (click a digit for twin, current, aphorism); Python script | Base-10 only, minimal | Not comparable | MEDIUM |
| Tzitzimiyotl "General Numogrammatics" (2018 /x/ thread + Tumblr) | Hand-built research corpus | Excel tables for bases 2-36 built with Excel's BASE(); hand-drawn diagrams for 4, 6, 8, 16, 22; "compressed" N-22 diagram collapsing each syzygy to one node; "digital pyramid" tables (syzygies by sum and difference) and "pandemonic pyramid" to base 36; Vysparov demon names reused across bases by net-span (N-4 has 6 demons, N-6 15, N-8 28); author states software was blocked by programming skill | No software; invented fictional history (MIEE/Lombardo) is explicitly fiction and must not be imported as canon; terminology differs from the guide for base 16 (see Open Decisions) | HIGH for what the thread says (local copy); its lore is not evidence |
| Times-table / modular multiplication circle visualizers (Coding Train, Desmos, GeoGebra) | Closest generic analogue: current map is doubling mod (n-1) | Modulus and multiplier sliders, live redraw, animated sweep | Single-parameter toy; no labelling, export, regions | MEDIUM |
| Watabou Medieval Fantasy City Generator, Azgaar Fantasy Map Generator | Best-in-class seeded generators | Seed reproducibility; shareable links carrying seed and options; export SVG, PNG (Azgaar up to 8x), JSON; procedural name generators; "lock a feature, reroll the rest" | Different domain, but the interaction model this project should meet | MEDIUM |
| Mermaid Live Editor | Diagram editor with permalinks | Whole state compressed (JSON, deflate, base64url) into the URL hash `#pako:`; hash never reaches a server, fits static hosting | | MEDIUM |
| Cytoscape.js / yFiles / Sigma | Graph libraries | Concentric and circle layouts; neighbourhood highlight on hover/tap; Canvas/WebGL past a few thousand elements (SVG bottleneck reported at roughly 3k-5k elements) | | MEDIUM |

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the product feel broken or unfinished for someone who has used the base-10 viewer, gramculator, or any generator with a slider and a preview.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Base picker restricted to even bases with instant summary (zones, pairs, Warp yes/no, Torque cycle lengths, demon count) | Every generator has a parameter control with live feedback; gramculator recomputes per keystroke | LOW | Typed input + stepper (+/-2) + small slider for the common range; odd input explains "self-paired zone, which the CCRU rejects" and snaps to the neighbours. Summary comes straight from the O(n) engine. |
| Notable-base presets | Users arrive wanting "the base-12 one from the guide" | LOW | Chips with one-line blurbs sourced from the guide: 2 (smallest, Plex only), 4 (smallest with inter-zone minor flow, Plex + Warp), 6 (smallest with Torque), 8, 10 (canonical), 12 (guide example), 14, 16 ([4,2]), 22, 28 ([9,3]), 80 ([39], contrast with 82), 82 ([27,9,3]). |
| Live diagram: zones, syzygy pairing, currents (arrowed major flow), gates (minor flow), region colouring (Plex / Warp / Torque) | Core value; the /x/ thread and the guide's figures all show exactly this | HIGH | Depends on procedural layout and renderer tiers (other research dimensions). Base 10 keeps its four authored layouts as a preset. |
| Correct in-base zone labels up to base 36 (0-9, a-z) | Guide and gramculator use in-base digits; the guide writes `a`, `b` lowercase | LOW | The /x/ thread writes uppercase (`B::4`), so make case an option. Beyond 36 see "Zone labelling beyond base 36". |
| Defined labelling scheme beyond base 36 | Digits run out; unlabelled or ambiguous nodes = broken | MEDIUM | Scheme switch: digits / decimal / custom alphabet / xenotation. Default decimal above 36. |
| Hover-to-highlight and click-to-pin | Existing viewer has it; every graph tool (Cytoscape neighbourhood highlight) has it | MEDIUM | Hover a zone: highlight its syzygy partner, outgoing current, incoming current, gate in/out, region. Single delegated pointer handler with hit-testing, not per-element handlers (CONCERNS.md flags 4,950 handlers at base 100). Esc clears. |
| Detail panel for zone / syzygy / current / gate / demon | Existing HoverInfo panel | MEDIUM | Always show the decimal value beside a non-decimal label ("zone b = 11"). Generalize `HoverInfo`; drop base-10 lore fields for non-preset bases. |
| Layer toggles (syzygies, currents, gates, regions, labels, demons) | Existing viewer; generic diagram tools | LOW | Keep layers as state independent of renderer tier. |
| Region legend with counts, lengths and member zones; click to isolate | Users must be able to read Plex / Warp / Torque(s) | MEDIUM | See "Multiple Torque regions". |
| Zoom, pan, fit-to-view, reset | Existing viewer; universal | LOW | Keep scroll zoom / Alt+drag; add a fit button and pinch on touch. |
| Shareable URL (`?base=`, label scheme, layers, selection, seed) | Existing feature; every serious generator has permalinks | MEDIUM | Generalize `shareParams.ts` (hard-coded 0-9 and max-10 checks). Keep existing base-10 URLs working. Put larger state in the hash (compressed) so it never leaves the browser. |
| Export: SVG, PNG, engine-data JSON | Stated v1 scope; Watabou/Azgaar set the expectation | MEDIUM | Client-side only; replaces the Vercel Blob share image. See "Poster-quality SVG export". |
| Text view of the numogram (zones, `hi::lo => current`, gates) with copy button | gramculator's entire output; also the non-visual equivalent of the diagram for accessibility | LOW | Table plus plain-text/CSV copy. Doubles as the screen-reader path and as a debugging view for golden tests. |
| Demon list: all T(n-1) demons with net-span `a::b`, mesh number, type/subtype; sortable and filterable; searchable by net-span or mesh number | Stated v1 scope; the Pandemonium Matrix is a 00..44 listing | MEDIUM | Virtualized (TanStack Virtual handles million-row lists by rendering only visible rows). Never materialize 221,445 objects. See "Demon layer at 221,445". |
| Demon counts by type, shown instantly at any base | First question a user asks after picking a base | LOW | Closed form: with t Torque zones and x = n - t Plex/Warp zones, chrono = C(t,2), amphi = t*x, xeno = C(x,2). No enumeration needed. |
| Naming builder: per-zone sound, derived demon names, edit a name, JSON import/export | Stated v1 scope; the guide's Part 3 is exactly this | MEDIUM | See "Naming builder UX". |
| Keyboard operability and semantic labels | WCAG 2.1.1 keyboard, 4.1.2 name/role/value; the existing viewer's digit shortcuts stop working past 9 zones | MEDIUM | Focusable zones (arrow keys follow syzygy / current / gate), visible focus ring, SVG `role="img"` + title/desc for static output, `aria-label` per interactive node. Redesign digit shortcuts (multi-digit entry or a "go to zone" box). |
| Non-colour cues and contrast | WCAG 1.4.1 use of colour, 1.4.11 non-text contrast (3:1) | MEDIUM | Region identity by dash pattern / marker shape as well as hue; contrast-checked palette. |
| `prefers-reduced-motion` respected; no animated morph between bases | Existing layout tween (about 400 ms) and glitch effect | LOW | Zone count changes with base, so the tween has nothing to interpolate; use crossfade or instant swap. |
| Graceful large-base behaviour with a visible state message | PROJECT constraint: never freeze the page | MEDIUM | "Rendering tier: Canvas. Demons: virtualized." Debounce base changes while dragging a slider; compute on commit above a threshold set by the ceiling spike. |
| Glossary / definitions panel | Audience mixes researchers and hobbyists; sources disagree on terms (see Open Decisions) | LOW | State the definitions used: Plex = fixed pair {0, n-1}; Warp = fixed pair {o, 2o} when n = 3o+1, o odd; Torque = each remaining cycle. |
| Works offline / static export | PROJECT constraint | LOW (feature) | Removes `@vercel/blob`, analytics and `/api/share-image` coupling; treat as prerequisite, not feature. |
| Base-10 preset parity | Existing users must not lose anything for base 10 | MEDIUM | Four authored layouts, canonical demon names (45), tic xenotation labels remain for the preset. Planetary layout remains base-10 only. |

### Differentiators (Competitive Advantage)

Nothing else in the ecosystem offers these. They align with the Core Value (derive correctly, draw legibly) and with the audience's framing of numograms as "a class of objects".

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Syzygy-collapsed "pair graph" view | The current map on syzygy pairs is a permutation, so it is a set of disjoint cycles; drawing pairs as single nodes makes every Torque cycle a clean ring with no crossings. Precedent: the /x/ thread's "compressed" N-22 diagram, adopted because the full graph got too dense. | MEDIUM | Likely the default at large n. Cycles as concentric or side-by-side rings, Plex/Warp as fixed loops. Layout details belong to the layout research; the view itself is a feature requirement. |
| Base atlas: sortable property table over all even bases 2..N | Answers the guide's own open questions ("do all bases of 6 or above have a Torque region?") in seconds; the engine is O(n) per base | LOW-MEDIUM | Columns: zones, pairs, Warp?, cycle count, cycle lengths, demons, numodemons. Compute in a Web Worker. Data point: only bases 2 and 4 have zero Torque cycles up to 200. Warp bases up to 100: 4, 10, 16, 22, ... 100. |
| Two-base comparison (summary diff table; side-by-side synchronized diagrams; nested demon sets) | Directly serves "numograms as a class"; guide Appendix A is a hand-made gallery of this idea | MEDIUM (table) to HIGH (synced diagrams) | See "Comparing two bases". |
| Demon triangular matrix (Canvas heat-map, O(1) picking) | Makes 221,445 demons browsable as a picture; reproduces the Pandemonium Matrix ordering (row a, column b; mesh order) | MEDIUM-HIGH | See "Demon layer at 221,445". |
| Generalized demon taxonomy with closed-form counts and optional Torque-split subtypes | The guide says the split is optional ("or left with the original designations") and leaves cross-Torque chronodemons undefined | MEDIUM | Toggle for "split by Torque"; needs the Open Decision on inter-Torque chronodemons. Numodemons (a + b = n): n/2 - 1 of them. |
| Seeded, lockable, euphony-smoothed name generator | No numogram tool generates names; matches the guide's "concatenate, then edit for euphony" process | MEDIUM | See "Naming builder UX". |
| Canonical name inheritance by net-span | The /x/ thread reuses the 45 Vysparov names for a::b with a, b <= 9 in bases 4, 6, 8 (and cites 9::6 and 8::7 in base 16) | LOW | Toggle on top of existing `DEMON_NAMES`. Caveat: type of a demon changes with base, so inherit the name only. Semantics beyond the thread are unverified (LOW). |
| Custom-alphabet labelling with presets | gramculator's signature feature; supports Hebrew (22), Greek, Elder Futhark (24), Braille (256 code points), Base62/64 | LOW (once schemes exist) | Validate unique grapheme clusters; warn when the export font lacks glyphs. Uses `Intl.Segmenter`. |
| Poster-quality export (paper sizes, print theme, outlined text option, named layer groups, title block, deterministic bytes) | Stated audience want ("poster-quality SVG of an arbitrary-base numogram"); no comparable tool exports anything | MEDIUM-HIGH | See "Poster-quality SVG export". |
| Provenance badges: canonical (base-10 preset, cited page) / derived (engine) / user-authored | Adopts the CCRU Research Archive's honest three-tier idea; guards the Core Value by marking which structure is CCRU canon versus our generalization | LOW | Small badge in detail panels and the export title block. |
| Region-crossing flow classification | The guide's base-12 analysis is built on which minor flows enter or leave which region and which zones receive no major flow | MEDIUM | Derived table: each gate/current tagged source-region -> target-region. Invariant worth surfacing: currents always land on odd zones, each odd zone receives exactly one, even zones receive none. |
| Single-path flow tracer (follow currents/gates from a chosen zone, step or auto-play) | Understanding cycles by walking them; not the same as rites | LOW-MEDIUM | Deterministic single path only. Explicitly not path enumeration (see anti-features). P3. |
| One-file "numogram bundle" (engine parameters, label scheme, naming, view options) with drag-and-drop import | Portability without a server; Azgaar-style save/load | LOW-MEDIUM | Reuses the naming JSON schema; adds `labels`, `layout` and `view` blocks. |
| Theme set: cyber-dark (existing), paper-light (print), mono/high-contrast | Generators commonly offer theming; poster export needs a light theme anyway | MEDIUM | Theme tokens resolved to literal values at export time (no CSS variables in exported SVG). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rites / omens (path enumeration between demon endpoints) | The base-10 Matrix lists rites; the guide describes them | Out of v1 scope; simple-path enumeration is exponential; the guide itself calls the content "largely random" | Single-path flow tracer (P3) if users want to explore paths |
| Pitch (Ana/Cth), Decadence/Subdecadence cards, Pylon card assignment | Guide Part 2 details it; users of the Matrix ask for it | Out of scope; guide Part 3: Subdecadence generalization is "a Hellish mess" with no general rule and needs a new card game per base | None; keep demon `pitch`/`card` fields out of the schema so the door is not half-open |
| Planet / zodiac / tarot / I Ching correspondences for arbitrary bases | The /x/ thread ties base 16 and 22 to tarot; guide ties base 12 to the zodiac | Out of scope; hand-tuned per base; base-10 planetary layout stays a preset only | Free-text per-zone notes in the naming JSON if users insist (not in v1) |
| Importing the /x/ thread's invented history (MIEE, Lombardo, "Telosphere", "pyramidal expansion") as content | It is atmospheric and the tables it accompanies are useful | The author states it is fiction; presenting it as sourced structure would break the provenance badge idea and the Core Value | Use only the structural tables (sum/difference pyramids) as inspiration for the matrix view |
| Odd-base numograms (traction cycles plus "collapse routes", per the thread) | The thread describes them; researchers are curious | Self-paired zone violates the CCRU rule; different structure means different engine, renderer and demon rules | Explanatory message on odd input (v1); revisit as a separate milestone |
| Drawing every demon as a chord or path at high base | The existing "Pandemonium" layer does it at base 10 (about 90 paths) | 221,445 chords is unreadable and un-renderable in SVG; CONCERNS.md counts about 9,900 path elements already at base 100 | Draw all only while total <= a spike-set limit (suggestion: about 150, base <= 16); above that draw selected/hovered demons only, plus the matrix view |
| One DOM node (with handlers, filters, gradients) per zone/gate/demon at any size | Simplest thing in React/SVG | SVG bottleneck reported at roughly 3k-5k elements; per-zone gradient/filter defs bloat at base 100+ | Tiered renderers (SVG, Canvas LOD, headless), event delegation, shared `<defs>` |
| Hard cap on base ("max 100") | Simple guardrail | PROJECT decision: no arbitrary cap; thresholds measured | Soft warning plus automatic tier downgrade; headless SVG/JSON above the interactive ceiling |
| Animated morph between bases | Feels polished (existing layout tween) | Zone sets differ, so interpolation is meaningless and expensive | Crossfade or instant swap, honouring reduced motion |
| Manual drag-to-place zones at arbitrary base | Common expectation from graph editors | Conflicts with deterministic procedural layout and shareable URLs; persistence of hundreds of coordinates is heavy | Layout parameters (ring order, rotation, spacing, seed) that are cheap to encode in URL/JSON |
| Editing derived data (currents, gates, regions) | "What if I change this arrow" | Breaks the Core Value (derivation must be correct and golden-testable) | Read-only derived data; users edit only labels, names and theme |
| Server-side share image / gallery / accounts | Existing feature via Vercel Blob | Breaks static-first; needs secrets and rate limiting (CONCERNS.md security notes) | Local PNG/SVG download, optional "copy image" (Clipboard API), permalink |
| AI/oracle-generated lore, aphorisms or names | numogram-oracle style toys | Mythos layer; not reproducible; conflicts with the seeded-determinism promise | Purely algorithmic seeded generation |
| Audio / phonetic (IPA) synthesis for the sounds | "Sounds" invites it | Large scope, no requirement; guide treats sounds as pseudo-phonemes for euphony only | Plain Unicode text strings |
| Base-agnostic keyboard shortcuts that use digit keys per zone | Existing shortcut design | Cannot address more than 10 zones | "Go to zone" input, arrow-key traversal, shortcuts limited to layers and views |

## Deep Dives on the Requested Topics

### 1. Zone labelling beyond base 36

**Principle:** identity is the integer (0..n-1), always serialized in decimal in URLs, JSON and demon keys (`"9:8"` matches the existing `DEMON_NAMES` key format). Display is a `LabelScheme` applied at render/export time only, so switching schemes never invalidates saved names or links.

| Scheme | Symbols | Reach | Trade-offs | Role |
|--------|---------|-------|-----------|------|
| `digits` | 0-9 then a-z (guide, gramculator `BASE32`); case option | n <= 36 | One char per digit, unambiguous concatenation (`Gt-2d`); the sources disagree on case (guide lower, /x/ thread upper) | Default for n <= 36 |
| `decimal` | 0..n-1 in decimal | any n (max 3 chars up to base 1000) | Always legible and unambiguous for a single zone; multi-digit values need a separator (see below) | Default for n > 36 |
| `alphabet` | User string or preset, one grapheme per zone | length of string (gramculator caps at 231) | Must be unique, at least n long, and covered by the export font; Base62 (0-9A-Za-z) is legible only with a font that separates I/l/1 and O/0 | Power-user option |
| `xenotation` | Tic xenotation (existing `xenotation.ts`, base-agnostic) | any n | Strings grow long; on-node labels only for small n, otherwise in hover/detail | Optional label layer |
| Glyph-block presets | Braille U+2800-28FF gives exactly 256 symbols; Hebrew 22; Greek 24; Elder Futhark 24 | preset-specific | Only as `alphabet` presets, not separate code paths | Presets |

**Multi-digit values.** Gate values are T(k) written in-base; with k <= n-1, T(k) < n^2, so they are always one or two digits. With single-character digits, juxtaposition works (`2d`). With decimal tokens use a comma between digits, following the sexagesimal convention (`7,30`): base 100, T(99) = 4950 -> `49,50`. The guide's own example (base 16, T(9) = 2d) checks: decimal scheme renders `2,13`.

**On-node fit.** One or two characters fit inside a node; three or more (base >= 101 in decimal) move outside the node, or hide until zoom (LOD), or show on hover. Never truncate silently.

**Mesh numbers.** Mesh-00..Mesh-44 are two-digit decimals in the source. Offer decimal (default, matches canon) and "in base" (same scheme). Small decision, see Open Decisions.

**Dozenal note:** the Dozenal Society's digits for ten and eleven are X ("dek") and the reversed-3 letter Ɛ ("el"), versus a/b in the guide; ship as an `alphabet` preset rather than a separate scheme.

### 2. Presenting multiple Torque regions (16 -> [4,2], 28 -> [9,3], 82 -> [27,9,3], and beyond)

Data the UI must survive (scratch engine computation; reproduces the guide's stated facts for 10, 12, 16, 28, 80, 82):

| Base | Torque cycles (in pairs) | Fixed pairs | Chrono / Amphi / Xeno | Total |
|------|--------------------------|-------------|-----------------------|-------|
| 10 | [3] | Plex, Warp | 15 / 24 / 6 | 45 |
| 12 | [5] | Plex | 45 / 20 / 1 | 66 |
| 16 | [4,2] | Plex, Warp | 66 / 48 / 6 | 120 |
| 28 | [9,3] | Plex, Warp | 276 / 96 / 6 | 378 |
| 32 | [5,5,5] | Plex | 435 / 60 / 1 | 496 |
| 36 | [12,3,2] | Plex | 561 / 68 / 1 | 630 |
| 64 | [6,6,6,6,3,3] | Plex, Warp | 1,770 / 240 / 6 | 2,016 |
| 82 | [27,9,3] | Plex, Warp | 3,003 / 312 / 6 | 3,321 |
| 100 | [15,15,5,5,5,3] | Plex, Warp | 4,560 / 384 / 6 | 4,950 |
| 256 | 18 cycles (largest 8, smallest 2) | Plex, Warp | 31,626 / 1,008 / 6 | 32,640 |
| 666 | 14 cycles (largest 36, smallest 2) | Plex | 220,116 / 1,328 / 1 | 221,445 |
| 1000 | 16 cycles (largest 36, smallest 3) | Plex, Warp | 495,510 / 3,984 / 6 | 499,500 |

Recommendations:

- **Stable identity and order.** Sort cycles by length descending, ties broken by smallest member; name them Torque-A, B, C, ... (guide Appendix B convention; Torque-I/II is the guide's Part-3 alias for demon subtypes; continue AA, AB after Z, since up to 38 cycles occur among even bases up to 1000). Ties (e.g. three 5-cycles at base 32) must not reorder between renders or URLs.
- **Colour budget.** Up to 8 cycles: one hue each, from a colourblind-safe categorical set (the eight Okabe-Ito colours; guidance is to stay at 6-8 categories). Above 8: colour by cycle length (equal-length cycles share a hue family and vary in lightness) and add a second cue (ring position, label chip). Plex and Warp keep fixed, distinct hues plus distinct dash patterns.
- **Legend as a table, not a swatch list.** Rows: region, cycle length, pair count, zones. Collapse equal cycles ("Torque x3, 5 pairs each"), with expand. Click = isolate, Shift-click = mute, hover = highlight in diagram. At 14-38 cycles the legend is a scrollable table.
- **Two diagram views.** (a) Full zone view with cycle-coloured nodes; (b) pair graph where each syzygy is one node and each Torque cycle is its own ring, largest outside. View (b) is the only one that stays legible at 6+ cycles and it is what the /x/ author reached for at base 22.
- **Zone detail always names the region:** "Zone 7 - Torque-B - syzygy 7::4 -> current to 3 - gate to 1".
- **Demon subtypes default to the guide's plain set** (Cyclic Chrono, Syzygetic Chrono, Plex/Warp Amphi, Chaotic and Syzygetic Xeno); a "split by Torque" toggle adds Torque-I/II variants. Cross-Torque chronodemons need a decision.
- **Do not hard-code "at most 3".** The guide's 3^N+1 "electron shell" pattern is real for bases 4, 10, 28, 82 but multi-Torque occurs widely elsewhere.

### 3. Making the demon layer usable at 221,445 demons

Principles: a demon is a pair (a, b) with a > b; its mesh number is `a(a-1)/2 + b`; the inverse is `a = floor((1 + sqrt(1 + 8m)) / 2)`, `b = m - a(a-1)/2` (checked: mesh 44 -> 9::8; mesh 221,444 -> 665::664; use an integer correction step at very large m). Type is a function of the two zones' regions, so nothing needs to be stored.

| Layer | What it shows | Scales because | Complexity |
|-------|---------------|----------------|------------|
| Summary facets | Counts per type/subtype, numodemons (n/2 - 1), plus click-to-filter | Closed-form counts | LOW |
| Triangular matrix (Canvas) | One cell per demon in mesh order (row a, column b), coloured by type; zoom/pan; crosshair on a selected zone; hover shows `a::b`, mesh, type, name | 221,445 cells is a trivial `ImageData`; picking is arithmetic on pointer coordinates; no DOM per demon | MEDIUM-HIGH |
| Zone-centric slice | "Demons of zone z": always n - 1 entries (665 at base 666) | Small, browsable list | LOW |
| Virtualized table | Sort by mesh (default), filter by type/region/zone/torque, search by `a::b` (using the active label scheme), mesh number or name | Only visible rows render (a 600 px viewport needs about 20 rows regardless of dataset size) | MEDIUM |
| Selected-demon chord | Draw one demon (or the hovered/selected few) as an arc between its two zones on the main diagram | O(selection) | LOW |
| All-demons chords (small bases only) | The existing "Pandemonium" layer | Only while total <= a threshold from the ceiling spike | LOW (existing) |
| Streaming export | CSV/JSON of all demons generated in a Web Worker in chunks into a Blob | No giant array in memory; about 500k rows at base 1000 | MEDIUM |

Notes: type facets are lopsided at scale (chrono is 99.4% at base 666), so the chrono facet needs sub-facets: syzygetic (one per Torque pair, 332 at base 666) vs cyclic, and same-Torque vs inter-Torque. Names are generated lazily; only user overrides are stored. Zone labels in search input must follow the active label scheme; accept decimal as fallback.

### 4. Naming builder UX (per-zone sounds -> demon names, seeded, editable, import/export)

Process from the guide (Part 3, Appendix B): one sound per zone; demon name = the two zones' sounds joined, then "edit for euphony". CCRU base-10 zone sounds are short pseudo-phonemes (0 eiaoung, 1 gl, 2 dt, 3 zx, 4 skr, 5 ktt, 6 tch, 7 pb, 8 mnm, 9 tn), and the canonical names are visibly the joins smoothed with vowels (9::8 Ummnu from tn + mnm; 5::2 Kuttadid from ktt + dt).

| Element | Behaviour | Complexity |
|---------|-----------|------------|
| Sounds table | One row per zone (n rows, virtualized; n = 666 is fine): label, editable sound, lock toggle. Bulk paste (comma/newline list fills zones 0..n-1). Base-10 preset loads the CCRU phonemes | MEDIUM |
| Seeded generator | Seed (string) + style profile (consonant/vowel inventories, cluster weights, max syllables) -> n unique sounds. "Reroll unlocked" re-seeds only unlocked rows. Same seed + same version = same output forever | MEDIUM |
| Deterministic PRNG | Pin an algorithm (mulberry32 or sfc32 seeded from a string hash such as cyrb128; bryc's collection) rather than `Math.random`; store `algo` id and version in the exported JSON so old seeds keep reproducing names after upgrades | LOW |
| Join rule | Order: high-then-low (canonical: tn+mnm) default, low-then-high option (the guide's Part-3 example does this). Joiner: none / separator | LOW |
| Euphony pass | Off (raw join, like "Xthnlghth") / auto (seeded vowel insertion into consonant clusters, collapse triple letters, final vowel) like the guide's "Xathnalgaheth". Show raw and smoothed side by side | MEDIUM |
| Live preview | The selected zone's n - 1 demons, first 20 by mesh, 20 random; updates as you type | LOW |
| Per-demon override | Click a demon (list, matrix, diagram): edit name inline; overridden names marked; "reset to generated". Overrides stored sparsely so 221,445 demons cost nothing | LOW-MEDIUM |
| Collision report | Count of duplicate generated names, with a "make sounds prefix-free" option; at large n collisions are unavoidable with short sounds, so surface it instead of hiding it | MEDIUM |
| Import/export JSON | Versioned schema; validation on import (base mismatch -> offer truncate/pad or reject; unknown keys listed; size cap); drag-and-drop | MEDIUM |
| Sharing | Seed-only naming fits in a permalink (base + seed + style + join rule). Fully custom names go to JSON (or compressed hash when short); never a server | LOW |
| Canonical inheritance | Toggle: demons with a, b <= 9 get their Matrix names (from `DEMON_NAMES`) in bases 4-10 and above | LOW |
| Undo/redo | Reuse existing snapshot-based history for edits | LOW |

Schema sketch (illustrative, to be settled in requirements):

```json
{
  "schema": 1, "algo": "mulberry32-cyrb128@1", "base": 12,
  "seed": "hollow-vector", "style": "harsh",
  "join": { "order": "high-low", "euphony": "auto" },
  "zones": ["eiaoung", "gl", "dt", "zx", "skr", "ktt", "tch", "pb", "mnm", "tn", "..."],
  "locks": [0, 3],
  "overrides": { "9:8": "Ummnu" }
}
```

Key overrides by decimal `"a:b"` (matches the repo's existing `DEMON_NAMES` keys and is independent of the label scheme).

### 5. Poster-quality SVG export

| Requirement | Detail | Complexity |
|-------------|--------|------------|
| Self-contained | No external references, no scripts, no CSS variables, no filters in the poster theme (resolve theme tokens to literal attribute values); XML prolog; explicit `width`/`height` plus `viewBox`; `<title>`, `<desc>` and `<metadata>` carrying base, seed, engine version and date | MEDIUM |
| Text handling | Two modes: **Outlined** (paths; identical everywhere; loses text selection/accessibility; larger file) and **Live text** (subset font embedded as base64 `@font-face`; smaller; readable by browsers). Sources disagree on whether design tools honour embedded `@font-face` in SVG (one says most do not, another says Illustrator and Figma work), so mark as unverified and default the poster to outlines. Needs a bundled font and a text-to-path step (e.g. font parsing library) | HIGH |
| Custom-alphabet coverage | Outlining requires glyphs for every label; runic/Hebrew/Braille alphabets need a covering font or a warning | MEDIUM |
| Paper and units | Presets A0-A4, Letter, custom mm; margins; optional bleed; consistent stroke minimums so hairlines survive printing | MEDIUM |
| Poster furniture | Title block (base, counts, region table, seed, naming preset, generator credit), legend, caption | MEDIUM |
| Layers as named groups | `<g id="layer-syzygies">`, `layer-currents`, `layer-gates`, `layer-zones`, `layer-labels` so users can toggle or restyle in Illustrator/Inkscape | LOW |
| Deterministic bytes | Sorted attributes, stable ids, no timestamps except in metadata; enables snapshot/golden tests and diffable posters | LOW-MEDIUM |
| Export scope selector | Diagram only (zones, syzygies, currents, gates: about 4n elements, fine as a static file at base 666); optionally the demon matrix as an embedded raster; never all demon chords | MEDIUM |
| PNG | Rasterize the exported SVG on a canvas at a scale factor; fonts must be embedded or outlined first because SVG loaded as an image cannot fetch external fonts; cap by canvas limits (Chrome 268,435,456 px area; Safari 16,777,216 px) with a warning and a lower auto-scale | MEDIUM |
| Print theme | Light background, flat fills, dash/marker encodings so the poster survives greyscale | MEDIUM |
| PDF (print-shop path) | Print shops generally want PDF/X rather than SVG; browser print-to-PDF with a page-size stylesheet is the cheap route. Defer | MEDIUM (v1.x) |
| Copy image to clipboard | Nicety after PNG exists | LOW (P3) |

### 6. Comparing two bases side by side

| Level | What | Complexity |
|-------|------|------------|
| Summary diff table | Two columns (A, B) of zones, pairs, Warp, cycle lengths, region sizes, demon counts by type, numodemons, with deltas highlighted | LOW-MEDIUM |
| Nested demon sets | Mesh is base-independent, so base A's demons are the top-left sub-triangle of base B's matrix (A < B). Highlight the shared block; list demons whose type changes between bases (type drift); show which canonical names carry over | MEDIUM |
| Side-by-side diagrams | Two panes with the same theme, layout family and legend; optional synchronized zoom/pan; hover linking by zone integer (hover 7 in A highlights 7 in B if it exists) | HIGH |
| Small multiples gallery | Grid of miniature diagrams for a chosen list of bases (guide Appendix A is exactly this) | MEDIUM |
| URL | `?base=10&cmp=28` | LOW |

Prerequisite: the current `NumogramClient` (about 1,500 lines, single-instance state) cannot host two viewers. Extract per-pane state (base, layers, selection, viewport) into an instantiable hook or component before compare is built. At sizes beyond the interactive ceiling, degrade compare to tables only.

## Feature Dependencies

```
Engine (zones, pairs, currents, gates, regions, demon math)
    ├──requires──> Golden tests (gates everything)
    ├──> Base picker + summary + base atlas
    ├──> Region model (stable Torque ids A, B, C...)
    │        ├──> Region legend / isolate
    │        ├──> Pair-graph (syzygy-collapsed) view
    │        ├──> Demon subtypes (+ Torque split)
    │        └──> Region-crossing flow classification
    ├──> Demon index math (mesh <-> a::b, O(1) type)
    │        ├──> Demon summary facets and virtualized list/search
    │        ├──> Triangular matrix (Canvas)
    │        ├──> Streaming export
    │        └──> Compare: nested demon sets, type drift
    └──> Procedural layout ──> Renderer tiers ──> Hover/highlight, zoom/pan, layers
                                        └──> SVG export ──> PNG export

Label scheme (identity vs display) ──enhances──> everything that prints a zone
    ├──> URL state, text view, demon search, naming builder, exports
    └──> Custom alphabet ──requires──> font coverage check (export)

Naming builder
    ├──requires──> Label scheme + seeded PRNG (pinned algo) + demon index math
    ├──requires──> JSON schema (versioned)
    └──enhances──> Demon list, matrix detail, poster title block, bundle export

Poster export ──requires──> Theme tokens resolved to literals, bundled font (outlines), layout
Static deployability (remove Vercel coupling) ──prerequisite──> export, share, offline
Compare (side-by-side) ──requires──> per-pane viewer state (refactor of NumogramClient)
Accessibility ──requires──> semantic node model + text view (built early; retrofits are costly)
URL sharing ──requires──> shareParams generalized (0-9 / max-10 checks removed)

All-demons chord layer ──conflicts──> high base (keep only at or below spike-set threshold)
Animated base morph ──conflicts──> variable zone count
```

### Dependency Notes

- **Region model before any region-aware feature.** Legend, colours, pair graph, demon subtypes and flow classification all consume the same `torques: [{id, pairs}]` structure with a stable order; define it once in the engine.
- **Label scheme must exist before naming, export and URLs are finalized**; retrofitting display tokens after JSON and URL formats ship would break saved data. Hence the integer-identity rule.
- **Text view and semantics early.** It doubles as accessibility path, gramculator parity and golden-test inspector, and is the cheapest feature in the table.
- **Pair graph is independent of layout research choices** but must be planned with it, because it can replace the full-zone layout as the default at large n.
- **Compare side-by-side depends on a refactor**, not just a feature, so schedule it after the viewer is decoupled or drop to the table form.

## Open Decisions and Spec Discrepancies Found

1. **Guide's subtype counts sum to 47.** It lists 12 + 3 + 12 + 12 + 4 + 4 = 47 for a total of 45. Derived from the engine: chrono 15 (12 cyclic + 3 syzygetic), amphi 24 (12 Plex + 12 Warp), xeno 6 (4 Chaotic + **2** Syzygetic: 9::0 and 6::3). Golden tests should assert derived counts, not the guide's prose.
2. **Cross-Torque chronodemons are undefined.** Guide Part 3 only names same-Torque subtypes (Cyclic Torque-I / II). In multi-Torque bases, most chrono demons connect different cycles (base 82: majority). Needs a named subtype (e.g. "inter-Torque Chronodemon") and a rule for whether it is Cyclic or Syzygetic (it cannot be syzygetic: a syzygy lies inside one pair).
3. **Region terminology in base 16.** The guide: Warp = fixed pair {5,10}; Torque = cycles [4,2]. The /x/ thread: the 2-cycle {3,6,9,12} is the "Warp", and {0,15,5,10} form a "Plex Matrix". The project follows the guide (PROJECT.md), so the glossary must state that choice and the differing usage.
4. **Join order in names.** Canon (Ummnu, Kuttadid) is high-then-low; guide Part 3's worked example is low-then-high. Default to high-then-low, expose the option.
5. **Mesh number display** for bases other than 10: decimal (canonical) or in-base; zero padding width. Recommend decimal default with in-base option.
6. **Guide's Torque-count remark** ("only 3^N+1 bases have multiple Torque regions, not guaranteed") is contradicted by the computation (31 of 50 even bases up to 100). Do not encode it as a rule or a test; the 3^N+1 shell pattern (bases 4, 10, 28, 82: 3^(N-1), ..., 3) is a valid property test, nothing more.
7. **Gate 0 -> 0 self-loop** (T(0) = 0): draw it, omit it, or mark it as Plex? The existing viewer lists nine gates. Decide once in the engine data contract.
8. **Numogram.xyz** was unreachable; if it hosts per-base tools that matter, that is a gap in this research (LOW confidence).

## MVP Definition

### Launch With (v1)

- [ ] Base picker (even only) with summary, notable-base chips, glossary
- [ ] Live diagram with zones, syzygies, currents, gates, region colouring, layers, zoom/pan
- [ ] Label schemes: digits (<= 36), decimal, custom alphabet (with a few presets), tic xenotation
- [ ] Hover/pin highlighting and detail panel; keyboard traversal; text view with copy
- [ ] Region legend as table with isolate; stable Torque-A/B/C...; pair-graph view for large n
- [ ] Demon summary facets, virtualized demon list with search and filters, selected-demon chord, matrix view (matrix can trail list by one step)
- [ ] Naming builder: sounds table, seeded generator with locks, join order, euphony pass, per-demon override, JSON import/export
- [ ] Export: SVG (self-contained, layer groups, outlined-text default), PNG, engine JSON
- [ ] Permalink with base, scheme, layers, selection, seed; base-10 legacy URLs still work
- [ ] Static/offline build; graceful degradation messaging

### Add After Validation (v1.x)

- [ ] Compare: summary diff table first, then nested demon sets, then side-by-side (needs viewer refactor)
- [ ] Base atlas table and small-multiples gallery
- [ ] Poster extras: paper sizes/bleed, print theme, title block, PDF via print stylesheet
- [ ] Region-crossing flow classification, provenance badges, canonical name inheritance
- [ ] Bundle export, localStorage draft autosave, clipboard image

### Future Consideration (v2+)

- [ ] Flow tracer (single-path walk)
- [ ] Odd-base numograms (different structure)
- [ ] Any pitch/card/rite/correspondence layer (explicitly out of scope today)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Base picker + summary + presets | HIGH | LOW | P1 |
| Live diagram (zones, syzygies, currents, gates, regions) | HIGH | HIGH | P1 |
| Label schemes (digits / decimal / alphabet) | HIGH | MEDIUM | P1 |
| Hover/pin highlight + detail panel | HIGH | MEDIUM | P1 |
| Region legend + stable Torque ids | HIGH | MEDIUM | P1 |
| Text view + copy | MEDIUM | LOW | P1 |
| Keyboard + ARIA + non-colour cues | MEDIUM | MEDIUM | P1 |
| Permalink (generalized share params) | HIGH | MEDIUM | P1 |
| SVG / PNG / JSON export (self-contained) | HIGH | MEDIUM | P1 |
| Demon facets + virtualized list + search | HIGH | MEDIUM | P1 |
| Naming builder (sounds, seed, override, JSON) | HIGH | MEDIUM | P1 |
| Pair-graph (collapsed) view | HIGH at large n | MEDIUM | P1 |
| Demon triangular matrix (Canvas) | HIGH at large n | MEDIUM-HIGH | P2 |
| Compare: summary table | MEDIUM | LOW-MEDIUM | P2 |
| Base atlas table | MEDIUM | LOW-MEDIUM | P2 |
| Poster: paper sizes, print theme, outlines, title block | MEDIUM | MEDIUM-HIGH | P2 |
| Euphony pass + collision report | MEDIUM | MEDIUM | P2 |
| Canonical name inheritance | LOW-MEDIUM | LOW | P2 |
| Compare: side-by-side synced diagrams | MEDIUM | HIGH | P2/P3 |
| Compare: nested demon sets / type drift | MEDIUM | MEDIUM | P2 |
| Region-crossing flow classification | MEDIUM | MEDIUM | P2 |
| Provenance badges | LOW-MEDIUM | LOW | P2 |
| Theme set (cyber / paper / mono) | MEDIUM | MEDIUM | P2 |
| Bundle export, draft autosave | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Flow tracer | LOW | LOW-MEDIUM | P3 |
| Clipboard image | LOW | LOW | P3 |

**Priority key:** P1 must have for launch; P2 should have, add when possible; P3 nice to have.

## Competitor Feature Analysis

| Feature | gramculator | Existing base-10 viewer | /x/ General Numogrammatics | Our Approach |
|---------|-------------|--------------------------|----------------------------|--------------|
| Arbitrary base | Yes (custom alphabet, up to 231 chars) | No (10 only) | Yes, by hand (2-36) | Even bases, engine-derived, no cap (measured tiers) |
| Diagram | No (text lists) | Yes, 4 hand layouts | Hand-drawn for 4, 6, 8, 16, 22; "compressed" 22 | Procedural layouts + pair-graph view + base-10 preset layouts |
| Regions | No | Torque/Warp/Plex, hand-authored | Described in prose | Derived; multiple Torque with stable ids and legend table |
| Demons | No | 45, hand-authored names | Table/pyramid, Vysparov names reused | All T(n-1), implicit, matrix + virtualized list |
| Naming | No | Fixed canonical names | No | Seeded, lockable, editable, JSON |
| Zone labels | User alphabet | Digits 0-9 | Base digits to 36 | Schemes: digits / decimal / alphabet / xenotation |
| Export / share | None | Server share image, URL | Google Drive files | SVG (poster), PNG, JSON, permalink, all client-side |
| Accessibility | Plain text (inherently) | Not documented | n/a | Text view + keyboard + ARIA + non-colour cues |
| Provenance | None | None | Fictional lore mixed with maths | Canonical / derived / user badges (CCRU Research Archive model) |

## Sources

Local (HIGH):
- `reference/genius-guide-diy-numogram-demonology.txt` (Parts 1-3: construction rules, base-12 example, Appendix B exotic bases, demon types, naming, Numodemons)
- `reference/INDEX.md` and `.planning/PROJECT.md` (verified math, constraints)
- `reference/web/gramculator-diy.txt`; `reference/web/4plebs-x-21492492.txt` (tables to base 36, compressed N-22, pyramids, Vysparov names for N-4/6/8, base-16 terminology, base-256 lore flagged as fiction)
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`; `app/data/demons.ts` (existing name keys, kinds)
- Scratch computation (not project code) of regions and demon type counts for even bases up to 1000, run 2026-09-25 with the project's verified pair/current rules; reproduces the guide's base-10, 12, 16, 28, 80, 82 facts and the T(n-1) demon totals

Web (MEDIUM unless noted):
- gramculator index page and `base.js` (fetched from alektryon.github.io/gramculator): alphabet input, 231-char limit, preset list, text-list output (HIGH, read directly)
- https://qliphoth.systems/numogram (existing viewer deployment feature list)
- https://www.nothinghuman.org/numogram and https://www.nothinghuman.org/instruments (provenance tiers, search, legend)
- https://github.com/lumpenspace/ccru (README)
- https://github.com/MiketheLemur/numogram-oracle, https://github.com/TheScrawl/numogram (toy/base-10)
- https://www.tumblr.com/tzitzimiyotl and https://archive.4plebs.org/x/thread/21492492/ (General Numogrammatics)
- Mermaid Live Editor permalink design: https://github.com/mermaid-js/mermaid-live-editor (`#pako:`), https://mfyz.com/storing-large-web-app-state-in-url-using-pako/
- Watabou MFCG: https://watabou.itch.io/medieval-fantasy-city-generator ; Azgaar: https://github.com/Azgaar/Fantasy-Map-Generator
- Times-table cardioid: https://thecodingtrain.com/challenges/133-time-tables-cardioid-visualization/
- PRNGs in JS: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Canvas size limits: https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ (Chrome 268,435,456 px; Safari 16,777,216 px)
- SVG vs Canvas vs WebGL thresholds: https://www.yworks.com/blog/svg-canvas-webgl and https://apexcharts.com/blog/svg-vs-canvas-charts/
- SVG text outlines vs embedded fonts: https://www.allaboutken.com/posts/20260429-svgomg-font/ ; https://imagetosvg.com/blog/svg-for-print ; https://alligatr.co.uk/blog/render-an-svg-using-external-fonts-to-a-canvas/ (design-tool support of `@font-face` in SVG is contradictory across sources: LOW)
- Accessible SVG / WCAG 2.2 (1.4.1, 1.4.11, 2.1.1, 4.1.2): https://www.a11y-collective.com/blog/svg-accessibility/ and https://accessibility.build/guides/accessible-charts
- Okabe-Ito palette guidance: https://www.audioeye.com/post/colorblind-friendly-palettes/
- Sexagesimal digit-list notation (comma-separated): https://en.wikipedia.org/wiki/Sexagesimal
- TanStack Virtual: https://tanstack.com/virtual and https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026
- Dozenal digit conventions (X and reversed 3): Dozenal Society of America manual, https://dozenal.org/drupal/sites_bck/default/files/DSA_mods_rev.pdf

Unreachable: numogram.xyz (DNS failure from this environment); Urbanomic "Doin it for the 'Gram" workshop page (no usable content); Fandom Pandemonium Matrix page (HTTP 402). None of these were relied on.

---
*Feature research for: arbitrary-base numogram generator*
*Researched: 2026-09-25*

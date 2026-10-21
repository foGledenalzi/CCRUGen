# Phase 7: Naming Builder - Research

**Researched:** 2026-10-20
**Domain:** pure naming engine (seeded PRNG, prefix-code generator with a Feistel permutation, euphony pass, name derivation, collision detection, versioned JSON schema and hand-written validator) plus the Names panel integration and the live desktop panel stack (todo 008)
**Confidence:** HIGH for the engine algorithms (every claim below was run and measured in Node 22.16 and Chromium 153); MEDIUM for style tuning (the syllable banks are drafts that need a human sign-off) and for the app integration (read from the code, not yet built)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the builder lives and where names show up**
- **D-01:** The naming builder is **a compact side panel in the existing panel stack** (the user chose this over a fourth tab in the Demons overlay or a separate large overlay). It must stay within roughly a 240 px width, report its real height so the stack adapts (see the related, still-pending todo 008 about the desktop stack keeping base-10 heights after a base change), and work in the mobile stack below the 820 px breakpoint. Everything it adds to the DOM carries `data-post-baseline=""`, as the Text panel did, so the frozen behaviour baseline (`e2e/__behaviour__`) and the 60 DOM goldens do not change.
- **D-02:** The panel is **one self-contained surface**: global controls on top (preset, seed, style, join order, the smoothing toggle, the collision summary, import and export), then a virtualized scrolling list of zones with an editable sound and a lock toggle per row that still works at 4,000 zones. Demons are renamed from the existing Selection demon detail when one is pinned (overridden names are marked, with "reset to generated").
- **D-03:** Names always fill the demon browser's name column (Phase 5 D-02: present at every base, empty today above base 10), the demon detail in the Selection panel, and the matrix tooltip. In addition, **zone sounds are a diagram label mode**: `sounds` joins digits, xenotation and the alphabet modes in the existing label scheme and its URL param (and must work on the Canvas tier as well as the SVG tier, with the same legibility rules as long numerals). Not chosen for v1: showing a zone's sound in the Zones panel rows, and names drawn along demon chords in focus mode.

**Generator, sounds and names**
- **D-04:** Generated zone sounds are **CCRU-flavoured consonant clusters by default** (the base-10 originals are `eiaoung, gl, dt, zx, skr, ktt, tch, pb, mnm, tn`), with **three selectable styles**: a harsh, CCRU-like default, a soft style and a syllabic style. The style is part of the stored seed record, so a shared seed link reproduces the same names.
- **D-05:** Generated tables are **always distinct** at any base: sounds get longer as needed rather than repeating (a base-4000 sound may be 6-8 letters). Distinctness is by construction, not by retry. A generated table uses plain Latin letters.
- **D-06:** Derived demon names are the plain join of the two zone sounds by default. **Smoothing (euphony) is optional and off by default**, implemented as deterministic vowel-insertion rules behind a version number, and the panel shows the raw and the smoothed form side by side. The canonical CCRU names are not derivable by rule (the roadmap notes this), so smoothing is a convenience, not a reproduction of them.
- **D-07:** **A valid zone sound is** letters of any script (Unicode letter characters, normalized to NFC and counted in user-perceived characters), no whitespace, digits or punctuation, **length 1 to 16**. Typed, pasted and imported sounds are checked against this with inline messages that name the problem and the row.
- **D-08:** **Derived names are written with their first letter capitalised** ('Tnmnm', 'Ummnu'), whatever case the sounds were typed in, matching the look of the canonical names. Overrides are shown exactly as typed. There is no case setting in v1.

**Saving, undo and base switching**
- **D-09:** Naming work is **autosaved in the browser, one slot per base** (local storage), plus explicit JSON export for moving or backing up. Static-first still holds (no server). A shared link never overwrites a saved slot without the user's say-so (D-13).
- **D-10:** Switching base loads **that base's own saved naming**, or a fresh seeded one when none is saved; a new base never inherits another base's per-zone edits (zone ids differ). Zone-sound and demon-name edits join the **existing undo and redo history**, and history from another base is never restored (Phase 4 UI-08).

**Scale, collisions, canonical names, shared links**
- **D-11:** **Full editing (the zone list, locks, autosave, per-zone JSON export) runs up to the interactive ceiling**, read from the tier table as `INTERACTIVE_MAX_N` (4,000 today), never typed as a number. **Above it naming is seed-only**: no per-zone list, a style and a seed still apply, names are derived lazily in the demon browser and detail panel (the browser handles bases to 2^26), and export is seed-only without a per-zone sound list.
- **D-12:** **Collisions are reported, not repaired.** The panel shows a summary (count, and the colliding names with their `a::b` pairs) and jumps to each colliding demon so the user can override by hand. Nothing is changed automatically, and the report works for typed, generated and imported tables. Not chosen for v1: a "regenerate to reduce collisions" action and automatic disambiguating suffixes.
- **D-13:** **A shared link opens as an unsaved preview.** A link carries only a preset or seed (with style, join order and the smoothing flag), never edits. If the recipient already has a saved naming for that base, the link's naming is shown without being saved, with a small inline notice offering "Keep this naming" (replaces the slot, undoable) or "Back to my saved naming". Nothing is ever lost silently.
- **D-14:** **The CCRU preset exists only at base 10** (NAM-04): the 10 zone sounds plus the 45 canonical names as overrides. Every other base uses the generator or the user's own sounds. Canonical names are never applied to demons of other bases.

**Locked earlier (carried forward, not re-discussed)**
- **From the roadmap notes and research:** the PRNG is `sfc32-cyrb128@1` with frozen test vectors (never `Math.random`, no `Date`); the seeded generator uses Feistel plus cycle-walking as a proposal to validate (fallback seeded Fisher-Yates over a lazily extended syllable inventory); join order defaults to high-then-low with low-then-high as an option; names are derived on demand and never stored per demon, overrides are sparse (at 221,445 demons nothing per-demon exists); override keys are decimal zone numbers (the roadmap writes `"a:b"` and the research sketch `"a::b"`, while `app/presets/base10/lore.ts` keys the 45 names by mesh number `a(a-1)/2 + b`: the researcher reconciles these and fixes one canonical key form); zone-sound distinctness does not imply demon-name distinctness (concatenation is not injective), hence the collision report; the validator is hand-written, rejects a file for the wrong base with a message (optionally offering "regenerate from seed"), caps size, lists unknown keys; JSON is versioned (the research sketch uses schema id `ccrug.naming/1`); the URL carries only `names=ccru|seed:<s>`-style data; text handling is NFC-normalized and grapheme-safe.
- **From earlier phases:** the engine stays pure (`engine/naming` depends only on `engine/core`: no DOM or Node types, relative imports only, deterministic, no O(n^2) materialization); the 60 DOM goldens, `e2e/__behaviour__`, the numeric oracle and the derived fixtures are never regenerated with `-u`; the CCRU lore stays in `app/presets/base10/lore.ts` joined by id (Phase 2 D-06), so the CCRU preset reads the 45 names and 10 sounds from there, never duplicated into engine data; tier boundaries and ceilings come from `engine/scene/tier-table.json` through `app/lib/tierBounds.ts`, never hard-coded; Next 14.2.35 exact pin, no new dependency, no server routes; no upstream branding.

### Claude's Discretion
The PRNG and Feistel construction details (and the fallback decision once validated), the phoneme inventories and tuning for the three styles, the euphony rules and their versioning, the exact JSON schema field names, import size cap and error wording, the panel's layout, labels and copy within the D-01/D-02 constraints, the local-storage key format and quota handling, undo granularity (per edit or per gesture), how the zone list is virtualized, how the browser name column and matrix tooltip read the naming without per-demon storage, the `sounds` label-mode wording and its legibility cutoffs, whether the worker is involved in building seeded tables at large bases, and the plan and wave breakdown.

### Deferred Ideas (OUT OF SCOPE)
- A zone's sound shown in the Zones panel rows and the zone detail, and names drawn along demon chords in focus mode: not chosen for v1.
- A larger table window for big edits: declined in favour of the compact panel (D-01).
- Canonical-name inheritance outside base 10 (a toggle applying the 45 names to demons between zones 0-9 in other bases): declined (D-14).
- Collision repair (a "regenerate to reduce collisions" action, automatic disambiguating suffixes): declined (D-12).
- A user case setting for derived names, and punctuation-rich or spaced sounds: declined (D-07, D-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAM-01 | The user can edit a per-zone sound table and can generate one for any base from a seed, with per-zone locks | Pattern 2 (prefix-code tree generator, n-independent so locks and prefixes are stable), Pattern 8 (edit operations, spare stream so a regenerated zone never repeats a locked sound), Pitfalls 9, 16; vectors in Appendix B |
| NAM-02 | Demon names derive from net-span sounds (high-then-low by default, low-then-high as an option), with sparse per-demon overrides | Pattern 3 (layered resolution override > preset > derived, key = decimal mesh number), Pattern 4 (euphony@1), Pitfalls 6, 22, 24 |
| NAM-03 | Naming data imports and exports as versioned JSON; the URL carries only a preset or seed; name collisions are reported to the user | Pattern 5 (collision certificate and scan, measured limit), Pattern 6 (schema, validator, caps, sizes), Pattern 7 (URL grammar), Pattern 8 (autosave, preview), Pitfalls 10, 11, 17 |
| NAM-04 | Base 10 ships a CCRU preset (the 10 zone phonemes plus the 45 canonical names) | Pattern 3 (preset adapter reads `lore.ts`, canonical names are a read-time layer, 45/45 distinct), Pitfall 14 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Correctness is the core value; all arithmetic in the numogram's own base; even bases only; regions are `Cycle[]`.
- The base-10 oracle is frozen: the numeric golden JSON, the 60 DOM goldens, `e2e/__behaviour__` and `engine/test/fixtures/derived/` are never regenerated with `-u`; derive fixtures from definitions.
- `engine/` is pure: no DOM or Node types, relative imports only, no O(n^2) materialization (enforced by `tsc -p engine` with `lib: ES2022, types: []` and ESLint restricted syntax: no `Math.random`, no zero-argument `new Date()`, no `Date.now()`).
- Static-first: no server routes, Vercel Blob or Analytics; Next 14.2.35 exact pin; no new dependency (platform APIs and the existing `@tanstack/react-virtual`, `fast-check`, Playwright only).
- No upstream branding anywhere (the `FORBIDDEN_OUT` guard greps the built `out/` for `qliphoth` and `delight nexus`); CCRU lore stays in `app/presets/base10/lore.ts` (lore-text scanner in `tests/presets/base10-adapter.test.ts` auto-scans every other `app/presets/base10/*.ts` file).
- `NumogramClient.tsx` may be edited but the DOM goldens capture only the projection `<svg>`: keep it byte-identical in every non-`sounds` mode.
- Windows 10, Node 22, npm 11 locally; `package-lock.json` valid for npm 10 and 11 (no new dependency, so it should not change); gate is `MSYS_NO_PATHCONV=1 npm run verify`; commits end with the attribution line from the session reminder; never push.
- Repo guard `base-ten` (default check in `verify`) scans every tracked `app/**/*.ts(x)` line for `9 - x`, `<= 9`, `> 9`, `<= 4`, `length: 10`, `[0, 1, ..., 9]` and similar; new `app/` code must use named constants (`engine/` is not scanned by it).

## Summary

A prototype of the whole engine side was built in a scratch directory (since deleted) and measured. The decisive result is a **prefix-code generator**: each style supplies a prefix-free syllable alphabet split into *internal* syllables (never final) and *leaf* syllables (always final); a sound is zero or more internal syllables followed by one leaf. Zone `z` falls in a depth class (1 syllable for the first L zones, 2 syllables next, and so on), is permuted inside its class by a seeded 8-round Feistel network (cycle-walking only to pad the domain to an even bit count), and decoded by mixed radix. This gives, with no retry anywhere: (1) distinct sounds by construction (exhaustive up to 434,227 zones, left-inverse parse proof on 2,000,000 sampled zones up to 2^26 - 1); (2) **O(1) lazy `sound(z)` that does not depend on the base** (prefix stability for free; measured about 1 us per zone, 100,000 lazy lookups near 2^26 in 55 ms, 0 MiB); (3) because the sound set is prefix-free, **raw concatenation is injective, so generated tables have zero demon-name collisions in both join orders at every n** (exhaustively checked at n = 10, 28, 64, 666, 1024, 2000 and 4000 = 7,998,000 demons, three styles, several seeds). A merged-alphabet depth-class design (the obvious alternative) collides as soon as depth 3 appears (483 repeated names at n = 200 with a toy alphabet), which would break the guarantee above the ceiling where names are seed-only. Seeded Fisher-Yates is the fallback the roadmap named; it is correct but loses prefix stability (1 of 28 zones keeps its sound from base 28 to 30), takes 4.4 s and 256 MiB at 2^26, and cannot serve lazy seed-only names.

The PRNG `sfc32-cyrb128@1` was implemented with `Math.imul` only and cross-checked against an independent BigInt implementation (0 mismatches over 20,000 random seeds) and against Chromium 153 (identical). Frozen vectors are in Appendix B. The Feistel permutation was cross-checked against an independent BigInt implementation (120,000 evaluations, 0 mismatches) and proven bijective by exhaustive test for every domain up to 2^26 (3 styles, 30 domains up to 34,304,000). Euphony `euphony@1` is a context-free vowel-insertion rule that is idempotent, insert-only (so injective on tables whose letters exclude the inserted vowels), a no-op on any name containing a non-ASCII letter, and reproduces 0 of the 45 canonical names (the canonical names are not derivable: their consonant skeleton equals a raw join in 0/45 cases and only 1/45 is even a subsequence of one). Collision counting at n = 4000 costs about 1.9 s (raw) and 3.7 to 4.1 s (smoothed) on this PC in both Node and a Chromium main thread or Worker, so it is neither free nor worker-specific; the recommendation is a cheap structural certificate for generated tables plus a cancellable main-thread scan with a measured data limit (default 1024). The desktop stack fix (todo 008) was validated against a real browser measurement: the new pure stack function reproduces the existing base-10 positions exactly at the measured heights and 0 mismatches against the old formula over 20,000 random height sets, **but** it has a visible consequence the contract states and the user should know: at base 28 and a 1280 x 800 window the strict never-overlap rule puts Syzygies at y 874 and Text at y 1166, below the fold.

**Primary recommendation:** build `engine/naming/` as the pure prefix-code generator + resolver + collision certificate/scan + schema/validator, keep names a read-time layering (user override > CCRU preset > derived) keyed by decimal mesh number with a separate `NamingContext` for the UI (no change to `NumogramViewContextValue`), run collision scans on the main thread in cancellable slices, and implement the desktop stack as a pure function `computeDesktopStack` with `usePanelDrag` merging stored positions only for moved panels.

## Where each planner question is answered

| Planner question | Section |
|------------------|---------|
| 1 PRNG, vectors, determinism | Pattern 1, Appendix B |
| 2 Feistel, cycle-walking, above-ceiling lazy names, Fisher-Yates comparison | Pattern 2 (measured table), Alternatives Considered |
| 3 Style inventories, capacity, samples, CCRU shape statistics | Pattern 2 (capacity), Appendix A |
| 4 Euphony rules, canonical distance, non-Latin, extra collisions | Pattern 4, Appendix B |
| 5 Derivation and collisions at scale, limit, worker or main thread | Pattern 3, Pattern 5 |
| 6 Override key form, O(1) lookup | Pattern 3 |
| 7 JSON schema, validator, caps, NFC and graphemes, export size | Pattern 6 |
| 8 URL grammar, labels=sounds, preview/adopt, autosave | Pattern 7, Pattern 8 |
| 9 App integration and the live desktop stack | Pattern 8, Pattern 9, Pitfalls 3, 4, 19, 20 |
| 10 Tests that change or stay identical, validation strategy | Existing Tests table, Validation Architecture |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PRNG, seeded generator, Feistel permutation, syllable banks | Engine (`engine/naming`, pure) | none | Deterministic, no DOM; shared by UI, tests and a future CLI (Phase 8) |
| Name derivation, euphony, layered resolution | Engine | Browser (reads it) | O(1) per name; no per-demon storage anywhere |
| Collision certificate and scan | Engine (algorithm, no clock) | Browser (scheduling: slices, cancel, limit) | Engine cannot read time (`performance` is not in lib ES2022); the app supplies a yield predicate |
| JSON schema, validator, serializer | Engine | Browser (file input, download, localStorage) | Same validator for import files, localStorage slots and URL-derived state |
| CCRU preset data | App adapter `app/presets/base10/naming.ts` | none | Lore stays in `lore.ts` joined by id (Phase 2 D-06); never copied into engine data |
| Autosave slot, preview/adopt session, undo integration | Browser (`app/lib`, `NumogramClient`) | none | localStorage and React state are browser concerns |
| URL `names=` codec and `labels=sounds` | Browser (`shareParams.ts`, `labelScheme.ts`) | Worker guard (`protocol.ts`) | One allow-listed codec; the worker guard must accept the new label mode |
| Names panel, zone list, demon name editor | Browser (React components) | none | UI-SPEC contract |
| `sounds` label painting | Browser: SVG tier (`Projection.tsx`) and Canvas tier (`draw.ts`, two passes) | none | Shared pure fit function in `app/lib` |
| Desktop panel stack, drag merge, z-index cap | Browser (`app/lib/panelStack.ts` pure, `usePanelDrag`) | none | Pure function unit-tested; hook merges |
| Worker | not used for naming | existing numogram worker unchanged | See Pattern 5 (scan is main-thread, sliced) |

## Standard Stack

### Core (all already installed; nothing to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | engine and app code; `Intl.Segmenter` is typed under the engine's `lib: ES2022` | [VERIFIED: node_modules; tsc run in scratch with lib ES2022 compiled `Intl.Segmenter`] |
| React / Next | 18.3.1 / 14.2.35 (exact pin) | panel UI | [VERIFIED: node_modules] project pin |
| @tanstack/react-virtual | 3.14.13 | zone list virtualization (fixed 28 px rows) | [VERIFIED: node_modules] already used by `DemonRowList.tsx` |
| Vitest | 5.0.2 (Vite 8.3.1) | unit tests; projects `engine` (`engine/**/*.test.ts`) and `oracle` (`tests/**/*.test.ts`) | [VERIFIED: `vitest.config.mts`] |
| fast-check | 4.10.2 | property tests (round trips, locks, determinism) | [VERIFIED: node_modules] |
| Playwright + Chromium | 1.63.0 / 153.0.8010.12 | e2e geometry and behaviour | [VERIFIED: installed; `ms-playwright/chromium-1243`] |

### Supporting (platform APIs, no package)

| API | Purpose | When to Use |
|-----|---------|-------------|
| `Intl.Segmenter` (grapheme) | user-perceived character count | only when a string is longer than the limit in UTF-16 units (see Pitfall 8); Baseline 2024 [CITED: developer.mozilla.org/.../Intl/Segmenter]; present in Node 22.16 and Chromium 153 [VERIFIED: run] |
| `String.prototype.normalize('NFC')` | canonical form for seeds, sounds, names, joins | at every input boundary and after joining |
| `crypto.getRandomValues` | the Reroll button's new seed (UI code only) | never inside `engine/` |
| `URLSearchParams`, `Blob` + temporary anchor, `File.size`/`File.text()`, `localStorage` | URL codec, export, import, autosave | all wrapped in try/catch (Pitfall 17) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prefix-code tree generator | seeded Fisher-Yates over a lazily extended inventory (the roadmap's fallback) | Works at n <= 4000 (0.9 ms) but loses prefix stability (1/28 kept), needs 256 MiB and 4.4 s at 2^26, cannot derive seed-only names lazily, and gives no collision guarantee. Not recommended. |
| Prefix-code tree generator | one merged syllable alphabet with depth classes | Same cost, but raw names collide once depth 3 is reached (483 repeated names at n = 200 with an 8-letter toy alphabet; see Pattern 2) |
| 8-round Feistel with cycle-walking | exact power-of-two class sizes (64 internal, 64 leaf) | Removes cycle-walking (0 extra evaluations) but forces exactly 64 syllables per role; the measured walk cost is irrelevant (about 0.3 us per evaluation), so keep bank sizes free |
| Main-thread sliced collision scan | extend the Phase 6 worker | Same CPU (Worker 1936 ms vs main 1751 ms at n = 4000), but pinned static tests allow exactly one `new Worker(` and one client; see Pattern 5 |
| Hand-written validator | ajv / zod | Locked by CONTEXT (hand-written, no new dependency) |
| Mesh-number override keys | `"a:b"` keys | See Pattern 3 for the reconciliation and why mesh wins |

**Installation:** none (`npm ci` as-is). No lockfile change is expected.

**Version verification:** versions above were read from `node_modules/*/package.json` and `package.json` on 2026-10-20; no registry lookup was needed because nothing is added.

## Architecture Patterns

### System Architecture Diagram

```
URL ?names=ccru | names=seed:<s> (+ nstyle, njoin, nsmooth)          file picker (JSON, <= cap)        localStorage ccrug.naming.v1.<base>
        |  parseShareParams (lenient per field)                          |  File.size check, then text            |  getItem in try/catch
        v                                                                v                                        v
   NamesLink | null  ------------------------------->   validateNamingJson(text, {base, interactiveMaxN, maxBytes, presets})  (ONE validator, all-or-nothing)
        |                                                       | ok -> Naming   | error -> issues (wrong base: offer seed)
        v                                                       v
  NamingSession (app/lib): { working, saved, preview, edited }  <---- edit ops (pure, engine): editSound, toggleLock, setSeed, setStyle,
        |  history snapshot carries `naming` (immutable) + rev         setJoin, setSmoothing, setSource, importNaming, setOverride, resetOverride
        |  autosave after first edit (not in preview, not above ceiling)            |
        v                                                                           v
  NamingContext (React) --- createNameResolver(naming, preset) ---> { soundOf(z), nameOf(a,b), stateOf(a,b) }  O(1)
        |                                                    ^  override Map<mesh> -> preset[mesh] (base 10, source ccru) -> derive()
        |                                                    |       derive = upperFirst(NFC(join(order, soundHi, soundLo) [-> smooth@1]))
        |                                                    |       soundOf = dense array (base <= ceiling) | generator.soundAt(z) (seed-only)
        +--> DemonRowList NAME cell, DemonMatrix tooltip, DemonInfo heading (render-time, never baked), collision editor
        +--> Projection.tsx / lib/canvas/draw.ts zone label slot ONLY in labels=sounds (shared fit function)
        +--> Names panel (controls, preview table, zone list, collisions, import/export, autosave line)
        |
        +--> collision job: certificate (O(n log n), exact 0 for generated tables) else partitioned hash scan, sliced on the main thread,
             cancellable, only up to the data limit  -> {g, d, bounded group list with lowest-mesh first}

Panel positions: heights (CyberPanel ResizeObserver) -> computeDesktopStack (pure) -> derived{layers..names} -> usePanelDrag merges moved panels
```

### Recommended Project Structure

```
engine/naming/
  prng.ts          # PRNG_ALGO, cyrb128, sfc32 (integer only)
  feistel.ts       # FEISTEL_ROUNDS, roundKeys, permutation(size, keys)
  banks.ts         # STYLE_IDS, SyllableBank data x3 (draft in Appendix A, signed off at a checkpoint)
  generate.ts      # GENERATOR_ID 'names-gen@1', createGenerator(seed, style), generateSounds(naming) with locks + spare stream, DEFAULT_SEED
  text.ts          # nfc, graphemeCount (Segmenter + regex fallback), validateSound / validateName with typed reasons, upperFirst
  euphony.ts       # EUPHONY_VERSION = 1, smooth(raw)
  derive.ts        # Naming type, createNameResolver, nameOf, join order, layering, meshKey
  edit.ts          # pure edit operations returning a new immutable Naming (shares unchanged parts)
  collisions.ts    # certificate, stepper (no clock), types
  schema.ts        # SCHEMA_ID 'ccrug.naming/1', limits, serialize
  validate.ts      # validateNamingJson (hand-written, non-recursive)
  index.ts         # barrel; engine/index.ts gains `export * from './naming/index'`
engine/test/naming.*.test.ts            # prng, feistel, generate, text, euphony, derive, collisions, schema, vectors
app/presets/base10/naming.ts            # CCRU preset: sounds from ZONE_PARTICLE, names from DEMON_NAMES (no copied text)
app/lib/panelStack.ts                   # pure desktop stack + names body height
app/lib/namingSession.ts, namingStorage.ts, namingLimits.ts, soundLabels.ts (fit function)
app/components/names/*                  # NamesPanel, ZoneList, CollisionReport, DemonNameEditor, NamingContext
```

### Pattern 1: `sfc32-cyrb128@1` (frozen)

**What:** `cyrb128(seed)` folds the seed's UTF-16 code units into four 32-bit words; `sfc32(a,b,c,d)` returns `next32(): uint32`. Integer only: every operation is `Math.imul`, `^`, `>>>`, `+ | 0`, `<<`. No warm-up for the PRNG itself (the Feistel key schedule discards 12 outputs, below).
**When to use:** the only randomness source in `engine/naming`. The seed must be NFC-normalised and trimmed before hashing: the NFD and NFC spellings of the same text hash differently (Appendix B).
**Evidence:** 0 mismatches against an independent BigInt implementation over the 12 vectors and 20,000 random seeds; chi-square 10.37 (15 dof) and bit balance 0.4992 to 0.5011 over 2^20 outputs; Chromium 153 equals Node 22.16 [VERIFIED: run]. Only `/ 4294967296` would introduce a float and it is not used.
**Provenance caveat:** the constants and structure follow bryc's published `cyrb128`/`sfc32`; github.com was unreachable from the sandbox so byte equality with the upstream text was not checked [ASSUMED]. It does not matter: `@1` is *defined* by our code and the frozen vectors.

```ts
// engine/naming/prng.ts  (verified as JS in scratch)
export const PRNG_ALGO = 'sfc32-cyrb128@1'
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  a |= 0; b |= 0; c |= 0; d |= 0
  return () => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return t >>> 0
  }
}
```

### Pattern 2: prefix-code tree generator `names-gen@1` with a Feistel permutation

**What:** a style is a bank `{ internal: string[I], leaf: string[L] }` whose union is a prefix-free set of a-z syllables. Depth-d class has `I^(d-1) * L` sounds; class offsets `off_1 = 0`, `off_(d+1) = off_d + size_d`. For zone z: find d, `r = z - off_d`, `r' = permutation(size_d, roundKeys(seed, style, d))(r)`, decode `leaf = r' mod L`, then the rest in base I from the last internal digit backwards. The sound set is a prefix code, so the raw join of two sounds determines both (in either order).
**Key schedule:** `cyrb128(style + NUL + depth + NUL + seed)` (NUL is `String.fromCharCode(0)`; seeds reject control characters so the split is unambiguous), `sfc32` from that state, discard 12 outputs, take 8 round keys.
**Round function:** `mix(x,k)` = murmur-style finalizer with `Math.imul` (constants 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35). Balanced Feistel on `2w` bits where `2w` is the smallest even bit count with `2^(2w) >= size`; `f = mix(r, key) mod 2^w`; cycle-walk (`do x = feistel(x) while x >= size`).

**Measured evidence (all [VERIFIED: run], Node 22.16, this PC):**

| Question | Result |
|----------|--------|
| Bijective? | Exhaustive for the domains of the final banks with 8 rounds: depth 1 to 4 for one seed and depth 1 to 3 for two more seeds, per style = 30 domains (sizes 66 to 34,304,000), all bijective; the structural proof is that each round is invertible regardless of `mix` |
| Rounds | 6 rounds: chi-square of pi(0) 65.1 and pi(1) 68.2 (66 dof), pair statistic 4277 (4421 dof) over 200,000 seeds; 4 rounds gave 109.2 (borderline). **Use 8 rounds** for margin (cost 8 vs 6 rounds is +33% of about 1 us) |
| Cycle-walking cost | Expected evaluations = domain/size exactly (measured 3.82 for size 67 in 2^8, 3.06 at 5,360 in 2^14, 1.03 at 3,960 in 2^12). Balanced halves make the ratio up to 4 (measured worst 3.88); tail is geometric `(1 - size/dom)^t` (max over a whole 20.4 M domain: 46 evaluations). No constant bound, but it always terminates (every permutation cycle returns into [0,size)) and the cost is irrelevant at about 0.3 us per evaluation |
| Power-of-two domain? | Yes and free: padding the domain to a power of two *is* what cycle-walking does. With exactly 64 internal and 64 leaf syllables the class sizes are powers of two (2^(6d)) and no walk happens at all, but it is not worth constraining the banks |
| Determinism of the arithmetic | The only non-bit-operation arithmetic in the Feistel path is division and modulo of integers below 2^52 by an exact power of two, which IEEE-754 computes exactly; every hash step is `Math.imul`, `^`, `>>>`. No `Math.sin/cos/pow`, no `Date`, no `Math.random` |
| Independent implementation | BigInt Feistel equals the `Math.imul` one on 120,000 evaluations over 6 sizes up to 2,278,125,000 (0 mismatches) |
| Cost | about 1 us per zone (3.3 ms for a 4000-zone table); 100,000 lazy zones near 2^26 in 55 ms; derived name (two lookups plus concat) 1.06 us |
| Distinctness | exhaustive Set over 434,227 / 241,626 / 324,558 zones (harsh/soft/syllabic): all distinct; left-inverse `parse(sound(z))` recovers `(depth, permuted index)` for 2,000,000 sampled zones per style including z = 2^26 - 1 (0 failures) |
| Prefix stability | zone z's sound is independent of the base by construction (zones 0 to 11 identical at n = 10, 28, 64, 666, 4000) |
| Length at 2^26 | depth 5 for z up to 2^26 - 1; harsh max 15 letters (3 + 4 x 3), soft 11, syllabic 11, each under the 16 cap. Plain a-z strings of length 6 already give 308 M >= 2^26, so the inventory is not the bottleneck |
| Raw name collisions | **0** in both join orders, three styles, seeds `hollow-vector`, `ccrug`, `zzz`, n = 10, 28, 64, 666, 1024, 2000 and (one seed) 4000 (7,998,000 demons) |
| Counter-evidence for the alternative | a merged alphabet (no internal/leaf split) with a toy 8-letter alphabet: 0 collisions to n = 72, **483 repeated names at n = 200, 2016 at 584, 10,470 at 800**; the tree: 0 at every n. Real-bank merged alphabets measured 0 collisions to n = 1024; by argument none is possible while every zone has depth <= 2 (a zone-order accident: hi-lo puts the longer sound first), and nothing guarantees it above that, which matters because seed-only names run to 2^26 |

**Capacity of the draft banks (distinct sounds with at most k letters):**

| Style | <=3 | <=5 | <=6 | <=8 | <=10 | <=12 | <=16 |
|-------|-----|-----|-----|-----|------|------|------|
| harsh | 67 | 3,507 | 5,427 | 280,627 | 434,227 | 34.7 M | 2.78 B |
| soft | 66 | 4,026 | 4,026 | 241,626 | 14.5 M | 869.9 M | 52.2 B |
| syllabic | 78 | 5,070 | 5,070 | 324,558 | 20.8 M | 1.33 B | 85.1 B |

Depth needed: z = 4000 needs depth 2 in all three (sounds of 4 to 6 letters for harsh, 3 to 5 for the others); 2^26 - 1 needs depth 5.

**Locks and typed sounds.** Generation fills unlocked zones only. If `soundAt(z)` equals a locked (typed) sound, take the next spare `soundAt(base + j)` that is not locked (spare indices are outside the table, so they cannot repeat a generated sound). Deterministic, O(n + locks), keeps "generated tables are always distinct" true even beside typed zones. Typed sounds can still collide with each other and with prefix relations; that is what the collision report is for.

### Pattern 3: name derivation, layering and the override key

**Layering (read time, never stored per demon):** `nameOf(a, b)`: `overrides.get(mesh)` (the user's text, exactly as typed) else, when `source === 'ccru'` and base 10, `preset[mesh]` else `derive(sound(hi), sound(lo))` where `derive` = `upperFirst(NFC(join))` and, when smoothing is on, `smooth` is applied to the raw join before capitalising. `join` is `hi-lo` (`sound(a) + sound(b)`, a > b) or `lo-hi`. `upperFirst` uppercases the first code point only (`String.prototype.toUpperCase`, locale-independent; note `ß` becomes `SS` and `ı` becomes `I`, harmless but a reason to keep the ASCII certificate in Pattern 5).

**CCRU data stays out of the engine.** `app/presets/base10/naming.ts` exports `{ id: 'ccru', base: 10, sounds: ZONE_PARTICLE values 0..9, names: DEMON_NAMES }`; the engine takes it as an argument (`createNameResolver(naming, preset)`, `validateNamingJson(text, { presets })`). Canonical names are a *preset layer*, not entries in `overrides`: this keeps "renamed demons" a count of user overrides only (the UI-SPEC summary), makes `Reset to CCRU name` just deleting the user override, keeps exports of the CCRU table tiny, and avoids copying CCRU-derived text into user files. D-14 says "as overrides"; the layer is behaviourally an override that the user's overrides beat. Measured: the 45 canonical names are 45/45 distinct, so the preset itself never collides.

**Override key: the decimal mesh number, in memory and in JSON.**

| Form | Evidence |
|------|----------|
| `"a:b"` (roadmap) / `"a::b"` (research sketch) | Matches the CCRU notation, but nothing in the code uses it: the older string-keyed table was replaced in Phase 2 (STATE P07/P12). Needs parsing, a separator choice, and a > b normalisation; FEATURES.md's claim that it "matches the existing `DEMON_NAMES` keys" is out of date |
| mesh number `a(a-1)/2 + b` | It is the engine's own demon id: `meshOf(a, b)` (order-normalising, exact to 2^26 since `a(a-1) <= 2^52`), `netSpanOf(mesh)`, `DemonRef.mesh`, `DemonSpace.at/ref`, the browser row key, the matrix tooltip, `rankOfMesh`, and exactly how `DEMON_NAMES` and `demonName(base, mesh)` are keyed. It depends only on (a, b), not on the base, so a key means the same demon at every base. Digits only, no separator ambiguity, `Map<number, string>` in memory with no per-lookup string building, integer-like JSON keys iterate in ascending order (deterministic export) |

**Recommendation: one form, mesh number.** In memory `ReadonlyMap<number, string>`; in JSON `"overrides": { "44": "Ummnu" }` (decimal, no leading zeros, `0 <= m < base*(base-1)/2`). Import error messages translate a bad key to its net-span (`netSpanOf`) for the human. If the user prefers readable files, the alternative is `"a:b"` in the file only with conversion at the boundary; this is flagged in Open Questions.

**O(1) at every consumer:** the browser row has `d.a, d.b, d.mesh` (DemonRef); the matrix tooltip has the DemonRef; `DemonInfo` already calls `g.demons.ref(d.a, d.b)`; the collision list stores meshes. `resolver.nameOf(a, b)` is two array reads, one `Map.get`, one concat.

### Pattern 4: `euphony@1` (smoothing)

Rule set (verified): applies only if the whole raw name consists of ASCII letters, otherwise the name is returned unchanged (script-safe no-op: Greek, Cyrillic, CJK, Arabic, accented Latin, mixed names and anything with a space or hyphen are untouched). Within an all-ASCII name: vowels are `aeiouy` (case-insensitive); a consonant run longer than 2 is cut into chunks of at most 2 consonants with a context-free fill vowel inserted after each full chunk, `FILL = {b:u c:a d:i f:a g:u h:a j:u k:u l:a m:u n:a p:a q:u r:a s:a t:a v:a w:a x:i z:a}` (inserted vowels are only ever `a`, `u`, `i`, keeping the case of the preceding consonant); a final vowel is appended when the name ends in two different consonants. **There is no triple-letter collapse**: it was in the draft and was the only remaining source of smoothing collisions (`kttt` and `ktt` merge); chunking already breaks triples.

**Measured properties:** idempotent (200,000 random strings), insert-only (deleting `a/u/i` from the output restores the input for inputs that contain none: injective there), no 3-consonant run remains, 0 mismatches between the optimized char-code version and the readable draft over 300,000 random strings, 0.20 us per join (the readable draft was 0.78 us).

**Against the 45 canonical names (honest result):** exact matches 0/45 (hi-lo) and 0/45 (lo-hi); mean case-folded Levenshtein distance raw 5.31 -> smoothed 5.98 (hi-lo) and 6.44 -> 7.24 (lo-hi), so smoothing moves *away* from the canon; the canonical name's consonant skeleton equals a raw join's in 0/45; the mean (LCS with the better raw join)/length is 0.41 and only 1/45 canonical names is a subsequence of a raw join. **Do not test smoothing against `DEMON_NAMES`; there is no oracle.** Test properties and a frozen vector table (Appendix B), e.g. `Tnmnm -> Tnamnam`, `Kttdt -> Ktatdit`.

**Extra collisions caused by smoothing:** with the draft *first* harsh bank (natural vowels `aeiou`, overlapping the fill vowels) smoothing merged 0.008% to 0.52% of the demons at n = 666 and 0.03% to 0.46% at n = 1024 (e.g. 579 repeated names, seed `hollow-vector`, n = 666, hi-lo). With the recommended harsh bank (natural vowels `o`/`e` only, so the fill vowels never occur naturally) and no collapse rule: **0 at n = 10, 28, 64, 666, 1024 for five seeds**, and it is a proof, not luck (insert-only). Soft and syllabic: smoothing changes **0.0%** of the 221,445 joins at n = 666, so "Smooth names" is a visible no-op for those two styles (Open Question 5).

### Pattern 5: collisions (certificate, scan, limit, scheduling)

**Certificate (O(n log n), exact, no scan).** The generated-table case. If all sounds match `^[a-z]+$`, are pairwise distinct, and form a prefix-free set (sort with code-unit `<`, compare adjacent with `startsWith`; 0.34 ms at n = 666, 1.3 ms at n = 4000), the raw join is injective in both orders and `upperFirst` is injective on lowercase ASCII, so there are 0 collisions. With smoothing on, the certificate still holds if either (A) no sound contains `a`, `u` or `i` (fill vowels cannot occur naturally: true for the recommended harsh bank), or (B) smoothing is inert: every sound is ASCII with a vowel, internal consonant runs <= 2, leading and trailing runs <= 1 (true for soft and syllabic; verified numerically as 0.0% changed joins). Overrides are handled in O(|overrides| x 2L): an override collides with another override (a `Map` of final strings) or with a non-overridden demon's derived name, found by splitting the override text at every prefix length <= 16 and looking both halves up (`Map<sound, zone>`, candidates `X` and `X` with its first letter lowercased). Differential-test the certificate against the scan.

**General scan (typed/imported tables, any smoothing).** One generic scanner calling the same `nameOf` as the UI (single source of truth), partitioned by the first UTF-16 unit of the final name (equal names share it), per partition: 29-bit hash plus a 23-bit local index packed in a `Float64Array` (exact below 2^53), typed-array sort, adjacent equal hashes are candidates, verified by recomputing the real strings. Exact, verified equal to brute force on injected prefix, duplicate and mixed-case collisions in both orders. An incremental-hash ASCII fast path was prototyped and rejected: only 1.6x faster and **wrong for non-ASCII sounds** (capitalisation and NFC change the hash input; 12 of 12 non-ASCII differential cases mismatched). Counts (`g` groups, `d` demons) stay exact; keep at most a bounded list of groups (suggest 2,000, ordered by lowest mesh) so a pathological all-same table cannot allocate millions of groups.

**Measured (Node 22.16 and Chromium 153 main thread / dedicated Worker; ms):**

| n | demons | raw (Node) | raw (Chromium main) | raw (Worker) | smoothed (Node) | smoothed (Chromium main) | smoothed (Worker) |
|---|--------|-----------|--------------------|-------------|----------------|--------------------------|-------------------|
| 666 | 221,445 | 62 | 50 | 49 | 120 | 101 | 96 |
| 1024 | 523,776 | 122 | 125 | 123 | 245 | 217 | 233 |
| 2000 | 1,999,000 | 468 | 407 | 450 | 974 | 892 | 924 |
| 4000 | 7,998,000 | 1956 | 1751 | 1936 | 4085 | 3719 | 3693 |

A Worker is not faster (it only unblocks the UI). Memory is 64 MiB for one 8 M-key array (or 8 MiB per first-letter partition). Estimate for the shipped conservative profile (`sw-6x`, measured throttle 6.3x): multiply by about 6.3 [ASSUMED scaling; CDP throttling was not applied to this scan], so 4000 smoothed would be about 25 s: too long for an edit-triggered recheck.

**Recommendation:** (1) certificate first (covers every generated table at every n up to the ceiling instantly); (2) general scan on the **main thread in cancellable slices** (the engine job takes a `shouldYield(): boolean` predicate checked every few hundred demons and returns a resumable state; the app passes `() => performance.now() > deadline` and schedules with `MessageChannel`/`setTimeout 0`; partitions by first letter bound each uninterruptible typed-array sort to 17 ms (n = 666) to 190 ms (n = 4000) natively, so use two-letter partitions if jank at 4000 matters); (3) a data limit `NAMING_COLLISION_SCAN_MAX_N` in `app/lib/namingLimits.ts`, default **1024** (about 0.12 s raw / 0.25 s smoothed native), shown by the UI-SPEC line `Not checked above {collisionCheckMax} zones.` only when the certificate cannot decide and n exceeds it; the value is a measured constant with a unit test that it is <= `INTERACTIVE_MAX_N`. Reasons for not using the worker: the exact static tests in `tests/app/workerClient.test.ts` pin one `new Worker(` in `workerClient.ts` and forbid any other file from constructing one; `WorkerClient` is typed to build requests and its latest-wins queue would let a layout build supersede a scan. If the user prefers a worker anyway, the cheapest route is a second instance of the same worker script through `createNumogramWorker()` plus a small generic latest-wins client, and updating those pinned tests deliberately.

### Pattern 6: JSON schema `ccrug.naming/1`, validator, caps

```json
{
  "schema": "ccrug.naming/1",
  "base": 28,
  "source": "generated",
  "generator": { "prng": "sfc32-cyrb128@1", "gen": "names-gen@1", "seed": "hollow-vector", "style": "harsh" },
  "join": { "order": "hi-lo", "smoothing": 0 },
  "zones": ["tp", "kn", "xkr", "..."],
  "locks": [0, 3],
  "overrides": { "44": "Ummnu" },
  "meta": { "title": "", "notes": "" }
}
```

- `source`: `generated` | `ccru` (`ccru` only at base 10; canonical names are resolved by the app, not embedded).
- `generator` is always present (the panel always has a seed). Unknown `prng`/`gen` ids do not block: the dense `zones` are authoritative and the seed is kept but regeneration is disabled with a message.
- `join.smoothing`: `0` or the euphony version number (`1`); an unknown version is the "unknown format version" error or a downgrade warning (planner's call; the UI-SPEC lists the error copy).
- `zones`: dense, length equals `base`, present when `base <= interactiveMaxN`; absent in seed-only exports and refused at seed-only bases (D-11, UI-SPEC import errors). Dense (not sparse) because it survives a future generator version and is what tools expect. `locks`: sorted unique zone ids. `overrides`: only at bases within the ceiling.
- No timestamp by default (the engine may not read the clock): same naming gives the same bytes. `meta` is optional free text (strings <= 200 characters).

**Sizes [VERIFIED: measured]:** n = 4000 dense zones only 33,465 bytes (51,821 with 400 locks and 1,000 overrides; 69,068 pretty-printed); n = 666 5,571 bytes; seed-only 172 bytes at any base; the worst legitimate file, base 666 with every one of 221,445 demons overridden, is 3.88 MiB (`JSON.parse` 26 ms, key regex pass 47 ms); 4000 sounds of 16 CJK characters plus 100,000 overrides of 32 CJK characters would be 10.4 MiB.

**Caps (recommended constants in `engine/naming/schema.ts`):** `NAMING_IMPORT_MAX_BYTES = 8 MiB` (8,388,608: admits a full rename at base 666, rejects absurd files; check `File.size` before reading and `text.length` for slots), `NAMING_MAX_OVERRIDES = 250,000` (a second guard on memory), `SOUND_MAX_LENGTH = 16`, `NAME_MAX_LENGTH = 32`, `SEED_MAX_LENGTH = 64` UTF-16 units (no Segmenter dependency in the URL path), `meta` strings <= 200, issues shown <= 5.

**Validator behaviour (hand-written, all-or-nothing, non-recursive):** `JSON.parse` in try/catch (V8's parser is iterative: 4,000,000 nested arrays parsed in 1.0 s, so the validator must simply never recurse); top level must be an object with `schema === 'ccrug.naming/1'` (other `ccrug.naming/N` is "unknown format version", anything else "not a names file"); `base` through the engine's `validateBase`, mismatch with the current base is the wrong-base error that carries `offerSeed` when `generator.seed` normalises to 1..64 valid characters; seed-only base: refuse `zones`, `locks`, `overrides`; `zones.length === base`; every sound checked by the Pattern 7 text rules, collecting `{ zone, reason }` (first failing rule per sound: empty, space, digit, other, long), reporting 5 then `And {k} more.`; `locks` integers in range; override keys must match `^(0|[1-9][0-9]{0,15})$` and be `< base*(base-1)/2` and values pass the name rules, stored in a `Map` (so `__proto__` and `constructor` keys are rejected as invalid, never assigned: `JSON.parse` creates an own `__proto__` property and a naive `copy[k] = v` loop is the hazard); unknown keys (top level, `generator`, `join`, `meta`) are listed as dotted paths (<= 5) and never block; return `{ ok: true, naming, unknownKeys }` or `{ ok: false, issues, offerSeed? }`. localStorage slots go through the same function (Pitfall 17).

**Text rules (D-07, evidence):** NFC first, trim, then `^\p{L}[\p{L}\p{M}]*$`, length by graphemes. A bare `\p{L}+` rejects Devanagari, Thai and Arabic with harakat (they need marks; measured `letterRule true` vs `lettersOnlyP{L} false`). Persian ZWNJ (U+200C, a format character) is still refused with "Sounds can only contain letters." (a deliberate side effect that also blocks bidi-override characters). Order of reasons: empty, whitespace (`\s`), digit (`\p{Nd}`), other, too long. Counting: if `s.length <= max` the grapheme count is also <= max, so skip the Segmenter (it costs about 9 us per string: 35 ms for 4,000 sounds, 1.0 s for 100,000 names, versus 0.8 ms for the regex); only longer strings are segmented. Fallback when `Intl.Segmenter` is missing: `s.normalize('NFC').match(/\P{M}\p{M}*/gu)`, verified equal on ten script samples except Devanagari conjuncts (over-counts by one, the safe direction). Intl.Segmenter: Baseline 2024 [CITED: MDN]; the older versions (Chrome 87, Firefox 125, Safari 14.1) are from training [ASSUMED].

### Pattern 7: URL, `labels=sounds`, worker guard

**Grammar (prototyped; 576/576 round trips including `&`, `=`, `%`, `+`, NFD, CJK, emoji, 64-character seeds):** `names=ccru` (honoured only at base 10) or `names=seed:<seed>`, with independent lenient companions `nstyle=harsh|soft|syllabic`, `njoin=lh`, `nsmooth=1` (each omitted at its default; unknown values fall back to the default without invalidating the seed). `ShareState` gains `names: NamesLink | null`, where `null` means "the default naming for this base" (base 10 = CCRU, others = engine `DEFAULT_SEED`, harsh, hi-lo, smoothing off) and is omitted from the URL; base 10 with a generated default-seed naming must be written (`names=seed:<DEFAULT_SEED>`), which the default-by-base rule handles. Parse: raw length <= 64 + 13, NFC, trim, 1..64, no `\p{Cc}`, `\p{Zl}`, `\p{Zp}`, else `null`. `names` is **kept above the ceiling** (seed-only is exactly what survives there; the natural-tier guard that drops `region`, `isolate`, `mute` must not drop it, and parsing needs no numogram). Keys are re-sorted by the codec's existing `localeCompare`; `URLSearchParams` writes `:` as `%3A` (tests compare decoded values). `names=seed:` is generator `names-gen@1` forever; a future generator must use a new prefix (`seed2:`), otherwise old links would silently change names. The only `ShareState` literals are `NumogramClient.currentShareState` and `tests/app/shareParams.test.ts`, and both need `names`; the 40-URL baseline corpus round-trip is unaffected because the field is omitted at default.

**`labels=sounds`:** add `{ mode: 'sounds' }` to the `LabelScheme` union; `formatLabelScheme` -> `'sounds'`, `parseLabelScheme('sounds')`, `labelSchemeKey` -> `'sounds'`, `schemeAlphabet` -> `null`, and `formatZoneLabel`/`zoneLabelsFor` return the **digit** label in this mode (UI-SPEC: `zoneLabel(z)` stays digits; a separate sound lookup feeds the node slot). **Two traps:** (1) `isLabelScheme` in `app/lib/worker/protocol.ts` only accepts `digits|xeno|preset|custom`; without a fourth branch `isWorkerRequest` is false and selecting Sounds at a Canvas base becomes a `build-failed` revert; (2) `resultKey` includes `labelSchemeKey`, so toggling Sounds at a Canvas base triggers a worker rebuild (the 150 ms grace means no flash for bases <= 4000). Normalising `sounds` to `digits` in the key is *not* safe because `applyWorkerResponse` re-sets the scheme from the echoed request labels and would revert the user's choice; accept the cheap rebuild.

### Pattern 8: session, autosave, preview, undo

- **Store:** edit operations are pure functions in `engine/naming/edit.ts` returning a new immutable `Naming` (a `rev` integer from the session, unchanged parts shared: a sound edit copies the sounds array, never the overrides map).
- **History:** `HistorySnapshot` gains `naming`; `snapshotKey` is `JSON.stringify(snapshot)` and runs on every dependency change, so the key must replace `naming` by its `rev` (a JSON replacer) or it stringifies up to 100 KB per effect run. `applySnapshot` already refuses another base. Memory: 80 entries sharing unchanged parts is small, but a 100,000-override map edited 80 times would copy it each time; trim the undo stack for namings above a few thousand overrides (Pitfall 18). Ctrl/Cmd+Z in a Names field is the browser's text undo (the global handler's `isTypingTarget` guard) as the UI-SPEC says.
- **Autosave:** key `ccrug.naming.v1.<base>`, value = the export JSON (one serializer, one validator). Written (debounced about 400 ms, flushed on `pagehide`) only after the first user edit, never in `preview`, never above the ceiling. Reads and writes in try/catch including the `window.localStorage` getter (it can throw `SecurityError`); `QuotaExceededError` surfaces the UI-SPEC "Couldn't save" line; quota is 5 MiB per origin [CITED: MDN Storage quotas]; a corrupt or foreign slot is ignored like an absent one.
- **Base switch:** `resetForBaseSwitch` is the one batched reset shared by the synchronous commit and the worker swap (`applyWorkerResponse`); loading the base's slot (or the default) belongs there so the Canvas tier and the SVG tier behave identically. History clearing already exists.
- **Hydration:** a `names` link at a worker base is stashed with the rest of `pendingHydrationRef` and applied by the swap; at SVG bases it applies in the hydration effect. The preview/adopt rule is a pure function of `(saved, link)`: if a saved slot exists and its link form (`source`, seed, style, join, smoothing) differs from the link's, open as `preview` (editing controls disabled, autosave off); if equal or no slot, the link becomes the working naming (still unsaved until the first edit). The URL always reflects the *displayed* naming's link form.
- **Name consumers:** use a separate `NamingContext` (null default) read by `DemonRowList`, `DemonMatrix`, `DemonInfo` and `selectedInfoMeta`. `DemonInfo` and `selectedInfoMeta` currently read `d.name` baked into the pinned/hovered `HoverInfo` by `legacyDemon`, so a rename would leave the heading stale; resolve at render time instead. Adding a required field to `NumogramViewContextValue` would force edits in seven render-test literals (`canvasDiagramRender`, `canvasPanelsRender`, `demonBrowserRender`, `demonFocusRender`, `demonMatrixRender`, `demonRowListRender`, `demonsOverlayRender`); a separate context with a null default keeps provider-less renders and their tests valid.
- `demonSearch.ts` matches CCRU names through `demonNameTable(g.base)` (base 10, `count <= NAME_SEARCH_MAX_COUNT = 50,000`); it must read the live names (a 45-entry table at base 10) or `Lurgo` would still match after the user switches to generated names.

### Pattern 9: the live desktop stack (todo 008) and Names placement

**Pure function (`app/lib/panelStack.ts`), verified in scratch:**

```ts
export const COLUMNS = [
  { id: 'L', panels: ['layers', 'labels', 'zones', 'syz'] },
  { id: 'R', panels: ['regions', 'currents', 'gates', 'text'] },
  { id: 'S', panels: ['info', 'names'] },            // Selection, then Names directly under it
] as const
export function computeDesktopStack(heights: Partial<Record<PanelId, number>>, o: { selectionX: number; vw: number }) {
  const out = {} as Record<PanelId, { x: number; y: number }>
  for (const col of COLUMNS) {
    let y = BASE_Y                                       // 64
    for (const id of col.panels) {
      out[id] = { x: xFor(id, col.id, o), y: id === col.panels[0] ? BASE_Y : Math.round(y) }
      y = y + (heights[id] ?? DEFAULT_H) + GAP           // (y + h) + 18, LEFT-TO-RIGHT: see Pitfall 3
    }
  }
  return out
}
// names x = min(max(selectionX, 548), vw - 252);  bodyMax = clamp(80, vh - (y + 34) - 96, 560)
```

**Evidence [VERIFIED: browser measurement of the built `out/` at 1280 x 800, 1440 x 900, 1024 x 768, base 10 direct load, and after typing 28 in the picker]:** measured base-10 heights (px): Layers 146, Labels 101, Zones 270, Regions 145, Syzygies 143, Currents 143, Gates 270, Text 30 (collapsed; the contract and `PANEL_GROUP_DEFAULT_HEIGHTS` say 34, 34 is only the pre-measure default), Selection 296.5. The old formula at those heights gives exactly the observed tops (Labels 228, Zones 347, Syzygies 635, Currents 227, Gates 388, Text 676) and `computeDesktopStack` gives the same; 0 mismatches against the old formula over 20,000 random height sets once the association is `(y + h) + GAP` (the first draft `y += h + GAP` differed in the last ulp and flipped `Math.round` ties in 17 of 120,000 comparisons). Names derived y at base 10 is 379 (64 + 296.5 + 18 = 378.5 rounds to 379), `bodyMax` 291 at vh 800 with nothing selected, 80 when Selection grows to 520. Todo 008 reproduced exactly: after typing 28, Regions bottom 250 and Currents top 227 (23 px overlap); the derived stack would give Labels 228, Zones 326, Syzygies 874, Currents 268, Gates 618, Text 1166.

**Consequence the user must know (Open Question 6):** at base 28 on a 1280 x 800 window Zones, Gates and Syzygies are 530, 530 and 332 px tall (the 500 px body cap), so the strict no-overlap stack leaves Syzygies (top 874) and Text (top 1166) below the fold in this fixed-position UI. Collapsing a panel now pulls the ones below it up, so they stay reachable. Today they are visible but overlapped. The contract chose this on purpose; confirm.

**`usePanelDrag` changes:** (a) add `names` to the position map (initial) and to the z map at 49; (b) accept `derived` (null until the five reporting panels `layers, labels, zones, regions, currents` have all reported, as today) and return `positions` = displayed (derived for unmoved, stored for moved), so the ten call sites in `NumogramClient.tsx` need no change; (c) **drag seed**: `startDrag` reads the *displayed* position of the panel (the existing code reads stored `positions`, which for a derived panel is not where it is drawn: for Labels the stored initial y is 206 while it is displayed at 228, a 22 px jump on the first mouse move); (d) `moved` is a state-backed set added on the first mouse move, not on mouse down; a moved panel keeps its position and its slot stays reserved; (e) **z cap**: when the counter would pass 69, re-rank the ten panels' current order onto 40..49 and continue from 50 (500 activations in the prototype: max z 69, the activated panel always on top; toolbar 74, overlay 80, dropdown 120 stay above); (f) the one-shot `infoPanelInitRef` effect stores `selectionX` in state instead of `positions.info` (`setPanelPositions` has exactly two callers, both replaced; `stackPanels` in the hook is unused dead code and can go with the rewrite). **Mobile:** `PANEL_GROUP_ORDER` becomes `names, layers, labels, zones, regions, syz, currents, gates, text, info`; `usePanelGroupLayout` already stacks by real heights (gap 6, x 8); Names `bodyMax = min(560, vh - 98 - 96)`.

**Frozen baseline risk (verified):** `e2e/behaviour-collect.ts` uses no geometry at all (no `getBoundingClientRect`, no offsets); `e2e/behaviour.spec.ts` reads only `style.left/top/zIndex` in the Layers drag test (delta equals the mouse delta, z rises) and finds panels through `header` text and `style.position === 'fixed'`, both preserved. The new panel's header sits in a `data-post-baseline` root so it is skipped. `npm run test:swap` is the proof.

**Tests:** unit `tests/app/panelStack.test.ts` (identity against a literal copy of the old formula at the measured heights and random heights, follow on collapse, moved slot reservation, names x clamp at 821/900/991/1024/1280/1440, `bodyMax` clamp) plus a pure drag/z reducer extracted from the hook (the hook has no jsdom test today); e2e `e2e/panel-stack.spec.ts` for the UI-SPEC geometry hooks (no-overlap matrix, drag no-jump, 80 activations <= 69, base 10 then 28 through the picker closes todo 008, and the mouse click on a Warp/Plex Isolate/Mute button added to `e2e/region-legend.spec.ts`).

### Suggested decomposition (planner decides; not binding)

- **Wave 1, pure engine (parallel plans):** (a) prng + feistel + Appendix B vectors; (b) banks + generator + a contact-sheet checkpoint for the user; (c) text + euphony + derive + edit operations; (d) collisions (certificate, stepper, differential tests); (e) schema + validator + serializer.
- **Wave 2, app libraries (parallel):** (a) `shareParams` names codec + `labels=sounds` + worker guard; (b) CCRU preset adapter, session, storage, limits, `NamingContext`, `legacyDemon` parameter; (c) `panelStack` + `usePanelDrag` + z cap + mobile order, which closes todo 008 and is independent of naming.
- **Wave 3, UI:** Cyber prop additions + CSS + `LockIcon`; Names panel shell, controls, preview, import and export; zone list; collisions + demon name editor + name displays; `sounds` label mode (pure fit function, SVG tier, both Canvas passes, Labels row, control).
- **Wave 4:** e2e specs, page-weight baseline raise with a reason, layout-sensitive spec re-runs, final `verify`; the orchestrator moves todo 008 to completed with its resolution trace.

### Anti-Patterns to Avoid
- **A merged syllable alphabet with depth classes, or any generator without a prefix-free sound set:** collides above depth 2 (measured) and the guarantee cannot be stated.
- **Sorting-based `Array.prototype.sort` or `localeCompare` in canonical outputs:** ICU-dependent; use code-unit `<`.
- **Storing or caching names per demon, or baking a name into `HoverInfo`:** stale after edits and O(n^2) at scale.
- **An ASCII-only hash fast path for the general scan:** wrong for non-ASCII (measured).
- **`copy[key] = value` from imported JSON into a plain object:** use `Map` and digit-regex keys.
- **Storing the 45 canonical names inside user `overrides`:** copies CCRU lore into user files and miscounts "renamed demons".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grapheme counting | a combining-mark state machine | `Intl.Segmenter` (+ the 1-line regex fallback) | Extended grapheme rules (Hangul, Indic conjuncts, ZWJ) change with Unicode versions |
| Unicode normalisation / case | tables | `String.prototype.normalize('NFC')`, `toUpperCase()` | Platform |
| Virtualized zone list | custom windowing | `@tanstack/react-virtual` (as `DemonRowList`) | Existing pattern, sticky header, scrollMargin |
| URL encoding | manual escaping | `URLSearchParams` through the existing codec | Existing allow-list codec |
| File download / pick | libraries | `Blob` + temporary anchor, `<input type=file>` | No dependency allowed |
| JSON schema engine | ajv / zod | the hand-written validator | Locked by CONTEXT; the schema is tiny and the caps are the point |

**Key insight:** the algorithms that *are* hand-rolled (PRNG, Feistel, collision hash, validator) are tiny, have independent reference implementations in the tests, and are frozen by vectors. Everything with Unicode or browser semantics comes from the platform.

## Common Pitfalls

### Pitfall 1: Non-canonical text reaches the hash or the comparison
**What goes wrong:** `e` + U+0301 and U+00E9 are different seeds (different state words) and different names.
**How to avoid:** NFC and trim at every boundary (URL, field, import, slot); re-normalise defensively inside `createGenerator`; vectors include both spellings.
**Warning signs:** a shared link produces different names on the recipient's machine.

### Pitfall 2: Typed unicode escapes in source files
**What goes wrong:** the repository's file-write tooling decodes typed `\uXXXX` escapes into raw characters (STATE Phase 2 P07); during this research a typed U+2028 escape broke a scratch script and a typed ZWNJ escape landed as a raw invisible character in this very file (replaced by the text U+200C); scan new files for Unicode category Cf (format) characters after writing them.
**How to avoid:** `String.fromCharCode(0)` for the key-schedule separator; character classes such as `\p{Cc}` instead of ranges; build non-ASCII test data with `String.fromCodePoint`.

### Pitfall 3: Chain association in the stack
**What goes wrong:** `y += h + GAP` and the old `(y + h) + GAP` differ by one ulp; `Math.round` flips on exact .5 ties (Selection is 296.5): 17 mismatches in 120,000 comparisons.
**How to avoid:** write `y = y + h + GAP` and keep a unit test that compares against a literal copy of the old formula on random heights.

### Pitfall 4: `startDrag` seeds from stored positions
**What goes wrong:** with a derived stack the stored position of an unmoved panel is not where it is drawn (Labels: stored 206, drawn 228); the panel jumps 22 px on the first mouse move.
**How to avoid:** seed from the displayed position; test mouse-down without move leaves left/top unchanged, then 5 px and 60 px moves equal the mouse delta.

### Pitfall 5: The worker guard rejects `sounds`
**What goes wrong:** `isLabelScheme` accepts four literal modes; a fifth makes `isWorkerRequest` false, so Sounds at a Canvas base fails the build and reverts.
**How to avoid:** add the branch in the same commit as the union member; add a guard unit test; accept the rebuild on toggle (Pattern 7).

### Pitfall 6: Names baked into pinned or hovered info
**What goes wrong:** `legacyDemon` stores `name` in `HoverInfo.demon`; `DemonInfo` and `selectedInfoMeta` print it, so renames, undo and base switches leave stale headings.
**How to avoid:** resolve through `NamingContext` at render; keep `legacyDemon` working without it (provider-less render tests).

### Pitfall 7: Whole-naming JSON in the history key
**What goes wrong:** `snapshotKey` stringifies the snapshot on every dependency change; a 4000-zone naming is about 33 KB each time.
**How to avoid:** JSON replacer that maps `naming` to `rev`.

### Pitfall 8: Segmenter on every string
**What goes wrong:** about 9 us per string (1.0 s for 100,000 override names).
**How to avoid:** segment only strings longer than the limit in UTF-16 units.

### Pitfall 9: `\p{L}` only
**What goes wrong:** Devanagari, Thai and Arabic with vowel marks are rejected although they are letters in the user's sense.
**How to avoid:** `^\p{L}[\p{L}\p{M}]*$` after NFC (Open Question 3 for ZWNJ).

### Pitfall 10: Prototype keys in imported JSON
**What goes wrong:** `JSON.parse` creates an own `__proto__`; copying keys into a plain object can change a prototype.
**How to avoid:** `Map`, digit-regex keys, vectors for `__proto__`, `constructor`, `toString`.

### Pitfall 11: Fast hash path with non-ASCII
**What goes wrong:** 12 of 12 differential cases mismatched.
**How to avoid:** one generic scanner built on `nameOf`; if an ASCII fast path is ever added, guard it by an all-ASCII check and a differential property.

### Pitfall 12: The `base-ten` grep gate
**What goes wrong:** `app/` lines such as `d <= 4`, `x > 9`, `{ length: 10 }` or `9 - x` fail `npm run verify`; naming code has depth loops and clamps that look like these.
**How to avoid:** named constants (`MAX_DEPTH`, `SOUND_MAX_LENGTH`), loops over `.length`; run `node scripts/check-repo.mjs --only base-ten` while writing.

### Pitfall 13: Page weight and HTML bytes
**What goes wrong:** `/numogram/` JS is 808,836 bytes with a 5% tolerance (about 40 KB); the engine naming module, validator, panel, editor and stack will plausibly exceed that [ASSUMED estimate +30 to 60 KB raw; Phase 6 added +82 KB raw for the Canvas tier]. Also `CyberPanel` renders its children inside a collapsed wrapper, so a fully rendered Names body (controls, table, about 20 rows) lands in the prerendered HTML (baseline 90,137 bytes, 5% tolerance about 4.5 KB).
**How to avoid:** mount the Names body only while open (keep the header tag and the persistent live carrier always mounted); raise the baseline once through `node scripts/page-weight.mjs update --reason` with a dated reason, as every phase did.

### Pitfall 14: Copying CCRU text
**What goes wrong:** `tests/presets/base10-adapter.test.ts` scans every `app/presets/base10/*.ts` except `lore.ts` for lore text; `engine/` must not embed the 45 names or the 10 sounds.
**How to avoid:** the preset adapter imports from `lore.ts` and exports data by reference; the engine takes the preset as an argument.

### Pitfall 15: Smoothing looks dead for two styles
**What goes wrong:** 0.0% of soft and syllabic joins change, so Raw and Smoothed columns are identical and the checkbox seems broken.
**How to avoid:** decide in Open Question 5; at minimum say so in the helper line or the plan summary.

### Pitfall 16: Locks versus regenerated duplicates
**What goes wrong:** a typed `gl` locked at zone 3 and a generated `gl` at zone 7 give two zones one sound and a flood of collisions.
**How to avoid:** the spare stream in Pattern 2; property test: random locks, all sounds distinct when locks are distinct.

### Pitfall 17: localStorage is untrusted input
**What goes wrong:** another tab, an older version or manual edits can leave anything in a slot; `localStorage` itself can throw on access.
**How to avoid:** same validator as import, try/catch around every access and around the getter, treat failures as "no slot", never crash the page.

### Pitfall 18: Undo memory with huge override maps
**What goes wrong:** 80 history entries each holding a copied 100,000-entry map is hundreds of MB.
**How to avoid:** share unchanged parts; cap the undo depth for namings with many overrides.

### Pitfall 19: Layout numbers in the contract are approximate
**What goes wrong:** collapsed headers measure 30 px (not 34), Selection is 296.5 (not about 300), so Names y is 379 (not 382).
**How to avoid:** assertions use measured values and the within-1px formula the UI-SPEC already gives; never hard-code a y.

### Pitfall 20: Layout-sensitive specs
**What goes wrong:** `layers-zoom.spec.ts` and `canvas-tier.spec.ts` expand the Text panel at 1280 x 1300, `canvas-interaction.spec.ts` taps at 375 x 667 and 768 x 1024, `row-click-regression.spec.ts` and `region-legend.spec.ts` click rows.
**How to avoid:** re-run all five after the stack, the mobile reorder and the z cap, in addition to `npm run test:swap`.

### Pitfall 21: `ß`, `ı` and Unicode-version drift in capitalisation
**What goes wrong:** `upperFirst` is deterministic but depends on the engine's Unicode tables; `ı` and `i` both capitalise to `I`.
**How to avoid:** compare final strings (as the report does); keep the ASCII-lowercase precondition on the certificate.

## Code Examples

Verified patterns (all run as JavaScript in scratch; TypeScript spellings are mechanical).

### Feistel permutation with cycle-walking and the key schedule
```ts
// engine/naming/feistel.ts
const SEP = String.fromCharCode(0)
export const FEISTEL_ROUNDS = 8
function mix(x: number, k: number): number {
  x = Math.imul(x ^ k, 0x9e3779b1)
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}
export function roundKeys(seed: string, style: string, depth: number): number[] {
  const next = sfc32(...cyrb128(`${style}${SEP}${depth}${SEP}${seed}`))
  for (let i = 0; i < 12; i++) next()
  return Array.from({ length: FEISTEL_ROUNDS }, () => next())
}
export function permutation(size: number, keys: readonly number[]): (x: number) => number {
  let bits = 0; while (2 ** bits < size) bits++
  if (bits % 2) bits++
  const w = Math.max(1, bits / 2), half = 2 ** w            // halves < 2^26, domain < 2^52
  const feistel = (x: number): number => {
    let l = Math.floor(x / half), r = x % half               // exact: power-of-two divisor
    for (const k of keys) { const f = mix(r, k) % half; const nl = r; r = (l ^ f) >>> 0; l = nl }
    return l * half + r
  }
  return x => { do { x = feistel(x) } while (x >= size); return x }
}
```

### Tree decode (zone to sound)
```ts
// sizes[d-1] = I**(d-1) * L ; offs[d-1] = sum of earlier sizes
function soundAt(z: number): string {
  let d = 1; while (d < MAX_DEPTH && z >= offs[d]!) d++
  let r = permFor(d)(z - offs[d - 1]!)
  const parts = new Array<string>(d)
  parts[d - 1] = bank.leaf[r % L]!; r = Math.floor(r / L)
  for (let i = d - 2; i >= 0; i--) { parts[i] = bank.internal[r % I]!; r = Math.floor(r / I) }
  return parts.join('')
}
```

### Certificate for generated tables
```ts
export function provablyUnique(sounds: readonly string[], smoothing: 0 | 1): boolean {
  if (!sounds.every(s => /^[a-z]+$/.test(s))) return false
  const sorted = [...sounds].sort()                         // default sort is code-unit order for ASCII
  for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i + 1]!.startsWith(sorted[i]!)) return false  // also catches duplicates
  return smoothing === 0 || sounds.every(s => !/[aui]/.test(s)) || smoothingInert(sounds)
}
```

### Partitioned scan (core loop, generic `nameOf`)
```ts
// per first-letter partition: keys = (hash29 << 23) + localIndex as one double, sort, adjacent equal hash = candidate, verify with real strings
keys[m] = (hashStr(nameOf(a, b)) >>> 3) * 8388608 + m
```

### Drag seed and z re-rank (pure reducers)
```ts
start(id, mx, my) { const p = moved.has(id) ? stored[id] : derived()[id]; drag = { id, mx, my, ox: p.x, oy: p.y } }
move(mx, my) { stored[drag.id] = { x: drag.ox + mx - drag.mx, y: drag.oy + my - drag.my }; moved.add(drag.id) }
bump(id) { if (counter > 69) { [...ids].sort((a, b) => z[a] - z[b]).forEach((k, i) => { z[k] = 40 + i }); counter = 50 } z[id] = counter++ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unseedable `Math.random` | explicit 32-bit PRNG (sfc32 seeded by cyrb128) | project rule (Pitfall 15 in research) | A TC39 "seeded random" proposal exists at Stage 1 [CITED: tc39.es/proposal-seeded-random, surfaced by search, not fetched] and is not usable |
| Hand grapheme splitting | `Intl.Segmenter` | Baseline 2024 [CITED: MDN] | No dependency |
| Shuffle then index | bijection by Feistel network (format-preserving-encryption style) over a structured inventory | this research | Lazy, stable, no memory |

**Deprecated/outdated within this project:** the FEATURES.md remark that `"a:b"` keys match `DEMON_NAMES`; the research sketch's `"a::b"` and `mulberry32-cyrb128@1` example algorithm id (the roadmap's `sfc32-cyrb128@1` governs).

## Existing Tests: What Legitimately Changes and What Must Stay Identical

| Item | Status | Detail |
|------|--------|--------|
| `e2e/demons-browser.spec.ts` "other bases keep an empty NAME column" | Rewrite (not skip) | Assert generated names (non-empty, first letter capital, equal to a name computed independently with the engine) at base 28; keep the base-10 `toHaveText('Lurgo')`/`'Ummnu'` checks as they are |
| `tests/app/demonNames.test.ts` | Unchanged if `demonName`/`demonNameTable` stay the CCRU-lore seam | The UI-SPEC lists `demonName is null at every base other than 10` as superseded; that is only true if the planner changes `demonName`'s contract. Recommended: keep `demonName` as the preset lookup, add the new resolver beside it, and only update `legacyDemon`'s tests for its new optional naming parameter |
| `LabelSchemeControls` radio-count tests | None exist | grep of `tests/` and `e2e/` found no test counting three radios; `e2e/label-scheme.spec.ts` selects by text via `radioLabel`; new `Sounds` tests are additive |
| `tests/app/shareParams.test.ts` | Extend | `names: null` in `ShareState` literals, new round-trip and hostile-input tests; the 40-URL corpus must still round-trip byte for byte |
| `tests/app/workerClient.test.ts`, `workerCore*.test.ts` | Extend | add the `sounds` guard case; the pinned `new Worker(` static tests stay untouched (no second worker) |
| Seven render tests with `NumogramViewContextValue` literals | Unchanged | only if naming is a separate context |
| New markup-identity tests | New | `CyberButton` (extend the existing `demonsOverlayRender` pattern), new `tests/app/cyberControlsMarkup.test.ts` for `CyberRadio` and `CyberCheckbox` |
| Layout-sensitive e2e | Re-run | `canvas-interaction`, `layers-zoom`, `canvas-tier`, `row-click-regression`, `region-legend`, plus `npm run test:swap` |
| Must stay byte-identical | Frozen | 60 DOM goldens, `e2e/__behaviour__`, `engine/test/fixtures/**` (numeric oracle and derived), `engine/test/layout.digest.test.ts`, lore tests, `Projection`/`PairGraphProjection` output in every non-`sounds` mode |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The scratch `cyrb128`/`sfc32` equal bryc's published code byte for byte (github.com was unreachable) | Pattern 1 | None for correctness: `@1` is defined by our code and vectors; only matters if someone wants to cite upstream equality |
| A2 | Collision-scan time scales by about 6.3x on the shipped `sw-6x` profile | Pattern 5 | If less, the default limit could be raised; if more, lower it. The limit is a data constant |
| A3 | Intl.Segmenter first shipped in Chrome 87 / Firefox 125 / Safari 14.1 | Pattern 6 | MDN confirms Baseline 2024 [CITED]; per-version numbers only affect the fallback decision |
| A4 | Page-weight growth +30 to 60 KB raw | Pitfall 13 | A larger raise is a reasoned ledger entry, not a blocker |
| A5 | CCRU names as a preset *layer* (beat only by user overrides) satisfies D-14 "as overrides" | Pattern 3 | If the user wants the 45 inline in files and slots, treat `override === preset[mesh]` as "unmodified"; small change |
| A6 | Mesh-number keys are acceptable to the user over `"a:b"` | Pattern 3 | File readability; boundary conversion is a small change |
| A7 | The draft banks look right (harsh/soft/syllabic) | Appendix A | They are drafts: the plan needs a contact-sheet sign-off checkpoint (precedent 03-08) and then digest pinning |
| A8 | The 5 MiB per-origin localStorage figure (MDN) applies in every target browser | Pattern 8 | Failure is handled by the UI-SPEC "Couldn't save" line either way |

## Open Questions (RESOLVED)

1. **Style banks need a human sign-off.**
   - What we know: structure, capacity, shape statistics and sample sheets are measured (Appendix A). Harsh draft at n <= 64: all-consonant, 2 to 3 letters, consonant runs of 2/3 split 41/23 vs the CCRU originals' 5/4; but only 2% of sounds have a doubled letter vs 11% (and 73% of canonical *names*), and harsh names have 16% vowel density vs 40% canonical.
   - What's unclear: whether the look is right.
   - Recommendation: a plan task prints a contact sheet (bases 10, 28, 64, 666, 4000, three styles, raw and smoothed) for the user to approve, then pins `sha256` digests of the sound tables like `engine/test/layout.digest.test.ts`. Never update a digest to make a test pass.
   - RESOLVED: plan 07-06 blocking checkpoint (orchestrator decision 1): contact sheet first, user sign-off, then the digests are pinned.

2. **RESOLVED: generator construction.** Prefix-code tree with Feistel and cycle-walking is validated (bijective, distinct, O(1), prefix-stable, 0 raw collisions); Fisher-Yates rejected. Evidence in Pattern 2.

3. **Letters rule and ZWNJ (D-07).** Recommended `^\p{L}[\p{L}\p{M}]*$` (accepts Indic, Thai, Arabic with marks). Persian ZWNJ and any Cf character are refused as "letters only". Confirm, or allow U+200C explicitly.
   - RESOLVED: plan 07-02 [default] (orchestrator decision 2): the rule above, with ZWNJ and every Cf character refused as letters only.

4. **Collision-check limit and where it runs.** Recommended: certificate for generated tables at any n, general scan on the main thread in slices up to a data limit of 1024 (not the 4000 ceiling), no new worker. Measured costs are in Pattern 5. If the user wants the scan at 4000 for typed edits, either accept 2 to 4 s (native) background slices or approve the worker route and the two pinned static tests that change.
   - RESOLVED: plans 07-10 and 07-11 (scheduled by 07-20) (orchestrator decision 3): certificate plus a cancellable main-thread scan, data limit 1024, no new worker.

5. **Smoothing is a no-op for soft and syllabic.** 0.0% of joins change. Options: accept (those styles are already readable), disable or caption the checkbox, or tune the banks to produce occasional clusters. UI-SPEC copy is already approved, so a caption needs a copy decision.
   - RESOLVED: plans 07-11 and 07-17 (orchestrator decision 4): the checkbox stays for every style and the caption 'Smoothing makes no difference to these sounds.' shows when smoothing changes nothing.

6. **Desktop stack consequence at larger bases.** Measured at 1280 x 800 and base 28: Syzygies top 874, Gates 618 to 1148, Text 1166. Strict no-overlap puts them below the fold (collapsing panels above pulls them up). Confirm, or choose an optional fold-aware tweak (cap panel body heights to the viewport) that is outside the approved contract.
   - RESOLVED: plans 07-03 and 07-24 (orchestrator decision 5): accepted as the contract states; no fold-aware tweak.

7. **RESOLVED: override key form.** Decimal mesh number in memory and JSON (Pattern 3). Remaining user choice is only `"a:b"` for file readability.

8. **RESOLVED: Feistel domain and cycle-walking worst case.** Expected evaluations = domain/size, balanced halves bound it at 4 (measured 3.9), geometric tail, 0 extra with power-of-two sizes. Pattern 2.

9. **RESOLVED: PRNG vectors and cross-platform determinism.** Appendix B; integer-only state path; BigInt cross-check; Chromium equals Node.

10. **RESOLVED: Segmenter availability.** Present in Node 22.16 and Chromium 153, typed under ES2022, Baseline 2024; regex fallback measured. Pattern 6.

11. **RESOLVED: export size.** 33,465 bytes at n = 4000 (dense), 172 bytes seed-only (Pattern 6).

12. **Generator version in links.** `names=seed:` is `names-gen@1` forever; a future change must add a new prefix. Confirm that freezing is acceptable.
   - RESOLVED: plans 07-01 and 07-09 (orchestrator decision 8): `names=seed:` means `names-gen@1` forever; a future generator adds a new prefix.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | engine tests, scripts | yes | 22.16.0 | none needed |
| npm | `npm run verify` | yes | 11.x local (CI npm 10) | no lockfile change expected |
| Playwright Chromium | e2e geometry, DOM goldens | yes | chromium-1243 (153.0.8010.12) | none |
| `tsx` | optional scripts | yes | 4.23.15 | plain `node` |
| `Intl.Segmenter` | grapheme count | yes (Node, Chromium) | ICU 77.1 / Unicode 16 in Node | regex fallback (Pattern 6) |
| Network (github.com, StackOverflow) | upstream PRNG text | no | n/a | not needed; vectors are self-defined |

**Missing dependencies with no fallback:** none. **With fallback:** upstream PRNG source text (not needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (projects `engine` and `oracle`), fast-check 4.10.2, Playwright 1.63.0 (projects `chromium-utc`, `chromium-ny`, default viewport 1280 x 900) |
| Config file | `vitest.config.mts`, `playwright.config.ts` |
| Quick run command | `npx cross-env CCRUG_TZ=UTC vitest run engine/test/naming` and `npx cross-env CCRUG_TZ=UTC vitest run tests/app/panelStack tests/app/names` |
| Full suite command | `MSYS_NO_PATHCONV=1 npm run verify` (about 7 minutes per STATE Phase 6) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAM-01 | PRNG vectors; Feistel bijective for sizes <= 2^20 exhaustive; sounds distinct (exhaustive to 434,227 zones, left-inverse parse sampled to 2^26 - 1); prefix stability across bases; locks survive reroll/seed/style (fast-check); spare stream keeps typed and generated distinct; max letters <= 16 from bank data at 2^26 | unit | `vitest run engine/test/naming.prng.test.ts engine/test/naming.generate.test.ts` | Wave 0 |
| NAM-01 | Zone list at base 4000 mounts under 80 rows, Go to zone reaches 3999, Reroll keeps locked rows, lock `aria-pressed` | e2e | `npx playwright test e2e/names-panel.spec.ts` | Wave 0 |
| NAM-02 | hi-lo/lo-hi, capitalisation, layering (override > preset > derived), mesh keys equal `meshOf`, O(1) lookup equals brute force at 28 and 666, euphony properties and vector table | unit | `vitest run engine/test/naming.derive.test.ts engine/test/naming.euphony.test.ts` | Wave 0 |
| NAM-02 | Browser name column at base 28, 666, 4002 (seed-only), tooltip text, rename then reset, other demons unchanged | e2e | `npx playwright test e2e/demons-browser.spec.ts e2e/names-panel.spec.ts` | rewrite + Wave 0 |
| NAM-03 | Validator vectors (wrong base, unknown keys, caps, reasons, `__proto__`, deep nesting, seed-only refusal); export -> import identity property; certificate equals scan (differential); scanner equals brute force n <= 300 incl. non-ASCII; exhaustive 0 collisions at 666 and 1024 (4000 in verify) | unit | `vitest run engine/test/naming.schema.test.ts engine/test/naming.collisions.test.ts` | Wave 0 |
| NAM-03 | `names=` codec round trip (fast-check) and hostile inputs; `labels=sounds`; worker guard accepts `sounds` | unit | `vitest run tests/app/shareParams tests/app/workerCore` | extend |
| NAM-03 | Preview notice, Keep/Back, autosave slot, import wrong base, collision jump opens inline editor, undo order | e2e | `npx playwright test e2e/names-io.spec.ts e2e/names-preview.spec.ts` | Wave 0 |
| NAM-04 | Preset adapter equals `ZONE_PARTICLE` and `DEMON_NAMES` by reference; base 10 default shows the 45 canonical names (existing e2e); not applied at other bases | unit + e2e | `vitest run tests/presets` and the existing demons specs | extend |
| Stack (todo 008) | Pure stack identity vs old formula; follow; moved; names x; drag seed; z cap | unit + e2e | `vitest run tests/app/panelStack.test.ts`; `npx playwright test e2e/panel-stack.spec.ts e2e/region-legend.spec.ts` | Wave 0 |
| Sounds label | fit function (worked example 6.3 px vs 12.3 px, grapheme-safe cut, m < 2 case); Canvas static and overlay passes emit identical `fillText` | unit | `vitest run tests/app/soundLabels.test.ts tests/app/canvasDraw.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** the quick commands for the touched module.
- **Per wave merge:** `npm run typecheck`, `npm run check:repo`, `npm test` and `npm run test:tz`; after any `NumogramClient`/`usePanelDrag`/`shareParams` edit also `npm run test:swap`.
- **Phase gate:** `MSYS_NO_PATHCONV=1 npm run verify` green, then `/gsd-verify-work 7`.
- **Sampling bases:** 2, 4, 10, 12, 28, 64, 202, 666, 1024, 4000, 4002, 65536, 2^26. Exhaustive checks (distinct sounds, collisions, bijection) at <= 1024 and one 4000 raw scan (about 2 s) inside `verify`; lazy sampling (`soundAt`, `nameOf`, left-inverse parse) at 4002, 65536 and 2^26 - 1; e2e at 10, 28, 64 (SVG), 666 (Canvas), 4000 and 4002 (seed-only).

### Frozen vectors and mutation checks
- Pin inline (no new manifest, like `layout.digest.test.ts`): the Appendix B PRNG table, key and permutation vectors, euphony vectors, and, after the contact-sheet sign-off, sha256 digests of the sound tables per style at fixed seeds and bases.
- Per-plan mutants to run and report (precedent: Phase 5 and 6): Feistel rounds 8 -> 7; key-schedule separator changed; discard count 12 -> 11; leaf/internal swapped; prefix check using `>=` vs `>`; join order swapped; `upperFirst` removed; override key off by one (mesh vs `a * b`); `smooth` triple-collapse reintroduced; stack chain `y += h + GAP`; z cap 69 -> 79; validator cap removed; `__proto__` allowed.

### Wave 0 Gaps
- [ ] `engine/test/naming.{prng,feistel,generate,text,euphony,derive,collisions,schema,vectors}.test.ts`
- [ ] `tests/app/{panelStack,shareParamsNames,namingSession,namingStorage,soundLabels,cyberControlsMarkup,namesPanelRender}.test.ts`
- [ ] `e2e/{names-panel,names-io,names-preview,names-labels,panel-stack}.spec.ts`
- Framework install: none.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts, no server |
| V3 Session Management | no | none |
| V4 Access Control | no | single-user static app |
| V5 Input Validation | yes | hand-written validator, anchored linear regexes, NFC, caps (bytes, overrides, lengths), digit-only keys, lenient URL parsing |
| V6 Cryptography | no | no secrets; `crypto.getRandomValues` only picks a Reroll seed, the PRNG is not a security primitive |
| V8 Data Protection / client storage | yes | localStorage slots are untrusted input and non-secret; try/catch, quota handling |
| V12 Files and Resources | yes | `File.size` cap before reading, type hint only, value cleared after each attempt, no drag and drop |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via imported override keys | Tampering | `Map`, `^(0\|[1-9][0-9]{0,15})$` keys, tests with `__proto__`/`constructor` |
| Oversized or hostile JSON (size, 4M-deep nesting, 10 M overrides) | Denial of service | byte cap, override cap, non-recursive validation (V8 parses depth iteratively: 4,000,000 levels in 1.0 s) |
| Quadratic or unbounded collision work | Denial of service | certificate, data limit, cancellable slices, bounded group list |
| Bidi or format characters in names (trojan-source style spoofing) | Spoofing | letters-and-marks rule excludes `Cf` (RLO, ZWJ, ZWNJ); `dir="auto"` and `unicode-bidi: plaintext` in the UI |
| XSS through names or sounds | Tampering | React text nodes and Canvas `fillText` only; any future SVG export (Phase 8) must pass names through the existing `escapeXml` |
| Hostile URL seed (control characters, huge length) | Tampering | NFC, trim, 1 to 64 units, `\p{Cc}\p{Zl}\p{Zp}` rejected, lenient fallback |
| ReDoS | Denial of service | only simple anchored character-class regexes over bounded strings |
| Stale or foreign localStorage slot | Tampering | same validator, ignore on failure |

## Sources

### Primary (HIGH confidence)
- Repository code read and measured on 2026-10-20: `engine/core/demons.ts`, `engine/core/base.ts`, `engine/index.ts`, `app/lib/{demonBrowser,demonSearch,shareParams,labelScheme,tierBounds}.ts`, `app/lib/worker/{protocol,workerClient,buildResult,useNumogramWorker}.ts`, `app/hooks/{usePanelDrag,usePanelGroupLayout}.ts`, `app/components/ui/CyberPanel.tsx`, `app/components/info/InfoDisplay.tsx`, `app/components/demons/{DemonRowList,DemonsOverlay,DemonMatrix}.tsx`, `app/NumogramClient.tsx` (history, hydration, worker swap, panel effects), `app/presets/base10/lore.ts`, `scripts/check-repo.mjs`, `perf/page-weight.baseline.json`, `playwright.config.ts`, `vitest.config.mts`, `e2e/behaviour-collect.ts`, `e2e/behaviour.spec.ts`
- Experiments (scratch, deleted): Node 22.16.0 and Chromium 153.0.8010.12 runs of the PRNG, Feistel, generator, scanner, euphony and stack prototypes; a real-browser measurement of the built `out/` at three viewports
- [Intl.Segmenter, MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) (Baseline 2024)
- [Storage quotas and eviction, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) (5 MiB localStorage per origin, `QuotaExceededError`)

### Secondary (MEDIUM confidence)
- [bryc PRNGs.md](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (cyrb128/sfc32 origin; surfaced by search, could not be fetched from the sandbox)

### Tertiary (LOW confidence)
- [TC39 seeded-random proposal](https://tc39.es/proposal-seeded-random) (listed in search results only; Stage 1, not relied on)

## Appendix A: Draft syllable banks (verified prefix-free, a-z only; need sign-off)

All three banks were verified by script: whole alphabet prefix-free, letters a-z only, role split by letter class. Sample sheets (seed `hollow-vector`, depth 1 zones 0 to 11, 8-round Feistel):

- **harsh** `tp kn xkr rnk zh sn lb ls mg ch skr zdr`; zone 72 `zgolb`, 100 `sdoxz`, 4000 `zrodt`, 2^20 `zdoblexdextr`, 2^26-1 `blesdegroxkeld`. Natural vowels `o`, `e` only (the fill vowels `a u i` never occur naturally, which makes smoothing provably injective on it).
  INTERNAL (80): `sko ske sto ste tko tke kto kte dgo dge gdo gde zdo zde zgo zge xko xke rko rke lko lke nko nke mpo mpe bro bre kro kre tro tre dro dre gro gre pro pre blo ble klo kle plo ple glo gle zro zre xto xte spo spe sbo sbe sdo sde sgo sge zto zte zbo zbe xpo xpe xbo xbe xdo xde pto pte kpo kpe bdo bde rto rte rdo rde lto lte`
  LEAF (67): `skr skl str spl zgr zdr xkr ktt tch mnm nch rkt lkt mpt ngr tkt dgd pkt nmn zbr xtr rnk bgb lgr dt zx pb tn tp bp bt bk nt nd rg ld sm sn zm zn kn gn dn ch th kh sh zh xz mb md mg tm dm km gm bn pn rb lb rm lm ln rp lp rs ls`
- **soft** `bao tou dua gou tai bea gue dai tao kei dio pio`; zone 72 `jekei`, 100 `fegao`, 4000 `yupae`, 2^26-1 `rufavevopua`.
  INTERNAL (60): `la le li lo lu ma me mi mo mu na ne ni no nu ra re ri ro ru sa se si so su va ve vi vo vu fa fe fi fo fu ha he hi ho hu wa we wi wo wu ya ye yi yo yu ja je ji jo ju za ze zi zo zu`
  LEAF (66): `d`, `b`, `g`, `t`, `k`, `p` each followed by `ia io ua ue ai ei ou ae ao oi ea`
- **syllabic** `zos kin tus tas cun lon jar mor dar fan rer jus`; zone 72 `cen`, 100 `citur`, 4000 `pofas`, 2^26-1 `zenazaruver`.
  INTERNAL (64): `ka ke ko ku te ti to pa pe po pu na ni no ma me mi mu ra ri ro ru le li lu sa se so su de di do ba be bo bu ga gi go za ze zi zu va vi vo vu fe fi fu ha he ho hu je ji jo wa we wo wu ca ci co`
  LEAF (78): stems `ki ta tu pi ne nu mo re la lo si da du bi ge gu zo ve fa fo hi ja ju wi ce cu` (CV pairs not used by the internal set; construction rule: for coda in [`n`, `r`, `s`], for stem in the 26 stems, stem + coda)

Eight of the nine consonant-only CCRU originals appear verbatim as harsh leaves (`skr ktt tch mnm dt zx pb tn`; `gl` is used as an internal stem, because a leaf `gl` would be a prefix of `glo`), so a generated base-10 harsh table can literally contain original sounds.

Shape statistics against the originals: CCRU zone sounds 1 to 9: all consonant, lengths 2 to 3 (mean 2.44), consonant runs 2 (5) and 3 (4), doubled letter 11%; canonical names: length 4 to 9 (mean 6.87), vowel density 40%, doubled letter 73%, runs 1 (80), 2 (39), 3 (9). Harsh sounds at n <= 64: all consonant, length 2 to 3 (mean 2.36), runs 2 (41) and 3 (23), doubled 2%; at n = 666 mean length 5.06, vowel density 18%, max run 3; harsh joined names (400 samples) mean 9.34 letters, vowel density 16%. Soft: vowel density 62%, syllabic 40%, max consonant run 1 (sounds) and 2 (names). Tuning levers: add doubled-letter leaves (`ktt`, `pdd`, `mnn`) to raise the 2% toward the originals' 11%, and raise harsh vowel density if readability matters.

## Appendix B: Frozen vectors (reference implementation values)

**`sfc32-cyrb128@1`:** state words from `cyrb128(seed)`, then the first eight `next32()` outputs, hex.

| Seed | cyrb128 state | first 8 outputs |
|------|---------------|-----------------|
| `` (empty) | 027ae52e cfc79621 5593990d 4b41437c | 1d83becb 1d121adc 8614b7f1 efa8f54c 2d290131 c67d7b76 fb901d39 4664774c |
| `a` | 5eb8e4e4 08dee167 8f5f05b9 58089485 | bfa05ad0 6b3a561e 8fbf28cf d10e162c 2481f0f5 6658f5bd 26f3ffa5 8094e87e |
| `abc` | 4664cddf 317f7918 ec487c9f 600d8b09 | d7f1d200 e001b345 7a22e639 7c85cc5a 52d1df11 062a71f1 43796733 8bd660c1 |
| `hollow-vector` | 7c174536 cea872f3 fa03b141 9e6804ac | e927bcd5 375866c0 054b1825 21c7de16 c8e526ee 7878aefe 1f0d3a3c 4e17e868 |
| `CCRU` | 63ecd27e 3a6b0d60 ada3b9b4 e2b2c849 | 810aa827 37ea8884 7222f170 81193981 318c069b 64683718 ae14635d 65cb76a4 |
| `ccrug` | f240cb49 ba9dc081 e972fc8c 9cc03bd4 | 499ec79e 8c8bab22 86ec4757 00810bae fd8d264c 955cf9a9 817cbaf1 102955ce |
| `0` | f74d4ea5 48cf1fef e93e0417 5f3557ce | 9f51c662 db4ef4fe c7336adf 303ec9a1 b37ac271 b89b2114 aef7282d f9532416 |
| `Ünï` (NFC) | 841294c2 b5e0c531 175efdbf 1609b627 | 4ffd101a 9e1ad732 2f2952ac 6420d70f 5cd86310 46444d7d 0f1b058a 470ef409 |
| U+1D518 (surrogate pair) | 32eafad8 3ebb752e 128c276f 15d44204 | 877ab20a fb65cd80 dcd7765a 0d01c198 f495743a 190f154f ad8206a2 17fdda04 |
| `e` + U+0301 (NFD) | 5ce6a22a 293a9fe8 5c831e91 f1aefe67 | 77d04079 5b791428 cc45b335 ba5aa9b3 65eba8ac b32350b9 d12e29aa c5832d24 |
| U+00E9 (NFC) | 60a2461a d24f6f4c 1c407605 00550ed8 | 3346c43e d0bf7e01 91ccc1c4 c1181570 0188fbe7 d259e07d 8bf1c6c8 a385bf25 |
| `x` repeated 1000 times | 06349e2a 6ee1ec12 7eb9d9ef 88c4f76e | fddb81aa 6c243dba 179e04b0 72199adb 36dbebbd 562ead72 bb3344e8 120a8511 |

**Key schedule (8 rounds, 12 discarded):** `keys("hollow-vector", harsh, depth 1)` = state `4ffa4a1b 54f37863 5c3e51f8 456f970d`, keys `d6d3f5fe 1b41a505 2e105384 58ff1b97 2f8c6cc0 9cf08eec 21d235d3 791a4d47`; depth 2 = state `213ad9ce 74f674c8 47fc89e3 3a6b83fa`, keys `813fe7b0 d8b12f23 e4c03d17 31f84efd ad9e465e 84166ffb 1c23b449 2d4dab74`; `("ccrug", soft, 1)` keys `9de1c39d d95dca18 9bbe7ccc a1da4e22 c0e3c043 144b9ac9 7a6f4d03 788cee73`; `("", syllabic, 3)` keys `252d9466 89ff6840 ec58211f 13bff1f9 944de641 b438e64b 1b4af6d4 da19bd38`.

**Permutation vectors (the permutation does not depend on the banks, so these sizes stay valid even though the draft banks now use 67, 5,360, ...; keys of `("hollow-vector", harsh, 1)`; inputs 0..11 then size - 1):** size 67 -> `28 40 6 21 47 37 59 66 51 43 0 5 50`; size 72 -> `28 40 6 21 47 37 59 66 51 43 0 69 20`; size 5360 -> `5052 3692 3789 5325 2485 3870 4860 1281 4029 1125 2840 4461 3669`; size 405000 -> `378295 324245 222052 266053 140326 220745 194502 216170 272240 84336 248131 320662 47546`; size 2278125000 -> `1925003766 1535761927 468969094 177878602 194569490 911573022 678072854 1352240051 1957881230 1998369582 297292292 880600972 1965057988`.

**euphony@1 vectors (raw join -> smoothed, before the capital):** `tnmnm -> tnamnam`; `kttdt -> ktatdit`; `skrzx -> skurzax`; `pbzx -> pbuzxi`; `mnmdt -> mnamdit`; `gleiaoung -> gleiaoungu`; `eiaounggl -> eiaoungugla`; `zxskr -> zxiskur`; `dtktt -> dtaktat`; `zxpb -> zxipbu`; `dtmnm -> dtamnam`; `mnmtn -> mnamtan`; non-ASCII or spaced names unchanged (`abc-def`, `ñandú`, `Ωμέγα`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nothing added; versions read from `node_modules`)
- Architecture (engine): HIGH (prototyped, exhaustively checked, cross-checked against independent implementations and a second runtime)
- Architecture (app integration, panel stack): MEDIUM (code read and the stack function validated against a real measurement, but not built into `NumogramClient`)
- Style banks: MEDIUM-LOW (structurally verified, aesthetically unsigned)
- Pitfalls: HIGH (each was observed in code or in an experiment)

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (the repo is the moving part; re-read `usePanelDrag`, `shareParams` and `protocol.ts` if Phase 8 lands first)

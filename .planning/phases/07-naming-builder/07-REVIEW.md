---
phase: 07-naming-builder
reviewed: 2026-11-15T19:00:00Z
depth: deep
files_reviewed: 55
files_reviewed_list:
  - app/NumogramClient.tsx
  - app/components/demons/DemonBrowser.tsx
  - app/components/demons/DemonMatrix.tsx
  - app/components/demons/DemonRowList.tsx
  - app/components/demons/DemonsOverlay.tsx
  - app/components/info/InfoDisplay.tsx
  - app/components/info/PinnedBackground.tsx
  - app/components/names/CollisionReport.tsx
  - app/components/names/DemonNameEditor.tsx
  - app/components/names/NamesPanel.tsx
  - app/components/names/NamingContext.tsx
  - app/components/names/ZoneList.tsx
  - app/components/numogram/BasePicker.tsx
  - app/components/numogram/LabelSchemeControls.tsx
  - app/components/numogram/NumogramIcons.tsx
  - app/components/numogram/ShortcutsModal.tsx
  - app/components/panels/LabelsPanel.tsx
  - app/components/projection/Projection.tsx
  - app/components/ui/CyberButton.tsx
  - app/components/ui/CyberCheckbox.tsx
  - app/components/ui/CyberPageHeader.tsx
  - app/components/ui/CyberRadio.tsx
  - app/globals.css
  - app/hooks/usePanelDrag.ts
  - app/lib/canvas/diagramModel.ts
  - app/lib/canvas/keyboardModel.ts
  - app/lib/collisionSchedule.ts
  - app/lib/demonSearch.ts
  - app/lib/historyHydration.ts
  - app/lib/labelScheme.ts
  - app/lib/namesLink.ts
  - app/lib/namingCopy.ts
  - app/lib/namingLimits.ts
  - app/lib/namingSession.ts
  - app/lib/namingStorage.ts
  - app/lib/panelDrag.ts
  - app/lib/panelStack.ts
  - app/lib/shareParams.ts
  - app/lib/soundLabels.ts
  - app/lib/worker/protocol.ts
  - app/lib/zoneListModel.ts
  - app/presets/base10/naming.ts
  - engine/index.ts
  - engine/naming/collisions.ts
  - engine/naming/derive.ts
  - engine/naming/edit.ts
  - engine/naming/euphony.ts
  - engine/naming/feistel.ts
  - engine/naming/generate.ts
  - engine/naming/index.ts
  - engine/naming/prng.ts
  - engine/naming/schema.ts
  - engine/naming/text.ts
  - engine/naming/types.ts
  - engine/naming/validate.ts
findings:
  critical: 0
  warning: 10
  info: 27
  total: 37
status: issues_found
---

# Phase 7: Code Review Report (merged from two deep reviews)

**Reviewed:** 2026-11-15
**Depth:** deep (cross-file), two parallel reviewers
**Files Reviewed:** 55
**Status:** issues_found

Reviewer A covered the pure side (engine/naming, app/lib, the CCRU preset adapter): WR-01..WR-04 and IN-01..IN-15.
Reviewer B covered the client side (NumogramClient wiring, the Names components, accessibility, baseline hygiene, the header): WR-05..WR-10 and
IN-16..IN-27 (ids shifted from B's own numbering; B's own "ASCII-only name search" finding duplicated WR-04 and was dropped).
Not in scope of this review: `app/components/canvas/CanvasDiagram.tsx`, `app/lib/canvas/draw.ts` and `viewTransform.ts` were being edited by the
Canvas paint-surface fix (commits e7071e8..d4213ca, verified by its own unit, e2e and mutation checks) while the review ran.

## Summary A: engine and libraries

**Reviewed:** 2026-11-15T12:00:00Z
**Depth:** deep (cross-file: engine/naming <-> app/lib <-> NumogramClient.tsx, NamesPanel.tsx, CollisionReport.tsx)
**Files Reviewed:** 31
**Status:** issues_found

## Summary

The engine side is in good shape. I could not break the generator, the certificate or the scan, and I tried: scratch scripts (kept
in the session scratchpad, nothing written to the repo) ran the following against the real engine code.

Verified clean, with the evidence:
- Feistel: bijection checked for 13 sizes (1, 2, 3, 4, 5, 7, 16, 17, 66, 67, 80, 3600, 5360). Cycle walking terminates for every in-domain
  input. The arithmetic stays exact: halves are at most 2^16 for the largest class (2.74e9), well below the 2^26 design bound.
- Banks: the union of internal and leaf syllables is prefix-free and duplicate-free in all three styles (0 violations). 600,000 sounds per
  style are pairwise distinct. The longest sound is 15 letters at limit-1 (harsh), so it always satisfies the 16-grapheme rule. soundAt
  throws RangeError at `limit`. Prefix stability holds (base 10 equals the first 10 of base 4000).
- Depth-boundary indexing in `soundAt` (`z >= offsets[depth]`) and the mixed-radix decode are correct; `generateSounds` spare bound
  (`spare < 2 * base`) holds by the injectivity argument.
- Certificate: `provablyUnique` has no counter-example in 12 style x smoothing x join combinations (brute force over all pairs at base 300).
  `smoothingInert` held on 44 random inert tables and on 300k soft and 300k syllabic sounds. `smoothName` is idempotent on 200k random
  strings.
- Collision report: 800 differential checks (certificate route, forced scan route via an empty preset layer, and brute force over all
  demons, with random overrides including overrides equal to other demons' derived names, typed prefix sounds and duplicate sounds, at
  bases 4 to 20, both joins, both smoothing values) found 0 mismatches in groups, demons, list order, size and the 16-mesh cap.
- Validator: `__proto__`, leading-zero keys, 2^53 keys, 1e21 smoothing, locks without zones, ZWJ/RLO/lone surrogate/combining-first in
  sounds, 2M-deep arrays and 500k-deep objects all produce typed refusals or a clean accept, and `Object.prototype` is not polluted.
  Numeric key parsing is exact because anything at or above `base(base-1)/2` is refused even where `Number()` loses precision.
- panelDrag: 20,000 random activations never exceed Z_CAP 69, keep 10 distinct z values, keep the activated panel on top and preserve the
  relative order of the others.
- Engine purity: no Date, Math.random, performance, Intl-locale API, process/window/document, or non-relative import in engine/naming.
  No lore import. The only bounded O(n^2) allocation is the documented collision scan (89 MB RSS measured at 4096).
- Locale: no argument-less `toLocaleString` in the listed files (all `en-US`); case mapping uses `toUpperCase`/`toLowerCase`
  (locale-independent, so no Turkish dotless-i problem).

Concerns: one real resource-exhaustion path in the text validator (WR-01), one determinism hole in seed handling (WR-02), one
echo-of-untrusted-text issue (WR-03), one functional gap in name search (WR-04), and a set of Info items.

## Summary B: client wiring, Names components, accessibility, baseline, header

**Reviewed:** 2026-11-15
**Depth:** deep (cross-file)
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Read in full: NumogramClient.tsx, all of `components/names/*`, DemonsOverlay, DemonBrowser, DemonRowList, DemonMatrix, InfoDisplay,
PinnedBackground, BasePicker, CyberPageHeader, usePanelDrag and the four `app/lib` naming/history/stack files. Projection,
LabelSchemeControls, LabelsPanel, ShortcutsModal, NumogramIcons, the three Cyber* controls and globals.css were reviewed through their
Phase 7 diff (`git diff 96b7c72..HEAD`). Cross-file context read: zoneListModel, namingLimits, namingCopy (parts), namesLink,
collisionSchedule, panelDrag, soundLabels, CyberPanel, CyberButton, engine/naming/text.ts, engine/naming/derive.ts, the 07-UI-SPEC.
`tsc --noEmit --noUnusedLocals --noUnusedParameters` reports nothing for any reviewed file.

No critical issues. No HTML sink exists anywhere in `app/` (no dangerouslySetInnerHTML, innerHTML, eval, new Function; the only `.href =` is
the export's own object URL). Every user text (names, sounds, seed, import messages, `names=`) reaches the DOM as a React text node, an
attribute value, or an input value; the CSS-selector interpolations (`[data-names-sound="${zone}"]`, `[data-collision-jump="${mesh}"]`)
only ever take integers, and the one name comparison (`getAttribute('data-collision-name') === back.name`) is a string compare, not a
selector. `names=` is length-capped, control-char-checked and passed through `normalizeSeed` before use; a localStorage slot goes through
the same `validateNamingJson` as an import and is base-checked. CyberButton/Radio/Checkbox `dataAttrs` are filtered to `data-*`.

**Requested verification of the history state machine (focus 1).** I traced the apply flag, `historyCurrentRef` and the adopt flag through:
a successful Undo/Redo (the flag is always consumed on the render it causes, because `applySnapshot` always installs new Set objects so
`snapshotState` always changes identity), a refused Undo/Redo (flag, ref and the other stack untouched: correct), the adopt flag at a bare
URL with a slot, at `?base=` and at `?names=` (consumed on the first render whose rev differs; the mount-time effect order hydration then
history is what makes this work), a worker swap (reset nulls `historyCurrentRef`, the next effect run takes the swap render as its new
start, and the apply flag cannot be pending across a worker message because a discrete event flushes its render and effects first),
Keep (one entry, undo restores the old slot naming and autosave rewrites it), Back (same rev, no entry), a base switch while a slot write
is pending (`flushPendingSave` runs inside `resetForBaseSwitch` before the next slot is read and writes under the naming's own base), and
StrictMode double effects (guarded by `urlHydratedRef` / `historyReadyRef`, and the adopt check needs a rev difference). I found no
hole in the 18c8f57 / 4bf1fce fixes. The two remaining history problems are WR-05 and WR-10 below; they are about what an entry means, not
about the flags.

Baseline hygiene (focus 5): for non-sounds modes the SVG markup in Projection.tsx is unchanged (the numeral `<text>` is the same element
with the same attribute order, now guarded by `showNumber && sound === null`; `zoneAriaLabel` takes the old string; both new props
default to null/undefined and `NumogramClient` passes null/undefined outside sounds mode). New DOM carries `data-post-baseline` on its
root (Names panel via the CyberPanel prop, NamesPanel root, header tag, collision root, name editor root, override marker, selection-more
line, the BasePicker dropdown and collapsed control). The only unmarked new nodes are the sounds-mode `<text data-sound-label>` elements
(only drawn in a mode the baseline never visits) and the "Sounds" radio, which lives inside the marked BasePicker dropdown. The Share
button's `title` is byte-identical until an uncarried edit exists. I found nothing that would move the 60 DOM goldens or the behaviour
baseline.

## Warnings

### WR-01: Over-long all-letter strings make the validator materialize every grapheme (about 5 s freeze, about 100 MB)

**File:** `engine/naming/text.ts:48-58` and `:66` (reached from `engine/naming/validate.ts:266` and `:302`)
**Issue:** `checkLetters` runs `LETTERS_AND_MARKS` first (linear, passes for an all-letter string) and only then, for
`t.length > max`, calls `graphemeCount(t)`, which is `Array.from(seg.segment(text), part => part.segment).length`. For an all-letter
string that builds one object per grapheme before comparing the count with 16. The module comment says this "runs only for the rare
string longer than the limit", but a hostile or accidental file makes it the common path. Measured in Node 22 on the real code:
`validateSound('a'.repeat(n))` takes 84 ms (n=1e5), 637 ms (1e6), 2533 ms (4e6) and 4998 ms (8e6, heap +105 MB). A 8,000,272-char
names file with one such zone sound takes 5097 ms through `validateNamingJson` (cap check passes, file.size is under 8 MiB). The same
path runs for override names (`validate.ts:302`) and on the main thread when `readSlot` validates a tampered same-origin slot at page
load or on every base switch (up to about 5M chars in a localStorage slot, about 3 s each time). The cap protects memory, not time.
**Fix:** count with an early exit instead of materializing:
```ts
function exceedsGraphemes(text: string, max: number): boolean {
  const seg = graphemeSegmenter()
  let n = 0
  if (seg !== null) {
    for (const _part of seg.segment(text)) if (++n > max) return true
    return false
  }
  const re = new RegExp(MARK_CLUSTER.source, 'gu')
  while (re.exec(text) !== null) if (++n > max) return true
  return false
}
// in checkLetters:
if (t.length > max && exceedsGraphemes(t, max)) return { ok: false, reason: 'long' }
```
(`graphemeCount`/`splitGraphemes` stay for the callers that need the real count; `soundLabels.fitSoundLabel` only ever sees validated
sounds.) Optionally also refuse early when `t.length` exceeds, say, 8 * max, since no real sound is that long in code units.

### WR-02: A seed with a lone surrogate is accepted but does not survive a `names=` link, so the link reproduces different names

**File:** `engine/naming/text.ts:28` and `:84-89` (normalizeSeed); reached from `engine/naming/validate.ts:209-211`, `app/lib/namesLink.ts:86`
**Issue:** `SEED_FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u` does not match a lone surrogate, so `normalizeSeed('a\ud800')` returns `'a\ud800'`
(verified). The import validator accepts `"seed":"\ud800"` (valid JSON), and a typed or pasted seed can also contain one. The share
link is built with `params.set('names', 'seed:' + seed)`; `URLSearchParams` serialises a lone surrogate as `%EF%BF%BD` (verified:
`names=seed%3Aa%EF%BF%BD`), and parsing gives `'a�'`, which hashes differently in `cyrb128` (it hashes UTF-16 units), so the
recipient gets different sounds than the sender. This breaks the stated D-04/D-13 guarantee ("a shared seed link reproduces the same
names") and the `parse(build(state)) === state` round-trip for that input.
**Fix:** refuse lone surrogates in seeds. `\p{Cs}` matches a lone surrogate and not a valid pair (verified: true for `'a\ud800'`,
false for `'a\u{1F600}'`):
```ts
const SEED_FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}\p{Cs}]/u
```
Mirror it in `namesLink.ts` `HOSTILE` for symmetry. Valid existing seeds are unaffected, so `names-gen@1` stays frozen.

### WR-03: Untrusted text is echoed into status messages with bidi, format and control characters intact

**File:** `engine/naming/validate.ts:96-101` (`clip`), `:141-148`, `:180`, `:297`, `:344`; `app/lib/namingCopy.ts:253-259`, `:306`,
`:354`, `:399-401`; `engine/core/base.ts:17-19` (`clipEcho`)
**Issue:** The validator's header promises that "no control or format character enters a table (T-07-03c)", but file-supplied text
still reaches the UI verbatim in `bad-override-key` (the key), `unknown-version` (schema or generator suffix), the unknown-key list, and
the seed in `generated(base, seed)`. `clip` and `clipEcho` only bound the length. React escapes markup, so there is no XSS, but a file
with the override key `"‮" + ...` makes the sentence `Override key "<RLO>..." is not a demon of base 10.` render reversed from the
RLO onwards (verified: the issue is returned with the RLO intact), which lets a hostile file spoof the status line that tells the user
what to do next. `clipEcho` can also cut between the two halves of a surrogate pair. Seeds themselves may contain bidi controls and
isolates (`normalizeSeed` only forbids Cc/Zl/Zp; verified that `"seed":"‮evil"` imports), and the seed is shown in the seed field
and in the "Generated names ... from seed X" line.
**Fix:** sanitise at the echo boundary, for example in `clip` and in a copy-level helper used by `namingCopy`:
```ts
const UNSAFE_ECHO = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/gu
export const safeEcho = (s: string): string => s.replace(UNSAFE_ECHO, '�')
```
and consider also refusing bidi controls in seeds (`/[؜‎‏‪-‮⁦-⁩]/`), keeping ZWNJ/ZWJ legal for
Persian and Indic seeds.

### WR-04: Demon name search is ASCII-only although names may be in any script (D-07)

**File:** `app/lib/demonSearch.ts:30` and `:131-132` (and `parseLiveName`, `:77-93`)
**Issue:** `NAME_RE = /^[a-z]{1,32}$/i` gates the whole name branch. A derived or overridden name in Greek, Cyrillic, accented Latin,
CJK and so on (all valid sounds and names by D-07, and `deriveName` keeps them) can never be found: a query such as `Ωmega` fails the
regex, falls through to `{ kind: 'syntax' }`, and the user is told `Couldn't parse "Ωmega" - try a mesh number ... or an a::b pair`.
That is misleading for a name that exists. The case-insensitive compare is fine (`toLowerCase` is locale-independent) but both sides
should also be NFC, since overrides are NFC and a typed query may not be.
**Fix:**
```ts
const NAME_RE = /^[\p{L}\p{M}]{1,32}$/u
// parseLiveName:
const query = toNfc(text).toLowerCase()
const lower = toNfc(nameOf(a, b)).toLowerCase()
```
(`toNfc` is exported by the engine barrel.) The 50,000-demon cap stays as is.

### WR-05: The inline "Undo this change" button undoes the newest history entry of ANY kind, not the naming change it names

**File:** `app/components/names/NamesPanel.tsx:630-634`, `app/NumogramClient.tsx:1281-1284` (and `NamesPanel.tsx:481-489`, `statusFate`)
**Issue:** `NamesBody.onUndo` calls `nc.undo()`, which is `onUndoRef.current()`, i.e. `onUndo`, which pops the top of `undoStack`
unconditionally. The status (and its button) stays until the naming revision changes (`statusFate`), but every non-naming change also
pushes a history entry (selection, layers, layout, labels, region filter... all are in `HistorySnapshot`). Scenario: press Reroll
(status "Generated ... " plus "Undo this change"), then click a zone on the diagram or toggle a layer (one history entry; `nc.rev` is
unchanged so the status stays), then press "Undo this change": the layer toggle or selection is undone and the names stay rerolled. The
button's label promises the opposite, and the 07-UI-SPEC rule ("calls the app's own onUndo") is what creates the trap.
**Fix:** make the inline undo a naming-only undo. For example in NumogramClient keep a ref of the undo stack and refuse when the top entry
is not a naming change; report the refusal so the panel can drop the stale status:
```tsx
const undoStackRef = useRef(undoStack); undoStackRef.current = undoStack
const undoNaming = useCallback((): boolean => {
  const top = undoStackRef.current[undoStackRef.current.length - 1]
  if (top === undefined || top.namingRev === snapshotNaming(sessionRef.current).rev) return false // newest entry is not a names change
  onUndoRef.current()
  return true
}, [])
```
Change `NamingContextValue.undo` to `(): boolean` and in `NamesBody.onUndo` clear the status either way (`nc.undo(); setStatus(null); setStatusRev(null)`).
A simpler alternative is to also clear the status whenever the history depth changes (pass `undoDepth` through the context).

### WR-06: The virtualized zone list unmounts the focused row when it scrolls out of the window, orphaning the draft and dropping focus to the page

**File:** `app/components/names/ZoneList.tsx:237-244` (no `rangeExtractor`), draft state at `:228-233`, commit only via `onBlur` at `:405-407`
**Issue:** The window is `visible rows +/- 8`. If the visitor types in a sound field and then wheel-scrolls (or drags the scrollbar) more than
about 8 rows, React unmounts the focused `<input>`. Focus falls to `<body>`, so the global shortcuts (A/S/D/F layout keys, Z/X/C/V in
planetary, digits 0-9 at base 10, Ctrl+Z app undo) are live while the visitor believes they are still typing. Whether the browser also
dispatches `blur` for the removed element differs by browser (speculative); where it does not (Firefox, Safari), the draft stays in
`state.drafts` forever uncommitted: it reappears when the row scrolls back, with no marker that it was never saved, and is lost when the
panel collapses. `moveTo`/`focusRow` already take care to render the target row first, so only mouse/wheel scrolling is affected.
**Fix:** keep the active row in the rendered range while a field of it has focus:
```tsx
const focusedRow = useRef<number | null>(null) // set in onFocus, cleared in onBlur after commitRow
const virtualizer = virtual.useVirtualizer({
  // ...existing options
  rangeExtractor: range => {
    const rows = virtual.defaultRangeExtractor(range)
    const f = focusedRow.current
    return f !== null && !rows.includes(f) ? [...rows, f].sort((a, b) => a - b) : rows
  },
})
```
(`top={item.start - rowsOffset}` positions rows individually, so a non-contiguous range renders correctly.)

### WR-07: The seed field commits and reverts during IME composition

**File:** `app/components/names/NamesPanel.tsx:514-523`
**Issue:** `onSeedKeyDown` handles `Enter` (commit plus `preventDefault`) and `Escape` (revert the draft) with no composition guard, unlike
`ZoneList.tsx:370-373`, `ZoneList.tsx:421-423` and `DemonNameEditor.tsx:378-380`, which all skip `isComposing` / `keyCode 229`. A seed may
be any text without control characters (`engine/naming/text.ts:84-89`), so a Chinese/Japanese/Korean visitor naturally types one with an
IME. Pressing Enter to confirm a candidate in Chrome (keydown has `isComposing === true`) runs `commitSeed()` on the half-composed draft
and `preventDefault()` can suppress the IME's own confirmation; Escape discards the composition text and the draft.
**Fix:**
```tsx
function onSeedKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
  if (e.key === 'Enter') { ... } else if (e.key === 'Escape') { ... }
}
```
Also give the field `dir="auto"` like the sound and name fields (an RTL seed currently renders left-aligned).

### WR-08: The single live carrier never re-announces an identical string, so repeated Undo, Export or Share are silent for screen readers

**File:** `app/NumogramClient.tsx:458`, `:504`, `:1280`, `:1519`; `app/components/names/NamesPanel.tsx:290-292`
**Issue:** Every announcement is `setNamesAnnouncement(text)` into one `role="status"` node, and nothing clears or varies it between
announcements. Setting the same string again does not change the DOM, so assistive technology says nothing. Concrete cases from the code:
two consecutive Ctrl/Cmd+Z undos that both restore a naming set `NAMES_COPY.restored` twice (the second is silent); a second Export in
the same base (`exportSuccess(base)` is identical); a second press of Share with uncarried edits (`shareTitleUncarried`); a second
Show-repeated-names jump in preview (`previewJump`); repeated blur of the same invalid zone draft (arguably good). A second, related
race: the collision job's `announce("N repeated names.")` lands a task after the action's own `say(...)` and replaces it in the same
node, so a quick reader may only hear the later one (speculative; depends on the screen reader queueing).
**Fix:** announce through a value that always changes, for example keep `{ text, nonce }` in state and render `<span key={nonce}>{text}</span>`
inside the carrier, or clear then set (`setNamesAnnouncement(''); requestAnimationFrame(() => setNamesAnnouncement(text))`). Keep the one
carrier; just make each call a DOM change.

### WR-09: The Base picker dropdown is not clamped to the viewport; after the header change it extends off-screen on phones

**File:** `app/components/numogram/BasePicker.tsx:120-124` (position), `:176-180` (`fixed ... w-[340px]`, `left: pos.left`); context `app/components/ui/CyberPageHeader.tsx:49`
**Issue:** `openDropdown` stores `rect.left` of the collapsed control and the portal is a fixed 340 px box at that left with no clamp.
Since commit 1425bd4 the brand block is held at min 88 px, so on a phone the picker starts at about x = 8 (gutter) + 88 (brand) + 8 (gap) + 7
(border and padding) = about 111 px. On a 375 px screen the dropdown's right edge is then about 451 px: roughly 76 px is off-screen,
including the right end of the slider, the right part of the label-scheme radios (Custom, Sounds) and the right end of the notable-base
chip strip. A fixed element cannot be scrolled into view, so those controls are unreachable (the numeral can still be typed). Before the
commit the squeezed brand put the picker near x = 45, i.e. about 10 px over, so the commit made an existing weakness reachable. Numbers
are derived from the flex rules, not measured in a browser.
**Fix:** clamp in `openDropdown`:
```tsx
const DROPDOWN_W = 340, EDGE = 8
const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - DROPDOWN_W - EDGE))
setPos({ left, top: rect.bottom + 4 })
```
and use `w-[min(340px,calc(100vw-16px))]` so a 320 px screen still fits.

### WR-10: Naming edits made while the planetary orbit animation runs get no undo entry (and their inline Undo button then undoes something else)

**File:** `app/NumogramClient.tsx:1212-1215`
**Issue:** The history effect returns early with `if (orbiting) { historyCurrentRef.current = currentSnapshot; return }` before it can push.
That branch is correct for the animation's per-frame `planetDate` changes, but it also swallows any naming change (a sound, a lock, a
reroll, an import, a rename) committed while `orbiting` is true: the new snapshot becomes `historyCurrentRef` and no entry is pushed or Redo
cleared. Autosave still writes the edit, so the work persists but cannot be undone, and WR-05's inline button then undoes an older, unrelated
entry. Scenario: planetary layout, orbit on (Z), open Names, Reroll.
**Fix:** let a naming revision change through the orbiting gate:
```ts
if (orbiting && previousSnapshot.namingRev === currentSnapshot.namingRev) {
  historyCurrentRef.current = currentSnapshot
  return
}
```
(The pushed entry then also carries the orbit's moving fields; restoring it rewinds `planetDate`, which is acceptable, or strip those
fields from the pushed snapshot while orbiting.)

## Info

### IN-01: `feistelPermutation(size, keys)(x)` hangs for some x outside [0, size) (public export, unguarded hot path)

**File:** `engine/naming/feistel.ts:65-70` (exported at `engine/naming/index.ts:6`)
**Issue:** The returned function does `do { x = feistel(x) } while (x >= size)`. For x already outside the domain the cycle through x
may never contain an element below `size`, so the loop never ends. Reproduced with a copy of the round function: starts in
[size, 2^bits) that never return: 1 for size 3, 5 for size 5, 4 for size 67, 1 for size 5360. In-repo callers cannot trigger it
(`soundAt` checks `checkIndex` and the class offset arithmetic stays in range), so this is a public-API trap, not a live bug.
**Fix:** one comparison costs nothing next to 8 rounds: `if (!(x >= 0 && x < size)) throw new RangeError('x outside [0, size)')`, or
drop the function from the barrel and keep it module-private.

### IN-02: Collision scan can run 70 to 280 ms without consulting `shouldYield` (the walk phase yields only between partitions)

**File:** `engine/naming/collisions.ts:336-350`, `:353-369`, `:385-390`
**Issue:** Partitions are keyed by the first UTF-16 unit of the final name. `checkPartition` sorts the whole partition and verifies every
hash run with no yield inside. When many names share a first letter the partition is huge. Measured at the app's own limit (base 1024,
523,776 demons) with `shouldYield` always true: generated harsh table forced through the scan, longest uninterruptible step 10 ms (fine);
typed table, all sounds start with `k`, not prefix-free, 69 ms; all sounds identical, 278 ms (single partition, single hash run of
523,776 names). Against `COLLISION_SLICE_MS = 8` this is a small jank, not a freeze. It scales about 16x at the engine's 4096 cap, which
the app never reaches (`NAMING_COLLISION_SCAN_MAX_N = 1024`).
**Fix:** make the walk resumable inside a partition: keep `{p, i}` in the closure after `slice.sort()` and call `shouldYield()` every
few thousand hash runs. The sort itself remains one call (about 50 ms at 523K entries).

### IN-03: An unreadable slot reads as "no slot", so the next autosave overwrites it with no backup

**File:** `app/lib/namingStorage.ts:36-47` (with `app/NumogramClient.tsx:943-954`)
**Issue:** `readSlot` returns `null` for every failure: absent, corrupt, over the cap, a newer `ccrug.naming/N`, a foreign object, another
base. After the first edit, autosave writes the new text over whatever was there. The key prefix is versioned (`ccrug.naming.v1.`), which
limits cross-version clobbering, so this only matters if a future build keeps `v1` while bumping the schema, or the slot was hand-edited
or truncated. It conflicts with the D-13 principle "nothing is ever lost silently".
**Fix:** return a tagged result (`{ kind: 'none' | 'invalid', text }`) and, on the first autosave over an `invalid` slot, copy the old
text to `slotKey(base) + '.unreadable'`. Cheap and keeps the data recoverable.

### IN-04: A failed flush write at a base switch is dropped silently

**File:** `app/NumogramClient.tsx:245-250` (call chain into `app/lib/namingStorage.ts:54-62`), `:499-503`
**Issue:** `flushPendingSave` calls `writeSlot(...)` and discards `'failed'`; `resetForBaseSwitch` then does `setNamesSaved('none')`. A
user whose last edit (made within the 400 ms debounce) cannot be stored (quota, blocked storage) gets no message, while the debounced path
does show `savedFailed`. Narrow window, but it is the one place the "failed" return of `writeSlot` is ignored.
**Fix:** on `'failed'` in the flush path set `namesAnnouncement` to `NAMES_COPY.savedFailed` after the reset (or keep `namesSaved` as
`'failed'` for the target base's panel).

### IN-05: The app's own pretty export can exceed the import size cap

**File:** `engine/naming/schema.ts:24`, `:27`, `:70`
**Issue:** `NAMING_MAX_OVERRIDES = 250000` and `NAMING_IMPORT_MAX_BYTES = 8 MiB` are checked independently, but the export is pretty-printed
(+6 chars per override). Measured: base 700, 244,650 overrides of 21 letters (under the count cap): compact text 7,968,201 chars (imports
fine in 233 ms), pretty text 9,439,683 chars, and `validateNamingJson` on that pretty export returns `too-large`. A backup the app
just wrote cannot be restored. It needs an import of a large compact file first (nobody renames 200k demons by hand), so the likelihood is
low.
**Fix:** in the export path fall back to compact when the pretty text would exceed the cap (`pretty.length > NAMING_IMPORT_MAX_BYTES`),
or document the pair of limits as one.

### IN-06: `applyNamingAction` claims "an edit that changes nothing returns the same session", but most engine edits return a new object

**File:** `app/lib/namingSession.ts:206-222` (doc) against `engine/naming/edit.ts:69-80`, `:87-101`, `:113-133`, `:140-152`
**Issue:** Only `setOverride` and `resetOverride` return their argument for a no-op. `editSound` with an unchanged, already locked sound,
`setJoin`/`setSmoothing`/`setStyle` with the current value, `setSeed` with the current seed, `setSource('generated')` on a generated
naming, `pasteSounds` with identical locked sounds, `use-seed` with a record equal to the current settings, and `import` of an equal
naming all yield `next !== s.working`, a new revision, `edited: true` (autosave) and a no-op undo entry. The panel avoids most of these
(native radios do not fire `onChange` on re-click; `soundCommitOf` and `seedCommitOf` return `unchanged`), so reachable cases today are
`use-seed`, `paste` and `import`.
**Fix:** guard the cheap ones in edit.ts (`if (n.join === join) return n`, same for smoothing and style-with-same-source) or add a
content-equality check in `applyNamingAction` (sounds by element, locks, overrides by size and reference) before bumping `rev`.

### IN-07: Toggling Sounds <-> digits at a Canvas base triggers a full worker rebuild

**File:** `app/lib/worker/protocol.ts:62-64` (with `app/NumogramClient.tsx:1032-1066`)
**Issue:** `resultKey` includes `labelSchemeKey(labels)`, which is `sounds` versus `digits`, but the worker's output is identical for both
(`zoneLabelsFor` returns numerals for both, `labelScheme.ts:52-56`; the sounds are drawn on the main thread from the naming). The label
toggle therefore changes `desiredKey`, sends a new build request for up to 4000 zones, and shows `Computing base N...` after the grace
period for no reason.
**Fix:** collapse the two modes in the key, but note the trap: `NumogramClient.tsx:1004` and `:1020` restore `labelScheme` from
`resp.labels`, so a collapsed key must come with a request that echoes the live scheme (or those two lines must compare modes with
sounds treated as digits), otherwise a stale `digits` response would flip the user's Sounds choice back.

### IN-08: `deriveName` is documented as NFC but is not NFC-stable after `upperFirst`

**File:** `engine/naming/derive.ts:30-33`, `engine/naming/text.ts:92-96`
**Issue:** `toNfc` is applied to the join, then `upperFirst` maps the first code point. For `'ΐ'` the result is U+0399 U+0308 U+0301, whose NFC
is U+03AA U+0301 (verified: `deriveName('ΐ','b','hi-lo',0) !== its own normalize('NFC')`). No functional bug today: overrides, the collision
paths and `setOverride`'s equality check all re-normalise. Anything that compares `nameOf` results as raw strings (a new consumer,
clipboard text) would see non-canonical text.
**Fix:** `return toNfc(upperFirst(...))` in `deriveName`, or state in the doc comment that the result is not normalised.

### IN-09: The seed limit counts UTF-16 units but the message says "characters"

**File:** `app/lib/namingCopy.ts:179-181`, `engine/naming/text.ts:84-86`
**Issue:** `seedError()` says `A seed needs 1 to 64 characters.`, but `normalizeSeed` limits UTF-16 units, so a 33-emoji seed is refused with
that message. The text.ts header documents the choice ("no segmenter on the URL path"), so this is copy accuracy only.
**Fix:** reword (`up to 64 UTF-16 units`) or count code points cheaply with `[...t].length` (still no segmenter) and keep the URL bound
consistent.

### IN-10: `banks.ts` still carries the DRAFT / unsigned header

**File:** `engine/naming/banks.ts:1-2`
**Issue:** The first lines say the banks are a DRAFT whose look "needs the user's contact-sheet sign-off (plan 07-06) ... so nothing here is
final until then". 07-06-SUMMARY records approval on 2026-11-09 and 30 pinned digests. The comment now contradicts `generate.ts` ("`@1` is
frozen") and could lead someone to edit a frozen bank.
**Fix:** replace with "Approved 2026-11-09 (plan 07-06); pinned by engine/test/naming.vectors.test.ts. A change here is a new generator id."

### IN-11: `NAMES_COPY.title` is unused; the panel title is hard-coded

**File:** `app/lib/namingCopy.ts:31`, `app/NumogramClient.tsx:2169` (`<Panel id="names" title="Names"`)
**Issue:** The copy module says "every visible string of the feature lives here once", but the one key with no `NAMES_COPY.` reference in app
code is `title` (a script over all 77 keys found no other unused key). The literal in the client can drift from it.
**Fix:** `title={NAMES_COPY.title}`.

### IN-12: Dead or unreachable pieces: the `meta` field and a guard after full validation

**File:** `engine/naming/validate.ts:311-326` and `:329`; `engine/naming/types.ts:25-28`
**Issue:** `Naming.meta` (title, notes) is read, validated for length only and round-tripped, but nothing in `app/` reads or sets it. No
control or bidi check is applied to it, which is harmless only while it is never displayed. Separately, `if (seed === null || ... ) return
refuse(NOT_A_NAMES_FILE)` at line 329 is unreachable once `issueCount === 0` (it exists to narrow types).
**Fix:** either document `meta` as carried-through-only and apply the same text rules if it is ever shown, or drop it from v1; restructure
the final narrowing with a typed accumulator so the unreachable refusal goes away.

### IN-13: panelStack guards accept negative or infinite heights and propagate NaN

**File:** `app/lib/panelStack.ts:43-50`, `:72`
**Issue:** `STACK_REPORTERS.every(id => heights[id])` is a truthiness test, so a negative or `Infinity` height passes (checked: heights of
`-500` put `zones` at y = -390; `Infinity` gives an infinite y for everything below). `namesX(NaN, vw)` and `namesBodyMax(y, NaN)` return
NaN. All inputs come from `getBoundingClientRect` and `window.innerWidth/innerHeight`, so none can occur today; this is defensive only.
**Fix:** `Number.isFinite(h) && h > 0` in the reporter guard, and `Number.isFinite` guards in `namesX` and `namesBodyMax` falling back to the
minimum.

### IN-14: `localeCompare` makes the canonical URL key order locale-dependent (pre-existing code)

**File:** `app/lib/shareParams.ts:154`, `:258`, `:293`, `:294`
**Issue:** Parameter keys and region ids are sorted with `localeCompare`, so the exact query string depends on the browser's locale
(collation of letters, case). The parse side is order-independent, so links still work; only the rebuilt text differs between users and the
"URL never drifts" equality (`lastSyncedQueryRef`) is per-session. Not introduced by Phase 7 (the new `names`, `nstyle`, `njoin`, `nsmooth`
keys are plain ASCII and sort the same in the common locales).
**Fix:** a code-unit comparator, `(a, b) => (a < b ? -1 : a > b ? 1 : 0)`, for keys that are ASCII by construction.

### IN-15: Small robustness and import-hygiene items

**File:** `app/lib/collisionSchedule.ts:49-59`; `engine/naming/derive.ts:101`; `app/lib/namingCopy.ts:7`, `app/lib/demonSearch.ts:3`
**Issue:** (a) `runSlicedJob.slice` has no try/catch around `job.step`, so an exception inside a slice (for example a failed typed-array
allocation) is an uncaught error in a MessageChannel handler: `onDone` never runs and the panel shows "Checking..." forever; add an
`onError` callback or let `CollisionReport.tsx` set an error state. Within the app limit (1024) the allocation is about 5 MB, so this is
theoretical. (b) `createNameResolver.soundOf` reads `dense[z] as string`, hiding a table whose length differs from `base` (a hand-built
`Naming`): the name becomes `"undefined..."` instead of a RangeError; `createCollisionJob` checks the length, the resolver does not.
(c) Both app files import `clipEcho` from `engine/core/base` directly because the engine barrel does not export it, bypassing the public
surface; export it from `engine/index.ts` or move the helper to `app/lib`. `clipEcho` also slices UTF-16 units and can leave half a
surrogate pair (see WR-03).
**Fix:** as stated per item.

### IN-16: `sessionRef.current` is also assigned during render, which can regress the ref under concurrent lanes (speculative, narrow)

**File:** `app/NumogramClient.tsx:230-231`
**Issue:** `commitSession` already updates the ref synchronously and is the only writer of the session state, so the render-time write
`sessionRef.current = namingSession` is redundant. In React 18 a render that does not yet include a lower-priority pending update
(a default-lane `setNamingSession` from an async import or a blur timer, followed by a discrete click that renders first) executes the
body with the OLD session and moves the ref backwards until the pending render lands; an action in that window reads the stale session and
can overwrite the import. The window is a few milliseconds, so this is low risk.
**Fix:** drop line 231 (keep `useRef(namingSession)` as the initial value). The other render-time latest-value refs (`shownRef`,
`pendingVisibleRef`, `onUndoRef`, `applyWorkerResponseRef`) only feed callbacks and are the usual pattern.

### IN-17: Any naming change re-reveals the current demon search hit, jumping the list and moving its keyboard cursor

**File:** `app/components/demons/DemonBrowser.tsx:40-49`
**Issue:** `outcome` is memoised on `nameOf` (`naming.resolver.nameOf`), which is a new function for every naming change, so `outcome` is a
new object, and the `useEffect(..., [outcome])` bumps `reveal`, which scrolls `DemonRowList` to the hit and calls `setActive`. Scenario: in
the Demons overlay search "12", pin another demon, rename it in the detail pane's editor: the list scrolls back to row 12 and the
cursor moves there.
**Fix:** only re-reveal when the query result changed, e.g. compare `outcome.kind === 'found' && outcome.index` to the last revealed
index in a ref, or keep `nameOf` out of the dependency list for non-name queries.

### IN-18: Clicking a row's lock right after typing a sound un-locks it

**File:** `app/components/names/ZoneList.tsx:163-176` with `:320-338` and `:405-407`
**Issue:** The mousedown on the lock button blurs the field, `commitRow` commits the sound and the engine auto-locks the zone, then the
click toggles the lock again, so the row ends unlocked. The helper line says "Editing a sound locks it", so this is a design edge, not a
defect against the spec, but "type, then press the padlock to keep it" is a natural gesture.
**Fix:** none required; optionally make the lock click a no-op when the same gesture's blur just committed that row (track
`lastCommittedZone` for one tick), or leave as documented.

### IN-19: An invalid seed draft stays on screen when the seed changes from outside

**File:** `app/components/names/NamesPanel.tsx:452-454` and `:492-499`
**Issue:** After an invalid commit `dirty` stays true, and the re-sync effect only runs while `!dirty`. If the visitor then moves focus away
and the seed changes through Undo (Ctrl+Z with focus outside the field), Keep or Back, the field keeps showing the old invalid text with
the red underline and error line while the real seed is different.
**Fix:** also reset `dirty`/`seedProblem` when `n.seed` changes and the field does not have focus
(`document.activeElement !== seedRef.current`).

### IN-20: The export revokes its object URL on a zero-delay timer (speculative browser dependence)

**File:** `app/components/names/NamesPanel.tsx:146-148`, `:153-161`
**Issue:** `defer` is `window.setTimeout(fn, 0)`. Chromium resolves the blob URL synchronously on `click()`, but some browsers start the
download after the handler returns, and a revoked URL cancels it (FileSaver.js uses a 40 s delay for this reason). The naming JSON can be
large (up to the 8 MiB import cap), which makes a late fetch more likely.
**Fix:** revoke after a few seconds (`window.setTimeout(fn, 10_000)`), or on `visibilitychange`.

### IN-21: The pending slot write is flushed on `pagehide` only

**File:** `app/NumogramClient.tsx:956-959`
**Issue:** On mobile browsers the page is often backgrounded and later killed without `pagehide`. An edit in the last 400 ms
(`NAMING_AUTOSAVE_DEBOUNCE_MS`) is then lost.
**Fix:** also flush on `document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushPendingSave())`.

### IN-22: User-visible Names strings that bypass `namingCopy.ts`, and a stale header comment

**File:** `app/components/names/NamesPanel.tsx:802` (`aria-label="Name preview"`), `app/components/names/ZoneList.tsx:45` (`LIST_ARIA_LABEL = 'Zone sounds'`), `app/components/names/NamesPanel.tsx:5-7`
**Issue:** The module header of `namingCopy.ts` says every visible string of the feature lives there once; these two accessible names are
typed in the components. The header comment of NamesPanel still says the zone list and collision report "are mounted here by plans
07-19 and 07-20; the panel is mounted in the viewer by plan 07-21", which is already done.
**Fix:** add `previewTableAria` and `zoneListAria` to `NAMES_COPY`; update the comment.

### IN-23: Duplicated helpers and constants

**File:** `app/components/ui/CyberButton.tsx:35`, `CyberCheckbox.tsx:19`, `CyberRadio.tsx:21` (identical `dataProps`); `app/components/names/CollisionReport.tsx:40` and `DemonNameEditor.tsx:35` (identical `TAGS`); `EYEBROW`/`HELPER`/`TARGET` class strings in NamesPanel, ZoneList, CollisionReport, DemonNameEditor; the `zoneLabel` fallback lambda in NamesPanel.tsx:639, ZoneList.tsx:215, CollisionReport.tsx:408, DemonNameEditor.tsx:272
**Issue:** The four zone-label lambdas disagree on whether they check `view.base === base` (only ZoneList does). Harmless today because the
view and the naming context both read the displayed base, but a future divergence would be fixed in one place only.
**Fix:** one `dataProps` in `app/components/ui/dataProps.ts`; one `NAME_STATE_TAGS` in `namingCopy.ts`; one `useZoneLabel()` hook in
`names/` that applies the base guard; one `namesStyles.ts` for the shared class strings.

### IN-24: Dead branches and a test-only prop in production components

**File:** `app/components/names/NamesPanel.tsx:294` and `:415-416` (the `open` prop of `NamesBody` is always true because the body is only mounted while open), `app/components/names/CollisionReport.tsx:326` (`if (!open) return` is therefore unreachable) and `:262` (`initialReport` exists only so tests can render on the server)
**Issue:** Dead code and a prop that only tests use.
**Fix:** drop `open` below `NamesPanel`; keep `initialReport` only if the server-render tests need it, marked as such.

### IN-25: Header: the brand description is effectively unreachable, and the fixed 480 px desktop header may cover the layout switcher below about 1300 px (estimated, not measured)

**File:** `app/components/ui/CyberPageHeader.tsx:49`, `:68`, `:86`; `app/NumogramClient.tsx:1398-1404`, `:1916-1923`
**Issue:** With the brand block `flex-1` at `min-w-[88px]` and the actions row shrunk to what is left, the brand gets its 88 px minimum
whenever the picker summary is long, and the logo (16) + gap (8) + wordmark (about 40) + padding/border (22) already use about 86 px, so the
`description` ("Decimal Labyrinth", "Base N") has about 0 px and its `gap-2` is wasted: it never shows at 480 px (desktop) and shows
truncated between 640 and 820 px. Second, the desktop header is a fixed 480 px at z 46 while the layout switcher is a centred 7-button
bar at z 40; the old 04-12 comment only claims no overlap at 1280 px, so between 821 and roughly 1300 px the header can sit over the
leftmost layout buttons (pre-existing, not changed by 1425bd4). At 320 px the picker's fixed `w-[5ch]` input (shrink-resistant) may also
overrun its container by a few px. All of this comes from CSS arithmetic, not a browser measurement.
**Fix:** drop the `description` prop or surface it as the brand's `title`; measure the layout switcher bar at 900, 1100 and 1280 px and
either narrow the header or move the switcher below the header at those widths.

### IN-26: A zone-list paste is split without a length bound

**File:** `app/components/names/ZoneList.tsx:348-354`, `app/lib/zoneListModel.ts:27-29`
**Issue:** `splitPaste(e.clipboardData.getData('text'))` splits the whole clipboard text; only `used <= base - zone` tokens are validated
afterwards, but a 100 MB paste is split and filtered into millions of tokens first. Linear, not exponential, so low severity.
**Fix:** slice first: `text.slice(0, (base) * (SOUND_FIELD_MAX_INPUT + 1))` before splitting.

### IN-27: NumogramClient.tsx keeps growing (2231 lines) and the naming plumbing is a natural extraction

**File:** `app/NumogramClient.tsx:225-250`, `:943-959`, `:1268-1311`
**Issue:** Phase 7 adds about 430 lines to an already very large component: the revision counter, session ref and commit, pending save
ref and flush, autosave and pagehide effects, `applyNaming/keepNaming/revertNaming/announceNaming/undoNaming`, the resolver and uncarried
memos and the context value.
**Fix:** move those into `useNamingSession({ base, pendingBase, pendingVisible, onUndo })` returning `{ session, commit, ctx, flush }`. It
also makes WR-05 and IN-16 local to one file.

---

_Reviewed: 2026-11-15_
_Reviewers: Claude (gsd-code-reviewer) x2_
_Depth: deep_

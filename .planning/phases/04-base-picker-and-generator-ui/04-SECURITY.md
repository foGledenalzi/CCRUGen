---
phase: 04-base-picker-and-generator-ui
audited: 2026-09-29
status: secured
asvs_level: 1
threats_total: 56
threats_closed: 56
threats_open: 0
block_on: high
---

# Phase 4: Base Picker and Generator UI — Security Audit

**Scope.** Static client-only app (no server routes, no auth, no database). Attack surface is entirely
client-side: URL query params feeding rendering (`?base=`, `?layout=`, `?labels=`, `?region=`, `?isolate=`,
`?mute=`, `?packer=`, `?tier=`, `?selected=`, `?layers=`, `?date=`, `?tc=`, `?particles=`, `?orbits=`) and
user-typed text (base numbers, custom zone-label alphabets) feeding SVG/DOM output.

**Method.** Every threat below is verified against its declared disposition, not rediscovered from scratch:
`mitigate` → grep/read the cited implementation file(s) for the exact claimed pattern; `accept` → confirm the
accepted-risk properties hold in code and record the entry in this file's Accepted Risks Log (this is the
first `/gsd-secure-phase` run for this repo — no prior `SECURITY.md` existed, so this log is being created
now, not merely checked). Implementation files were read-only throughout; no code was changed.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|---|---|---|---|---|
| T-04-01 | Tampering (oracle erosion) | mitigate | CLOSED | `e2e/behaviour.spec.ts:110-124` — `markedRegions` check asserts `[]`: no PANELS header, no page header, no `svg[viewBox^="0 0 800 "]` closest-matches `[data-post-baseline]`. Ran clean in the full verify gate (04-VERIFICATION.md). |
| T-04-02 | Repudiation (silent regeneration) | mitigate | CLOSED | `scripts/check-repo.mjs` `LF_DIRS` includes `e2e/__golden__` and `e2e/__behaviour__`; `clean-tree` check runs `git status --porcelain --untracked-files=all` against them. `tests/e2e-normalizer/behaviour-compare.test.ts` `baselineAction` tests prove capture never overwrites an existing file and only fires at `BEHAVIOUR_CAPTURE=1` exactly. |
| T-04-03 | Tampering (gate bypass) | mitigate | CLOSED | `scripts/check-repo.mjs:244-276` `BASE_TEN_EXEMPT` (4 paths, each with an inline reason) and `BASE_TEN_PATTERNS` (11 named regexes) in `findHardcodedBaseTen`. |
| T-04-04 | Spoofing (bidi/invisible labels) | mitigate | CLOSED | `app/lib/customAlphabet.ts:75` `FORBIDDEN = /[\p{Cc}\p{Cf}\p{Z}\p{M}\p{Cs}\p{Co}\p{Cn}]/u`; `splitAlphabet` NFC-normalizes first; duplicate rejection in `checkAlphabetChars`. `tests/app/customAlphabet.test.ts:107,112,168` exercise U+202E and U+200D by name. |
| T-04-05 | Tampering / XSS | mitigate | CLOSED* | `describeChar` (`customAlphabet.ts:95-97`) substitutes `U+XXXX` for any `FORBIDDEN`-matching character in the `checkAlphabetChars` rejection message. Global grep for `dangerouslySetInnerHTML` across `app/` returns zero matches — every label/message is a React text child. *See residual observation R-1 below (glyph-warning echo path). |
| T-04-06 | Denial of service | mitigate | CLOSED | `app/lib/customAlphabet.ts:8` `MAX_ALPHABET = 1024`, checked in `checkAlphabetChars` before the per-character `FORBIDDEN` loop. `app/lib/glyphCoverage.ts:54-79` `makeGlyphProbe` memoizes verdicts in a `Map`; `tests/app/glyphCoverage.test.ts` proves `measureWidth` is called once per distinct character. |
| T-04-07 | Tampering (prototype keys) | mitigate | CLOSED | `app/lib/regions.ts:19` `TORQUE_INDEX_RE = /^torque:(0\|[1-9][0-9]*)$/`, plus a numeric range check in `isRegionId`; ids are only ever compared or used as `Set`/`Map` elements, never as an object property key. |
| T-04-08 | Denial of service | mitigate | CLOSED | `app/lib/numogramView.ts:70-85` `summarize` reads at most `SUMMARY_TORQUE_LIMIT = 12` cycles via `g.cycleAt(i)` and O(1) `g.demons.count`/`typeCounts()`; never touches `g.torques`/`g.cycles`. |
| T-04-09 | Info disclosure / Tampering | mitigate | CLOSED | `app/lib/tierBounds.ts:7-10` types `TIER_VIEW` as `Pick<TierTable, 'boundaries' \| 'tierOverrideParam'>`. Repo-wide grep for `TIER_TABLE` outside `engine/` is empty. **Independently verified against the actual built output**: `grep -rl "jsHeapBytes"` and `"measurements":[` in `out/_next/static/chunks/**/*.js` returns no matches, while `tierOverrideParam` (the field actually read) is present — the measurement rows are confirmed absent from the shipped bundle, not just claimed. |
| T-04-10 | Tampering (base-10 regression) | mitigate | CLOSED | `app/presets/base10/routes.ts` header states the verbatim-move provenance; 60 DOM goldens (both TZ projects) and `test:swap` passed unregenerated in the full verify gate (04-VERIFICATION.md). |
| T-04-11 | Repudiation (licensing provenance) | mitigate | CLOSED | `routes.ts:1` "Not relicensed by this repository; see NOTICE section 2." `NOTICE` section 2 names `app/presets/base10/routes.ts` explicitly; `check-repo.mjs` `notice` check verifies required entries are present. |
| T-04-12 | Denial of service (bundle growth) | mitigate | CLOSED | `npm run verify` includes `check:weight`; full gate passed (04-VERIFICATION.md: "check:weight: OK (2 routes, 30 golden states within tolerance)"). |
| T-04-13 | Denial of service | mitigate | CLOSED | `app/lib/shareParams.ts:24,81,94` `BASE_PARAM_MAX_LENGTH = 16`, `BASE_DIGITS_RE = /^[0-9]+$/` checked before `Number()`; `engine/core/base.ts:5,47` `MAX_BASE = 67108864` (2^26) enforced in `validateBase` before any allocation. |
| T-04-14 | Tampering (injection into state) | mitigate | CLOSED | `shareParams.ts` uses allow-lists throughout: `isLayoutIdFor`, `ALLOWED_LAYERS` Set, `parseRegionId`, `parsePacker` (`PACKERS.includes`), `tierOverrideFrom`. No dynamic property access from URL text anywhere in the codec. |
| T-04-15 | Denial of service / Spoofing | mitigate | CLOSED | `parseLabelScheme` (`labelScheme.ts:83-95`) routes `custom:` values through `checkAlphabetChars`, which enforces the 1024-char cap and `FORBIDDEN` rejection before the scheme is accepted. |
| T-04-16 | Tampering (share-link regression) | mitigate | CLOSED | `tests/app/shareParams.test.ts` exists and is exercised by the full unit-test run; `e2e/url-codec.spec.ts` legacy-link and round-trip cases passed (04-VERIFICATION.md SC2). |
| T-04-17 | Denial of service | mitigate | CLOSED | `app/lib/basePicker.ts:33,65-74` `CANDIDATE_RE` gate before `validateBase`; `BASE_DEBOUNCE_MS = 200` wired into `BasePicker.tsx`'s `useEffect` debounce (line 77-82). |
| T-04-18 | Tampering / XSS via echo | mitigate | CLOSED | `engine/core/base.ts:14-19` `MAX_ECHO = 40`/`clipEcho`; `shareParams.ts:83-88` local `MAX_ECHO`/`clipRaw` mirrors it. `BasePicker.tsx` renders `{candidate}` and `{refusal}` as plain React text children only. |
| T-04-19 | Spoofing | mitigate | CLOSED* | `LabelSchemeControls.tsx:52-56` `handleCustomTextChange` only calls `onChange` when `check.ok` (i.e. `validateAlphabet` passed); glyph-coverage warnings are rendering-advisory and never gate `onChange`. *See residual observation R-1. |
| T-04-20 | Elevation (global key hijack) | mitigate | CLOSED | `BasePicker.tsx` NOTABLE_BASES chips and `ViewControls.tsx` toolbar buttons use plain `<CyberButton>`/`<button>` with no `shortcut` prop; global shortcuts are wired only on the fixed layout/orbit buttons in `NumogramClient.tsx`. |
| T-04-21 | Denial of service | mitigate | CLOSED | `app/lib/numogramText.ts:10,29-31,49-80` `TEXT_VIEW_ZONE_LIMIT = 1024`; above it only the header block (4-5 lines) is produced, no per-zone/pair/gate loop. |
| T-04-22 | Info disclosure | accept | CLOSED (see Accepted Risks Log) | `TextView.tsx:11-19` `onCopy` fires only from the button's `onClick`, writes only the `text` prop (visible content), and swallows clipboard failures in a `catch`. |
| T-04-23 | Tampering / XSS | mitigate | CLOSED | `PairGraphProjection.tsx` renders `{zoneLabels[hi]}::{zoneLabels[lo]}` as SVG `<text>` children; no `dangerouslySetInnerHTML` anywhere in `app/`. |
| T-04-24 | Elevation (forced heavy render) | mitigate | CLOSED | `BigBaseSummary.tsx` has no "show anyway" affordance; `svgRichMaxN` arrives as a prop (`NumogramClient.tsx:1337` passes `SVG_RICH_MAX_N`, a tier-table-derived constant, never a literal). |
| T-04-25 | Tampering | mitigate | CLOSED | `app/lib/layoutIds.ts` `isLayoutIdFor`/`isPresetLayoutId` use `Array.includes` string comparison only; `viewLayouts.ts`'s `layoutTarget` never evaluates `id`, only branches on it. |
| T-04-26 | DoS / Integrity (NaN geometry) | mitigate | CLOSED | `useLayoutTween.ts:62` `jumpedOrDone = tweenProgress >= 1 \|\| fromBaseRef.current !== target.base` — a base change is always a hard jump, never an inter-base tween. |
| T-04-27 | Accessibility harm (motion) | mitigate | CLOSED | `NumogramClient.tsx:205` passes `mayTween(g.zoneCount) && !reducedMotion` as the `animate` flag into `useLayoutTween`; `useReducedMotion.ts` live-tracks the OS preference. |
| T-04-28 | Tampering (base-10 regression) | mitigate | CLOSED | `test:swap` and the 60 frozen DOM goldens passed unregenerated in the full verify gate after all Phase 4 `Projection.tsx` edits (04-VERIFICATION.md). |
| T-04-29 | Tampering / XSS | mitigate | CLOSED | Every zone/syzygy/current/gate label in `Projection.tsx` is a React/SVG `<text>` child (`{zoneLabels[z]}`, `{c.label}`, `{s.demon}`, etc.); `data-*` attributes carry only ids (`data-zone={z}`, `data-focus-key=...`), never HTML. |
| T-04-30 | Integrity (wrong arithmetic) | mitigate | CLOSED | `app/lib/numogram.ts` `plexExpr` uses `digitsOf`/`formatNumeral` (in-base) exclusively. `tests/app/numogramLib.test.ts:26-39` "agrees with the engine gate destination for every even base 2..64" test exists exactly as claimed and passes. |
| T-04-31 | Denial of service | mitigate | CLOSED | `Projection.tsx:272` pandemonium layer gated on `demons !== null`; gates layer opacity `* (gateMode === 'thin' ? 0.5 : 1)` and the whole layer skipped when `gateMode !== 'off'` is false. |
| T-04-32 | Denial of service | mitigate | CLOSED | `if (!view \|\| !zoneLabels) return <PanelUnavailable .../>` confirmed in `ZonesPanel.tsx`, `SyzygiesPanel.tsx`, `CurrentsPanel.tsx`, `GatesPanel.tsx`, `RegionsPanel.tsx`, `LayersPanel.tsx`, `LabelsPanel.tsx`. |
| T-04-33 | Tampering / XSS | mitigate | CLOSED | `InfoDisplay.tsx` and `RegionsPanel.tsx` render all lore/structural text as React text children; `view.lore` is read only inside a `view.lore !== null` branch. |
| T-04-34 | Tampering (baseline erosion) | mitigate | CLOSED | Full verify gate: frozen behaviour baseline (`e2e/behaviour.spec.ts`) and 60 DOM goldens passed unregenerated post-panel-refactor (04-VERIFICATION.md). |
| T-04-35 | Integrity (UI regression) | mitigate | CLOSED | `app/components/panels/shared.tsx` `SelectableListPanelRendererProps<T>` declares `itemDisplay: (props) => React.ReactNode` — a render-prop function, not a component-type field; no `ItemDisplayComponent` identifier exists anywhere in the codebase. |
| T-04-36 | Denial of service | mitigate | CLOSED | `NumogramClient.tsx:191-192` `showDiagram = tierFor(base, tierOverride) === 'svg'`; `view`/`target` are `null` unless `showDiagram`, so no view/list/layout is ever built above `svgRichMaxN`. |
| T-04-37 | Elevation (forced heavy render) | accept | CLOSED (see Accepted Risks Log) | `NumogramClient.tsx:144,595` `tierOverride` state is set only from `state.tier` during URL hydration — no button/click handler calls `setTierOverride`. `engine/scene/tiers.ts` `parseTierOverride` allow-lists values against the tier table. |
| T-04-38 | Tampering | mitigate | CLOSED | `shareParams.ts` validates `layout`/`region`/`labels`/`packer` against the parsed `base` (e.g. `isLayoutIdFor(rawLayout, base)`, `parseRegionId(..., g)` where `g = createNumogram(base)`). |
| T-04-39 | Tampering (share-link regression) | mitigate | CLOSED | `buildShareParams` is the sole URL-writer (`shareParams.ts:219-252`); `e2e/url-codec.spec.ts` legacy-link cases passed (04-VERIFICATION.md SC2). |
| T-04-40 | Tampering (stale cross-base state) | mitigate | CLOSED | `commitBase` (`NumogramClient.tsx:339-370`) batches every session-reset setter into one callback; `applySnapshot` (line 301) `if (snapshot.base !== base) return` guard. |
| T-04-41 | Denial of service | mitigate | CLOSED | `commitBase` calls `jumpToTarget()` before `setBase(n)` (line 348); `useLayoutTween`'s `fromBaseRef` guard (T-04-26) prevents any mixed-base tween regardless of timing. |
| T-04-42 | Spoofing | mitigate | CLOSED | Custom-alphabet validation gates (T-04-04/T-04-06/T-04-15) apply identically whether the scheme arrives from the UI or from `labels=` in the URL (both route through `checkAlphabetChars`); `selected=` is parsed as plain integers (`parseSelected`), independent of label scheme. |
| T-04-43 | Tampering | mitigate | CLOSED | `parseRegionList` (`shareParams.ts:131-141`) routes every token through `parseRegionId`; `sanitizeRegionFilter` (`regions.ts:146-148`) drops ids invalid for the current `g`, called from `applySnapshot` (`NumogramClient.tsx:322-325`). |
| T-04-44 | Spoofing (misleading diagram) | mitigate | CLOSED | `Projection.tsx`: every hidden-state branch (`zs(z) === ZONE_HIDDEN`, syzygy/current/gate `st === ZONE_HIDDEN`) does `return null` — removed from the render tree, not dimmed via opacity. |
| T-04-45 | Tampering (baseline erosion) | mitigate | CLOSED | `RegionsPanel.tsx:65-67` keeps `REGION_INFO` (frozen base-10 strings) verbatim behind `view.lore !== null`; Isolate/Mute buttons (lines 86,98) carry `data-post-baseline=""`. |
| T-04-46 | Tampering (selector injection) | mitigate | CLOSED | `Projection.tsx:141` and `PairGraphProjection.tsx:76` both use `` `[data-focus-key="${CSS.escape(nextKey)}"]` ``; keys are built from integers/known strings (`zone:${z}`, `pair:${q}`), never raw URL text. |
| T-04-47 | Denial of service (key conflicts) | mitigate | CLOSED | `onDiagramKeyDown` in both `Projection.tsx` and `PairGraphProjection.tsx` returns early unless `e.target` carries a `data-focus-key` attribute; `NumogramClient.tsx:850` digit-gate shortcut is gated `base === 10 &&`. |
| T-04-48 | Tampering / XSS | mitigate | CLOSED | Every `aria-label` in `Projection.tsx`/`PairGraphProjection.tsx` is a React attribute string built from data (zone labels already validated by T-04-04/T-04-15); React escapes JSX attribute values, and no `dangerouslySetInnerHTML` exists. |
| T-04-49 | Accessibility harm (motion) | mitigate | CLOSED | `useOrbitalAnimation.ts:17` cancels the rAF loop when `reducedMotion`; `Projection.tsx:892,1008,1163` gate the particle/carrier layers on `!reducedMotion`; `NumogramClient.tsx:1190` disables the orbit toggle button (`disabled={reducedMotion}`). |
| T-04-50 | Info disclosure | accept | CLOSED (see Accepted Risks Log) | Same code path as T-04-22 (`TextView.tsx`). |
| T-04-51 | Tampering (baseline erosion) | mitigate | CLOSED | `CyberPanel.tsx:100,155` root `data-post-baseline` when `postBaseline` prop set, collapse-toggle button unconditionally marked; `ViewControls.tsx:52` toolbar root marked; `internalOpen` defaults to `true`. |
| T-04-52 | Denial of service | mitigate | CLOSED | `NumogramClient.tsx:1520` Text panel wrapped in `{showDiagram && (...)}`; `numogramText` bounded at `TEXT_VIEW_ZONE_LIMIT = 1024` (T-04-21). |
| T-04-53 | Tampering (gate bypass) | mitigate | CLOSED | `scripts/check-repo.mjs:357` `'base-ten'` is in `DEFAULT_CHECKS`; full verify gate confirms `check-repo: OK` including this check by default (04-VERIFICATION.md). |
| T-04-54 | Tampering (oracle erosion) | mitigate | CLOSED | `tests/oracle/deriveBase10.ts` imports only from `app/presets/base10/*` (repointed); the `source:` string field (line 167) remains the original, unedited text describing the pre-move layout — confirming the frozen derivation logic itself was not altered, only its import paths. |
| T-04-55 | DoS / Integrity | mitigate | CLOSED | `e2e/smoke-bases.spec.ts` sweeps every even base 2..40 plus `ladder`/`spiral`/`pairGraph` at 2,4,6,28, asserting exact zone/pair counts and `assertClean` (no `NaN`/`undefined` text, no page errors). Passed in full verify gate. |
| T-04-56 | Repudiation (budget drift) | mitigate | CLOSED | `scripts/page-weight.mjs:136-139` `nextBaseline` throws without a non-empty `--reason`; `perf/page-weight.baseline.json` `history[]` records a reason for every entry. Bundle-absence of measurement rows independently re-verified under T-04-09. |

\* T-04-05 and T-04-19 are marked CLOSED because their stated mitigation properties (labels/messages as React text only, no `dangerouslySetInnerHTML`, `validateAlphabet` gating `onChange`) all hold as claimed. A narrower residual gap in an adjacent, unclaimed code path is recorded below as R-1 for follow-up.

## Accepted Risks Log

This is the first audit of this repository (no prior `SECURITY.md`); the following `accept`-disposition
threats are formally logged here for the first time, with the code evidence that satisfies each's accepted
scope:

- **T-04-22 / T-04-50 — Clipboard write of numogram text (Info disclosure).** `TextView.tsx`'s copy button
  writes only the visible, already-rendered text content to the clipboard, only in response to an explicit
  user click, and silently no-ops if the Clipboard API throws (e.g. permissions denied, insecure context).
  Accepted because: no data beyond what is already on-screen is transmitted; there is no auto-copy, no
  background write, and no server to exfiltrate to. Residual risk is limited to the user's own clipboard
  being overwritten by their own click — an expected, discoverable side effect of a "Copy" button.

- **T-04-37 — `?tier=svg` diagnostic override (Elevation / forced heavy render).** `parseTierOverride`
  allow-lists the value against the shipped tier table; `tierOverride` state is populated only during URL
  hydration (`NumogramClient.tsx:595`) and no UI control ever calls `setTierOverride`. Accepted because: a
  visitor can only force a heavier render tier for their own tab by hand-editing their own URL — there is no
  mechanism for one visitor to force this state onto another (a shared link with `?tier=svg&base=<huge>`
  would only ever slow down the tab of whoever opens it, and `validateBase`'s 2^26 ceiling still applies).

## Residual Observations (non-blocking)

**R-1 — Glyph-coverage warning can echo a raw forbidden character (`app/components/numogram/LabelSchemeControls.tsx:58-59,107-111`).**
`evaluateCustomAlphabet(text, base)` splits the *raw* typed text (via `splitAlphabet`, no `FORBIDDEN` filtering)
before `glyphRisks` selects characters the canvas probe flags `'risk'` (typically zero-measured-width
characters — which most bidi/format control characters are). Those raw characters are then interpolated
directly into a `<p>` warning ("`'{ch}'` may not render...") as a React text child, **without** the
`describeChar`/`U+XXXX` substitution that the sibling `checkAlphabetChars` rejection message
(`check.message`, rendered two lines above) correctly applies to the same input.

Effect: typing a bidi-override character (e.g. U+202E) into the free-text custom-alphabet field can render
that literal control character into the live DOM inside the glyph-warning list, even though the character is
simultaneously and correctly rejected from ever becoming part of an applied `LabelScheme` (the `onChange`
gate in the same component only fires when `check.ok`, per T-04-19). There is no XSS vector (this is a React
text node, never `dangerouslySetInnerHTML`) and no cross-user/cross-origin exposure — the character can only
reach this path by the same visitor typing it into their own browser, and it never reaches `labels=` in the
URL or any persisted/shared state.

Severity: low / self-only. Does not meet the bar for `block_on: high` at ASVS Level 1, and does not
contradict either T-04-05's or T-04-19's core claimed property (labels themselves, and the primary rejection
message, are unaffected). Recorded here as a follow-up: `glyphWarnings` should map through `describeChar`
before rendering, for symmetry with `checkAlphabetChars`'s own message.

**R-2 — Bundle-absence of tier-table `measurements` is not covered by an automated regression gate.**
T-04-09's and T-04-56's "measurement rows stay out of the viewer bundle" claim was independently confirmed
true today by grepping the actual built `out/_next/static/chunks/**/*.js` for `jsHeapBytes`/`measurements`
(no matches) versus `tierOverrideParam` (present, as expected). However, no script in `scripts/` or test in
`tests/` asserts this automatically — a future change to how `engine/scene/tier-table.json` is imported
(e.g. switching from a named/tree-shaken import shape to a default-object spread) could silently reintroduce
the measurement rows into the bundle without any test failing. Recommend adding a `check:weight`-adjacent
grep assertion if this budget matters going forward.

## Unregistered Flags

`.planning/phases/04-base-picker-and-generator-ui/*-SUMMARY.md` — checked all 16 for a `## Threat Flags`
section. Only `04-08-SUMMARY.md` has one, and it states "None" (introduces no new network endpoint, auth
path, file access, or schema surface). No unregistered flags found.

## Notes on Verification Depth

Every `mitigate` threat above was verified by directly reading the cited implementation file(s) and
confirming the exact claimed pattern is present and wired the way the plan describes (not merely that a
similarly-named function exists) — this included one direct build-artifact inspection (T-04-09/T-04-56,
grepping `out/_next`) that goes beyond a plan's own claimed evidence. Test files were spot-checked (not
exhaustively re-run) where they were the primary evidence for a threat (T-04-04, T-04-30, T-04-55); the full
`npm run verify` gate's pass/fail record from `04-VERIFICATION.md` (176 passed, 0 failed, exit 0) was relied
upon rather than re-executed, since re-running it is outside this audit's read-only implementation-file
mandate and it was run immediately prior to this audit on the same committed tree.

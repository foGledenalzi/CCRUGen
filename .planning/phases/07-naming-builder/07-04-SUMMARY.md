---
phase: 07-naming-builder
plan: 04
subsystem: ui
tags: [react, cyber-controls, markup-identity, accessibility, css, vitest, typescript]

# Dependency graph
requires:
  - phase: 07-naming-builder
    provides: nothing at code level (wave 1, independent of 07-01 to 07-03); the contract comes from 07-UI-SPEC "Component prop additions", Color and decisions 14 and 18
provides:
  - CyberButton optional ariaLabel, title, ariaExpanded, ariaPressed and dataAttrs (each emits nothing when absent)
  - CyberRadio optional title (on the label), className (appended only when given) and dataAttrs (on the input)
  - CyberCheckbox optional dataAttrs (on the input)
  - LockIcon({ clr, locked }) in NumogramIcons.tsx (closed shackle when locked, open raised unjoined shackle when not)
  - .ui-terminal-field--quiet and .ui-terminal-field--invalid in app/globals.css (additive, no existing rule edited)
  - tests/app/cyberControlsMarkup.test.ts (26 tests) and 8 more CyberButton cases in tests/app/demonsOverlayRender.test.ts
affects: [07-17, 07-18, 07-19, 07-20, 07-21, 07-22, 07-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Markup identity by capture-before-edit: the default strings of the unmodified components are pinned as constants in the test, and each new prop is proved to add exactly one attribute by removing it again and comparing with the pinned string"
    - "Append-only-when-given class string (`${className ? ` ${className}` : ''}`), because a bare `${className}` appends the text undefined (or a trailing space) to every default"
    - "dataAttrs: a per-file helper that keeps only keys starting with data-, so a caller map can never carry an event handler, style, id or an attribute the component already owns"

key-files:
  created:
    - tests/app/cyberControlsMarkup.test.ts
  modified:
    - app/components/ui/CyberButton.tsx
    - app/components/ui/CyberRadio.tsx
    - app/components/ui/CyberCheckbox.tsx
    - app/components/numogram/NumogramIcons.tsx
    - app/globals.css
    - tests/app/demonsOverlayRender.test.ts

key-decisions:
  - "CyberRadio puts title after className in the JSX, so the label renders `<label class=... title=...>` and a default label still starts `<label class=\"inline-flex`"
  - "Each of the three components carries its own 4-line dataProps helper (the plan said no new module); the keep rule is exactly key.startsWith('data-')"
  - "The --invalid selector set includes an explicit :focus-within::after variant, so the red underline wins in the focused state by specificity (0,3,1 against 0,2,1), not only by source order"

patterns-established:
  - "The CSS-addition guard test pins the original .ui-terminal-field block byte for byte and checks the new selectors sit after it, so an edit to an existing rule fails a test and not only a numstat"

requirements-completed: []  # NAM-01 stays Pending: these are building blocks for the Names panel (07-17 onwards); nothing in the app passes the new props yet

# Metrics
duration: ~14min
completed: 2026-11-09
---

# Phase 7 Plan 04: Cyber Control Props, LockIcon and Field Modifier Classes Summary

**CyberButton, CyberRadio and CyberCheckbox gained optional aria, title, class and data-* props that emit nothing when absent (default markup pinned byte for byte from the unmodified components), plus a LockIcon whose shackle shape differs by state and two additive CSS field modifiers (quiet grey underline, invalid red underline that beats the focus gradient).**

## Performance

- **Duration:** about 14 min (21:05 to 21:19 UTC, including the 5 min `test:swap` run)
- **Tasks:** 2 of 2 (Task 1 as a RED commit and a GREEN commit; Task 2 as one commit)
- **Files:** 1 created (the new test file), 6 modified
- **`$PLAN_BASE`:** `186e8aef93aaa607d48b3a81a8c9a186024e7e64` (`git diff --numstat` of `app/globals.css` against it: 18 additions, 0 deletions)

## Accomplishments

- **Default DOM of every existing call site is unchanged**, proved three ways: the new test pins `DEFAULT_RADIO_MARKUP`, `CHECKED_RADIO_MARKUP` (checked, named, disabled), `DEFAULT_CHECKBOX_MARKUP` and `CHECKED_CHECKBOX_MARKUP` captured from the unmodified components before the edit (run once to print them, then pasted); the existing `CyberButton: markup identity (T-05-31)` constants `DEFAULT_MARKUP` and `ACTIVE_MARKUP` were not edited (`git diff --unified=0 $PLAN_BASE -- tests/app/demonsOverlayRender.test.ts | grep -c "^-.*DEFAULT_MARKUP ="` is 0); and `npm run test:swap` re-ran the 60 DOM goldens and the behaviour baseline against the rebuilt export (see Verification).
- **Each new prop adds exactly one thing.** For every prop the test removes the one expected attribute (or class) from the rendered markup and requires byte equality with the pinned default: `title="t"` on the radio label, `uppercase  min-h-[24px]"` (class appended after the disabled class too), `data-names-style="harsh"` on the radio input, `data-names-smoothing=""` on the checkbox input, and on the button `aria-label`, `title`, `aria-expanded="false"` (a false value is still emitted), `aria-pressed` (true and false), `data-names-export=""`.
- **T-07-22 (attribute injection):** `dataAttrs` keys that do not start with `data-` (`onclick`, `aria-x`, `style`, `class`, `id`, and the owned input attributes `type`, `checked`, `name`, `disabled`) are dropped for all three components, each with its own test.
- **LockIcon** draws `M8.5 11V8a3.5 3.5 0 0 1 7 0v3` (closed, joins the body on the right) when locked and `M8.5 11V6a3.5 3.5 0 0 1 7 0v1` (raised, stops short on the right) when unlocked, in the given colour (two strokes and the accent dot), `aria-hidden`, 14 px.
- **Two CSS modifier classes**, added after the existing `.ui-terminal-field` rules with no existing rule edited: `.ui-terminal-field--quiet` (`border-bottom-color: rgba(255,255,255,0.12); padding-right: 0`) and `.ui-terminal-field.ui-terminal-field--invalid` (`border-bottom-color: #f87171`) with its `::after` and `:focus-within::after` rule (solid `#f87171`, opacity 1). A test pins the original `.ui-terminal-field` block byte for byte (still `padding-right: 14px`), the focus-within gradient rule, and that both new selectors come after the base block.

## Task Commits

1. **Task 1: additive Cyber props with markup-identity tests** (TDD)
   - RED: `071a528` (`test(07-04)`: pinned default strings pass, 10 new-prop tests fail against the unmodified components)
   - GREEN: `10fd815` (`feat(07-04)`: the three components; all 35 tests in the two files pass)
2. **Task 2: LockIcon and the two field modifier classes** - `80fa540` (`feat(07-04)`)

**Plan metadata:** the docs commit that carries this file, STATE.md and ROADMAP.md.

## Files Created/Modified

- `app/components/ui/CyberButton.tsx` - five optional props, `dataProps` helper, one attribute each
- `app/components/ui/CyberRadio.tsx` - `title`, `className`, `dataAttrs`; class string appends only when given
- `app/components/ui/CyberCheckbox.tsx` - `dataAttrs` on the input
- `app/components/numogram/NumogramIcons.tsx` - `LockIcon({ clr, locked })`
- `app/globals.css` - `--quiet` and `--invalid` modifiers (18 lines added, 0 deleted)
- `tests/app/cyberControlsMarkup.test.ts` - radio and checkbox identity, one-attribute checks, key filter, LockIcon shapes, CSS guard (26 tests)
- `tests/app/demonsOverlayRender.test.ts` - eight new CyberButton cases inside the existing identity describe (pinned constants untouched)

## Verification

| Check | Result |
|-------|--------|
| `npx cross-env CCRUG_TZ=UTC vitest run tests/app/cyberControlsMarkup.test.ts tests/app/demonsOverlayRender.test.ts --project oracle` | exit 0, 2 files, 46 tests passed |
| `npm run typecheck` (4x tsc + lint) | exit 0 (one pre-existing `react-hooks/exhaustive-deps` warning in DemonMatrix.tsx, not touched) |
| `node scripts/check-repo.mjs --only base-ten` (new files `git add`ed first) | OK |
| `MSYS_NO_PATHCONV=1 npm run test:swap` (build, golden.spec + behaviour.spec, then the whole unit suite) | exit 0: build compiled, Playwright 65 passed and 5 skipped (2.9 min, includes the 60 DOM goldens and the behaviour baseline), unit tests 97 files and 2774 tests passed |
| frozen oracles | untouched: `git diff --stat $PLAN_BASE HEAD -- e2e engine tests/presets app/presets app/components/projection` is empty; no deletions in any commit |
| `grep -c "className ? \` \${className}\` : ''" app/components/ui/CyberRadio.tsx` | 1 |
| `grep -c "export function LockIcon"` / `ui-terminal-field--quiet` / `ui-terminal-field--invalid` | 1 / 1 / 3 lines |

### Mutation checks (one at a time in the foreground, source restored from a saved copy and compared after each)

| Mutant | Result |
|--------|--------|
| CyberRadio appends `${className}` unconditionally (required by the plan) | KILLED: 10 of 15 tests in cyberControlsMarkup.test.ts fail, including `DEFAULT_RADIO_MARKUP` identity and `CHECKED_RADIO_MARKUP` |
| CyberCheckbox and CyberButton `dataProps` keep every key (filter removed) | KILLED: the two `do not start with data-` tests fail (2 failures, 33 pass) |
| CyberRadio `dataProps` keeps every key | KILLED: the key-filter test and the owned-attributes test fail |
| LockIcon draws the closed shackle in both states (`{true ? ...}`) | KILLED: `unlocked draws the open shackle` and `the two states are different markup` fail |

## Decisions Made

- `title` is placed after `className` in the CyberRadio label JSX so the default and titled labels both begin `<label class="inline-flex` (my first draft put it first and the test caught the attribute order).
- Three copies of a 4-line `dataProps` helper rather than a shared module, as the plan allows; the rule is exactly `key.startsWith('data-')`, nothing stricter, so a later plan can pass any `data-names-*` key.
- The invalid selectors include the `:focus-within::after` variant explicitly. The plan's note says the doubled class gives higher specificity than `.ui-terminal-field:focus-within::after`; strictly the idle `--invalid::after` is equal (0,2,1) and wins by source order, and the focused one is (0,3,1). Both paths are covered, so the green focus gradient never shows on an invalid field.

## Deviations from Plan

None - plan executed as written. Two notes, neither a deviation:

- The test file also asserts a few things beyond the plan's list (undefined and empty props change nothing, the owned input attributes cannot be overridden through `dataAttrs`, the CSS base block is pinned byte for byte). These tighten the stated truths.
- A first draft of one radio test assumed `title` renders after `class`; this was my own test assumption, fixed by ordering the JSX (see Decisions).

## Authentication Gates

None.

## Known Stubs

None. The new props, `LockIcon` and the two classes are not used anywhere yet by design; the Names panel (07-17 onwards) and the demon name editor consume them. Nothing renders empty or placeholder data.

## Threat Flags

None. `dataAttrs` is the only new trust boundary (caller attribute map to DOM) and it is the planned T-07-22 mitigation with a test per component.

## Issues Encountered

- A python heredoc I used for a scripted test edit hung on the Windows Python launcher and left a `python.exe` process; it was killed by its PID and the edit was reapplied with node. No repository state was affected.

## Self-Check

## Self-Check: PASSED

- Files found: `tests/app/cyberControlsMarkup.test.ts`, `app/components/ui/CyberButton.tsx`, `CyberRadio.tsx`, `CyberCheckbox.tsx`, `app/components/numogram/NumogramIcons.tsx`, `app/globals.css`.
- Commits found with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer: `071a528`, `10fd815`, `80fa540`.
- Working tree after `test:swap`: no stray `out/`, probe route or `.e2e-basepath` change tracked or staged.

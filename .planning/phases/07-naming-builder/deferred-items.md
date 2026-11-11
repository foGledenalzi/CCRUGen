# Deferred items — Phase 7 (naming-builder)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 2026-11-10 — an edit made right after an Undo or Redo is not recorded, so Undo then skips a step (found during 07-18)

**RESOLVED 2026-11-10 in commit `18c8f57`** (an orchestrator-scheduled fix between 07-20 and 07-21, not a numbered plan; the failing
regression tests came first in `40e2cce`). The `historyApplyingRef` branch now sits above the key-equality return, exactly as suggested
below. Verified by `npm run test:swap` exit 0 with the 60 DOM goldens and the 5 behaviour stages (including `after-undo` and
`after-redo`) passing unchanged, so the frozen baseline did NOT encode the bug and nothing frozen was touched, by the two new cases in
`e2e/names-session.spec.ts` (rename and layer toggle), which failed before the fix and pass after, and by two mutants (the old ordering,
and the new position without the flag clear) that both fail those cases. Residual, not fixed here (see the last bullet): a refused Undo.

- **Where:** the history push effect in `app/NumogramClient.tsx` (the `historyApplyingRef` branch). Present in the Phase 1 to 6 code
  at the plan base `931c484` (`git show 931c484:app/NumogramClient.tsx`, lines 1061 to 1067); 07-18 did not introduce it.
- **Cause:** `onUndo` and `onRedo` set `historyApplyingRef.current = true` and `historyCurrentRef.current = target`, then apply the
  snapshot. On the render that follows, the effect compares `historyCurrentRef` (the target) with the restored state; the two keys are
  equal, so the effect takes the bare `return` that sits BEFORE the `historyApplyingRef` branch, and the flag is never cleared. The next
  real change of any kind then takes the `historyApplyingRef` branch instead of being pushed: it is not recorded, the Redo stack is
  not cleared, and Undo jumps over it.
- **Repro (browser, base 10 or any base):** pin a demon, rename it to `Aaa`, then `Bbb`; Undo (shows `Aaa`); rename to `Ccc`. Redo is
  still enabled (it should have been cleared) and a second Undo shows the original name instead of `Aaa`. The same happens with any
  two layer toggles in place of the renames, so it is not specific to the naming.
- **Why deferred:** it is older than Phase 7 and changes the history semantics every state uses; the frozen behaviour baseline
  (`e2e/__behaviour__`, stages `after-undo` and `after-redo`) was captured from the untouched viewer and may record today's behaviour,
  so a fix needs a deliberate decision (and a `test:swap` run) rather than a quiet change inside 07-18.
- **Suggested fix:** clear the flag whenever the apply render has run, i.e. move the `historyApplyingRef` branch above the
  key-equality `return` (when the flag is set, set `historyCurrentRef.current = currentSnapshot`, clear the flag and return), then run
  `npm run test:swap`; if a frozen stage changes, stop and ask before touching it. Add an e2e case: edit, edit, Undo, edit, Undo
  returns to the first edit.
- **Residual: RESOLVED 2026-11-10 inside plan 07-21 (extra task B; RED `5872c01`, fix in the commit that follows it).** `applySnapshot`
  now returns whether it applied; `onUndo` and `onRedo` apply first and, for a refused snapshot, only drop that dead entry from the
  stack it came from (as they always did): the flag, the current-snapshot ref and the other stack are left exactly as they were (a
  refused Undo no longer puts the current state on the Redo stack, which used to leave Redo enabled with nothing to redo). The new
  `e2e/names-session.spec.ts` case ("a refused Undo leaves the history alone...", `?base=28`: Undo refused, rename Aaa, rename Bbb, Undo
  shows Aaa, Undo shows the engine's name, Redo walks forward again) failed on the old code and passes now; two mutants (a refused
  Undo sets the flag and ref again; a refused Undo keeps its dead entry) both fail it. The frozen baseline (`initial`, `after-undo`,
  `after-redo`, base 10, never a refusal) passed unchanged under `npm run test:swap`. The Redo refusal branch is the same code but
  cannot be reached in the browser (a base switch clears both stacks), so it is covered by reading only. Original residual text:
- **Residual (found while fixing, from reading the code; not exercised in a browser and not fixed, the task allowed no other change in
  `NumogramClient.tsx`):** an Undo or Redo that `applySnapshot` REFUSES (its defensive `snapshot.base !== base` guard: the post-load
  entry that a `?base=28` load leaves is a base-10 snapshot, 07-18 summary) still sets `historyApplyingRef` and puts the foreign snapshot
  into `historyCurrentRef`, but nothing renders differently, so the history effect does not run to clear the flag. The next real edit
  is then swallowed exactly as before the fix (and the Redo stack, which already received the current entry, is not cleared). Narrow:
  it needs a click on Undo while only that foreign entry is on the stack. Suggested fix: make `applySnapshot` report whether it applied
  (a boolean) and let `onUndo`/`onRedo` set the flag and the ref only when it did (or check the base before touching the stacks); add
  an e2e case at `?base=28`: Undo (refused), rename, Undo restores the engine's name.

## 2026-11-10 — a transient bar of the panel wrapper while a panel opens (observed in 07-22, not fixed)

- **Where:** `app/components/ui/CyberPanel.tsx` (pre-existing component, not Phase 7 code): the body wrapper has `overflowY: auto`
  and a 200 ms `max-height` transition from 0 to the body height.
- **What:** with real scrollbars (a browser that does not hide them; Playwright's headless Chromium passes `--hide-scrollbars`, so
  the e2e default never sees it) the wrapper shows a bar of its own for the first 200 ms of opening, because its height is still
  smaller than its content. The Names panel's content is narrowed by one bar width (10 px measured on Windows Chromium) for that
  time, then returns to full width when the transition ends. At rest the wrapper never scrolls, so the UI-SPEC rule "one scroller" holds.
- **Why deferred:** cosmetic, 200 ms, present for every panel since Phase 4, and fixing it means changing a shared component. Any
  e2e measurement of widths or boxes right after opening a panel must wait for the transition (`settleAnimations` in
  `e2e/names-helpers.ts`); 07-24's geometry specs should use it too. (07-24's geometry specs do: every measurement waits for
  `settleAnimations` and then for three equal samples.)

## 2026-11-11 — three observations from the 07-24 geometry specs (no overlap or clipping bug; nothing changed in app code)

- **At the body minimum the visible body is 68 px, not 80 px.** UI-SPEC "Scrolling" makes the one scroller 12 px shorter than the room
  handed to `CyberPanel` (`NAMES_SCROLL_INSET_PX`), and "Body height" clamps that room to 80 at the least. Both are implemented as
  written, so when the clamp binds (Selection at its 52vh cap in a window under about 708 px tall, Names then 80 px of room) the scroller
  is 68 px: the sticky header plus about 1.6 rows, not two full rows. The wrapper still never scrolls, the box stays inside the window
  and the toolbar and shortcuts button stay on top and clickable (all proven in `e2e/panel-stack.spec.ts`, which pins the 12 px inset
  and the 68 px floor so a change is deliberate). If the user wants the contract's "header plus two rows" literally, the one-line change
  is `maxHeight: Math.max(bodyMax - NAMES_SCROLL_INSET_PX, NAMES_BODY_MIN)` in `app/components/names/NamesPanel.tsx` (the wrapper then
  holds 80 of 80 and still does not scroll); it also touches the panel render tests that pin the inset, so it was not done inside a
  test-only plan.
- **The UI-SPEC's worst-case numbers are conservative.** It models Selection at its cap as `64 + 0.52 vh` tall; measured it is
  `48 + 0.52 vh` (464 px at 800), so the open body room at the cap is `0.48 vh - 260` (not `- 276`) and the 80 px minimum binds below
  about 708 px, not 742. The contract (`bottom <= vh - 96` from 742 px) holds with a margin; the spec tests the formula, not the prose.
- **The shared header toggle is 10 x 10.** `CyberPanel`'s collapse button (every panel, since Phase 4) is the 10 px icon with no padding, so
  it is under 24 x 24. UI-SPEC's 24 px rule is for the controls this phase adds, and the spec scopes its tap-target check to the Names
  panel's content root accordingly; widening the shared toggle would change every panel's header.

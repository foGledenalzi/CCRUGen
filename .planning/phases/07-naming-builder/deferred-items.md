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
- **Residual (found while fixing, from reading the code; not exercised in a browser and not fixed, the task allowed no other change in
  `NumogramClient.tsx`):** an Undo or Redo that `applySnapshot` REFUSES (its defensive `snapshot.base !== base` guard: the post-load
  entry that a `?base=28` load leaves is a base-10 snapshot, 07-18 summary) still sets `historyApplyingRef` and puts the foreign snapshot
  into `historyCurrentRef`, but nothing renders differently, so the history effect does not run to clear the flag. The next real edit
  is then swallowed exactly as before the fix (and the Redo stack, which already received the current entry, is not cleared). Narrow:
  it needs a click on Undo while only that foreign entry is on the stack. Suggested fix: make `applySnapshot` report whether it applied
  (a boolean) and let `onUndo`/`onRedo` set the flag and the ref only when it did (or check the base before touching the stacks); add
  an e2e case at `?base=28`: Undo (refused), rename, Undo restores the engine's name.

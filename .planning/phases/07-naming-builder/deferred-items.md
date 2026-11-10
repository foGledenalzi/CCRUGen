# Deferred items — Phase 7 (naming-builder)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 2026-11-10 — an edit made right after an Undo or Redo is not recorded, so Undo then skips a step (found during 07-18)

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

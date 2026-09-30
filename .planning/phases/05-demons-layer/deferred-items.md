# Deferred items — Phase 5 (demons-layer)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 2026-09-30 — Flaky fast-check property in tests/app/demonMatrix.test.ts (found during 05-05)

- **Test:** `clampTransform > property: the viewport centre stays inside the matrix square after any panBy(dx, dy)`
- **File:** `tests/app/demonMatrix.test.ts` (owned by plan 05-03, untouched by 05-05)
- **Symptom:** occasionally fails under a specific fast-check random seed with a 1-ULP floating-point
  boundary miss (e.g. `expected 598.2344101949475 to be greater than or equal to 598.2344101949476`),
  after fast-check's shrinker narrows to a boundary case. Passes reliably when run in isolation or
  under most seeds (confirmed: failed once in a full `npx vitest run`, passed immediately after on a
  focused re-run of the same file).
- **Why deferred:** unrelated to 05-05's task (`DemonRowList.tsx`, `NumogramIcons.tsx`,
  `@tanstack/react-virtual`); no file this plan touches is implicated. Out of scope per the
  executor's scope boundary (pre-existing failures in unrelated files are not auto-fixed).
- **Suggested fix for whoever picks this up:** loosen the property's boundary assertions in
  `tests/app/demonMatrix.test.ts` (`clampTransform`'s pan-clamp property) with a small epsilon
  tolerance (e.g. `toBeGreaterThanOrEqual(x - 1e-9)`), since the property is about clamping the
  viewport centre inside the matrix square, not about exact floating-point equality at the boundary.

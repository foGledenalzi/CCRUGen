---
title: "Phase 6 code review: three unfixed info items (alphabet validation cost, stale picker commit, worker watchdog)"
status: pending
priority: P3
source: "Phase 6 deep code review, .planning/phases/06-canvas-tier-and-worker/06-REVIEW.md (IN-01, IN-03, IN-04), 2026-10-19"
created: 2026-10-19
theme: hardening
---

## Goal

Close the three low-severity findings from the Phase 6 deep review that were deliberately left unfixed when the warnings (WR-01..WR-03) and the two trivial items (IN-02, IN-05) were fixed in `06-REVIEW-FIX.md`.

## Items

1. **IN-01 — `formatZoneLabel` re-validates the whole alphabet on every call.** With a user-defined custom alphabet of about 1,024 characters the worker's text build costs O(zones x alphabet): 1.6 s at base 4000 versus about 35 ms for digits, and the single worker cannot be cancelled mid-job. Fix: validate the label scheme once per request (or memoize by scheme) instead of per label. Likely files: `app/lib/labelScheme.ts` / `formatZoneLabel` and the worker core `app/lib/worker/buildResult.ts`. Add a timing-insensitive test (call count of the validator) rather than a wall-clock threshold.
2. **IN-03 — a debounced base commit in `BasePicker` can run with a stale `onCommitBase`.** If a worker result lands inside the 200 ms debounce window, the committed closure can drop the typed base silently. The window is narrow. Fix: read the latest callback through a ref in the debounce timer. File: `app/components/numogram/BasePicker.tsx`.
3. **IN-04 — `WorkerClient` has no `messageerror` handler or watchdog.** A reply that never arrives (or fails to deserialize) leaves the in-flight slot occupied and blocks every later request. Fix: handle `messageerror` like `error` (terminate, fall back), and consider a generous watchdog that treats a silent worker as dead. File: `app/lib/worker/workerClient.ts`; extend `tests/app/workerClient.test.ts` (fake worker emitting `messageerror`).

## Constraints

- Frozen oracles untouched; `npm run test:swap` and `npm run verify` stay green.
- No new dependency; keep the worker core pure and lore-free (the import-graph test must stay green).

## Acceptance Criteria

- [ ] Each item has a regression test that fails without the fix
- [ ] `npm run verify` green

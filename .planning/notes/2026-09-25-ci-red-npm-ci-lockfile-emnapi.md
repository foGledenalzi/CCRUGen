---
date: "2026-09-25 23:32"
promoted: false
---

We are going red on both CI runners right now: `npm ci` fails with EUSAGE ("package.json and package-lock.json are not in sync", "Missing: @emnapi/core@1.11.3 from lock file", "Missing: @emnapi/runtime@1.11.3 from lock file"). Looks like npm package deprecations?

## Diagnosis (2026-09-25, reproduced locally)

Not deprecations (those show as `npm warn deprecated` and never fail an install). It is an **npm version mismatch**:

- `.github/workflows/ci.yml` uses `node-version: 22`, and the runners' Node 22 ships **npm 10.x**. `package-lock.json` was written by **npm 11** (this machine has 11.6.2; the docs and README say npm 11).
- Reproduced: `npx npm@10.9.3 ci --dry-run` fails with the identical two "Missing" lines; `npx npm@11 ci --dry-run` passes. That is why every local `npm run verify` and the verifier's `npm ci --dry-run` were green while CI is red.
- The two packages are peer dependencies (`@emnapi/core`, `@emnapi/runtime`, range `^1.7.1 || ^2.0.0-alpha.4`) of the optional WASM fallback of `@unrs/resolver-binding-wasm32-wasi` (reached through eslint-config-next's import resolver). npm 10 wants them hoisted at the top level (resolving to 1.11.3); the npm 11 lock only has them nested at 1.10.0 under that binding, so npm 10 sees the lock as out of sync. Both the ubuntu and windows runners hit it at `npm ci`, before any project code runs.
- The failed runs got as far as `npm ci`, so `actions/checkout@v7` and `actions/setup-node@v7` do exist (review IN-06 partly settled). `actions/cache@v6` and `actions/upload-artifact@v7` still have not executed.
- Nothing in the project code is wrong. This was the "CI has never run" risk (verification note, review IN-06); the first run found it.

## Fix (validated in a scratch copy, repo untouched)

Regenerate the lockfile with npm 10, which both versions accept:

```bash
npx npm@10.9.3 install --package-lock-only --ignore-scripts
```

Scratch result: the lock changes by 41 lines (adds hoisted `node_modules/@emnapi/core` and `@emnapi/runtime` at 1.11.3 plus `@emnapi/wasi-threads`), and then `npm ci --dry-run` exits 0 under **both** npm 10.9.3 and npm 11. Afterwards `git checkout -- yarn.lock` is not needed (yarn.lock is gone), but check `git status` for stray changes, and re-run `npm run verify`.

Alternatives, not preferred: (a) add `@emnapi/core` and `@emnapi/runtime` as exact-pinned devDependencies; (b) make CI use npm 11 (`npm install -g npm@11` before `npm ci`, or Node 24). Doing only (b) leaves other people's npm 10 installs broken, so regenerate the lock; pinning CI's npm to the same major as the docs is a fine addition.

## To do

- [x] Regenerate `package-lock.json` as above, confirm `npm ci --dry-run` passes under npm 10.9.3 and npm 11, run `npm run verify`, commit. Done 2026-09-26: lock regenerated with npm 10.9.3 (adds hoisted `@emnapi/core` and `@emnapi/runtime` 1.11.3; npm 10 also drops the `peer` flag on 14 entries, metadata only); a clean `npm ci` under npm 10.9.3 in a scratch git copy of HEAD, followed by the full `npm run verify` there, passed (236 unit tests x2 timezones, 70 e2e including the 60 goldens, 10 sub-path, page weight, repo guard).
- [ ] Prevent a repeat: run an npm-10 `npm ci --dry-run` in `check:repo` or as the first CI step's local twin, and state the supported npm range (README says npm 11; CI is on npm 10).
- [ ] Push (needs the user's OK) and watch the Actions tab: this was only the first failure, later steps (Playwright browser install, the action versions flagged in review IN-06, the ubuntu run of the whole verify chain) have never executed either.
- [ ] Timing: do it after the running UI declutter (todo 001) commits land, so the lockfile change does not collide with that executor, then push both together.

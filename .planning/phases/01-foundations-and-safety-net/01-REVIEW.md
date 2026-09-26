---
phase: 01-foundations-and-safety-net
reviewed: 2026-09-25T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - .eslintrc.json
  - .github/workflows/ci.yml
  - app/NumogramClient.tsx
  - app/components/navigation/LegacyQueryRedirect.tsx
  - app/layout.tsx
  - app/lib/basePath.ts
  - app/numogram/page.tsx
  - app/page.tsx
  - e2e/golden.spec.ts
  - e2e/static-export.spec.ts
  - e2e/visual-dom.ts
  - engine/index.ts
  - engine/package.json
  - engine/test/guard.test.ts
  - engine/test/tz.test.ts
  - engine/tsconfig.json
  - engine/tsconfig.test.json
  - next.config.js
  - package.json
  - playwright.config.ts
  - scripts/capture-base10-oracle.ts
  - scripts/check-repo.mjs
  - scripts/golden-manifest.mjs
  - scripts/page-weight.mjs
  - scripts/stage-basepath.mjs
  - tests/e2e-normalizer/visual-dom.test.ts
  - tests/oracle/base10.oracle.test.ts
  - tests/oracle/deriveBase10.ts
  - tests/perf/page-weight.test.ts
  - tests/repo/check-repo.test.ts
  - tests/repo/golden-manifest.test.ts
  - tsconfig.json
  - vitest.config.mts
findings:
  critical: 0
  warning: 5
  info: 10
  total: 15
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-25
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 1 is in good shape. There are no security findings: git is always invoked through `execFileSync` without a shell, `stage-basepath.mjs` whitelists its argument, `next.config.js` rejects a malformed base path (`//x`, trailing `/`), and the legacy redirect only forwards `location.search` and `location.hash` to a fixed path, so it cannot become an open redirect. `tsc --noUnusedLocals --noUnusedParameters` reports nothing for the reviewed files, so the share-image removal left no dead imports or state in `NumogramClient.tsx`. The `app/icon.svg` link is basePath-aware (Next's metadata image loader prefixes it). No timezone or line-ending nondeterminism was found in the oracle capture or the tests: the capture writes LF, the derivation takes no date, `vitest.config.mts` pins `TZ`, and Playwright pins `timezoneId` and `locale`.

The findings cluster around the safety net itself, where a guard can pass when it should fail:

- **WR-01:** a real base-path bug in a file outside the listed set, `CrtNavigationTransition.tsx`, that Phase 1's basePath support exposes.
- **WR-02:** three guard scripts silently do nothing (exit 0) when the checkout is reached through a symlink or junction. Reproduced on this machine.
- **WR-03:** `workflowProblems` matches substrings, so comments satisfy it. Reproduced.
- **WR-04:** the engine import-boundary lint rule does not stop relative imports that leave `engine/`. Reproduced.
- **WR-05:** the frozen-oracle manifests do not protect themselves.

## Warnings

### WR-01: Intercepted link clicks double the basePath (`/ccrug/ccrug/numogram/`)

**File:** `app/components/navigation/CrtNavigationTransition.tsx:99-107` (outside the listed set; reached through `app/NumogramClient.tsx:1597-1600`)
**Issue:** The click-capture handler reads `anchor.getAttribute('href')`. For a `next/link` built with `NEXT_PUBLIC_BASE_PATH=/ccrug` that href is already prefixed (`/ccrug/numogram/`). The handler passes `nextUrl.pathname` to `router.push`, and Next's app router runs `addBasePath` on every href (`node_modules/next/dist/client/components/app-router.js:169`, `addPathPrefix` does not check for an existing prefix). Scenario for the D-06 sub-path deployment:
- Open `/ccrug/numogram/`, select a zone. `replaceState` (`NumogramClient.tsx:582-583`) makes the URL `/ccrug/numogram/?selected=5`.
- Click the "CCRUG" header title, which is the `Link href="/numogram"` left after `showHomeLink={false}`.
- `next` (`/ccrug/numogram/`) differs from `current` (which carries the query), so the handler calls `preventDefault` and `router.push('/ccrug/numogram/')`, and Next navigates to `/ccrug/ccrug/numogram/`. That is a 404 on a static host.

At the root path the bug is invisible. `static-export.spec.ts` never clicks a link, so the sub-path suite cannot see it.
**Fix:** Strip the base path before handing the URL to the router, and compare un-prefixed values:
```ts
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const stripBase = (p: string) =>
  BASE_PATH && (p === BASE_PATH || p.startsWith(BASE_PATH + '/')) ? p.slice(BASE_PATH.length) || '/' : p
// ...
const next = `${stripBase(nextUrl.pathname)}${nextUrl.search}${nextUrl.hash}`
const current = `${stripBase(window.location.pathname)}${window.location.search}${window.location.hash}`
```
Add an e2e case to `static-export.spec.ts`: at `/numogram/?selected=5`, click `a[href$="/numogram/"]` and assert the URL matches `${BASE}/numogram/` and does not contain `${BASE}${BASE}` (only meaningful when `BASE` is non-empty).

### WR-02: Direct-run guard makes check-repo, page-weight and golden-manifest silent no-ops under a symlinked or junctioned checkout

**File:** `scripts/check-repo.mjs:327`, `scripts/page-weight.mjs:208`, `scripts/golden-manifest.mjs:250`
**Issue:** The CLI only runs when `import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href`. Node resolves the entry module's symlinks for `import.meta.url` but `process.argv[1]` is only made absolute. When the working directory is reached through a symlink or junction (a `/workspace` symlink in a cloud session, a `subst` drive, a junction), the two URLs differ, the `if` is false, and the script prints nothing and exits 0.

Reproduced here with a junction `jn -> C:\Users\MJMC\Desktop\CCRUG` (the junction was removed afterwards). From inside `jn`, `node scripts\check-repo.mjs --only no-such-check` and `node scripts\page-weight.mjs check` both printed nothing and exited 0. From the real path the first exits 1 with an error.

Consequences: `npm run check:repo`, `npm run check:weight` and the final `node scripts/check-repo.mjs --clean-tree --static-out` in `verify` pass vacuously. The unit suites do not catch it. Their CLI tests build the script path from `ROOT`, which is already a real path, so the two URLs agree. The suite can be fully green while the gate is off.
**Fix:** Compare real paths on both sides, and keep the check in one shared helper:
```js
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false }
})()
if (isMain) { /* run CLI */ }
```
Add a test that runs the script through a symlink (junction on Windows, skipped on EPERM) and expects exit 1 for an unknown check.

### WR-03: `workflowProblems` matches substrings, so comments satisfy the CI guard

**File:** `scripts/check-repo.mjs:97-105`; interacts with `.github/workflows/ci.yml:1`
**Issue:** The guard uses `yml.includes(...)`. Line 1 of the real `ci.yml` is a comment containing `` `npm run verify` ``. Reproduced against the real file:
- Replacing the `- run: npm run verify` step with `- run: echo skipped` gives `workflowProblems(...) === []`.
- Changing the token to `contents: write # was contents: read` also gives `[]`.

`check:repo` therefore still reports the workflow as compliant when it no longer runs the verify gate or when the token is writable. The unit tests use a comment-free fixture (`WORKFLOW`), so `it.each([...])('flags a workflow missing ...')` cannot see this.
**Fix:** Strip comments and match structure:
```js
const body = yml.split(/\r?\n/).map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n')
if (!/^\s*-\s*run:\s*npm run verify\s*$/m.test(body)) problems.push('workflow does not run "npm run verify"')
if (!/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(body)) problems.push('workflow token is not contents: read')
if (/\bwrite-all\b|:\s*write\b/.test(body)) problems.push('workflow requests write permissions')
```
Keep the `ubuntu-latest`, `windows-latest` and `pull_request_target` checks on the stripped text. Add a test that feeds the real `ci.yml` with the run line replaced.

### WR-04: ESLint boundary does not block relative imports that leave `engine/`

**File:** `.eslintrc.json:5-11`
**Issue:** `import/no-restricted-paths` only lists `./app` and `./workers`. The syntax rule blocks non-relative specifiers, but a relative specifier that climbs out of `engine/` passes. Reproduced with the ESLint API on a virtual `engine/core/__probe__.ts`: `../../tests/oracle/deriveBase10` (which itself imports `app/data/*`), `../../scripts/golden-manifest.mjs` and `../../component-library/index` all produce zero boundary messages. `tsc -p engine/tsconfig.json` does not help either: `types: []` only bans ambient DOM/Node globals, not files that happen not to use them. This is the "engine/ is pure, relative imports only" rule (FND-04). `guard.test.ts` only tests a direct `../../app/` import, so the hole is untested.

Separately, `files: ["engine/**/*.ts"]` and `include: ["**/*.ts"]` skip `.tsx`, `.mts`, `.cts`, `.js` and `.mjs` under `engine/`, so purity rules and `tsc` do not apply to them.
**Fix:** Replace the two zones with one that forbids leaving `engine/`. Verified with the ESLint API: `../../tests/...` and `../../app/...` are flagged, `./other` and `../other` are allowed.
```json
"import/no-restricted-paths": ["error", { "zones": [
  { "target": "./engine", "from": "./", "except": ["./engine"], "message": "engine/ may only import from engine/" }
]}]
```
Widen `files` to `engine/**/*.{ts,tsx,mts,cts,js,mjs,cjs}` and the engine tsconfig `include` to match. Add `guard.test.ts` cases for `../../tests/...` and `../../scripts/...`.

### WR-05: Frozen-oracle manifests do not protect themselves

**File:** `scripts/golden-manifest.mjs:122-148`; `scripts/check-repo.mjs:21,267`
**Issue:** `verifyManifest` checks files against the hashes in `MANIFEST.json`, but nothing pins `MANIFEST.json`, and `listFiles` and `verifyManifest` skip it on purpose. Scenario: a golden is deleted, recaptured (`GOLDEN_CAPTURE=1` writes missing snapshots) or `base10.golden.json` is re-derived, and the sha256 in `MANIFEST.json` is edited by hand. `freeze` refuses to re-freeze, so a hand edit is the only route. `check-repo goldens`, `npm run verify`, CI and `--clean-tree` (which only detects uncommitted changes) all pass once it is committed. An accidental `playwright test -u` is caught (hash mismatch), but the core rule "never regenerated to make a test pass" is not enforced against the deliberate two-file edit that an agent or hurried human would make. `engine/test/fixtures/MANIFEST.json` also has `strictDir: null`, so a stray fixture there is only caught by `--clean-tree`.
**Fix:** Pin the frozen sets inside the guard script so changing them needs a visible edit of a second tracked file:
```js
// check-repo.mjs
export const FROZEN_SET_DIGESTS = {
  '2026-09-26-baseline': '<sha256 of JSON.stringify(sortedEntries(set.files))>',
  '2026-09-26-base10-numeric': '<...>',
}
// goldens check: for each pinned set name, recompute the digest from the manifest and fail on mismatch or absence
```
Alternatively, in CI compare each pre-existing set entry against the merge-base copy of the manifest and fail on any changed or removed entry (append-only). Set `strictDir: "engine/test/fixtures"` for the numeric oracle.

## Info

### IN-01: `gitattributesProblems` checks presence only

**File:** `scripts/check-repo.mjs:111-114`
**Issue:** Any line equal to `* text=auto eol=lf` passes, even when a later rule overrides it. `gitattributesProblems('* text=auto eol=lf\ne2e/__golden__/** eol=crlf\n')` returns `[]` (reproduced). The `lf` check (CR scan of the frozen dirs) and the manifest CR check bound the damage, so this is only defence in depth.
**Fix:** Also reject `eol=crlf`, `-text` or `text=auto eol=crlf` on any later line, or drop the check in favour of the CR scans.

### IN-02: page-weight silently skips missing assets, and the DOM-node budget cannot fail on live behaviour

**File:** `scripts/page-weight.mjs:52-55`, `70-77`
**Issue:** (a) An asset referenced by an `index.html` but absent from `out/` is skipped (`if (!existsSync(file)) continue`, and a unit test enshrines it), so a regex that stops matching or a truncated match yields `jsBytes: 0`. `compare` only flags growth, so a zero passes. On the current export the regex matches every referenced chunk (8 and 9 assets, none missing; checked). (b) `measureDomNodes` counts elements in the frozen goldens, not in the running app. It can only change when a golden changes, and goldens are already hash-frozen and compared by Playwright, so this budget is tautological.
**Fix:** (a) Make a referenced-but-missing asset a problem, or assert `jsBytes > 0` for every route with a script tag. (b) Document the DOM metric as a golden-size ledger, or measure it from the live page in `test:e2e`.

### IN-03: `stage-basepath.mjs` has no retry for Windows directory-lock flakes

**File:** `scripts/stage-basepath.mjs:17-19`
**Issue:** `rmSync(STAGE, ...)` and `renameSync('out', ...)` fail with EPERM or EBUSY on Windows when an indexer, antivirus or a leftover `serve` process holds a handle. The chain then aborts with a stack trace mid-`verify`.
**Fix:** `rmSync(STAGE, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })`, and fall back to `cpSync(..., { recursive: true })` followed by `rmSync('out', ...)` when `renameSync` throws.

### IN-04: Root page uses a relative noscript link and duplicates the base-path read

**File:** `app/page.tsx:9`, `app/components/navigation/LegacyQueryRedirect.tsx:4,10`, `app/lib/basePath.ts:2`
**Issue:** `<a href="numogram/">` resolves to `/numogram/` if the host serves the root page at `/ccrug` without the trailing slash. `LegacyQueryRedirect` re-reads `NEXT_PUBLIC_BASE_PATH` instead of using `withBasePath`, so there are two readers to keep in sync.
**Fix:** `<a href={withBasePath('/numogram/')}>` in `page.tsx`, and `window.location.replace(withBasePath('/numogram/') + window.location.search + window.location.hash)` in the redirect.

### IN-05: Origin guard only inspects the fetch URL

**File:** `scripts/check-repo.mjs:236-245`
**Issue:** `git remote get-url origin` prints the fetch URL. A `remote.origin.pushurl` pointing at `lumpenspace/ccru` is not seen, which matters because CLAUDE.md forbids pushing to upstream.
**Fix:** Also run `git remote get-url --push origin` and apply `isUpstreamOrigin` to both.

### IN-06: CI hardening

**File:** `.github/workflows/ci.yml:12-14,29-30,38,48`
**Issue:** The triggers and permissions are safe (`pull_request`, not `_target`; `contents: read`; no secrets; no untrusted `${{ }}` in `run:`). Remaining points:
- Actions are pinned by mutable tag (`@v7`, `@v6`).
- The tags `checkout@v7`, `setup-node@v7`, `cache@v6` and `upload-artifact@v7` could not be verified offline, and the workflow is dormant, so a wrong major would first surface on the first push.
- `cancel-in-progress: true` on `refs/heads/main` cancels the previous commit's verify run when pushes land back to back, which hides a failure on the earlier commit.
**Fix:** Pin actions to full SHAs, with the tag in a trailing comment. Confirm the majors exist before the first push. Use `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.

### IN-07: Playwright's `serve` binds all interfaces and may switch ports

**File:** `playwright.config.ts:24`
**Issue:** `npx serve <dir> -l <port>` listens on all interfaces during the local test run (a Windows firewall prompt, LAN-visible static export). Without `--no-port-switching`, `serve` moves to another port if the requested one is taken. `reuseExistingServer:false` catches the common case, but the failure mode is confusing.
**Fix:** `npx serve ${STATIC_DIR} -l tcp://127.0.0.1:${PORT} --no-clipboard --no-port-switching`.

### IN-08: Weak or misleading tests

**File:** `engine/test/tz.test.ts:14-16`, `tests/repo/check-repo.test.ts:294-297`, `tests/perf/page-weight.test.ts:225-229`
**Issue:**
- `keeps ISO output independent of the zone` asserts a property of the language spec and cannot fail. It is harmless, but it is not part of the canary.
- `never contacts a remote` greps for single-quoted `'push'` and so is bypassed by double quotes or template literals.
- The page-weight CLI test says the refusal path never writes, but if the `--reason` check regressed it would write the real `perf/page-weight.baseline.json` whenever `out/` exists.

**Fix:** Drop the ISO test, or move it next to the date code it protects. Grep with `/['"`](push|fetch|pull|ls-remote|clone)['"`]/`. Run the CLI test with `cwd` set to a temp copy of the script or a stubbed `out/`.

### IN-09: Manifest dates and `freeze` argument handling

**File:** `scripts/golden-manifest.mjs:209,222`
**Issue:** The set date is the UTC date, so the baseline captured on the evening of 2026-09-25 (local, UTC-6) is named `2026-09-26-baseline`. That is consistent but surprising. `--strict-dir` is silently ignored when the manifest already exists. Nothing checks that the `YYYY-MM-DD` prefix of a set name equals `date`.
**Fix:** Print the UTC date used, reject an ignored `--strict-dir` (or update `strictDir`), and validate that the name prefix equals `date`.

### IN-10: Share flow leftovers in `NumogramClient.tsx`

**File:** `app/NumogramClient.tsx:965,971-981`
**Issue:** After the upload flow was removed, `let finalParams = new URLSearchParams(baseParams)` followed by `finalParams = sortSearchParams(finalParams)` is a redundant copy and reassignment. The share button is now the only share path. When `navigator.share` is missing and `navigator.clipboard` is undefined (an insecure `http://` origin), `navigator.clipboard.writeText` throws a TypeError that the empty-comment `catch` swallows, so the button does nothing with no feedback.
**Fix:** `const query = sortSearchParams(baseParams).toString()`. In the `catch`, fall back to `window.prompt('Copy this link', url)` or surface an error state.

---

_Reviewed: 2026-09-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

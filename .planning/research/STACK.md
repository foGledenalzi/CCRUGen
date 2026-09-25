# Stack Research

**Domain:** Arbitrary-base numogram generator (pure TS engine + procedural layout + tiered renderers) added to an existing Next.js 14 / React 18 / TS / Tailwind base-10 viewer, shipped as a static export
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH. Versions, engines, peer ranges and publish dates are from the npm registry on 2026-09-25 (HIGH). Next.js behavior is from official docs (HIGH). Renderer-tier thresholds are LOW by design (the ceiling spike must measure them).

Scope: this file turns the open stack questions in `ARCHITECTURE.md` / `PITFALLS.md` / `FEATURES.md` into concrete, version-pinned choices. It does not re-describe the existing system (`.planning/codebase/STACK.md`) or repeat the architecture; where it disagrees with an earlier file it says so under "Deltas".

## Decision Summary

| # | Question | Decision | Confidence |
|---|----------|----------|------------|
| 1 | Tests | **Vitest 5.0.2** (node env, `test.projects`) + **fast-check 4.10.2** + **@playwright/test 1.63.0** (Chromium only, text/DOM goldens). No `vite-tsconfig-paths`; engine uses relative imports. | HIGH (Vitest/fast-check), MEDIUM (Playwright golden workflow) |
| 2 | Render tiers | **React SVG** (existing) -> **hand-rolled Canvas2D** (cached layers, `Path2D`, grid + id-buffer picking) -> **headless string SVG/JSON**. Demons = one `ImageData` matrix at *viewport* resolution. **No WebGL/PixiJS/regl in v1**; PixiJS 8 is the named contingency. | MEDIUM (direction), LOW (thresholds) |
| 3 | Layout | **Hand-rolled** ring / spiral / ladder / diameters + Fermat-spiral glyph packing inside `engine/layout`. No layout library. d3-force 3.0.0 only as a deferred, optional polish pass. | HIGH |
| 4 | Static export | `output: 'export'`, delete the POST route, static metadata, client-side redirect. **Stay on Next 14.2.35 (pinned) for this milestone; skip 15; make a Next 16 upgrade its own late phase gated by the Playwright goldens.** | HIGH (changes), MEDIUM (stay-vs-upgrade judgment) |
| 5 | SVG/PNG export | SVG generated from the model by a string builder (never DOM capture). PNG via native `Image` -> `canvas.toBlob` with size clamping. Poster text as **outlined paths from a build-time glyph table**. **`@resvg/resvg-wasm` 2.6.2 deferred** behind the same `rasterize()` interface. | MEDIUM |
| 6 | Workers | `new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' })` under Next 14 webpack; hand-rolled message protocol with transferables; no Comlink; no OffscreenCanvas in v1. | MEDIUM |
| 7 | TS / lint | Root `target: ES2022`; **TypeScript pinned to 5.9.3 (not 7)**; **ESLint stays 8.57.1**; `engine/tsconfig.json` (lib ES2022, `types: []`); lint the engine explicitly (`next lint` skips `engine/` by default). | HIGH |
| 8 | Build tooling | Decouple: `build` = `next build`. Replace the `zip` binary with **fflate 0.8.3** `zipSync` and a fixed mtime (deterministic). | HIGH (decouple), MEDIUM (byte-determinism across TZ; test it) |
| 9 | PRNG | **Hand-roll sfc32 + cyrb128 seeding** (~30 lines, `Math.imul`, pinned algorithm id, frozen test vectors). No package. | HIGH |

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | **14.2.35 (exact pin)** | App shell, static export | Project constraint (build off the repo). 14.2.35 is the last 14.x (`next-14` dist-tag). With `output: 'export'` no Next server runs in production, which removes the server-side exposure that makes "Unsupported" matter. See Q4 for the upgrade plan. |
| React / React DOM | 18.3.x (existing) | UI | Unchanged. Next 16 peers still allow `^18.2`, so React is not what blocks a later upgrade. |
| TypeScript | **5.9.3 (`~5.9.3`)** | Type-check | Latest 5.x. **Do not adopt 7.0.2**: it ships without the legacy JS API that Next's type-checker and typescript-eslint call (stable API expected in 7.1). |
| Tailwind CSS | 3.4.x (existing) | Styling | Unchanged. |
| ESLint | **8.57.1 (existing, exact)** | Lint | `eslint-config-next@14.2.35` peers `eslint ^7.23 \|\| ^8`. ESLint 10.11.0 exists but cannot be used with this Next line. |
| Vitest | **5.0.2** | Unit, golden and property test runner | Native ESM/TS, fast, first-class `test.projects`, documented TZ pinning. Requires Node `^22.12 \|\| ^24 \|\| >=26` (local Node 22.16.0 OK). |
| Vite | **8.3.1** (Vitest peer) | Test transform only | Vitest 5 peers `vite ^6.4 \|\| ^7 \|\| ^8`; 8.3.1 is `latest` (Node `^20.19 \|\| >=22.12` OK). Fallback if anything misbehaves on Windows: `7.3.6` (the `previous` dist-tag). Next never uses Vite. |
| fast-check | **4.10.2** | Property tests | Standard PBT library for TS; used for large-domain properties (mesh round-trip, URL codec, layout invariants), not for the exhaustive small-n sweeps. |
| @playwright/test | **1.63.0** | DOM golden master + a few smoke tests | Needed for the pre-refactor golden capture of the untouched viewer. `next@16` also peers `@playwright/test ^1.51.1`, so no conflict later. |
| Browser Canvas 2D + `Path2D` + typed arrays | native | Canvas tier and demon matrix | Zero dependencies; the engine already emits SoA `Float64Array`s and path strings. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fflate | 0.8.3 | Deterministic ZIP for `build:plugin-zip` | Replaces the missing `zip` binary (Q8). Dev dependency. |
| tsx | 4.23.15 | Run `engine/cli/main.ts` | CLI only. Resolves extensionless relative imports (bare `node` type-stripping does not). |
| cross-env | 10.1.0 | Set env vars in npm scripts on Windows | Only if a script needs `NEXT_PUBLIC_BASE_PATH=... next build` or `TZ=UTC vitest run`. Node >= 20. |
| serve | 14.2.6 | Preview `out/` and back the Playwright web server for the static build | `next start` is not for `output: 'export'`. |
| @tanstack/react-virtual | 3.14.13 | Windowed lists (zones, syzygies, currents, gates, 221k-row demon browser) | Recommended over hand-rolling once rows need `scrollToIndex`, keyboard focus or variable height. Hand-rolled fixed-height is fine for the first cut. |
| opentype.js | 2.0.0 (published 2026-05-06) | **Dev-only** script that generates the outlined-glyph table | Poster export (Q5). Confirm `Font.getPath(...).toPathData()` still exists in the 2.0 major before writing the script; fallback `fontkit`. |
| @resvg/resvg-wasm | 2.6.2 | Deterministic / very large PNG | **Deferred.** Add only if the export phase proves canvas limits (Safari) or byte-stable PNGs are needed (Q5). |
| @vitest/coverage-v8 | 5.0.2 | Coverage | Optional; useful to show the golden suite exercises every engine branch. |
| d3-force | 3.0.0 (last publish 2022-06) | Optional relaxation pass after ring layout | **Deferred** (L5 in ARCHITECTURE). Has `simulation.randomSource` for seeding. Never in `engine/core`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `engine/tsconfig.json` | Compiler-enforced engine boundary | `lib: ["ES2022"]`, `types: []`, `noUncheckedIndexedAccess`. Excludes `test/` and `cli/`, which get `engine/tsconfig.test.json` (`types: ["node"]`). |
| ESLint override for `engine/**` | Lint-enforced boundary | `no-restricted-imports`, `no-restricted-globals`, `no-restricted-syntax`, `import/no-restricted-paths` (see Q7). |
| `.gitattributes` | LF fixtures on Windows | `* text=auto eol=lf` before the first golden file is committed (`core.autocrlf=true` here, none exists today). |
| npm 11 | Single package manager | Delete `yarn.lock`, add `"packageManager": "npm@11.6.2"` and `"engines": {"node": ">=22.12"}`. |

## Installation

```bash
# Pin the framework line (exact; Next 14 is out of support, do not let it float)
npm install --save-exact next@14.2.35
npm install -D --save-exact typescript@5.9.3 eslint@8.57.1 eslint-config-next@14.2.35

# After removing their usages (Q4): decouple from Vercel
npm uninstall @vercel/blob @vercel/analytics

# Tests. @types/node must move ^20 -> ^22 (Vitest 5 optional peer is ^22 || >=24)
npm install -D vitest@5.0.2 vite@8.3.1 fast-check@4.10.2 @playwright/test@1.63.0 @types/node@^22
npx playwright install chromium

# Tooling
npm install -D tsx@4.23.15 fflate@0.8.3 cross-env@10.1.0 serve@14.2.6

# Optional / deferred (do not install until the phase needs them)
# npm install @tanstack/react-virtual@3.14.13
# npm install -D opentype.js@2.0.0        # glyph-table generator script only
# npm install @resvg/resvg-wasm@2.6.2     # only if export phase proves the need
```

## Q1. Test stack

**Use Vitest 5.0.2 in `environment: 'node'`, one `engine` project, explicit imports (no globals).** Jest/`next/jest` adds ESM and TS transform friction for a pure-TS ESM engine and gives nothing Vitest lacks. `jsdom`/`happy-dom` are unnecessary: the engine has no DOM.

```ts
// vitest.config.ts (repo root)
import { defineConfig } from 'vitest/config'

// Documented (Vitest common-errors guide): assigning process.env.TZ at the top level of the
// config sets it in the main process before worker pools start. Do not rely on it alone: see canary below.
process.env.TZ = 'UTC'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          environment: 'node',
          include: ['engine/**/*.test.ts'],
          testTimeout: 30_000, // exhaustive sweeps over even n <= 2000
        },
      },
      // add { test: { name: 'app', include: ['app/**/*.test.ts'] }, resolve: { alias: [{ find: /^@\//, replacement: <abs root>/ }] } }
      // only when app-side tests exist. One regex alias is enough; do NOT add vite-tsconfig-paths (6.1.1).
    ],
  },
})
```

- **Engine imports are relative only**, so Vite needs no `paths` plugin and `next build`'s type-check and Vitest agree. Playwright specs live in `e2e/*.spec.ts` (not `.test.ts`) so Vitest never collects them.
- **Golden fixtures**: committed literal JSON (`engine/test/fixtures/base10.golden.json`) imported with `resolveJsonModule` and asserted with `toEqual`. Never `toMatchSnapshot`, never `vitest -u` in CI (PITFALLS #3).
- **Where fast-check earns its place**: mesh <-> net-span round-trip up to `2^26`, URL codec round-trip and legacy-URL equivalence, SoundMap JSON round-trip, layout invariants (`Number.isFinite`, no glyph overlap) over random even `n`. **Where it does not**: the structural properties over even `n` in 2..2000 (warp iff `n = 3o+1`, `o` odd; permutation; type counts sum to `C(n,2)`) are plain deterministic `for` loops, which are exhaustive, reproducible and faster. Use `fc.assert(prop, { numRuns, seed })` with a committed seed for CI; allow `FC_SEED=random` for exploratory local runs. `@fast-check/vitest` 0.5.0 exists (peers `vitest ^4.1 || ^5`) but is pre-1.0 and buys only sugar; skip it.
- **Pinned TZ/date, three layers** (Windows behavior of runtime `process.env.TZ` was not verified, so assert it):
  1. `process.env.TZ = 'UTC'` in the config (documented) and `cross-env TZ=UTC vitest run` in the `test` script (set before Node starts).
  2. A canary test: `expect(new Date(2000, 0, 1, 12).getTimezoneOffset()).toBe(0)`. If the pin silently fails on a machine, this fails loudly instead of the goldens drifting.
  3. Make the code TZ-independent: engine functions take dates as arguments; the `engine/**` ESLint rule bans zero-argument `new Date()` and `Date.now()` (Q7).
- **Playwright for DOM golden masters (P0, run against the pre-refactor commit):**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  // No {platform}/{projectName} in the path: one golden file shared by Windows and Linux (DOM text is OS-independent; PNG is not)
  snapshotPathTemplate: '{testDir}/__golden__/{testFilePath}/{arg}{ext}',
  updateSnapshots: process.env.UPDATE_GOLDEN ? 'all' : 'none', // a missing/changed golden must fail, not self-heal
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3111', timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next dev -p 3111',            // pre-refactor baseline; switch to `serve out -l 3111` once export works
    url: 'http://127.0.0.1:3111/numogram',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```
  In each spec: `await page.clock.setFixedTime('2000-01-01T12:00:00Z')` (documented: fixes `Date` without faking timers, so `requestAnimationFrame` tweens still run), drive the app's own URL matrix with `date=2000-01-01&orbits=0&particles=0`, wait for tween settle, then `expect(normalizedOuterHTML).toMatchSnapshot('labyrinth-tc.svg.txt')`. **Goldens are normalized `svg.outerHTML` text, not screenshots.** Pixel PNGs differ per OS/GPU and would make Windows-generated goldens fail on Linux CI. Chromium only: Firefox/WebKit add nothing for a DOM-text golden.

## Q2. Rendering tiers (per tier)

The graph itself is small: at `n` zones there are about `2n` edges (n/2 syzygies + n/2 currents + n gates). Only the demon layer is O(n^2). That asymmetry decides the stack.

| Tier | Tech | Use when (starting hypotheses, replaced by the spike) | Documented anchor |
|------|------|-------------------------------------------------------|-------------------|
| **T1 SVG** | React SVG (today's `Projection`) generalized to take a model. Full effects (filters, gradients, glow) to ~`n` 32; reduced (no filters, one delegated pointer handler on the root, no per-element closures) to ~`n` 150. Demons: `focus` mode, or `web` mode only while chords <= ~300 (`n` <= ~24). | Base 10 always; small bases. Roughly 8-10 DOM nodes per zone once labels, hit targets and glow are counted, so `n` 150 is ~1.5k nodes. | Community guidance of "a few thousand SVG nodes" (LOW; see FEATURES sources). yWorks' comparison article gives **no** numeric thresholds (checked). |
| **T2 Canvas2D** | Hand-rolled. Static layers (zones, syzygies, currents, gates) painted once to cached bitmaps; pan/zoom = `drawImage` with a transform, re-raster only on layout/zoom-step change. Overlay canvas for hover/selection. `Path2D` cached per route. Picking: uniform-grid index for zones, offscreen id-color buffer for edges. LOD: labels only when screen node radius > ~7 px, dot mode beyond ~2k zones. | `n` ~150 up to ~10^4 (dots). | **Cytoscape.js official blog** (WebGL preview post): ~1,200 nodes / 16,000 edges runs ~20 FPS on the *Canvas* renderer redrawing every frame, and ~3,200 nodes / 68,000 edges runs ~3 FPS; hardware unspecified (MEDIUM). Lesson: never full-redraw a styled graph every frame past ~1k nodes / ~10k edges; cache and transform. Our graph is ~2n edges (2,000 at `n`=1000), far below those cases. |
| **T3 Headless** | `engine/scene` string builder (`sceneToSvg`, `sceneToJson`), CLI via tsx, worker for large files. | `n` >= ~10^4-10^5, or any export. | n/a |
| **Demon matrix** (all demons at any `n`) | `Uint8ClampedArray` RGBA -> `ImageData` -> `putImageData` (or `createImageBitmap`). **Raster at viewport resolution, not `n x n`**: each pixel bins a rectangle of `(a,b)` cells and takes the dominant subtype from the closed-form classifier. | `n` >= ~100; mandatory at `n` >= ~2k. | `n`=1000 is 1M cells (1M px, fine); `n`=10^4 as a full raster would be 10^8 px = 400 MB RGBA, which is why binning to the viewport is required, not optional. |

**No WebGL in v1, and this is a sourced decision, not a preference.** The same Cytoscape post shows even its *WebGL* renderer only reaching ~10 FPS at 3,200 nodes / 68,000 edges: edge-heavy graphs do not become interactive just by moving to the GPU. Drawing 221k-499k demon chords is hopeless in every tier and unreadable anyway (alpha saturates, PITFALLS #8), so demons are a raster matrix plus focus-mode chords. That removes the only workload where WebGL would pay off.

**Contingency (only if the spike shows Canvas2D cannot hold ~30 FPS pan/zoom at the target `n` after layer caching):** PixiJS 8.21.0 (published today, very active; ~75 MB unpacked on disk but tree-shakeable), or ~200 lines of raw WebGL2 point sprites + line lists over the engine's existing typed arrays. Not `regl` (2.1.1, last publish 2024-11), not deck.gl/three.js (weight and scene-graph overhead for a 2D diagram), not Sigma.js 3.0.3 (needs a graphology object graph, which costs memory at 10^5 nodes). Confidence LOW; the decision belongs to the spike.

**OffscreenCanvas is not needed.** Worker output is typed arrays (transferred) drawn on the main thread; `createImageBitmap` covers the rest. Feature-detect and defer `transferControlToOffscreen` until a measured main-thread paint stall justifies it.

## Q3. Procedural layout

**Hand-roll it in `engine/layout` (already designed in ARCHITECTURE: ring glyph per Torque cycle, Fermat-spiral packing, spiral, ladder, diameters).** Reasons, in order of weight:

1. The structure is *analytic*: cycles, alternation of odd/even zones, and pair adjacency are known before any solver runs. A generic layout engine would have to rediscover it and can only approximate it; the hand-rolled ring satisfies "syzygy pair adjacent, cycle is a `2L`-gon" **by construction**, which is testable as an invariant.
2. Determinism: index-derived positions rounded to fixed decimals are reproducible across engines (PITFALLS #15). Iterative solvers are not guaranteed to be.
3. The engine stays dependency-free and runs unchanged in CLI, worker and tests.

| Candidate | Facts (registry, 2026-09-25) | Verdict |
|-----------|------------------------------|---------|
| **Hand-rolled** | O(n + k^2); prototype timings 0.1-6 ms up to 180 glyphs (ARCHITECTURE) | **Use** |
| d3-force 3.0.0 | 89 KB unpacked, zero-dep, last publish 2022-06 (stable, frozen). Seedable via `simulation.randomSource`; initial placement is a deterministic phyllotaxis. No notion of cycles; force layouts jitter and use `Math.cos/sin`. | Deferred L5 polish only, behind a fixed iteration count and coordinate rounding |
| elkjs 0.12.0 | 8.0 MB unpacked, async (needs a worker), layered/radial algorithms, no cycle-ring concept | No |
| @hpcc-js/wasm-graphviz 1.29.1 | 2.1 MB unpacked wasm, async; `circo`/`neato` cannot pin our rings, output varies by version | No |

Optional cross-check: `d3-hierarchy`'s `packSiblings` is a good *test oracle* for the glyph-packing routine (dev-only), but keep the shipped packer in the engine.

## Q4. Static export on Next 14.2: exact changes, and whether to upgrade

Verified against the Next 14.2.35 static-exports page (last updated 2024-01-18). Unsupported under `output: 'export'`: dynamic routes without `generateStaticParams`, **Route Handlers that rely on `Request`** (only `GET` is supported), cookies, rewrites, redirects, headers, middleware, ISR, default-loader image optimization, draft mode. "Attempting to use any of these features with `next dev` will result in an error." The page does **not** list `searchParams` or `redirect()` explicitly; those cases below are avoided rather than tested.

Findings from the repo: no `next/image` or `next/font` usage (only plain `<img>`, so **no `images` config needed**); `useRouter`/`usePathname` are used only in client components; `app/sitemap.ts` and `app/robots.ts` exist; `app/gematria/saved/page.tsx` calls `redirect('/gematria')` unconditionally.

```js
// next.config.js
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',            // UNCONDITIONAL: any future route handler / dynamic API then fails `next build`
  trailingSlash: true,         // /numogram -> out/numogram/index.html (works on any static host)
  ...(basePath ? { basePath } : {}),
  eslint: { dirs: ['app', 'engine', 'workers'] }, // Next 14 only: `next build` lints just app/pages/components/lib/src by default
}
```

| # | Change | File | Why |
|---|--------|------|-----|
| 1 | **Delete** the directory; also delete `scripts/share-image-self-check.mjs` and the `test:share-image` script | `app/api/share-image/` | `POST` + `req.json()` is a Request-dependent handler. Removing only the `@vercel/blob` import is not enough. |
| 2 | Remove `import { Analytics }` and `<Analytics />`; `npm uninstall @vercel/blob @vercel/analytics` (after 1) | `app/layout.tsx` | Otherwise off-Vercel hosts 404 on `/_vercel/insights/script.js`. |
| 3 | `metadataBase` and `openGraph.url` from `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'` | `app/layout.tsx` | The hard-coded `num.qliphoth.systems` is wrong for any other host. |
| 4 | Drop the `searchParams` prop and `redirect()`; add a tiny client component using `location.replace` (not `useSearchParams`, which would require a `<Suspense>` boundary in a static build) | `app/page.tsx` | The redirect depends on the query string, which does not exist at build time. |
| 5 | Delete `generateMetadata({ searchParams })` and its helpers (`parseSelectedIds`, `normalizeImageUrl`, `buildShareDescription`); export a static `metadata` | `app/numogram/page.tsx` | Per-share OG tags cannot exist in a static site (crawlers do not run JS). `img=` becomes a parsed-and-ignored legacy param. |
| 6 | Add `export const dynamic = 'force-static'` defensively | `app/sitemap.ts`, `app/robots.ts` | These are `GET` metadata routes and should export as-is on 14; the directive is harmless insurance. Source hosts from the env var. |
| 7 | Expect a meta-refresh page from the unconditional `redirect('/gematria')`; if the first export build errors, replace with the same client redirect | `app/gematria/saved/page.tsx` | Unverified (MEDIUM); confirm in the first `next build`. |
| 8 | Replace the share flow's `fetch('/api/share-image')` with copy-URL + PNG download; keep `captureShareDataUrl` as the seed of PNG export | `NumogramClient.tsx` | See Q5. |
| 9 | Preview with `serve out`, never `next start` | scripts | `next start` is not for `output: 'export'`. |
| 10 | Sub-path hosting only: `NEXT_PUBLIC_BASE_PATH` (via `cross-env`), a `withBasePath()` helper for the plain `<img src="/numogram-logo.svg">` tags and `metadata.icons`, and a `public/.nojekyll` for GitHub Pages | `app/page.tsx`, `public/` | Plain `<img>`/icon strings are not auto-prefixed (PITFALLS #12). |

```tsx
// app/components/LegacyQueryRedirect.tsx
'use client'
import { useEffect } from 'react'
const KEYS = ['layout','selected','layers','region','tc','particles','date','orbits','img','base'] // 'base' is new
export function LegacyQueryRedirect() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (KEYS.some(k => q.has(k))) window.location.replace('/numogram/' + window.location.search)
  }, [])
  return null
}
```

### Upgrade decision: stay on 14.2.35 now, skip 15, schedule 16 separately

| Option | Facts | Verdict |
|--------|-------|---------|
| **Stay on 14.2.35** | Next's support-policy page lists 14.x as **Unsupported** (no exact EOL date is given); the last release is 14.2.35. In a static export there is no Next server in production, so middleware/image-optimizer/RSC-server vulnerability classes are not exposed (this is reasoning, not a sourced claim). Debt that remains: ESLint 8 and `eslint-config-next@14` are frozen. | **Do for this milestone.** Pin exact. |
| Next 15.5.26 | Maintenance LTS; per the support-policy page it stays there for two years from 2024-10-21, i.e. until **2026-10-21, under four weeks from today**. | **No.** A dead-end stop. |
| **Next 16.3.6** | Active LTS. Node >= 20.9, TypeScript >= 5.1, React peer `^18.2 \|\| ^19`. Browsers Chrome/Edge/Firefox 111+, Safari 16.4+. **Turbopack is the default for `next dev` and `next build`**; a project with a custom `webpack` config **fails** `next build` unless `--webpack` (we have no custom webpack config). **`next lint` is removed and `next build` no longer lints**; `next.config` `eslint` option removed; `eslint-config-next` moves to flat config (codemod `next-lint-to-eslint-cli`). Async `searchParams`/`params` (moot after Q4 changes). | **Yes, but as its own phase after** the static export, Playwright goldens and base-10 migration are green: the goldens are the safety net that makes the upgrade a diff review instead of a leap of faith. Run `next build --webpack` first, and treat Turbopack worker bundling (Q6) as unverified until tried. |

Triggers to pull the upgrade earlier: a required dependency drops Next 14, a build-time advisory affects the export pipeline, or React 19 features are wanted. None identified.

## Q5. SVG -> PNG and SVG file export in the browser

**SVG file:** generate it from the model with the `engine/scene` string builder, never by serializing the live DOM (Tailwind classes, `var()` and `<foreignObject>` do not survive; PITFALLS #14). Explicit `width`/`height`/`viewBox`, literal attribute styling, coordinates rounded to 2-3 decimals, layer groups (`<g id="layer-...">`), an XML-escape utility that also strips characters illegal in XML 1.0, and a test asserting no `<script>`, `<foreignObject>`, or external references. No sanitizer library is needed because nothing is parsed from user HTML.

**PNG (default path, zero dependencies):** `svgString -> Blob(type 'image/svg+xml;charset=utf-8') -> URL.createObjectURL -> Image.decode() -> canvas.drawImage -> canvas.toBlob('image/png')`. Use `toBlob`, not `toDataURL`, and treat `null`/`"data:,"` as a failure. Always write explicit `width`/`height` on the root (since Firefox 120 a missing size falls back to 300x150). Clamp the target size: Chrome caps at 32,767 px/side and 268,435,456 px area, Firefox at 32,767 px and 472,907,776 px, Safari at roughly 16,777,216 px (all secondary sources, MEDIUM). Default cap = 4096x4096 area so it works everywhere; allow larger only after a probe or a caught failure halves the scale.

**Fonts (the actual risk):** an SVG rendered through `<img>` cannot load external fonts, and data-URI `@font-face` inside the SVG is timing-sensitive across browsers (MEDIUM sources). So:

| Mode | Text | Used for |
|------|------|----------|
| `text` (default) | live `<text>` with a generic `font-family` stack | On-screen use, normal SVG download, screen-size PNG |
| `outlines` (poster) | glyph **paths** from a table generated at build time | Poster SVG/PNG; identical on every machine, no font loading |

Generate `engine/scene/glyphs.generated.json` with a **dev-only** script using `opentype.js` 2.0.0 and an OFL-licensed monospace font (check the license file before bundling): the labels are `0-9a-zA-Z` plus separators (`. , : ; + - =`), so the table is a few KB, and runtime `textToPath` is ~40 lines with no dependency (works in CLI and worker too). Custom alphabets (Hebrew, runic, Braille; FEATURES) cannot be covered by one font: fall back to `<text>` and show an export warning.

**`@resvg/resvg-wasm` 2.6.2: deferred, not rejected.** Verified API (package `index.d.ts`): `initWasm(module_or_path)`, `new Resvg(svg, { fitTo: { mode: 'width', value }, font: { fontBuffers: Uint8Array[], defaultFontFamily } })`, `.render().asPng()`. Its value is identical PNG bytes in every browser and in Node, and no canvas area cap (bounded by wasm memory) which is exactly what poster-size PNG on Safari needs. Costs: a 2.5 MB unpacked package, a `.wasm` asset to serve, and bundled fonts because wasm has no system fonts (the type file offers `fontBuffers`; it does not state the wasm limitation, so treat that as MEDIUM). If added: copy the `.wasm` into `public/vendor/` with a small cross-platform Node script (`fs.copyFileSync`) and `initWasm(fetch(withBasePath('/vendor/resvg.wasm')))`, rather than configuring webpack for wasm imports. Put both rasterizers behind one `rasterizeSvg(svg, { width, height }): Promise<Blob>` interface so the choice is swappable; the CLI can use resvg-wasm in Node as its single PNG path.

## Q6. Web Worker under Next 14 webpack

- **Syntax:** `new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' })`, with the `URL` expression literally inside the constructor (webpack 5 analyzes it statically; storing the URL in a variable breaks it). Sources: webpack.js.org web-workers guide and field notes for the App Router (MEDIUM); Next's webpack5 page confirms worker/`new URL` support.
- **Placement:** `workers/engine.worker.ts` at the repo root (outside `app/`, so the router ignores it), plain TS importing only `engine/*`, ending with `export {}`. No React, no `'use client'`, no `next/*`. Field reports say App Router pushes worker files through Next's loader before asset rules, so keep the worker minimal.
- **Create it only in the browser** (inside `useEffect`/lazy client module), never at module top level: `output: 'export'` prerenders client components at build, and `new Worker` there throws.
- **Typing without a lib clash:** do not add `lib: ["webworker"]` (it collides with `dom` in the root tsconfig, which includes `**/*.ts`). Type the minimum instead: `const ctx = self as unknown as { postMessage(m: unknown, t?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null }`.
- **Protocol:** ~40 hand-written lines: `{ id, type, payload }` in, `{ id, ok, payload }` out, monotonically increasing `id` to drop stale replies, typed arrays sent as transferables, never functions (`DataCloneError`). **Comlink is unnecessary** for three message types. An `InlineClient` runs the same pure functions synchronously for tests, SSR and small `n`, so unit tests never need a browser.
- **Bundler:** stay on webpack (Next 14 default; do not use `--turbo`). If Next 16 is adopted, Turbopack detects the same expression per Next's docs-adjacent sources (MEDIUM), but verify with one real build and keep `--webpack` as the fallback.
- **Verify in the export build:** the worker chunk is emitted under `_next/static/` and loads with `trailingSlash` and a `basePath`; workers must be same-origin, so do not point `assetPrefix` at a CDN. One Playwright smoke test that computes base 28 through the worker covers all of this.

## Q7. tsconfig and lint

**Root `tsconfig.json`:** `"target": "ES2022"`. It is `noEmit` (SWC transpiles; `lib` is already `esnext`), so `target` only changes which syntax the type-checker accepts: `for..of` over `Set`/`Map`/generators and spread stop raising TS2802 (any target >= ES2015 fixes it). Note that TS2737 (BigInt literals) needs ES2020+, which ES2022 also satisfies even though the engine avoids BigInt (guard at `2^26`, ARCHITECTURE). ES2022 rather than ARCHITECTURE's ES2017 because it matches `engine/tsconfig.json`; run `tsc --noEmit` once and, if class-field diagnostics appear (unlikely: components are functions), set `useDefineForClassFields: false`. Also add `"@engine/*": ["./engine/*"]` to `paths` for `app/` and `workers/` only; **the engine itself uses relative imports**. Leave `tsconfig.components.json` (ES2019, CommonJS) alone and keep `xenotation.ts` free of engine imports.

```jsonc
// engine/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022"], "types": [],          // any DOM or Node reference is a compile error
    "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true,
    "isolatedModules": true, "noEmit": true, "skipLibCheck": true, "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["test", "cli"]
}
// engine/tsconfig.test.json: extends ./tsconfig.json; "types": ["node"]; include ["test/**/*.ts","cli/**/*.ts"]; exclude []
```
Script: `"typecheck": "tsc --noEmit && tsc -p engine --noEmit && tsc -p engine/tsconfig.test.json --noEmit"`. The root type-check does **not** enforce the engine boundary; the second command is mandatory in CI.

**ESLint (stay on 8.57.1, legacy `.eslintrc.json`):** three layers, and the lint scope matters. **`next lint` and the `next build` lint step only cover `pages/ app/ components/ lib/ src/` by default** (verified in the 14.2 docs), so `engine/` and `workers/` would silently never be linted. Set `"lint": "next lint --dir app --dir engine --dir workers"` and the `eslint.dirs` shown in Q4.

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "overrides": [{
    "files": ["engine/**/*.ts"],
    "excludedFiles": ["engine/test/**", "engine/cli/**"],
    "rules": {
      "no-restricted-imports": ["error", { "patterns": [
        { "group": ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*"], "message": "engine/ is framework-free" },
        { "group": ["node:*", "fs", "path", "os", "crypto", "child_process", "worker_threads", "url", "util"], "message": "no Node built-ins in engine/ (CLI code lives in engine/cli)" },
        { "group": ["@/*", "@engine/*", "**/app/**", "**/workers/**"], "message": "engine/ imports engine/ only, by relative path" }
      ]}],
      "import/no-restricted-paths": ["error", { "zones": [
        { "target": "./engine", "from": "./app" }, { "target": "./engine", "from": "./workers" }
      ]}],
      "no-restricted-globals": ["error", "window", "document", "navigator", "localStorage", "sessionStorage", "process", "Buffer", "fetch"],
      "no-restricted-syntax": ["error",
        { "selector": "CallExpression[callee.object.name='Math'][callee.property.name='random']", "message": "use the seeded PRNG in engine/naming/prng.ts" },
        { "selector": "NewExpression[callee.name='Date'][arguments.length=0]", "message": "inject the date; never read the wall clock in engine/" },
        { "selector": "CallExpression[callee.object.name='Date'][callee.property.name='now']", "message": "inject the date" }
      ]
    }
  }]
}
```
`eslint-plugin-import` (source of `import/no-restricted-paths`) ships inside `eslint-config-next`, so no new plugin is needed. **TypeScript stays at 5.9.3.** TypeScript 7.0.2 is `latest` on npm (GA July 2026, native Go compiler) but ships without a stable programmatic API (expected in 7.1); Next's type-check calls the legacy API and typescript-eslint's peer range stops below 6.1. Revisit after the Next 16 phase, and even then only as a faster standalone `tsc` if wanted.

## Q8. Build tooling: the missing `zip` binary

Verified on this machine: `which zip` finds nothing, and `npm run build` = `build:plugin-zip && next build` fails before Next starts.

1. **Decouple first.** `"build": "next build"`. Keep `build:plugin-zip` as an explicit release step and add `"build:all": "npm run build:plugin-zip && npm run build"`. The gematria plugin has no relation to the generator. (If `public/downloads/ccru-gematria-plugin.zip` is not tracked, only `build:all` deploys the gematria download page; irrelevant to the numogram.)
2. **Replace the `zip` call with `fflate` 0.8.3 `zipSync`** (zero dependencies, sync, pure JS, per-file `[data, { level, mtime }]` tuples per its README). Chosen over `archiver` 8.0.0 (stream machinery for a 14-file archive) and `adm-zip` 0.6.1 (stamps entries from filesystem mtimes, which is exactly what makes today's SHA-256 change every build).

```js
// scripts/build-plugin-zip.mjs: replace the execSync(`zip -r9 ...`) block
import { zipSync } from 'fflate'
const FIXED = new Date(2000, 0, 1, 0, 0, 0) // fixed *local* components => same DOS timestamp bytes in any TZ (verify below)
const entries = {}
for (const rel of [...includes].sort()) {   // sorted => stable entry order
  entries[rel] = [new Uint8Array(readFileSync(resolve(PLUGIN_DIR, rel))), { level: 9, mtime: FIXED }]
}
writeFileSync(zipPath, zipSync(entries))
```
   Also write `app/gematria/plugin/zipInfo.ts` only when its content changes (compare before writing) so a build never dirties the tracked file. **Verify determinism once:** run the script under `TZ=UTC` and `TZ=America/New_York` and compare SHA-256; the fflate README does not say whether the DOS timestamp uses local or UTC time (so the byte-stability claim is MEDIUM until that check passes).
3. Leave `prepare` (`build:components`) alone: it is how git-installed consumers of the component library get `dist/`. Just know `npm install` rewrites tracked `dist/`.
4. Also bump `@types/node` to `^22`, pick npm (delete `yarn.lock`), and add `packageManager`/`engines` (Tools table above).

## Q9. PRNG and seeded generation

**Hand-roll `sfc32` seeded through `cyrb128` in `engine/naming/prng.ts`.** The requirement is not "a good PRNG", it is *the same seed yields the same names forever, on every engine*: the algorithm is part of the JSON file format, so it must be pinned by us, not by a dependency's semver.

- Only 32-bit integer operations (`Math.imul`, `|0`, `>>> 0`, shifts) plus one exact division by `2^32`, so results are bit-identical in V8, SpiderMonkey and JavaScriptCore (unlike `Math.sin/cos`; PITFALLS #15).
- Record the id in every exported file: `"algo": "sfc32-cyrb128@1"`. A future change is `@2`, and old files keep resolving through `@1`.
- Seed string: normalize to NFC, hash UTF-16 code units. The Feistel-with-cycle-walking construction from ARCHITECTURE (distinctness by construction, prefix-stable) needs only a keyed 32-bit mixer, which is the same `Math.imul` family, so it needs no extra library either.
- **Copy the reference implementations** from bryc's public-domain PRNG collection (github.com/bryc/code, `jshash/PRNGs.md`) and **freeze test vectors** (first 16 outputs for a handful of seeds, including `""`, `"a"`, a non-ASCII seed) in `engine/test/`. Do not reproduce the algorithms from memory.
- Lint-enforced: no `Math.random` in `engine/**` (Q7).

| Package | Verdict |
|---------|---------|
| `pure-rand` 8.4.2 (64 KB, maintained, used internally by fast-check) | Good library, but adds a dependency to a zero-dependency engine whose algorithm identity we must own. Fine to keep transitively via fast-check for tests. |
| `seedrandom` 3.0.5, `prando` 6.0.1 | Both last published 2022-06; `seedrandom` is ARC4 with a global-patching legacy. No. |
| `Math.random` | Unseedable. Banned. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest 5.0.2 | Jest + `next/jest` | Only if the team already runs Jest elsewhere; costs ESM/TS friction here. |
| Vite 8.3.1 | Vite 7.3.6 | If Vite 8 (Rolldown) misbehaves on Windows with Vitest 5; it is the `previous` dist-tag and within Vitest's peer range. |
| Canvas2D hand-rolled | PixiJS 8.21.0 | Spike shows Canvas2D misses ~30 FPS after layer caching at a required `n`. |
| Hand-rolled layout | d3-force 3.0.0 | A later visual pass wants relaxation after the ring layout, with fixed iterations and rounded output. |
| Native canvas PNG | `@resvg/resvg-wasm` 2.6.2 | Safari / poster-size PNG fails, byte-stable PNGs needed, or the CLI must emit PNG. |
| Outlined glyph table | Runtime `opentype.js` | Arbitrary user fonts must be outlined at export time (not v1). |
| fflate | `archiver` 8.0.0 / `adm-zip` 0.6.1 | Streaming or password-protected zips; neither is needed. |
| Hand-rolled virtual list | `@tanstack/react-virtual` 3.14.13 | Variable row height, `scrollToIndex`, or keyboard-focus management (recommended for the demon browser). |
| Stay on Next 14.2.35 | Next 16.3.6 | After the goldens exist (see Q4); earlier only if a trigger fires. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TypeScript 7.0.x | No stable JS API until 7.1; breaks Next 14's type-check and typescript-eslint | TypeScript 5.9.3 |
| ESLint 9/10 | `eslint-config-next@14` peers ESLint 7/8 only | ESLint 8.57.1 until the Next 16 phase |
| Next 15 | Maintenance LTS ends 2026-10-21 | Stay on 14.2.35, then go directly to 16 |
| `vite-tsconfig-paths` | Engine has no path aliases; adds a plugin for nothing | Relative imports; one regex alias only if app-side tests need `@/` |
| `toMatchSnapshot` / `vitest -u` for math goldens; PNG screenshot goldens across OS | Self-healing and OS-dependent | Literal JSON `toEqual`; normalized DOM text goldens |
| jsdom / happy-dom for engine tests | Hides accidental DOM use | `environment: 'node'` plus `types: []` |
| WebGL stack (PixiJS, regl, three, deck.gl) in v1 | Cannot make O(n^2) chords readable; adds weight | Canvas2D + demon matrix raster |
| elkjs, graphviz-wasm as layout | 8 MB / 2 MB, async, cannot express ring/cycle invariants | Hand-rolled `engine/layout` |
| html2canvas, dom-to-image, html-to-image, canvg, saveSvgAsPng | DOM/CSS capture is what breaks fonts and styles | Model -> SVG string -> rasterizer |
| `zip` binary, `archiver`, `adm-zip` for the plugin zip | Missing on Windows / streaming overkill / non-deterministic | fflate `zipSync` with a fixed mtime |
| `seedrandom`, `prando`, `Math.random` | Unmaintained, global side effects, unseedable | Pinned sfc32 + cyrb128 |
| `useSearchParams` in the static shell | Requires a `<Suspense>` boundary or `next build` fails | `window.location.search` in a client effect |
| Comlink, OffscreenCanvas (v1) | Overhead for three message types; no measured need | Hand-rolled protocol; typed-array transfer |
| `BigInt` in engine math | TS2737 under old targets; unnecessary below `2^26` | `number` with `assertSafeBase` |
| `@vercel/blob`, `@vercel/analytics`, `yarn.lock` beside npm 11 | Break static export / ambiguous installs | Remove; npm only |

## Stack Patterns by Variant

**If the ceiling spike shows Canvas2D cannot hold the target `n`:**
- Add a WebGL tier (PixiJS 8 or raw WebGL2 over the engine's typed arrays) behind the same `NumogramViewProps` contract and the `selectTier` data table.
- Because the tier table is data, this changes one file plus one renderer, not the architecture.

**If hosting on a sub-path (GitHub Pages):**
- `NEXT_PUBLIC_BASE_PATH` via `cross-env`, `withBasePath()` for plain `<img>` and metadata icons, `public/.nojekyll`, no CDN `assetPrefix` (workers must be same-origin).

**If poster PNG fails on Safari or byte-stable PNGs are required:**
- Add `@resvg/resvg-wasm` behind `rasterizeSvg()`, wasm served from `public/vendor/`, fonts as `fontBuffers`.

**If Next 16 is adopted (own phase):**
- Sequence: goldens green -> `npx @next/codemod@canary upgrade latest` -> `next-lint-to-eslint-cli` (flat config, ESLint CLI script replaces `next lint`) -> `next build --webpack` first -> Turbopack only after the worker smoke test and DOM goldens pass on it.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vitest@5.0.2 | Node `^22.12 \|\| ^24 \|\| >=26`; vite `^6.4 \|\| ^7 \|\| ^8`; optional peer `@types/node ^22 \|\| >=24` | Repo has `@types/node ^20`: bump to `^22` or npm may raise an ERESOLVE on the optional peer. Local Node 22.16.0 is fine. |
| vite@8.3.1 | Node `^20.19 \|\| >=22.12` | Test-time only. |
| next@14.2.35 | Node >= 18.17; React `^18.2` | Pin exact. Uses webpack for dev and build. |
| eslint-config-next@14.2.35 | eslint `^7.23 \|\| ^8`; typescript >= 3.3.1 | Forces ESLint 8. |
| typescript@5.9.3 | Next 14.2, typescript-eslint | 7.0.2 is not compatible (no legacy JS API). |
| @playwright/test@1.63.0 | Node >= 20 | Matches `next@16` peer `^1.51.1`. |
| fast-check@4.10.2 | Node >= 12.17 | `@fast-check/vitest@0.5.0` (optional) peers `vitest ^4.1 \|\| ^5`. |
| cross-env@10.1.0 | Node >= 20 | |
| next@16.3.6 (later) | Node >= 20.9; TypeScript >= 5.1; React `^18.2 \|\| ^19`; Safari 16.4+ | Turbopack default; `next lint` removed; flat ESLint config. |

## Deltas vs ARCHITECTURE.md / PITFALLS.md / FEATURES.md

- **`engine/package.json`: omit `"type": "module"` until the engine is actually promoted to a workspace.** It buys nothing before publishing (tsx and Vite both handle extensionless TS imports either way) and a `type: module` package boundary is one more variable for webpack; risk is low but non-zero.
- **Root target ES2022, not ES2017** (superset; matches the engine tsconfig).
- **`next lint` does not cover `engine/` or `workers/` by default.** ARCHITECTURE adds the ESLint override but not the scope change; without `--dir` and `eslint.dirs` the boundary rules never run.
- **`@types/node` must move to `^22`** for Vitest 5 (not previously noted).
- **Virtual lists:** FEATURES recommends TanStack Virtual, ARCHITECTURE says hand-roll. Resolution: hand-roll fixed-height panels first, use TanStack for the demon browser.
- **Demon matrix is rasterized at viewport resolution**, refining ARCHITECTURE's "1,000 x 1,000 at n=1000, binned above 2,048 px": a full `n x n` buffer is never needed and would be 400 MB at `n`=10^4.
- **Next.js support facts are new:** 14 is Unsupported and 15 leaves Maintenance LTS on 2026-10-21, which turns "upgrade or not" into "stay now, go straight to 16 later".

## Open Items to Verify Inside the Phases (not answerable from docs)

1. First `next build` with `output: 'export'`: behavior of the unconditional `redirect()` in `app/gematria/saved/page.tsx`, and of `sitemap.ts` / `robots.ts` (P0c).
2. TZ pin canary passes on this Windows machine and on Linux CI (P0a).
3. fflate zip is byte-identical under two different `TZ` values (P0c).
4. Worker chunk is emitted and loads in the exported site, with and without `basePath` (Canvas/worker phase).
5. Real Canvas2D and SVG thresholds and the Safari canvas area limit (ceiling spike; export phase).
6. `opentype.js` 2.0.0 API compatibility for the glyph-table script; OFL font choice and license (export phase).
7. Whether an unpinned `next@^14.2.0` resolves to 14.2.35 in the current lockfile (pin exactly; check `npm ls next`).

## Sources

- Context7 `/vitest-dev/vitest` (via `ctx7` CLI): `test.projects` inline config, `process.env.TZ` in config top level and in `globalSetup`, `pool: 'forks'` (HIGH)
- Context7 `/microsoft/playwright` (via `ctx7` CLI): `page.clock.setFixedTime`/`install`, context `timezoneId`/`locale`, `snapshotPathTemplate`, `webServer.reuseExistingServer` (HIGH)
- https://nextjs.org/docs/14/app/building-your-application/deploying/static-exports (v14.2.35): config, unsupported features, GET-only route handlers (HIGH)
- https://nextjs.org/docs/14/app/building-your-application/configuring/eslint (v14.2.35): default lint directories, `--dir`, `eslint.dirs` (HIGH)
- https://nextjs.org/support-policy: 16 Active LTS, 15 Maintenance LTS (two years from 2024-10-21), 14 Unsupported; no exact EOL dates stated (HIGH)
- https://nextjs.org/docs/app/guides/upgrading/version-16 (v16.3.6, 2026-08-25): Node/TS/browser minimums, Turbopack default and `--webpack`, `next lint` removal, flat ESLint config, async request APIs (HIGH)
- npm registry queries on 2026-09-25 (`npm view`): versions, dist-tags, `engines`, `peerDependencies`, unpacked sizes and `time.modified` for next, typescript, vitest, vite, fast-check, @fast-check/vitest, @playwright/test, eslint, eslint-config-next, d3-force, elkjs, @hpcc-js/wasm-graphviz, @resvg/resvg-wasm, pixi.js, regl, sigma, graphology, fflate, archiver, adm-zip, pure-rand, seedrandom, prando, opentype.js, tsx, cross-env, serve, @tanstack/react-virtual (HIGH)
- d3-force README (`simulation.randomSource`, deterministic phyllotaxis init) via `npm view d3-force readme` (HIGH)
- https://unpkg.com/@resvg/resvg-wasm@2.6.2/index.d.ts: `initWasm`, `Resvg` options, `fontBuffers`, `fitTo`, `asPng` (HIGH for API; MEDIUM for wasm font behavior)
- https://raw.githubusercontent.com/101arrowz/fflate/master/README.md: `zipSync`, per-file options tuple, `mtime` support; local-vs-UTC not documented (MEDIUM)
- https://blog.js.cytoscape.org/2025/01/13/webgl-preview/: Canvas vs WebGL frame rates at 1,200 nodes/16k edges and 3,200 nodes/68k edges; hardware unspecified (MEDIUM)
- https://www.yworks.com/blog/svg-canvas-webgl: checked; states no numeric thresholds (LOW as evidence for any number)
- https://webpack.js.org/guides/web-workers/ and https://dev.to/ahmed_mahmoud360/web-workers-in-the-nextjs-app-router-field-notes-on-importmetaurl-datacloneerror-and-what-a-ood (worker syntax, App Router caveats) (MEDIUM)
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ and https://www.infoq.com/news/2026/08/typescript-7-released/ (GA date, native compiler); compatibility statements about the missing JS API, Next's type-checker and typescript-eslint's peer range come from secondary write-ups surfaced by search (MEDIUM); `typescript@latest = 7.0.2` from the registry (HIGH)
- Canvas size limits and SVG-as-image font limits: secondary sources already cited in `PITFALLS.md` (pqina.nl, dzx.fr, Mozilla bug 700533) (MEDIUM)
- bryc PRNG collection (github.com/bryc/code, `jshash/PRNGs.md`) as cited in `FEATURES.md`; not re-fetched this session (MEDIUM)
- Local: `package.json`, `tsconfig.json`, `next.config.js`, `.eslintrc.json`, `scripts/build-plugin-zip.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/numogram/page.tsx`; `which zip` (not found); Node 22.16.0 / npm 11.6.2 (HIGH)

---
*Stack research for: arbitrary-base numogram generator (brownfield Next 14 static export)*
*Researched: 2026-09-25*

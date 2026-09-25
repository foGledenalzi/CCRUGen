# Codebase Concerns

**Analysis Date:** 2026-09-25

## Hard-Coded Base-10 Assumptions

This is the **primary blocker** for supporting arbitrary even bases (2 to 100+). Every area below must be generalized.

**Digit Reduction Function:**
- **File:** `app/lib/numogram.ts` (line 8)
- **Issue:** `plexExpr(cum)` hardcoded check `if (cum < 10) return null` and `while (current >= 10)`
- **Impact:** Only works for base-10. A base-16 numogram would reduce differently; base-100 even more so
- **Fix approach:** Parametrize `plexExpr(cum, base)` and refactor digit sum logic to work with arbitrary bases

**Layout Coordinates (4 hard-coded position tables):**
- **File:** `app/data/positions.ts` (lines 3-48)
- **Issue:** `P_ORIGINAL`, `P_LABYRINTH`, `P_LADDER` define hand-placed x,y coordinates for zones 0-9 only
  - P_ORIGINAL: 10 zones at fixed positions
  - P_LABYRINTH: 10 zones in different arrangement
  - P_LADDER: 10 zones in paired columns
- **Impact:** No procedural position generation for arbitrary zone counts. 100 zones cannot use any of these layouts
- **Fix approach:** Build layout generator algorithm instead of lookup tables; positions should be computed from base/zone count

**Planetary Rendering Parameters (3 data tables):**
- **File:** `app/data/positions.ts` (lines 28-41)
- **Issue:** `PLANETARY_RADIUS`, `PLANETARY_DEFAULT_ANGLE`, `PLANETARY_SIZE` all `Record<number, number>` with zones 0-9 hardcoded
  - Radius grows from 0 to 360 in fixed increments
  - Each zone has a custom starting angle
  - Each zone has a custom glyph size
- **Impact:** Planetary mode cannot scale to 100 zones; needs algorithm for radius progression, angle distribution, and size scaling
- **Fix approach:** Replace lookup tables with functions: `radiusForZone(z, maxZone, maxRadius)`, `angleForZone()`, `sizeForZone()`

**Zone Metadata & Attributes:**
- **File:** `app/data/zones.ts` (lines 3-41, 23-112)
- **Issue:** `ZONE_CLR`, `ZONE_REGION`, `ZONE_PARTICLE`, `PLANET_SYMBOL`, `ZONE_META` all hardcoded for 0-9
  - Colors, region assignments (torque/warp/plex), particle symbols, planet names all locked to 10 zones
  - Zone region logic baked in: `ZONE_REGION: { 0: 'plex', 1: 'torque', ..., 9: 'plex' }`
  - Lemurs (demons per zone) hardcoded per zone
- **Impact:** No way to assign regions or metadata to arbitrary zones
- **Fix approach:** Build zone configuration system; allow user/generator to define region mapping and per-zone metadata at runtime

**Demon Pair Generation:**
- **File:** `app/data/demons.ts` (lines 22-30)
- **Issue:** Nested loop `for (let i = 1; i < 10; i++) for (let j = 0; j < i; j++)` generates exactly 45 demons for base-10
  - Hardcoded zone limit `i < 10`; skips zone 0 entirely
- **Impact:** 
  - Scales to O(n²) pairs: base-100 = 4,950 demon pairs (vs. 45 for base-10)
  - All 4,950 would render as SVG path elements in Projection
- **Fix approach:** Parametrize loop bounds; consider performance strategies for large demon counts (see **Performance Bottlenecks** section)

**Share Parameter Validation:**
- **File:** `app/lib/shareParams.ts` (lines 58-65)
- **Issue:** Hard-coded limits: `if (parts.length === 0 || parts.length > 10)` and zone range check `if (n < 0 || n > 9)`
- **Impact:** Cannot share selections for bases > 10; validation rejects valid zones for larger bases
- **Fix approach:** Parametrize base in validation; accept zone range `[0, base)`

**Iteration Patterns Throughout Codebase:**
- **Files:** 
  - `app/NumogramClient.tsx` (lines 185-189, 459, 619, 883): `for (let z = 0; z <= 9; z++)`
  - `app/hooks/useOrbitalAnimation.ts` (line 29): `for (let z = 1; z <= 9; z++)`
  - `app/hooks/useTween.ts` (line 48): `for (let z = 0; z <= 9; z++)`
  - `app/lib/xenotation.ts` (line 178): `for (let z = 0; z <= 9; z++)`
  - `app/lib/planetary.ts` (lines 14, 30): `for (let z = 0; z <= 9; z++)`
- **Impact:** 40+ hardcoded zone loops across codebase
- **Fix approach:** Extract base from configuration; use `for (let z = 0; z < currentBase; z++)`

**Time Circuit (TC) Hard-Coding:**
- **File:** `app/data/demons.ts` (line 19)
- **Issue:** `TC = new Set([1, 2, 4, 5, 7, 8])` - specific zone IDs for Time Circuit
  - Used throughout: NumogramClient (lines 196, 619), all demon/current/gate rendering
- **Impact:** The 6 Time Circuit zones are hard-wired. Arbitrary bases need configurable TC definition
- **Fix approach:** Make TC zone list configurable; derive from zone region mappings

---

## Performance & Scaling Risks

**O(n²) Demon Pair Rendering:**
- **Issue:** 45 demons (base-10) → 4,950 demons (base-100)
  - Each demon renders as 2 SVG paths: stroked path (visual) + transparent path (hover target)
  - Projection.tsx line 143: `ALL_DEMONS.filter(d => d.kind !== 'syzygy').map(d => ...)`
  - No filtering or virtualization; all demons always rendered
- **Current performance:** ~90 SVG path elements for demons alone at base-10
- **At base-100:** ~9,900 path elements, plus corresponding event handlers and re-renders
- **Risk:** SVG DOM saturation, React reconciliation slowdown, hover event handler explosion
- **Mitigation approach:**
  1. Implement viewport culling: only render demons visible in current SVG viewBox
  2. Use SVG `<use>` references instead of duplicate paths
  3. Consider Canvas rendering for demon paths instead of SVG
  4. Lazy-render on interaction (don't render all demons on page load)

**SVG Filter & Gradient Multiplication:**
- **File:** `app/components/projection/Projection.tsx` (lines 87-136)
- **Issue:** Defines static filters and gradients, then dynamic gradients for each zone (line 117): `[1,2,3,4,5,6,7,8,9].map(z => ...)`
  - Planetary mode generates 9 radial gradient definitions in `<defs>`
  - Each demon/gate/current path may reference filters (`url(#gl)`, gradients)
  - At base-100: 99 gradient definitions in SVG defs
- **Risk:** Bloats SVG source; DOM overhead in filter/gradient lookup
- **Mitigation:** Pre-compute SVG string or use Canvas for high zone counts

**React Re-render Cost:**
- **Issue:** Projection component is memoized (line 39), but:
  - Props include `gateRenderData: Record<string, GateRender>` (object, new identity each render)
  - Props include `currentRenderData: Record<string, CurrentRender>` (object, new identity each render)
  - Props include `planetaryPos: Record<number, Pos>` (object, new identity each render)
  - These objects are likely recreated on every parent state change
- **Risk:** React.memo does not prevent re-renders when object props change by identity
- **Mitigation:** Use `useMemo` for these data structures; consider stable object references or deep comparison

**Animation Hooks on All Zones:**
- **File:** `app/hooks/useOrbitalAnimation.ts`
- **Issue:** `getAnglesForDate()` recalculates planetary angles for zones 1-9 on every orbital animation frame
  - At base-100: would recalculate for 99 zones
- **Impact:** O(n) work in animation loop; at 60fps, this multiplies
- **Mitigation:** Pre-compute angle table; use lookups instead of calculations

**SVG Path Generation for Gates/Currents:**
- **Issue:** Gate and current rendering in Projection.tsx computes curves for each gate/current
  - Line 146: `curveAway(pos[d.a], pos[d.b], ctr.x, ctr.y, 0.25)` per demon
  - Gradient vectors computed for partial selections (lines 205-223)
- **Risk:** At base-100, this is expensive geometry computation on every render
- **Mitigation:** Memoize path computations; cache curves by zone pair IDs

---

## Vercel Deployment Dependencies

**Cannot Work Offline or as Static Generator:**
- **File:** `app/api/share-image/route.ts`, `app/NumogramClient.tsx` (lines 1059-1106)
- **Issue:** 
  - Share feature makes fetch request to `/api/share-image` (Vercel serverless function)
  - Upload path: fetch → check if image exists in `@vercel/blob` → generate SVG → upload to Vercel Blob Storage
  - Requires runtime `@vercel/blob` client configured with `BLOB_READ_WRITE_TOKEN` env var
- **Impact:** 
  - Cannot deploy as static HTML/JS
  - Cannot work offline
  - Requires Vercel account and blob storage setup
  - Generator tool running locally has no `/api` endpoint
- **Current use:** `@vercel/analytics` (line 2 `app/layout.tsx`), `@vercel/blob` (line 1 `app/api/share-image/route.ts`)
- **Fix approach:** 
  1. Make share image generation optional (don't fail if `/api/share-image` unreachable)
  2. Provide fallback: generate dataURL locally and let user download
  3. Remove dependency from core generator; make it plugin-based
  4. For static build: generate sharing links without preview images

---

## Large Files Committed to Git

**41MB demo.mov:**
- **Location:** Project root `demo.mov`
- **Issue:** Large video file committed; likely never changes; bloats `.git` directory and clone time
- **Should be:** Removed and added to `.gitignore`; hosted externally (YouTube, etc.)

**193KB dist/ Directory:**
- **Location:** Project root `dist/`
- **Issue:** Built output committed; should be generated during build
- **Should be:** Added to `.gitignore` (already in place but dist/ still in repo)

---

## Type Safety Gaps

**Loose Unknown Types:**
- **Files:** 
  - `app/NumogramClient.tsx` (lines 1069-1093): `unknown` types in share-image response handling
  - `app/api/share-image/route.ts` (lines 32-36): `Record<string, unknown>` for request body parsing
  - `app/lib/shareParams.ts` (line 30): `RawShareParams` typedef allows any object
- **Impact:** No compile-time safety on API responses or config objects
- **Fix approach:** Create strict interfaces for API contracts (e.g., `ShareImageResponse`, `ShareImageRequest`)

**Untyped Demon & Gate Lookups:**
- **Issue:** `gateRenderData[g.name]` (line 165), `currentRenderData[...]` are lookup by string key
  - No validation that key exists
  - Guard clause `if (!rd) return null` hides missing data
- **Fix approach:** Use Map instead of Record; throw early on missing entries during build

---

## Missing Test Coverage

**No Test Files Found:**
- **Issue:** Repository has 0 `.test.ts` or `.spec.ts` files
- **Risk:** No regression detection when refactoring for arbitrary bases
- **Especially risky for:**
  - `plexExpr()` function (needs tests for various bases)
  - Position algorithms (need tests for zone count changes)
  - Share parameter parsing (needs tests for new bases)
  - Demon pair generation (needs tests for O(n²) scaling)
- **Fix approach:** Add Jest/Vitest config; write tests for all base-aware functions

---

## Security Considerations

**PNG Data URL Parsing:**
- **File:** `app/api/share-image/route.ts` (lines 15-27)
- **Issue:** Regex-based base64 PNG decode: `/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/`
  - Size limit enforced (6MB), but could still be DoS vector
  - No validation of PNG structure (just size check)
- **Current mitigation:** 6MB size limit
- **Recommendation:** Add content-type validation, PNG magic bytes check

**Signature Hashing for Deduplication:**
- **File:** `app/api/share-image/route.ts` (lines 10-12)
- **Current:** SHA256 hash of sorted params and values used as file path
- **Risk:** Collision risk minimal for SHA256, but no CSRF protection on share-image endpoint
- **Recommendation:** Add rate limiting; validate origin for share requests

---

## Missing Infrastructure for Arbitrary Bases

**No Base Configuration System:**
- **Issue:** No way to set/pass base value through application
- **Current:** Hardcoded to 10 everywhere
- **Needed:** 
  - Base parameter in URL (e.g., `?base=16`)
  - Base stored in context or state
  - All data structures keyed by base
- **Files to create:** Context provider for base configuration

**No Zone Configuration Schema:**
- **Issue:** Zones are an untyped collection of hardcoded data
- **Needed:** Schema definition for zone metadata that scales:
  ```typescript
  interface BaseConfig {
    base: number
    zones: ZoneConfig[]
    tcZones: number[]
    regionMapping: Record<number, Region>
  }
  ```

**SVG Layout Algorithm Missing:**
- **Issue:** Positions are lookup tables only
- **Needed:** Procedural layout generator that takes zone count and produces valid coordinates

---

## Xenotation Rendering Issues

**File:** `app/lib/xenotation.ts` (line 178)
- **Issue:** Loop `for (let z = 0; z <= 9; z++)` generates xenotation for 10 zones only
- **Performance:** Prime factorization calculations on every zone
- **At base-100:** Would run expensive factorization 99 times
- **Fix approach:** Memoize prime cache; pre-compute xenotation at startup; cache by base

---

## Fragile Hover & Selection Logic

**Mouse Event Handlers on All Demons:**
- **File:** `app/components/projection/Projection.tsx` (line 154-158)
- **Issue:** Every demon path has `onMouseEnter`, `onMouseLeave`, `onClick` handlers
  - At base-100: 4,950 hover handlers
  - No debouncing; each hover fires `onHoverInfo` callback
- **Risk:** Hover jank with hundreds of handlers
- **Mitigation:** Implement single hover handler on SVG root with event delegation

**Selection State in Top-Level Component:**
- **File:** `app/NumogramClient.tsx` (lines 108, 138-139)
- **Issue:** `selZones: Set<number>` and `undoStack`, `redoStack` stored in useState at page level
  - Every selection change causes full component re-render
  - Undo/redo stacks unbounded: limited only by `MAX_HISTORY_ENTRIES = 80`
- **Risk:** Memory leak if user makes many selections; state bloat
- **Mitigation:** Move history to external store (Redux/Zustand); add explicit cleanup

---

## Incomplete Error Handling

**Fetch Failures in Share Flow:**
- **File:** `app/NumogramClient.tsx` (lines 1104-1106)
- **Issue:** Share errors caught but silently ignored: `catch { /* Non-fatal */ }`
- **Risk:** User doesn't know share failed; may think link was generated
- **Fix:** Show toast/notification on share API failure

**SVG Path Parsing Edge Cases:**
- **File:** `app/components/projection/Projection.tsx` (lines 53-75)
- **Issue:** `pathTerminals()` returns null if regex doesn't match (line 55)
- **Risk:** Malformed SVG paths cause silent rendering failures
- **Mitigation:** Log warnings; add fallback rendering

---

## Xenotation Label Visibility Toggle

**File:** `app/NumogramClient.tsx` (lines 141-145)
- **Issue:** Label visibility state includes `xenotation: false` but rendering logic needs to respect this
- **Risk:** If xenotation rendering is expensive, toggling it off should actually skip computation
- **Verification needed:** Check `InfoDisplay.tsx` and rendering to ensure xenotation skipped when toggled off

---

## Particle System Performance

**File:** `app/NumogramClient.tsx` (line 112), rendered via `particlesOn` prop
- **Issue:** Particle system animates particles for all zones
  - `ZONE_PARTICLE` defines particles per zone (0-9)
  - At base-100: would animate 99 particle types
- **Risk:** Not visible in current code (likely in hidden/omitted rendering), but if implemented, expensive
- **Verification needed:** Check if particle animation uses requestAnimationFrame; measure FPS impact

---

## Summary of Refactoring Priorities

1. **CRITICAL (blocks base-N support):**
   - Extract base into global configuration
   - Parametrize all hard-coded loops (40+ occurrences)
   - Build zone configuration schema
   - Create position generation algorithm (3 layouts)
   - Update demon pair generation to parameterized base

2. **HIGH (enables scaling):**
   - Add viewport culling for demons/gates/currents
   - Remove Vercel dependencies from core generator
   - Add comprehensive test suite
   - Implement event delegation for hover handlers

3. **MEDIUM (improves maintainability):**
   - Replace `Record<string, unknown>` with strict types
   - Add error handling and user feedback for share failures
   - Memoize expensive computations (prime factorization, curves)

4. **LOW (nice-to-have):**
   - Move state to external store
   - Add rate limiting to share endpoint
   - Validate PNG structure before upload

---

*Concerns audit: 2026-09-25*

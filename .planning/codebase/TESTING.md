# Testing Patterns

**Analysis Date:** 2026-09-25

## Current Testing State

**Summary:** Minimal formal testing infrastructure exists. No Jest, Vitest, or traditional test framework integrated. Single self-check script validates share-image API endpoint.

## Test Framework

**Runner:**
- None formally configured (no Jest, Vitest, Mocha, etc.)
- Custom Node.js scripts for validation
- Script: `scripts/share-image-self-check.mjs`
- Run: `npm run test:share-image`

**Assertion Library:**
- Node.js built-in: `node:assert/strict`
- Modern strict assertions without external dependency

**Run Commands:**
```bash
npm run test:share-image              # Run share-image API self-check
npm run lint                          # ESLint validation (not testing)
npm run build                         # Build validation (not testing)
```

**Gaps:**
- No unit test framework for pure math functions
- No integration test framework
- No E2E test framework
- No test command in package.json for general testing
- No coverage tracking

## Test File Organization

**Current Structure:**
- Single self-check script: `scripts/share-image-self-check.mjs`
- No standard `.test.ts` or `.spec.ts` files
- No `__tests__` directory convention used

**Missing:**
- No co-located tests (e.g., `gematria.test.ts` next to `gematria.ts`)
- No centralized test directory (e.g., `tests/` or `__tests__/`)
- No test fixtures directory

## Test Structure

**Share-Image Self-Check Script (from `scripts/share-image-self-check.mjs`):**

```javascript
#!/usr/bin/env node
import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const HAS_BLOB_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

async function postShareImage(payload) {
  const res = await fetch(`${BASE_URL}/api/share-image`, { ... })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function ensureImageForParams(params) {
  const first = await postShareImage({ params })
  assert.equal(first.ok, true, `First check failed (${first.status}): ...`)
  // ... more assertions
}

async function main() {
  console.log(`[share-self-check] Base URL: ${BASE_URL}`)
  // ... run multiple test scenarios
  console.log('[share-self-check] All checks passed.')
}

main()
```

**Patterns:**
- Environment-driven configuration (`BASE_URL`, `BLOB_READ_WRITE_TOKEN`)
- HTTP endpoint testing via `fetch()` API
- Assertion-based validation with descriptive error messages
- Async/await for test orchestration
- Conditional test execution based on configuration
- Console logging for test status reporting

## Mocking

**Framework:** None currently in use

**Current Approach:**
- Self-check uses real HTTP requests to live endpoints
- No mocking library (Jest.mock, Sinon, etc.)
- No mock server setup

**What Needs Testing But Isn't Mocked:**
- External service calls: `@vercel/blob` (head, put operations)
- Crypto operations: `createHash` from node:crypto
- Request/response handling in API routes

**Recommendations for Testing:**
- Vercel Blob operations need mocking for unit tests
- Create test doubles for API route dependencies
- Use Jest/Vitest mock utilities when framework is added

## Fixtures and Test Data

**Golden Fixtures:**
- Located in `app/data/*.ts` files (constants defining numogram entities)
- Files: `currents.ts`, `demons.ts`, `gates.ts`, `positions.ts`, `syzygies.ts`, `zones.ts`
- These are the **canonical test fixtures** for the math engine

**Example (from `app/data/currents.ts`):**
```typescript
export const CURRENTS: CurrentData[] = [
  { name: 'Surge', from: 8, to: 7, label: '8−1=7', desc: '...' },
  { name: 'Hold', from: 2, to: 5, label: '7−2=5', desc: '...' },
  { name: 'Sink', from: 4, to: 1, label: '5−4=1', desc: '...' },
  { name: 'Warp', from: 6, to: 3, label: '6−3=3', desc: '...' },
  { name: 'Plex', from: 9, to: 9, label: '9−0=9', desc: '...' },
]
```

**Example (from `app/cyphers/ccruCiphers.ts`):**
```typescript
export const CCRU_CIPHERS: CcruCipher[] = [
  {
    id: 'alphanumeric-qabbala',
    name: 'Alphanumeric Qabbala',
    chars: ALPHANUM,
    values: rangeValues(36),
    // ... more cipher definitions
  },
  // ... additional ciphers
]
```

**Location for Test Data:**
- Keep `app/data/*.ts` as authoritative golden fixtures
- These represent "known correct" outputs for the numogram calculations
- Tests should verify that code produces output matching these fixtures

## Coverage

**Requirements:** None enforced currently

**View Coverage:**
- No coverage command exists
- Run `npm run lint` for code quality checks (not coverage)

**What Needs Coverage:**
- Math engine functions: `app/lib/*.ts`, `app/cyphers/*.ts`
- API routes: `app/api/**/*.ts`
- UI components: `app/components/**/*.tsx` (lower priority, mainly integration)

**Target Areas for Testing (by priority):**

**High Priority (Pure Math - Golden Fixtures):**
- `app/cyphers/gematria.ts`: `calcGematria()` should produce base-10 output matching fixture definitions
- `app/cyphers/ccruCiphers.ts`: Cipher definitions, validation
- `app/lib/geometry.ts`: Geometry functions for SVG path generation
- `app/lib/numogram.ts`: Numogram calculation engine
- `app/lib/xenotation.ts`: Xenotation encoding/decoding

**Medium Priority (API Routes):**
- `app/api/share-image/route.ts`: Image creation, deduplication, error handling

**Lower Priority (React Components):**
- UI components (interactive, harder to test without E2E tools)
- State management in components (useEffect, useState patterns)

## Test Types

**Unit Tests:**
- Scope: Individual utility functions (math engine, ciphers, geometry)
- Approach: Direct function calls with inputs and assertions on outputs
- Examples to test:
  ```typescript
  calcGematria('test', cipherObj) // Should return specific number
  midpoint({ x: 0, y: 0 }, { x: 10, y: 10 }) // Should return { x: 5, y: 5 }
  ```
- Framework needed: Jest or Vitest
- Assertion library: Built-in or external (e.g., Chai)

**Integration Tests:**
- Scope: API routes with real dependencies (or mocked external services)
- Approach: POST/GET requests to API endpoints, validate response structure
- Example:
  ```javascript
  const response = await fetch('/api/share-image', { method: 'POST', ... })
  assert(response.ok)
  assert(typeof response.json().imageUrl === 'string')
  ```
- Current: `scripts/share-image-self-check.mjs` serves this purpose

**E2E Tests:**
- Not currently implemented
- Would require: Playwright, Cypress, or similar
- Scope: Full user workflows (interact with UI, render numogram, apply filters, export)

## Common Patterns

**Async Testing:**
```javascript
async function ensureImageForParams(params) {
  const first = await postShareImage({ params })
  assert.equal(first.ok, true, `First check failed: ${JSON.stringify(first.json)}`)
  return { data: first.json }
}

async function main() {
  const result = await ensureImageForParams({ ... })
  console.log('Check passed.')
}

main()
```

**Error Assertion:**
```javascript
try {
  const existing = await head(pathname)
  // ... handle success
} catch (error) {
  if (!(error instanceof BlobNotFoundError)) {
    throw error  // Re-throw if unexpected error type
  }
  // Expected error — continue
}
```

**Conditional Checks:**
```javascript
if (!HAS_BLOB_TOKEN) {
  console.log('[share-self-check] Skipping upload tests (token not set).')
  return
}
```

## Recommended Testing Strategy

### Phase 1: Foundation (Unit Tests for Math Engine)

**Add Jest or Vitest:**
```bash
npm install --save-dev vitest @vitest/ui
```

**Create test structure:**
```
app/cyphers/
  gematria.ts
  gematria.test.ts          # NEW
  ccruCiphers.ts
  ccruCiphers.test.ts       # NEW
app/lib/
  geometry.ts
  geometry.test.ts          # NEW
  numogram.ts
  numogram.test.ts          # NEW
```

**Test pattern for gematria:**
```typescript
import { describe, it, expect } from 'vitest'
import { calcGematria } from './gematria'
import { CCRU_CIPHERS } from './ccruCiphers'

describe('calcGematria', () => {
  const aqCipher = CCRU_CIPHERS.find(c => c.id === 'alphanumeric-qabbala')!
  
  it('should return 0 for empty string', () => {
    expect(calcGematria('', aqCipher)).toBe(0)
  })
  
  it('should sum cipher values for simple phrase', () => {
    // Test against known outputs from fixtures
    const result = calcGematria('test', aqCipher)
    expect(result).toBe(expectedValue)  // Golden fixture verification
  })
  
  it('should handle number sequences correctly', () => {
    const result = calcGematria('abc123def', aqCipher)
    expect(result).toBe(expectedValue)
  })
})
```

**Test pattern for geometry:**
```typescript
describe('geometry', () => {
  it('midpoint should calculate center between two points', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 10 })).toEqual({ x: 5, y: 5 })
  })
  
  it('quadPath should generate SVG quadratic curve', () => {
    const path = quadPath({ x: 0, y: 0 }, { x: 10, y: 10 }, 5)
    expect(path).toMatch(/^M\d+\s\d+Q/)
  })
})
```

### Phase 2: API Route Tests

**Mock Vercel Blob:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

vi.mock('@vercel/blob', () => ({
  head: vi.fn(),
  put: vi.fn(),
}))

describe('POST /api/share-image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should return 400 for invalid JSON', async () => {
    const req = {
      json: async () => { throw new Error('Invalid JSON') }
    }
    const response = await POST(req)
    expect(response.status).toBe(400)
  })
  
  it('should deduplicate images by signature', async () => {
    // Test that identical params return same imageUrl
  })
})
```

### Phase 3: Component Testing (Optional - Lower Priority)

**Use React Testing Library:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**Test interactive components:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { CyberButton } from './CyberButton'

describe('CyberButton', () => {
  it('should call onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<CyberButton onClick={onClick}>Click me</CyberButton>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
  
  it('should handle keyboard shortcuts', async () => {
    // Test shortcut key binding
  })
})
```

## Configuration Template

**vitest.config.ts (to add):**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        '**/*.d.ts',
        '**/types.ts',
        '**/constants.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
})
```

**package.json (add to scripts):**
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Golden Fixture Test Strategy

**For Pure-Math Numogram Engine:**

The canonical "known correct" outputs are in `app/data/*.ts`:
- `app/data/currents.ts`: Current definitions with zone mappings
- `app/data/gates.ts`: Gate definitions with cumulative values
- `app/data/demons.ts`: Demon entity mappings
- `app/data/syzygies.ts`: Syzygy pair definitions
- `app/data/zones.ts`: Zone metadata

**Test Validation:**
1. Run gematria calculations on cipher definitions
2. Compare output to base-10 values in `CCRU_CIPHERS`
3. Verify position geometry produces valid SVG paths
4. Assert numogram layout calculations match stored coordinates

**Example:**
```typescript
import { CCRU_CIPHERS } from '../cyphers/ccruCiphers'
import { CURRENTS } from '../data/currents'
import { calcGematria } from '../cyphers/gematria'

describe('Golden Fixture Validation', () => {
  it('should produce correct gematria for all ciphers', () => {
    const testPhrase = 'test phrase'
    for (const cipher of CCRU_CIPHERS) {
      const result = calcGematria(testPhrase, cipher)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)  // Sanity check
    }
  })
  
  it('should verify CURRENTS mapping consistency', () => {
    for (const current of CURRENTS) {
      expect(current.from).toBeGreaterThanOrEqual(0)
      expect(current.to).toBeGreaterThanOrEqual(0)
      expect(current.from).not.toBe(current.to)  // Currents connect different zones
    }
  })
})
```

---

*Testing analysis: 2026-09-25*

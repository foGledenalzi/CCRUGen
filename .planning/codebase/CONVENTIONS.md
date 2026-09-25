# Coding Conventions

**Analysis Date:** 2026-09-25

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `CyberButton.tsx`, `GatesPanel.tsx`)
- Utility modules: camelCase (e.g., `geometry.ts`, `gematria.ts`)
- Data/types modules: camelCase (e.g., `ccruCiphers.ts`, `types.ts`)
- API routes: follow Next.js convention in `app/api/` (e.g., `app/api/share-image/route.ts`)

**Components:**
- Export component names use PascalCase: `export function CyberButton()`
- All UI components are exported as named exports (not default exports)
- Component names often prefixed with "Cyber" for the UI system (e.g., `CyberPanel`, `CyberCheckbox`, `CyberInput`)

**Functions:**
- camelCase for all functions
- Utility functions are pure and export-first: `export function midpoint(a: Pos, b: Pos): Pos`
- Callback handlers use `on` prefix: `onClick`, `onToggle`, `onMouseEnter`, `onHeightChange`
- Internal helper functions defined within components use camelCase

**Variables:**
- camelCase for all variables
- Constants in uppercase with underscores: `MAX_SHARE_IMAGE_BYTES`, `TEST_PNG_DATA_URL`, `BASE_URL`
- React state variables use camelCase: `const [activeButton, setActiveButton] = useState()`
- Refs use camelCase: `const buttonRef = useRef<HTMLButtonElement>(null)`

**Types:**
- Interfaces: PascalCase with `Props` suffix for component props (e.g., `CyberButtonProps`, `CyberPanelProps`, `SelectableListPanelProps<T>`)
- Type aliases: PascalCase (e.g., `type CcruCipher = {...}`, `type Region = 'torque' | 'warp' | 'plex'`)
- Enum-like union types: lowercase with pipe syntax: `type Layout = 'labyrinth' | 'ladder' | 'original' | 'planetary'`
- Generic types: single uppercase letter (e.g., `<T>` for generic list components)

## Code Style

**Formatting:**
- No Prettier config in repository — code follows Next.js defaults
- Spacing: 2-space indentation (observed across all files)
- Line length: flexible, but generally readable
- Trailing commas in multiline structures

**Linting:**
- Tool: ESLint 8.57.1 with `eslint-config-next` 14.2.35
- Config file: `.eslintrc.json` with minimal configuration
- Active rules: `next/core-web-vitals` and `next/typescript`
- Run: `npm run lint`
- Enforces Next.js best practices and TypeScript type safety

**TypeScript Configuration:**
- File: `tsconfig.json`
- Strict mode: **enabled** (`"strict": true`)
- Key settings:
  - `"target": "es5"` for runtime compatibility
  - `"module": "esnext"` for bundler consumption
  - `"jsx": "preserve"` (handled by Next.js)
  - `"strict": true` ensures all strict type checks active
  - `"noEmit": true` (Next.js handles compilation)
  - `"isolatedModules": true` (per-file compilation safety)
  - `"paths": { "@/*": ["./*"] }` for import aliasing with `@/` prefix
- Component build uses separate `tsconfig.components.json`:
  - `"jsx": "react-jsx"` for component library output
  - `"module": "commonjs"` for npm distribution
  - `"target": "es2019"` for modern browser support
  - `"declaration": true` for .d.ts generation

## Import Organization

**Order:**
1. React and React hooks (e.g., `import React, { useEffect, useState } from 'react'`)
2. External packages and libraries (e.g., `import { NextRequest, NextResponse } from 'next/server'`, `import { BlobNotFoundError, put } from '@vercel/blob'`)
3. Local app imports using `@/` alias (e.g., `import { CyberButton } from '@/app/components/ui/CyberButton'`)

**Path Aliases:**
- `@/*` resolves to project root (e.g., `@/app/components/ui/CyberButton` → `app/components/ui/CyberButton.tsx`)
- Use `@/` prefix for all cross-file imports

**Example (from `app/components/page.tsx`):**
```typescript
import { useEffect, useState } from 'react'
import { Panel as SplitPanel, PanelGroup as SplitPanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { LiveEditor, LiveError, LivePreview, LiveProvider } from 'react-live'
import { Highlight, themes } from 'prism-react-renderer'

import { CypherHoverText } from './cyphers/CypherHoverText'
import { CyberButton } from './ui/CyberButton'
```

## Client/Server Boundary

**'use client' Directive:**
- All interactive React components include `'use client'` at the top
- Required for useState, useEffect, event handlers, hooks
- Examples: `app/components/ui/CyberButton.tsx`, `app/components/ui/CyberPanel.tsx`
- API routes handle server-side logic without this directive (e.g., `app/api/share-image/route.ts`)

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and error-prone functions
- Specific error type checking: `if (error instanceof BlobNotFoundError) { ... }`
- Error message extraction: `const message = error instanceof Error ? error.message : 'Failed to...'`
- HTTP errors return `NextResponse.json({ error: message }, { status: 400 })`

**Example (from `app/api/share-image/route.ts`):**
```typescript
try {
  const existing = await head(pathname)
  return NextResponse.json({ imageUrl: existing.url, ... })
} catch (error) {
  if (!(error instanceof BlobNotFoundError)) {
    throw error
  }
}
```

**Validation Functions:**
- Throw errors with descriptive messages:
  ```typescript
  if (!match) {
    throw new Error('Invalid share image payload. Expected PNG data URL.')
  }
  ```

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- Console logging in self-check scripts: `console.log('[share-self-check] Base URL: ...')`
- Prefix log messages with context in brackets: `[share-self-check]`
- No structured logging in application code (UI/API routes)

## Comments

**When to Comment:**
- Clarify non-obvious algorithmic intent (e.g., `// cyphers.news behavior: if a cipher does not map character...`)
- Explain business logic or domain-specific rules
- Keep to a minimum; prefer self-documenting code via clear naming

**JSDoc/TSDoc:**
- Not consistently used across the codebase
- Type annotations serve as primary documentation
- When used, follows standard TypeScript format

**Example (from `app/cyphers/gematria.ts`):**
```typescript
// cyphers.news behavior: if a cipher does not map character "1",
// treat number groups in phrase as full numbers and add them to total.
if (!valueMap.has(49)) {
  // ... implementation
}
```

## Function Design

**Size:** 
- Functions are generally concise (10-50 lines typical)
- Complex logic broken into smaller helper functions
- Example: `decodePngDataUrl()` is ~15 lines for a single responsibility

**Parameters:**
- Functions accept typed parameters with explicit types
- Object destructuring common for props:
  ```typescript
  export function CyberButton({ onClick, active = false, disabled = false, ... }: CyberButtonProps)
  ```
- Destructured parameters have explicit TypeScript type annotations via the Props interface
- Default values specified in destructuring

**Return Values:**
- All functions have explicit return type annotations
- Examples:
  - `function midpoint(a: Pos, b: Pos): Pos`
  - `function calcGematria(phrase: string, cipher: CcruCipher): number`
  - `async function POST(req: NextRequest): Promise<NextResponse>`
- React components return `React.ReactNode` or JSX

## Module Design

**Exports:**
- Named exports preferred (no default exports for components)
- Single export per file for components
- Utility modules export multiple named functions
- Example (`component-library/index.ts`):
  ```typescript
  export { CyberButton } from '../app/components/ui/CyberButton'
  export { calcGematria } from '../app/cyphers/gematria'
  export type { CcruCipher } from '../app/cyphers/ccruCiphers'
  ```

**Barrel Files:**
- `component-library/index.ts` re-exports all public components and utilities
- Used for npm package distribution
- Maintains single source of truth for public API

**File Structure:**
- One component per file (e.g., `CyberButton.tsx` contains only `CyberButton`)
- Utility files contain multiple related functions (e.g., `geometry.ts` has `midpoint`, `quadPath`, `loopPath`, etc.)
- Data files are constants (e.g., `currents.ts`, `gates.ts`)

## Component Patterns

**Props:**
- Always use explicit type/interface for props
- Props destructured in function signature with defaults
- Optional props marked with `?` in type definition
- Callback props always have explicit type annotations

**Example (from `CyberButton.tsx`):**
```typescript
type CyberButtonProps = {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  shortcut?: string
  size?: 'md' | 'sm'
  className?: string
  children: React.ReactNode
}

export function CyberButton({
  onClick,
  active = false,
  disabled = false,
  size = 'md',
  className = '',
  children,
}: CyberButtonProps) { ... }
```

**Hooks:**
- `useState` for local component state
- `useEffect` for side effects with proper dependency arrays
- `useMemo` for expensive computations
- `useRef` for DOM references and mutable values
- Always include dependency arrays in useEffect/useMemo

**Styling:**
- Tailwind CSS utility classes as primary styling approach
- Inline `style` prop for dynamic values
- CSS classes for static, reusable patterns
- Cyberpunk aesthetic: neon green (#10ff50), dark backgrounds (#0b111a, #060609)
- Custom colors via inline styles and `color-mix()` CSS function

**Example (from `CyberCheckbox.tsx`):**
```typescript
const borderActive = checked ? accent : 'rgba(75,85,99,0.55)'
const checkedBackground = `color-mix(in srgb, ${accent} 10%, rgba(10,14,20,0.9))`
return (
  <label
    className={`inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase...`}
    style={{
      border: `1px solid ${borderActive}`,
      background: checked ? checkedBackground : 'rgba(10,14,20,0.5)',
      transition: 'all 0.15s ease',
    }}
  >
```

## Styling Conventions

**Tailwind CSS:**
- Utility-first CSS via Tailwind 3.4.0
- No custom theme extensions in `tailwind.config.ts`
- Content globs: `['./app/**/*.{ts,tsx}']`

**CSS Classes:**
- Kebab-case for CSS class names (Tailwind standard)
- Responsive variants: `md:`, `lg:` prefixes
- Accessibility: `sr-only` for screen-reader only content
- Custom utility classes defined in `globals.css`

**Custom Styles:**
- Global styling in `app/globals.css`
- CRT scanlines overlay with animation
- Phosphor vignette effect
- Custom scrollbar styling with neon green accent
- Cyberpunk theme throughout

**Global CSS (from `globals.css`):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  overflow-x: hidden;
  background: #060609;
  color: #d1d5db;
}

/* CRT scanlines overlay */
body::after {
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 1px,
    rgba(16, 255, 80, 0.025) 1px,
    rgba(16, 255, 80, 0.025) 2px
  );
  animation: crt-flicker 0.08s infinite alternate;
}
```

**Color Palette:**
- Primary neon: `#10ff50` (bright green)
- Background: `#060609`, `#0b111a` (very dark)
- Text: `#d1d5db`, `#94a3b8` (light gray)
- Borders: `rgba(16,255,80,0.2)` (transparent green)
- Accents: cyan, magenta, yellow for highlights

## Type System

**Discriminated Unions:**
- Used for variant components and state machines
- Example (from `app/data/types.ts`):
  ```typescript
  export type HoverInfo =
    | { type: 'zone'; zone: number }
    | { type: 'syzygy'; data: SyzygyData }
    | { type: 'current'; data: CurrentData }
    | { type: 'gate'; gate: GateData }
    | { type: 'demon'; demon: Demon }
  ```

**Generics:**
- Used for reusable list/panel components
- Example (from `app/components/panels/shared.tsx`):
  ```typescript
  export function SelectableListPanel<T>(props: SelectableListPanelProps<T>)
  ```

**Type Imports:**
- Use `import type { ... }` for type-only imports
- Reduces bundle size, clarifies intent

## Utility Functions

**Pure Functions:**
- Geometry functions: `midpoint()`, `quadPath()`, `loopPath()`, `curveAway()`, `syzTrianglePoints()`
- Gematria calculation: `calcGematria()` with memoized cipher mapping
- All located in `app/lib/` and `app/cyphers/`

**Memoization:**
- Caching patterns used for expensive lookups
- Example (from `gematria.ts`):
  ```typescript
  const charMapCache = new Map<string, Map<number, number>>()
  function buildCharMap(cipher: CcruCipher): Map<number, number> {
    const cached = charMapCache.get(cipher.id)
    if (cached) return cached
    // ... build map
    charMapCache.set(cipher.id, map)
    return map
  }
  ```

---

*Convention analysis: 2026-09-25*

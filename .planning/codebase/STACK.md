# Technology Stack

**Analysis Date:** 2026-09-25

## Languages

**Primary:**
- TypeScript 5.0.0 - All source code (app, gematria plugin, components)

**Secondary:**
- JavaScript (ESM) - Build scripts (`scripts/*.mjs`), Next.js config

## Runtime

**Environment:**
- Node.js (version unspecified, detected via `export const runtime = 'nodejs'` in `app/api/share-image/route.ts`)

**Package Manager:**
- Yarn - Primary package manager (yarn.lock present)
- Lockfile: `yarn.lock` (150KB)

## Frameworks

**Core:**
- Next.js 14.2.0 - Full-stack framework, server-side rendering, API routes
- React 18.3.0 - Component rendering and state management
- React DOM 18.3.0 - DOM rendering

**Styling & UI:**
- Tailwind CSS 3.4.0 - Utility-first CSS framework (configured in `tailwind.config.ts`)
- PostCSS 8.4.0 - CSS transformations
- Autoprefixer 10.4.0 - Vendor prefix management

**Code Display & Editing:**
- Prism React Renderer 2.4.1 - Syntax highlighting for code blocks (used in `app/components/ui/CyberCodeBlock.tsx`)
- React Live 4.1.8 - Live editable/previewable code examples (used in `app/components/page.tsx`)

**UI Components & Layout:**
- React Resizable Panels 2.1.7 - Resizable split panel layouts (used in `app/components/page.tsx`)

## Key Dependencies

**Critical:**
- @vercel/blob 2.0.0 - Image storage and CDN for shared numogram images (used in `app/api/share-image/route.ts` for storing PNG exports)
- @vercel/analytics 1.6.1 - Analytics tracking (injected in `app/layout.tsx` as `<Analytics />`)

**Development:**
- ESLint 8.57.1 - Linting (config: `.eslintrc.json`)
- TypeScript type definitions (@types/node 20.0.0, @types/react 18.3.0, @types/react-dom 18.3.0)

## Build & Export System

**Rendering & Export:**
- Native Canvas API (SVG-to-PNG via `canvas.toDataURL('image/png')`) in `app/NumogramClient.tsx` lines 974-1018
- SVG DOM manipulation (query, transform, scale) for numogram visualization
- No html2canvas, jsPDF, or saveSvgAsPng dependencies - uses browser native APIs

**Component Library Export:**
- Compiled to CommonJS + TypeScript declarations for `ccru` package export
- Entry point: `dist/components/component-library/index.js` (built from `app/components/ui/**/*.tsx`, `app/cyphers/**`, utilities)
- Build script: `npm run build:components` (runs `tsc --project tsconfig.components.json`)

**Chrome Extension Build:**
- TypeScript compiled to ES5 JavaScript (gematria plugin)
- Build script: `npm run build:plugin-zip` (runs `scripts/build-plugin-zip.mjs`)
- Outputs: `public/downloads/ccru-gematria-plugin.zip` with manifest v3 configuration

## Configuration Files

**Compiler:**
- `tsconfig.json` - Main TypeScript config (target: ES5, jsx: preserve, strict mode enabled)
- `tsconfig.components.json` - Component library build config (target: ES2019, jsx: react-jsx, CommonJS output)
- Gematria plugin: `gematria/plugin/tsconfig.json`

**Styling:**
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer
- `tailwind.config.ts` - Content paths: `./app/**/*.{ts,tsx}`

**Linting:**
- `.eslintrc.json` - Extends `next/core-web-vitals` and `next/typescript`

**Next.js:**
- `next.config.js` - Minimal config (no custom webpack, redirects, or environment setup)

## Deployment & Hosting

**Target Platform:**
- Vercel (primary) - Uses Vercel-specific packages (@vercel/blob, @vercel/analytics)
- Static-site capable via `next export` (no dynamic routes except `/api/share-image`)
- API routes run on Vercel Functions (Node.js runtime)

**Browser Environment:**
- Client-side: Modern browsers with Canvas/SVG support
- Chrome Extension: Manifest V3 (Chrome 88+)

## Environment Configuration

**Required env vars:**
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob read/write access (checked in `scripts/share-image-self-check.mjs`)

**Optional env vars:**
- `BASE_URL` - Deploy URL for testing (defaults to `http://localhost:3000` in self-check script)

**Secrets location:**
- Environment variables stored in Vercel dashboard (not in repo)

---

*Stack analysis: 2026-09-25*

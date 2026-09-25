# External Integrations

**Analysis Date:** 2026-09-25

## APIs & External Services

**Vercel Blob Storage:**
- Vercel Blob - Cloud image storage for shared numogram PNG exports
  - SDK/Client: `@vercel/blob` v2.0.0
  - Auth: `BLOB_READ_WRITE_TOKEN` (environment variable)
  - Usage: `app/api/share-image/route.ts` (POST endpoint for storing/retrieving share images)
  - Functions: `head()` (check existence), `put()` (upload PNG), `get()` (retrieve)

**Analytics:**
- Vercel Analytics - Site analytics and performance monitoring
  - SDK/Client: `@vercel/analytics` v1.6.1
  - Auth: Configured via Vercel deployment settings
  - Usage: `app/layout.tsx` (injected as `<Analytics />` component)
  - No environment vars required for basic tracking

## Data Storage

**Databases:**
- None - No persistent database configured
- All data is static or computed client-side (numogram parameters, gematria values)
- Share images are stored as files in Vercel Blob, not a traditional database

**File Storage:**
- Vercel Blob (production) - Stores PNG export files in CDN-backed blob storage
- Local filesystem (development) - Build artifacts in `dist/`, public assets in `public/`
- Public downloads: `public/downloads/ccru-gematria-plugin.zip` (Chrome extension)

**Caching:**
- None detected - No Redis, Memcached, or similar caching layer

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system
- All features are public/anonymous
- No login, user accounts, or permission system

**Plugin Integration:**
- Chrome extension (Manifest V3) - No authentication required
- Permissions: `storage` (local extension storage), `contextMenus`, `tabs`, `scripting`, `<all_urls>`
- Uses browser's native storage API for saved phrases/configuration

## Data Flow: Share Image Generation

**Request → Processing → Storage:**

1. Client (`app/NumogramClient.tsx`) renders SVG numogram to Canvas
2. Client converts Canvas to PNG data URL via `canvas.toDataURL('image/png')`
3. Client POSTs to `POST /api/share-image` with:
   - `params` - Numogram layout params (layout, selected, layers, region, date, orbits, etc.)
   - `dataUrl` - Optional base64-encoded PNG (for new shares)
4. Server (`app/api/share-image/route.ts`):
   - Canonicalizes params via `canonicalizeShareParams()` (in `app/lib/shareParams.ts`)
   - Generates SHA-256 signature of sorted param keys/values
   - Constructs blob pathname: `numogram/share/{signature}.png`
   - Checks if image already exists via `head(pathname)`
   - If exists: Returns existing URL (deduplication)
   - If missing and dataUrl provided: Uploads PNG via `put(pathname, pngBuffer, {...})`
   - On race conditions: Retries head() and returns existing URL
5. Server returns JSON with `imageUrl`, `signature`, `reused` flag, `canonicalQuery`
6. Image is stored in Vercel Blob and publicly accessible at returned URL

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar error tracking

**Logs:**
- Console logging in build scripts (info level)
- Server logs via Vercel deployment logs
- Self-check script (`scripts/share-image-self-check.mjs`) validates share-image API at deploy time

## Build Artifacts & Exports

**Component Library:**
- Output: `dist/components/component-library/index.js` + TypeScript definitions
- Exports: UI components, cypher utilities, xenotation lib
- Package exports (from `package.json`):
  ```
  "./components" → dist/components/component-library/index.d.ts (types) + .js (esm)
  ```
- Published via npm or git dependency for external consumers

**Chrome Extension:**
- Package: `ccru-gematria-plugin.zip`
- Location: `public/downloads/ccru-gematria-plugin.zip`
- SHA-256 metadata: Auto-generated in `app/gematria/plugin/zipInfo.ts` at build time
- Distributable as unpacked extension or via Chrome Web Store

## Webhooks & Callbacks

**Incoming:**
- `/api/share-image` - Single POST endpoint for share image generation/retrieval
- No other API endpoints

**Outgoing:**
- None detected - No webhooks to external services
- Self-check script (`scripts/share-image-self-check.mjs`) calls share-image endpoint at build time for validation

## Cross-Origin & Security

**CORS:**
- Not configured (Next.js API routes default to same-origin)
- Client requests (`fetch()` in `app/NumogramClient.tsx`) are same-origin to `/api/share-image`

**Content Security:**
- SVG rendering is DOM-based (not sanitized by external services)
- Chrome extension operates on `<all_urls>` with content script injection (local analysis only)
- PNG exports are generated client-side and server stores only

---

*Integration audit: 2026-09-25*

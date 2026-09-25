# Codebase Structure

**Analysis Date:** 2026-09-25

## Directory Layout

```
app/
├── data/                      # Hand-authored numogram constants
│   ├── types.ts               # Type definitions (Layout, Layer, Region, HoverInfo, etc.)
│   ├── zones.ts               # Zone metadata, colors, planets, particles, lore
│   ├── positions.ts           # Hand-authored coordinates for 4 layout modes + planetary
│   ├── syzygies.ts            # Syzygy pair definitions (a, b, demon name, description)
│   ├── currents.ts            # Current flow definitions (from, to, label, desc)
│   ├── gates.ts               # Gate definitions (from, to, cumulative index, desc)
│   └── demons.ts              # Demon name mappings + classification logic
├── lib/                       # Pure computation layer
│   ├── geometry.ts            # SVG path generation (quadratic curves, loops, triangles)
│   ├── numogram.ts            # Digital reduction / plex expressions
│   ├── xenotation.ts          # Prime factorization notation
│   ├── planetary.ts           # Orbital mechanics, planetary positioning
│   ├── constants.ts           # Derived constants (region colors, TC edges, etc.)
│   ├── cyberColors.ts         # Color palette definitions
│   ├── shareParams.ts         # URL parameter encoding/decoding for share links
│   ├── shareTitle.ts          # Share title builder
│   └── easing.ts              # Animation easing functions
├── hooks/                     # React hooks (state management + animation)
│   ├── useIntro.ts            # Intro animation phase tracking
│   ├── useTween.ts            # Position interpolation for layout switching
│   ├── useOrbitalAnimation.ts # Planetary orbital animation
│   ├── usePanelDrag.ts        # Panel dragging and z-index management
│   ├── useCanvasPan.ts        # SVG zoom/pan interactions
│   ├── usePanelGroupLayout.ts # Mobile panel group height computation
│   ├── useParallax.ts         # Parallax scroll effect tracking
│   └── useGlitchNavigate.ts   # Layout switch glitch effect trigger
├── components/
│   ├── projection/
│   │   └── Projection.tsx     # Main SVG renderer (layout-aware)
│   ├── panels/                # Interactive info panels
│   │   ├── PanelGroup.tsx     # Mobile-responsive panel container
│   │   ├── LayersPanel.tsx    # Toggle visibility of layers
│   │   ├── LabelsPanel.tsx    # Toggle label types (numbers, xenotation, planets)
│   │   ├── ZonesPanel.tsx     # Zone selection and info display
│   │   ├── SyzygiesPanel.tsx  # Syzygy list and selection
│   │   ├── CurrentsPanel.tsx  # Current flow list and selection
│   │   ├── GatesPanel.tsx     # Gate list and selection
│   │   ├── RegionsPanel.tsx   # Region highlight controls
│   │   ├── HoverInfoList.tsx  # Generic hover info renderer
│   │   └── shared.tsx         # Common panel utilities
│   ├── numogram/              # Numogram-specific UI
│   │   ├── NumogramIcons.tsx  # SVG icon components for buttons
│   │   ├── ShortcutsModal.tsx # Keyboard shortcuts help modal
│   │   └── SourcesFooter.tsx  # Citation and sources footer
│   ├── navigation/            # Navigation UI
│   │   └── CrtNavigationTransition.tsx # CRT-effect transition between modes
│   ├── info/                  # Info display panels
│   │   ├── InfoDisplay.tsx    # Hover/pinned info displayer
│   │   └── PinnedBackground.tsx # Background for pinned info
│   ├── cyphers/               # Cipher-related UI (external to numogram)
│   │   └── CypherHoverText.tsx
│   ├── ui/                    # Reusable cyberpunk UI components
│   │   ├── CyberButton.tsx
│   │   ├── CyberButtonGroup.tsx
│   │   ├── CyberPanel.tsx
│   │   ├── CyberContainer.tsx
│   │   ├── CyberCheckbox.tsx
│   │   ├── CyberRadio.tsx
│   │   ├── CyberInput.tsx
│   │   ├── CyberTextArea.tsx
│   │   ├── CyberCodeBlock.tsx
│   │   ├── CyberPageHeader.tsx
│   │   ├── GlitchText.tsx
│   │   ├── GlitchTransition.tsx
│   │   ├── Pill.tsx
│   │   ├── StatusDot.tsx
│   │   ├── NeonDivider.tsx
│   │   ├── SectionFrame.tsx
│   │   ├── Figure.tsx
│   │   ├── DataRow.tsx
│   │   ├── HomeLink.tsx
│   │   ├── CyberPopover.tsx
│   │   ├── CyberGridGroup.tsx
│   │   └── CyberStackGroup.tsx
│   └── page.tsx               # Main layout wrapper for all pages
├── numogram/                  # Next.js App Router structure
│   └── (implied numogram/page.tsx - server component wrapper)
├── api/
│   └── share-image/
│       └── route.ts           # API endpoint for share image generation/storage
├── cyphers/                   # Cipher tool (separate feature)
│   ├── page.tsx
│   ├── CyphersClient.tsx
│   ├── gematria.ts
│   └── ccruCiphers.ts
├── gematria/                  # Gematria tool (separate feature)
│   └── (implied gematria/page.tsx)
├── page.tsx                   # Home page router
├── layout.tsx                 # Root layout (app-wide head/body)
├── globals.css                # Global styles (Tailwind + cyber theme)
├── robots.ts                  # SEO robots.txt generator
├── sitemap.ts                 # SEO sitemap generator
├── layout.tsx                 # Root layout wrapper
├── icon.svg                   # Site icon/favicon
└── [other config]
```

## Directory Purposes

**`app/data/`:**
- Purpose: Central source of truth for all numogram constants
- Contains: Type definitions, zone metadata (colors, regions, particles, lore), hand-authored positions for each layout mode, relationship definitions (syzygies, currents, gates, demons)
- Key files: `zones.ts` (7.2 KB, extensive lore), `positions.ts` (coordinates), `types.ts` (type definitions)

**`app/lib/`:**
- Purpose: Layout-agnostic computation and utility functions
- Contains: SVG path generation, prime factorization, orbital mechanics, digital reduction, URL parameter handling
- Key files: `geometry.ts` (path builders), `xenotation.ts` (prime factorization), `planetary.ts` (orbital math)
- Notably base-agnostic except `numogram.ts` and `shareParams.ts` which assume base-10

**`app/hooks/`:**
- Purpose: Encapsulated React hooks for state management and animation
- Contains: Position interpolation (useTween), orbital animation (useOrbitalAnimation), UI interactions (usePanelDrag, useCanvasPan), layout state (usePanelGroupLayout)
- Key files: `useTween.ts` (smooth layout switching), `usePanelDrag.ts` (interactive panel dragging)

**`app/components/projection/`:**
- Purpose: Main SVG rendering engine
- Contains: `Projection.tsx` (1500+ lines) — handles zone circles, syzygies, currents, gates, planetary orbits, particles, labels
- Notably: Takes props from NumogramClient (positions, layers, selections, hover state); renders to canvas/SVG

**`app/components/panels/`:**
- Purpose: Interactive side panels for filtering and exploring numogram data
- Contains: 7 panels (Layers, Labels, Zones, Syzygies, Currents, Gates, Regions) + shared utilities
- Key files: `PanelGroup.tsx` (mobile responsive container), shared panel UI

**`app/components/ui/`:**
- Purpose: Reusable cyberpunk-themed UI components
- Contains: Buttons, inputs, panels, checkboxes, text effects (glitch, neon), cards
- Pattern: All prefixed with "Cyber" for thematic consistency

**`app/components/numogram/`:**
- Purpose: Numogram-specific UI elements
- Contains: Icon definitions, shortcuts modal, sources/citations footer

**`app/cyphers/` and `app/gematria/`:**
- Purpose: Separate auxiliary features (not core to numogram viewer)
- Contains: Chrome plugin integration, gematria encoding reference
- Decoupled from main numogram logic

**`app/api/share-image/`:**
- Purpose: Server API for image capture and storage
- Location: `route.ts` (Next.js API route)
- Functionality: Receives SVG snapshot, generates PNG preview, stores for share links

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Home page with feature cards; redirects to `/numogram` if query params detected
- `app/numogram/page.tsx` (implied): Server component for `/numogram` route; wraps `<NumogramClient>`
- `NumogramClient.tsx`: Root client component; orchestrates all state and rendering

**Configuration:**
- `app/globals.css`: Tailwind + cyber theme styles (9.2 KB)
- `layout.tsx`: Root layout with head metadata, nav structure
- `robots.ts`, `sitemap.ts`: SEO configuration

**Core Logic:**
- `data/zones.ts`: Complete zone metadata (7.2 KB, 8 zones with 20+ properties each)
- `data/positions.ts`: Hand-authored coordinates for all layout modes
- `lib/geometry.ts`: SVG path algorithms (quadratic curves, loops, triangles)
- `lib/planetary.ts`: Orbital mechanics and position computation
- `components/projection/Projection.tsx`: Main 1500+ line SVG renderer

**Testing:**
- No dedicated test files detected in this codebase snapshot

## Naming Conventions

**Files:**
- Components: PascalCase with `.tsx` extension (`NumogramClient.tsx`, `Projection.tsx`)
- Data/Lib: camelCase with `.ts` extension (`geometry.ts`, `shareParams.ts`)
- Utilities: Prefixed with function type (`use*` for hooks, `*Panel` for panels)
- Exports: Named exports for types (e.g., `type Layout = ...`); default/named exports for components and functions

**Directories:**
- Feature-based grouping: `components/`, `hooks/`, `data/`, `lib/`
- Functional grouping within components: `panels/`, `ui/`, `numogram/`, `info/`, etc.
- Lowercase, singular/plural as needed (`zones`, `hooks`)

**TypeScript:**
- Types: PascalCase (e.g., `ZoneMeta`, `SyzygyData`, `HoverInfo`)
- Interfaces: PascalCase prefix with capital I avoided; plain type aliases preferred (e.g., `type Layout = ...`)
- Constants: UPPER_SNAKE_CASE for global data (e.g., `ZONE_CLR`, `PLANETARY_RADIUS`, `DEFAULT_LAYERS`)
- Functions: camelCase (e.g., `plexExpr`, `quadPath`, `getAnglesForDate`)

**React State:**
- State variables: camelCase (e.g., `layout`, `selZones`, `pinnedInfo`)
- SetState function: `set{StateName}` (e.g., `setLayout`, `setSelZones`)
- Memoized values: memoized* or descriptive name (e.g., `gateRenderData`, `selectedInfos`)

## Where to Add New Code

**New Feature (Base Converter/Generator):**
- Primary code: `app/lib/` — add base-agnostic computation module (e.g., `baseNumogram.ts` with functions `computeSyzygiesForBase(base)`, `computeGatesForBase(base)`)
- State: Extend `NumogramClient.tsx` to accept `base` prop or query param
- Types: Add to `app/data/types.ts` (e.g., `type BaseNumogramState = { base: number; ... }`)
- UI: Add layout switcher button in top control bar

**New Layout Mode:**
- Positions: Add new coordinate set to `app/data/positions.ts` (e.g., `P_HELIX: Record<number, Pos> = { ... }`)
- Type: Update `type Layout` in `app/data/types.ts` to include new mode
- Hook: Adapt `useTween.ts` to support interpolation from all existing layouts
- Rendering: No changes to `Projection.tsx` needed; it uses `pos` prop which is position-agnostic

**New Interactive Panel:**
- Template: Copy `app/components/panels/ZonesPanel.tsx`
- State: Add state variable to `NumogramClient.tsx` (e.g., `const [demonOpen, setDemonOpen] = useState(true)`)
- Rendering: Add `<DemonPanel open={demonOpen} onToggle={setDemonOpen} ...props />` in NumogramClient render
- Data: Reference data from `app/data/demons.ts`

**New Cyber UI Component:**
- Location: `app/components/ui/Cyber{ComponentName}.tsx`
- Pattern: Accept standard HTML props (className, onClick, etc.) + Cyber-specific styling props
- Styling: Use Tailwind classes + CSS variables from `globals.css` (e.g., `var(--neon-green)`)

**Base-Specific Metadata (Zones, Demons, Lore):**
- Location: Create `app/data/bases/{base}/` directory structure
  - `app/data/bases/10/zones.ts`
  - `app/data/bases/10/demons.ts`
  - `app/data/bases/16/zones.ts` (for hex implementation)
- Import: Switch based on `base` prop:
  ```typescript
  import { ZONE_META } from `./data/bases/${base}/zones`
  ```

**Testing:**
- If adding unit tests: Create `__tests__/` directory parallel to source
- Recommended: Test pure functions in `lib/` (geometry, numogram, xenotation)
- Example: `app/lib/__tests__/geometry.test.ts`

## Special Directories

**`public/`:**
- Purpose: Static assets (SVG logos, favicons)
- Generated: No
- Committed: Yes

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (`.gitignore` excludes)

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (via npm run build)
- Committed: No (`.gitignore` excludes)

**`reference/`:**
- Purpose: Local reference materials (gitignored)
- Generated: Manual / external
- Committed: No

**`.planning/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by GSD mapper agents)
- Committed: Yes

## URL Structure & Routing

**Next.js App Router Pages:**
- `/` → `app/page.tsx` (home, features, redirects with numogram query)
- `/numogram` → `app/numogram/page.tsx` (numogram viewer + NumogramClient)
- `/components` → `app/components/page.tsx` (UI component showcase)
- `/cyphers` → `app/cyphers/page.tsx` (cipher tool)
- `/gematria` → `app/gematria/page.tsx` (gematria reference)

**Query Parameters (Numogram State Encoding):**
- `layout=labyrinth|ladder|original|planetary`
- `selected=1,2,3,...` (comma-separated zone IDs)
- `layers=syzygies,currents,gates,pandemonium` (comma-separated enabled layers)
- `region=torque|warp|plex` (highlight region)
- `tc=1` (Time Circuit active)
- `particles=1` (particles enabled)
- `date=YYYY-MM-DD` (planetary mode date)
- `orbits=0` (planetary mode: hide orbits)
- `img=<url>` (share image URL)

**API Endpoints:**
- `POST /api/share-image` — Generate or fetch share preview image

---

*Structure analysis: 2026-09-25*

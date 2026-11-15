// The Names panel shell (Phase 7, plan 17; D-02, D-04, D-06, D-09, D-11, D-13, D-14, NAM-01, NAM-03, NAM-04, research Pitfall 13,
// T-07-05b, T-07-04b, T-07-17c, T-07-10d): the global control blocks in the UI-SPEC order, the four states, the preview notice, the
// header tag, the persistent live carrier and the pure helpers behind the handlers. Server render only (the repo has no DOM test
// library), with a hand-built NamingContext value per state and no-op action functions; the interactive paths live in pure helpers
// that are tested directly, and the browser behaviour is the e2e suite's job (plans 07-22 and 07-23). Every sentence is compared with
// the copy module or with the UI-SPEC wording; no canonical CCRU name or sound is typed here (the names come from the engine's own
// naming and the preset by reference). No JSX (plain node test file).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The zone list (plan 19) is windowed by @tanstack/react-virtual, which renders no rows in a server render (it has no scroll element to
// measure). The real library is kept, with one injected starting rectangle, so a render shows the first window the real windowing
// rule gives (not a fixed fake one), and every call's options are recorded for the tests that check what the list asks of it.
interface VirtualCall {
  readonly count: number
  readonly overscan?: number
  readonly estimateSize: (index: number) => number
  readonly scrollMargin?: number
  readonly scrollPaddingStart?: number
  readonly getScrollElement: () => unknown
}
const { virtualCalls, WINDOW } = vi.hoisted(() => ({ virtualCalls: [] as VirtualCall[], WINDOW: { width: 206, height: 400 } }))
vi.mock('@tanstack/react-virtual', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-virtual')>()
  return {
    ...actual,
    useVirtualizer: (options: Record<string, unknown>) => {
      virtualCalls.push(options as unknown as VirtualCall)
      return (actual.useVirtualizer as (o: Record<string, unknown>) => unknown)({
        ...options,
        initialRect: WINDOW,
      })
    },
  }
})

import {
  DEFAULT_SEED,
  ISSUES_MAX,
  NAMING_IMPORT_MAX_BYTES,
  SCHEMA_ID,
  SEED_MAX_LENGTH,
  UNKNOWN_KEYS_MAX,
  createNameResolver,
  createNaming,
  editSound,
  findCollisions,
  meshOf,
  netSpanOf,
  normalizeSeed,
  serializeNaming,
  smoothingInert,
  toggleLock,
  validateNamingJson,
  type CollisionGroup,
  type CollisionReport as CollisionData,
  type Naming,
  type NamingImport,
} from '../../engine/index'
import {
  CollisionReport,
  CollisionReportView,
  collisionAnnouncement,
  jumpOutcome,
  jumpsOf,
  linesShown,
  phaseOf,
  type CollisionReportViewProps,
} from '../../app/components/names/CollisionReport'
import {
  NamesHeaderTag,
  NamesPanel,
  NamesStatusSlot,
  downloadJson,
  exportFileName,
  exportNaming,
  importAllowed,
  importOutcome,
  previewMeshes,
  readImportFile,
  rerollSeed,
  seedCommitOf,
  seedKeyIntent,
  statusFate,
  type DownloadEnv,
  type NamesStatus,
} from '../../app/components/names/NamesPanel'
import { NamingContext, type NamingContextValue } from '../../app/components/names/NamingContext'
import { ZoneList, ZoneRowView, type ZoneRowHandlers } from '../../app/components/names/ZoneList'
import { ShortcutsModal } from '../../app/components/numogram/ShortcutsModal'
import { NumogramViewContext, type NumogramViewContextValue } from '../../app/components/numogram/ViewContext'
import { PENDING_GRACE_MS } from '../../app/lib/canvas/diagramModel'
import { netSpanLabel } from '../../app/lib/demonBrowser'
import {
  NAMES_COPY,
  collisionsNotChecked,
  collisionsSome,
  exportSeedOnly,
  exportSuccess,
  formatBytes,
  importError,
  importSeedOnly,
  importSuccess,
  invalidEntries,
  jumpAriaLabel,
  lockAria,
  moreJumps,
  noticeBody,
  pendingLine,
  savedLine,
  seedOnlySentence,
  showingNames,
  summaryLine,
  unknownKeysSuffix,
  zoneAria,
  type ImportCopyContext,
} from '../../app/lib/namingCopy'
import {
  COLLISION_JUMPS_SHOWN,
  COLLISION_LINES_STEP,
  NAMES_PREVIEW_ROWS,
  NAMES_SCROLL_INSET_PX,
  REROLL_SEED_LENGTH,
  SOUND_FIELD_MAX_INPUT,
  ZONE_LIST_OVERSCAN,
  ZONE_ROW_HEIGHT_PX,
} from '../../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { ZONE_HEADER_HEIGHT_PX } from '../../app/lib/zoneListModel'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'

const PANEL_SOURCE = fileURLToPath(new URL('../../app/components/names/NamesPanel.tsx', import.meta.url))
const ZONE_LIST_SOURCE = fileURLToPath(new URL('../../app/components/names/ZoneList.tsx', import.meta.url))
const SHORTCUTS_SOURCE = fileURLToPath(new URL('../../app/components/numogram/ShortcutsModal.tsx', import.meta.url))
const noop = (): undefined => undefined
const CCRU_BASE = CCRU_NAMING_PRESET.base
const OTHER_BASE = 28
const SEED_ONLY_BASE = INTERACTIVE_MAX_N + 2

// ── fixtures ────────────────────────────────────────────────────────────────

function namingOf(base: number, over: Partial<Parameters<typeof createNaming>[0]> = {}): Naming {
  return createNaming({ base, interactiveMaxN: INTERACTIVE_MAX_N, ...over })
}

/** The default naming of the CCRU base: the preset itself. */
function ccruNaming(): Naming {
  return namingOf(CCRU_BASE, { source: 'ccru', preset: CCRU_NAMING_PRESET })
}

function valueFor(naming: Naming, over: Partial<NamingContextValue> = {}): NamingContextValue {
  const seedOnly = naming.base > INTERACTIVE_MAX_N
  return {
    base: naming.base,
    naming,
    rev: 1,
    resolver: createNameResolver(naming, CCRU_NAMING_PRESET),
    preset: CCRU_NAMING_PRESET,
    state: seedOnly ? 'seed-only' : 'ready',
    pendingBase: null,
    saved: seedOnly ? 'seed-only' : 'none',
    uncarried: false,
    interactiveMaxN: INTERACTIVE_MAX_N,
    announcement: '',
    restored: { tick: 0, zone: null },
    apply: () => false,
    keep: noop,
    revert: noop,
    undo: () => false,
    announce: noop,
    ...over,
  }
}

interface PanelProps {
  open: boolean
  bodyMax: number
  pinnedMesh: number | null
  pinnedZone: number | null
}

function render(value: NamingContextValue | null, props: Partial<PanelProps> = {}): string {
  const panel = createElement(NamesPanel, { open: true, bodyMax: 400, pinnedMesh: null, pinnedZone: null, ...props })
  return renderToStaticMarkup(value === null ? panel : createElement(NamingContext.Provider, { value }, panel))
}

function renderTag(value: NamingContextValue | null): string {
  const tag = createElement(NamesHeaderTag)
  return renderToStaticMarkup(value === null ? tag : createElement(NamingContext.Provider, { value }, tag))
}

// ── a tiny markup reader (no DOM library in this repo) ──────────────────────

interface El {
  readonly tag: string
  readonly open: string
  readonly inner: string
  readonly index: number
}

function openTagRe(attr: string): RegExp {
  return new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*?\\s${attr}(?=[=\\s/>])[^>]*>`, 'g')
}

function bodyOf(markup: string, tag: string, from: number): string {
  const closer = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g')
  closer.lastIndex = from
  let depth = 1
  let hit: RegExpExecArray | null
  while ((hit = closer.exec(markup)) !== null) {
    depth += hit[1] === '/' ? -1 : 1
    if (depth === 0) return markup.slice(from, hit.index)
  }
  return ''
}

function findAll(markup: string, attr: string): El[] {
  const out: El[] = []
  const re = openTagRe(attr)
  let m: RegExpExecArray | null
  while ((m = re.exec(markup)) !== null) {
    const open = m[0]
    out.push({ tag: m[1], open, inner: open.endsWith('/>') ? '' : bodyOf(markup, m[1], m.index + open.length), index: m.index })
  }
  return out
}

function find(markup: string, attr: string): El | null {
  return findAll(markup, attr)[0] ?? null
}

function need(markup: string, attr: string): El {
  const el = find(markup, attr)
  if (el === null) throw new Error(`no element with ${attr} in the markup`)
  return el
}

function attrOf(open: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(open)
  return m === null ? null : m[1]
}

function flagOf(open: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[=\\s/>])`).test(open)
}

function decode(s: string): string {
  return s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function textOf(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ''))
}

function at(markup: string, attr: string): number {
  const el = find(markup, attr)
  if (el === null) throw new Error(`no element with ${attr} in the markup`)
  return el.index
}

/** The radio inputs of one group name, in order. */
function radiosOf(markup: string, name: string): El[] {
  return findAll(markup, `name="${name}"`)
}

function classOf(open: string): string {
  return attrOf(open, 'class') ?? ''
}

// ── the panel outside a provider, collapsed and open ───────────────────────

describe('NamesPanel: provider and carrier', () => {
  it('renders nothing outside a NamingContext provider, and so does the header tag', () => {
    expect(render(null)).toBe('')
    expect(renderTag(null)).toBe('')
  })

  it('collapsed: the root and the persistent live carrier are present, the body is not', () => {
    const markup = render(valueFor(namingOf(OTHER_BASE), { announcement: NAMES_COPY.restored }), { open: false })
    const root = need(markup, 'data-names-panel')
    expect(attrOf(root.open, 'data-names-state')).toBe('ready')
    expect(attrOf(root.open, 'data-names-base')).toBe(String(OTHER_BASE))
    const live = need(markup, 'data-names-live')
    expect(attrOf(live.open, 'role')).toBe('status')
    expect(attrOf(live.open, 'aria-live')).toBe('polite')
    expect(classOf(live.open).split(' ')).toContain('sr-only')
    expect(textOf(live.inner)).toBe(NAMES_COPY.restored)
    expect(markup).not.toContain('data-names-scroll')
    expect(markup).not.toContain('data-names-seed')
    expect(markup).not.toContain('<table')
    // the prerendered HTML stays small while collapsed (research Pitfall 13)
    expect(markup.length).toBeLessThan(600)
  })

  it('open: the carrier is the same element and the body adds one scroller with the documented inline style', () => {
    const markup = render(valueFor(namingOf(OTHER_BASE)), { bodyMax: 400 })
    expect(findAll(markup, 'data-names-live')).toHaveLength(1)
    const scroll = need(markup, 'data-names-scroll')
    const style = attrOf(scroll.open, 'style') ?? ''
    expect(style).toContain(`max-height:${400 - NAMES_SCROLL_INSET_PX}px`)
    expect(style).toContain('overflow-y:auto')
    expect(style).toContain('overflow-x:hidden')
    expect(style).toContain('overscroll-behavior:contain')
    expect(style).toContain('touch-action:pan-y')
    // the carrier sits outside the scroller so it is never scrolled out of the tree
    expect(at(markup, 'data-names-live')).toBeLessThan(at(markup, 'data-names-scroll'))
    expect(scroll.inner).not.toContain('data-names-live')
  })

  it('every root carries data-post-baseline', () => {
    expect(attrOf(need(render(valueFor(namingOf(OTHER_BASE))), 'data-names-panel').open, 'data-post-baseline')).toBe('')
    const tagMarkup = renderTag(valueFor(namingOf(OTHER_BASE), { uncarried: true }))
    expect(attrOf(need(tagMarkup, 'data-names-header-tag').open, 'data-post-baseline')).toBe('')
  })
})

// ── ready: the global blocks in order, with the exact copy ─────────────────

describe('NamesPanel: ready state at a base with no CCRU source', () => {
  const markup = render(valueFor(namingOf(OTHER_BASE)))

  it('shows the blocks in the UI-SPEC order', () => {
    const order = [
      at(markup, 'data-names-seed'),
      at(markup, 'data-names-reroll'),
      at(markup, 'data-names-style-description'),
      at(markup, 'data-names-join-description'),
      at(markup, 'data-names-smoothing'),
      at(markup, 'data-names-preview'),
      at(markup, 'data-names-summary'),
      at(markup, 'data-names-saved'),
    ]
    expect([...order].sort((x, y) => x - y)).toEqual(order)
    expect(markup).not.toContain('data-names-preview-notice')
    expect(markup).not.toContain('ccrug-names-source')
  })

  it('seed: the field holds the seed, is capped and described, and the reroll button has its own row', () => {
    const seed = need(markup, 'data-names-seed')
    expect(seed.tag).toBe('input')
    expect(attrOf(seed.open, 'value')).toBe(DEFAULT_SEED)
    expect(attrOf(seed.open, 'aria-label')).toBe(NAMES_COPY.seedEyebrow)
    expect(attrOf(seed.open, 'maxLength')).toBe(String(SEED_MAX_LENGTH))
    expect(flagOf(seed.open, 'readonly')).toBe(false)
    expect(attrOf(seed.open, 'aria-disabled')).toBeNull()
    expect(attrOf(seed.open, 'aria-invalid')).toBeNull()
    expect(attrOf(seed.open, 'dir')).toBe('auto') // WR-07: a seed may be in a right-to-left script, like the sound and name fields
    const classes = classOf(seed.open)
    expect(classes).toContain('ui-terminal-input')
    expect(classes).toContain('text-[14px]')
    expect(classes).toContain('py-1')
    expect(markup).toContain('class="ui-terminal-field"')
    const reroll = need(markup, 'data-names-reroll')
    expect(reroll.tag).toBe('button')
    expect(textOf(reroll.inner)).toBe('Reroll unlocked sounds')
    expect(textOf(reroll.inner)).toBe(NAMES_COPY.reroll)
    expect(flagOf(reroll.open, 'disabled')).toBe(false)
    expect(classOf(reroll.open)).toContain('min-h-[24px]')
    // its own row: the wrapper between the field and the button is a button row
    expect(markup).toMatch(/<div class="flex flex-wrap gap-2[^"]*"><button[^>]*data-names-reroll/)
    expect(find(markup, 'data-names-seed-error')).toBeNull()
  })

  it('shows the one-line hint where the Source row is absent', () => {
    expect(textOf(markup)).toContain('CCRU names exist for base 10 only.')
    expect(textOf(markup)).toContain(NAMES_COPY.ccruHint)
  })

  it('style: a labelled radiogroup described by the visible description of the selected style', () => {
    const group = findAll(markup, 'role="radiogroup"').find(el => attrOf(el.open, 'aria-label') === 'Style')
    expect(group).toBeDefined()
    const description = need(markup, 'data-names-style-description')
    expect(attrOf(group?.open ?? '', 'aria-describedby')).toBe(attrOf(description.open, 'id'))
    expect(textOf(description.inner)).toBe('Consonant clusters, like the CCRU names.')
    const radios = radiosOf(markup, 'ccrug-names-style')
    expect(radios).toHaveLength(3)
    expect(radios.map(r => flagOf(r.open, 'checked'))).toEqual([true, false, false])
    expect(textOf(markup)).toContain(NAMES_COPY.styleLabels.harsh)
    expect(textOf(markup)).toContain(NAMES_COPY.styleLabels.soft)
    expect(textOf(markup)).toContain(NAMES_COPY.styleLabels.syllabic)
  })

  it('join order: a labelled radiogroup with its own visible description', () => {
    const group = findAll(markup, 'role="radiogroup"').find(el => attrOf(el.open, 'aria-label') === 'Join order')
    expect(group).toBeDefined()
    const description = need(markup, 'data-names-join-description')
    expect(attrOf(group?.open ?? '', 'aria-describedby')).toBe(attrOf(description.open, 'id'))
    expect(textOf(description.inner)).toBe("The higher zone's sound comes first.")
    const radios = radiosOf(markup, 'ccrug-names-join')
    expect(radios).toHaveLength(2)
    expect(radios.map(r => flagOf(r.open, 'checked'))).toEqual([true, false])
    expect(textOf(markup)).toContain('High then low')
    expect(textOf(markup)).toContain('Low then high')
  })

  it('smoothing: an unchecked checkbox with the helper, and no inert caption for a harsh table', () => {
    const naming = namingOf(OTHER_BASE)
    expect(naming.sounds).not.toBeNull()
    expect(smoothingInert(naming.sounds ?? [])).toBe(false)
    const box = need(markup, 'data-names-smoothing')
    expect(attrOf(box.open, 'type')).toBe('checkbox')
    expect(flagOf(box.open, 'checked')).toBe(false)
    expect(textOf(markup)).toContain('Smooth names')
    expect(textOf(markup)).toContain('Adds vowels between consonant clusters. Off by default.')
    expect(find(markup, 'data-names-smoothing-note')).toBeNull()
    const on = render(valueFor(namingOf(OTHER_BASE, { smoothing: 1 })))
    expect(flagOf(need(on, 'data-names-smoothing').open, 'checked')).toBe(true)
  })

  it('summary and saved line: the counts, no share note, the first-edit autosave line', () => {
    expect(textOf(need(markup, 'data-names-summary').inner)).toBe('0 locked zones, 0 renamed demons.')
    expect(find(markup, 'data-names-share-note')).toBeNull()
    expect(textOf(markup)).not.toContain(NAMES_COPY.shareNote)
    const saved = need(markup, 'data-names-saved')
    expect(attrOf(saved.open, 'data-names-saved')).toBe('none')
    expect(textOf(saved.inner)).toBe('Edits save in this browser, one slot per base.')
  })

  it('the summary counts user locks and user overrides', () => {
    const base = namingOf(OTHER_BASE)
    const locked = createNaming({ base: OTHER_BASE, interactiveMaxN: INTERACTIVE_MAX_N })
    const withState: Naming = { ...locked, locks: new Set([1, 3]), overrides: new Map([[5, 'Zed']]) }
    expect(base.locks.size).toBe(0)
    const text = textOf(need(render(valueFor(withState)), 'data-names-summary').inner)
    expect(text).toBe(summaryLine(2, 1))
    expect(text).toBe('2 locked zones, 1 renamed demon.')
  })

  it('the saved line reads the saved, none and failed states (preview and seed-only have their own tests)', () => {
    const naming = namingOf(OTHER_BASE)
    const lineFor = (saved: NamingContextValue['saved']): { key: string | null; text: string; red: boolean } => {
      const el = need(render(valueFor(naming, { saved })), 'data-names-saved')
      return { key: attrOf(el.open, 'data-names-saved'), text: textOf(el.inner), red: classOf(el.open).includes('#f87171') }
    }
    expect(lineFor('saved')).toEqual({ key: 'saved', text: savedLine(OTHER_BASE), red: false })
    expect(lineFor('none').text).toBe(NAMES_COPY.savedNone)
    expect(lineFor('failed')).toEqual({ key: 'failed', text: NAMES_COPY.savedFailed, red: true })
  })
})

describe('NamesPanel: the autosave line follows the state first', () => {
  it('preview and seed-only decide the line whatever the context says', () => {
    const naming = namingOf(OTHER_BASE)
    const preview = need(render(valueFor(naming, { state: 'preview', saved: 'none' })), 'data-names-saved')
    expect(attrOf(preview.open, 'data-names-saved')).toBe('preview')
    const seedOnly = need(render(valueFor(namingOf(SEED_ONLY_BASE), { saved: 'saved' })), 'data-names-saved')
    expect(attrOf(seedOnly.open, 'data-names-saved')).toBe('seed-only')
    expect(textOf(seedOnly.inner)).toBe(NAMES_COPY.savedSeedOnly)
  })
})

// ── the preview table ──────────────────────────────────────────────────────

describe('NamesPanel: preview table', () => {
  it('a real table with scoped headers, three rows of the lowest meshes and the raw column in use', () => {
    const naming = namingOf(OTHER_BASE)
    const value = valueFor(naming)
    const markup = render(value)
    const table = need(markup, 'data-names-preview')
    expect(table.tag).toBe('table')
    expect(attrOf(table.open, 'aria-label')).toBe('Name preview')
    expect(attrOf(table.open, 'style') ?? '').toContain('table-layout:fixed')
    const heads = findAll(table.inner, 'scope="col"')
    expect(heads.map(h => textOf(h.inner))).toEqual(['A::B', 'Raw', 'Smoothed'])
    expect(findAll(table.inner, 'data-col').map(h => attrOf(h.open, 'data-col'))).toEqual(['raw', 'smoothed'])
    const raw = need(table.inner, 'data-col="raw"')
    const smoothed = need(table.inner, 'data-col="smoothed"')
    expect(attrOf(raw.open, 'aria-current')).toBe('true')
    expect(attrOf(smoothed.open, 'aria-current')).toBeNull()
    const rows = findAll(table.inner, 'data-names-preview-row')
    expect(rows).toHaveLength(NAMES_PREVIEW_ROWS)
    rows.forEach((row, i) => {
      const [a, b] = netSpanOf(i)
      const cells = findAll(row.inner, 'data-names-preview-cell')
      expect(cells).toHaveLength(3)
      expect(textOf(cells[0].inner)).toBe(`${a}::${b}`)
      expect(textOf(cells[1].inner)).toBe(value.resolver.ruleNameOf(a, b, 0))
      expect(textOf(cells[2].inner)).toBe(value.resolver.ruleNameOf(a, b, 1))
      // the full text is the title, and the cell truncates
      expect(attrOf(cells[1].open, 'title')).toBe(textOf(cells[1].inner))
      expect(attrOf(cells[2].open, 'title')).toBe(textOf(cells[2].inner))
      expect(classOf(cells[1].open)).toContain('truncate')
    })
  })

  it('smoothing on moves aria-current to the smoothed column', () => {
    const markup = render(valueFor(namingOf(OTHER_BASE, { smoothing: 1 })))
    expect(attrOf(need(markup, 'data-col="smoothed"').open, 'aria-current')).toBe('true')
    expect(attrOf(need(markup, 'data-col="raw"').open, 'aria-current')).toBeNull()
  })

  it('the pinned demon comes first, then the lowest meshes, without repeating it', () => {
    const naming = namingOf(OTHER_BASE)
    const value = valueFor(naming)
    const pinned = meshOf(7, 6)
    const rows = findAll(render(value, { pinnedMesh: pinned }), 'data-names-preview-row')
    expect(rows.map(r => attrOf(r.open, 'data-names-preview-row'))).toEqual([String(pinned), '0', '1'])
    const cells = findAll(rows[0].inner, 'data-names-preview-cell')
    const [a, b] = netSpanOf(pinned)
    expect(textOf(cells[0].inner)).toBe(`${a}::${b}`)
    expect(textOf(cells[1].inner)).toBe(value.resolver.ruleNameOf(a, b, 0))
    // a pinned demon among the lowest meshes is not shown twice
    const low = findAll(render(value, { pinnedMesh: 1 }), 'data-names-preview-row')
    expect(low.map(r => attrOf(r.open, 'data-names-preview-row'))).toEqual(['1', '0', '2'])
  })

  it('a pinned mesh that is not a demon of this base is ignored', () => {
    const value = valueFor(namingOf(OTHER_BASE))
    const total = (OTHER_BASE * (OTHER_BASE - 1)) / 2
    for (const mesh of [total, total + 5, -1, 1.5, Number.NaN]) {
      const rows = findAll(render(value, { pinnedMesh: mesh }), 'data-names-preview-row')
      expect(rows.map(r => attrOf(r.open, 'data-names-preview-row'))).toEqual(['0', '1', '2'])
    }
  })

  it('under the CCRU source a caption says the names are set by hand', () => {
    const markup = render(valueFor(ccruNaming()))
    const caption = need(markup, 'data-names-preview-caption')
    expect(textOf(caption.inner)).toBe(NAMES_COPY.previewCaption)
    expect(textOf(caption.inner)).toBe('CCRU names are set by hand. This preview shows what the join and smoothing rules give.')
    expect(at(markup, 'data-names-preview')).toBeLessThan(caption.index)
    expect(find(render(valueFor(namingOf(OTHER_BASE))), 'data-names-preview-caption')).toBeNull()
    const generatedAtCcruBase = render(valueFor(namingOf(CCRU_BASE)))
    expect(find(generatedAtCcruBase, 'data-names-preview-caption')).toBeNull()
  })
})

// ── the Source row at the CCRU base ────────────────────────────────────────

describe('NamesPanel: Source row (base 10 only)', () => {
  const markup = render(valueFor(ccruNaming()))

  it('shows the Source radiogroup before the seed, CCRU checked, and no base hint', () => {
    const group = findAll(markup, 'role="radiogroup"').find(el => attrOf(el.open, 'aria-label') === 'Naming source')
    expect(group).toBeDefined()
    expect(group?.index ?? 0).toBeLessThan(at(markup, 'data-names-seed'))
    const radios = radiosOf(markup, 'ccrug-names-source')
    expect(radios).toHaveLength(2)
    expect(radios.map(r => flagOf(r.open, 'checked'))).toEqual([true, false])
    expect(textOf(markup)).toContain(NAMES_COPY.sourceCcru)
    expect(textOf(markup)).toContain(NAMES_COPY.sourceGenerated)
    expect(textOf(markup)).not.toContain(NAMES_COPY.ccruHint)
    expect(textOf(markup)).toContain(NAMES_COPY.sourceEyebrow)
  })

  it('the generated source checks the other radio', () => {
    const generated = render(valueFor(namingOf(CCRU_BASE)))
    expect(radiosOf(generated, 'ccrug-names-source').map(r => flagOf(r.open, 'checked'))).toEqual([false, true])
  })

  it('no Source row without a preset for the base', () => {
    const value = valueFor(namingOf(CCRU_BASE), { preset: null })
    const bare = render(value)
    expect(bare).not.toContain('ccrug-names-source')
    expect(textOf(bare)).toContain(NAMES_COPY.ccruHint)
  })
})

// ── the inert-smoothing caption ────────────────────────────────────────────

describe('NamesPanel: smoothing that changes nothing', () => {
  it('a soft table says so, a harsh table does not', () => {
    const soft = namingOf(OTHER_BASE, { style: 'soft' })
    expect(smoothingInert(soft.sounds ?? [])).toBe(true)
    const markup = render(valueFor(soft))
    const note = need(markup, 'data-names-smoothing-note')
    expect(textOf(note.inner)).toBe('Smoothing makes no difference to these sounds.')
    expect(textOf(note.inner)).toBe(NAMES_COPY.smoothingInert)
    expect(note.index).toBeGreaterThan(at(markup, 'data-names-smoothing'))
    expect(note.index).toBeLessThan(at(markup, 'data-names-preview'))
    expect(find(render(valueFor(namingOf(OTHER_BASE, { style: 'harsh' }))), 'data-names-smoothing-note')).toBeNull()
  })

  it('a seed-only naming, which has no table, follows the style instead', () => {
    const seedOnlySoft = namingOf(SEED_ONLY_BASE, { style: 'soft' })
    expect(seedOnlySoft.sounds).toBeNull()
    expect(find(render(valueFor(seedOnlySoft)), 'data-names-smoothing-note')).not.toBeNull()
    const seedOnlyHarsh = namingOf(SEED_ONLY_BASE, { style: 'harsh' })
    expect(find(render(valueFor(seedOnlyHarsh)), 'data-names-smoothing-note')).toBeNull()
  })
})

// ── honest sharing: the share note and the header tag ──────────────────────

describe('NamesPanel: share note and header tag', () => {
  it('the share note follows the summary only when edits exist that a link cannot carry', () => {
    const markup = render(valueFor(namingOf(OTHER_BASE), { uncarried: true }))
    const note = need(markup, 'data-names-share-note')
    expect(textOf(note.inner)).toBe(NAMES_COPY.shareNote)
    expect(textOf(note.inner)).toBe('Links carry the preset or seed only. Choose Export names to share your edits.')
    expect(note.index).toBeGreaterThan(at(markup, 'data-names-summary'))
  })

  it('the header tag is edits-not-in-links, unsaved-preview, or nothing', () => {
    const naming = namingOf(OTHER_BASE)
    const edits = need(renderTag(valueFor(naming, { uncarried: true })), 'data-names-header-tag')
    expect(attrOf(edits.open, 'data-names-header-tag')).toBe('edits')
    expect(textOf(edits.inner)).toBe('edits not in links')
    const preview = need(renderTag(valueFor(naming, { state: 'preview', uncarried: true })), 'data-names-header-tag')
    expect(attrOf(preview.open, 'data-names-header-tag')).toBe('preview')
    expect(textOf(preview.inner)).toBe('unsaved preview')
    expect(textOf(preview.inner)).toBe(NAMES_COPY.tagPreview)
    expect(renderTag(valueFor(naming))).toBe('')
    expect(classOf(edits.open)).toContain('text-[8px]')
    expect(classOf(edits.open)).toContain('uppercase')
    expect(classOf(edits.open)).toContain('text-gray-400')
  })
})

// ── seed-only ──────────────────────────────────────────────────────────────

describe('NamesPanel: seed-only state', () => {
  const naming = namingOf(SEED_ONLY_BASE)
  const markup = render(valueFor(naming))

  it('is derived from the base and carries the seed, style, join, smoothing and preview blocks with the sentence', () => {
    const root = need(markup, 'data-names-panel')
    expect(attrOf(root.open, 'data-names-state')).toBe('seed-only')
    expect(attrOf(root.open, 'data-names-base')).toBe(String(SEED_ONLY_BASE))
    for (const attr of [
      'data-names-seed',
      'data-names-reroll',
      'data-names-style-description',
      'data-names-join-description',
      'data-names-smoothing',
      'data-names-preview',
    ]) {
      expect(find(markup, attr), attr).not.toBeNull()
    }
    const sentence = need(markup, 'data-names-seed-only')
    expect(textOf(sentence.inner)).toBe(seedOnlySentence())
    expect(textOf(sentence.inner)).toBe(
      `Above ${INTERACTIVE_MAX_N} zones, names come from the seed, style and join order. Zone sounds can't be edited at this size.`,
    )
    expect(sentence.index).toBeGreaterThan(at(markup, 'data-names-reroll'))
    expect(sentence.index).toBeLessThan(at(markup, 'data-names-preview'))
  })

  it('has no source row, no summary, no share note and no zone list slot', () => {
    expect(markup).not.toContain('ccrug-names-source')
    expect(find(markup, 'data-names-summary')).toBeNull()
    expect(find(markup, 'data-names-share-note')).toBeNull()
    expect(find(markup, 'data-names-list')).toBeNull()
    const uncarried = render(valueFor(naming, { uncarried: true }))
    expect(find(uncarried, 'data-names-share-note')).toBeNull()
  })

  it('the autosave line says nothing is saved at this size', () => {
    const saved = need(markup, 'data-names-saved')
    expect(attrOf(saved.open, 'data-names-saved')).toBe('seed-only')
    expect(textOf(saved.inner)).toBe(NAMES_COPY.savedSeedOnly)
  })

  it('every control that exists is enabled', () => {
    expect(flagOf(need(markup, 'data-names-reroll').open, 'disabled')).toBe(false)
    expect(flagOf(need(markup, 'data-names-seed').open, 'readonly')).toBe(false)
    for (const name of ['ccrug-names-style', 'ccrug-names-join']) {
      for (const radio of radiosOf(markup, name)) expect(flagOf(radio.open, 'disabled')).toBe(false)
    }
  })

  it('keeps the one-line base hint, since there is no Source row at this size', () => {
    expect(textOf(markup)).toContain(NAMES_COPY.ccruHint)
  })

  it('the seed-only sentence is not shown in the ready state', () => {
    expect(find(render(valueFor(namingOf(OTHER_BASE))), 'data-names-seed-only')).toBeNull()
  })
})

// ── unsaved preview ────────────────────────────────────────────────────────

describe('NamesPanel: preview state', () => {
  const naming = namingOf(OTHER_BASE, { seed: 'linked' })
  const markup = render(valueFor(naming, { state: 'preview', saved: 'preview', uncarried: true }))

  it('shows the notice first, with its label, body and the two buttons', () => {
    const notice = need(markup, 'data-names-preview-notice')
    expect(notice.index).toBeLessThan(at(markup, 'data-names-seed'))
    expect(notice.index).toBeLessThan(at(markup, 'data-names-style-description'))
    const text = textOf(notice.inner)
    expect(text).toContain('Unsaved preview')
    expect(text).toContain(noticeBody(OTHER_BASE))
    expect(text).toContain("This link's names are shown for base 28. Your saved names are kept until you choose.")
    const keep = need(notice.inner, 'data-names-keep')
    const revert = need(notice.inner, 'data-names-revert')
    expect(keep.tag).toBe('button')
    expect(textOf(keep.inner)).toBe('Keep this naming')
    expect(textOf(revert.inner)).toBe('Back to my saved naming')
    expect(flagOf(keep.open, 'disabled')).toBe(false)
    expect(flagOf(revert.open, 'disabled')).toBe(false)
    expect(keep.index).toBeLessThan(revert.index)
    expect(attrOf(notice.open, 'style') ?? '').toContain('rgba(16,255,80,0.35)')
  })

  it('disables every editing control, with aria-disabled on the fields and groups', () => {
    const seed = need(markup, 'data-names-seed')
    expect(flagOf(seed.open, 'readonly')).toBe(true)
    expect(attrOf(seed.open, 'aria-disabled')).toBe('true')
    expect(attrOf(seed.open, 'value')).toBe('linked')
    expect(flagOf(need(markup, 'data-names-reroll').open, 'disabled')).toBe(true)
    for (const name of ['ccrug-names-style', 'ccrug-names-join']) {
      for (const radio of radiosOf(markup, name)) expect(flagOf(radio.open, 'disabled')).toBe(true)
    }
    expect(flagOf(need(markup, 'data-names-smoothing').open, 'disabled')).toBe(true)
    for (const group of findAll(markup, 'role="radiogroup"')) expect(attrOf(group.open, 'aria-disabled')).toBe('true')
  })

  it('shows the summary and the share note, and the autosave line says it is not saved', () => {
    expect(find(markup, 'data-names-summary')).not.toBeNull()
    expect(find(markup, 'data-names-share-note')).not.toBeNull()
    const saved = need(markup, 'data-names-saved')
    expect(attrOf(saved.open, 'data-names-saved')).toBe('preview')
    expect(textOf(saved.inner)).toBe(NAMES_COPY.savedPreview)
  })

  it('also disables the Source radios at the CCRU base', () => {
    const ccru = render(valueFor(ccruNaming(), { state: 'preview', saved: 'preview' }))
    const radios = radiosOf(ccru, 'ccrug-names-source')
    expect(radios).toHaveLength(2)
    for (const radio of radios) expect(flagOf(radio.open, 'disabled')).toBe(true)
  })

  it('the notice is absent in every other state', () => {
    for (const state of ['ready', 'pending'] as const) {
      expect(find(render(valueFor(namingOf(OTHER_BASE), { state })), 'data-names-preview-notice')).toBeNull()
    }
  })
})

// ── pending ────────────────────────────────────────────────────────────────

describe('NamesPanel: pending state', () => {
  const pendingBase = 30
  const markup = render(valueFor(namingOf(OTHER_BASE), { state: 'pending', pendingBase }))

  it('says which base is being built where the list would be', () => {
    expect(attrOf(need(markup, 'data-names-panel').open, 'data-names-state')).toBe('pending')
    const line = need(markup, 'data-names-pending')
    expect(textOf(line.inner)).toBe(pendingLine(pendingBase))
    expect(textOf(line.inner)).toBe('Generating names for base 30...')
    expect(line.index).toBeGreaterThan(at(markup, 'data-names-saved'))
    expect(find(render(valueFor(namingOf(OTHER_BASE))), 'data-names-pending')).toBeNull()
  })

  it('renders the controls but marks them aria-disabled', () => {
    const seed = need(markup, 'data-names-seed')
    expect(attrOf(seed.open, 'aria-disabled')).toBe('true')
    expect(flagOf(seed.open, 'readonly')).toBe(true)
    expect(flagOf(need(markup, 'data-names-reroll').open, 'disabled')).toBe(true)
    for (const group of findAll(markup, 'role="radiogroup"')) expect(attrOf(group.open, 'aria-disabled')).toBe('true')
    expect(flagOf(need(markup, 'data-names-smoothing').open, 'disabled')).toBe(true)
    expect(find(markup, 'data-names-preview-notice')).toBeNull()
  })

  it('the groups and the seed carry no aria-disabled in the ready state', () => {
    const ready = render(valueFor(namingOf(OTHER_BASE)))
    for (const group of findAll(ready, 'role="radiogroup"')) expect(attrOf(group.open, 'aria-disabled')).toBeNull()
  })

  it('falls back to the displayed base when the pending base is not known', () => {
    const text = textOf(need(render(valueFor(namingOf(OTHER_BASE), { state: 'pending', pendingBase: null })), 'data-names-pending').inner)
    expect(text).toBe(pendingLine(OTHER_BASE))
  })
})

// ── touch targets and wrapping rows ────────────────────────────────────────

describe('NamesPanel: rows and targets', () => {
  it('every radio and checkbox wrapper has a 24px minimum and every radio row wraps', () => {
    const markup = render(valueFor(ccruNaming()))
    const labels = markup.match(/<label\b[^>]*>/g) ?? []
    // source 2, style 3, join 2, smoothing 1
    expect(labels).toHaveLength(8)
    for (const label of labels) expect(classOf(label).split(' ')).toContain('min-h-[24px]')
    const groups = findAll(markup, 'role="radiogroup"')
    expect(groups).toHaveLength(3)
    for (const group of groups) expect(classOf(group.open)).toContain('flex flex-wrap gap-x-3 gap-y-1')
  })

  it('every small button carries a 24px minimum height', () => {
    const markup = render(valueFor(namingOf(OTHER_BASE)))
    const buttons = markup.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(classOf(button)).toContain('min-h-[24px]')
  })
})

// ── the pure helpers behind the handlers ───────────────────────────────────

describe('rerollSeed', () => {
  it('turns two words into lowercase base-36 text of the data length', () => {
    const seed = rerollSeed(() => Uint32Array.from([0xffffffff, 0x12345678]))
    expect(seed).toHaveLength(REROLL_SEED_LENGTH)
    expect(seed).toMatch(/^[0-9a-z]+$/)
    expect(seed).toBe((0xffffffff).toString(36).padStart(7, '0').concat((0x12345678).toString(36).padStart(7, '0')).slice(0, REROLL_SEED_LENGTH))
  })

  it('pads small words so the length never depends on the random values', () => {
    const seed = rerollSeed(() => Uint32Array.from([0, 1]))
    expect(seed).toHaveLength(REROLL_SEED_LENGTH)
    expect(seed).toBe('0000000'.concat('0000001').slice(0, REROLL_SEED_LENGTH))
  })

  it('asks the source for two 32-bit words', () => {
    const lengths: number[] = []
    rerollSeed(words => {
      lengths.push(words.length)
      return words
    })
    expect(lengths).toEqual([2])
  })

  it('the platform source gives seeds the engine accepts, and different ones', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const seed = rerollSeed()
      expect(normalizeSeed(seed)).toBe(seed)
      seen.add(seed)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('seedCommitOf', () => {
  it('commits a changed valid seed, trimmed and NFC-normalised', () => {
    expect(seedCommitOf('  new seed  ', 'old')).toEqual({ kind: 'commit', seed: 'new seed' })
    expect(seedCommitOf('Cafe\u0301', 'old')).toEqual({ kind: 'commit', seed: 'Caf\u00e9' })
  })

  it('does nothing for the seed the naming already has, even spelled with padding', () => {
    expect(seedCommitOf('same', 'same')).toEqual({ kind: 'unchanged' })
    expect(seedCommitOf('  same ', 'same')).toEqual({ kind: 'unchanged' })
  })

  it('refuses an empty, over-long or control-character seed', () => {
    expect(seedCommitOf('', 'old')).toEqual({ kind: 'invalid' })
    expect(seedCommitOf('   ', 'old')).toEqual({ kind: 'invalid' })
    expect(seedCommitOf('x'.repeat(SEED_MAX_LENGTH + 1), 'old')).toEqual({ kind: 'invalid' })
    expect(seedCommitOf('a\u0000b', 'old')).toEqual({ kind: 'invalid' })
    expect(seedCommitOf('x'.repeat(SEED_MAX_LENGTH), 'old').kind).toBe('commit')
  })
})

// Review WR-07: Enter and Escape in the seed field mean commit and revert, but not while an input method is composing (a Chinese,
// Japanese or Korean visitor confirms a candidate with Enter and cancels one with Escape).
describe('seedKeyIntent', () => {
  it('Enter commits and Escape reverts', () => {
    expect(seedKeyIntent('Enter', { isComposing: false, keyCode: 13 })).toBe('commit')
    expect(seedKeyIntent('Escape', { isComposing: false, keyCode: 27 })).toBe('revert')
  })

  it('means nothing while an input method is composing, by isComposing or by the legacy keyCode 229', () => {
    expect(seedKeyIntent('Enter', { isComposing: true, keyCode: 13 })).toBeNull()
    expect(seedKeyIntent('Escape', { isComposing: true, keyCode: 27 })).toBeNull()
    expect(seedKeyIntent('Enter', { isComposing: false, keyCode: 229 })).toBeNull() // Safari ends composition before keydown
    expect(seedKeyIntent('Escape', { isComposing: false, keyCode: 229 })).toBeNull()
  })

  it('means nothing for any other key', () => {
    for (const key of ['a', 'Tab', 'ArrowLeft', ' ', 'Backspace']) expect(seedKeyIntent(key, { isComposing: false, keyCode: 65 })).toBeNull()
  })

  it('reads an event with neither field as a plain key', () => {
    expect(seedKeyIntent('Enter', {})).toBe('commit')
  })
})

describe('previewMeshes', () => {
  it('lists the lowest meshes when nothing is pinned', () => {
    expect(previewMeshes(OTHER_BASE, null, 3)).toEqual([0, 1, 2])
  })

  it('puts a valid pinned mesh first and never repeats it', () => {
    expect(previewMeshes(OTHER_BASE, 100, 3)).toEqual([100, 0, 1])
    expect(previewMeshes(OTHER_BASE, 0, 3)).toEqual([0, 1, 2])
    expect(previewMeshes(OTHER_BASE, 2, 3)).toEqual([2, 0, 1])
  })

  it('never lists more demons than the base has', () => {
    // base 2 has one demon, base 4 has six
    expect(previewMeshes(2, null, 3)).toEqual([0])
    expect(previewMeshes(2, 0, 3)).toEqual([0])
    expect(previewMeshes(4, null, 3)).toEqual([0, 1, 2])
    expect(previewMeshes(4, 5, 8)).toEqual([5, 0, 1, 2, 3, 4])
  })

  it('ignores a pinned value that is not a demon of the base', () => {
    const total = (OTHER_BASE * (OTHER_BASE - 1)) / 2
    for (const bad of [total, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(previewMeshes(OTHER_BASE, bad, 3)).toEqual([0, 1, 2])
    }
  })

  it('stays cheap at the largest base: it never walks the whole mesh range', () => {
    expect(previewMeshes(SEED_ONLY_BASE, null, 3)).toEqual([0, 1, 2])
  })
})

// ── source assertions: what behaviour cannot pin ───────────────────────────

describe('NamesPanel source', () => {
  const source = readFileSync(PANEL_SOURCE, 'utf8')

  it('keeps the carrier, the header tag and the single random source', () => {
    expect(source.match(/data-names-live/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(source.match(/export function NamesHeaderTag/g)).toHaveLength(1)
    expect(source.match(/crypto\.getRandomValues/g)).toHaveLength(1)
  })

  it('starts the body afresh for each displayed base', () => {
    expect(source).toContain('key={naming.base}')
  })

  it('types no ceiling and no raw-html path', () => {
    expect(/\b4000\b|\b4002\b/.test(source)).toBe(false)
    expect(source).not.toContain('dangerouslySetInnerHTML')
    expect(/\beval\s*\(|new Function\s*\(/.test(source)).toBe(false)
    expect(source).not.toContain('innerHTML')
  })
})

// ══ Task 2: export, import, Use its seed here, the status slot and the inline Undo ═══════════════════════════════════════════════════

const copyCtx: ImportCopyContext = {
  base: OTHER_BASE,
  zoneLabel: zone => String(zone),
  netSpan: mesh => {
    const [a, b] = netSpanOf(mesh)
    return `${a}::${b}`
  },
}

/** The result of validating `text` for the test base, through the one validator the panel uses. */
function validated(text: string, base = OTHER_BASE, maxBytes?: number): NamingImport {
  return validateNamingJson(text, { base, interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET, maxBytes })
}

/** The export text of a naming, parsed, so a test can break one field and write it back. */
function docOf(naming: Naming): Record<string, unknown> {
  return JSON.parse(serializeNaming(naming)) as Record<string, unknown>
}

describe('exportFileName', () => {
  it('names the file after the base', () => {
    expect(exportFileName(OTHER_BASE)).toBe('ccrug-names-base28.json')
    expect(exportFileName(CCRU_BASE)).toBe('ccrug-names-base10.json')
    expect(exportFileName(SEED_ONLY_BASE)).toBe(`ccrug-names-base${SEED_ONLY_BASE}.json`)
  })
})

describe('importOutcome: success', () => {
  it('a file of this base is a success with the sound and override counts', () => {
    const outcome = importOutcome(validated(serializeNaming(namingOf(OTHER_BASE))), copyCtx)
    expect(outcome).toEqual({ kind: 'success', text: importSuccess(OTHER_BASE, OTHER_BASE, 0), offerSeed: null })
    expect(outcome.text).toBe('Imported names for base 28: 28 sounds, 0 renamed demons.')
    const withOverride = importOutcome(
      validated(serializeNaming({ ...namingOf(OTHER_BASE), overrides: new Map([[5, 'Zed']]) })),
      copyCtx,
    )
    expect(withOverride.text).toBe('Imported names for base 28: 28 sounds, 1 renamed demon.')
    expect(withOverride.kind).toBe('success')
  })

  it('keys this version does not know are listed after the success line and never block', () => {
    const doc = { ...docOf(namingOf(OTHER_BASE)), extraOne: 1, extraTwo: 2 }
    const result = validated(JSON.stringify(doc))
    if (!result.ok) throw new Error('expected the file with unknown keys to be accepted')
    const outcome = importOutcome(result, copyCtx)
    expect(outcome.kind).toBe('success')
    expect(outcome.text).toBe(importSuccess(OTHER_BASE, OTHER_BASE, 0) + unknownKeysSuffix(result.unknownKeys, result.unknownKeyCount))
    expect(outcome.text).toContain(' Ignored unknown keys: extraOne, extraTwo.')
  })

  it('more unknown keys than the cap say how many more', () => {
    const extras: Record<string, number> = {}
    for (let i = 0; i < UNKNOWN_KEYS_MAX + 3; i++) extras[`extra${i}`] = i
    const outcome = importOutcome(validated(JSON.stringify({ ...docOf(namingOf(OTHER_BASE)), ...extras })), copyCtx)
    expect(outcome.text).toContain(' and 3 more.')
  })

  it('a seed-only file at a seed-only base reads as the seed-only success', () => {
    const ctx: ImportCopyContext = { ...copyCtx, base: SEED_ONLY_BASE }
    const outcome = importOutcome(validated(serializeNaming(namingOf(SEED_ONLY_BASE)), SEED_ONLY_BASE), ctx)
    expect(outcome).toEqual({ kind: 'success', text: importSeedOnly(SEED_ONLY_BASE), offerSeed: null })
  })
})

describe('importOutcome: refusals', () => {
  const expectError = (text: string, sentence: string, offerSeed: unknown = null, ctx: ImportCopyContext = copyCtx): void => {
    const outcome = importOutcome(validated(text, ctx.base), ctx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toBe(sentence)
    expect(outcome.offerSeed).toEqual(offerSeed)
  }

  it('text that is not JSON', () => {
    expectError(
      'not json {',
      "This file isn't valid JSON. Nothing was imported. Choose a file exported from the Names panel.",
    )
  })

  it('a text over the cap prints the cap through the one formatter', () => {
    const outcome = importOutcome(validated(serializeNaming(namingOf(OTHER_BASE)), OTHER_BASE, 10), copyCtx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toBe(importError({ kind: 'too-large', maxBytes: 10 }))
    expect(outcome.text).toContain(formatBytes(10))
    expect(outcome.offerSeed).toBeNull()
  })

  it('a format version this app cannot read', () => {
    const outcome = importOutcome(validated('{"schema":"ccrug.naming/99"}'), copyCtx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toBe(
      "This file uses names format 99, which this version can't read. Nothing was imported. Export the names again from this version.",
    )
  })

  it('a JSON file that is not a names file', () => {
    expectError(
      '{"hello":1}',
      "This file isn't a names file for this app. Nothing was imported. Choose a file exported from the Names panel.",
    )
    expectError('[1,2]', importError({ kind: 'not-names-file' }))
  })

  it('a file of another base is refused, and its seed is offered when it carries one', () => {
    const text = serializeNaming(namingOf(30, { seed: 'offered', style: 'soft', join: 'lo-hi', smoothing: 1 }))
    expectError(
      text,
      'This file is for base 30, and you are on base 28. Nothing was imported. Switch to base 30 to import it.',
      { seed: 'offered', style: 'soft', join: 'lo-hi', smoothing: 1 },
    )
  })

  it('a file of another base with no usable generator record offers nothing', () => {
    expectError(
      `{"schema":"${SCHEMA_ID}","base":30}`,
      'This file is for base 30, and you are on base 28. Nothing was imported. Switch to base 30 to import it.',
      null,
    )
  })

  it('a zone list at a seed-only base is refused with the seed-only message', () => {
    const doc = { ...docOf(namingOf(SEED_ONLY_BASE)), zones: ['a', 'b'] }
    const ctx: ImportCopyContext = { ...copyCtx, base: SEED_ONLY_BASE }
    const outcome = importOutcome(validated(JSON.stringify(doc), SEED_ONLY_BASE), ctx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toBe(importError({ kind: 'seed-only-base' }, ctx))
    expect(outcome.text).toContain(`Base ${SEED_ONLY_BASE} is above ${INTERACTIVE_MAX_N} zones`)
    expect(outcome.offerSeed).toBeNull()
  })

  it('bad sounds are listed by zone, with the reasons, and the zones closing sentence', () => {
    const doc = docOf(namingOf(OTHER_BASE))
    const zones = [...(doc.zones as string[])]
    zones[3] = 'a b'
    zones[5] = 'x1'
    const result = validated(JSON.stringify({ ...doc, zones }))
    const outcome = importOutcome(result, copyCtx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toBe(
      "Nothing was imported. Zone 3: Sounds can't contain spaces. Zone 5: Sounds can't contain digits. Fix these zones in the file and import it again.",
    )
    expect(outcome.offerSeed).toBeNull()
    if (!result.ok) expect(outcome.text).toBe(invalidEntries(result.issues, result.issueCount, copyCtx))
  })

  it('more issues than the cap say how many more, from the exact total', () => {
    const doc = docOf(namingOf(OTHER_BASE))
    const zones = [...(doc.zones as string[])]
    for (let zone = 0; zone < ISSUES_MAX + 2; zone++) zones[zone] = 'x1'
    const outcome = importOutcome(validated(JSON.stringify({ ...doc, zones })), copyCtx)
    expect(outcome.text).toContain('And 2 more.')
    expect(outcome.text.endsWith('Fix these zones in the file and import it again.')).toBe(true)
  })

  it('a bad override name or key reads as a refused entry, with no zone wording', () => {
    const doc = docOf(namingOf(OTHER_BASE))
    const name = importOutcome(validated(JSON.stringify({ ...doc, overrides: { '5': 'a1' } })), copyCtx)
    const [a, b] = netSpanOf(5)
    expect(name.kind).toBe('error')
    expect(name.text).toBe(
      `Nothing was imported. ${a}::${b}: Names can't contain digits. Fix these entries in the file and import it again.`,
    )
    // JSON.parse makes __proto__ an own key; the validator must refuse it as a key, never assign it
    const key = importOutcome(validated(JSON.stringify({ ...doc, overrides: { ['__proto__']: 'Zed' } })), copyCtx)
    expect(key.kind).toBe('error')
    expect(key.text).toContain('Override key "__proto__" is not a demon of base 28.')
    expect(key.offerSeed).toBeNull()
  })

  it('a missing field reads as a field problem', () => {
    const doc = docOf(namingOf(OTHER_BASE))
    const outcome = importOutcome(validated(JSON.stringify({ ...doc, generator: { ...(doc.generator as object), seed: 5 } })), copyCtx)
    expect(outcome.kind).toBe('error')
    expect(outcome.text).toContain('Field generator.seed is not valid.')
    expect(outcome.text.endsWith('Fix these entries in the file and import it again.')).toBe(true)
  })

  it('only a wrong-base refusal carries a seed offer', () => {
    const doc = docOf(namingOf(OTHER_BASE))
    const refusals = [
      validated('nope'),
      validated('{"x":1}'),
      validated(JSON.stringify({ ...doc, zones: ['a b'] })),
      validated(JSON.stringify({ ...doc, generator: 5 })),
    ]
    for (const result of refusals) expect(importOutcome(result, copyCtx).offerSeed).toBeNull()
  })
})

describe('readImportFile', () => {
  const env = { base: OTHER_BASE, interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET, copy: copyCtx }

  it('refuses a file over the cap by its size, without reading it', async () => {
    let reads = 0
    const file = {
      size: NAMING_IMPORT_MAX_BYTES + 1,
      text: (): Promise<string> => {
        reads++
        return Promise.resolve('')
      },
    }
    const result = await readImportFile(file, env)
    expect(reads).toBe(0)
    expect(result.naming).toBeNull()
    expect(result.outcome).toEqual({
      kind: 'error',
      text: importError({ kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES }),
      offerSeed: null,
    })
  })

  it('a file exactly at the cap is read', async () => {
    let reads = 0
    const file = {
      size: NAMING_IMPORT_MAX_BYTES,
      text: (): Promise<string> => {
        reads++
        return Promise.resolve('{}')
      },
    }
    const result = await readImportFile(file, env)
    expect(reads).toBe(1)
    expect(result.outcome.text).toBe(importError({ kind: 'not-names-file' }))
  })

  it('a file the browser cannot read is the unreadable refusal', async () => {
    const file = { size: 10, text: (): Promise<string> => Promise.reject(new Error('denied')) }
    const result = await readImportFile(file, env)
    expect(result.naming).toBeNull()
    expect(result.outcome).toEqual({ kind: 'error', text: importError({ kind: 'unreadable' }), offerSeed: null })
    expect(result.outcome.text).toBe("Couldn't read this file. Nothing was imported. Choose the file again.")
  })

  it('a real File of an exported naming comes back as that naming with the success line', async () => {
    const naming = { ...namingOf(OTHER_BASE, { seed: 'roundtrip' }), locks: new Set([2]), overrides: new Map([[7, 'Zed']]) }
    const text = serializeNaming(naming, { pretty: true })
    const file = new File([text], 'ccrug-names-base28.json', { type: 'application/json' })
    const result = await readImportFile(file, env)
    expect(result.outcome).toEqual({ kind: 'success', text: importSuccess(OTHER_BASE, OTHER_BASE, 1), offerSeed: null })
    expect(result.naming).not.toBeNull()
    expect(result.naming?.seed).toBe('roundtrip')
    expect(result.naming?.sounds).toEqual(naming.sounds)
    expect([...(result.naming?.locks ?? [])]).toEqual([2])
    expect([...(result.naming?.overrides ?? [])]).toEqual([[7, 'Zed']])
  })

  it('a file that fails validation applies nothing and keeps a wrong-base seed offer', async () => {
    const other = new File([serializeNaming(namingOf(30, { seed: 'kept' }))], 'x.json')
    const result = await readImportFile(other, env)
    expect(result.naming).toBeNull()
    expect(result.outcome.kind).toBe('error')
    expect(result.outcome.offerSeed).toEqual({ seed: 'kept', style: 'harsh', join: 'hi-lo', smoothing: 0 })
  })

  it('a CCRU file is accepted only where the environment has the preset', async () => {
    const text = serializeNaming(ccruNaming())
    const at10 = { base: CCRU_BASE, interactiveMaxN: INTERACTIVE_MAX_N, preset: CCRU_NAMING_PRESET, copy: { ...copyCtx, base: CCRU_BASE } }
    const accepted = await readImportFile(new File([text], 'x.json'), at10)
    expect(accepted.outcome.kind).toBe('success')
    expect(accepted.naming?.source).toBe('ccru')
    const withoutPreset = await readImportFile(new File([text], 'x.json'), { ...at10, preset: null })
    expect(withoutPreset.naming).toBeNull()
    expect(withoutPreset.outcome.kind).toBe('error')
  })

  it('reads text as data: a hostile key is refused, echoed as text, and escaped when shown', async () => {
    const hostile = new File(['{"schema":"' + SCHEMA_ID + '","base":28,"overrides":{"<img src=x onerror=alert(1)>":"x"}}'], 'x.json')
    const result = await readImportFile(hostile, env)
    expect(result.naming).toBeNull()
    expect(result.outcome.kind).toBe('error')
    expect(result.outcome.text).toContain('<img src=x onerror=alert(1)>')
    const markup = renderToStaticMarkup(
      createElement(NamesStatusSlot, { status: { ...result.outcome, undo: false }, onUndo: noop, onUseSeed: noop }),
    )
    expect(markup).not.toContain('<img')
    expect(markup).toContain('&lt;img')
  })
})

// A recording stand-in for the browser's download machinery.
function fakeDownload(): {
  readonly env: DownloadEnv
  readonly log: string[]
  readonly blobs: Blob[]
  readonly anchors: { href: string; download: string }[]
  runDeferred(): void
} {
  const log: string[] = []
  const blobs: Blob[] = []
  const anchors: { href: string; download: string }[] = []
  const deferred: (() => void)[] = []
  const env: DownloadEnv = {
    makeUrl: blob => {
      blobs.push(blob)
      log.push('makeUrl')
      return `blob:fake-${blobs.length}`
    },
    revokeUrl: url => {
      log.push(`revoke ${url}`)
    },
    makeAnchor: () => {
      const anchor = {
        href: '',
        download: '',
        click: () => log.push(`click ${anchor.href} as ${anchor.download}`),
        remove: () => log.push('remove'),
      }
      anchors.push(anchor)
      log.push('makeAnchor')
      return anchor
    },
    defer: fn => {
      deferred.push(fn)
    },
  }
  return { env, log, blobs, anchors, runDeferred: () => deferred.splice(0).forEach(fn => fn()) }
}

describe('downloadJson and exportNaming', () => {
  it('downloads one JSON blob through a temporary anchor and revokes the URL after the click', () => {
    const fake = fakeDownload()
    downloadJson('{"a":1}', 'x.json', fake.env)
    expect(fake.blobs).toHaveLength(1)
    expect(fake.blobs[0].type).toBe('application/json')
    expect(fake.anchors).toHaveLength(1)
    expect(fake.anchors[0]).toMatchObject({ href: 'blob:fake-1', download: 'x.json' })
    expect(fake.log).toEqual(['makeUrl', 'makeAnchor', 'click blob:fake-1 as x.json', 'remove'])
    // the URL is revoked once, after the click, and not before the deferred step runs
    fake.runDeferred()
    expect(fake.log).toEqual(['makeUrl', 'makeAnchor', 'click blob:fake-1 as x.json', 'remove', 'revoke blob:fake-1'])
  })

  it('exports the naming through the one serializer, pretty-printed, under the fixed file name', async () => {
    const naming = { ...namingOf(OTHER_BASE, { seed: 'exported' }), locks: new Set([1]) }
    const fake = fakeDownload()
    const text = exportNaming(naming, OTHER_BASE, fake.env)
    expect(text).toBe(exportSuccess(OTHER_BASE))
    expect(text).toBe('Exported names for base 28.')
    expect(fake.anchors[0].download).toBe('ccrug-names-base28.json')
    const written = await fake.blobs[0].text()
    expect(written).toBe(serializeNaming(naming, { pretty: true }))
    expect(written.endsWith('\n')).toBe(true)
    // and what it wrote reads back through the validator
    const back = validated(written)
    expect(back.ok).toBe(true)
  })

  it('above the ceiling the file carries the seed and style only, and the status says so', async () => {
    const naming = namingOf(SEED_ONLY_BASE, { seed: 'big', style: 'syllabic' })
    const fake = fakeDownload()
    const text = exportNaming(naming, SEED_ONLY_BASE, fake.env)
    expect(text).toBe(exportSeedOnly(SEED_ONLY_BASE))
    expect(fake.anchors[0].download).toBe(`ccrug-names-base${SEED_ONLY_BASE}.json`)
    const doc = JSON.parse(await fake.blobs[0].text()) as Record<string, unknown>
    expect(doc.zones).toBeUndefined()
    expect(doc.locks).toBeUndefined()
    expect(doc.overrides).toBeUndefined()
    expect((doc.generator as { seed: string; style: string }).seed).toBe('big')
    expect((doc.generator as { seed: string; style: string }).style).toBe('syllabic')
  })
})

describe('importAllowed', () => {
  it('is true where the naming can be edited and false while previewing or building', () => {
    expect(importAllowed('ready')).toBe(true)
    expect(importAllowed('seed-only')).toBe(true)
    expect(importAllowed('preview')).toBe(false)
    expect(importAllowed('pending')).toBe(false)
  })
})

describe('statusFate', () => {
  it('the render that first shows a status adopts its revision', () => {
    expect(statusFate(null, 7)).toBe('adopt')
  })

  it('the same revision keeps the status', () => {
    expect(statusFate(7, 7)).toBe('keep')
  })

  it('any later revision, from this panel or from elsewhere, clears it', () => {
    expect(statusFate(7, 8)).toBe('clear')
    expect(statusFate(7, 6)).toBe('clear')
  })
})

// ── the status slot ────────────────────────────────────────────────────────

describe('NamesStatusSlot', () => {
  const noopHandlers = { onUndo: noop, onUseSeed: noop }
  const slot = (status: NamesStatus | null): string =>
    renderToStaticMarkup(createElement(NamesStatusSlot, { status, ...noopHandlers }))
  const success: NamesStatus = { text: 'Generated names for base 28 from seed abc.', kind: 'success', undo: true, offerSeed: null }

  it('renders nothing without a status', () => {
    expect(slot(null)).toBe('')
  })

  it('a replace-all result is plain text with no role, and Undo on its own line', () => {
    const markup = slot(success)
    const line = need(markup, 'data-names-status')
    expect(line.tag).toBe('p')
    expect(attrOf(line.open, 'data-kind')).toBe('success')
    expect(attrOf(line.open, 'role')).toBeNull()
    expect(attrOf(line.open, 'aria-live')).toBeNull()
    expect(textOf(line.inner)).toBe(success.text)
    expect(classOf(line.open)).toContain('text-gray-300')
    const undo = need(markup, 'data-names-undo')
    expect(undo.tag).toBe('button')
    expect(textOf(undo.inner)).toBe('Undo this change')
    expect(textOf(undo.inner)).toBe(NAMES_COPY.undoChange)
    expect(classOf(undo.open)).toContain('min-h-[24px]')
    expect(undo.index).toBeGreaterThan(line.index)
    // its own line: a wrapper around the button holds nothing else
    expect(markup).toMatch(/<div><button[^>]*data-names-undo[^>]*>[^<]*<\/button><\/div>/)
    expect(find(markup, 'data-names-use-seed')).toBeNull()
  })

  it('a status that replaces nothing has no Undo', () => {
    const markup = slot({ text: 'Smoothing on.', kind: 'info', undo: false, offerSeed: null })
    expect(attrOf(need(markup, 'data-names-status').open, 'data-kind')).toBe('info')
    expect(find(markup, 'data-names-undo')).toBeNull()
  })

  it('an error is red and offers Use its seed here only with a seed', () => {
    const plain = slot({ text: 'This file isn\'t valid JSON.', kind: 'error', undo: false, offerSeed: null })
    expect(attrOf(need(plain, 'data-names-status').open, 'data-kind')).toBe('error')
    expect(classOf(need(plain, 'data-names-status').open)).toContain('#f87171')
    expect(find(plain, 'data-names-use-seed')).toBeNull()
    const offer = slot({
      text: 'This file is for base 30.',
      kind: 'error',
      undo: false,
      offerSeed: { seed: 'abc', style: 'harsh', join: 'hi-lo', smoothing: 0 },
    })
    const button = need(offer, 'data-names-use-seed')
    expect(button.tag).toBe('button')
    expect(textOf(button.inner)).toBe('Use its seed here')
    expect(textOf(button.inner)).toBe(NAMES_COPY.useSeed)
    expect(find(offer, 'data-names-undo')).toBeNull()
  })

  it('shows text as text: markup in a status is escaped', () => {
    const markup = slot({ text: '<img src=x onerror=alert(1)>', kind: 'error', undo: false, offerSeed: null })
    expect(markup).not.toContain('<img')
    expect(markup).toContain('&lt;img')
  })
})

// ── block 10 in the panel ──────────────────────────────────────────────────

describe('NamesPanel: import and export block', () => {
  const ready = render(valueFor(namingOf(OTHER_BASE)))

  it('sits between the summary and the autosave line, in a wrapping button row', () => {
    expect(at(ready, 'data-names-summary')).toBeLessThan(at(ready, 'data-names-export'))
    expect(at(ready, 'data-names-export')).toBeLessThan(at(ready, 'data-names-import'))
    expect(at(ready, 'data-names-import')).toBeLessThan(at(ready, 'data-names-saved'))
    expect(ready).toMatch(/<div class="flex flex-wrap gap-2"><button[^>]*data-names-export[^>]*>[^<]*<\/button><button[^>]*data-names-import[^>]*>/)
    const exportButton = need(ready, 'data-names-export')
    const importButton = need(ready, 'data-names-import')
    expect(exportButton.tag).toBe('button')
    expect(textOf(exportButton.inner)).toBe('Export names')
    expect(textOf(importButton.inner)).toBe('Import names')
    expect(classOf(exportButton.open)).toContain('min-h-[24px]')
    expect(classOf(importButton.open)).toContain('min-h-[24px]')
    expect(flagOf(exportButton.open, 'disabled')).toBe(false)
    expect(flagOf(importButton.open, 'disabled')).toBe(false)
  })

  it('has a hidden file input for json, and no status until something happens', () => {
    const input = need(ready, 'data-names-import-input')
    expect(input.tag).toBe('input')
    expect(attrOf(input.open, 'type')).toBe('file')
    expect(attrOf(input.open, 'accept')).toBe('.json,application/json')
    expect(flagOf(input.open, 'hidden')).toBe(true)
    expect(find(ready, 'data-names-status')).toBeNull()
    expect(find(ready, 'data-names-undo')).toBeNull()
    expect(find(ready, 'data-names-use-seed')).toBeNull()
  })

  it('Import is disabled in preview and pending, Export never is', () => {
    const naming = namingOf(OTHER_BASE)
    for (const state of ['preview', 'pending'] as const) {
      const markup = render(valueFor(naming, { state }))
      expect(flagOf(need(markup, 'data-names-import').open, 'disabled'), state).toBe(true)
      expect(flagOf(need(markup, 'data-names-export').open, 'disabled'), state).toBe(false)
    }
    const seedOnly = render(valueFor(namingOf(SEED_ONLY_BASE)))
    expect(flagOf(need(seedOnly, 'data-names-import').open, 'disabled')).toBe(false)
    expect(flagOf(need(seedOnly, 'data-names-export').open, 'disabled')).toBe(false)
    expect(at(seedOnly, 'data-names-import')).toBeLessThan(at(seedOnly, 'data-names-saved'))
  })
})

// ── Task 2 source assertions ───────────────────────────────────────────────

describe('NamesPanel source: the file path', () => {
  const source = readFileSync(PANEL_SOURCE, 'utf8')
  const count = (needle: string): number => source.split(needle).length - 1

  it('uses one serializer, one validator, a size check before reading and one revoke', () => {
    expect(count('serializeNaming(')).toBe(1)
    expect(count('validateNamingJson(')).toBe(1)
    expect(count('file.size > NAMING_IMPORT_MAX_BYTES')).toBe(1)
    expect(count('URL.revokeObjectURL')).toBe(1)
  })

  it('clears the file input after every attempt and has no drop path', () => {
    expect(count("input.value = ''")).toBeGreaterThanOrEqual(1)
    expect(/onDrop|FileReader|dataTransfer/.test(source)).toBe(false)
  })
})

// ══ Plan 19: the zone list (block 12), its row, its keyboard line ═══════════════════════════════════════════════════════════════════

const noopHandlers: ZoneRowHandlers = { onFocus: noop, onChange: noop, onKeyDown: noop, onBlur: noop, onPaste: noop, onLock: noop }

// Case-insensitive attribute readers: React writes some attribute names in camel case (maxLength, autoCapitalize) and some in lower case.
function attrI(open: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(open)
  return m === null ? null : m[1]
}

function flagI(open: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[=\\s/>])`, 'i').test(open)
}

/** The row elements of a zone list markup, with the zone number each carries. */
function rowsOf(markup: string): { zone: number; el: El }[] {
  return findAll(markup, 'data-names-row').map(el => ({ zone: Number(attrOf(el.open, 'data-names-row')), el }))
}

function rowOf(markup: string, zone: number): El {
  const hit = rowsOf(markup).find(r => r.zone === zone)
  if (hit === undefined) throw new Error(`no row for zone ${zone}`)
  return hit.el
}

const MARGIN = 300

/** The list alone, with the scroller a marker object so the options the list hands the virtualizer can be told apart. */
function renderList(value: NamingContextValue | null, over: Partial<{ scrollMargin: number; pinnedZone: number | null }> = {}): string {
  const list = createElement(ZoneList, { scrollEl: () => null, scrollMargin: MARGIN, pinnedZone: null, ...over })
  return renderToStaticMarkup(value === null ? list : createElement(NamingContext.Provider, { value }, list))
}

function topOf(row: El): number {
  const hit = /top:\s*(-?[\d.]+)/.exec(attrOf(row.open, 'style') ?? '')
  if (hit === null) throw new Error('row has no top')
  return Number(hit[1])
}

describe('NamesPanel: the zone list as block 12', () => {
  const naming = namingOf(OTHER_BASE)
  const markup = render(valueFor(naming))

  it('follows the autosave line: the go to field, both helper lines, the message slot, then the list', () => {
    const lock = markup.indexOf(NAMES_COPY.listHelperLock)
    const paste = markup.indexOf(NAMES_COPY.listHelperPaste)
    expect(lock).toBeGreaterThan(-1)
    expect(paste).toBeGreaterThan(-1)
    const order = [
      at(markup, 'data-names-saved'),
      at(markup, 'data-names-goto'),
      lock,
      paste,
      at(markup, 'data-names-list-message'),
      at(markup, 'data-names-list'),
    ]
    expect([...order].sort((x, y) => x - y)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })

  it('the helper lines are the copy module sentences, in the body style', () => {
    expect(NAMES_COPY.listHelperLock).toBe('Editing a sound locks it. Locked zones keep their sound when you reroll or change the seed.')
    expect(NAMES_COPY.listHelperPaste).toBe('Paste a list into a row to fill the rows below it.')
    const p = findAll(markup, 'class').filter(el => el.tag === 'p' && textOf(el.inner) === NAMES_COPY.listHelperLock)
    expect(p).toHaveLength(1)
    expect(classOf(p[0].open)).toContain('text-gray-400')
  })

  it('the go to field is a quiet 14px terminal field named Go to zone with the zone number placeholder', () => {
    const goto = need(markup, 'data-names-goto')
    expect(goto.tag).toBe('input')
    expect(attrOf(goto.open, 'aria-label')).toBe('Go to zone')
    expect(attrOf(goto.open, 'aria-label')).toBe(NAMES_COPY.gotoAria)
    expect(attrOf(goto.open, 'placeholder')).toBe('zone number')
    expect(attrOf(goto.open, 'placeholder')).toBe(NAMES_COPY.gotoPlaceholder)
    expect(attrI(goto.open, 'maxLength')).toBe('40')
    expect(flagI(goto.open, 'readonly')).toBe(false)
    expect(flagI(goto.open, 'disabled')).toBe(false)
    expect(attrI(goto.open, 'autoComplete')).toBe('off')
    expect(classOf(goto.open)).toContain('ui-terminal-input')
    expect(classOf(goto.open)).toContain('text-[14px]')
    const wrapper = new RegExp(`<span class="([^"]*)"><input[^>]*data-names-goto`).exec(markup)
    expect(wrapper).not.toBeNull()
    expect(wrapper?.[1].split(' ')).toEqual(expect.arrayContaining(['ui-terminal-field', 'ui-terminal-field--quiet']))
  })

  it('the message slot starts empty, in refusal red, with an id the fields can point at', () => {
    const message = need(markup, 'data-names-list-message')
    expect(textOf(message.inner)).toBe('')
    expect(attrOf(message.open, 'id')).toMatch(/\S/)
    expect(classOf(message.open)).toContain('text-[#f87171]')
  })

  it('the list is a labelled list with a sticky 24px header row named Zone, Sound and Lock', () => {
    const list = need(markup, 'data-names-list')
    expect(attrOf(list.open, 'role')).toBe('list')
    expect(attrOf(list.open, 'aria-label')).toBe('Zone sounds')
    const header = need(list.inner, 'data-names-list-header')
    expect(classOf(header.open).split(' ')).toContain('sticky')
    expect(classOf(header.open)).toContain('top-0')
    expect(attrOf(header.open, 'style') ?? '').toContain(`height:${ZONE_HEADER_HEIGHT_PX}px`)
    expect(ZONE_HEADER_HEIGHT_PX).toBe(24)
    expect(attrOf(header.open, 'aria-hidden')).toBe('true')
    const words = (header.inner.match(/<span[^>]*>([^<]*)<\/span>/g) ?? []).map(s => textOf(s))
    expect(words).toEqual([NAMES_COPY.zoneHeader, NAMES_COPY.soundHeader, NAMES_COPY.lockHeader])
    expect(words).toEqual(['Zone', 'Sound', 'Lock'])
  })

  it('every rendered row is a listitem placed in a position of the whole base, 28px tall', () => {
    const rows = rowsOf(markup)
    expect(rows.length).toBeGreaterThan(ZONE_LIST_OVERSCAN)
    expect(rows.length).toBeLessThan(OTHER_BASE + 1)
    rows.forEach(({ zone, el }, i) => {
      expect(zone).toBe(i)
      expect(attrOf(el.open, 'role')).toBe('listitem')
      expect(attrOf(el.open, 'aria-posinset')).toBe(String(zone + 1))
      expect(attrOf(el.open, 'aria-setsize')).toBe(String(OTHER_BASE))
      expect(attrOf(el.open, 'style') ?? '').toContain(`height:${ZONE_ROW_HEIGHT_PX}px`)
    })
  })

  it('is absent while a base builds and at a seed-only base (the pending line and the seed-only sentence stand there)', () => {
    for (const markupOf of [
      render(valueFor(naming, { state: 'pending', pendingBase: 30 })),
      render(valueFor(namingOf(SEED_ONLY_BASE))),
    ]) {
      for (const attr of ['data-names-list', 'data-names-goto', 'data-names-list-message', 'data-names-row']) {
        expect(find(markupOf, attr), attr).toBeNull()
      }
      expect(markupOf).not.toContain(NAMES_COPY.listHelperLock)
    }
  })

  it('hands the pinned zone to the list', () => {
    const pinned = render(valueFor(naming), { pinnedZone: 5 })
    expect(attrOf(rowOf(pinned, 5).open, 'data-pinned')).toBe('true')
    expect(attrOf(rowOf(pinned, 4).open, 'data-pinned')).toBeNull()
    expect(rowsOf(markup).every(r => attrOf(r.el.open, 'data-pinned') === null)).toBe(true)
  })
})

describe('ZoneList: windowing and the virtualizer it asks', () => {
  it('asks for one row per zone, 28px each, overscan 8, under a margin that clears the sticky header, scrolling the panel scroller', () => {
    const scroller = { marker: 'scroller' }
    virtualCalls.length = 0
    renderToStaticMarkup(
      createElement(
        NamingContext.Provider,
        { value: valueFor(namingOf(OTHER_BASE)) },
        createElement(ZoneList, { scrollEl: () => scroller as unknown as HTMLElement, scrollMargin: MARGIN, pinnedZone: null }),
      ),
    )
    const call = virtualCalls[virtualCalls.length - 1]
    expect(call.count).toBe(OTHER_BASE)
    expect(call.estimateSize(0)).toBe(ZONE_ROW_HEIGHT_PX)
    expect(ZONE_ROW_HEIGHT_PX).toBe(28)
    expect(call.overscan).toBe(ZONE_LIST_OVERSCAN)
    expect(ZONE_LIST_OVERSCAN).toBe(8)
    expect(call.scrollMargin).toBe(MARGIN + ZONE_HEADER_HEIGHT_PX)
    expect(call.scrollPaddingStart).toBe(ZONE_HEADER_HEIGHT_PX)
    expect(call.getScrollElement()).toBe(scroller)
  })

  it('renders the first window of the real rule: the rows that start above the viewport bottom, plus the overscan', () => {
    const rows = rowsOf(renderList(valueFor(namingOf(OTHER_BASE))))
    const visible = Math.ceil((WINDOW.height - MARGIN - ZONE_HEADER_HEIGHT_PX) / ZONE_ROW_HEIGHT_PX)
    expect(rows.map(r => r.zone)).toEqual(Array.from({ length: visible + ZONE_LIST_OVERSCAN }, (_, i) => i))
  })

  it('positions rows from the top of the spacer, one row height apart', () => {
    const rows = rowsOf(renderList(valueFor(namingOf(OTHER_BASE))))
    expect(rows.map(r => topOf(r.el))).toEqual(rows.map((_, i) => i * ZONE_ROW_HEIGHT_PX))
  })

  it('at the interactive ceiling mounts a few rows, each one of the whole base', () => {
    const markup = renderList(valueFor(namingOf(INTERACTIVE_MAX_N)))
    const rows = rowsOf(markup)
    expect(rows.length).toBeGreaterThan(ZONE_LIST_OVERSCAN)
    expect(rows.length).toBeLessThan(80)
    for (const { el } of rows) expect(attrOf(el.open, 'aria-setsize')).toBe(String(INTERACTIVE_MAX_N))
    expect(attrOf(need(markup, 'data-names-row').open, 'aria-posinset')).toBe('1')
    // the spacer carries the whole list height, so the scroller is as tall as every row together
    expect(markup).toContain(`height:${INTERACTIVE_MAX_N * ZONE_ROW_HEIGHT_PX}px`)
  })

  it('renders nothing without a naming provider, for a seed-only naming, and while previewing is the only read-only state', () => {
    expect(renderList(null)).toBe('')
    expect(renderList(valueFor(namingOf(SEED_ONLY_BASE)))).toBe('')
    expect(renderList(valueFor(namingOf(OTHER_BASE), { state: 'pending' }))).toBe('')
    expect(renderList(valueFor(namingOf(OTHER_BASE), { state: 'preview' }))).not.toBe('')
  })
})

describe('ZoneList: a row', () => {
  const naming = namingOf(OTHER_BASE)
  const sounds = naming.sounds ?? []
  const markup = renderList(valueFor(naming))
  const row = rowOf(markup, 3)

  it('is an unlocked listitem with its position, the label, the sound field and the lock in that order', () => {
    expect(attrOf(row.open, 'data-names-row')).toBe('3')
    expect(attrOf(row.open, 'data-locked')).toBe('false')
    expect(attrOf(row.open, 'aria-posinset')).toBe('4')
    expect(attrOf(row.open, 'aria-setsize')).toBe(String(OTHER_BASE))
    expect(classOf(row.open)).toContain('hover:bg-white/[0.03]')
    expect(row.inner.indexOf('3</span>')).toBeGreaterThan(-1)
    const order = [row.inner.indexOf('3</span>'), row.inner.indexOf('data-names-sound'), row.inner.indexOf('data-names-lock')]
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })

  it('shows the zone label the rest of the panel uses: the numeral of the base', () => {
    // a margin of zero puts more rows in the first window, so zone 12 is mounted
    const wide = renderList(valueFor(naming), { scrollMargin: 0 })
    expect(textOf(rowOf(wide, 12).inner)).toBe('c')
    expect(attrOf(need(rowOf(wide, 12).inner, 'data-names-sound').open, 'aria-label')).toBe(zoneAria('c'))
  })

  it('has a sound field with the stored sound and the spelling attributes of a name field', () => {
    const field = need(row.inner, 'data-names-sound')
    expect(field.tag).toBe('input')
    expect(attrOf(field.open, 'data-names-sound')).toBe('3')
    expect(attrOf(field.open, 'aria-label')).toBe('Sound for zone 3')
    expect(attrOf(field.open, 'aria-label')).toBe(zoneAria('3'))
    expect(attrOf(field.open, 'value')).toBe(sounds[3])
    expect(attrOf(field.open, 'dir')).toBe('auto')
    expect(attrI(field.open, 'autoCapitalize')).toBe('none')
    expect(attrI(field.open, 'autoCorrect')).toBe('off')
    expect(attrI(field.open, 'spellCheck')).toBe('false')
    expect(attrI(field.open, 'autoComplete')).toBe('off')
    expect(attrI(field.open, 'maxLength')).toBe(String(SOUND_FIELD_MAX_INPUT))
    expect(SOUND_FIELD_MAX_INPUT).toBe(64)
    expect(flagI(field.open, 'readonly')).toBe(false)
    expect(attrOf(field.open, 'aria-invalid')).toBeNull()
    expect(attrOf(field.open, 'aria-describedby')).toBeNull()
    const classes = classOf(field.open)
    expect(classes).toContain('ui-terminal-input')
    expect(classes).toContain('text-[14px]')
    const wrapper = new RegExp(`<span class="([^"]*)"><input[^>]*data-names-sound="3"`).exec(row.inner)
    expect(wrapper?.[1].split(' ')).toEqual(expect.arrayContaining(['ui-terminal-field', 'ui-terminal-field--quiet']))
    expect(wrapper?.[1]).not.toContain('ui-terminal-field--invalid')
  })

  it('has a 24px lock toggle that is not pressed, with the constant label and the help title', () => {
    const lock = need(row.inner, 'data-names-lock')
    expect(lock.tag).toBe('button')
    expect(attrOf(lock.open, 'type')).toBe('button')
    expect(attrOf(lock.open, 'data-names-lock')).toBe('3')
    expect(attrOf(lock.open, 'aria-pressed')).toBe('false')
    expect(attrOf(lock.open, 'aria-label')).toBe('Lock sound for zone 3')
    expect(attrOf(lock.open, 'aria-label')).toBe(lockAria('3'))
    expect(attrOf(lock.open, 'title')).toBe(NAMES_COPY.lockTitle)
    expect(flagI(lock.open, 'disabled')).toBe(false)
    const classes = classOf(lock.open).split(' ')
    expect(classes).toEqual(expect.arrayContaining(['h-6', 'w-6', 'min-h-[24px]', 'min-w-[24px]']))
    // idle: the gray open padlock (shape and colour both say it)
    expect(lock.inner).toContain('#6b7280')
    expect(lock.inner).toContain('M8.5 11V6a3.5 3.5 0 0 1 7 0v1')
    expect(attrOf(lock.open, 'style')).toBeNull()
  })

  it('a locked zone is a pressed toggle with a closed padlock, the accent tint and the inset underline', () => {
    const locked = renderList(valueFor(toggleLock(naming, 5)))
    const lockedRow = rowOf(locked, 5)
    expect(attrOf(lockedRow.open, 'data-locked')).toBe('true')
    const lock = need(lockedRow.inner, 'data-names-lock')
    expect(attrOf(lock.open, 'aria-pressed')).toBe('true')
    expect(attrOf(lock.open, 'aria-label')).toBe(lockAria('5'))
    expect(attrOf(lock.open, 'style') ?? '').toContain('rgba(16,255,80,0.08)')
    expect(attrOf(lock.open, 'style') ?? '').toContain('inset 0 -1px 0 rgba(16,255,80,0.4)')
    expect(lock.inner).toContain('#10ff50')
    expect(lock.inner).toContain('M8.5 11V8a3.5 3.5 0 0 1 7 0v3')
    // the other rows stay unlocked
    expect(attrOf(rowOf(locked, 4).open, 'data-locked')).toBe('false')
  })

  it('a typed sound shows its zone locked, because an edit locks (the engine does it, the list only shows it)', () => {
    const typed = editSound(naming, 6, 'qwy')
    const markup6 = renderList(valueFor(typed))
    expect(attrOf(rowOf(markup6, 6).open, 'data-locked')).toBe('true')
    expect(attrOf(need(rowOf(markup6, 6).inner, 'data-names-sound').open, 'value')).toBe('qwy')
  })

  it('the pinned zone carries the Phase 5 accent row token and no hover background', () => {
    const pinned = renderList(valueFor(naming), { pinnedZone: 3 })
    const pinnedRow = rowOf(pinned, 3)
    expect(attrOf(pinnedRow.open, 'data-pinned')).toBe('true')
    expect(attrOf(pinnedRow.open, 'style') ?? '').toContain('background:rgba(16,255,80,0.08)')
    expect(attrOf(pinnedRow.open, 'style') ?? '').toContain('inset 0 -1px 0 rgba(16,255,80,0.4)')
    expect(attrOf(rowOf(pinned, 2).open, 'style') ?? '').not.toContain('rgba(16,255,80,0.08)')
    expect(attrOf(rowOf(pinned, 2).open, 'data-pinned')).toBeNull()
  })

  it('has one Tab stop in the whole list: the first row until another one is active', () => {
    const fields = findAll(markup, 'data-names-sound')
    const locks = findAll(markup, 'data-names-lock')
    expect(fields.length).toBeGreaterThan(1)
    expect(fields.filter(f => attrI(f.open, 'tabIndex') === '0')).toHaveLength(1)
    expect(locks.filter(l => attrI(l.open, 'tabIndex') === '0')).toHaveLength(1)
    expect(attrI(fields[0].open, 'tabIndex')).toBe('0')
    expect(attrI(locks[0].open, 'tabIndex')).toBe('0')
    for (const el of [...fields.slice(1), ...locks.slice(1)]) expect(attrI(el.open, 'tabIndex')).toBe('-1')
  })

  it('shows the labels of the view when there is one for this base, and the numerals otherwise', () => {
    const viewFor = (base: number): NumogramViewContextValue =>
      ({ base, zoneLabel: (zone: number) => `S${zone}` }) as unknown as NumogramViewContextValue
    const within = (view: NumogramViewContextValue): string =>
      renderToStaticMarkup(
        createElement(
          NumogramViewContext.Provider,
          { value: view },
          createElement(
            NamingContext.Provider,
            { value: valueFor(naming) },
            createElement(ZoneList, { scrollEl: () => null, scrollMargin: 0, pinnedZone: null }),
          ),
        ),
      )
    const own = within(viewFor(OTHER_BASE))
    expect(attrOf(need(rowOf(own, 3).inner, 'data-names-sound').open, 'aria-label')).toBe(zoneAria('S3'))
    expect(attrOf(need(rowOf(own, 3).inner, 'data-names-lock').open, 'aria-label')).toBe(lockAria('S3'))
    expect(textOf(rowOf(own, 3).inner)).toBe('S3')
    // a view of another base (a switch in flight) is never asked for this base's zones
    const other = within(viewFor(OTHER_BASE + 2))
    expect(attrOf(need(rowOf(other, 12).inner, 'data-names-sound').open, 'aria-label')).toBe(zoneAria('c'))
  })

  it('writes a hostile stored sound as an escaped attribute value, never as markup', () => {
    const hostile = '<img src=x onerror=alert(1)>"\''
    const sounds2 = (naming.sounds ?? []).slice()
    sounds2[3] = hostile
    const out = renderList(valueFor({ ...naming, sounds: sounds2 }))
    expect(out).not.toContain('<img')
    expect(out).not.toContain('onerror=alert(1)>"')
    expect(attrOf(need(rowOf(out, 3).inner, 'data-names-sound').open, 'value')).toContain('&lt;img')
  })
})

describe('ZoneList: preview is read only', () => {
  const markup = renderList(valueFor(namingOf(OTHER_BASE), { state: 'preview' }))

  it('makes every sound field read only and every lock disabled', () => {
    const fields = findAll(markup, 'data-names-sound')
    const locks = findAll(markup, 'data-names-lock')
    expect(fields.length).toBeGreaterThan(1)
    expect(locks).toHaveLength(fields.length)
    for (const f of fields) expect(flagI(f.open, 'readonly')).toBe(true)
    for (const l of locks) expect(flagI(l.open, 'disabled')).toBe(true)
  })

  it('still offers Go to zone, and shows the list', () => {
    const goto = need(markup, 'data-names-goto')
    expect(flagI(goto.open, 'readonly')).toBe(false)
    expect(flagI(goto.open, 'disabled')).toBe(false)
    expect(find(markup, 'data-names-list')).not.toBeNull()
  })

  it('is the same inside the whole panel in the preview state', () => {
    const panel = render(valueFor(namingOf(OTHER_BASE), { state: 'preview', saved: 'preview' }))
    for (const f of findAll(panel, 'data-names-sound')) expect(flagI(f.open, 'readonly')).toBe(true)
    for (const l of findAll(panel, 'data-names-lock')) expect(flagI(l.open, 'disabled')).toBe(true)
  })

  it('an editable list has no read only field and no disabled lock', () => {
    const ready = renderList(valueFor(namingOf(OTHER_BASE)))
    for (const f of findAll(ready, 'data-names-sound')) expect(flagI(f.open, 'readonly')).toBe(false)
    for (const l of findAll(ready, 'data-names-lock')) expect(flagI(l.open, 'disabled')).toBe(false)
  })
})

describe('ZoneRowView: the presentational row', () => {
  const base = {
    zone: 7,
    base: OTHER_BASE,
    label: '7',
    value: 'abc',
    locked: false,
    pinned: false,
    invalid: false,
    describedBy: undefined as string | undefined,
    readOnly: false,
    tabStop: true,
    top: 56,
    handlers: noopHandlers,
  }
  const html = (over: Partial<typeof base>): string => renderToStaticMarkup(createElement(ZoneRowView, { ...base, ...over }))

  it('an invalid draft gets the red underline class, aria-invalid and the description pointer', () => {
    const out = html({ invalid: true, describedBy: 'list-message-1' })
    const field = need(out, 'data-names-sound')
    expect(attrOf(field.open, 'aria-invalid')).toBe('true')
    expect(attrOf(field.open, 'aria-describedby')).toBe('list-message-1')
    expect(out).toMatch(/<span class="[^"]*ui-terminal-field--invalid[^"]*"><input/)
    expect(out).toMatch(/<span class="[^"]*ui-terminal-field--quiet[^"]*"><input/)
  })

  it('a valid row has none of those', () => {
    const out = html({})
    const field = need(out, 'data-names-sound')
    expect(attrOf(field.open, 'aria-invalid')).toBeNull()
    expect(attrOf(field.open, 'aria-describedby')).toBeNull()
    expect(out).not.toContain('ui-terminal-field--invalid')
  })

  it('points at the message only while the row is invalid, even when it is handed the id', () => {
    const out = html({ invalid: false, describedBy: 'list-message-1' })
    expect(attrOf(need(out, 'data-names-sound').open, 'aria-describedby')).toBeNull()
  })

  it('shows the value it is given (the draft while one exists) and places the row at its offset', () => {
    const out = html({ value: 'draft', top: 84 })
    expect(attrOf(need(out, 'data-names-sound').open, 'value')).toBe('draft')
    expect(topOf(need(out, 'data-names-row'))).toBe(84)
  })

  it('only the tab stop row has its controls in the Tab order', () => {
    const stop = html({ tabStop: true })
    const off = html({ tabStop: false })
    expect(attrI(need(stop, 'data-names-sound').open, 'tabIndex')).toBe('0')
    expect(attrI(need(stop, 'data-names-lock').open, 'tabIndex')).toBe('0')
    expect(attrI(need(off, 'data-names-sound').open, 'tabIndex')).toBe('-1')
    expect(attrI(need(off, 'data-names-lock').open, 'tabIndex')).toBe('-1')
  })

  it('a read only row has a read only field and a disabled lock, and says so to a screen reader', () => {
    const out = html({ readOnly: true })
    expect(flagI(need(out, 'data-names-sound').open, 'readonly')).toBe(true)
    expect(flagI(need(out, 'data-names-lock').open, 'disabled')).toBe(true)
  })
})

describe('ZoneList and NamesPanel source', () => {
  const list = readFileSync(ZONE_LIST_SOURCE, 'utf8')
  const panel = readFileSync(PANEL_SOURCE, 'utf8')
  const count = (source: string, needle: string): number => source.split(needle).length - 1
  const lines = (source: string, needle: string): number => source.split('\n').filter(l => l.includes(needle)).length

  it('windows with one virtualizer call, takes the field cap from data and uses no smooth scrolling', () => {
    expect(lines(list, 'useVirtualizer')).toBe(1)
    expect(lines(list, 'maxLength={SOUND_FIELD_MAX_INPUT}')).toBe(1)
    expect(count(list, "behavior: 'smooth'")).toBe(0)
    expect(/smooth/i.test(list)).toBe(false)
  })

  it('applies edits only through the naming context actions, one action per user step', () => {
    expect(count(list, "type: 'sound'")).toBe(1)
    expect(count(list, "type: 'paste'")).toBe(1)
    expect(count(list, "type: 'lock'")).toBe(1)
    expect(list).toContain('data-names-lock')
    expect(list).toContain('aria-setsize')
  })

  it('treats typed and pasted text as data: no raw html path, no eval, no typed ceiling', () => {
    expect(list).not.toContain('dangerouslySetInnerHTML')
    expect(list).not.toContain('innerHTML')
    expect(/\beval\s*\(|new Function\s*\(/.test(list)).toBe(false)
    expect(/\b4000\b|\b4002\b/.test(list)).toBe(false)
  })

  it('is mounted once by the panel, with the panel scroller, the measured controls height and the pinned zone', () => {
    expect(lines(panel, '<ZoneList')).toBe(1)
    expect(panel).toContain('scrollMargin={controlsHeight}')
    expect(panel).toContain('pinnedZone={pinnedZone}')
    expect(panel).toContain('scrollRef.current')
    expect(/\b4000\b|\b4002\b/.test(panel)).toBe(false)
  })
})

describe('ShortcutsModal: the Names panel line', () => {
  const view = { svgRichMaxN: 200 } as unknown as NumogramViewContextValue
  const open = renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: view }, createElement(ShortcutsModal, { open: true, onClose: noop })),
  )
  const closed = renderToStaticMarkup(
    createElement(NumogramViewContext.Provider, { value: view }, createElement(ShortcutsModal, { open: false, onClose: noop })),
  )
  const LINE = `<div class="text-gray-400">${NAMES_COPY.shortcutLine}</div>`
  // the markup of the modal before this plan, captured from the unmodified component (svgRichMaxN 200)
  const BEFORE =
    '<div class="fixed inset-0 z-[84] flex items-center justify-center px-4"><button class="absolute inset-0" style="background:rgba(0,0,0,0.62)" aria-label="Close shortcuts"></button><div class="relative w-full max-w-[540px] px-4 py-4 font-mono" style="border:1px solid rgba(255,255,255,0.12);background:rgba(8,8,15,0.97)"><div class="flex items-center justify-between pb-2" style="border-bottom:1px solid rgba(255,255,255,0.08)"><span class="text-[10px] tracking-[0.22em] uppercase" style="color:#10ff50">Shortcuts</span><button class="text-[8px] uppercase tracking-[0.14em] px-2 py-1" style="color:#6b7280;border:1px solid rgba(107,114,128,0.35)">close</button></div><div class="pt-3 grid gap-1.5 text-[10px]" style="color:#9ca3af"><div><span style="color:#10ff50">Mouse:</span> click+drag select, alt+drag pan, scroll zoom</div><div><span style="color:#10ff50">Layout:</span> A original, S labyrinth, D ladder, F planetary</div><div><span style="color:#10ff50">Planetary:</span> Z orbit, X today, C reset, V orbits</div><div><span style="color:#10ff50">Selection:</span> digits 0-9 toggle corresponding gate, Esc clears selection</div><div><span style="color:#10ff50">History:</span> Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo, Ctrl+Y redo</div><div><span style="color:#10ff50">Overlay:</span> Shift+/ toggles this shortcuts panel</div><div data-post-baseline="" class="grid gap-1.5"><div><span style="color:#10ff50">Diagram:</span> Up to 200 zones: Tab moves into the diagram, arrow keys step through zones, syzygies, currents and gates, Home/End jump, Enter or Space selects</div><div class="text-gray-400">Above 200 zones: arrow keys step between zones, Tab steps through a zone&#x27;s syzygy, current and gate, Page Up and Page Down jump 10 zones, Enter or Space selects. Touch: drag pans, pinch zooms, tap selects.</div><div><span style="color:#10ff50">Gate keys:</span> digits 0-9 work at base 10 only</div></div></div></div></div>'

  it('the line is the copy module sentence', () => {
    expect(NAMES_COPY.shortcutLine).toBe(
      'Names panel: in the zone list, Up and Down move between rows, Page Up and Page Down jump 10 rows, Enter saves a sound, Escape reverts it. Editing a sound locks its zone.',
    )
  })

  it('adds exactly that one line, last, inside the existing post-baseline block, and changes nothing else', () => {
    expect(open.split(NAMES_COPY.shortcutLine)).toHaveLength(2)
    const tail = 'base 10 only</div></div></div></div></div>'
    expect(BEFORE.split(tail)).toHaveLength(2)
    expect(open).toBe(BEFORE.replace(tail, () => `base 10 only</div>${LINE}</div></div></div></div>`))
  })

  it('has no accent lead-in and sits inside the data-post-baseline subtree', () => {
    const block = need(open, 'data-post-baseline')
    expect(block.inner).toContain(LINE)
    expect(LINE).not.toContain('<span')
  })

  it('renders nothing while closed', () => {
    expect(closed).toBe('')
  })

  it('takes the line from the copy module in the component source', () => {
    const source = readFileSync(SHORTCUTS_SOURCE, 'utf8')
    expect(source).toContain('{NAMES_COPY.shortcutLine}')
    expect(source.split('NAMES_COPY.shortcutLine')).toHaveLength(2)
  })
})

// ══ Plan 07-20: the collision report (block 9) ═══════════════════════════════════════════════════════════════════════════════════
// Server render only, like the rest of this file: the container's effects do not run on the server, so the block is rendered from an
// injected `initialReport`, and the list, the inline editor and the hint are rendered through the presentational view with the state
// the container would hold. The decisions are pure helpers tested directly; the clicks, the timers and the focus are the e2e plans'
// and a scratch browser run's job. Names here are neutral placeholders: no CCRU name is typed.

const COLLISION_SOURCE = fileURLToPath(new URL('../../app/components/names/CollisionReport.tsx', import.meta.url))
const zlabel = (zone: number): string => `z${zone}`

function groupOf(name: string, meshes: readonly number[], size: number = meshes.length): CollisionGroup {
  return { name, size, meshes }
}

function reportOf(list: readonly CollisionGroup[], extra: { groups?: number; demons?: number } = {}): CollisionData {
  return {
    groups: extra.groups ?? list.length,
    demons: extra.demons ?? list.reduce((sum, g) => sum + g.size, 0),
    list,
  }
}

/** The test base's generated naming with one sound copied onto another zone: a real table with real collisions. */
function duplicateNaming(): Naming {
  const generated = namingOf(OTHER_BASE)
  const sounds = [...(generated.sounds ?? [])]
  sounds[1] = sounds[0] as string
  return { ...generated, sounds }
}

function renderCollisions(value: NamingContextValue | null, props: { open?: boolean; initialReport?: CollisionData | null } = {}): string {
  const block = createElement(CollisionReport, { open: true, ...props })
  return renderToStaticMarkup(value === null ? block : createElement(NamingContext.Provider, { value }, block))
}

function viewProps(over: Partial<CollisionReportViewProps> = {}): CollisionReportViewProps {
  return {
    phase: 'done',
    limit: 1024,
    report: null,
    expanded: false,
    pages: 1,
    editing: null,
    hint: null,
    zoneLabel: zlabel,
    nameOf: () => 'Name',
    onToggle: noop,
    onMore: noop,
    onJump: noop,
    onEditorDone: noop,
    ...over,
  }
}

function renderView(over: Partial<CollisionReportViewProps>, value: NamingContextValue = valueFor(namingOf(OTHER_BASE))): string {
  return renderToStaticMarkup(createElement(NamingContext.Provider, { value }, createElement(CollisionReportView, viewProps(over))))
}

/** `count` groups of two demons each, with distinct names and distinct mesh numbers. */
function manyGroups(count: number): CollisionGroup[] {
  return Array.from({ length: count }, (_, i) => groupOf(`Name${i}`, [2 * i, 2 * i + 1]))
}

describe('CollisionReport: the block in the panel', () => {
  it('renders nothing outside a provider, in seed-only and while a base is building', () => {
    expect(renderCollisions(null)).toBe('')
    expect(renderCollisions(valueFor(namingOf(SEED_ONLY_BASE)))).toBe('')
    expect(renderCollisions(valueFor(namingOf(OTHER_BASE), { state: 'pending', pendingBase: 30 }))).toBe('')
  })

  it('is mounted by the panel after the summary and before import and export, in ready and preview only', () => {
    const ready = render(valueFor(namingOf(OTHER_BASE)))
    const block = need(ready, 'data-names-collisions')
    expect(block.index).toBeGreaterThan(at(ready, 'data-names-summary'))
    expect(block.index).toBeLessThan(at(ready, 'data-names-export'))
    expect(find(render(valueFor(namingOf(OTHER_BASE), { state: 'preview' })), 'data-names-collisions')).not.toBeNull()
    expect(find(render(valueFor(namingOf(SEED_ONLY_BASE))), 'data-names-collisions')).toBeNull()
    expect(find(render(valueFor(namingOf(OTHER_BASE), { state: 'pending', pendingBase: 30 })), 'data-names-collisions')).toBeNull()
    expect(find(render(valueFor(namingOf(OTHER_BASE)), { open: false }), 'data-names-collisions')).toBeNull()
  })

  it('before any answer it shows the eyebrow only: no count, no busy flag, no line', () => {
    const root = need(render(valueFor(namingOf(OTHER_BASE))), 'data-names-collisions')
    expect(attrOf(root.open, 'data-post-baseline')).toBe('')
    expect(attrOf(root.open, 'data-state')).toBe('pending')
    expect(attrOf(root.open, 'data-count')).toBeNull()
    expect(attrOf(root.open, 'data-demons')).toBeNull()
    expect(attrOf(root.open, 'aria-busy')).toBeNull()
    expect(textOf(root.inner)).toBe(NAMES_COPY.collisionsEyebrow)
    expect(textOf(root.inner)).toBe('Collisions')
  })

  it('none: the exact sentence in gray-400, counts of zero and no button', () => {
    const markup = renderCollisions(valueFor(namingOf(OTHER_BASE)), { initialReport: reportOf([]) })
    const root = need(markup, 'data-names-collisions')
    expect(attrOf(root.open, 'data-count')).toBe('0')
    expect(attrOf(root.open, 'data-demons')).toBe('0')
    expect(attrOf(root.open, 'data-state')).toBe('none')
    expect(attrOf(root.open, 'aria-busy')).toBeNull()
    expect(textOf(root.inner)).toContain('Collisions')
    const line = need(markup, 'data-names-collisions-line')
    expect(textOf(line.inner)).toBe('None. Every demon name is unique.')
    expect(textOf(line.inner)).toBe(NAMES_COPY.collisionsNone)
    expect(classOf(line.open)).toContain('text-gray-400')
    expect(markup).not.toContain('<button')
  })

  it('some: the counts in gray-100 (not red), the toggle collapsed, no list', () => {
    const report = reportOf([groupOf('Aaa', [10, 11, 12]), groupOf('Bbb', [20, 21])])
    const markup = renderCollisions(valueFor(namingOf(OTHER_BASE)), { initialReport: report })
    const root = need(markup, 'data-names-collisions')
    expect(attrOf(root.open, 'data-count')).toBe('2')
    expect(attrOf(root.open, 'data-demons')).toBe('5')
    expect(attrOf(root.open, 'data-state')).toBe('some')
    const line = need(markup, 'data-names-collisions-line')
    expect(textOf(line.inner)).toBe('2 repeated names across 5 demons.')
    expect(textOf(line.inner)).toBe(collisionsSome(2, 5))
    expect(classOf(line.open)).toContain('text-gray-100')
    expect(classOf(line.open)).not.toContain('#f87171')
    const toggle = need(markup, 'data-collision-toggle')
    expect(toggle.tag).toBe('button')
    expect(textOf(toggle.inner)).toBe('Show repeated names')
    expect(attrOf(toggle.open, 'aria-expanded')).toBe('false')
    expect(classOf(toggle.open)).toContain('min-h-[24px]')
    expect(find(markup, 'data-collision-name')).toBeNull()
    expect(find(markup, 'data-collision-jump')).toBeNull()
  })

  it('one group of two demons reads in the singular', () => {
    const markup = renderCollisions(valueFor(namingOf(OTHER_BASE)), { initialReport: reportOf([groupOf('Aaa', [10, 11])]) })
    expect(textOf(need(markup, 'data-names-collisions-line').inner)).toBe('1 repeated name across 2 demons.')
  })

  it('the same block shows in the preview state with the same counts', () => {
    const value = valueFor(namingOf(OTHER_BASE), { state: 'preview' })
    const markup = renderCollisions(value, { initialReport: reportOf([groupOf('Aaa', [10, 11])]) })
    expect(attrOf(need(markup, 'data-names-collisions').open, 'data-count')).toBe('1')
  })

  it('a real report from the engine: the counts are its own', () => {
    const naming = duplicateNaming()
    const report = findCollisions(naming, null)
    expect(report.groups).toBeGreaterThan(COLLISION_LINES_STEP)
    const markup = renderCollisions(valueFor(naming), { initialReport: report })
    const root = need(markup, 'data-names-collisions')
    expect(attrOf(root.open, 'data-count')).toBe(String(report.groups))
    expect(attrOf(root.open, 'data-demons')).toBe(String(report.demons))
    expect(textOf(need(markup, 'data-names-collisions-line').inner)).toBe(collisionsSome(report.groups, report.demons))
  })
})

describe('CollisionReportView: the other states', () => {
  it('checking: the word, the busy flag, no counts and no list, even when a report is passed', () => {
    const markup = renderView({ phase: 'checking', report: reportOf([groupOf('Aaa', [10, 11])]), expanded: true })
    const root = need(markup, 'data-names-collisions')
    expect(attrOf(root.open, 'aria-busy')).toBe('true')
    expect(attrOf(root.open, 'data-state')).toBe('checking')
    expect(attrOf(root.open, 'data-count')).toBeNull()
    expect(attrOf(root.open, 'data-demons')).toBeNull()
    const line = need(markup, 'data-names-collisions-line')
    expect(textOf(line.inner)).toBe('Checking...')
    expect(textOf(line.inner)).toBe(NAMES_COPY.collisionsChecking)
    expect(markup).not.toContain('<button')
    expect(find(markup, 'data-collision-name')).toBeNull()
  })

  it('skip: the limit sentence, with the limit read from the prop', () => {
    for (const limit of [1024, 300]) {
      const markup = renderView({ phase: 'skip', limit })
      const root = need(markup, 'data-names-collisions')
      expect(attrOf(root.open, 'data-state')).toBe('skip')
      expect(attrOf(root.open, 'data-count')).toBeNull()
      expect(attrOf(root.open, 'aria-busy')).toBeNull()
      expect(textOf(need(markup, 'data-names-collisions-line').inner)).toBe(collisionsNotChecked(limit))
      expect(textOf(need(markup, 'data-names-collisions-line').inner)).toBe(`Not checked above ${limit} zones.`)
      expect(markup).not.toContain('<button')
    }
  })

  it('the done state is never busy, and the root can take focus programmatically', () => {
    const root = need(renderView({ report: reportOf([groupOf('Aaa', [10, 11])]) }), 'data-names-collisions')
    expect(attrOf(root.open, 'aria-busy')).toBeNull()
    expect(attrOf(root.open, 'tabindex')).toBe('-1')
  })
})

describe('CollisionReportView: the list of repeated names', () => {
  const m = (a: number, b: number): number => meshOf(a, b)
  const sizes = reportOf([
    groupOf('Aaa', [m(5, 2), m(6, 1), m(7, 0)]),
    groupOf('Bbb', [m(8, 3), m(9, 4), m(10, 5), m(11, 6)]),
    groupOf('Ccc', [m(12, 7), m(13, 8), m(14, 9), m(15, 10), m(16, 11)]),
    groupOf('Ddd', Array.from({ length: 16 }, (_, i) => m(20 + i, 1)), 19900),
  ])

  it('collapsed shows no list; expanded flips the button to Hide and the flag to true', () => {
    expect(find(renderView({ report: sizes }), 'data-collision-name')).toBeNull()
    const open = renderView({ report: sizes, expanded: true })
    const toggle = need(open, 'data-collision-toggle')
    expect(textOf(toggle.inner)).toBe('Hide repeated names')
    expect(textOf(toggle.inner)).toBe(NAMES_COPY.hideCollisions)
    expect(attrOf(toggle.open, 'aria-expanded')).toBe('true')
  })

  it('one line per group, in order, each with its name in gray-100 and one jump button per demon up to the cap', () => {
    const markup = renderView({ report: sizes, expanded: true })
    const lines = findAll(markup, 'data-collision-name')
    expect(lines.map(l => attrOf(l.open, 'data-collision-name'))).toEqual(['Aaa', 'Bbb', 'Ccc', 'Ddd'])
    const shown = lines.map(l => findAll(l.inner, 'data-collision-jump').map(j => attrOf(j.open, 'data-collision-jump')))
    expect(shown[0]).toEqual(sizes.list[0]?.meshes.map(String))
    expect(shown[1]).toEqual(sizes.list[1]?.meshes.map(String))
    expect(shown[2]).toEqual(sizes.list[2]?.meshes.slice(0, COLLISION_JUMPS_SHOWN).map(String))
    expect(shown[3]).toEqual(sizes.list[3]?.meshes.slice(0, COLLISION_JUMPS_SHOWN).map(String))
    expect(COLLISION_JUMPS_SHOWN).toBe(4)
    const name = need(lines[0]?.inner ?? '', 'data-collision-name-text')
    expect(textOf(name.inner)).toBe('Aaa')
    expect(classOf(name.open)).toContain('text-gray-100')
    // a long or mixed-direction name wraps inside the 206px scroller and reads in its own direction
    expect(classOf(name.open)).toContain('[overflow-wrap:anywhere]')
    expect(attrOf(name.open, 'style') ?? '').toContain('unicode-bidi:plaintext')
    // the lines are a real list, also where a reset removes the list marks
    const list = need(markup, 'data-names-collisions-list')
    expect(list.tag).toBe('ul')
    expect(attrOf(list.open, 'role')).toBe('list')
    expect(findAll(list.inner, 'data-collision-name').every(li => li.tag === 'li')).toBe(true)
  })

  it('a jump shows the net-span in the active label scheme and names the demon in its accessible name', () => {
    const nameOf = (a: number, b: number): string => `Live${a}x${b}`
    const markup = renderView({ report: sizes, expanded: true, nameOf })
    const line = need(markup, 'data-collision-name="Aaa"')
    const jumps = findAll(line.inner, 'data-collision-jump')
    expect(jumps).toHaveLength(3)
    jumps.forEach((jump, i) => {
      const [a, b] = netSpanOf(sizes.list[0]?.meshes[i] ?? -1)
      expect(jump.tag).toBe('button')
      expect(textOf(jump.inner)).toBe(netSpanLabel(a, b, zlabel))
      expect(textOf(jump.inner)).toBe(`z${a}::z${b}`)
      expect(attrOf(jump.open, 'aria-label')).toBe(jumpAriaLabel(zlabel(a), zlabel(b), nameOf(a, b)))
      expect(attrOf(jump.open, 'aria-label')).toBe(`Rename demon z${a}::z${b}, currently Live${a}x${b}`)
      expect(classOf(jump.open)).toContain('min-h-[24px]')
    })
  })

  it('says how many more demons carry the name, from the exact size, only when there are more than the jumps shown', () => {
    const markup = renderView({ report: sizes, expanded: true })
    const lines = findAll(markup, 'data-collision-name')
    const extra = lines.map(l => find(l.inner, 'data-collision-extra'))
    expect(extra[0]).toBeNull() // 3 demons, 3 jumps
    expect(extra[1]).toBeNull() // 4 demons, 4 jumps: no "more" at the boundary
    expect(textOf(extra[2]?.inner ?? '')).toBe(moreJumps(1))
    expect(textOf(extra[2]?.inner ?? '')).toBe('+1 more')
    expect(textOf(extra[3]?.inner ?? '')).toBe(moreJumps(19900 - COLLISION_JUMPS_SHOWN))
    expect(textOf(extra[3]?.inner ?? '')).toBe('+19896 more')
  })

  it('shows at most one page of lines, says how many of how many, and offers more', () => {
    const report = reportOf(manyGroups(45))
    const first = renderView({ report, expanded: true, pages: 1 })
    expect(findAll(first, 'data-collision-name')).toHaveLength(COLLISION_LINES_STEP)
    expect(COLLISION_LINES_STEP).toBe(20)
    const showing = need(first, 'data-collision-showing')
    expect(textOf(showing.inner)).toBe(showingNames(20, 45))
    expect(textOf(showing.inner)).toBe('Showing 20 of 45 names.')
    const more = need(first, 'data-collision-more')
    expect(more.tag).toBe('button')
    expect(textOf(more.inner)).toBe('Show more names')
    expect(textOf(more.inner)).toBe(NAMES_COPY.showMoreNames)
    expect(classOf(more.open)).toContain('min-h-[24px]')
    const second = renderView({ report, expanded: true, pages: 2 })
    expect(findAll(second, 'data-collision-name')).toHaveLength(40)
    expect(textOf(need(second, 'data-collision-showing').inner)).toBe('Showing 40 of 45 names.')
    const last = findAll(first, 'data-collision-name').at(-1)
    expect(attrOf(last?.open ?? '', 'data-collision-name')).toBe('Name19')
  })

  it('once every group shows there is no count line and no more button', () => {
    const report = reportOf(manyGroups(45))
    const markup = renderView({ report, expanded: true, pages: 3 })
    expect(findAll(markup, 'data-collision-name')).toHaveLength(45)
    expect(find(markup, 'data-collision-showing')).toBeNull()
    expect(find(markup, 'data-collision-more')).toBeNull()
    const few = renderView({ report: reportOf(manyGroups(5)), expanded: true, pages: 1 })
    expect(findAll(few, 'data-collision-name')).toHaveLength(5)
    expect(find(few, 'data-collision-showing')).toBeNull()
    expect(find(few, 'data-collision-more')).toBeNull()
  })

  it('a list shorter than the exact count (the engine bounds it) shows it all, says so, and offers nothing more', () => {
    const report = reportOf(manyGroups(30), { groups: 50, demons: 100 })
    const markup = renderView({ report, expanded: true, pages: 2 })
    expect(findAll(markup, 'data-collision-name')).toHaveLength(30)
    expect(textOf(need(markup, 'data-collision-showing').inner)).toBe(showingNames(30, 50))
    expect(find(markup, 'data-collision-more')).toBeNull()
    expect(attrOf(need(markup, 'data-names-collisions').open, 'data-count')).toBe('50')
    expect(textOf(need(markup, 'data-names-collisions-line').inner)).toBe(collisionsSome(50, 100))
  })

  it('the lines of a real report carry the names the resolver gives those demons', () => {
    const naming = duplicateNaming()
    const value = valueFor(naming)
    const report = findCollisions(naming, null)
    const markup = renderView({ report, expanded: true, pages: 10, nameOf: (a, b) => value.resolver.nameOf(a, b) }, value)
    const lines = findAll(markup, 'data-collision-name')
    expect(lines).toHaveLength(report.list.length)
    lines.forEach((line, i) => {
      const group = report.list[i] as CollisionGroup
      expect(attrOf(line.open, 'data-collision-name')).toBe(group.name)
      for (const jump of findAll(line.inner, 'data-collision-jump')) {
        const [a, b] = netSpanOf(Number(attrOf(jump.open, 'data-collision-jump')))
        expect(attrOf(jump.open, 'aria-label')).toBe(`Rename demon z${a}::z${b}, currently ${group.name}`)
      }
    })
  })

  it('a name that looks like markup stays text: escaped in the line, the attribute and the accessible name', () => {
    const hostile = '<img src=x onerror=alert(1)>"&'
    const report = reportOf([groupOf(hostile, [m(5, 2), m(6, 1)])])
    const markup = renderView({ report, expanded: true, nameOf: () => hostile })
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('onerror=alert(1)>')
    const line = need(markup, 'data-collision-name')
    expect(decode(attrOf(line.open, 'data-collision-name') ?? '')).toBe(hostile)
    expect(textOf(need(line.inner, 'data-collision-name-text').inner)).toBe(hostile)
    const jump = need(line.inner, 'data-collision-jump')
    expect(decode(attrOf(jump.open, 'aria-label') ?? '')).toContain(hostile)
  })

  it('every button of the block is a 24px target', () => {
    const markup = renderView({ report: reportOf(manyGroups(25)), expanded: true })
    const buttons = markup.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(25)
    for (const button of buttons) expect(classOf(button)).toContain('min-h-[24px]')
  })
})

describe('CollisionReportView: the inline editor and the preview hint', () => {
  const first = meshOf(7, 6)
  const second = meshOf(8, 2)
  const third = meshOf(9, 4)
  const report = reportOf([groupOf('Aaa', [first, second]), groupOf('Bbb', [third, meshOf(10, 4)])])

  it('a jump in edit renders one editor in the collision context, in edit mode, directly under its own line', () => {
    const markup = renderView({ report, expanded: true, editing: second })
    const editors = findAll(markup, 'data-demon-name-editor')
    expect(editors).toHaveLength(1)
    expect(attrOf(editors[0]?.open ?? '', 'data-demon-name-context')).toBe('collision')
    expect(markup).toContain('data-demon-name-input')
    const owners = findAll(markup, 'data-collision-name').filter(line => line.inner.includes('data-demon-name-editor'))
    expect(owners).toHaveLength(1)
    const owner = owners[0]
    expect(attrOf(owner?.open ?? '', 'data-collision-name')).toBe('Aaa')
    // under the jump buttons of that line, not above them
    const inner = owner?.inner ?? ''
    expect(inner.indexOf('data-demon-name-editor')).toBeGreaterThan(inner.lastIndexOf('data-collision-jump'))
    expect(find(markup, 'data-names-collisions-status')).toBeNull()
  })

  it('the editor is headed by the demon it edits: its net-span in the active scheme and its kind tag', () => {
    const markup = renderView({ report, expanded: true, editing: second })
    const title = need(markup, 'data-collision-editor-title')
    const [a, b] = netSpanOf(second)
    expect(textOf(title.inner)).toContain(`z${a}::z${b}`)
    expect(textOf(title.inner)).toContain(NAMES_COPY.tagGenerated)
    expect(title.index).toBeLessThan(at(markup, 'data-demon-name-editor'))
  })

  it('a demon whose name is typed is tagged as overridden in the heading', () => {
    const naming: Naming = { ...namingOf(OTHER_BASE), overrides: new Map([[second, 'Zed']]) }
    const markup = renderView({ report, expanded: true, editing: second }, valueFor(naming))
    expect(textOf(need(markup, 'data-collision-editor-title').inner)).toContain(NAMES_COPY.tagOverridden)
  })

  it('no editor opens for a demon that no shown line holds (collapsed, on a page not shown, or unknown)', () => {
    expect(find(renderView({ report, expanded: false, editing: second }), 'data-demon-name-editor')).toBeNull()
    expect(find(renderView({ report, expanded: true, editing: 999 }), 'data-demon-name-editor')).toBeNull()
    const long = reportOf([...manyGroups(21)])
    const lateMesh = (long.list[20]?.meshes[0]) as number
    expect(find(renderView({ report: long, expanded: true, pages: 1, editing: lateMesh }), 'data-demon-name-editor')).toBeNull()
    expect(find(renderView({ report: long, expanded: true, pages: 2, editing: lateMesh }), 'data-demon-name-editor')).not.toBeNull()
  })

  it('the hint shows the preview sentence under the line that was jumped from, and opens no editor', () => {
    const markup = renderView({ report, expanded: true, hint: third })
    const status = need(markup, 'data-names-collisions-status')
    expect(textOf(status.inner)).toBe('Keep this naming to rename demons.')
    expect(textOf(status.inner)).toBe(NAMES_COPY.previewJump)
    expect(findAll(markup, 'data-names-collisions-status')).toHaveLength(1)
    const owner = findAll(markup, 'data-collision-name').find(line => line.inner.includes('data-names-collisions-status'))
    expect(attrOf(owner?.open ?? '', 'data-collision-name')).toBe('Bbb')
    expect(find(markup, 'data-demon-name-editor')).toBeNull()
    // a jump from any button of a line, not only its first, puts the hint under that line
    const later = renderView({ report, expanded: true, hint: meshOf(10, 4) })
    const laterOwner = findAll(later, 'data-collision-name').filter(line => line.inner.includes('data-names-collisions-status'))
    expect(laterOwner.map(line => attrOf(line.open, 'data-collision-name'))).toEqual(['Bbb'])
  })

  it('in the preview state the jump buttons stay enabled (they only show the hint)', () => {
    const value = valueFor(namingOf(OTHER_BASE), { state: 'preview' })
    const markup = renderView({ report, expanded: true }, value)
    const jumps = findAll(markup, 'data-collision-jump')
    expect(jumps.length).toBeGreaterThan(0)
    for (const jump of jumps) expect(flagOf(jump.open, 'disabled')).toBe(false)
  })
})

describe('the pure decisions of the collision block', () => {
  it('jumpsOf: the lowest demons up to the cap, and how many more from the exact size', () => {
    expect(jumpsOf(groupOf('A', [3, 4]))).toEqual({ meshes: [3, 4], more: 0 })
    expect(jumpsOf(groupOf('A', [1, 2, 3, 4]))).toEqual({ meshes: [1, 2, 3, 4], more: 0 })
    expect(jumpsOf(groupOf('A', [1, 2, 3, 4, 5]))).toEqual({ meshes: [1, 2, 3, 4], more: 1 })
    expect(jumpsOf(groupOf('A', Array.from({ length: 16 }, (_, i) => i), 19900))).toEqual({ meshes: [0, 1, 2, 3], more: 19896 })
  })

  it('linesShown: a page of the data step at a time, never more than the list', () => {
    expect(linesShown(1, 45)).toBe(COLLISION_LINES_STEP)
    expect(linesShown(2, 45)).toBe(2 * COLLISION_LINES_STEP)
    expect(linesShown(3, 45)).toBe(45)
    expect(linesShown(9, 45)).toBe(45)
    expect(linesShown(1, 5)).toBe(5)
    expect(linesShown(1, 0)).toBe(0)
  })

  it('jumpOutcome: edit where editing is, the hint while previewing, nothing elsewhere', () => {
    expect(jumpOutcome('ready')).toBe('edit')
    expect(jumpOutcome('preview')).toBe('hint')
    expect(jumpOutcome('pending')).toBe('none')
    expect(jumpOutcome('seed-only')).toBe('none')
  })

  it('collisionAnnouncement: nothing for the first report or an unchanged count, else the new count', () => {
    expect(collisionAnnouncement(null, 3)).toBeNull()
    expect(collisionAnnouncement(null, 0)).toBeNull()
    expect(collisionAnnouncement(4, 4)).toBeNull()
    expect(collisionAnnouncement(0, 0)).toBeNull()
    expect(collisionAnnouncement(3, 0)).toBe('No repeated names.')
    expect(collisionAnnouncement(0, 2)).toBe('2 repeated names.')
    expect(collisionAnnouncement(2, 1)).toBe('1 repeated name.')
  })

  it('phaseOf: checking wins, then no answer yet, then skipped, then done', () => {
    const naming = namingOf(OTHER_BASE)
    expect(phaseOf(null, false)).toBe('pending')
    expect(phaseOf(null, true)).toBe('checking')
    expect(phaseOf({ naming, report: null }, false)).toBe('skip')
    expect(phaseOf({ naming, report: null }, true)).toBe('checking')
    expect(phaseOf({ naming, report: reportOf([]) }, false)).toBe('done')
    expect(phaseOf({ naming, report: reportOf([]) }, true)).toBe('checking')
  })
})

describe('CollisionReport source', () => {
  const source = readFileSync(COLLISION_SOURCE, 'utf8')
  const lines = (text: string): number => source.split('\n').filter(line => line.includes(text)).length

  it('asks the engine for a job once, mounts the editor once in the collision context, and never pins or starts a worker', () => {
    expect(lines('createCollisionJob(')).toBe(1)
    expect(lines('context="collision"')).toBe(1)
    expect(source).not.toContain('onPinInfo')
    expect(source).not.toContain('new Worker')
  })

  it('schedules with the app scheduler, a performance clock and the grace period, and cancels by generation', () => {
    expect(source).toContain('browserSchedule')
    expect(source).toContain('performance.now()')
    expect(source).toContain('PENDING_GRACE_MS')
    expect(PENDING_GRACE_MS).toBe(150)
    expect(source).toContain('genRef')
    expect(source).toContain('COLLISION_SLICE_MS')
    expect(source).toContain('collisionScanLimit()')
  })

  it('has no raw-html path and types no limit', () => {
    expect(source).not.toContain('dangerouslySetInnerHTML')
    expect(source).not.toContain('innerHTML')
    expect(/\beval\s*\(|new Function\s*\(/.test(source)).toBe(false)
    expect(/\b1024\b|\b4000\b|\b4096\b/.test(source)).toBe(false)
  })

  it('is mounted once by the panel, with the panel open flag', () => {
    const panel = readFileSync(PANEL_SOURCE, 'utf8')
    expect(panel.split('\n').filter(line => line.includes('<CollisionReport')).length).toBe(1)
    expect(panel).toContain('<CollisionReport open={open} />')
  })

  it('marks the root as post-baseline chrome and carries the documented hooks', () => {
    expect(source).toContain('data-post-baseline=""')
    expect(source).toContain('data-names-collisions=""')
    expect(source).toContain('data-collision-jump')
  })
})

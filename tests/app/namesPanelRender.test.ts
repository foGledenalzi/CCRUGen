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
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEED,
  SEED_MAX_LENGTH,
  createNameResolver,
  createNaming,
  meshOf,
  netSpanOf,
  normalizeSeed,
  smoothingInert,
  type Naming,
} from '../../engine/index'
import {
  NamesHeaderTag,
  NamesPanel,
  previewMeshes,
  rerollSeed,
  seedCommitOf,
} from '../../app/components/names/NamesPanel'
import { NamingContext, type NamingContextValue } from '../../app/components/names/NamingContext'
import { NAMES_COPY, noticeBody, pendingLine, savedLine, seedOnlySentence, summaryLine } from '../../app/lib/namingCopy'
import { NAMES_PREVIEW_ROWS, NAMES_SCROLL_INSET_PX, REROLL_SEED_LENGTH } from '../../app/lib/namingLimits'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { CCRU_NAMING_PRESET } from '../../app/presets/base10/naming'

const PANEL_SOURCE = fileURLToPath(new URL('../../app/components/names/NamesPanel.tsx', import.meta.url))
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
    undo: noop,
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

  it('types no ceiling and no raw-html path', () => {
    expect(/\b4000\b|\b4002\b/.test(source)).toBe(false)
    expect(source).not.toContain('dangerouslySetInnerHTML')
    expect(/\beval\s*\(|new Function\s*\(/.test(source)).toBe(false)
    expect(source).not.toContain('innerHTML')
  })
})

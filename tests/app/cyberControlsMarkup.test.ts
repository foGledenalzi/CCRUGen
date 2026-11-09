// Markup identity for CyberRadio and CyberCheckbox (plan 07-04, T-07-13, T-07-22). The default strings below were
// captured from the UNMODIFIED components before plan 07-04's edit and are frozen: never re-capture them to make a test
// pass. Each new optional prop, when given, must add exactly its one attribute (or one class), checked by removing it
// again and comparing with the frozen string. The same file also covers LockIcon and the two new field modifier classes
// in app/globals.css (no existing rule edited).
import { readFileSync } from 'node:fs'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CyberRadio } from '../../app/components/ui/CyberRadio'
import { CyberCheckbox } from '../../app/components/ui/CyberCheckbox'
import { LockIcon } from '../../app/components/numogram/NumogramIcons'

const noop = () => {}

// captured before plan 07-04's edit
const DEFAULT_RADIO_MARKUP =
  '<label class="inline-flex cursor-pointer items-center gap-2 text-xs tracking-[0.12em] uppercase "><input type="radio" class="sr-only"/><span class="flex h-3.5 w-3.5 items-center justify-center rounded-full border" style="border-color:rgba(107,114,128,0.7);box-shadow:none"></span><span style="color:#9ca3af">Harsh</span></label>'
// captured before plan 07-04's edit (checked, with a group name, disabled)
const CHECKED_RADIO_MARKUP =
  '<label class="inline-flex cursor-pointer items-center gap-2 text-xs tracking-[0.12em] uppercase opacity-50 cursor-not-allowed"><input type="radio" name="n" disabled="" class="sr-only" checked=""/><span class="flex h-3.5 w-3.5 items-center justify-center rounded-full border" style="border-color:rgba(16,255,80,0.7);box-shadow:0 0 8px rgba(16,255,80,0.3)"><span class="h-1.5 w-1.5 rounded-full bg-[#10ff50]"></span></span><span style="color:#10ff50">Harsh</span></label>'
// captured before plan 07-04's edit
const DEFAULT_CHECKBOX_MARKUP =
  '<label class="inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.12em]  " style="border:1px solid rgba(75,85,99,0.55);background:rgba(10,14,20,0.5);clip-path:polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);transition:all 0.15s ease"><input type="checkbox" class="sr-only"/><span style="color:#94a3b8">Smooth names</span><span class="ml-auto h-1.5 w-1.5 rounded-full" style="border:1px solid #4b5563;background:transparent;box-shadow:none"></span></label>'
// captured before plan 07-04's edit (checked, className 'x')
const CHECKED_CHECKBOX_MARKUP =
  '<label class="inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.12em]  x" style="border:1px solid #10ff50;background:color-mix(in srgb, #10ff50 10%, rgba(10,14,20,0.9));clip-path:polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);transition:all 0.15s ease"><input type="checkbox" class="sr-only" checked=""/><span style="color:#10ff50">Smooth names</span><span class="ml-auto h-1.5 w-1.5 rounded-full" style="border:1px solid #10ff50;background:#10ff50;box-shadow:0 0 6px #10ff50aa"></span></label>'

function radio(extra: Partial<ComponentProps<typeof CyberRadio>> = {}): string {
  return renderToStaticMarkup(createElement(CyberRadio, { checked: false, label: 'Harsh', onChange: noop, ...extra }))
}

function checkbox(extra: Partial<ComponentProps<typeof CyberCheckbox>> = {}): string {
  return renderToStaticMarkup(createElement(CyberCheckbox, { checked: false, label: 'Smooth names', onChange: noop, ...extra }))
}

describe('CyberRadio: markup identity (T-07-13)', () => {
  it('the default markup starts with the pinned label class and is byte-identical to before plan 07-04', () => {
    expect(DEFAULT_RADIO_MARKUP.startsWith('<label class="inline-flex')).toBe(true)
    expect(radio()).toBe(DEFAULT_RADIO_MARKUP)
  })

  it('a checked, named, disabled radio is byte-identical to before plan 07-04', () => {
    const markup = renderToStaticMarkup(
      createElement(CyberRadio, { checked: true, label: 'Harsh', onChange: noop, name: 'n', disabled: true }),
    )
    expect(markup).toBe(CHECKED_RADIO_MARKUP)
  })

  it('passing every new prop as undefined changes nothing', () => {
    expect(radio({ title: undefined, className: undefined, dataAttrs: undefined })).toBe(DEFAULT_RADIO_MARKUP)
  })

  it('an empty className and empty dataAttrs change nothing (the class-string trap)', () => {
    expect(radio({ className: '' })).toBe(DEFAULT_RADIO_MARKUP)
    expect(radio({ dataAttrs: {} })).toBe(DEFAULT_RADIO_MARKUP)
  })
})

describe('CyberRadio: each new prop adds exactly one thing', () => {
  it('title adds title="t" on the label and nothing else', () => {
    const markup = radio({ title: 't' })
    expect(markup).toContain('<label class="inline-flex')
    expect(markup).toContain(' title="t"')
    expect(markup.replace(' title="t"', '')).toBe(DEFAULT_RADIO_MARKUP)
    // the attribute sits on the label, not on the input
    expect(markup.indexOf(' title="t"')).toBeLessThan(markup.indexOf('<input'))
  })

  it('className appends one space-separated class to the label class and nothing else', () => {
    const markup = radio({ className: 'min-h-[24px]' })
    expect(markup).toContain('uppercase  min-h-[24px]"')
    expect(markup.replace('uppercase  min-h-[24px]"', 'uppercase "')).toBe(DEFAULT_RADIO_MARKUP)
  })

  it('className also appends after the disabled class', () => {
    const markup = renderToStaticMarkup(
      createElement(CyberRadio, { checked: true, label: 'Harsh', onChange: noop, name: 'n', disabled: true, className: 'min-h-[24px]' }),
    )
    expect(markup).toContain('opacity-50 cursor-not-allowed min-h-[24px]"')
    expect(markup.replace('cursor-not-allowed min-h-[24px]"', 'cursor-not-allowed"')).toBe(CHECKED_RADIO_MARKUP)
  })

  it('dataAttrs puts data-names-style="harsh" on the input and nothing else', () => {
    const markup = radio({ dataAttrs: { 'data-names-style': 'harsh' } })
    expect(markup).toContain('data-names-style="harsh"')
    expect(markup.replace(' data-names-style="harsh"', '')).toBe(DEFAULT_RADIO_MARKUP)
    const input = markup.slice(markup.indexOf('<input'), markup.indexOf('/>') + 2)
    expect(input).toContain('data-names-style="harsh"')
  })

  it('dataAttrs keys that do not start with data- are dropped (T-07-22)', () => {
    const markup = radio({
      dataAttrs: { onclick: 'alert(1)', 'aria-x': 'y', style: 'color:red', class: 'evil', id: 'z', 'data-ok': '1' },
    })
    expect(markup).not.toContain('onclick')
    expect(markup).not.toContain('aria-x')
    expect(markup).not.toContain('color:red')
    expect(markup).not.toContain('evil')
    expect(markup).not.toContain('id="z"')
    expect(markup.replace(' data-ok="1"', '')).toBe(DEFAULT_RADIO_MARKUP)
  })

  it('dataAttrs cannot reach an input attribute the component already owns', () => {
    const markup = radio({ dataAttrs: { type: 'text', checked: 'checked', name: 'x', disabled: '' } })
    expect(markup).toBe(DEFAULT_RADIO_MARKUP)
  })
})

describe('CyberCheckbox: markup identity (T-07-13)', () => {
  it('the default markup starts with the pinned label class and is byte-identical to before plan 07-04', () => {
    expect(DEFAULT_CHECKBOX_MARKUP.startsWith('<label class="inline-flex')).toBe(true)
    expect(checkbox()).toBe(DEFAULT_CHECKBOX_MARKUP)
  })

  it('a checked checkbox with a className is byte-identical to before plan 07-04', () => {
    expect(checkbox({ checked: true, className: 'x' })).toBe(CHECKED_CHECKBOX_MARKUP)
  })

  it('passing dataAttrs as undefined or empty changes nothing', () => {
    expect(checkbox({ dataAttrs: undefined })).toBe(DEFAULT_CHECKBOX_MARKUP)
    expect(checkbox({ dataAttrs: {} })).toBe(DEFAULT_CHECKBOX_MARKUP)
  })
})

describe('CyberCheckbox: the new prop adds exactly one thing', () => {
  it('dataAttrs puts data-names-smoothing="" on the input and nothing else', () => {
    const markup = checkbox({ dataAttrs: { 'data-names-smoothing': '' } })
    expect(markup).toContain('data-names-smoothing=""')
    expect(markup.replace(' data-names-smoothing=""', '')).toBe(DEFAULT_CHECKBOX_MARKUP)
    const input = markup.slice(markup.indexOf('<input'), markup.indexOf('/>') + 2)
    expect(input).toContain('data-names-smoothing=""')
  })

  it('dataAttrs keys that do not start with data- are dropped (T-07-22)', () => {
    const markup = checkbox({
      dataAttrs: { onclick: 'alert(1)', 'aria-x': 'y', style: 'color:red', class: 'evil', 'data-ok': '1' },
    })
    expect(markup).not.toContain('onclick')
    expect(markup).not.toContain('aria-x')
    expect(markup).not.toContain('color:red')
    expect(markup).not.toContain('evil')
    expect(markup.replace(' data-ok="1"', '')).toBe(DEFAULT_CHECKBOX_MARKUP)
  })
})

// ── LockIcon (plan 07-04, NAM-01): the two states differ by shape, not only by colour ──────────────────────────────

describe('LockIcon: closed shackle when locked, open and raised when not', () => {
  const COLOUR = '#12ab34'
  const lock = (locked: boolean): string => renderToStaticMarkup(createElement(LockIcon, { clr: COLOUR, locked }))
  // The shackle path of each state, spelled out so the two stay distinguishable.
  const CLOSED = 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'
  const OPEN = 'M8.5 11V6a3.5 3.5 0 0 1 7 0v1'

  it('locked draws the closed shackle and not the open one', () => {
    const markup = lock(true)
    expect(markup).toContain('M8.5 11V8')
    expect(markup).not.toContain('M8.5 11V6')
    expect(markup).toContain(`d="${CLOSED}"`)
  })

  it('unlocked draws the open shackle and not the closed one', () => {
    const markup = lock(false)
    expect(markup).toContain('M8.5 11V6')
    expect(markup).not.toContain('M8.5 11V8')
    expect(markup).toContain(`d="${OPEN}"`)
  })

  it('the closed shackle returns to the body on the right (v3) and the open one stops short of it (v1)', () => {
    expect(CLOSED.endsWith('v3')).toBe(true)
    expect(OPEN.endsWith('v1')).toBe(true)
  })

  it('both states carry the given colour on the body, the shackle and the accent dot', () => {
    for (const locked of [true, false]) {
      const markup = lock(locked)
      expect(markup.split(`stroke="${COLOUR}"`).length - 1).toBe(2)
      expect(markup).toContain(`fill="${COLOUR}"`)
    }
  })

  it('is a decorative 14px glyph (aria-hidden) so the lock button keeps its own accessible name', () => {
    const markup = lock(true)
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('width="14"')
    expect(markup).toContain('height="14"')
    expect(markup).toContain('viewBox="0 0 24 24"')
  })

  it('the two states are different markup', () => {
    expect(lock(true)).not.toBe(lock(false))
  })
})

// ── The two field modifier classes in app/globals.css (plan 07-04, UI-SPEC Color) ─────────────────────────────────

describe('globals.css: ui-terminal-field--quiet and --invalid are added without editing the base rules', () => {
  const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const baseStart = css.indexOf('.ui-terminal-field {')
  // The original block, spelled out: if anyone edits an existing rule this fails.
  const BASE_BLOCK =
    '.ui-terminal-field {\n  position: relative;\n  display: block;\n  padding-right: 14px;\n  border-bottom: 1px solid rgba(16, 255, 80, 0.35);\n}'

  it('finds the base .ui-terminal-field block and it still has padding-right 14px', () => {
    expect(baseStart).toBeGreaterThanOrEqual(0)
    const block = css.slice(baseStart, css.indexOf('}', baseStart) + 1)
    expect(block).toContain('padding-right: 14px')
    expect(block).toBe(BASE_BLOCK)
  })

  it('the focus-within gradient rule is unchanged', () => {
    expect(css).toContain('.ui-terminal-field:focus-within::after {\n  opacity: 1;\n}')
    expect(css).toContain('background: linear-gradient(90deg, rgba(16,255,80,0.7), rgba(16,255,80,0.08));')
  })

  it('both new selectors appear after the first .ui-terminal-field { occurrence', () => {
    const quiet = css.indexOf('.ui-terminal-field--quiet {')
    const invalid = css.indexOf('.ui-terminal-field.ui-terminal-field--invalid {')
    const invalidAfter = css.indexOf('.ui-terminal-field.ui-terminal-field--invalid::after')
    expect(quiet).toBeGreaterThan(baseStart)
    expect(invalid).toBeGreaterThan(baseStart)
    expect(invalidAfter).toBeGreaterThan(baseStart)
  })

  it('--quiet is a grey idle underline with no right padding', () => {
    const at = css.indexOf('.ui-terminal-field--quiet {')
    const block = css.slice(at, css.indexOf('}', at) + 1)
    expect(block).toContain('border-bottom-color: rgba(255, 255, 255, 0.12);')
    expect(block).toContain('padding-right: 0;')
  })

  it('--invalid is a red underline that beats the focus gradient (idle and focused)', () => {
    const at = css.indexOf('.ui-terminal-field.ui-terminal-field--invalid {')
    expect(css.slice(at, css.indexOf('}', at) + 1)).toContain('border-bottom-color: #f87171;')
    const afterAt = css.indexOf('.ui-terminal-field.ui-terminal-field--invalid::after,')
    const afterBlock = css.slice(afterAt, css.indexOf('}', afterAt) + 1)
    expect(afterBlock).toContain('.ui-terminal-field.ui-terminal-field--invalid:focus-within::after')
    expect(afterBlock).toContain('background: #f87171;')
    expect(afterBlock).toContain('opacity: 1;')
  })
})

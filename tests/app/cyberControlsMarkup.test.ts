// Markup identity for CyberRadio and CyberCheckbox (plan 07-04, T-07-13, T-07-22). The default strings below were
// captured from the UNMODIFIED components before plan 07-04's edit and are frozen: never re-capture them to make a test
// pass. Each new optional prop, when given, must add exactly its one attribute (or one class), checked by removing it
// again and comparing with the frozen string.
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CyberRadio } from '../../app/components/ui/CyberRadio'
import { CyberCheckbox } from '../../app/components/ui/CyberCheckbox'

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

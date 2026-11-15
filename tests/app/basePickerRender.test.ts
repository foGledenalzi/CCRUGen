// Server-render checks for the base picker's computing state (Phase 6 D-07, plan 06-09, research P19): while a worker
// computes, the numeral shows the REQUESTED base and the summary slot reads `Computing base {n}...`; a persistent
// sr-only role="status" carrier announces `Computing base {n}...` then `Base {n} ready.` (UI-SPEC checker
// recommendation 1). The state-driven behaviour (steppers, chips, Enter and the debounce acting on the requested base)
// lives in event handlers and effects that renderToStaticMarkup does not run, so it is proven by the acceptance greps
// and the e2e specs; what is checkable here is the rendered contract. No JSX (plain node test file), matching
// tests/app/demonMatrixRender.test.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { summarize } from '../../app/lib/numogramView'
import { summaryLine } from '../../app/lib/basePicker'
import { DEFAULT_LABEL_SCHEME } from '../../app/lib/labelScheme'
import { BasePicker, type BasePickerProps } from '../../app/components/numogram/BasePicker'

const noop = () => {}
const summary = summarize(createNumogram(10))

function render(overrides: Partial<BasePickerProps> = {}): string {
  const props: BasePickerProps = {
    base: 10,
    summary,
    externalRefusal: null,
    onCommitBase: noop,
    labelScheme: DEFAULT_LABEL_SCHEME,
    onLabelSchemeChange: noop,
    packer: 'spiral',
    onPackerChange: noop,
    packerVisible: false,
    ...overrides,
  }
  return renderToStaticMarkup(createElement(BasePicker, props))
}

/** The persistent carrier exactly as it must render, for a given announcement text. */
function carrier(text: string): string {
  return `<span role="status" data-picker-status="" class="sr-only">${text}</span>`
}

/** The collapsed control's markup before plan 06-09 (captured from the untouched component at base 10), `id` filled in. */
function baseline(id: string, summarySpan: string): string {
  return (
    '<div><div data-post-baseline="" class="relative flex min-w-0 items-center gap-2 px-2 py-1" ' +
    'style="border:1px solid rgba(255,255,255,0.08);background:rgba(8,8,15,0.94)">' +
    `<input aria-label="Base" aria-describedby="${id}" inputMode="numeric" autoComplete="off" spellcheck="false" ` +
    // text-[13px] (was text-base, 16 px): the numeral was the loudest thing in the header and clashed with the 10 px summary beside it.
    'class="w-[5ch] min-h-[24px] bg-transparent text-[13px] font-semibold leading-none text-gray-100 outline-none" ' +
    `style="caret-color:#10ff50" value="10"/>${summarySpan}</div></div>`
  )
}

function describedById(markup: string): string {
  const m = /aria-describedby="([^"]+)"/.exec(markup)
  if (!m) throw new Error('no aria-describedby on the Base input')
  return m[1]
}

describe('BasePicker: computing state', () => {
  it('shows the requested base in the numeral and Computing base {n}... in the summary slot', () => {
    const markup = render({ requestedBase: 1024, computing: true })
    expect(markup).toContain('aria-label="Base"')
    expect(markup).toMatch(/<input[^>]*aria-label="Base"[^>]*value="1024"/)
    const id = describedById(markup)
    expect(markup).toContain(
      `<span id="${id}" data-computing="true" class="truncate text-[10px] text-gray-400">Computing base 1024...</span>`,
    )
    expect(markup).not.toContain(summaryLine(summary))
  })

  it('puts no role on the visible computing span (the announcement is not doubled)', () => {
    const markup = render({ requestedBase: 1024, computing: true })
    const id = describedById(markup)
    const spanStart = markup.indexOf(`<span id="${id}"`)
    const spanTag = markup.slice(spanStart, markup.indexOf('>', spanStart) + 1)
    expect(spanTag).not.toContain('role=')
    // exactly one role="status" in the collapsed control: the persistent carrier
    expect(markup.match(/role="status"/g)).toHaveLength(1)
  })

  it('keeps the summary span id (the aria-describedby target) in all three states', () => {
    const ready = render()
    const pending = render({ requestedBase: 1024, computing: true })
    const refused = render({ externalRefusal: "Base 7 is odd — numograms need an even base. Showing base 10." })
    for (const markup of [ready, pending, refused]) {
      const id = describedById(markup)
      expect(markup).toContain(`<span id="${id}"`)
    }
    expect(describedById(pending)).toBe(describedById(ready))
    expect(describedById(refused)).toBe(describedById(ready))
  })

  it('lets a refusal win over the computing text (failure is shown, UI-SPEC Failed row)', () => {
    // no apostrophe: renderToStaticMarkup would HTML-escape it and obscure the assertion
    const message = 'Base 1024 needs a background worker, which this browser cannot start. Showing base 10.'
    const markup = render({ requestedBase: 1024, computing: true, externalRefusal: message })
    const id = describedById(markup)
    expect(markup).toContain(`<span id="${id}" role="status" class="truncate text-[10px] text-[#f87171]">${message}</span>`)
    expect(markup).not.toContain('Computing base')
    expect(markup).not.toContain('data-computing')
  })
})

describe('BasePicker: persistent status carrier', () => {
  it('is today\'s markup plus exactly one added element when nothing is pending', () => {
    const markup = render()
    const id = describedById(markup)
    // The ready summary now carries its own full line as a title (it truncates when the header is narrow).
    const summarySpan = `<span id="${id}" title="${summaryLine(summary)}" class="truncate text-[10px] text-gray-400">${summaryLine(summary)}</span>`
    expect(markup).toContain(carrier(''))
    expect(markup.replace(carrier(''), '')).toBe(baseline(id, summarySpan))
  })

  it('carries exactly the announcement prop', () => {
    expect(render({ announcement: 'Base 1024 ready.' })).toContain(carrier('Base 1024 ready.'))
    expect(render({ requestedBase: 1024, computing: true, announcement: 'Computing base 1024...' })).toContain(
      carrier('Computing base 1024...'),
    )
  })

  it('is present while computing, so the status region exists before its text changes', () => {
    expect(render({ requestedBase: 1024, computing: true })).toContain(carrier(''))
  })

  it('defaults requestedBase to base and computing to false', () => {
    const markup = render({ base: 28 })
    expect(markup).toMatch(/<input[^>]*aria-label="Base"[^>]*value="28"/)
    expect(markup).not.toContain('data-computing')
  })
})

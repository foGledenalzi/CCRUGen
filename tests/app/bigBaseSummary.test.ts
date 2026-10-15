// Server-render smoke for BigBaseSummary (Phase 6 D-01/D-02): the over-limit view above the shipped interactive ceiling.
// The cutoff comes only from the prop (never a literal), the tier-override wording never claims the base is over the
// limit, and no control that would draw the diagram anyway exists (no button except the text view's copy button, no
// link, no "anyway"). No JSX (plain node test file), matching tests/app/demonMatrixRender.test.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createNumogram } from '../../engine/index'
import { summarize } from '../../app/lib/summary'
import { INTERACTIVE_MAX_N } from '../../app/lib/tierBounds'
import { BigBaseSummary } from '../../app/components/numogram/BigBaseSummary'

const OVER = INTERACTIVE_MAX_N + 2

function render(base: number, props: { interactiveMaxN: number; overridden: boolean; text: string }): string {
  return renderToStaticMarkup(createElement(BigBaseSummary, { summary: summarize(createNumogram(base)), ...props }))
}

describe('BigBaseSummary: over the interactive limit', () => {
  const markup = render(OVER, { interactiveMaxN: 1234, overridden: false, text: 'x' })

  it('shows the over-limit message with the cutoff taken only from the prop', () => {
    expect(markup).toContain(
      `Base ${OVER} is above the interactive limit of 1234. Showing the summary and text view. To draw it, use headless export.`,
    )
  })

  it('never states a cutoff of its own (the shipped ceiling does not appear when the prop differs)', () => {
    expect(markup).not.toContain(`limit of ${INTERACTIVE_MAX_N}`)
  })

  it('keeps the section contract: aria-label, data-post-baseline, the status paragraph and its colour', () => {
    expect(markup).toContain('aria-label="Numogram summary"')
    expect(markup).toContain('data-post-baseline=""')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('text-[11px] text-[#f87171]')
  })

  it('keeps the four metric labels and the text view', () => {
    for (const label of ['Zones', 'Warp', 'Torque cycles', 'Demons']) expect(markup).toContain(`>${label}<`)
    expect(markup).toContain('aria-label="Numogram text"')
    expect(markup).toContain('>x</pre>')
  })

  it('has no control that would draw the diagram anyway: one button (copy), no link, no "anyway"', () => {
    expect(markup.match(/<button/g)).toHaveLength(1)
    expect(markup).toContain('Copy numogram text')
    expect(markup).not.toContain('<a ')
    expect(markup.toLowerCase()).not.toContain('anyway')
  })
})

describe('BigBaseSummary: the diagnostic tier override', () => {
  const markup = render(28, { interactiveMaxN: INTERACTIVE_MAX_N, overridden: true, text: 'y' })

  it('says the override is active and never claims an interactive limit', () => {
    expect(markup).toContain('Tier override active. Showing the summary and text view for base 28.')
    expect(markup).not.toContain('interactive limit')
  })

  it('keeps the same structure and no extra controls', () => {
    expect(markup).toContain('aria-label="Numogram summary"')
    expect(markup.match(/<button/g)).toHaveLength(1)
    expect(markup).not.toContain('<a ')
  })
})

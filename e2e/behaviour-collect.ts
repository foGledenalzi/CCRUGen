// In-page collector of the behaviour and text baseline (D-15). It runs inside the browser through
// page.evaluate(collect, PANELS), so it is self-contained: no imports and no reference to module scope.
//
// Only text, attribute and computed-style facts are recorded, so a baseline captured on one OS holds on
// another: nothing here depends on installed fonts or on pixel positions. Visibility is decided from computed
// style alone (display, visibility, opacity and a zero height or max-height on a clipping element).

export const PANELS = ['Layers', 'Labels', 'Zones', 'Regions', 'Syzygies', 'Currents', 'Gates', 'Selection'] as const

export interface CollectResult {
  url: string
  svg: { viewBox: string | null; interactive: number } | null
  interactive: string[]
  texts: Record<string, string | null>
  open: Record<string, boolean>
}

export function collect(panels: readonly string[]): CollectResult {
  const norm = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim()

  // ---- visibility from computed style only
  const effCache = new Map<Element, boolean>()
  const eff = (el: Element | null): boolean => {
    if (!el || el.nodeType !== 1) return true
    const cached = effCache.get(el)
    if (cached !== undefined) return cached
    let res = true
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) res = false
    else if (
      (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') &&
      (cs.maxHeight === '0px' || cs.height === '0px')
    ) res = false
    if (res && el.parentElement) res = eff(el.parentElement)
    effCache.set(el, res)
    return res
  }

  const visibleText = (root: Element | null): string | null => {
    if (!root) return null
    const parts: string[] = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = w.nextNode())) {
      const t = norm(n.nodeValue)
      if (!t) continue
      const p = n.parentElement
      if (!p || p.closest('svg')) continue
      if (!eff(p)) continue
      parts.push(t)
    }
    return parts.join(' | ')
  }

  // ---- regions
  const fixedAncestor = (h: Element): HTMLElement | null => {
    let e = h.parentElement
    while (e) {
      if (e.style.position === 'fixed') return e
      e = e.parentElement
    }
    return null
  }
  const regions: Record<string, Element | null> = {}
  for (const h of Array.from(document.querySelectorAll('header'))) {
    const t = norm(h.textContent)
    const root = fixedAncestor(h)
    if (root && panels.includes(t)) regions[t] = root
  }
  const pageHeader = Array.from(document.querySelectorAll('header')).find(h => !panels.includes(norm(h.textContent)))
  regions.header = pageHeader ? pageHeader.closest('div.fixed') : null
  regions.topbar = document.querySelector('div.fixed.top-0')
  regions.footer = document.querySelector('div[class*="bottom-2"]')
  regions.shortcutsTrigger = Array.from(document.querySelectorAll('button')).find(b => norm(b.textContent) === 'shortcuts') || null
  regions.shortcutsModal = document.querySelector('div[class*="z-[84]"]')
  regions.splash = Array.from(document.querySelectorAll('div[class*="z-[70]"]')).find(d => d.querySelector('h1')) || null
  regions.pinnedBackground = document.querySelector('div[class*="z-[1]"]')
  const regionKeys = [...panels, 'header', 'topbar', 'footer', 'shortcutsTrigger', 'shortcutsModal', 'splash', 'pinnedBackground']
  const regionOf = (el: Element): string => {
    for (const k of regionKeys) {
      const r = regions[k]
      if (r && (r === el || r.contains(el))) return k
    }
    return 'other'
  }

  // ---- interactive elements (one string row each)
  const SEL = 'button, a, input, select, textarea, [role=button], [tabindex], .cursor-pointer'
  let svgInteractive = 0
  const interactive: string[] = []
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(SEL))) {
    if (el.closest('svg[viewBox^="0 0 800 "]')) {
      svgInteractive++
      continue
    }
    const name = el.getAttribute('aria-label') || el.getAttribute('title') || norm(el.textContent) || (el.querySelector('svg') ? '[icon]' : '') || ''
    const flags: string[] = []
    if ((el as HTMLButtonElement).disabled) flags.push('disabled')
    if ((el as HTMLInputElement).checked) flags.push('checked')
    if (el.getAttribute('aria-expanded') !== null) flags.push('expanded=' + el.getAttribute('aria-expanded'))
    if (el.getAttribute('aria-pressed') !== null) flags.push('pressed=' + el.getAttribute('aria-pressed'))
    const type = el.getAttribute('type') || ''
    const role = el.getAttribute('role') || ''
    const href = el.getAttribute('href') || ''
    const title = el.getAttribute('title') || ''
    const value = el.tagName === 'INPUT' ? (el as HTMLInputElement).value : ''
    interactive.push(
      [
        regionOf(el),
        el.tagName.toLowerCase() + (type ? `[${type}]` : '') + (role ? `{${role}}` : ''),
        JSON.stringify(name.slice(0, 120)),
        href && 'href=' + href,
        title && 'title=' + JSON.stringify(title),
        value && 'value=' + value,
        flags.join(','),
        eff(el) ? 'visible' : 'HIDDEN',
      ].filter(Boolean).join(' | '),
    )
  }

  // ---- visible text per region, popovers and every other page text outside the projection svg
  const texts: Record<string, string | null> = {}
  for (const k of Object.keys(regions)) texts[k] = visibleText(regions[k] ?? null)
  texts.popovers = Array.from(document.querySelectorAll('div[class*="z-[95]"]')).map(visibleText).join(' || ')
  const named = Object.values(regions).filter((r): r is Element => !!r)
  {
    const parts: string[] = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = w.nextNode())) {
      const t = norm(n.nodeValue)
      const p = n.parentElement
      if (!t || !p || p.closest('svg') || p.closest('script, style, noscript')) continue
      if (named.some(r => r.contains(p))) continue
      if (!eff(p)) continue
      parts.push(t)
    }
    texts.otherPageText = parts.join(' | ')
  }

  // ---- open state of each panel body (the collapsible wrapper carries max-height in its inline style)
  const open: Record<string, boolean> = {}
  for (const k of panels) {
    const r = regions[k]
    if (!r) continue
    const body = r.querySelector('div[style*="max-height"]')
    open[k] = body ? parseFloat(getComputedStyle(body).maxHeight) > 0 : true
  }

  const svg = document.querySelector('svg[viewBox^="0 0 800 "]')
  return {
    url: location.pathname + location.search,
    svg: svg ? { viewBox: svg.getAttribute('viewBox'), interactive: svgInteractive } : null,
    interactive,
    texts,
    open,
  }
}

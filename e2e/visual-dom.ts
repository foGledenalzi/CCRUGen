export interface RawNode { t: string; a: [string, string][]; c: (RawNode | string)[] }

/** Runs inside the browser (serialized by Playwright). Self-contained: no imports, no closures. */
export function extractTree(sel: string): RawNode {
  const roots = document.querySelectorAll(sel)
  if (roots.length !== 1) throw new Error(`expected exactly 1 ${sel}, found ${roots.length}`)
  const walk = (el: Element): RawNode => {
    const out: RawNode = { t: el.localName, a: [], c: [] }
    for (const n of el.getAttributeNames()) out.a.push([n, el.getAttribute(n) ?? ''])
    let text = ''
    const flush = () => { const s = text.replace(/\s+/g, ' ').trim(); if (s) out.c.push(s); text = '' }
    for (const ch of Array.from(el.childNodes)) {
      if (ch.nodeType === 3) text += ch.nodeValue ?? ''            // merge React's split text nodes
      else if (ch.nodeType === 1) { flush(); out.c.push(walk(ch as Element)) }
      // comments (React's <!-- --> markers) are ignored
    }
    flush()
    return out
  }
  return walk(roots[0]!)
}

const DROP_EXACT = new Set(['role', 'tabindex'])
const KEEP_RAW = new Set(['id', 'class', 'href', 'xlink:href', 'font-family', 'attributeName', 'in', 'in2', 'result', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end'])
export const isIgnoredAttr = (n: string) => n.startsWith('aria-') || n.startsWith('data-') || DROP_EXACT.has(n)

const round3 = (s: string) => { const r = Math.round(parseFloat(s) * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r) }
const NUM_ANY = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi                   // path data such as "M0,0.5L7,3"
const NUM_SPACED = /(?<![\w#.])-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi      // style values: never touch #hex or identifiers

function canonStyle(v: string): string {
  return v.split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const i = d.indexOf(':'); const p = d.slice(0, i).trim().toLowerCase(); const val = d.slice(i + 1).trim().replace(/\s+/g, ' ')
    return `${p}:${val.replace(NUM_SPACED, round3)}`
  }).sort().join(';')
}

export function canonAttr(name: string, value: string): string {
  if (name === 'style') return canonStyle(value)
  if (KEEP_RAW.has(name) || value.startsWith('#') || value.startsWith('url(')) return value
  return value.replace(NUM_ANY, round3)
}

export function normalizeTree(root: RawNode): string {
  const lines: string[] = []
  const emit = (n: RawNode, depth: number) => {
    const attrs = n.a.filter(([k]) => !isIgnoredAttr(k)).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
      .map(([k, v]) => ` ${k}="${canonAttr(k, v).replace(/"/g, '&quot;')}"`).join('')
    lines.push(`${'  '.repeat(depth)}<${n.t}${attrs}>`)
    for (const ch of n.c) typeof ch === 'string' ? lines.push(`${'  '.repeat(depth + 1)}#text ${JSON.stringify(ch)}`) : emit(ch, depth + 1)
  }
  emit(root, 0)
  return lines.join('\n') + '\n'
}

export const countElements = (text: string) => (text.match(/^ *</gm) || []).length   // DOM node count per golden (D-17)

// Scene -> SVG string emitter (research Pattern 8): pure string building with rounded coordinates, named layer
// groups, an explicit viewBox and XML escaping. Serves the review sheet and the spike now; Phase 8 promotes it to
// export and CLI (EXP-01, EXP-04).
//
// Trust boundary (T-03-16, T-03-17): every free-text value (title, region-label text, pair-graph net-span labels) is
// escaped with escapeXml before it is interpolated into the string, so a hostile payload never becomes a tag or an
// attribute break-out; a background colour is validated against a hex pattern or rejected outright, and every
// coordinate and dimension goes through `fmt` (which itself refuses a non-finite value). The emitter never touches
// the virtual demon space (T-03-18): its cost stays proportional to the zone or pair count, never the demon count.

import { formatGateName, formatNetSpan, formatNumeral } from '../core/numerals'
import type { Numogram, RegionKind } from '../core/types'
import { fmt } from '../layout/format'
import { routePairGraph } from '../layout/pairgraph'
import { routeCurrents, routeGates } from '../layout/routing'
import type { CurrentRoutes, GateRoutes, Layout, PairGraphLayout, RegionLabel } from '../layout/types'

/** Escapes the five XML-significant characters, `&` first so a prior replacement is never re-escaped. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FIXED_GROUP_COLOURS: { readonly plex: string; readonly warp: string } = { plex: '#cc8844', warp: '#44cc77' }
const REGION_LABEL_COLOURS: Readonly<Record<RegionKind, string>> = { plex: '#aa6633', warp: '#44cc77', torque: '#00ccff' }
const TORQUE_HUE_STEP = 137.508 // the golden angle in degrees: successive Torque cycles get well-separated hues

/** The node/glyph colour of a region: fixed hex for Plex/Warp, a golden-angle hsl rotation for Torque cycles. */
export function groupColour(kind: RegionKind, torqueIndex: number): string {
  if (kind === 'plex') return FIXED_GROUP_COLOURS.plex
  if (kind === 'warp') return FIXED_GROUP_COLOURS.warp
  const hue = Math.round((190 + torqueIndex * TORQUE_HUE_STEP) % 360)
  return `hsl(${hue} 75% 62%)`
}

function regionLabelColour(kind: RegionKind): string {
  return REGION_LABEL_COLOURS[kind]
}

export interface SvgOptions {
  readonly syzygies?: boolean
  readonly currents?: boolean
  readonly gates?: 'on' | 'thin' | 'off'
  readonly labels?: 'all' | 'none'
  readonly gateLabels?: boolean
  readonly detail?: 'lean' | 'rich'
  readonly title?: string
  readonly embed?: boolean
  readonly background?: string | null
  readonly gateRoutes?: GateRoutes
  readonly currentRoutes?: CurrentRoutes
}

const BACKGROUND_RE = /^#[0-9a-fA-F]{3,8}$/

interface ResolvedOptions {
  readonly syzygies: boolean
  readonly currents: boolean
  readonly gates: 'on' | 'thin' | 'off'
  readonly labels: 'all' | 'none'
  readonly gateLabels: boolean
  readonly detail: 'lean' | 'rich'
  readonly title: string | undefined
  readonly embed: boolean
  readonly background: string | null
}

/** Merges `opts` over the documented defaults; validates `background` (T-03-17) before anything else runs. */
function resolveOptions(opts: SvgOptions): ResolvedOptions {
  const background = opts.background === undefined ? '#060609' : opts.background
  if (background !== null && !BACKGROUND_RE.test(background)) {
    throw new RangeError('svg: background must be a hex colour or null')
  }
  return {
    syzygies: opts.syzygies ?? true,
    currents: opts.currents ?? true,
    gates: opts.gates ?? 'on',
    labels: opts.labels ?? 'all',
    gateLabels: opts.gateLabels ?? false,
    detail: opts.detail ?? 'lean',
    title: opts.title,
    embed: opts.embed ?? false,
    background,
  }
}

function svgOpenTag(width: number, height: number, embed: boolean): string {
  const w = fmt(width)
  const h = fmt(height)
  const attrs = embed ? '' : ` xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`
  return `<svg${attrs} viewBox="0 0 ${w} ${h}" font-family="monospace">`
}

function defsBlock(): string {
  return [
    '<defs>',
    '<marker id="ac" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="9" markerHeight="7" orient="auto">' +
      '<path d="M0,.5L7,3L0,5.5" fill="#22ee66"/></marker>',
    '<marker id="ag" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto">' +
      '<path d="M0,.5L7,3L0,5.5" fill="#cc44ff"/></marker>',
    '</defs>',
  ].join('\n')
}

function backgroundLine(width: number, height: number, background: string | null): string | null {
  if (background === null) return null
  return `<rect width="${fmt(width)}" height="${fmt(height)}" fill="${background}"/>`
}

function regionLabelsBlock(regionLabels: readonly RegionLabel[]): string {
  const lines = ['<g class="regions">']
  for (const label of regionLabels) {
    const clr = regionLabelColour(label.kind)
    lines.push(
      `<text x="${fmt(label.x)}" y="${fmt(label.y)}" text-anchor="${label.anchor}" font-size="${fmt(label.size)}" ` +
        `fill="${clr}" opacity="${label.opacity}">${escapeXml(label.text)}</text>`,
    )
  }
  lines.push('</g>')
  return lines.join('\n')
}

/**
 * A single zone or region layout (ring, ladder, spiral or a base-10 preset) turned into a deterministic, escaped,
 * self-contained SVG string: named layer groups (`regions`, `gates`, `currents`, `syzygies`, one `zone` group per
 * node, `gate-labels`), rounded coordinates (`fmt`) and an explicit viewBox. Stroke widths, node radii and label
 * sizes all come from `layout` (LAY-03), so the drawing scales with n without any renderer-side constant.
 */
export function layoutToSvg(g: Numogram, layout: Layout, opts: SvgOptions = {}): string {
  const o = resolveOptions(opts)
  const sw = layout.strokeScale
  const r = layout.nodeRadius
  const fs = layout.labelSize
  const n = layout.base

  const lines: string[] = []
  lines.push(svgOpenTag(layout.width, layout.height, o.embed))
  if (o.title !== undefined) lines.push(`<title>${escapeXml(o.title)}</title>`)
  lines.push(defsBlock())
  const bg = backgroundLine(layout.width, layout.height, o.background)
  if (bg !== null) lines.push(bg)
  lines.push(regionLabelsBlock(layout.regionLabels))

  const gateRoutes = o.gates !== 'off' ? (opts.gateRoutes ?? routeGates(g, layout)) : null
  if (gateRoutes !== null) {
    const opacity = o.gates === 'thin' ? 0.225 : 0.45
    lines.push(
      `<g class="gates" fill="none" stroke="#cc44ff" stroke-width="${fmt(0.7 * sw)}" ` +
        `stroke-dasharray="${fmt(5 * sw)} ${fmt(3 * sw)}" opacity="${opacity}">`,
    )
    for (let z = 0; z < n; z++) {
      const d = gateRoutes.d[z] ?? ''
      lines.push(`<path d="${d}" marker-end="url(#ag)"/>`)
      if (o.detail === 'rich') lines.push(`<path d="${d}" stroke="transparent" stroke-width="${fmt(12 * sw)}" fill="none"/>`)
    }
    lines.push('</g>')
  }

  if (o.currents) {
    const currentRoutes = opts.currentRoutes ?? routeCurrents(g, layout)
    lines.push(`<g class="currents" fill="none" stroke="#22ee66" stroke-width="${fmt(1.2 * sw)}" opacity="0.75">`)
    const P = g.pairCount
    for (let q = 0; q < P; q++) {
      const legA = currentRoutes.legA[q] ?? ''
      const legB = currentRoutes.legB[q] ?? ''
      const stem = currentRoutes.stem[q] ?? ''
      lines.push(`<path d="${legA}" stroke-width="${fmt(0.85 * sw)}"/>`)
      lines.push(`<path d="${legB}" stroke-width="${fmt(0.85 * sw)}"/>`)
      lines.push(`<path d="${stem}" marker-end="url(#ac)"/>`)
      const jx = fmt(currentRoutes.junctionX[q] ?? 0)
      const jy = fmt(currentRoutes.junctionY[q] ?? 0)
      lines.push(`<circle cx="${jx}" cy="${jy}" r="${fmt(3.2 * sw)}" fill="#fff" stroke-width="${fmt(0.6 * sw)}"/>`)
      if (o.detail === 'rich') {
        lines.push(`<path d="${legA}" stroke="transparent" stroke-width="${fmt(14 * sw)}" fill="none"/>`)
        lines.push(`<path d="${legB}" stroke="transparent" stroke-width="${fmt(14 * sw)}" fill="none"/>`)
        lines.push(`<path d="${stem}" stroke="transparent" stroke-width="${fmt(14 * sw)}" fill="none"/>`)
      }
    }
    lines.push('</g>')
  }

  if (o.syzygies) {
    lines.push(
      `<g class="syzygies" stroke="#e8e8e8" stroke-linecap="round" stroke-width="${fmt(2 * sw)}" ` +
        `stroke-dasharray="0.1 ${fmt(10 * sw)}" opacity="0.55">`,
    )
    const P = g.pairCount
    for (let q = 0; q < P; q++) {
      const info = g.pair(q)
      const x1 = layout.x[info.lo] ?? 0
      const y1 = layout.y[info.lo] ?? 0
      const x2 = layout.x[info.hi] ?? 0
      const y2 = layout.y[info.hi] ?? 0
      const rLo = layout.nodeRadii?.[info.lo] ?? r
      const rHi = layout.nodeRadii?.[info.hi] ?? r
      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.hypot(dx, dy)
      if (dist <= 2 * r) {
        lines.push(`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`)
      } else {
        const ux = dx / dist
        const uy = dy / dist
        const sx = x1 + ux * rLo
        const sy = y1 + uy * rLo
        const ex = x2 - ux * rHi
        const ey = y2 - uy * rHi
        lines.push(`<line x1="${fmt(sx)}" y1="${fmt(sy)}" x2="${fmt(ex)}" y2="${fmt(ey)}"/>`)
      }
    }
    lines.push('</g>')
  }

  for (const z of layout.drawOrder) {
    const cycle = g.cycleOfZone(z)
    const clr = groupColour(cycle.kind, cycle.torqueIndex)
    const cx = layout.x[z] ?? 0
    const cy = layout.y[z] ?? 0
    const radius = layout.nodeRadii?.[z] ?? r
    lines.push('<g class="zone">')
    lines.push(
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius)}" fill="${clr}" fill-opacity="0.12" ` +
        `stroke="${clr}" stroke-opacity="0.6" stroke-width="${fmt(0.9 * sw)}"/>`,
    )
    if (o.labels === 'all') {
      lines.push(
        `<text class="zl" x="${fmt(cx)}" y="${fmt(cy + 1)}" text-anchor="middle" dominant-baseline="central" ` +
          `font-size="${fmt(fs)}" font-weight="bold" fill="${clr}">${escapeXml(formatNumeral(z, n))}</text>`,
      )
    }
    if (o.detail === 'rich') {
      const dotY = cy + radius + 0.3 * fs
      lines.push(`<circle cx="${fmt(cx)}" cy="${fmt(dotY)}" r="${fmt(0.12 * radius)}" fill="${clr}"/>`)
      const tw = 0.35 * radius
      const th = 0.3 * radius
      const ty = cy - radius - 0.2 * fs
      lines.push(
        `<polygon points="${fmt(cx - tw)},${fmt(ty)} ${fmt(cx + tw)},${fmt(ty)} ${fmt(cx)},${fmt(ty - th)}" fill="${clr}"/>`,
      )
    }
    lines.push('</g>')
  }

  if (o.gateLabels && o.gates === 'on' && gateRoutes !== null) {
    lines.push(
      '<g class="gate-labels" font-size="' +
        fmt(0.4 * fs) +
        '" fill="#cc44ff" text-anchor="middle" dominant-baseline="central" font-style="italic" opacity="0.7">',
    )
    for (let z = 0; z < n; z++) {
      const x = fmt(gateRoutes.labelX[z] ?? 0)
      const y = fmt(gateRoutes.labelY[z] ?? 0)
      const name = formatGateName(g.gate(z).cumulation, n)
      lines.push(`<text class="gl" x="${x}" y="${y}">${escapeXml(name)}</text>`)
    }
    lines.push('</g>')
  }

  lines.push('</svg>')
  return lines.join('\n')
}

/**
 * The syzygy-collapsed pair-graph layout (D-08) turned into the same kind of SVG string: one pill per pair labelled
 * `hi::lo` in the numogram's own base, the anticlockwise current arcs around each Torque ring and the Plex/Warp self
 * loops from `routePairGraph`.
 */
export function pairGraphToSvg(
  g: Numogram,
  pg: PairGraphLayout,
  opts: Pick<SvgOptions, 'title' | 'embed' | 'background' | 'labels'> = {},
): string {
  const o = resolveOptions(opts)
  const sw = pg.strokeScale
  const n = pg.base
  const P = n / 2

  const lines: string[] = []
  lines.push(svgOpenTag(pg.width, pg.height, o.embed))
  if (o.title !== undefined) lines.push(`<title>${escapeXml(o.title)}</title>`)
  lines.push(defsBlock())
  const bg = backgroundLine(pg.width, pg.height, o.background)
  if (bg !== null) lines.push(bg)
  lines.push(regionLabelsBlock(pg.regionLabels))

  const routes = routePairGraph(g, pg)
  lines.push(`<g class="currents" fill="none" stroke="#22ee66" stroke-width="${fmt(1.4 * sw)}" opacity="0.85">`)
  for (let q = 0; q < P; q++) {
    const arc = routes.arc[q] ?? null
    if (arc !== null) lines.push(`<path d="${arc}" marker-end="url(#ac)"/>`)
    const loop = routes.loop[q] ?? null
    if (loop !== null) lines.push(`<path d="${loop}" marker-end="url(#ac)"/>`)
  }
  lines.push('</g>')

  for (let q = 0; q < P; q++) {
    const cycle = g.cycleOfPair(q)
    const clr = groupColour(cycle.kind, cycle.torqueIndex)
    const cx = pg.px[q] ?? 0
    const cy = pg.py[q] ?? 0
    const W = pg.nodeWidth
    const H = pg.nodeHeight
    lines.push('<g class="zone">')
    lines.push(
      `<rect x="${fmt(cx - W / 2)}" y="${fmt(cy - H / 2)}" width="${fmt(W)}" height="${fmt(H)}" rx="${fmt(H / 2)}" ` +
        `fill="${clr}" fill-opacity="0.12" stroke="${clr}" stroke-opacity="0.6" stroke-width="${fmt(0.9 * sw)}"/>`,
    )
    if (o.labels === 'all') {
      const text = formatNetSpan(n - 1 - q, q, n)
      lines.push(
        `<text class="zl" x="${fmt(cx)}" y="${fmt(cy + 1)}" text-anchor="middle" dominant-baseline="central" ` +
          `font-size="${fmt(pg.labelSize)}" font-weight="bold" fill="${clr}">${escapeXml(text)}</text>`,
      )
    }
    lines.push('</g>')
  }

  lines.push('</svg>')
  return lines.join('\n')
}

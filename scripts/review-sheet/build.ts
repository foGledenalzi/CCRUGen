// The layout contact sheet (D-10, LAY-01/LAY-03/LAY-04): a pure, deterministic HTML string builder with no file I/O.
// Renders every review base's ring, ladder, Barker-spiral and pair-graph layouts as self-contained, zoomable SVG,
// plus the packer alternative for bases with 4 or more Torque cycles (D-03) and the "Warp above" capsule variant for
// base 28 (D-02), so the user can judge overlap, clipping and scale (LAY-03) and settle both taste calls. The CLI
// wrapper that writes this to disk is ../review-sheet.ts.
//
// Trust boundary (T-03-22, T-03-23): every free-text label reaching the page goes through the emitter's own
// escapeXml (title, region labels) or is one of this file's own literal strings; nothing here embeds a network
// reference or reads outside the engine, so the sheet stays fully self-contained and branding-free.

import {
  createNumogram,
  DEFAULT_LAYOUT_PARAMS,
  escapeXml,
  fmt,
  gateLayerMode,
  ladderLayout,
  layoutToSvg,
  PACKERS,
  pairGraphLayout,
  pairGraphToSvg,
  ringLayout,
  spiralLayout,
  TIER_TABLE,
} from '../../engine/index'
import type { Layout, Numogram, Packer } from '../../engine/index'

/** The roadmap's review-sheet bases (D-10, ROADMAP Phase 3 success criterion 3). */
export const REVIEW_BASES = [2, 4, 6, 8, 12, 16, 28, 64, 82, 100] as const

const DEFAULT_PACKER: Packer = DEFAULT_LAYOUT_PARAMS.packer
const OTHER_PACKER: Packer = PACKERS.find(p => p !== DEFAULT_PACKER) ?? DEFAULT_PACKER

/** One `<figure>`: caption with frame/scale/node-radius, and a `.vp` viewport div carrying `data-r` for the LOD script. */
function figureHtml(name: string, layout: Pick<Layout, 'width' | 'height' | 'scale'>, svg: string, r: number): string {
  const caption =
    escapeXml(name) +
    ': frame ' +
    fmt(layout.width) +
    'x' +
    fmt(layout.height) +
    ', scale ' +
    fmt(layout.scale) +
    ', node r ' +
    fmt(r)
  return '<figure><figcaption>' + caption + '</figcaption><div class="vp" data-r="' + fmt(r) + '">' + svg + '</div></figure>'
}

/** A zone layout (ring/ladder/spiral) rendered through the emitter with the tier table's own gate density and labels. */
function zoneFigureHtml(g: Numogram, layout: Layout, name: string, gateMode: 'on' | 'thin' | 'off'): string {
  const svg = layoutToSvg(g, layout, {
    gates: gateMode,
    gateLabels: gateMode === 'on',
    embed: true,
    title: 'base ' + g.base + ' ' + name,
  })
  return figureHtml(name, layout, svg, layout.nodeRadius)
}

function baseSection(n: number): string {
  const g = createNumogram(n)
  const gateMode = gateLayerMode(n, TIER_TABLE)
  const figures: string[] = []

  const ringDefault = ringLayout(g)
  figures.push(zoneFigureHtml(g, ringDefault, `ring (${DEFAULT_PACKER} packer)`, gateMode))

  if (g.torqueCount >= 4) {
    const ringOther = ringLayout(g, { packer: OTHER_PACKER })
    figures.push(zoneFigureHtml(g, ringOther, `ring (${OTHER_PACKER} packer)`, gateMode))
  }

  if (n === 28) {
    const ringWarpAbove = ringLayout(g, { capsulePlacement: 'above' })
    figures.push(zoneFigureHtml(g, ringWarpAbove, 'ring, Warp above', gateMode))
  }

  const ladder = ladderLayout(g)
  figures.push(zoneFigureHtml(g, ladder, 'ladder', gateMode))

  const spiral = spiralLayout(g)
  figures.push(zoneFigureHtml(g, spiral, 'Barker spiral', gateMode))

  const pg = pairGraphLayout(g)
  const pgSvg = pairGraphToSvg(g, pg, { embed: true, title: 'base ' + n + ' pair graph' })
  figures.push(figureHtml('pair graph', pg, pgSvg, pg.nodeHeight / 2))

  const lengths = g.torques.map(t => t.lengthInPairs)
  const lengthsText = lengths.length > 0 ? lengths.join(',') + ' pairs' : 'none'
  const warpText = g.warp !== null ? 'yes' : 'no'
  const heading = `Base ${n}: ${n} zones, ${g.torqueCount} Torque cycle(s) [${lengthsText}], Warp ${warpText}`

  return `<section id="b${n}"><h2>${escapeXml(heading)}</h2><div class="row">${figures.join('\n')}</div></section>`
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px 20px 48px; background: #060609; color: #ccd; font-family: monospace; }
nav { position: sticky; top: 0; z-index: 10; background: #0a0a10; border-bottom: 1px solid #223; padding: 8px 4px; margin: -16px -20px 20px; }
nav a { color: #8ad8ff; text-decoration: none; margin-right: 10px; font-size: 12px; }
nav a:hover { text-decoration: underline; }
nav button { background: #182230; color: #ccd; border: 1px solid #445; border-radius: 3px; padding: 3px 10px; font-family: monospace; cursor: pointer; }
h2 { font-size: 13px; font-weight: normal; color: #9ad; border-top: 1px solid #223; padding-top: 14px; margin: 22px 0 10px; }
section:first-of-type h2 { border-top: none; }
section { scroll-margin-top: 48px; }
.row { display: flex; flex-wrap: wrap; gap: 14px; }
figure { margin: 0; width: calc(50% - 7px); min-width: 320px; }
figcaption { font-size: 11px; color: #889; margin-bottom: 4px; }
.vp { height: 560px; overflow: hidden; cursor: grab; border: 1px solid #223; background: #060609; touch-action: none; }
.vp svg { width: 100%; height: 100%; display: block; }
.hl .zl, .hl .gl { display: none; }
`

const SCRIPT = `
(function () {
  var TH = ${fmt(TIER_TABLE.boundaries.labelVisibleMinRadiusPx)};
  var vps = Array.prototype.slice.call(document.querySelectorAll('.vp'));
  var resets = [];
  vps.forEach(function (vp) {
    var svg = vp.querySelector('svg');
    if (!svg) return;
    var vb = svg.viewBox.baseVal;
    var init = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    var r = parseFloat(vp.getAttribute('data-r')) || 0;
    function lod() {
      var scale = Math.min(vp.clientWidth / vb.width, vp.clientHeight / vb.height);
      vp.classList.toggle('hl', r * scale < TH);
    }
    function reset() {
      vb.x = init.x; vb.y = init.y; vb.width = init.w; vb.height = init.h;
      lod();
    }
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 0.8 : 1.25;
      var rect = vp.getBoundingClientRect();
      var mx = vb.x + ((e.clientX - rect.left) / rect.width) * vb.width;
      var my = vb.y + ((e.clientY - rect.top) / rect.height) * vb.height;
      vb.x = mx - (mx - vb.x) * factor;
      vb.y = my - (my - vb.y) * factor;
      vb.width *= factor;
      vb.height *= factor;
      lod();
    }, { passive: false });
    var dragging = false, lastX = 0, lastY = 0;
    vp.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      vp.setPointerCapture(e.pointerId); vp.style.cursor = 'grabbing';
    });
    vp.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var rect = vp.getBoundingClientRect();
      vb.x -= (e.clientX - lastX) * (vb.width / rect.width);
      vb.y -= (e.clientY - lastY) * (vb.height / rect.height);
      lastX = e.clientX; lastY = e.clientY;
    });
    vp.addEventListener('pointerup', function (e) {
      dragging = false; vp.style.cursor = 'grab';
      try { vp.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    vp.addEventListener('dblclick', reset);
    resets.push(reset);
    lod();
  });
  var resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.addEventListener('click', function () { resets.forEach(function (fn) { fn(); }); });
})();
`

/**
 * The full contact sheet: one self-contained HTML document, no network access, no dependencies, no upstream
 * branding, deterministic (same output every call, so two runs of the CLI print the same sha256).
 */
export function buildReviewSheet(): string {
  const sections = REVIEW_BASES.map(n => baseSection(n)).join('\n')
  const nav = '<nav>' + REVIEW_BASES.map(n => `<a href="#b${n}">b${n}</a>`).join(' ') + ' <button id="reset">reset all</button></nav>'

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>CCRUG layout review</title>',
    '<style>' + STYLE + '</style>',
    '</head>',
    '<body>',
    nav,
    sections,
    '<script>' + SCRIPT + '</script>',
    '</body>',
    '</html>',
  ].join('\n')
}

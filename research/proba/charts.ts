// Couche probabiliste · graphiques SVG statiques du rapport, sans dépendance, avec les classes CSS
// des rapports de recherche (research/shock/portfolio-html.ts) : couleurs en variables CSS, traits
// fins, grille discrète, texte aux couleurs d'encre, infobulle <title> sur chaque marque.

import { linearTicks } from '../lib/svg.ts'
import type { BinRow } from './metrics.ts'

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f1 = (x: number) => (Math.round(x * 10) / 10).toString()
const mi = (s: string) => s.replace(/^-/, '−')
/** Virgule décimale (rapport en français). */
export const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
export type Fmt = (v: number) => string
export const fmtPct: Fmt = v => fr(mi(`${Math.round(v * 1000) / 10} %`))
export const fmtNum = (d: number): Fmt => v => fr(mi(v.toFixed(d)))

function legend(series: { name: string; color: string }[], kind: 'line' | 'rect' | 'dot') {
  if (series.length < 2) return ''
  return `<div class="legend">${series.map(s => `<span><i class="key ${kind === 'dot' ? 'rect dotkey' : kind}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`
}

/** Histogramme d'un échantillon (une couleur), valeurs hors bornes regroupées dans les classes extrêmes. */
export function histPanel(o: { values: number[]; lo: number; hi: number; nb: number; title: string; color: string; fmt: Fmt; note?: string; width?: number }) {
  const c = new Array<number>(o.nb).fill(0)
  const step = (o.hi - o.lo) / o.nb
  for (const v of o.values) if (Number.isFinite(v)) c[Math.max(0, Math.min(o.nb - 1, Math.floor((v - o.lo) / step)))]++
  const share = c.map(k => k / o.values.length)
  const top = Math.max(...share)
  const Wd = o.width ?? 250, H = 190, m = { l: 36, r: 8, t: 26, b: 24 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const yt = linearTicks(0, top, 3)
  const ymax = Math.max(top, yt[yt.length - 1])
  const yy = (v: number) => m.t + ph - (v / ymax) * ph
  const xx = (v: number) => m.l + ((v - o.lo) / (o.hi - o.lo)) * pw
  const p: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(o.title)}"><text class="paneltitle" x="${m.l}" y="14">${esc(o.title)}</text>`]
  for (const v of yt) p.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(yy(v))}" y2="${f1(yy(v))}"/><text class="tick" x="${m.l - 5}" y="${f1(yy(v) + 4)}" text-anchor="end">${Math.round(v * 100)} %</text>`)
  share.forEach((s, i) => {
    if (!s) return
    const x0 = xx(o.lo + i * step) + 1, w = Math.max(xx(o.lo + (i + 1) * step) - xx(o.lo + i * step) - 2, 1)
    p.push(`<rect class="bar" x="${f1(x0)}" y="${f1(yy(s))}" width="${f1(w)}" height="${f1(yy(0) - yy(s))}" style="fill:${o.color}"><title>${esc(`${o.fmt(o.lo + i * step)} à ${o.fmt(o.lo + (i + 1) * step)} : ${(s * 100).toFixed(1)} % (${c[i]})`)}</title></rect>`)
  })
  for (const v of linearTicks(o.lo, o.hi, 4)) p.push(`<text class="tick" x="${f1(xx(v))}" y="${H - 7}" text-anchor="middle">${o.fmt(v)}</text>`)
  p.push(`<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${f1(yy(0))}" y2="${f1(yy(0))}"/></svg>`)
  return `<figure class="panel">${p.join('')}${o.note ? `<figcaption>${esc(o.note)}</figcaption>` : ''}</figure>`
}

/** Colonnes groupées, base à zéro, valeurs négatives possibles. */
export function columns(o: { cats: string[]; series: { name: string; color: string; y: number[] }[]; fmt: Fmt; title: string; height?: number; width?: number }) {
  const Wd = o.width ?? 760, H = o.height ?? 260
  const m = { l: 56, r: 12, t: 12, b: 28 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const all = o.series.flatMap(s => s.y.filter(Number.isFinite))
  const yt = linearTicks(Math.min(0, ...all), Math.max(0, ...all), 5)
  const lo = Math.min(yt[0], 0, ...all), hi = Math.max(yt[yt.length - 1], 0, ...all)
  const y = (v: number) => m.t + ph - ((v - lo) / (hi - lo)) * ph
  const band = pw / o.cats.length
  const ns = o.series.length
  const bw = Math.min(24, (band * 0.7 - 2 * (ns - 1)) / ns)
  const gw = bw * ns + 2 * (ns - 1)
  const p: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(o.title)}">`]
  for (const v of yt) p.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${o.fmt(v)}</text>`)
  o.cats.forEach((c, i) => {
    const gx = m.l + band * i + (band - gw) / 2
    o.series.forEach((s, k) => {
      const v = s.y[i]
      if (!Number.isFinite(v)) return
      const bx = gx + k * (bw + 2), top = y(Math.max(v, 0)), bot = y(Math.min(v, 0))
      const h = Math.max(bot - top, 0.5), r = Math.min(4, h, bw / 2)
      const d = v >= 0
        ? `M${f1(bx)} ${f1(bot)}V${f1(top + r)}Q${f1(bx)} ${f1(top)} ${f1(bx + r)} ${f1(top)}H${f1(bx + bw - r)}Q${f1(bx + bw)} ${f1(top)} ${f1(bx + bw)} ${f1(top + r)}V${f1(bot)}Z`
        : `M${f1(bx)} ${f1(top)}V${f1(bot - r)}Q${f1(bx)} ${f1(bot)} ${f1(bx + r)} ${f1(bot)}H${f1(bx + bw - r)}Q${f1(bx + bw)} ${f1(bot)} ${f1(bx + bw)} ${f1(bot - r)}V${f1(top)}Z`
      p.push(`<path class="bar" tabindex="0" style="fill:${s.color}" d="${d}"><title>${esc(`${c} · ${s.name} : ${o.fmt(v)}`)}</title></path>`)
    })
    p.push(`<text class="tick" x="${f1(m.l + band * i + band / 2)}" y="${H - 8}" text-anchor="middle">${esc(c)}</text>`)
  })
  p.push(`<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(0))}" y2="${f1(y(0))}"/></svg>`)
  return `${legend(o.series, 'rect')}<div class="chartbox">${p.join('')}</div>`
}

/** Calibration : prévision moyenne (x) contre fréquence observée (y) par groupe, Wilson 95 %, diagonale. */
export function calibPlot(o: { series: { name: string; color: string; bins: BinRow[] }[]; lim: [number, number]; title: string }) {
  const S = 420, m = { l: 52, r: 14, t: 12, b: 42 }
  const pw = S - m.l - m.r, ph = S - m.t - m.b
  const [a, b] = o.lim
  const sx = (v: number) => m.l + ((Math.max(a, Math.min(b, v)) - a) / (b - a)) * pw
  const sy = (v: number) => m.t + ph - ((Math.max(a, Math.min(b, v)) - a) / (b - a)) * ph
  const t = linearTicks(a, b, 5)
  const p: string[] = [`<svg viewBox="0 0 ${S} ${S}" class="chart scatter" role="img" aria-label="${esc(o.title)}">`]
  for (const v of t) p.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(sy(v))}" y2="${f1(sy(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(sy(v) + 4)}" text-anchor="end">${fmtPct(v)}</text><line class="grid" y1="${m.t}" y2="${m.t + ph}" x1="${f1(sx(v))}" x2="${f1(sx(v))}"/><text class="tick" y="${m.t + ph + 16}" x="${f1(sx(v))}" text-anchor="middle">${fmtPct(v)}</text>`)
  p.push(`<line class="ref" x1="${f1(sx(a))}" y1="${f1(sy(a))}" x2="${f1(sx(b))}" y2="${f1(sy(b))}"/>`)
  o.series.forEach((s, k) => {
    const dx = (k - (o.series.length - 1) / 2) * 3
    for (const r of s.bins) {
      const x = sx(r.meanPred) + dx
      p.push(`<line class="whisk" x1="${f1(x)}" x2="${f1(x)}" y1="${f1(sy(r.lo))}" y2="${f1(sy(r.hi))}" style="stroke:${s.color}"/>`)
      p.push(`<circle class="dot hit" tabindex="0" cx="${f1(x)}" cy="${f1(sy(r.observed))}" r="4.5" style="fill:${s.color}"><title>${esc(`${s.name} · groupe ${r.bin} (n = ${r.n}) : prévu ${fmtPct(r.meanPred)}, observé ${fmtPct(r.observed)} [${fmtPct(r.lo)} ; ${fmtPct(r.hi)}]`)}</title></circle>`)
    }
  })
  p.push(`<text class="axlabel" x="${m.l + pw / 2}" y="${S - 6}" text-anchor="middle">probabilité prévue (moyenne du groupe)</text><text class="axlabel" transform="translate(13 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">fréquence observée</text></svg>`)
  return `${legend(o.series, 'dot')}<div class="chartbox scatterbox">${p.join('')}</div>`
}

/** Estimations et intervalles (une ligne par estimation), ligne de référence verticale. */
export function forest(o: { rows: { label: string; est: number; lo: number; hi: number; strong?: boolean }[]; fmt: Fmt; title: string; ref?: number; color?: string; labelW?: number }) {
  const Wd = 760, rowH = 26, m = { l: o.labelW ?? 300, r: 70, t: 10, b: 28 }
  const H = m.t + m.b + rowH * o.rows.length
  const pw = Wd - m.l - m.r
  const ref = o.ref ?? 0
  const vals = o.rows.flatMap(r => [r.lo, r.hi, r.est]).filter(Number.isFinite)
  const t = linearTicks(Math.min(ref, ...vals), Math.max(ref, ...vals), 5)
  const lo = Math.min(t[0], ...vals), hi = Math.max(t[t.length - 1], ...vals)
  const x = (v: number) => m.l + ((v - lo) / (hi - lo)) * pw
  const col = o.color ?? 'var(--s1)'
  const p: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(o.title)}">`]
  for (const v of t) p.push(`<line class="grid" x1="${f1(x(v))}" x2="${f1(x(v))}" y1="${m.t}" y2="${H - m.b}"/><text class="tick" x="${f1(x(v))}" y="${H - 8}" text-anchor="middle">${o.fmt(v)}</text>`)
  p.push(`<line class="ref" x1="${f1(x(ref))}" x2="${f1(x(ref))}" y1="${m.t}" y2="${H - m.b}"/>`)
  o.rows.forEach((r, i) => {
    const cy = m.t + rowH * i + rowH / 2
    p.push(`<text class="${r.strong ? 'flabel strong' : 'flabel'}" x="${m.l - 10}" y="${f1(cy + 4)}" text-anchor="end">${esc(r.label)}</text>`)
    if (Number.isFinite(r.lo) && Number.isFinite(r.hi)) p.push(`<line class="ci" x1="${f1(x(r.lo))}" x2="${f1(x(r.hi))}" y1="${f1(cy)}" y2="${f1(cy)}" style="stroke:${col}"/>`)
    p.push(`<circle class="dot hit" tabindex="0" cx="${f1(x(r.est))}" cy="${f1(cy)}" r="4.5" style="fill:${col}"><title>${esc(`${r.label} : ${o.fmt(r.est)} [${o.fmt(r.lo)} ; ${o.fmt(r.hi)}]`)}</title></circle>`)
    p.push(`<text class="tick" x="${Wd - 4}" y="${f1(cy + 4)}" text-anchor="end">${o.fmt(r.est)}</text>`)
  })
  p.push('</svg>')
  return `<div class="chartbox">${p.join('')}</div>`
}

/** Petits multiples : une courbe par variable sur les plis, ligne zéro. */
export function coefPanels(o: { names: string[]; x: string[]; values: number[][]; title: string; color: string }) {
  const all = o.values.flat().filter(Number.isFinite)
  const L = Math.max(0.05, ...all.map(Math.abs))
  const Wd = 250, H = 150, m = { l: 40, r: 8, t: 22, b: 22 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const yy = (v: number) => m.t + ph / 2 - (v / L) * (ph / 2)
  const n = o.x.length
  const xx = (i: number) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const t = linearTicks(-L, L, 2)
  const panels = o.names.map((name, k) => {
    const p: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(`${o.title} : ${name}`)}"><text class="paneltitle" x="${m.l}" y="14">${esc(name)}</text>`]
    for (const v of t) p.push(`<line class="${v === 0 ? 'axis' : 'grid'}" x1="${m.l}" x2="${m.l + pw}" y1="${f1(yy(v))}" y2="${f1(yy(v))}"/><text class="tick" x="${m.l - 5}" y="${f1(yy(v) + 4)}" text-anchor="end">${fr(mi(v.toFixed(2)))}</text>`)
    const d = o.values[k].map((v, i) => `${i ? 'L' : 'M'}${f1(xx(i))} ${f1(yy(v))}`).join('')
    p.push(`<path class="ln" style="stroke:${o.color}" d="${d}"/>`)
    o.values[k].forEach((v, i) => p.push(`<circle class="dot sm" cx="${f1(xx(i))}" cy="${f1(yy(v))}" r="2.5" style="fill:${o.color}"><title>${esc(`${name} · ${o.x[i]} : ${fr(mi(v.toFixed(3)))}`)}</title></circle>`))
    p.push(`<text class="tick" x="${m.l}" y="${H - 6}">${esc(o.x[0])}</text><text class="tick" x="${m.l + pw}" y="${H - 6}" text-anchor="end">${esc(o.x[n - 1])}</text></svg>`)
    return `<figure class="panel">${p.join('')}</figure>`
  })
  return `<div class="panels">${panels.join('')}</div>`
}

/** Courbe sur des jours (numéros de jour UTC), une série, ligne zéro, infobulle sur une grille de points. */
export function dayLine(o: { x: number[]; y: number[]; title: string; color: string; fmt: Fmt; height?: number }) {
  const Wd = 760, H = o.height ?? 240, m = { l: 56, r: 16, t: 12, b: 26 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const yt = linearTicks(Math.min(0, ...o.y), Math.max(0, ...o.y), 5)
  const lo = Math.min(yt[0], ...o.y), hi = Math.max(yt[yt.length - 1], ...o.y)
  const y = (v: number) => m.t + ph - ((v - lo) / (hi - lo)) * ph
  const x0 = o.x[0], x1 = o.x[o.x.length - 1]
  const x = (d: number) => m.l + ((d - x0) / (x1 - x0)) * pw
  const p: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(o.title)}">`]
  for (const v of yt) p.push(`<line class="${v === 0 ? 'axis' : 'grid'}" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${o.fmt(v)}</text>`)
  const DAY = 864e5
  for (let yr = new Date(x0 * DAY).getUTCFullYear(); yr <= new Date(x1 * DAY).getUTCFullYear() + 1; yr++) {
    const d = Date.UTC(yr, 0, 1) / DAY
    if (d < x0 || d > x1) continue
    p.push(`<line class="grid" x1="${f1(x(d))}" x2="${f1(x(d))}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${f1(x(d))}" y="${H - 8}" text-anchor="middle">${yr}</text>`)
  }
  p.push(`<path class="ln" style="stroke:${o.color}" d="${o.y.map((v, i) => `${i ? 'L' : 'M'}${f1(x(o.x[i]))} ${f1(y(v))}`).join('')}"/>`)
  // Points de survol tous les ~30 jours.
  for (let i = 0; i < o.x.length; i += Math.max(1, Math.floor(o.x.length / 70))) {
    p.push(`<circle class="hover" cx="${f1(x(o.x[i]))}" cy="${f1(y(o.y[i]))}" r="6"><title>${esc(`${new Date(o.x[i] * DAY).toISOString().slice(0, 10)} : ${o.fmt(o.y[i])}`)}</title></circle>`)
  }
  p.push('</svg>')
  return `<div class="chartbox">${p.join('')}</div>`
}

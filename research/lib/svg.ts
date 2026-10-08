// Graphiques SVG statiques pour les rapports HTML de recherche, sans dépendance. Les couleurs sont
// des variables CSS (--s1, --s2, … définies par la page, clair et sombre) ; les textes portent les
// couleurs d'encre, jamais celle d'une série. Les courbes embarquent leurs données (JSON) pour le
// curseur et l'infobulle ajoutés par le script de la page.

const W = 760
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f1 = (x: number) => (Math.round(x * 10) / 10).toString()
/** Vrai signe moins (U+2212) dans les textes affichés. */
const mi = (s: string) => s.replace(/^-/, '\u2212')
const DAY = 864e5

export interface Series { name: string; color: string; y: number[] }

function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target)
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
}
export function linearTicks(lo: number, hi: number, target = 5) {
  const st = niceStep(hi - lo, target)
  const out: number[] = []
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v)
  return out
}
function logTicks(lo: number, hi: number) {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v) }
  return out.length > 9 ? out.filter(v => /^1/.test(String(v))) : out
}

/** Courbes sur un axe de jours (numéros de jour UTC), une seule échelle verticale. */
export function lineChart(o: {
  id: string; x: number[]; series: Series[]; fmt: 'pct' | 'num' | 'idx'; log?: boolean; height?: number
  yMin?: number; yMax?: number; refs?: { y: number; label: string }[]; area?: number; endLabels?: boolean; title: string
}) {
  const H = o.height ?? 300
  const m = { l: 56, r: o.endLabels === false ? 16 : 96, t: 14, b: 26 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const all = o.series.flatMap(s => s.y.filter(Number.isFinite))
  let lo = o.yMin ?? Math.min(...all), hi = o.yMax ?? Math.max(...all)
  for (const r of o.refs ?? []) { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y) }
  if (o.log) { lo = Math.max(lo, 1e-9) } else { const pad = (hi - lo) * 0.04; if (o.yMin === undefined) lo -= pad; if (o.yMax === undefined) hi += pad }
  const tf = (v: number) => (o.log ? Math.log(v) : v)
  const y = (v: number) => m.t + ph - ((tf(v) - tf(lo)) / (tf(hi) - tf(lo))) * ph
  const x0 = o.x[0], x1 = o.x[o.x.length - 1]
  const x = (d: number) => m.l + ((d - x0) / (x1 - x0)) * pw
  const fmt = (v: number) => mi(o.fmt === 'pct' ? `${Math.round(v * 100)}%` : o.fmt === 'idx' ? (v >= 1000 ? `${Math.round(v).toLocaleString('en-US')}` : `${+v.toPrecision(3)}`) : v.toFixed(1))
  const yt = o.log ? logTicks(lo, hi) : linearTicks(lo, hi, 5)
  const parts: string[] = []
  parts.push(`<svg viewBox="0 0 ${W} ${H}" class="chart line" role="img" aria-label="${esc(o.title)}" data-chart="${o.id}" data-pl="${m.l}" data-pw="${pw}" data-w="${W}">`)
  for (const v of yt) parts.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${fmt(v)}</text>`)
  const y0 = new Date(x0 * DAY).getUTCFullYear(), y1 = new Date(x1 * DAY).getUTCFullYear()
  for (let yr = y0; yr <= y1 + 1; yr++) {
    const d = Date.UTC(yr, 0, 1) / DAY
    if (d < x0 || d > x1) continue
    parts.push(`<line class="grid" x1="${f1(x(d))}" x2="${f1(x(d))}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${f1(x(d))}" y="${H - 8}" text-anchor="middle">${yr}</text>`)
  }
  for (const r of o.refs ?? []) parts.push(`<line class="ref" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(r.y))}" y2="${f1(y(r.y))}"/>${r.label ? `<text class="reflabel" x="${m.l + 6}" y="${f1(y(r.y) - 5)}">${esc(r.label)}</text>` : ''}`)
  o.series.forEach((s, k) => {
    let d = '', pen = false
    s.y.forEach((v, i) => { if (!Number.isFinite(v)) { pen = false; return } d += `${pen ? 'L' : 'M'}${f1(x(o.x[i]))} ${f1(y(Math.max(v, lo)))}`; pen = true })
    if (o.area !== undefined && k === o.series.length - 1) {
      const fy = f1(y(o.area))
      const first = s.y.findIndex(Number.isFinite)
      parts.push(`<path class="area" style="fill:${s.color}" d="${d}L${f1(x(o.x[o.x.length - 1]))} ${fy}L${f1(x(o.x[first]))} ${fy}Z"/>`)
    }
    parts.push(`<path class="ln" style="stroke:${s.color}" d="${d}"/>`)
  })
  if (o.endLabels !== false) {
    const ends = o.series.map(s => { let i = s.y.length - 1; while (i > 0 && !Number.isFinite(s.y[i])) i--; return { s, v: s.y[i], py: y(s.y[i]) } }).sort((a, b) => a.py - b.py)
    const clear = ends.every((e, i) => i === 0 || e.py - ends[i - 1].py >= 14)
    for (const e of ends) {
      parts.push(`<circle class="dot" cx="${f1(m.l + pw)}" cy="${f1(e.py)}" r="4" style="fill:${e.s.color}"/>`)
      if (clear) parts.push(`<text class="endlabel" x="${m.l + pw + 9}" y="${f1(e.py + 4)}">${esc(e.s.name)} ${fmt(e.v)}</text>`)
    }
  }
  parts.push(`<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}"/>`)
  parts.push(`<line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>`)
  parts.push('</svg>')
  const data = { x: o.x, fmt: o.fmt, series: o.series.map(s => ({ name: s.name, color: s.color, y: s.y.map(v => (Number.isFinite(v) ? +v.toPrecision(5) : null)) })) }
  return `${legend(o.series, 'line')}<div class="chartbox">${parts.join('')}<div class="tip" hidden></div></div><script type="application/json" id="data-${o.id}">${JSON.stringify(data)}</script>`
}

export function legend(series: { name: string; color: string }[], kind: 'line' | 'rect') {
  if (series.length < 2) return ''
  return `<div class="legend">${series.map(s => `<span><i class="key ${kind}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`
}

/** Colonnes groupées (une couleur par série), base à zéro, extrémité arrondie côté donnée. */
export function groupedBars(o: { cats: string[]; series: Series[]; title: string; height?: number }) {
  const H = o.height ?? 280
  const m = { l: 56, r: 16, t: 14, b: 28 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const all = o.series.flatMap(s => s.y)
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all)
  const yt = linearTicks(lo, hi, 5)
  const ylo = Math.min(lo, yt[0]), yhi = Math.max(hi, yt[yt.length - 1])
  const y = (v: number) => m.t + ph - ((v - ylo) / (yhi - ylo)) * ph
  const band = pw / o.cats.length
  const bw = Math.min(24, (band * 0.72 - 2 * (o.series.length - 1)) / o.series.length)
  const groupW = bw * o.series.length + 2 * (o.series.length - 1)
  const parts: string[] = [`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.title)}">`]
  for (const v of yt) parts.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${mi(`${Math.round(v * 100)}%`)}</text>`)
  o.cats.forEach((c, i) => {
    const gx = m.l + band * i + (band - groupW) / 2
    o.series.forEach((s, k) => {
      const v = s.y[i]
      const bx = gx + k * (bw + 2), top = y(Math.max(v, 0)), bot = y(Math.min(v, 0))
      const h = Math.max(bot - top, 0.5), r = Math.min(4, h, bw / 2)
      const d = v >= 0
        ? `M${f1(bx)} ${f1(bot)}V${f1(top + r)}Q${f1(bx)} ${f1(top)} ${f1(bx + r)} ${f1(top)}H${f1(bx + bw - r)}Q${f1(bx + bw)} ${f1(top)} ${f1(bx + bw)} ${f1(top + r)}V${f1(bot)}Z`
        : `M${f1(bx)} ${f1(top)}V${f1(bot - r)}Q${f1(bx)} ${f1(bot)} ${f1(bx + r)} ${f1(bot)}H${f1(bx + bw - r)}Q${f1(bx + bw)} ${f1(bot)} ${f1(bx + bw)} ${f1(bot - r)}V${f1(top)}Z`
      parts.push(`<path class="bar" tabindex="0" style="fill:${s.color}" d="${d}"><title>${esc(`${c} · ${s.name}: ${mi((v * 100).toFixed(1))}%`)}</title></path>`)
    })
    parts.push(`<text class="tick" x="${f1(m.l + band * i + band / 2)}" y="${H - 8}" text-anchor="middle">${esc(c)}</text>`)
  })
  parts.push(`<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${f1(y(0))}" y2="${f1(y(0))}"/></svg>`)
  return `${legend(o.series, 'rect')}<div class="chartbox">${parts.join('')}</div>`
}

/** Carte de chaleur divergente (bleu = positif, rouge = négatif, gris = zéro), valeurs dans les cases. */
export function heatmap(o: { rows: string[]; cols: string[]; v: (number | null)[][]; cap: number; title: string }) {
  const cw = 50, ch = 28, lw = 52, th = 22
  const Wd = lw + cw * o.cols.length, Hd = th + ch * o.rows.length
  const parts: string[] = [`<svg viewBox="0 0 ${Wd} ${Hd}" class="chart heat" role="img" aria-label="${esc(o.title)}">`]
  o.cols.forEach((c, j) => parts.push(`<text class="tick" x="${lw + cw * j + cw / 2}" y="${th - 8}" text-anchor="middle">${esc(c)}</text>`))
  o.rows.forEach((r, i) => {
    parts.push(`<text class="tick" x="${lw - 8}" y="${th + ch * i + ch / 2 + 4}" text-anchor="end">${esc(r)}</text>`)
    o.cols.forEach((c, j) => {
      const v = o.v[i][j]
      if (v === null || !Number.isFinite(v)) return
      const step = Math.min(5, Math.ceil((Math.abs(v) / o.cap) * 5))
      const cls = v === 0 ? 'h0' : `${v > 0 ? 'hp' : 'hn'}${step}`
      parts.push(`<g class="cell" tabindex="0"><rect class="${cls}" x="${lw + cw * j + 1}" y="${th + ch * i + 1}" width="${cw - 2}" height="${ch - 2}" rx="3"/><text class="hv ${step >= 3 ? 'inv' : ''}" x="${lw + cw * j + cw / 2}" y="${th + ch * i + ch / 2 + 4}" text-anchor="middle">${Math.abs(v * 100) < 0.05 ? '0.0' : mi((v * 100).toFixed(1))}</text><title>${esc(`${r} ${c}: ${mi((v * 100).toFixed(2))}%`)}</title></g>`)
    })
  })
  parts.push('</svg>')
  return `<div class="chartbox heatbox">${parts.join('')}</div>`
}

/** Nuage de points, une série ; valeurs hors cadre ramenées au bord (marquées). */
export function scatter(o: { x: number[]; y: number[]; color: string; lim: number; xLabel: string; yLabel: string; title: string; fit?: { a: number; b: number } }) {
  const H = 420, Wd = 460
  const m = { l: 56, r: 16, t: 14, b: 44 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const L = o.lim
  const sx = (v: number) => m.l + ((Math.max(-L, Math.min(L, v)) + L) / (2 * L)) * pw
  const sy = (v: number) => m.t + ph - ((Math.max(-L, Math.min(L, v)) + L) / (2 * L)) * ph
  const ticks = linearTicks(-L, L, 4)
  const parts: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart scatter" role="img" aria-label="${esc(o.title)}">`]
  for (const v of ticks) {
    parts.push(`<line class="${v === 0 ? 'axis' : 'grid'}" x1="${m.l}" x2="${m.l + pw}" y1="${f1(sy(v))}" y2="${f1(sy(v))}"/><text class="tick" x="${m.l - 8}" y="${f1(sy(v) + 4)}" text-anchor="end">${mi(`${Math.round(v * 100)}%`)}</text>`)
    parts.push(`<line class="${v === 0 ? 'axis' : 'grid'}" y1="${m.t}" y2="${m.t + ph}" x1="${f1(sx(v))}" x2="${f1(sx(v))}"/><text class="tick" y="${m.t + ph + 16}" x="${f1(sx(v))}" text-anchor="middle">${mi(`${Math.round(v * 100)}%`)}</text>`)
  }
  for (let i = 0; i < o.x.length; i++) {
    const out = Math.abs(o.x[i]) > L || Math.abs(o.y[i]) > L
    parts.push(`<circle class="pt${out ? ' clip' : ''}" cx="${f1(sx(o.x[i]))}" cy="${f1(sy(o.y[i]))}" r="2.6" style="fill:${o.color}"/>`)
  }
  if (o.fit) parts.push(`<line class="fit" x1="${f1(sx(-L))}" y1="${f1(sy(o.fit.a - o.fit.b * L))}" x2="${f1(sx(L))}" y2="${f1(sy(o.fit.a + o.fit.b * L))}"/>`)
  parts.push(`<text class="axlabel" x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle">${esc(o.xLabel)}</text><text class="axlabel" transform="translate(14 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">${esc(o.yLabel)}</text></svg>`)
  return `<div class="chartbox scatterbox">${parts.join('')}</div>`
}

/** Histogrammes en petits multiples, mêmes classes et même échelle. */
export function histograms(o: { series: Series[]; lo: number; hi: number; step: number; title: string; notes: string[] }) {
  const nb = Math.round((o.hi - o.lo) / o.step)
  const counts = o.series.map(s => {
    const c = new Array<number>(nb).fill(0)
    for (const v of s.y) c[Math.max(0, Math.min(nb - 1, Math.floor((v - o.lo) / o.step)))]++
    return c.map(k => k / s.y.length)
  })
  const top = Math.max(...counts.flat())
  const Wd = 250, H = 210, m = { l: 40, r: 8, t: 26, b: 26 }
  const pw = Wd - m.l - m.r, ph = H - m.t - m.b
  const yt = linearTicks(0, top, 3)
  const yy = (v: number) => m.t + ph - (v / yt[yt.length - 1]) * ph
  const xx = (v: number) => m.l + ((v - o.lo) / (o.hi - o.lo)) * pw
  const panels = o.series.map((s, k) => {
    const parts: string[] = [`<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" aria-label="${esc(`${o.title}: ${s.name}`)}"><text class="paneltitle" x="${m.l}" y="14">${esc(s.name)}</text>`]
    for (const v of yt) parts.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${f1(yy(v))}" y2="${f1(yy(v))}"/><text class="tick" x="${m.l - 6}" y="${f1(yy(v) + 4)}" text-anchor="end">${Math.round(v * 100)}%</text>`)
    counts[k].forEach((c, i) => {
      if (!c) return
      const x0 = xx(o.lo + i * o.step) + 1, w = Math.max(xx(o.lo + (i + 1) * o.step) - xx(o.lo + i * o.step) - 2, 1)
      parts.push(`<rect class="bar" x="${f1(x0)}" y="${f1(yy(c))}" width="${f1(w)}" height="${f1(yy(0) - yy(c))}" style="fill:${s.color}"><title>${esc(`${s.name}: ${mi(((o.lo + i * o.step) * 100).toFixed(1))}% to ${mi(((o.lo + (i + 1) * o.step) * 100).toFixed(1))}% · ${(c * 100).toFixed(1)}% of days`)}</title></rect>`)
    })
    for (const v of linearTicks(o.lo, o.hi, 4)) parts.push(`<text class="tick" x="${f1(xx(v))}" y="${H - 8}" text-anchor="middle">${mi(`${Math.round(v * 100)}%`)}</text>`)
    parts.push(`<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${f1(yy(0))}" y2="${f1(yy(0))}"/><line class="ref" x1="${f1(xx(0))}" x2="${f1(xx(0))}" y1="${m.t}" y2="${m.t + ph}"/></svg>`)
    return `<figure class="panel">${parts.join('')}<figcaption>${esc(o.notes[k] ?? '')}</figcaption></figure>`
  })
  return `<div class="panels">${panels.join('')}</div>`
}
